from collections import defaultdict
import logging
import os
import re
import sys

import gflags
import pymongo
from pymongo.errors import DuplicateKeyError

from connect import Connect

# To canonicalize organism names, all non-letter characters are removed
# including underscores, and all remaining characters are converted to lower
# case.
def _NormalizedName(name):
  return re.sub(r'[\W_]', '', name.lower())

# Creates/updates a suggestion collection using host suggestion files.
def CreateSuggestionsTable(suggestions_dir):
  db = Connect()
  suggestions = db.suggestions

  # By default, the suggestions for a particular host will be an empty list of
  # pathogens and an empty list of controls.
  all_suggestions = defaultdict(
    lambda:defaultdict(lambda:{'pathogens':[],'controls':[]}))

  # Each suggestion file is read one by one.
  for host_suggestions_file in os.listdir(suggestions_dir):
    match = re.match(r'(.*)_(\w+)_(controls|pathogens).txt',
                     host_suggestions_file)
    if not match:
      logging.info('Skipping %s' % host_suggestions_file)
      continue
    else:
      logging.info('Working on %s' % host_suggestions_file)

    host = match.group(1)
    subtype = match.group(2)
    is_p = 1 if match.group(3) == 'pathogens' else 0

   # Stores all organism ids that were matched.
    matched = []

    # Reads the organism names from the hits table and creates a mapping from
    # host cannonical name to host id.
    hits = db['%s_hits' % host]
    organisms = {}
    for result in hits.find({}, {'organism':1}):
      organisms[_NormalizedName(result['organism'])] = str(result['_id'])

    # For each line in the suggestions file, checks if the cononical organism
    # name is a prefix of an organism in the hits collection.
    full_path = os.path.join(suggestions_dir, host_suggestions_file)
    with open(os.path.join(suggestions_dir, host_suggestions_file)) as f:
      for suggestion in f:
        target_name = _NormalizedName(suggestion)
        for organism_name, organism_id in organisms.iteritems():
          if organism_name.startswith(target_name):
            matched.append(organism_id)
 
    # Adds the list of pathogen or control suggestions to the host.
    all_suggestions[host][subtype]['pathogens' if is_p
                                   else 'controls'] = matched

  # Adds the suggestions per organism to the mongo collection.
  for host, val in all_suggestions.iteritems():
    try:
      suggestions.insert({'host':host,
                          'suggestions': val})
    except DuplicateKeyError:
      pass
 
  # There should only be one entry per host.
  suggestions.ensure_index([('host',pymongo.ASCENDING)],
                           unique=True, 
                           dropDups=True)

def main(argv):
  FLAGS = gflags.FLAGS

  gflags.DEFINE_string('suggestions_dir',
                       None,
                       'Path to directory containing suggestions files.')

  logging.getLogger().setLevel(logging.INFO)
  try:
    argv = FLAGS(argv)  # parse flags
  except gflags.FlagsError, e:
    print '%s\\nUsage: %s ARGS\\n%s' % (e, sys.argv[0], FLAGS)
    sys.exit(1)

  CreateSuggestionsTable(FLAGS.suggestions_dir)

if  __name__ == '__main__':
  main(sys.argv)
