# Scripts involved in building backend collections for mimicme should use this
# file to connect to the database. You should have the file login.conf in the
# directory containing this script. The file should have a username on one line
# followed by a password on the next line.
import os
import pymongo

def Connect(path=None):
  if not path:
    path = os.path.join(os.path.dirname(os.path.realpath(__file__)),
                        'login.conf')
  with open(path) as f:
    username = f.readline().strip()
    password = f.readline().strip()
    c = pymongo.MongoClient()
    db = c.mimicme
    db.authenticate(username, password)
    return db
  return None
