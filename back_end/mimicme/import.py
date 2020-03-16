import json
import os
import sys

from collections import defaultdict

import gflags
import pymongo
from pymongo.errors import DuplicateKeyError

from connect import Connect

# Helper to import a JSON file line by line into a  MongoDB collection.
def ImportToCollection(file_path, collection):
  i = 0
  with open(file_path) as f:
    for l in f:
      if i % 10000 == 0:
        print i
      i += 1
      try:
        collection.insert(json.loads(l))
      except DuplicateKeyError:
        pass

# Import hits and alignments for the given host organisms and updates organism
# name mapping collections.
def main(argv):
  FLAGS = gflags.FLAGS

  gflags.DEFINE_string('host',
                       None,
                       'Host name with underscores.')
  gflags.DEFINE_string('alignments',
                       None,
                       'Path to json alignments file to be imported.')
  gflags.DEFINE_string('hits',
                       None,
                       'Path to json hits file to be imported.')
  try:
    argv = FLAGS(argv)  # parse flags
  except gflags.FlagsError, e:
    print '%s\\nUsage: %s ARGS\\n%s' % (e, sys.argv[0], FLAGS)
    sys.exit(1)

  db = Connect()

  # Imports hits to a host-specific collection.
  hits = db['%s_hits' % FLAGS.host]
  ImportToCollection(FLAGS.hits, hits)
  hits.ensure_index([('organism', pymongo.ASCENDING)])

  # Imports alignments to a host-specific table.
  alignments = db['%s_alignments' % FLAGS.host]
  ImportToCollection(FLAGS.alignments, alignments)
  alignments.ensure_index([('query', pymongo.ASCENDING),
                           ('target', pymongo.ASCENDING)])
  alignments.ensure_index([('target', pymongo.ASCENDING)])

  # Creates an entry in the organisms collection storing the organisms aligned
  # to this host. Organisms are grouped by type (eg. bacteria, viruses, etc.)
  organisms = db.organisms
  organism_tuples = [(h['_id'], h['organism'], h['type']) for h in hits.find()]
  organism_tuples.sort(key=lambda x:x[1])
  organism_types = set(h[2] for h in organism_tuples)
  per_type = defaultdict(list)
  for h in organism_tuples:
    per_type[h[2]].append(h[:-1])
  organisms.remove({'host':FLAGS.host})
  organisms.insert({'host':FLAGS.host, 'organisms':per_type})
  organisms.ensure_index([('host', pymongo.ASCENDING)])

  # Updates the gi number to host name mapping collection (gi_organisms).
  i = 0
  gi_organisms_map = {}
  for r in hits.find():
    i += 1
    print i
    for h in r['hits']:
      gi_organisms_map[h[1]] = r['organism']
  gi_organisms_all = [{'gi': k, 'organism': v}
                      for k,v in gi_organisms_map.iteritems()]
  gi_organisms = db.gi_organisms
  gi_organisms.ensure_index([('gi', pymongo.ASCENDING)], unique=True)
  try:
    gi_organisms.insert(gi_organisms_all, continue_on_error=True)
  except DuplicateKeyError:
    pass

if  __name__ == '__main__':
  main(sys.argv)
