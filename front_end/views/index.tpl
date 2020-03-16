% import time
% from bottle import request
<!DOCTYPE html>
<!--[if IE 8]> 				 <html class="no-js lt-ie9" lang="en" > <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang="en" > <!--<![endif]-->

<head>
	<meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  % if request.path.startswith('/mimicme'):
    <base href="/mimicme/">
  % end
  <title>MimicMe</title>
  <link rel="stylesheet" href="css/foundation.min.css" />
  <link rel="stylesheet" href="css/main.css?t={{time.time()}}" />
  <script type="text/javascript" src="js/vendor/custom.modernizr.js"></script>
  <script>
    (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
     (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new
     Date();a=s.createElement(o), m=s.getElementsByTagName(o)[0];
     a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
     })(window,document,'script',
     '//www.google-analytics.com/analytics.js','ga');

    ga('create', 'UA-26650205-2', 'uwaterloo.ca');
    ga('send', 'pageview');

  </script>
</head>
<body>

  <!-- Title -->
  <div id="overlay" class="overlay"></div>
	<div class="row">
		<div class="large-12 columns">
			<h2><a href="/" class='page-title'>MimicMe</a></h2>
			<p>By
      <a target="_blank" href="http://doxey.uwaterloo.ca/">
        <span style="color:red">Doxey</span><span style="color:gray">Lab</span>
      </a>.
      Find host-like proteins specific to pathogens.
      </p>
			<hr />
		</div>
	</div>

  <!-- Header tab: About, instructions, examples -->
  <div class="row">
    <div class="large-12 columns">
      <dl class="tabs" data-tab>
        <dd><a data-tab-content="#about">About</a></dd>
        <dd class="active">
          <a data-tab-content="#directions">Instructions</a>
        </dd>
        <dd><a data-tab-content="#workflows">Starting Workflows</a></dd>
        <dd><a data-tab-content="#citing">How to Cite</a></dd>
        <dd><a data-tab-content="#contact">Contact</a></dd>
      </dl>
      <div class="intro panel tabs-content">
        <div class="content" id="about">
          <p>
            One way that pathogens exploit their hosts is by mimicking host
            proteins. MimicMe aims to predict host-like proteins (mimics) in
            pathogenic organisms. Mimics are identified as pathogen proteins
            that display a higher degree of sequence similarity to host proteins
            (targets) than that detected from 
            <span data-tooltip class="has-tip" title="Non-Pathogen">
              control
            </span>
            proteomes. MimicMe is best suited to identifying pathogen mimics
            that are homologous to a host protein. Mimicry of shorter motifs may
            be detectable through altered BLAST settings (&quot;Short Motif
            Analysis&quot;) but this is still an experimental feature.
            <br/><br/>
            More details can be found in the
            <a href="http://www.ncbi.nlm.nih.gov/pubmed/23715053" 
               target="_blank">
               original paper</a>,
            which describes the analysis that was performed on <em>Homo sapiens
            </em>with a selection of 62 pathogens and 66 non-pathogens. An
            overview of the pipeline is shown below.
            <img src="./img/pipeline.png"/>
            <br/>
            If you experience any problems with the tool,
            please contact acdoxey {at} uwaterloo {dot} ca.
          </p>
        </div>
        <div class="content active" id="directions">
          <h3>How to MimicMe</h3>
          <ol>
            <li>Select your <strong style="color:#6A0888">analysis
                type</strong>. A homology analysis focuses on identifying
                mimicry of longer domains that have arisen through horizontal
                gene transfer or convergent evolution events, while a short
                <span data-tooltip class="has-tip" title="Note that the motif
                analysis option is a new feature and is
                currently only available when analyzing viral pathogens of
                humans. The motif analysis will soon be available for more
                hosts and microbes.">
                  motif analysis
                </span>
                focuses on identifying mimicry of shorter motifs by using
                alternative BLAST settings.
            <li>Select a <strong style="color:red">host organism</strong>.
                Take note, once this step is complete, your session will be
                saved. Just bookmark this page in your browser and reload at a
                later time to work with the same set of host/pathogens/controls.
                <br/>
                You will also have the option of switching between organism
                type (eg. bacteria, viruses, fungi, or protozoa).
            </li>
            <li>Select your
                <strong style="color:orange">pathogen organisms</strong>.</li>
            <li>Select your
                <strong style="color:green">control organisms</strong>.</li>
            <li>Tweak any additional enrichment-related
                <strong style="color:blue">settings</strong>.</li>
            <li>Submit and browse through all predicted mimics and host targets.
            </li>
          </ol>
        </div>
        <div class="content" id="workflows">
          <p>
            Start with one of the workflows here, and modify the input as
            necessary.
          </p>
          <ul>
            <li>
              <strong><em>Homo sapiens</em></strong>
              <ul>
                <li>
                  <button id="s14025031534294362779462"
                          type="button"
                          class="small">Launch</button>
                  <em>
                    Broad analysis of human pathogens
                    (Doxey &amp; McConkey, 2013)
                  </em>
                </li>
                <li>
                  <button id="s14038003290591718378994"
                          type="button"
                          class="small">Launch</button>
                  <em>
                    Mimicry in Legionella species
                  </em>
                </li>
                <li>
                  <button id="s14024612763629388367443"
                          type="button"
                          class="small">Launch</button>
                  <em>
                    Mimicry in Francisella species
                  </em>
                </li>
                <li>
                  <button id="s14029512072766644165276"
                          type="button"
                          class="small">Launch</button>
                  <em>
                    Mimicry in human viruses
                  </em>
                </li>
                <li>
                  <button id="s14092936051825849085201"
                          type="button"
                          class="small">Launch</button>
                  <em>
                    Short motif mimicry in human viruses
                  </em>
                </li>
              </ul>
            </li>
            <li>
              <strong><em>Arabidopsis thaliana</em></strong>
              <ul>
                <li>
                  <button id="s14037218455158108136947"
                          type="button"
                          class="small">Launch</button>
                  <em>
                    Mimicry in Pseudomonas syringae.
                  </em>
                </li>
              </ul>
            </li>
            <li>
              <strong><em>Salmo salar</em></strong>
              <ul>
                <li>
                  <button id="s14037215998389588156424"
                          type="button"
                          class="small">Launch</button>
                  <em>
                    Mimicry in Flavobacterium pathogens.
                  </em>
                </li>
              </ul>
            </li>
          </ul>
        </div>
        <div class="content" id="citing">
          <h3>How to Cite MimicMe</h3>
          <p>
            Petrenko P, Doxey AC. (2014) mimicMe: a web server for prediction
            and analysis of host-like proteins in microbial pathogens.
            <em><strong>Bioinformatics</strong></em>, btu681. <a target="_blank"
              href="http://www.ncbi.nlm.nih.gov/pubmed/25399027">[pubmed]</a>
            </li>
          </p>
          <br/>
          <u>Additional References</u><br/><br/>
          <ul>
            <li>
              Doxey AC, McConkey BJ. (2013) Prediction of molecular mimicry
              candidates in human pathogenic bacteria.
              <em><strong>Virulence</strong></em>, 4:1-14. <a target="_blank"
              href="http://www.ncbi.nlm.nih.gov/pubmed/23715053">[pubmed]</a>
            </li>
          </ul>
        </div>
        <div class="content" id="contact">
          <h3>Contact Us</h3>
          <p>
          Feel free to contact us anytime if you have any questions, concerns,
          or recommendations. In particular, please contact us if you would like
          to request additional host/microbial organisms for MimicMe.
          </p>
          <strong>Dr. Andrew C. Doxey</strong>:
          <span class="bootstrap-ey">acdoxey</span><br/><br/>
          <strong>Pavel Petrenko</strong> (Developer):
          <span class="bootstrap-ey">pavel.petrenko</span><br/><br/>
        </div>
      </div>
    </div>
  </div>

<div class="row initial-hide" id="content-tabs">
  <dl class="tabs large-12 columns" data-tab>
    <dd><a class="active" data-tab-content="#input">Input</a></dd>
    <dd><a data-tab-content="#output" id="results-tab">
      Predicted Mimicry Targets
    </a></dd>
    <dd><a class="active" data-tab-content="#enrichment">
      Enriched Functions
    </a></dd>
  </dl>
</div>

<div class="tabs-content row">
  <!-- Input Specification -->
  <div class="content active" id="input">
    <div class="large-4 columns">
      <div class="panel">
        <form name="settings" id="settings" data-abide>
          <div class="row">
            <div class="small-12 columns">
              <strong>Choose <span style="color:#6A0888">analysis type</span>
              </strong><br/><br/>
              <input type="radio" name="analysis-type" value="homology"
                     id="homology-anlaysis" checked="checked">
% homology_tip = ('Prediction of pathogen mimics that are likely homologous to '
%                 'host proteins.')
              <label for="homology-analysis" data-tooltip class="has-tip"
                     title="{{homology_tip}}">Homology analysis</label><br>
              <input type="radio" name="analysis-type" value="motif"
                     id="motif-analysis">
% motif_tip = ('Experimental feature: Prediction of mimicry between shorter '
%              'protein motifs that may result from convergent evolution.')
              <label for="motif-analysis" data-tooltip class="has-tip"
                     title="{{motif_tip}}">Short motif analysis
                     <span style="color:red;font-weight:normal">(beta)</span>
                     </label><br>
            </div>
          </div>
          <div class="row">
            <div class="small-12 columns">
              <strong>Choose <span style="color:red">host</span></strong><br/>
              <br/>
              <select id="host" name="host" title="Select Host Orgnaism">
                <option value="0">None Selected</option>
              </select>
            </div>
          </div>
          <div class="row">
            <div class="small-12 columns" id="organism-types">
            </div>
          </div>
          <div class="row initial-hide">
            <div class="small-12 columns">
              <a href="#" style="color:blue;font-size:0.875rem;"id="advanced">
                &#9654; Enrichment Settings
              </a><br/><br/>
              <div id="advanced-content">
                <div class="row">
                  <div class="small-7 columns">
% control_tip = ('Predicted mimicry targets in hosts will have at most this '
%                'many significant BLAST hits in the set of control organisms.')
                    <label style="color:blue" for="max-controls" data-tooltip
                           class="left inline has-tip" title="{{control_tip}}">
                      max control hits
                    </label>
                  </div>
                  <div class="small-5 columns">
                    <input type="text" id="max-controls" name="max-controls"
                           placeholder="0" pattern="^(([1-9]\d*)|0)$">
                    <small class="error" id="max-controls-e">Integer &gt;= 0</small>
                  </div>
                </div>
                <div class="row">
                  <div class="small-7 columns">
% pathogen_tip = ('Predicted mimicry targets in hosts will have at least this '
%                 'many significant BLAST hits (mimics) in the set of '
%                 'pathogens.')
                    <label style="color:blue" for="min-pathogens" data-tooltip
                           class="left inline has-tip" title="{{pathogen_tip}}">
                      min pathogen hits
                    </label>
                  </div>
                  <div class="small-5 columns">
                    <input type="text" id="min-pathogens" name="min-pathogens"
                           placeholder="1" pattern="^[1-9]\d*$">
                    <small class="error" id="min-pathogens-e">Integer &gt; 0</small>
                  </div>
                </div>
                <div class="row">
                  <div class="small-7 columns">
% fold_tip = ('When expecting both pathogen and control hits, use this setting '
%             'to place a minimum fold enrichment ratio in pathogens vs '
%             'controls. Enter 0 for no fold-enrichment filtering.')
                    <label style="color:blue" for="min-ratio" data-tooltip
                           class="left inline has-tip" title="{{fold_tip}}">
                      min pathogen:control
                    </label>
                  </div>
                  <div class="small-5 columns">
                    <input type="text" id="min-ratio" name="min-ratio"
                           placeholder="2.0" pattern="^(0|(0\.\d*)|([1-9]\d*\.?\d*))$">
                    <small class="error" id="min-ratio-e">Number &gt; 0</small>
                  </div>
                </div>
                <div class="row">
                  <div class="small-7 columns">
% bits_tip = ('When expecting both pathogen and control hits, raise this '
%             'threshold to filter for mimicry targets that have a pathogen '
%             'hit with an alignment bit score x units higher than any control '
%             'hit alignment. Enter 0 to not filter on this criteria.')
                    <label style="color:blue" for="min-difference" data-tooltip
                           class="left inline has-tip" title="{{bits_tip}}">
                      min bit difference
                    </label>
                  </div>
                  <div class="small-5 columns">
                    <input type="text" id="min-difference" name="min-difference"
                           placeholder="10"
                           pattern="^((0\.\d*)|([1-9]\d*\.?\d*))|0$">
                    <small class="error" id="min-difference-e">
                      Number &gt;= 0
                    </small>
                  </div>
                </div>
                <div class="row">
                  <div class="small-7 columns">
% expect_tip = ('Only use alignments that meet this e-value threshold to '
%               'identify mimics. Should be at most 20,000 for motif analyses '
%               'and at most 0.05 otherwise.')
                    <label style="color:blue" for="max-evalue" data-tooltip
                           class="left inline has-tip" title="{{expect_tip}}">
                      max e-value
                    </label>
                  </div>
                  <div class="small-5 columns">
                    <input type="text" id="max-evalue" name="max-evalue"
                           placeholder="0.0001"
                           pattern="^((0\.\d*)|(([1-9]\d*\.?\d*)([eE]-?\d+)?))$">
                    <small class="error" id="min-evalue-e">
                      0 &lt; eval &le; .05
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="row initial-hide">
            <div class="small-12 columns">
              <button type="submit" id="submit">Find all Mimics!</button>
            </div>
          </div>
        </form>
      </div>
    </div>
    <div class="large-4 columns">
      <div class="panel">
        <strong style="color:orange">Pathogens</strong><br/><br/>
        <div id="pathogen-div" class="organism-selection">
          Please select host organism.
        </div>
      </div>
    </div>
    <div class="large-4 columns">
      <div class="panel">
        <strong style="color:green">Controls</strong><br/><br/>
        <div id="control-div" class="organism-selection">
          Please select host organism.
        </div>
      </div>
    </div>
  </div>

  <!-- Results container -->
  <div class="results-container content" id="output">
    <div class="large-12 columns" id="mimicsContainer">
      <div class="panel">
        <div class="pagination-centered"><ul class="pagination"></ul></div>
        <div class="row collapse">
          <div class="large-10 columns">
            <input id="filter-field" type="text"
                   placeholder="Gene or species keyword (empty for all)"/>
          </div>
          <div class="large-2 columns">
            <a id="filter-button" class="button expand postfix">Filter</a>
          </div>
        </div>
        <strong id="listing-count"></strong><br/><br/>
        <div class="listing"></div>
        <a href="#" id="scroll-to-results">&#8593; To top of results</a><br/>
        <br/>
        <div class="exporter">
          <button id="export-gi">Export GI List</button>
          <button id="export-representative-gi">
            Export Representative GI List
          </button>
          <button id="export-json">Export All Results in JSON</button>
          <button id="export-tsv">
            Export Representative Results in TSV
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Enrichment container -->
  <div class="results-container content" id="enrichment">
    <div class="large-12 columns" id="enrichmentContainer">
      <div class="panel">
        <p>
          Here you can launch an analysis to determine common or enriched
          functions among your list predicted host mimicry targets. If a
          particular gene ontology term is statistically enriched among your
          set of predictions compared to a background distribution for the
          entire host proteome, it will be listed here once the analysis is
          complete. The GO terms are also sorted using the fold enrichment of
          the go term as well as the number of representative predictions in
          which it appears.
        </p>
        <button id="do-david-all">
          Start Analysis
        </button>
        <div id="david-results"></div>
        <button id="export-david">Export</button>
      </div>
    </div>
  </div>
</div>

  <!-- Model dialogs -->
  <div id="msa-modal" class="reveal-modal" data-reveal>
    <h2>MSA &amp; Conservation Among Pathogens</h2>
    <p>
      <strong style="color:#C0C000">yellow:</strong>
      residue is similar to host residue<br/>
      <strong style="color:#15C015">green:</strong>
      residue is identical to host residue<br/>
      The host residue uses the highest ranking color in the column.
    </p>
    <div id='msa' class='msa'></div>
    <a class="close-reveal-modal">&#215;</a>
  </div>
  <div id="structure-modal" class="reveal-modal" data-reveal>
    <h2 id='structure-title'>Structure &amp; Conservation</h2>
    <p> A host residue is conserved among pathogens if it is similar or
        identical to aligned residues in pathogen homologs:<br/>
               <strong style="color:#666666">dark gray:</strong> unmapped,
               <strong style="color:#BBBBBB">gray:</strong> not conserved,
               <strong style="color:#C0C000">yellow:</strong> less conserved,
               <strong style="color:#15C015">green:</strong> more conserved
    </p>
    <div id='structure' class='structure'></div>
    <textarea id='structure_src' class='structure-src'></textarea>
    <span>Note, if you cannot see any molecule above, wait a few seconds. If
          nothing changes, please make sure you are using a newer version of
          Firefox, chrome, opera, safari, or IE. Otherwise, please use the other
          link to download the conservation colored PDB file and use a
          standalone program such as chimera to view the protein.</span>
    <a class="close-reveal-modal">&#215;</a>
  </div>
  <div id="error-modal" class="reveal-modal" data-reveal>
    <h2>A Problem Occurred</h2>
    <span id='error-details'></span>
    <br/><br/>
    <span>Please contact acdoxey {at} uwaterloo {dot} ca if you need further
          assistance or if this problem keeps re-occuring.
    <span><br/>
    <a class="close-reveal-modal">&#215;</a>
  </div>
  <div id="message-modal" class="reveal-modal" data-reveal>
    <p></p>
    <a class="close-reveal-modal">&#215;</a>
  </div>
  <div id="saved-modal" class="reveal-modal" data-reveal>
    <h2>Saved Session Loaded</h2>
    <p>Your input has successfully been loaded from a previously saved session.
    </p>
    <a class="close-reveal-modal">&#215;</a>
  </div>
  <div id="suggestions-modal" class="reveal-modal" data-reveal>
    <h2>Suggested Organisms</h2>
    <p>A list of pathogens/controls has been suggested for this particular
       host. <strong>Note</strong> that the suggestions are a small subset of
       all possible pathogen/control inputs for the current host organism. Feel
       free to use these suggestions or remove them using the clear buttons.
    </p>
    <a class="close-reveal-modal">&#215;</a>
  </div>

  <script type="text/javascript" src="js/vendor/FileSaver.js"></script>
  <script type="text/javascript" src="js/vendor/jquery.js"></script>
  <script type="text/javascript" src="js/vendor/jquery.cookie.js"></script>
  <script type="text/javascript" src="js/vendor/jquery.browser.js"></script>
  <script type="text/javascript" src="js/vendor/jquery-ui.js"></script>
  <script type="text/javascript" src="js/vendor/jquery.scrollTo.min.js">
  </script>
  <script type="text/javascript" src="js/foundation/foundation.js"></script>
  <script type="text/javascript" src="js/foundation/foundation.abide.js">
  </script>
  <script type="text/javascript" src="js/foundation/foundation.reveal.js">
  </script>
  <script type="text/javascript" src="js/foundation/foundation.tooltip.js">
  </script>
  <script type="text/javascript" src="js/foundation/foundation.tab.js"></script>
  <script type="text/javascript" src="js/vendor/Three45.js"></script>
  <script type="text/javascript" src="js/vendor/GLmol.js?t={{time.time()}}">
  </script>
  <script type="text/javascript" src="js/vendor/ProteinSurface4.js"></script>
  <script type="text/javascript" src="js/mimicme/main.js?t={{time.time()}}">
  </script>
</body>
</html>
