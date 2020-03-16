import ftplib

ftp = ftplib.FTP('ftp.ncbi.nlm.nih.gov')
ftp.connect()
ftp.login()
ftp.set_pasv(True)

ftp.cwd('/genomes/Protozoa/')
for d in (p for p in ftp.nlst() if p not in ('..', '.')):
  try:
    print 'Downloading %s proteome' % d
    ftp.cwd(d)
    with open('%s.faa' % d, 'w') as f:
      for fasta_file in (faa for faa in ftp.nlst() if faa.endswith('.faa')):
        ftp.retrbinary('RETR %s' % fasta_file, f.write)
    ftp.cwd('..')
  except ftplib.error_perm:
    pass
