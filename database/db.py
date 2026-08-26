import sqlite3
import os
from flask import g, current_app

def get_db():
    if 'db' not in g:
        db_path = current_app.config['DATABASE']
        dir_name = os.path.dirname(db_path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
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
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
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
    
    if 'interview_date' not in columns:
        cursor.execute("ALTER TABLE applications ADD COLUMN interview_date DATE")
    
    if 'deadline_date' not in columns:
        cursor.execute("ALTER TABLE applications ADD COLUMN deadline_date DATE")

    if 'assessment_date' not in columns:
        cursor.execute("ALTER TABLE applications ADD COLUMN assessment_date DATE")

    if 'followup_date' not in columns:
        cursor.execute("ALTER TABLE applications ADD COLUMN followup_date DATE")
    
    if 'job_url' not in columns:
        cursor.execute("ALTER TABLE applications ADD COLUMN job_url TEXT")

    if 'salary' not in columns:
        cursor.execute("ALTER TABLE applications ADD COLUMN salary TEXT")

    if 'location' not in columns:
        cursor.execute("ALTER TABLE applications ADD COLUMN location TEXT")

    if 'job_type' not in columns:
        cursor.execute("ALTER TABLE applications ADD COLUMN job_type TEXT DEFAULT 'Full-time'")

    if 'last_interview_reminder_sent' not in columns:
        cursor.execute("ALTER TABLE applications ADD COLUMN last_interview_reminder_sent DATE")

    if 'last_assessment_reminder_sent' not in columns:
        cursor.execute("ALTER TABLE applications ADD COLUMN last_assessment_reminder_sent DATE")

    if 'fit_score' not in columns:
        cursor.execute("ALTER TABLE applications ADD COLUMN fit_score INTEGER")

    if 'missing_skills' not in columns:
        cursor.execute("ALTER TABLE applications ADD COLUMN missing_skills TEXT")

    if 'resume_version' not in columns:
        cursor.execute("ALTER TABLE applications ADD COLUMN resume_version TEXT")

    # Migration check: check users table columns
    cursor.execute("PRAGMA table_info(users)")
    user_columns = [col[1] for col in cursor.fetchall()]
    user_new_cols = ['full_name', 'phone', 'location', 'headline', 'university', 'grad_year', 'resume_text', 'resume_filename']
    for col_name in user_new_cols:
        if col_name not in user_columns:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} TEXT")

    # Ensure resume_versions table exists
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS resume_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            version_name TEXT NOT NULL,
            filename TEXT,
            resume_text TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')

    # Migration check: check resume_versions table columns
    cursor.execute("PRAGMA table_info(resume_versions)")
    rv_columns = [col[1] for col in cursor.fetchall()]
    for rv_col in ['filename', 'resume_text']:
        if rv_col not in rv_columns:
            cursor.execute(f"ALTER TABLE resume_versions ADD COLUMN {rv_col} TEXT")

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
    user_id = cursor.lastrowid
    # Create default settings row
    db.execute('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)', (user_id,))
    db.commit()
    return user_id

def update_user_profile(user_id, data):
    db = get_db()
    avatar_url = data.get('avatar_url')
    full_name = data.get('full_name')
    phone = data.get('phone')
    location = data.get('location')
    headline = data.get('headline')
    university = data.get('university')
    grad_year = data.get('grad_year')

    db.execute('''
        UPDATE users 
        SET avatar_url = COALESCE(?, avatar_url),
            full_name = COALESCE(?, full_name),
            phone = COALESCE(?, phone),
            location = COALESCE(?, location),
            headline = COALESCE(?, headline),
            university = COALESCE(?, university),
            grad_year = COALESCE(?, grad_year)
        WHERE id = ?
    ''', (avatar_url, full_name, phone, location, headline, university, grad_year, user_id))
    db.commit()
    return get_user_by_id(user_id)

def get_user_settings(user_id):
    db = get_db()
    row = db.execute('SELECT * FROM user_settings WHERE user_id = ?', (user_id,)).fetchone()
    if not row:
        db.execute('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)', (user_id,))
        db.commit()
        row = db.execute('SELECT * FROM user_settings WHERE user_id = ?', (user_id,)).fetchone()
    return dict(row) if row else {}

def update_user_settings(user_id, data):
    db = get_db()
    # Ensure row exists
    get_user_settings(user_id)
    
    notify_followup = 1 if data.get('notify_followup') in [True, 1, '1', 'true', 'on'] else 0
    notify_interview = 1 if data.get('notify_interview') in [True, 1, '1', 'true', 'on'] else 0
    reminder_time = str(data.get('reminder_time', '1 Day Before'))
    email_notifications = 1 if data.get('email_notifications') in [True, 1, '1', 'true', 'on'] else 0
    theme = str(data.get('theme', 'light'))
    dashboard_view = str(data.get('dashboard_view', 'kanban'))
    card_density = str(data.get('card_density', 'comfortable'))
    show_stats = 1 if data.get('show_stats') in [True, 1, '1', 'true', 'on'] else 0
    show_warnings = 1 if data.get('show_warnings') in [True, 1, '1', 'true', 'on'] else 0
    show_interview_dates = 1 if data.get('show_interview_dates') in [True, 1, '1', 'true', 'on'] else 0

    db.execute('''
        UPDATE user_settings
        SET notify_followup = ?,
            notify_interview = ?,
            reminder_time = ?,
            email_notifications = ?,
            theme = ?,
            dashboard_view = ?,
            card_density = ?,
            show_stats = ?,
            show_warnings = ?,
            show_interview_dates = ?
        WHERE user_id = ?
    ''', (notify_followup, notify_interview, reminder_time, email_notifications, theme, dashboard_view, card_density, show_stats, show_warnings, show_interview_dates, user_id))
    db.commit()
    return get_user_settings(user_id)

def delete_user_account(user_id):
    db = get_db()
    db.execute('DELETE FROM applications WHERE user_id = ?', (user_id,))
    db.execute('DELETE FROM user_settings WHERE user_id = ?', (user_id,))
    db.execute('DELETE FROM users WHERE id = ?', (user_id,))
    db.commit()

