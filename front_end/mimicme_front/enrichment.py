"""
 The function in this file uses goa tools to find enriched functions among a
 list of genes. The use of DAVID api was replaced due to unreliability.
"""
from collections import defaultdict
import sys

from goatools import GOEnrichmentStudy
from goatools.obo_parser import GODag

# Helper to evaluate a numerator, denominator tuple.
def _EvaluateFraction(frac):
  return float(frac[0])/float(frac[1])

# Main function which returns a dictionary containing the sorted enrichment
# results.
# obo - Path to gene ontology obo dag file.
# ontology - MongoDB record containing both a background list of genes and a
#            gene to GO term association dictionary.
# gi_info - The MongoDB collection mapping from gi to gene_id.
# gis - a string of gis, where each gi is separated by a comma and each group of
#       similar/clustered gis is sepratated by a '|'.
def FindEnrichment(obo, ontology, gi_info, gis):
  # Parses the list of gis into lists of gi groups, and creates a mapping from
  # gi to group.
  groups = [[int(gi) for gi in group.split(',')] for group in gis.split('|')]
  gi_to_group = {gi:i for i,group in enumerate(groups) for gi in group}
  # Creates a gi to index map for sorting purposes.
  gis_index = {g:i for i,g in enumerate(gi for group in groups for gi in group)}
  # Creates a gi to gene id mapping.
  gis = gis_index.keys()
  gi_to_gene = {gi:d['gene_id'] for d in gi_info.find({'gis':{'$in':gis}})
                                if 'gene_id' in d and d['gene_id']
                                for gi in d['gis']}
  # Creatss a gene to gis list mapping.
  gene_to_gis = defaultdict(set)
  for gi, gene in gi_to_gene.iteritems():
    gene_to_gis[gene].add(gi)
  genes = set(gi_to_gene.itervalues())

  # Parameters for goatools:

  # Test-wise alpha for multiple testing
  alpha = 0.05
  # Family-wise alpha (whole experiment), only print out Bonferroni p-value is
  # less than this value.
  pval = 0.05
  # the population file as a comparison group. if this flag is specified, the
  # population is used as the study plus the `population/comparison`
  compare = False
  # only show values where the difference between study and population ratios is
  # greater than this. useful for excluding GO categories with small differences
  # but containing large numbers of genes. should be a value between 1 and 2.
  min_ratio = None
  # Calculates the false discovery rate (alt. to the Bonferroni but slower)
  fdr = False

  # Modifies the associations dictionary to become consistent with the actual term
  # ids and gene ids.
  associations = {int(k):set('GO:%s' % str(go).zfill(7) for go in v)
                  for k,v in ontology['associations'].iteritems()}
  population = set(ontology['population'])
  study = genes

  methods = ['bonferroni'] # Other methods: sidak, holm, fdr
  obo_dag = GODag(obo_file=obo)

  # Performs the enrichment analysis
  g = GOEnrichmentStudy(population, associations, obo_dag, alpha=alpha,
                        study=study, methods=methods)

  # Creates a mapping from GO term to gene ids. This is done after the analysis
  # since the analysis modifies the associations dictionary to include parent
  # terms.
  reverse_associations = defaultdict(set)
  for k,v in associations.iteritems():
    for go in v:
      reverse_associations[go].add(k)

  # Inserts each record into the final json array of results.
  results = []
  for record in g.results:
    # This is done by default in goatools when print to standard output.
    record.update_remaining_fields(min_ratio=min_ratio)
    if record.p_bonferroni > pval or not record.is_ratio_different:
      continue
    # Only returns enriched records.
    if record.enrichment != 'e':
      continue
    result = {}
    result['id'] = record.id
    level = obo_dag[result['id']].level
    # Filteres by GO term depth to avoid GO terms that are too general.
    if level < 2 and level >= 0:
      continue
    # FIlls in remaining fields.
    result['term'] = record.description
    study_ratio = _EvaluateFraction(record.ratio_in_study)
    population_ratio = _EvaluateFraction(record.ratio_in_pop)
    result['study_ratio'] = '%.4f' % study_ratio
    result['population_ratio'] = '%.4f' % population_ratio
    result['fold'] = study_ratio/population_ratio
    result['pval'] = '%.3g' % record.p_bonferroni

    # Uses the reverse associations dictionary to retrieve the list of gis that
    # matched the term.
    matched_genes = reverse_associations[result['id']] & genes
    matched_gis = set(gi for gene in matched_genes
                         for gi in gene_to_gis[gene])
    matched_gis &= set(gis)
    matched_gis = list(matched_gis)
    matched_gis.sort(key=lambda x: gis_index[x], reverse=True)
    result['all_genes'] = matched_gis
    # A representative set of genes is also returned in which only one gi per
    # group is returned.
    matched_groups = {gi_to_group[gi]:gi for gi in matched_gis}
    matched_gis = matched_groups.values()
    matched_gis.sort(key=lambda x: gis_index[x])
    result['genes'] = matched_gis
    results.append(result)

  # Results are sorted based on how well the fold change between the study and
  # popualtion ratios compares to other results, and how the number of
  # representative genes compares to other results.
  folds = sorted([r['fold'] for r in results])
  lengths = sorted([len(r['genes']) for r in results])
  results.sort(key=lambda r: (folds.index(r['fold']) +
                              lengths.index(len(r['genes'])))/2.0, reverse=True)
  return {'results' : results}
