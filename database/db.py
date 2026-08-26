import sqlite3
import os
from flask import g, current_app

def get_db():
    if 'db' not in g:
        db_path = current_app.config['DATABASE']
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        g.db = sqlite3.connect(
            db_path,
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        g.db.row_factory = sqlite3.Row
    return g.db

def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    db_path = current_app.config['DATABASE']
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    
    # Create tables if not existing
    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    with open(schema_path, mode='r') as f:
        conn.executescript(f.read())
    
    # Migration check: check if applications table has user_id column
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(applications)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'user_id' not in columns:
        # Create default demo user to own existing entries
        cursor.execute("INSERT OR IGNORE INTO users (id, username, email) VALUES (1, 'demo', 'demo@example.com')")
        cursor.execute("ALTER TABLE applications ADD COLUMN user_id INTEGER DEFAULT 1 REFERENCES users(id)")
    
    if 'last_email_sent' not in columns:
        cursor.execute("ALTER TABLE applications ADD COLUMN last_email_sent DATE")
    
    conn.commit()
    conn.close()

# User Helper DB Functions
def get_user_by_id(user_id):
    db = get_db()
    return db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()

def get_user_by_email(email):
    db = get_db()
    return db.execute('SELECT * FROM users WHERE email = ?', (email.strip().lower(),)).fetchone()

def get_user_by_username(username):
    db = get_db()
    return db.execute('SELECT * FROM users WHERE LOWER(username) = ?', (username.strip().lower(),)).fetchone()

def get_user_by_google_id(google_id):
    db = get_db()
    return db.execute('SELECT * FROM users WHERE google_id = ?', (google_id,)).fetchone()

def create_user(username, email, password_hash=None, google_id=None, avatar_url=None):
    db = get_db()
    cursor = db.execute(
        'INSERT INTO users (username, email, password_hash, google_id, avatar_url) VALUES (?, ?, ?, ?, ?)',
        (username.strip() if username else None, email.strip().lower(), password_hash, google_id, avatar_url)
    )
    db.commit()
    return cursor.lastrowid
