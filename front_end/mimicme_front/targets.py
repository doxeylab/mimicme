"""
Contains the FindPredictedTargets functions that performs the main function of
searching for mimicry targets given the input.
"""

from collections import defaultdict
from heapq import merge
import logging

# Takes in all the required MongoDB collections and an input specification, and
# returns in JSON format mimicry target predictions grouped by similar host
# genes.
def FindPredictedTargets(hits, alignments, gi_info, gi_organisms, structures,
                         gi_localization, pathogens, controls, min_ratio,
                         min_difference, max_controls, min_pathogens,
                         max_evalue):
  # Removes control organisms that are in the pathogen set.
  controls = [control for control in controls if control not in pathogens]

  np = len(pathogens)
  nc = len(controls)
  # Retrieves the list of hits for each pathogen and control, and merges them.
  # Each list of hits for a particular organism is guaranteed to be sorted by
  # host protein and is guaranteed to have at most 1 bacteria hit per host
  # protein.
  logging.info('Getting pathogen and control hit lists.')
  pathogen_lists = [l['hits'] for l in
                    hits.find({'_id': {'$in': pathogens}})]
  control_lists = [l['hits'] for l
                   in hits.find({'_id': {'$in': controls}})]
  # heapq.merge assumes the lists are individually sorted, and produces a sorted
  # merged list.
  pathogens_all = merge(*pathogen_lists)
  controls_all = merge(*control_lists)

  # Once pathogen and control hit lists are merged and sorted, the following
  # fragment of code will iterate through pathogen hits in-step with the control
  # hits to analyze all hits for a particular host protein at a time. Once all
  # pathogen and control hits for the host protein are iterated through, the
  # hits are checked against a set of conditions to determine if the host
  # protein is a mimicry target prediction.
  logging.info('Finding predictions.')
  results = []
  try:
    c = next(controls_all)
    curr_c = c[0]
  except StopIteration:
    c = None
    curr_c = -1
  curr_p = -1
  for p in pathogens_all:
    if curr_p != p[0]:
      # Once we've seen all pathogen hits for the given host protein, we will
      # iterate through the control list to find all control hits.
      if curr_p >= 0:
        while c and curr_c < curr_p:
          try:
            c = next(controls_all)
            curr_c = c[0]
          except StopIteration:
            c = None
        while c and curr_c == curr_p:
          if c[3] <= max_evalue:
            c_hits.append(c)
            max_c_bits = max(max_c_bits, c[2])
          try:
            c = next(controls_all)
            curr_c = c[0]
          except StopIteration:
            c = None
        # Checks all conditions to determine if the host protein meets the
        # criteria for a mimicry target prediction.
        if (len(p_hits) >= min_pathogens and len(c_hits) <= max_controls and
            (len(c_hits) == 0 or min_difference == 0 or
             max_p_bits - max_c_bits >= min_difference) and
            (len(c_hits) == 0 or min_ratio == 0 or
             len(p_hits)/len(c_hits) >= min_ratio)):
          p_hits.sort(key=lambda x: x[2], reverse=True)
          c_hits.sort(key=lambda x: x[2], reverse=True)
          results.append((p_hits, c_hits, max_p_bits, max_c_bits))
      curr_p = p[0]
      max_p_bits = p[2] if p[3] <= max_evalue else 0
      max_c_bits = 0
      p_hits = [p] if p[3] <= max_evalue else []
      c_hits = []
    else:
      # Iterating through the pathogen hits for the same host protein.
      if p[3] <= max_evalue:
        p_hits.append(p)
        max_p_bits = max(max_p_bits, p[2])

  if len(results) > 5000:
    return {'error': 'Too many predictions. Please add more constraints.'}
    
  # Sort by accuracy and then max bit difference.
  results.sort(key=lambda x: ((1.0*(len(x[0]) + nc - len(x[1])))/(np+nc),
                              x[2]-x[3]), reverse=True)


  # Fetches gene info and taxonomy info for host and bacteria proteins.
  logging.info('Fetching more data for proteins and alignments.')
  bacteria_gis = list(set([hit[1] for r in results for hit in r[0]+r[1]]))
  host_gis = [r[0][0][0] for r in results]
  b_gi_info = gi_info.find({'gis':{'$in':bacteria_gis}})
  b_gi_info = {gi:info for info in b_gi_info for gi in info['gis']}
  b_gi_info = defaultdict(
    lambda:{'gene_id':0, 'symbol':'', 'description':'', 'locus_tag':''},
    b_gi_info)
  b_taxonomy = {t['gi']:t
                for t in gi_organisms.find({'gi':{'$in':bacteria_gis}})}
  b_taxonomy = defaultdict(
    lambda:{'name':'Unknown Name', 'taxid':0}, b_taxonomy)
  b_localization = {l['gi']:l
                    for l in gi_localization.find({'gi':{'$in':bacteria_gis}})}
  b_localization = defaultdict(
    lambda:{'location':'Unknown', 'score':'0.00'}, b_localization)
  h_gi_info = gi_info.find({'gis':{'$in':host_gis}})
  h_gi_info = {gi:info for info in h_gi_info for gi in info['gis']}
  h_gi_info = defaultdict(
    lambda:{'gene_id':0, 'symbol':'', 'description':''}, h_gi_info)
  h_structures = structures.find({'gi':{'$in':host_gis}})
  h_structures = {h['gi']:h['pdbs'] for h in h_structures}

  # Fetches alignment info for all host/bacteria pairs. Note, since the $in
  # operator can only be used for one field, we find all alignments that contain
  # the bacterial protein, and at a later phase we filter for the actual
  # alignment objects for the host and bacteria protein pairs in our results.
  # Perhaps this can be improved at a later time by inserting the alignment
  # object id into the hits lists, but it is unclear how much this would improve
  # runtime.
  b_alignments = alignments.find({'target':{'$in':bacteria_gis}})
  b_alignments = {(a['query'], a['target']):a for a in b_alignments}

  # Groups all data for each result together into JSON form.
  logging.info('Grouping results.')
  final_results = []
  seen_targets = {}
  for p_hits, c_hits, max_p_bits, max_c_bits in results:
    result = {}
    result['gi'] = p_hits[0][0]
    result['total_pathogens'] = len(p_hits)
    result['total_controls'] = len(c_hits)
    result['max_bits_in_pathogens'] = max_p_bits
    result['max_bits_in_controls'] = max_c_bits

    info = h_gi_info[result['gi']]
    result['gene_id'] = info['gene_id']
    result['gene_symbol'] = info['symbol']
    result['description'] = info['description']
    result['structures'] = (h_structures[result['gi']]
                            if result['gi'] in h_structures else None)

    result['pathogen_hits'] = _CompleteHits(b_alignments, b_gi_info, b_taxonomy,
                                            b_localization, p_hits)
    result['control_hits'] = _CompleteHits(b_alignments, b_gi_info, b_taxonomy,
                                           b_localization, c_hits)

    # Results are grouped by similar bacteria protein hits. If a result shares
    # a bacteria hit with a previous result (host protein), then it is grouped
    # with that result.
    similar_targets = []
    seen = False
    pathogen_gis = [hit['gi'] for hit in result['pathogen_hits']]
    for gi in pathogen_gis:
      if gi in seen_targets:
        similar_targets = seen_targets[gi]
        seen = True
        break
    for gi in pathogen_gis:
      seen_targets[gi] = similar_targets
    if not seen:
      result['similar_results'] = similar_targets
      final_results.append(result)
    else:
      similar_targets.append(result)

  return {'results' : final_results}

# Helper to group together data for each hit/alignment.
def _CompleteHits(alignments, gi_info, gi_taxonomy, gi_localization,
                  simple_hits):
  final_hits = []
  for query, target, bits, expect in simple_hits:
    if (query, target) not in alignments:
      logging.error('Alignment not found: q:%d, t:%d' % (query, target))
      continue
    hit = alignments[(query, target)]
    final_hit = {}
    final_hit['gi'] = hit['target']
    final_hit['alignment_query_start'] = hit['alignment_query_start']
    final_hit['alignment_target_start'] = hit['alignment_target_start']
    final_hit['alignment_query'] = hit['alignment_query']
    final_hit['alignment_match'] = hit['alignment_match']
    final_hit['alignment_target'] = hit['alignment_target']
    final_hit['bits'] = bits
    final_hit['evalue'] = expect

    info = gi_info[final_hit['gi']]
    final_hit['gene_id'] = info['gene_id']
    final_hit['gene_symbol'] = info['symbol']
    final_hit['description'] = info['description']
    final_hit['locus_tag'] = info['locus_tag']

    taxonomy = gi_taxonomy[final_hit['gi']]
    final_hit['organism_name'] = taxonomy['organism']

    localization = gi_localization[final_hit['gi']]
    final_hit['location'] = localization['location']
    final_hit['location_score'] = localization['score']

    final_hits.append(final_hit)
  return final_hits
