CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    google_id TEXT UNIQUE,
    avatar_url TEXT,
    full_name TEXT,
    phone TEXT,
    location TEXT,
    headline TEXT,
    university TEXT,
    grad_year TEXT,
    resume_text TEXT,
    resume_filename TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY,
    notify_followup INTEGER DEFAULT 1,
    notify_interview INTEGER DEFAULT 1,
    reminder_time TEXT DEFAULT '1 Day Before',
    email_notifications INTEGER DEFAULT 1,
    theme TEXT DEFAULT 'light',
    dashboard_view TEXT DEFAULT 'kanban',
    card_density TEXT DEFAULT 'comfortable',
    show_stats INTEGER DEFAULT 1,
    show_warnings INTEGER DEFAULT 1,
    show_interview_dates INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS resume_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    version_name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    company_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Applied', 'Interviewing', 'Offered', 'Rejected')),
    date_applied DATE NOT NULL,
    last_updated DATE NOT NULL,
    notes TEXT,
    last_email_sent DATE,
    interview_date DATE,
    deadline_date DATE,
    assessment_date DATE,
    followup_date DATE,
    job_url TEXT,
    salary TEXT,
    location TEXT,
    job_type TEXT DEFAULT 'Full-time',
    last_interview_reminder_sent DATE,
    last_assessment_reminder_sent DATE,
    fit_score INTEGER,
    missing_skills TEXT,
    resume_version TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
