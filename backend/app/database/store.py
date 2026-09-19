"""Document storage. SQLite for the local demo; MongoDB for the deployed app."""
import json
import os
import sqlite3
import threading
from pathlib import Path
from app.config import DB_BACKEND

class Store:
    def __init__(self):
        self.lock = threading.RLock()
        self.mongo = None
        if DB_BACKEND == 'mongodb':
            from pymongo import MongoClient
            client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017'), serverSelectionTimeoutMS=5000)
            client.admin.command('ping')
            self.mongo = client[os.getenv('MONGODB_DATABASE', 'meetmind')]
            self.mongo.users.create_index('email', unique=True)
            self.mongo.meetings.create_index('userId')
            self.mongo.attempts.create_index('userId')
        elif DB_BACKEND == 'sqlite':
            path = os.getenv('SQLITE_PATH', 'data/meetmind.sqlite3')
            Path(path).parent.mkdir(parents=True, exist_ok=True)
            self.conn = sqlite3.connect(path, check_same_thread=False)
            self.conn.execute('PRAGMA journal_mode=WAL')
            self.conn.execute('CREATE TABLE IF NOT EXISTS documents (collection TEXT, id TEXT, body TEXT, PRIMARY KEY(collection,id))')
            self.conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS unique_email ON documents(json_extract(body, '$.email')) WHERE collection='users'")
            self.conn.commit()
        else:
            raise RuntimeError('DB_BACKEND must be sqlite or mongodb')

    def get(self, collection, id):
        if self.mongo is not None:
            return self.mongo[collection].find_one({'id': id}, {'_id': 0})
        with self.lock:
            row = self.conn.execute('SELECT body FROM documents WHERE collection=? AND id=?', (collection, id)).fetchone()
        return json.loads(row[0]) if row else None

    def find(self, collection, **query):
        if self.mongo is not None:
            return list(self.mongo[collection].find(query, {'_id': 0}))
        with self.lock:
            rows = self.conn.execute('SELECT body FROM documents WHERE collection=?', (collection,)).fetchall()
        return [d for row in rows if all((d := json.loads(row[0])).get(k) == v for k, v in query.items())] if query else [json.loads(r[0]) for r in rows]

    def put(self, collection, doc):
        if self.mongo is not None:
            self.mongo[collection].replace_one({'id': doc['id']}, dict(doc), upsert=True)
        else:
            with self.lock:
                self.conn.execute('INSERT OR REPLACE INTO documents VALUES (?,?,?)', (collection, doc['id'], json.dumps(doc, ensure_ascii=False)))
                self.conn.commit()
        return doc

    def insert(self, collection, doc):
        if self.mongo is not None:
            self.mongo[collection].insert_one(dict(doc))
        else:
            with self.lock:
                self.conn.execute('INSERT INTO documents VALUES (?,?,?)', (collection, doc['id'], json.dumps(doc)))
                self.conn.commit()
        return doc

    def delete(self, collection, id):
        if self.mongo is not None:
            self.mongo[collection].delete_one({'id': id})
        else:
            with self.lock:
                self.conn.execute('DELETE FROM documents WHERE collection=? AND id=?', (collection, id))
                self.conn.commit()

store = Store()
