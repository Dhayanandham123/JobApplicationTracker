# 💼 Job & Internship Application Tracker

A clean, full-stack dashboard for logging applications, tracking interview progress, organizing follow-ups, and sending 7-day follow-up reminder emails — built with **Flask**, **SQLite**, and vanilla **HTML/CSS/JS**.

---

## 🌟 Key Features

- **📊 4-Column Dashboard**: Categorizes applications into `Applied`, `Interviewing`, `Offered`, and `Rejected`.
- **🔐 User Authentication**: Support for Username/Password sign-up/login + Google One Tap One-Click Sign-In.
- **⏰ 7-Day Follow-Up Alerts**: Visual warning banners for applications untouched for 7+ days.
- **📧 Email Reminders**: Automatic background scheduler & manual "Email Me" button to receive follow-up emails via Gmail SMTP.
- **🔍 Instant Search**: Real-time client-side filter by company name or job title.
- **🔒 Multi-User Isolation**: Each user's applications are securely isolated to their account.

---

## 📁 Project Structure

```
job-tracker/
├── app.py                      # Flask app entry point
├── config.py                   # App configuration (loads from .env)
├── requirements.txt            # Python dependencies
├── .env.example                # Template for local credentials
├── .gitignore                  # Keeps secrets and local DB out of Git
├── database/
│   ├── schema.sql              # Table definitions (users, applications)
│   └── db.py                   # DB connection & row factory helpers
├── services/
│   ├── email_service.py        # SMTP email dispatch & stale app scanner
│   └── scheduler.py            # Background thread worker for email reminders
├── routes/
│   ├── auth.py                 # Login, signup, logout & Google OAuth handlers
│   └── applications.py         # Application CRUD & email reminder endpoints
├── static/
│   ├── css/style.css           # Styling system & dark theme
│   └── js/app.js               # Interactivity, search filter & AJAX calls
├── templates/
│   ├── base.html               # Shared layout & user profile header
│   ├── dashboard.html          # Main 4-column board
│   ├── login.html              # Sign In page
│   ├── signup.html             # Sign Up page
│   └── partials/_application_card.html # Reusable card component
└── tests/
    └── test_routes.py          # Pytest & Unittest test suite
```

---

## 🚀 Setup & Local Installation Guide

### 1. Clone the repository
```bash
git clone https://github.com/Dhayanandham123/JobApplicationTracker.git
cd JobApplicationTracker
```

### 2. Create and activate a Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

---

## 🔑 Environment & Credentials Setup

> [!IMPORTANT]
> **Credentials File Setup**: Sensitive credentials (email passwords, Google OAuth Client IDs) are stored in a `.env` file which is excluded from Git to keep secrets safe.

1. Copy `.env.example` to create your own local `.env` file:
   ```bash
   # Windows (CMD)
   copy .env.example .env

   # PowerShell / Bash
   cp .env.example .env
   ```

2. Open `.env` in your code editor and fill in the required environment variables:

```env
# Flask Settings
SECRET_KEY=dev-secret-key-job-tracker
DEBUG=True

# Google OAuth 2.0 Client ID (Required for Google One Tap Login)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# SMTP Email Configuration (Required for 7-day Follow-up Email Reminders)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=465
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_16_character_app_password
```

### How Teammates Can Obtain Credentials:

#### A. Gmail App Password (for Email Reminders):
1. Go to your [Google Account Security Settings](https://myaccount.google.com/security).
2. Ensure **2-Step Verification** is turned ON.
3. Search for **App Passwords** (or visit `https://myaccount.google.com/apppasswords`).
4. Create an App Password named `Job Tracker`.
5. Copy the 16-character generated password (without spaces) and paste it into `MAIL_PASSWORD` in your `.env` file.

#### B. Google OAuth Client ID (for Google One Tap Login):
1. Go to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** for a **Web Application**.
3. Add Authorized JavaScript Origins:
   - `http://localhost:5000`
   - `http://127.0.0.1:5000`
4. Copy the Client ID into `GOOGLE_CLIENT_ID` in your `.env` file.

---

## 🏃 Running the Application

Start the Flask server:
```bash
python app.py
```

Open your browser and navigate to:
**`http://127.0.0.1:5000`**

---

## 🧪 Running Automated Tests

Run the test suite using `pytest`:
```bash
pytest tests/test_routes.py
```
