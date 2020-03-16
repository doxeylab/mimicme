"""
Some bacterial bioprojects contain multiple bacterial species. This script
aggregates chromosome records into one file with the correct species name, but
in the case the different chromosome records represent different species, the
user is prompted with a choice whether to treat the files as one organism or
seperate organisms.
"""

import fnmatch
import os
import re

from collections import defaultdict

from Bio import SeqIO

for root, dirnames, filenames in os.walk('.'):
  name_to_path = defaultdict(list)
  filenames = list(fnmatch.filter(filenames, '*.faa'))
  if len(filenames) == 0:
    continue
  print root
  for filename in filenames:
    print filename
    path = os.path.join(root, filename)
    for record in SeqIO.parse(path, 'fasta'):
      name = record.description
      organism = re.search(r'\s\[(.+?)\][^\[\]]*?$', name)
      if organism:
        organism = organism.group(1)
        name_to_path[organism].append(filename)
        break
  seperate = False
  if len(name_to_path.keys()) > 1:
    decision = raw_input('Treat following organisms as seprate: %s (y/N): ' %
                         ','.join(name_to_path.keys()))
    if decision.strip().lower() == 'y':
      seperate = True
  if seperate:
    uid = os.path.basename(root)
    uid = uid[uid.index('uid'):]
    for num, (name, group) in enumerate(name_to_path.items()):
      new_name = '%s_%s%s.faa' % (re.sub('\W+','_', name), uid,
                                  chr(ord('A') + num))
      for filename in group:
        if new_name == filename:
          continue
        os.system('cat %s >> %s' % (os.path.join(root, filename),
                                    os.path.join(root, new_name)))
        os.system('rm %s' % os.path.join(root, filename))
  else:
    for filename in filenames:
      new_name = '%s.faa' % os.path.basename(root)
      if filename == new_name:
        continue
      os.system('cat %s >> %s ' % (os.path.join(root, filename),
                                   os.path.join(root, new_name)))
      os.system('rm %s' % os.path.join(root, filename))

