// Global state variables.
var index = null
var hosts = null;
var all_results = null;
var representative_gis = null;
var all_organisms = null;
var results = null;
var dictionary = null;
var page = 0;
var curr_structure = null;
var host_organism = null;
var organism_type = 'bacteria';
var selected_pathogens = null;
var selected_controls = null;
var session_id = null;
var existing_session_id = null;
var saved_data = null;
var organism_id_map = null;
var id_organism_map = null;
var just_added = null;
var suggestions = null;
var david_rows = null;
var david_x = 50;
var RESULTS_PER_PAGE = 20;

// On startup, set the action of all buttons, and retrieve hosts and other data.
$(function(){
  $(document).foundation();
  $('input[type=radio][name=analysis-type]').change(SwitchAnalysisType);

  $('.bootstrap-ey').each(function() {
    var text = $(this).text();
    var new_elem = $('<a href="mailto:'+text+'@uwaterloo.ca">'+text+
                     '@uwaterloo.ca</a>');
    $(this).replaceWith(new_elem);
  });

  // Export buttons.
  $('#export-gi').add($('#export-representative-gi')).click(function() {
    if ($(this).attr('id') == 'export-gi') {
      var gis = GetGis();
    } else {
      var gis = GetGis(Infinity, true);
    }
    for (var i = 0; i < gis.length; i += 1) {
      gis[i] += '\n';
    }
    var blob = new Blob(gis, {type: "text/plain;charset=utf-8"})
    saveAs(blob, "gi_list.txt");
  });
  $('#export-json').click(function() {
    var blob = new Blob([JSON.stringify(results)], {type: 'application/json'})
    saveAs(blob, "results.json");
  });
  $('#export-tsv').click(function() {
    var blob = new Blob(TSVResults(), {type: "text/plain;charset=utf-8"})
    saveAs(blob, "results.tsv");
  });

  $('#workflows button').click(function(e){
     var new_session_id = 's'+(new Date().getTime()) + '' +
                          Math.round(Math.random()*10e9);
     DoPost('#'+new_session_id, { workflow:$(this).attr('id'),
                                  session_id: new_session_id });
  });

  // David buttons.
  $('#do-david-all').click(function(e) {
    e.preventDefault();
    var gi_strings = [];
    for (var i = 0; i < all_results.length; i += 1) {
      var result = all_results[i];
      var gis = [result['gi']];
      if ('similar_results' in result) {
        for (var j = 0; j < result['similar_results'].length; j+= 1) {
          gis.push(result['similar_results'][j]['gi']);
        }
      }
      gi_strings.push(gis.join(','));
    }
    StartOverlayUsingMessage(
      'Performing function enrichment analysis');
    $.post('david', {genes : gi_strings.join('|'), host: host_organism},
           DavidDone)
      .fail(function() {
      Error('Enrichment failed due to an internal problem.');
    });
  });
  $('#export-david').click(function() {
    blob = new Blob(DavidTsv(), {type: "text/plain;charset=utf-8"})
    saveAs(blob, "enrichment-analysis.tsv");
  }).hide();

  // Advanced settings.
  $('#advanced-content').slideToggle(0);
  $("#advanced").click(function(e) {
    e.preventDefault();
    var content = $('#advanced-content');
    var text = content.is(':visible') ?
      '&#9654; BLAST &amp; Enrichment Settings':
      '&#9660; BLAST &amp; Enrichment Settings';
    $(this).html(text);
    content.slideToggle(200);
  });

  // Scroll buttons.
  $('#scroll-to-results').click(function(e) {
    e.preventDefault();
    $('body').animate({'scrollTop' : $('#mimicsContainer').offset().top}, 500);
  });

  // Rertieve all hosts and any saved session.
  existing_session_id = location.hash.substr(location.hash.indexOf('#')+1);
  $.getJSON('hosts', {session_id : existing_session_id},
            HostsLoaded).fail(function() {
    Error('Could not retrive host organisms from server due to an internal '+
          'problem.');
  });
});

// http://stackoverflow.com/questions/133925/javascript-post-request-like-a-form-submit
function DoPost(path, params, method) {
  method = method || "post";

  var form = document.createElement("form");
  form.setAttribute("method", method);
  form.setAttribute("action", path);

  for(var key in params) {
    if(params.hasOwnProperty(key)) {
      var hiddenField = document.createElement("input");
      hiddenField.setAttribute("type", "hidden");
      hiddenField.setAttribute("name", key);
      hiddenField.setAttribute("value", params[key]);
      form.appendChild(hiddenField);
     }
  }

  document.body.appendChild(form);
  form.submit();
}

// Converts the DAVID json results into TSV format, and returns and array of
// lines.
function DavidTsv() {
  var rows = [];
  rows.push('GO ID\tDescription\tStudy Ratio\tPopulation Ratio\t' +
            'Bonferroni p-value\tRepresentative Genes\tAll Genes\n')
  for (var i = 0; i < david_rows.length; i += 1) {
    var row = david_rows[i];
    rows.push(row['id'] + '\t' + row['term'] + '\t' + row['study_ratio'] +
              '\t' + row['population_ratio'] + '\t' + row['pval'] + '\t' +
              row['genes'].join(',') + '\t' + row['all_genes'].join(',') +'\n');
  }
  return rows;
}

// Helper to the subsequent function. Converts a single hit to a TSV line.
function TSVResultRow(result, hit, type) {
  return result['gi'] + '\t' + result['description'] + '\t' + hit['gi'] + '\t' +
         hit['description'] + '\t' + hit['organism_name'] + '\t' + type + '\t' +
         hit['bits'] + '\t' + hit['evalue'] + '\t' + hit['location']+ '\t' +
         hit['location_score'] + '\n';
}

// Converts the list of results results into a flat TSV format. There is a line
// for each pathogen and control hit of each mimicry target prediction.
function TSVResults() {
  var rows = [];
  // Header.
  rows.push('Host GI\tHost Gene Description\tHit GI\tHit Gene Description\t' + 
            'Hit Organism\tHit Organism Type\tAlignment Bits\t' +
            'Alignment E-value\tPSORTdb Localization\tPSORTdb Score\n');
  for (var i = 0; i < results.length; i += 1) {
    var result = results[i];
    var pathogen_hits = result['pathogen_hits'];
    var control_hits = result['control_hits'];
    for (var j = 0; j < pathogen_hits.length; j += 1) {
      rows.push(TSVResultRow(result, pathogen_hits[j], 'pathogen'));
    }
    for (var j = 0; j < control_hits.length; j += 1) {
      rows.push(TSVResultRow(result, control_hits[j], 'control'));
    }
  }
  return rows;
}

// Once DAVID enrichment has been completed by the server, the JSON results are
// formatted to be displayed in the DAVID results tab.
function DavidDone(data) {
  if ('error' in data) {
    $('#david-results').text(data['error']);
  } else {
    david_rows = data['results'];
    var list = $('<ul/>');
    for (var i = 0; i < david_rows.length; i += 1) {
      var row = david_rows[i];
      var li = $('<li/>');
      var title = CreateGoTitle(row['id'], row['term']);
      li.append(title)
        .append('<br/>')
        .append($('<span/>').text(
          'Enrichment p-value (Bonferroni): ' +
          parseFloat(row['pval']).toExponential()))
        .append('<br/>')
        .append($('<span/>').text('Forground Frequency: ' + row['study_ratio']))
        .append('<br/>')
        .append($('<span/>').text('Background Frequency: ' +
                                  row['population_ratio']))
        .append('<br/>')
        .append($('<span/>').text(
          (row['genes'].length > 20 ? 'First 20 representative proteins: ':
                                      'Representative Proteins: ')));
      for (var g = 0; g < row['genes'].length && g < 20; g += 1) {
        var gene_link = $('<a href="#"/>').text(row['genes'][g]);
        gene_link.click(GoToResult);
        li.append(gene_link);
        li.append(', ');
      }
      list.append(li);
    }
    $('#david-results').empty();
    $('#david-results').append(list);
    if (david_rows.length == 0) {
      $('#david-results').append('No function enrichment detected.<br/><br/>');
    }
  }
  $('#export-david').show();
  StopOverlay();
}

// In the DAVID results section, when a gi number is clicked, the page will
// navigate to that mimicry target result in the results tab.
function GoToResult(e) {
  e.preventDefault();
  var gi = parseInt($(this).text());
  var result_num = -1;
  var sub_result_num = -1;
  // Locates the result in the results array.
  for (var i = 0; i < results.length; i += 1) {
    if (results[i]['gi'] == gi) {
      result_num = i;
    } else if ('similar_results' in results[i]) {
      for (var j = 0; j < results[i]['similar_results'].length; j += 1) {
        if (results[i]['similar_results'][j]['gi'] == gi) {
          result_num = i;
          sub_result_num = j;
        }
      }
    }
    if (result_num >= 0) {
      break;
    }
  }
  // Changes to the result tab, changes to the correct page, scrolls to the
  // result, and changes to the correct result if it is not the primary result
  // of the grouped host proteins.
  $('#results-tab').click();
  ChangeToPage(Math.floor(result_num/RESULTS_PER_PAGE));
  $('body').animate(
    {'scrollTop' : $('#more_link_'+result_num).offset().top}, 500);
  var more_link = $('#more_link_'+result_num);
  if (more_link.text().indexOf('More') >= 0) {
    more_link.click();
  }
  if (sub_result_num >= 0) {
    $('#'+result_num+'-change-select').val(sub_result_num+1);
    $('#'+result_num+'-change-select').change();
  }
}

// Formats the title of a GO term entry. If the term is provided by EBI, an
// external link is made.
function CreateGoTitle(id, term) {
  var title = $('<span/>');
  var link = $('<a/>', {
    text : id,
    href : 'http://www.ebi.ac.uk/QuickGO/GTerm?id=' + id,
    target : '_blank'
  });
  title.append(link).append(' ');
  title.append($('<span/>').css('font-weight','bold').text(term));
  return title;
}

// Returns a list of result gis, either 1 for each cluster of similar host
// proteins (representative), or all gis. A limit may also be passed in.
function GetGis(limit, representative) {
  representative = representative === 'undefined' || representative;
  var limit = limit || results.length;
  limit = Math.min(limit, results.length);
  var gis = [];
  for (var i = 0; i < limit; i += 1) {
    var result = results[i];
    gis.push(result['gi']);
    if (!representative && 'similar_results' in result) {
      for (var j = 0; j < result['similar_results'].length; j += 1) {
        gis.push(result['similar_results'][j]['gi']);
      }
    }
  }
  return gis;
}


function SwitchAnalysisType() {
  var analysis_type = this.value;
  ChooseAnalysisHosts(analysis_type);
  if (host_organism && host_organism != '0') {
    HostChanged();
  }
}

function ChooseAnalysisHosts(analysis_type) {
  var select = $('#host');
  select.find('.actual_option').remove();
  var all_hosts = hosts[analysis_type];
  for (var i = 0; i < all_hosts.length; i += 1) {
    var option = $('<option />', {
      value: all_hosts[i][0],
      text: all_hosts[i][1],
      'class': 'actual_option'});
    option.appendTo(select)
  }
}

// Once host and saved session data is loaded, the relevant data will be filled
// in the input.
function HostsLoaded(data) {
  var all_hosts = data['hosts'];
  saved_data = data['saved'];
  all_hosts.sort();
  hosts = {'homology':[], 'motif':[]}
  for (var i = 0; i < all_hosts.length; i += 1) {
    if (all_hosts[i][0].indexOf('_short') >= 0) {
      hosts['motif'].push(all_hosts[i]);
    } else {
      hosts['homology'].push(all_hosts[i]);
    }
  }
  var select = $('#host')
  if (saved_data && saved_data['host'].indexOf('_short') >= 0) {
    $('#motif-analysis').prop("checked", true);
    ChooseAnalysisHosts('motif');
  } else {
    ChooseAnalysisHosts('homology');
  }
  select.change(HostChanged)
  host_organism = select.val()
  $('#settings').on('valid', Submit).submit(function(e) {
    e.preventDefault();
  })
  // Loads the saved session, if any.
  if (saved_data) {
    $('#max-controls').val(saved_data['max_controls']);
    $('#min-pathogens').val(saved_data['min_pathogens']);
    $('#min-ratio').val(saved_data['min_ratio']);
    $('#min-difference').val(saved_data['min_bits']);
    $('#max-evalue').val(saved_data['max_expect']);
    select.val(saved_data['host']);
    session_id = existing_session_id;
    select.change();
  }
  $('#settings input').change(SaveSession);
}

// Every time a change is made in the input, this function is invoked to save
// the session on the server side.
function SaveSession() {
  if (host_organism == 0) {
    return;
  }
  var pathogens = []; 
  for (var i = 0; i < selected_pathogens.length; i += 1) {
    pathogens.push(selected_pathogens[i][0]);
  }
  var controls = []; 
  for (var i = 0; i < selected_controls.length; i += 1) {
    controls.push(selected_controls[i][0]);
  }
  var pathogens_str = pathogens.join(',');
  var controls_str = controls.join(',');
  $.post('save/'+session_id, {host : host_organism,
                              type : organism_type,
                              pathogens : pathogens_str,
                              controls : controls_str,
                              max_controls: $('#max-controls').val(),
                              min_pathogens: $('#min-pathogens').val(),
                              min_ratio: $('#min-ratio').val(),
                              min_bits: $('#min-difference').val(),
                              max_expect: $('#max-evalue').val()})
  .fail(function() {
    Error('Could not save session to server due to an internal problem.');
  });
}

// When a different host is selected and the organism input is reset to contain
// the organisms for that host. At this point, a new session is started, or an
// old session is continued.
function HostChanged(e) {
  $('#input .initial-hide').removeClass('initial-hide');
  $(this).children("option[value='0']").remove();
  host_organism = $('#host').val()
  StartOverlayUsingMessage('Loading Organisms');
  if (saved_data) {
    $.getJSON('organisms/'+host_organism, OrganismsLoaded).fail(function() {
      Error('Could not retrieve list of organisms from server due to '+
            'an internal problem.');
    });
  } else {
    // Starts a new session if this is not a continuation of an old session.
    session_id = 's'+ (new Date().getTime()) + '' +
                 Math.round(Math.random()*10e9);
    location.hash = session_id;
    $.getJSON('organisms/'+host_organism, {session_id : session_id},
              OrganismsLoaded).fail(function() {
      Error('Could not retrieve list of organisms from server due to an '+
            'internal problem.');
    });
  }
}

// Once organisms for a particular host are loaded, the input fields that are
// used to select pathogens and controls need to be created or recreated.
function OrganismsLoaded(data) {
  // Pathogen/control input html elements.
  all_organisms = data['organisms'];
  suggestions = data['suggestions'];
  var organism_types = Object.keys(all_organisms);
  var organism_types_sec = $('#organism-types');
  organism_types_sec.empty();
  for (var i = 0; i < organism_types.length; i += 1) {
    organism_types_sec.append($('<input type="radio" name="organism-type" '+
                                'value="'+organism_types[i]+'" id="type-'+
                                organism_types[i]+'"/><label for="type-'+
                                organism_types[i]+'">'+
                                organism_types[i]+'</label><br/>'));
  }
  $("input[name='organism-type']").change(OrganismTypeChanged);
  if (saved_data) {
    organism_type = saved_data['type'];
  } else {
    if ('bacteria' in all_organisms) {
      organism_type = 'bacteria';
    } else {
      organism_type = organism_types[0];
    }
  }
  $('#type-'+organism_type).prop('checked',true);

  PrepareOrganismsInput();

  StopOverlay();
  return;
}

function OrganismTypeChanged() {
  organism_type = $("input[name='organism-type']:checked").val();
  StartOverlayUsingMessage('Switching organism type');
  setTimeout(function() {
    PrepareOrganismsInput();
    StopOverlay();
    SaveSession();
  }, 300);
}

function PrepareOrganismsInput() {
  var input_p = $('<input placeholder="search for organism" id="pathogens"/>');
  var add_p_link = $(
    '<a id="add-pathogen" class="add-organism" href="#">add</a>');
  var sel_p = $('<select id="pathogens-all"/>');
  var selected_p = $('<ul class="selected-organisms" id="selected-pathogens"/>');
  var action_text_p =
    $('<span class="action-text" id="pathogens-action-text">Added</span>');
  var undo_p_link =
    $('<a id="pathogens-undo" class="undo-action" href="#">Undo</a>');
  var clear_p_link =
    $('<a id="pathogens-clear" class="clear-all" href="#">clear</a>');
  var suggest_p_link =
    $(suggestions && organism_type in suggestions &&
      suggestions[organism_type]['pathogens'].length > 0?
      '<a id="pathogens-suggest" class="suggest" href="#">suggestions</a>':'');

  var input_c = $('<input placeholder="search for organism" id="controls"/>');
  var add_c_link = $(
    '<a id="add-control" class="add-organism" href="#">add</a>');
  var sel_c = $('<select id="controls-all"/>');
  var selected_c = $('<ul class="selected-organisms" id="selected-controls"/>');
  var action_text_c =
    $('<span class="action-text" id="controls-action-text">Added</span>');
  var undo_c_link =
    $('<a id="controls-undo" class="undo-action" href="#">Undo</a>');
  var clear_c_link =
    $('<a id="controls-clear" class="clear-all" href="#">clear</a>');
  var suggest_c_link =
    $(suggestions && organism_type in suggestions &&
      suggestions[organism_type]['controls'].length > 0?
      '<a id="controls-suggest" class="suggest" href="#">suggestions</a>':'');
  $('#pathogen-div').empty().append(input_p)
                            .append(add_p_link)
                            .append('- or -')
                            .append(sel_p)
                            .append(action_text_p)
                            .append(undo_p_link)
                            .append(clear_p_link)
                            .append(suggest_p_link)
                            .append(selected_p);
  $('#control-div').empty().append(input_c)
                           .append(add_c_link)
                           .append('- or -')
                           .append(sel_c)
                           .append(action_text_c)
                           .append(undo_c_link)
                           .append(clear_c_link)
                           .append(suggest_c_link)
                           .append(selected_c);

  organism_names = [];
  selected_pathogens = [];
  selected_controls = [];
  organism_id_map = {}; // Organism regex name to ids.
  id_organism_map = {}; // Organism id to name.
  just_added = []; // Keeps track of recently added organisms (for undo)

  // Goes through all organism names, creating an index of the names and regex
  // patterns. The regex patterns are all regexes of the name that include full
  // words. Also popualted the select field for pathogen/control selection.
  var acronyms = {};
  for (var i = 0; i < all_organisms[organism_type].length; i += 1) {
    var name = all_organisms[organism_type][i][1].trim();
    var name_parts = name.split(' ');
    var cumulative_name = '';
    var regex_names = [];
    id_organism_map[all_organisms[organism_type][i][0]] = name;
    for (var p = 0; p < name_parts.length; p += 1) {
      if (name_parts[p].length == 0) {
        continue;
      }
      if (p > 0) {
        cumulative_name += ' ';
      }
      cumulative_name += name_parts[p];
      var final_name = cumulative_name;
      if (p != name_parts.length - 1) {
        final_name += ' *';
        regex_names.push(final_name);
        // Checks if the regex has already been added.
        if (acronyms[cumulative_name]) {
          continue;
        }
        acronyms[cumulative_name] = true;
      } else {
        regex_names.push(final_name);
      }
      organism_names.push(final_name);
      sel_p.append($('<option/>', {value: final_name, text:final_name}));
      sel_c.append($('<option/>', {value: final_name, text:final_name}));
      // Maps regex expressions to organism (name, id) tuple.
      if (p == name_parts.length - 1) {
        for (var r = 0; r < regex_names.length; r += 1){
          var regex_name = regex_names[r];
          if (!organism_id_map[regex_name]) {
            organism_id_map[regex_name] = [];
          }
          organism_id_map[regex_name].push(
            [all_organisms[organism_type][i][0], name]);
        }
      }
    }
  }

  // Attaching of actions to input fields.
  $('#pathogens, #controls').autocomplete({
    source: organism_names,
    minLength : 4,
    select: function( event, ui ) {
      event.preventDefault();
      label = ui.item.label
      AddOrganisms(label, $(this).attr('id'));
      $(this).val('');
    }
  });
  add_p_link.add(add_c_link).click(function(event){
    event.preventDefault();
    var flavour = $(this).attr('id') == 'add-pathogen' ? 'pathogens' : 'controls';
    var input = $('#'+flavour);
    if (organism_id_map[input.val()]) {
      AddOrganisms(input.val(), flavour);
      input.val('');
    }
  });
  sel_p.add(sel_c).change(function(event){
    event.preventDefault();
    var flavour = $(this).attr('id') == 'pathogens-all' ? 'pathogens' : 'controls';
    AddOrganisms($(this).val(), flavour);
    $(this).children().first().attr('selected', 'selected');
  });
  undo_c_link.add(undo_p_link).click(function(event){
    event.preventDefault();
    var flavour = $(this).attr('id') == 'pathogens-undo' ? 'pathogens' : 'controls';
    if (!just_added) {
      ClearActions();
      return;
    }
    for (var ji = 0; ji < just_added.length; ji += 1){
      RemoveOrganism(just_added[ji], flavour);
    }
    ClearActions();
    SaveSession();
  });
  clear_c_link.add(clear_p_link).click(function(event){
    event.preventDefault();
    if ($(this).attr('id') == 'pathogens-clear') {
      selected_pathogens = []
      $('#selected-pathogens').empty()
    } else {
      selected_controls = []
      $('#selected-controls').empty()
    }
    ClearActions();
    SaveSession();
  });
  suggest_p_link.add(suggest_c_link).click(function(event){
    event.preventDefault();
    var p_or_c = null;
    if ($(this).attr('id') == 'pathogens-suggest') {
      p_or_c = 'pathogens';
      selected_pathogens = []
      $('#selected-pathogens').empty()
    } else {
      selected_controls = []
      $('#selected-controls').empty()
      p_or_c = 'controls';
    }
    var organisms = suggestions[organism_type][p_or_c];
    for (var i = 0; i < organisms.length; i += 1) {
      AddOrganismFromId(organisms[i], p_or_c);
    }
    SaveSession();
    if ($.cookie('suggestions') === undefined) {
      $('#suggestions-modal').foundation('reveal', 'open');
      $.cookie('suggestions', 'true');
    }
  });

  // Input options should be sorted by name.
  SortSelectOptions(sel_p);
  SortSelectOptions(sel_c);
  sel_p.prepend($('<option disabled="disabled">Select from all organisms</option>'));
  sel_c.prepend($('<option disabled="disabled">Select from all organisms</option>'));
  SetFirstSelected(sel_p);
  SetFirstSelected(sel_c);

  // Selects previously selected pathogens and controls.
  if (saved_data) {
    var pathogens = saved_data['pathogens'].toString().split(',')
    var controls = saved_data['controls'].toString().split(',')
    for (var i = 0; i < pathogens.length; i += 1) {
      AddOrganismFromId(pathogens[i], 'pathogens');
    }
    for (var i = 0; i < controls.length; i += 1) {
      AddOrganismFromId(controls[i], 'controls');
    }
    saved_data = null;
    just_added = [];
    $('#saved-modal').foundation('reveal', 'open');
  }
}

// Helper to add an organism to the selected pathogens or controls using its id.
function AddOrganismFromId(id, flavour) {
  var organism_name = id_organism_map[id];
  if (organism_name) {
    AddOrganism(id, organism_name, flavour);
  }
}

// Adds all organisms matching a prticular regex to the selected pathogens or
// controls.
function AddOrganisms(label, flavour) {
  ClearActions();
  var organisms = organism_id_map[label];
  just_added = [];
  for (var i = 0; i < organisms.length; i += 1) {
    AddOrganism(organisms[i][0], organisms[i][1], flavour);
  }
  if (just_added.length > 0) {
    $('#'+flavour+'-action-text').css('display', 'inline-block')
                                 .text('Added ' + just_added.length +
                                              ' Proteomes.');
    $('#'+flavour+'-undo').css('display', 'inline-block');
  }
  SaveSession();
}

// Adds a single organism to the selected pathogens and controls given its id
// and name. It needs to be inserted at the correct index in the sorted list.
function AddOrganism(organism_id, name, flavour) {
  var organism_index = null;
  var organism_list = null;
  if (flavour == 'pathogens') {
    organism_index = selected_pathogens;
    organism_list = $('#selected-pathogens');
  } else {
    organism_index = selected_controls;
    organism_list = $('#selected-controls');
  }
  var index_to_insert = 0;
  for (; index_to_insert < organism_index.length; index_to_insert += 1) {
    current_name = organism_index[index_to_insert][1];
    if (current_name == name) {
      // Already insertred.
      return;
    }
    if (current_name > name) {
      break;
    }
  }
  // Inserts list element.
  var remove_button = $('<a href="#r'+ flavour.substr(0,1) +
                        organism_id + '">x</a>').click(function(){
    event.preventDefault();
    var href = $(this).attr('href');
    var organism_id = href.substr(3);
    var flavour = href.substr(2,1) == 'p' ? 'pathogens' : 'controls';
    ClearActions();
    RemoveOrganism(organism_id, flavour);
    SaveSession();
  });
  var content = $('<p/>').text(name);
  var list_element = $('<li/>').append(remove_button).append(content);
  if (organism_index.length == 0 || index_to_insert == organism_index.length) {
    organism_list.append(list_element);        
  } else {
    $('#' + organism_list.attr('id') + ' li:nth-child(' +
      (index_to_insert + 1) + ')').before(list_element);
  }
  // Updates [pathogen|control] index.
  organism_index.splice(index_to_insert, 0, [organism_id, name]);
  just_added.push(organism_id);
}

// Clears any message that indicated recent activity in the pathogen/control
// selection.
function ClearActions() {
  $('#pathogens-action-text').css('display', 'none');
  $('#controls-action-text').css('display', 'none');
  $('#pathogens-undo').css('display', 'none');
  $('#controls-undo').css('display', 'none');
  just_added = [];
}

// Removes an organism from the selected pathogens or controls given its id.
function RemoveOrganism(organism_id, flavour) {
  var organism_index = null;
  var organism_list_id = null;
  if (flavour == 'pathogens') {
    organism_index = selected_pathogens;
    organism_list_id = '#selected-pathogens';
  } else {
    organism_index = selected_controls;
    organism_list_id = '#selected-controls';
  }
  var index_to_remove = 0;
  for (; index_to_remove < organism_index.length; index_to_remove += 1) {
    if (organism_index[index_to_remove][0] == organism_id) {
      break;
    }
  }
  if (index_to_remove < organism_index.length) {
    organism_index.splice(index_to_remove, 1);
    $(organism_list_id + ' li:nth-child(' + (index_to_remove + 1) + ')').remove();
  }
}

// Sorts all options in the pathogens/control select element.
function SortSelectOptions(select) {
  var options = select.find('option');
  options.sort(function(a,b) {
      if (a.text > b.text) return 1;
      else if (a.text < b.text) return -1;
      else return 0
  })
  select.empty().append(options);
}

// Sets the first option of the select as the selected option.
function SetFirstSelected(select) {
  select.find('option').first().attr('selected', 'seleted');
}

// Submits the input specification to the server to retrieve predicted targets.
function Submit(event) {
  event.preventDefault()
  var host = $("#host option:selected").val()
  if (host == '0') {
    return;
  }
  var pathogens = $(selected_pathogens).map(function(){return this[0]});
  var controls = $(selected_controls).map(function(){return this[0]});
  StartOverlayUsingMessage('Searching, can take up to a minute');
  $.post('find',
         {'host': host,
          'pathogens[]': jQuery.makeArray(pathogens),
          'controls[]': jQuery.makeArray(controls),
          'max-controls': $('#max-controls').val(),
          'min-pathogens': $('#min-pathogens').val(),
          'max-evalue': $('#max-evalue').val(),
          'min-ratio': $('#min-ratio').val(),
          'min-difference': $('#min-difference').val()
         },
         QueryDone,
         'json').fail(function() {
    Error('Could not retrieve predicted mimics from server due to an '+
          'internal problem');
  });
}

// Given the results and a limit on the number of results per page, this
// function prepares the page selection element on top of the results.
function PreparePagination() {
  var num_pages = Math.ceil(results.length / RESULTS_PER_PAGE)
  if (num_pages == 0) {
    return;
  }
  var pages_menu = $('.pagination-centered .pagination')
  pages_menu.empty()
  // Left button.
  var li_left = $('<li/>')
  var a_left = $('<a href="#">&laquo;</a>')
  a_left.click(function(event){
    event.preventDefault()
    var new_page = Math.max(page - 1, 0);
    ChangeToPage(new_page);
  })
  li_left.append(a_left)
  pages_menu.append(li_left)
  var pages_select = $('<select id="page-select"/>');
  // Middle select element.
  for (var i = 0; i < num_pages; i += 1) {
    $('<option />', {value: i, text: 'Page ' + (i + 1)}).appendTo(pages_select);
  }
  pages_select.change(function() {
    var new_page = parseInt($(this).val());
    ChangeToPage(new_page);
  });
  pages_menu.append(' Go to: ').append(pages_select);
  // Right button.
  var li_right = $('<li/>')
  var a_right = $('<a href="#">&raquo;</a>')
  a_right.click(function(event){
    event.preventDefault()
    var new_page = Math.min(page + 1, Math.ceil(results.length /
                                                RESULTS_PER_PAGE) - 1);
    ChangeToPage(new_page);
  })
  li_right.append(a_right)
  pages_menu.append(li_right)
}

// Changes the page to a new page of results.
function ChangeToPage(new_page) {
  if (new_page != page) {
    page = new_page;
    $('#page-select').val(page);
    PreparePaginationMessage();
    LoadPartialResults();
  }
}

// Prepares a message indicating the current page number or 'no results' if
// there are no results.
function PreparePaginationMessage() {
  if (results.length == 0) {
    $('#listing-count').text('No results.')
    return
  }
  var start = page * RESULTS_PER_PAGE
  var remaining = Math.min(results.length - start, RESULTS_PER_PAGE)
  $('#listing-count').text('Page ' + (page + 1)+ ': Results ' + (start + 1) +
                           ' to ' + (start + remaining) + ', from a total of  '
                           + results.length);
}

// Toggles the details of a particular result.
function MoreInfoClick(e) {
  e.preventDefault();
  var link =$(this);
  var details_div_id = link.attr('href');
  var details_div = $(details_div_id);
  if (details_div.children().length == 0) {
    result = results[parseInt(details_div_id.match(/\d+/)[0])];
    FillDetails(result, details_div);
  }
  $(link.attr('href')).stop().slideToggle('slow')
  link.text(link.text() == ' More'? ' Less' : ' More')
}

// Each result has a header with basic information and a detailed section that
// can be toggled. The header contains the protein gi and name, along with how
// many pathogen and control hits there are.
function FillHeader(i, inner_div) {
  var result = results[i];
  var title = $('<strong/>');
  var gi_link = $('<a/>', {
      text: "gi: " + result['gi'],
      href: 'http://www.ncbi.nlm.nih.gov/protein/' + result['gi'],
      target: '_blank'
  });
  title.append(gi_link);
  if (result['description']) {
    title.append($('<span/>').text(' ' + result['description'] + ' '));
  }
  var more_link = $('<a/>', {
      text: ' More',
      id: 'more_link_'+i,
      href: '#detailed_result_' + i,
      click: MoreInfoClick
  });
  title.append(more_link);
  var count_stats = $('<em/>');
  count_stats.text(result['total_pathogens'] + ' pathogen hits, ' +
                   result['total_controls'] + ' control hits. ');
  var bit_stats = $('<em/>');
  if (result['total_controls'] > 0) {
    bit_stats.text('Bit difference: ' +
                     (parseInt(result['max_bits_in_pathogens']) -
                      parseInt(result['max_bits_in_controls'])));
  }
  // The detailed div will be filled upon a toggle event.
  var details = $('<div class="detailed_result" id="detailed_result_' + i + 
                  '"/>');
  details.hide();
  // Informs the user of the number of similar proteins clustered in this
  // result.
  inner_div.append(title)
           .append('<br/>')
           .append(count_stats)
           .append('<br/>')
           .append(bit_stats)
           .append('<br/>');
  var has_structure = result['structures'] != null;
  if (result['similar_results'].length > 0) {
    var similar_targets = $('<span data-tooltip class="has-tip" title="' +
                            'Host proteins that share at least one mimic"/>');
    similar_targets.text(
      result['similar_results'].length + ' similar targets.');
    inner_div.append($('<em/>').append(similar_targets));
    for (var i = 0; i < result['similar_results'].length && !has_structure;
         i += 1) {
      has_structure = result['similar_results'][i]['structures'] != null;
    }
  }
  if (has_structure) {
    var hint = $('<span data-tooltip class="has-tip structure-hint" ' +
                 'title="structure data available"/>');
    inner_div.append(hint);
  }
  inner_div.append(details);
}

// Loads as many result headers as allowed into the current page.
function LoadPartialResults() {
  var start = page * RESULTS_PER_PAGE;
  var remaining = Math.min(results.length - start, RESULTS_PER_PAGE);
  var div = $('<div/>').addClass('listing');
  for (var i = start; i < start + remaining; i += 1) {
    var inner_div = $('<div class="result"/>');
    FillHeader(i, inner_div);
    div.append(inner_div);
  }
  $('#mimicsContainer .listing').replaceWith(div)
}

// Host genes can have multiple associated PDB structures. This function is
// triggered when an alternative PDB id is selected, which means the action
// buttons for viewing and aligning the structure must be modified.
function ChangePDB() {
  var select = $(this);
  var pdbid = select.val();
  if (pdbid == 0) {
    return;
  }
  var result_number = parseInt(select.attr('id'));
  var result = results[result_number];
  $('#detailed_result_'+result_number).children('.struct-button').remove();
  AppendPDBButtons(select, pdbid, result);
}

// If a host protein has an associated PDB structure, the user may choose to
// view conservation patterns on the structure, download a conservation colored
// PDB file, or align the PDB sequence to the associated host protein. This
// function adds the buttons to do so to the detailed result section.
function AppendPDBButtons(struct_select, pdbid, result) {
  var to_align = GetHitsToAlign(result);
  var host_gene = to_align[0]
  var pathogen_genes = to_align[1].join();

  var structure_link = $('<button/>', {
      text: 'View conservation in PDB ' + pdbid,
      id: '#' + pdbid + '-' + host_gene + '-' + pathogen_genes,
      class: 'struct-button button tiny',
      click: StructureLinkClicked
  });
  struct_select.after(structure_link);
  var structure_download_link = $('<button/>', {
      text: 'Download Conservation-Coloured PDB ' + pdbid,
      id: '#download-' + pdbid + '-' + host_gene + '-' + pathogen_genes,
      class: 'struct-button button tiny',
      click: StructureLinkClicked
  });
  structure_link.after(structure_download_link);
  var structure_alignment_link = $('<button/>', {
      text: 'View alignment with ' + pdbid,
      id: '#align-' + pdbid + '-' + result['gi'],
      class: 'struct-button button tiny',
      click: ViewStructureAlignmentClicked
  });
  structure_download_link.after(structure_alignment_link);
  structure_alignment_link.after('<br class="struct-button"/>');
}

// When a detailed result section is toggled, the detailed section is filled
// with:
// - A select field to select a different host protein in the cluster
// - Buttons to view structures and MSAs
// - pathogen and control alignments
function FillDetails(result, details) {
  var result_number = parseInt(details.attr('id').match(/\d+/)[0]);
  var to_align = GetHitsToAlign(result);
  var host_gene = to_align[0]
  var pathogen_genes = to_align[1].join();

  // Pathogen alignment list.
  var p_list = $('<ul/>');
  var pathogen_hits = result['pathogen_hits'];
  for (var j = 0; j < pathogen_hits.length; j += 1) {
    p_list.append(HitDetails(pathogen_hits[j]));
  }
  
  // Control alignment list.
  var c_list = $('<ul/>');
  var control_hits = result['control_hits'];
  for (var j = 0; j < control_hits.length; j += 1) {
    c_list.append(HitDetails(control_hits[j]));
  }

  // PDB buttons are added if a structure exists for the host gene.
  if (result['structures']) {
    var pdbid_string = result['structures'];
    var pdbids = pdbid_string.split(',');
    var pdbid = pdbids[0];
    var struct_select = $('<select/>', {'class' : 'struct-select',
                                        'id' : result_number + '-pdb-change'});
    struct_select.change(ChangePDB);
    struct_select.append('<option value="0">Choose PDB id</option>');
    for (var i = 0; i < pdbids.length; i += 1) {
      struct_select.append($('<option/>', {'text' : pdbids[i],
                                           'value' : pdbids[i]}));
    }
    details.append(struct_select).append('<span>&nbsp;</span>');
    AppendPDBButtons(struct_select, pdbid, result);
  }

  // MSA buttons are added to align the pathogen hits to the host protein.
  var msa_view_link = $('<button/>', {
      text: 'View MSA',
      id: '#' + host_gene + '-' + pathogen_genes,
      class: 'button tiny',
      click: MSALinkClicked
  });
  details.append(msa_view_link);
  var msa_download_link = $('<button/>', {
      text: 'Download MSA',
      id: '#download-' + host_gene + '-' + pathogen_genes,
      class: 'button tiny',
      click: MSALinkClicked
  });
  details.append(msa_download_link);

  // Dropdown list to pick from similar proteins in the cluster.
  if (result['similar_results'].length > 0) {
    var select = $('<select id="'+result_number+'-change-select"/>');
    select.change(ChangeGrouping);
    select.append($('<option/>', 
                   {'value': 0, 'text': 'View similar gene result.'}));
    for (var i = 0; i < result['similar_results'].length; i += 1) {
      var target = result['similar_results'][i];
      var star = target['structures'] != null ? '*' : '';
      select.append($('<option/>', {
        'value' : i + 1,
        'text': star + target['gi']+
                (target['description']? ', ' + target['description'] : '')
      }));
    }
    details.append('<br/>').append(select);
    details.append(
      ' <em>Results with structure data are indicated with a (*)</em>');
  }

  // All alignments are added to the detailed section.
  details.append('<br/><span class="hits_title">Pathogen hits:</span>')
         .append(p_list);
  if (control_hits.length >= 0) {
    details.append('<span class="hits_title">Control hits:</sspan>')
        .append(c_list);
  }
}

// When a user selects a similar host protein in the cluster, the header is
// modified to contain information for the new protein, and the detailed content
// is recreated. Also, the newly selected protein becomes the main protein for
// that cluster, and the previous protein is inserted into the list of similar
// proteins.
function ChangeGrouping() {
  var selected_number = parseInt($(this).val());
  if (selected_number == 0) {
    return;
  }
  var result_number = parseInt($(this).attr('id'));
  var result_div = $('#detailed_result_'+result_number).parent();

  // Do the swapping.
  selected_number -= 1;
  var old_result = results[result_number];
  var new_result = old_result['similar_results'][selected_number];
  results[result_number] = new_result;
  new_result['similar_results'] = old_result['similar_results'];
  new_result['similar_results'].splice(selected_number,1);
  old_result['similar_results'] = null;
  new_result['similar_results'].unshift(old_result);

  result_div.empty();
  FillHeader(result_number, result_div);
  $('#more_link_'+result_number).click();
}

// Once the sever-side returns with the predictions, the results will be
// displayed.
function QueryDone(data) {
  if ('error' in data) {
    Error(data['error']);
    return;
  }
  results = data.results; // May contain a subset of all results (eg. filter)
  all_results = results; // Copy of all results.
  representative_gis = [];
  for (var i = 0; i < results.length; i += 1) {
    representative_gis.push(results[i]['gi']);
  }
  PrepareFilter();
  ShowNewResults();
}

// Calls to prepare the pagination and fill the page with results.
function ShowNewResults() {
  page = 0;
  PreparePagination();
  PreparePaginationMessage();
  LoadPartialResults();
  $('#content-tabs').removeClass('initial-hide');
  $('#results-tab').click();
  $('#david-results').empty();
  $('#export-david').hide();
  $('#first-tab-header').click();
  StopOverlay();
}

// Add keywords from a particular field in a result to the dectionary index
// that will be used for filtering. Currently results are filtered by keyword
// or pairs of consecutive keywords.
function AddKeywords(full_name, entry_index) {
  var keywords = full_name ? full_name.split(' ') : [];
  var last_word = null;
  for (i = 0; i < keywords.length; i += 1) {
    if (keywords[i].length >= 4) {
      var keyword = keywords[i].toLowerCase();
      if (keyword in dictionary) {
        dictionary[keyword].push(entry_index);
      } else {
        dictionary[keyword] = [entry_index];
      }
      if (i > 0) {
        var pair = last_word + ' ' + keyword;
        if (pair in dictionary) {
          dictionary[pair].push(entry_index);
        } else {
          dictionary[pair] = [entry_index];
        }
      }
      last_word = keyword;
    }
  }
}

// Indexes the organism name and protein description for all results, so that
// results can be filtered by keywords.
function PrepareFilter() {
  dictionary = {};
  for (var i = 0; i < results.length; i += 1) {
    for (var j = -1; j < results[i]['similar_results'].length; j += 1) {
      var result = j < 0? results[i] : results[i]['similar_results'][j];
      AddKeywords(result['description'], [i,j]);
      for (var k = 0; k < result['pathogen_hits'].length; k += 1) {
        AddKeywords(
          result['pathogen_hits'][k]['description'], [i,j]);
        AddKeywords(
          result['pathogen_hits'][k]['organism_name'], [i,j]);
      }
      for (var k = 0; k < result['control_hits'].length; k += 1) {
        AddKeywords(
          result['control_hits'][k]['description'], [i,j]);
        AddKeywords(
          result['control_hits'][k]['organism_name'], [i,j]);
      }
    }
  }
  $('#filter-field').autocomplete({
    source: Object.keys(dictionary),
    minLength : 4,
    select: function( event, ui ) {
      event.preventDefault();
      var label = ui.item.label
      FilterResults(label);
      $(this).val('');
    }
  });
  $('#filter-button').click(function(event){
    event.preventDefault();
    var input = $('#filter-field');
    var label = input.val().toLowerCase();
    FilterResults(label);
    input.val('');
  });
}

// When results are filtered by a keyword or phrase, a new results array is
// created which contain a subset (copy) of all results that match the keywords.
// When this is done, the results tab is refreshed with the filtered results.
function FilterResults(label) {
  if (label == '') {
    results = all_results;
    ShowNewResults();
    return;
  }
  results = [];
  var indices = dictionary[label];
  var last_i = -1;
  var last_result = null;
  for (var i = 0; i < indices.length; i += 1) {
    var loc_i = indices[i][0];
    var loc_j = indices[i][1];
    var result_copy = null;
    if (loc_j < 0) {
      var result = all_results[loc_i];
      var temp_similar_results = result['similar_results'];
      result['similar_results'] = [];
      result_copy = JSON.parse(JSON.stringify(result));
      result['similar_results'] = temp_similar_results;
    } else {
      var result = all_results[loc_i]['similar_results'][loc_j];
      result_copy = JSON.parse(JSON.stringify(result));
    }
    if (last_i != loc_i) {
      last_i = loc_i;
      last_result = result_copy;
      result_copy['similar_results'] = [];
      results.push(result_copy);
    } else {
      last_result['similar_results'].push(result_copy);
    }
  }
  ShowNewResults();
}

function ShortOrganismName(organism_name) {
  var parts = organism_name.split(' ');
  return parts[0].toUpperCase()[0] + '.' + parts[1].toLowerCase();
}

function ShortHostName() {
  var parts = host_organism.split('_');
  return parts[0].toUpperCase()[0] + '.' + parts[1].toLowerCase();
}

// Compiles a list of pathogen proteins and start and end of the portions of
// their sequence to align.
function GetHitsToAlign(result) {
  var pathogen_hits = result['pathogen_hits'];
  var hit_strs = [];
  var host_lowest = Infinity;
  var host_highest = -Infinity;
  for (var j = 0; j < pathogen_hits.length; j += 1) {
    var bounds = GetAlignmentBounds(pathogen_hits[j]);
    var host_lowest = Math.min(host_lowest, bounds[0]);
    var host_highest = Math.max(host_highest, bounds[1]);
    hit_strs.push(pathogen_hits[j]['gi'] + '|' + bounds[2] + '|' + bounds[3] +
                  '|' + ShortOrganismName(pathogen_hits[j]['organism_name']))
  }
  var host_gene_str = result['gi'] + '|' + host_lowest + '|' + host_highest + 
                      '|' + ShortHostName();
  return [host_gene_str, hit_strs]
}

// Given the starting locations of an alignment and the actual alignment in
// string format, we need to compute the end index of the alignment by
// considering gaps.
function GetAlignmentBounds(hit) {
  var query_alignment = hit['alignment_query'];
  var match_alignment = hit['alignment_match'];
  var target_alignment = hit['alignment_target'];
  var query_start = hit['alignment_query_start'];
  var target_start = hit['alignment_target_start'];
  var query_end = parseInt(query_start) + query_alignment.length -
                  (query_alignment.match(/-/g)||[]).length - 1;
  var target_end = parseInt(target_start) + target_alignment.length -
                   (target_alignment.match(/-/g)||[]).length - 1;
  return [query_start, query_end, target_start, target_end];
}

// Displays an alignment of a host protein with a microbe hit, along with
// details about the alignment.
function HitDetails(hit) {
  var option = $('<li/>');
  var simple_species = $('<span class="hit_species"></span>')
                        .text(TrimmedSpeciesName(hit['organism_name']));
  var hit_name = $('<span class="hit_name"></span>').text(hit['description']);
  var full_species = $('<span/>').text(hit['organism_name']);
  var locus_tag = $('<span/>').text(hit['locus_tag']);
  var bits = $('<span/>').text(hit['bits']);
  var e_value = $('<span/>').text(hit['evalue']);
  var result_gi_link = $('<a/>', {
    text: "gi: " + hit['gi'],
    href: 'http://www.ncbi.nlm.nih.gov/protein/' + hit['gi'],
    target: '_blank'
  });
  var detailed_paragraph = $('<p class="hit_details" />')
      .append('<span class="hit_detail">Full species name:</span> ')
      .append(full_species).append('<br/>')
      .append('<span class="hit_detail">Alignment bits:<span> ')
      .append(bits).append('<br/>')
      .append('<span class="hit_detail">Alignment e-value:</span> ')
      .append(e_value).append('<br/>')
      .append('<span class="hit_detail">Gene Details</span>: ')
      .append(result_gi_link).append('<br/>')
      .append('<span class="hit_detail">Locus tag</span>: ')
      .append(locus_tag).append('<br/>');
  var localization = hit['location'];
  if (localization.indexOf('Unknown') == -1 &&
      localization.indexOf('unknown') == -1) {
    detailed_paragraph.append('<span class="hit_detail">PSORTdb Localization</span>: ')
                      .append($('<span/>').text(localization)).append('<br/>');
    detailed_paragraph.append(
      '<span class="hit_detail">PSORTdb Localization Score</span>: ')
      .append($('<span/>').text(hit['location_score'])).append('<br/>');
  }
  var query_alignment = hit['alignment_query'];
  var match_alignment = hit['alignment_match'];
  var target_alignment = hit['alignment_target'];
  var bounds = GetAlignmentBounds(hit);
  var query_start = bounds[0], query_end = bounds[1],
      target_start = bounds[2], target_end = bounds[3];
  var alignment_start = $('<span class="alignment alignment-start" />')
      .append(query_start)
      .append('<br/>')
      .append('<br/>')
      .append(target_start)
      .append('<br/>');
  detailed_paragraph.append(alignment_start);
  // Alignments are broken up into chunks of 15 columns. This is a good
  // in-between considering alignments are column-based and creating too many
  // column elements may be expensive.
  CHUNK = 15
  for (var i = 0; i < query_alignment.length; i += CHUNK) {
    var alignment_part = $('<span class="alignment" />')
        .append($('<span/>').text(query_alignment.substring(i, i + CHUNK)))
        .append('<br/>')
        .append($('<span/>').text(match_alignment.substring(i, i + CHUNK)))
        .append('<br/>')
        .append($('<span/>').text(target_alignment.substring(i, i + CHUNK)))
        .append('<br/>');
    detailed_paragraph.append(alignment_part);
  }
  var alignment_end = $('<span class="alignment alignment-end" />')
      .append(query_end)
      .append('<br/>')
      .append('<br/>')
      .append(target_end)
      .append('<br/>');
  detailed_paragraph.append(alignment_end);
  option.append(simple_species).append(' ').append(hit_name)
        .append(detailed_paragraph).append('<br class="clear" />');
  return option;
}

// Gets the genus and species name of an organism, for a short representative
// name.
function TrimmedSpeciesName(species) {
  var parts = species.split(' ')
  return parts[0] + ' ' + parts[1]
}

// Start and stop overlay messages. These are called when waiting for the server
// or when during a long javascript operation.
function StartOverlayUsingMessage(message) {
  $('#overlay').text(message + '...').show();
  DotAnimationForOverlayInterval = setInterval(DotAnimationForOverlay,600);
}
function StopOverlay() {
  $('#overlay').fadeOut();
  try {
    clearInterval(DotAnimationForOverlayInterval);
  } catch (err) {}
}

// Called when the server returns with an error.
function Error(error_details) {
  StopOverlay();
  $('#error-details').text(error_details);
  $('#error-modal').foundation('reveal', 'open');
}

// When the overlay is present, a simple ... animation is added to the message.
function DotAnimationForOverlay() {
  var overlay = $('#overlay');
  var text = overlay.text();
  if (text.indexOf('...', text.length - 3) > 0) {
    overlay.text(text.substring(0, text.length - 3));
  } else {
    overlay.text(text + '.');
  }
}

// Called when a view or download structure button is clicked. Will trigger the
// call to colour the protein by conservation in the backend.
function StructureLinkClicked(e) {
  try {
    StartOverlayUsingMessage('Generating Structure with Conservation Colouring');
    var id = $(this).attr('id').substr(1);
    var parts = id.split('-');
    if (parts['0'] == 'download') {
      ShowStructure(parts[1], parts[2], parts[3], true);
    } else {
      ShowStructure(parts[0], parts[1], parts[2], false);
    }
  }
  catch (err) {
    StopOverlay();
    $('#structure-modal').foundation('reveal', 'close');
    $('#message-modal p').text('Only newer versions of Firefox, Chrome, ' + 
      'Safari, and Opera support structure viewing using GLMol. If you do not '+
      'have one of these browsers, you can download the structure in PDB ' +
      'format and view conservation patterns using a standalone molecular '+
      'visualization server such as chimera.');
    $('#message-modal').foundation('reveal', 'open');
  }
}

// Called when a button to view a structure-sequence alignment is clicked. 
function ViewStructureAlignmentClicked(e) {
  StartOverlayUsingMessage('Aligning with structure');
  var id = $(this).attr('id').substr(1);
  var parts = id.split('-');
  var pdbid = parts[1];
  var main = parts[2];
  $.get('pdb-alignment/'+pdbid, {main_gene: main}, DisplayMSA).fail(function() {
    Error('Could not retrieve MSA from server due to an internal problem.');
  });
}

// Displays a multiple sequence alignment once retrieved from the server.
function DisplayMSA(data) {
  if (!(data['columns'])) {
    var blob = new Blob([data], {type: "text/plain;charset=utf-8"})
    StopOverlay();
    saveAs(blob, 'msa.fa');
    return;
  }
  var container = $('#msa');
  container.empty();
  var scores = data['scores'];
  var name_span = $('<span/>');
  name_span.addClass('msa-names');
  name_span.text(data['labels'].join('\n'));
  container.append(name_span);
  // Multiple sequence alignments are displayed column-wise.
  for (var i = 0; i < data['columns'].length; i += 1) {
    var column = data['columns'][i];
    var number_span = $('<span/>');
    number_span.addClass('msa-column-number');
    if (i % 10 == 0) {
      var text = ''+(i+1);
      text = text.replace(/(.)/g,'$1\n');
      number_span.text(text);
    }
    var span = $('<span/>');
    for (var j = 0; j < column.length; j += 1) {
      var res = $('<span/>');
      res.text(column.charAt(j));
      var color = '';
      if (scores[i][j] == 2) {
        res.css('background-color', '#15C015');
      } else if (scores[i][j] == 1) {
        res.css('background-color', '#C0C000');
      }
      span.append(res);
      span.append('<br/>');
    }
    span.append(number_span);
    span.addClass('msa-column');
    container.append(span);
  }
  container.append('<br style="clear:both"/>');
  StopOverlay();
  $('#msa-modal').foundation('reveal', 'open');
}

// Called when a button to view an alignment is clicked. Retrieves the MSA from
// the server and then displays it.
function MSALinkClicked(e) {
  StartOverlayUsingMessage('Retrieving MSA');
  var id = $(this).attr('id').substr(1);
  var parts = id.split('-');
  var main = null;
  var hits = null;
  var client_view = 1;
  if (parts[0] == 'download') {
    main = parts[1];
    hits = parts[2];
    client_view = 0;
  } else {
    main = parts[0];
    hits = parts[1];
  }
  $.get('msa',
        {main_gene: main, hits: hits, client_view: client_view},
        DisplayMSA).fail(function() {
    Error('Could not retrieve MSA from server due to an internal problem.');
  });
}

// This function calls to retrieve a colored structure from the server and then
// displays it using openGL.
function ShowStructure(pdbid, main_gi, hit_gis, download) {
  if (!download) {
    $('#structure-modal').foundation('reveal', 'open');
  }
  $('#structure-title').text(pdbid + ' Structure & Conservation')
  $('#structure').empty()
  curr_structure = new GLmol('structure', true);
  // Defines how to draw the protein.
  curr_structure.defineRepresentation = function() {
     var all = this.getAllAtoms();
     this.colorByBFactor(all, true);
     var asu = new THREE.Object3D();
     //this.drawCartoon(asu, all, this.curveWidth, this.thickness);
     this.generateMesh(asu, all, 3, false);
     this.modelGroup.add(asu);
     // Strange hack needed to force drawing of molecule.
     $(window).trigger('resize');
     StopOverlay();
  };
  // Retrieves PDB file from the server.
  $.get('pdb/'+pdbid, {main_gene: main_gi, hits: hit_gis}, function(ret) {
    if (ret.length == 0) {
      $('#message-modal p').text('No alignment between MSA and structure.');
      $('#message-modal').foundation('reveal', 'open');
      StopOverlay();
      return;
    }
    if (download) {
      var blob = new Blob([ret], {type: "text/plain;charset=utf-8"});
      saveAs(blob, pdbid+'-conservation.pdb');
      StopOverlay();
    } else {
      $('#structure_src').val(ret);
      curr_structure.loadMolecule();
    }
  }).fail(function() {
    Error('Could not retrieve PDB structure from server due to an internal '+
          'problem');
  });
}

// Override bfactor coloring from GLmol.
GLmol.prototype.colorByBFactor = function(atomlist, colorSidechains) {
   for (var i in atomlist) {
      var atom = this.atoms[atomlist[i]]; if (atom == undefined) continue;
      if (atom.hetflag) continue;
      if (colorSidechains || atom.atom == 'CA' || atom.atom == 'O3\'') {
         if (atom.b == 3) {
           atom.color = 0xBBBBBB;
         } else if (atom.b == 4) {
           atom.color = 0xC0C000;
         } else if (atom.b == 5) {
           atom.color = 0x15C015;
         } else {
           atom.color = 0x666666;
         }
      }
   }
};
