How to build and run MimicMe
============================

MimicMe requires a backend database storing precomputed alignments and other
data. Under back\_end/mimicme there are python scripts that are responsible for
precomputing these alignments and building the MongoDB database. The other
folders in back\_end should contain other data files needed to build the
backend tables, such as NCBI files or suggestion files.

The files and directories located in front\_end form the server side and client
side code of the MimicMe website.

Part 1: Back End
---------------

The backend scripts are responsible for BLASTing all host and microbe proteomes
and storing the results in JSON files, which can then be imported into a MongoDB
database. The script that produces the JSON data files is create\_backend.py.

### create\_backend.py

Prereqs:
+ Python &gt;= 2.7
+ gflags (python package)
+ mpi4py (python package)
+ Biopython (python package)
+ blast+ suite (blastp command)
+ a machine or cluster that supports MPI scripts

To run, use the systems MPI interface to launch the job. The two other scripts
organisms.py and mimicme\_blast.py should be found in the python path, most
likely in the current directory where create\_backend.py is executing.

    python create_backend.py --fasta_dir=/path/to/fasta/dir \
                             --output_dir=/path/to/output/dir \
                             --tmp=/path/to/tmp/dir

The fasta directory should contain two subdirectories, one entitled microbes
and the other entitiled hosts. The microbes directory contains all microbial
proteomes in .faa files and the host directory contains all the host proteomes
in .faa files. Please use appropriate organism names for the proteome files.

Side note: To get all bacterial proteomes, you can download the compressed file
from ftp://ftp.ncbi.nlm.nih.gov/genomes/Bacteria/all.faa.tar.gz, and then run
the following code to concatenate all choromosome records together for each
bacterium. The script should be run in the bacteria subdirectory. Similar
scripts exist in the viruses and fungi directories.

    python aggregate.py

The output directory will contain the output JSON files. Two JSON files will be
produced per host organism, one storing all hits per microbe sorted by host
protein, and the other storing the actual hit alignments. It is
recommended that the tmp directory is local to the user so that he/she can
delete all tmp files if some files still remain after execution. This is
particularly important if filling up the computers tmp folder affects other
users.

Generally, the script should be run for 1 host organism at a time. The script
will then take about a day to complete for ~2700 microbial proteomes if 128
cores are used with 2 Gb of ram each.

If the MPI job fails, perhaps if it ran out of time, delete the latest .dump
files in the TMP folder in case they were only partially written. You can then
restart the MPI job and it will continue where it left off from, by seeing which
dump files are already present. This is another reason to specify a local TMP
directory which you can control.

### import.py

This script should be run on the server running the MongoDB database for the
front end of MimicMe. For this script and subsequent scripts, make sure that
you have created a MongoDB user that has write privileges to mimicme database.
Also make sure to place the username followed by the password on two seperate
lines in a file titled *login.conf*. This file should be located in the same
directory as these scripts.

The script will take the output JSON files from the
previous script and import them into Mongo line by line, creating 2 collections
and updating 2 others.

+ host\_name\_alignments (created)
+ host\_name\_hits (created)
+ gi\_organisms (mapping from gi to organism name. updated)
+ organisms (organism IDs for each host. updated)

Prereqs:
+ Python &gt;= 2.7
+ pymongo (python package)
+ gflags (python package)
+ A server running MongoDB

To run:

    python import.py --host=host_name_with_underscores \
                     --alignments=/path/to/alignments/json/file \
                     --hits=/path/to/hits/json/file

### organisms.py

Asides from being a module for create\_backend, organisms.py also contains
script functionalities to create/update the protein sequences and structures
collections. As with import.py, this should be run on the server with MongoDB.

Prereqs:
+ Python &gt;= 2.7
+ pymongo (python package)
+ gflags (python package)
+ biopython (python package)
+ A server running MongoDB

To create or update the sequences collection, run the following:

    python organisms.py --fasta_dir=/path/to/fasta/dir

Remember, the fasta directory must contain the 2 subdirectories 'hosts' and
'microbes'. To create or update the structures collection, run:

    python organisms.py --structures_dir=/path/to/structures/dir

The structures directory must contain species id .dat mapping files from uniprot
as well as the pdbtosp.txt mapping file from uniprot. See the README in the
structures directory for more details.

### ncbi\_collections.py

This script will create the rather large tables that map from gi to gene info
and gi to taxonomy info. While gi\_taxnonomy is no longer used for mimicme, it
is nonetheless a usefull table to have. Again, this needs to run on the server
that has MongoDB running. Note that this script should only be run once for
creation. If updating it, make sure to drop existing gi\_info and gi\_taxonomy
collections first.

Prereqs:
+ Python &gt;= 2.7
+ pymongo (python package)
+ gflags (python package)
+ A server running MongoDB

To run:

    python ncbi_collections.py --ncbi_dir=/path/to/ncbi/dir

The NCBI directory should contain essential mapping and data files from NCBI,
including gene\_info, gene2accession, names.dump, and gi\_taxid\_prot.dmp. See
the README in ncbi\_dir for more information on required files.

### suggestions.py

This script will create or update the suggestions collection, which contains
suggested pathogens and controls for each host. 

Prereqs:
+ Python &gt;= 2.7
+ pymongo (python package)
+ gflags (python package)
+ A server running MongoDB

To run:

    python suggestions.py --suggestions_dir=/path/to/suggestions/dir

The suggestions dir should contain files with microbe names that are suggested
pathogens or controls for a particular host. See the format requirements in the
suggestions\_dir readme.

### ontology.py

This script will create an entry per host organism in the ontology collection to
store population genes and gene to GO term associations, which will be used in
enrichment analysis.

Prereqs:
+ Python &gt;= 2.7
+ pymongo (python package)
+ gflags (python package)
+ A server running MongoDB

To run:

    python ontology.py --fasta_host_dir=/path/to/host/fasta/dir \
                       --uniprot_to_gene=/path/to/uniprotkb/to/geneid/mapping \
                       --gene_associations=/path/to/uniprotkb/to/goterm/mapping

The host fasta directory is simply the directory containing all host fasta
files. The uniprot to gene mapping, along with the gene associations file, are
files that can be retrieved from uniprot/ebi. See the ncbi\_dir README for more
detials.

Part 2: Front End
-----------------

After the backend scripts have been completed, the front end is ready to run
using the newly constructed mongo collections.

Prereqs:
+ A web server capable of executing a WSGI script.
+ sqlite3
+ Connection to MongoDB database built using back end scripts
+ A MongoDB user that can read the mimicme database. A *login.conf* file should
be placed in the same directory as app.wsgi, and should contain the username
followed by the password on two separate lines.
+ a standalone muscle binary should be located in tools
+ Python &gt;= 2.7
+ pymongo (python package)
+ bottle (python package)
+ biopython (python package)
+ bio.PDB (python package)
+ goatools (python package)
+ fisher (python package)

To run, simply configure your web server to run the WSGI script app.wsgi. Note
that the app is currently configured to run with a url in the following format:

    domain.com/mimicme/

You can change this by modifying the base url in the template under the views
folder.

Also note that the user running the webserver (eg. \_www) must have
write access for the databases folder and the pdb\_structures folder, since this
is where the mimicme.db.sessions sqlite3 database will be located, which is the
database that stores saved sessions. Lastly, you should have a
gene\_ontology.1\_2.obo file in your front\_end folder, which stores GO terms.
It can be retrieved from:

http://geneontology.org/ontology/obo_format_1_2/gene_ontology.1_2.obo
