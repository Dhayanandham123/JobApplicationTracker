import os
from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))

class Config:
    # Strictly load credentials from the .env file (no fallbacks)
    SECRET_KEY = os.environ.get('SECRET_KEY')
    DATABASE = os.environ.get('DATABASE_PATH') or os.path.join(BASE_DIR, 'database', 'tracker.db')
    DEBUG = os.environ.get('DEBUG', 'True').lower() in ('true', '1', 't')
    GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')

    # SMTP Email Configuration
    MAIL_SERVER = os.environ.get('MAIL_SERVER') or 'smtp.gmail.com'
    MAIL_PORT = int(os.environ.get('MAIL_PORT') or 465)
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME', '').strip()
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD', '').strip()