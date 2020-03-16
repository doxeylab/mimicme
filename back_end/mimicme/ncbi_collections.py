from collections import defaultdict
import json
import os
import sys

import gflags  
import pymongo

from connect import Connect

# Function that create the gi_info collection
def CreateGiInfo(collection, ncbi_dir):
  # Creates a mapping from gene id to protein gi numbers.
  gene_to_gis = defaultdict(list)
  i = 0
  with open(os.path.join(ncbi_dir, 'gene2accession')) as f:
    for l in f:
      i += 1
      if i % 10000 == 0:
        print i
      parts = l.split('\t')
      if len(parts) < 7 or parts[6] == '-':
        continue
      gene_to_gis[int(parts[1].strip())].append(int(parts[6].strip()))

  # Uses the previous mapping and the NCBI gene_info table to add documents
  # mapping gis to gene information.
  i = 0
  with open(os.path.join(ncbi_dir, 'gene_info')) as f:
    for l in f:
      i += 1
      if i % 10000 == 0:
        print i
      parts = l.split('\t')
      if len(parts) < 9:
        continue
      gene = int(parts[1].strip())
      if gene in gene_to_gis:
        symbol = parts[2].strip()
        locus = parts[3].strip()
        description = parts[8].strip()
        record = {'gene_id': gene, 'symbol' : symbol, 'locus_tag': locus,
                  'description': description, 'gis':gene_to_gis[gene]}
        collection.insert(record)

  # Index by gi protein numbers.
  collection.ensure_index([('gis',pymongo.ASCENDING)])

# Function to create the gi taxonomy mapping collection.
def CreateGiTaxonomy(collection, ncbi_dir):
  # Creates a mapping from tax id to organism name using the NCBI dump file.
  taxid_to_name = defaultdict(str)
  with open(os.path.join(ncbi_dir, 'names.dmp')) as f:
    for l in f:
      if 'scientific name' in l:
        parts = l.split('\t|\t')
        taxid = int(parts[0].strip())
        name = parts[1].strip()
        taxid_to_name[taxid] = name

  # Inserts a mapping from gi number to taxonomic information for all existing
  # gis.
  i = 0
  with open(os.path.join(ncbi_dir, 'gi_taxid_prot.dmp')) as f:
    for l in f:
      i += 1
      if i % 10000 == 0:
        print i
      parts = l.split('\t')
      gi = int(parts[0])
      taxid = int(parts[1])
      name = taxid_to_name[taxid]
      collection.insert({'gi' : gi, 'taxid': taxid, 'name' : name})
  collection.ensure_index([('gi',pymongo.ASCENDING)])

def main(argv):
  FLAGS = gflags.FLAGS

  gflags.DEFINE_string('ncbi_dir',
                       None,
                       'Directory containing NCBI ftp data files, including '
                       'gene_info, gene2accession, names.dmp, and '
                       'gi_taxid_prot.dmp.')
  try:
    argv = FLAGS(argv)  # parse flags
  except gflags.FlagsError, e:
    print '%s\\nUsage: %s ARGS\\n%s' % (e, sys.argv[0], FLAGS)
    sys.exit(1)

  db = Connect()
  CreateGiInfo(db.gi_info, FLAGS.ncbi_dir)
  CreateGiTaxonomy(db.gi_taxonomy, FLAGS.ncbi_dir)

if  __name__ == '__main__':
  main(sys.argv)
