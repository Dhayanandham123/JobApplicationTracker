CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    google_id TEXT UNIQUE,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
