from datetime import datetime, timedelta, timezone
import jwt
from argon2 import PasswordHasher
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import SECRET
from app.database.store import store
bearer = HTTPBearer(auto_error=False)
passwords = PasswordHasher()
def issue(user):
    token = jwt.encode({'sub': user['id'], 'exp': datetime.now(timezone.utc) + timedelta(hours=12)}, SECRET, algorithm='HS256')
    return {'token': token, 'user': {k: user[k] for k in ['id', 'name', 'email']}}
def decode(token):
    try:
        data = jwt.decode(token, SECRET, algorithms=['HS256'])
        user = store.get('users', data['sub'])
        if user:
            return user
    except (jwt.PyJWTError, KeyError):
        pass
    raise HTTPException(401, 'Your session expired. Please sign in again.')
def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    if not credentials:
        raise HTTPException(401, 'Sign in to continue')
    return decode(credentials.credentials)
