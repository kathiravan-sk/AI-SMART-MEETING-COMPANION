import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import os
import tempfile
os.environ['AI_PROVIDER']='demo'
os.environ['DB_BACKEND']='sqlite'
os.environ['SQLITE_PATH']=tempfile.mktemp(suffix='.sqlite3')
os.environ['JWT_SECRET']='test-only-secret-with-more-than-thirty-two-characters'
