import os
import secrets
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()
PROVIDER = os.getenv('AI_PROVIDER', 'demo')
DB_BACKEND = os.getenv('DB_BACKEND', 'sqlite')
SECRET = os.getenv('JWT_SECRET', '')
if not SECRET or SECRET.startswith('replace-with'):
    if os.getenv('ENVIRONMENT', 'development') != 'development':
        raise RuntimeError('A random JWT_SECRET is required outside development')
    path = Path('data/.jwt-secret')
    path.parent.mkdir(exist_ok=True)
    if not path.exists():
        path.write_text(secrets.token_urlsafe(48))
        path.chmod(0o600)
    SECRET = path.read_text().strip()
if len(SECRET) < 32:
    raise RuntimeError('JWT_SECRET must contain at least 32 characters')
LANGUAGES = {'en': 'English', 'ta': 'Tamil', 'ml': 'Malayalam', 'hi': 'Hindi'}
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
