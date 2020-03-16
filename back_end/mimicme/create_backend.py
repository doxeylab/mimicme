#!/usr/bin/python
import csv
import logging
import json
import math
import os
import re
import shutil
import signal
import sys
import tempfile

from time import sleep
from random import random

import gflags
from mpi4py import MPI
from Bio.Blast import NCBIXML

from mimicme_blast import DoBlast, FullHomologySettings
from organisms import OrganismsInDir, Organism

# MPI CODES

# Request and response tags.
BLAST_PAIR_REQUEST_TAG = 11
BLAST_PAIR_RESPONSE_TAG = 12

# Responses from nodes.
SUCCESS_RESPONSE = 0
FAIL_RESPONSE = 1
STALL_RESPONSE = 2

# Cammands for nodes.
NODE_RUN = 0
NODE_STALL = 1
NODE_DONE = 2

# For debugging.
logging.basicConfig(level=logging.DEBUG)
logger = None

FLAGS = gflags.FLAGS
gflags.DEFINE_string('fasta_dir',
                     'fasta_dir/',
                     'Path to folder containing all fasta files. The folder '
                     'must consist of 2 subfolders: microbes and hosts')
gflags.DEFINE_string('output_dir',
                     'output/',
                     'Path to dir which will contain output json files.')
gflags.DEFINE_string('tmp_dir',
                     '/tmp',
                     'Some clustors (sharcnet) prefer that you do not use the '
                     'default temporary directory.')

################################################################################
# FUNCTIONS
################################################################################

# Method that takes a list of hosts and microbes, and distributes pairwise BLAST
# jobs to child nodes. This is run only by the master node (node 0).
def DistributeBlasts(comm, hosts, microbes):
  # All pairwise BLASTS between hosts and microbes.
  all_blasts = [[host, bacterium, 6] for host in hosts for bacterium in microbes]
  # A child node is active if it is stalling or performing BLASTs. A node stalls
  # if there is no work to perform at the moment, but maybe there will be work
  # later in case of a transient failure on another node.
  # A child node is busy if it is performing a BLAST.
  nodes = comm.Get_size()
  active_child_nodes = nodes - 1
  busy_child_nodes = 0
  while active_child_nodes > 0:
    # If there are active nodes, then one of them will eventually send a message
    # to the master node for further instruction.
    jobless_node, response, failed_pair = comm.recv(
      source=MPI.ANY_SOURCE, tag=BLAST_PAIR_REQUEST_TAG)
    logger.info('Received response code %d from node %d' %
                (response, jobless_node))
    # If the node did not just come back from a stall, than it just finished
    # performing/attempting a BLAST.
    if response != STALL_RESPONSE:
      busy_child_nodes -= 1
    # In case of a failure, the job is put back onto a queue and will be given
    # to a new node at a later time. The failed node is then asked to stall.
    if response == FAIL_RESPONSE:
      logger.info('%d failed, asking to stall' % jobless_node)
      all_blasts.insert(0, failed_pair)
      # We want another node to pick up this BLAST pair.
      comm.send(
        [NODE_STALL, None], dest=jobless_node, tag=BLAST_PAIR_RESPONSE_TAG)
    elif len(all_blasts) > 0:
      # If the node has just woken up from a stall or just completed a BLAST
      # successfully, it is asked to perform another BLAST if possible.
      logger.info('sending new blast pair to %d' % jobless_node)
      pair = all_blasts.pop()
      busy_child_nodes += 1
      comm.send(
        [NODE_RUN, pair], dest=jobless_node, tag=BLAST_PAIR_RESPONSE_TAG)
    elif busy_child_nodes > 0:
      # If there is no work available, but there are still busy nodes, the
      # current node is asked to stand by in the case a job needs to be retried
      # due to a failure.
      logger.info('No work available, asking %d to stall' % jobless_node)
      logger.info('%d nodes still busy' % busy_child_nodes)
      comm.send(
        [NODE_STALL, None], dest=jobless_node, tag=BLAST_PAIR_RESPONSE_TAG)
    else:
      # Once all work is complete, all child nodes should shut down.
      logger.info('All work done, telling %d to finish' % jobless_node)
      # No more BLASTing to do, finish off the nodes one by one.
      active_child_nodes -= 1
      comm.send(
        [NODE_DONE, None], dest=jobless_node, tag=BLAST_PAIR_RESPONSE_TAG)

# These classes will be used to trigger a timeout on a sleep call.
class _AlarmException(Exception):
  pass

def _AlarmHandler(signum, frame):
  raise _AlarmException

# This function is only run by child nodes and is responsible for performing
# BLASTs and stalls as indicated by the master node.
def BlastAsManyAsPossible(comm):
  rank = comm.Get_rank()
  # Create temporary directory for temporary BLAST databases, and set in
  # environment for child processes.
  blast_db_path = tempfile.mkdtemp(dir=FLAGS.tmp_dir)
  os.environ['BLASTDB'] = blast_db_path
  # TODO(ppetrenk): BLAST doesn't appear to be using this environment variable.
  # investigate further to determine how to force BLAST to use a specified tmp
  # directory.
  os.environ['TMPDIR'] = tempfile.mkdtemp(prefix='TMPDIR', dir=FLAGS.tmp_dir)

  dbindex = 0
  failed_pair = None
  response = STALL_RESPONSE
  while True:
    comm.send([rank, response, failed_pair], dest=0, tag=BLAST_PAIR_REQUEST_TAG)
    logger.info('Waiting for instructions')
    command, pair = comm.recv(source=0, tag=BLAST_PAIR_RESPONSE_TAG)
    logger.info('Received %d command code' % command)
    # A child node can receive one of 3 instructions. Either its work is
    # complete, or it needs to stall (sleep), or it should do a BLAST.
    if command == NODE_DONE:
      break
    elif command == NODE_STALL:
      # Stall for 1 to 3 minutes
      # Unfortunately, sometimes the sleep command hangs, and we need other
      # measures to wake up the program, using alarm exceptions.
      sleep_time = int(60 + 2*60*random())
      signal.signal(signal.SIGALRM, _AlarmHandler)
      # The alarm is set for 1 minute after the sleep timeout.
      signal.alarm(sleep_time + 60)
      try:
        logger.info('Stalling for %f seconds', sleep_time)
        sleep(sleep_time)
        signal.alarm(0)
      except Exception as e:
        pass
      logger.info('Waking up')
      response = STALL_RESPONSE
      failed_pair = None
      continue
    else:
      # May change if BLAST fails.
      response = SUCCESS_RESPONSE
      failed_pair = None
    host, target, timeout = pair
    # Determines names for hits and alignments dumpfiles. Names are constructed
    # from the host and the microbial organism names. These dumfiles will then
    # be concatenated into 2 large JSON output files.
    hits_file_name = os.path.join(
      FLAGS.tmp_dir, '%s_%s_hits.dump' % (host.name, target.name))
    alignments_file_name = os.path.join(
      FLAGS.tmp_dir, '%s_%s_alignments.dump' % (host.name, target.name))
    # If the files already exist, skip the BLAST and report a success.
    if os.path.isfile(hits_file_name) and os.path.isfile(alignments_file_name):
      logger.info('Already blasted %s against %s.' %
                  (host.name, target.name))
      continue

    # Create a BLAST db for the target organism proteome.
    # TODO(ppetrenk): No need to create db, can use -subject in blastp cmd.
    logger.info('Blasting %s against %s.' % (host.name, target.name))
    target_db_name = 'tempdb%d' % dbindex
    dbindex += 1
    logger.info('Creating target BLAST db: %s' % target_db_name)
    os.system(
        'makeblastdb -dbtype \'prot\' -in %s -out %s -title %s > /dev/null 2>&1' %
        (target.path, os.path.join(blast_db_path, target_db_name),
         target_db_name))

    # Performs the BLAST of the host proteome against the given pathogen
    # proteome.
    success, blast_output = DoBlast(host.path,
                                    target_db_name,
                                    FullHomologySettings(),
                                    FLAGS.tmp_dir,
                                    logger,
                                    max_hours=timeout)
    # In case of a successfull BLAST, extract the necessary BLAST output into
    # the hits and alignments files. Otherwise, report a failure.
    if success:
      ProcessToOutput(blast_output, target, hits_file_name,
                      alignments_file_name)
    else:
      response = FAIL_RESPONSE
      if os.stat(blast_output).st_size > 0:
        timeout += 4
      failed_pair = host, target, timeout

  # Clean up.
  shutil.rmtree(blast_db_path)
  logger.info('Done BLASTs on chunk %d' % rank)

# Helper to retrive the gi number from a title/description in the BLAST output.
def _GetGI(field):
  gi = None
  gi_parser = re.search(r'gi\|(\d+)\|', field)
  if gi_parser:
    gi = gi_parser.group(1)
  else:
    logger.warning('gi not found: %s' % field)
  return gi

# Function that processes BLAST ouptut
def ProcessToOutput(blast_output, target, hits_file_name,
                    alignments_file_name):
  # Produces a generater that parses BLAST output.
  result_handle = open(blast_output)
  blast_records = NCBIXML.parse(result_handle)

  logger.info('Processing XML output')

  hits_file = open(hits_file_name, 'w', 1)
  alignments_file = open(alignments_file_name, 'w', 1)
  all_hits = []
  # Collect all hits in an array, to be sorted and written as one documented
  # after words. However, each alignment will be written to the alignments dump
  # file as the BLAST records are processed.
  # For each host protein.
  for blast_record in blast_records:
    query_gi = _GetGI(blast_record.query)
    if not query_gi:
      continue
    a_i = 0
    # For each microbe protein hit.
    for alignment in blast_record.alignments:
      target_gi = _GetGI(alignment.title)
      if not target_gi:
        continue
      # Only the highest scoring HSP is considered.
      # TODO(ppetrenk): Decide what to do with other HSPs.
      for hsp in alignment.hsps:
        alignment_object = {
          'query' : int(query_gi),
          'target' : int(target_gi),
          'bits' : hsp.bits,
          'score' : hsp.score,
          'expect' : hsp.expect,
          'identities' : hsp.identities,
          'positives' : hsp.positives,
          'gaps' : hsp.gaps,
          'alignment_query' : hsp.query,
          'alignment_match' : hsp.match,
          'alignment_target' : hsp.sbjct,
          'alignment_target_start' : hsp.sbjct_start,
          'alignment_query_start' : hsp.query_start
        }
        alignments_file.write('%s\n' % json.dumps(alignment_object))
        # All alignments are saved for other purposes, but for MimicMe purposes,
        # we only care about the top hit for each host protein.
        if a_i == 0:
          hit_object = (int(query_gi), int(target_gi), hsp.bits, hsp.expect)
          all_hits.append(hit_object)
        a_i += 1
        break
  # Sort hits by host gene.
  all_hits = sorted(all_hits)
  hits_object = {'organism' : target.name, 'hits': all_hits,
                 'type': target.subtype, '_id': target.uid}
  hits_file.write('%s\n' % json.dumps(hits_object))
  logger.info('Done processing XML output')

  # Clean up
  hits_file.close()
  alignments_file.close()
  result_handle.close()
  os.remove(blast_output)

# Function to aggregate all hits dumpfiles into the hits JSON file, and all
# alignments dumfiles into the alignments JSON file.
def CreateJSONOutput(hosts):
  for host in hosts:
    host_escaped = host.name.replace(' ', '\ ')
    os.system('cat %s/%s*_hits.dump > %s/%s_hits.json' % (
      FLAGS.tmp_dir, host_escaped, FLAGS.output_dir, host_escaped
    ))
    os.system('cat %s/%s*_alignments.dump > %s/%s_alignments.json' % (
      FLAGS.tmp_dir, host_escaped, FLAGS.output_dir, host_escaped
    ))

def main(argv):
  global logger
  try:
    argv = FLAGS(argv)  # parse flags
  except gflags.FlagsError, e:
    print '%s\\nUsage: %s ARGS\\n%s' % (e, sys.argv[0], FLAGS)
    sys.exit(1)

  comm = MPI.COMM_WORLD
  rank = comm.Get_rank()
  size = comm.Get_size()
  
  # Creates a log for each node.
  logger = logging.getLogger('BackendCreator%d' % rank)
  hdlr = logging.FileHandler(os.path.join(FLAGS.tmp_dir, '%d.log' % rank))
  formatter = logging.Formatter('%(asctime)s %(levelname)s %(message)s')
  hdlr.setFormatter(formatter)
  logger.addHandler(hdlr)
  logger.setLevel(logging.INFO)
  logger.info('Node %d on host: %s' % (rank, os.uname()[1]))

  if size < 2:
    logger.error('At least 2 nodes needed. First node is master.')
    sys.exit(1)

  # Node 0 retrieves all organisms and indices, while other nodes wait. Then it
  # distributes BLASTs and waits for them to finish, before aggregating all
  # output files to 2 JSON files per host.
  if rank == 0:
    # TODO(ppetrenk): Differentiate between new organisms and existing
    # organisms, and only run blasts on new pairs of organisms. This way,
    # updating the database is even easier, and does not require manually
    # creating the hosts/microbe directories to fit your needs.
    hosts = OrganismsInDir(os.path.join(FLAGS.fasta_dir, 'hosts'),
                           Organism.HOST)
    microbes = OrganismsInDir(os.path.join(FLAGS.fasta_dir, 'microbes'),
                              Organism.MICROBE)

    DistributeBlasts(comm, hosts, microbes)

    CreateJSONOutput(hosts)

    # Unfortunately, due to hanging sleeps that need to be interupted, some of
    # the nodes to not actually finish running, since they seem to have threads
    # that are still running (and doing nothing). Thus, we have to force shut
    # down the MPI program here.
    comm.Abort()
  else:
    BlastAsManyAsPossible(comm)
  sys.exit(0)
 
if  __name__ == '__main__':
  main(sys.argv)
