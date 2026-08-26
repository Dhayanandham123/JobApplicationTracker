import unittest
import sys
import os
from datetime import date, timedelta
import tempfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from database.db import init_db
from routes.applications import calculate_days_since

class AuthAndApplicationsTestCase(unittest.TestCase):

    def setUp(self):
        self.db_fd, self.db_path = tempfile.mkstemp()
        
        class TestConfig:
            TESTING = True
            DATABASE = self.db_path
            SECRET_KEY = 'test-secret-key'
            MAIL_USERNAME = 'test@example.com'
            MAIL_PASSWORD = 'testpassword'

        self.app = create_app(TestConfig)
        self.client = self.app.test_client()

    def tearDown(self):
        os.close(self.db_fd)
        try:
            os.unlink(self.db_path)
        except OSError:
            pass

    def register(self, username, email, password):
        return self.client.post('/signup', data={
            'username': username,
            'email': email,
            'password': password,
            'confirm_password': password
        }, follow_redirects=True)

    def login(self, login_input, password):
        return self.client.post('/login', data={
            'login_input': login_input,
            'password': password
        }, follow_redirects=True)

    def logout(self):
        return self.client.get('/logout', follow_redirects=True)

    def test_unauthenticated_redirect(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 302)
        self.assertIn('/login', response.headers['Location'])

    def test_signup_and_login(self):
        # Register user
        res = self.register('alice', 'alice@example.com', 'password123')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(b'Job & Internship Tracker' in res.data or b'Job &amp; Internship Tracker' in res.data)

        # Logout
        self.logout()

        # Login with bad password
        res_bad = self.login('alice', 'wrongpassword')
        self.assertIn(b'Invalid username/email or password', res_bad.data)

        # Login with correct password
        res_good = self.login('alice', 'password123')
        self.assertEqual(res_good.status_code, 200)
        self.assertTrue(b'Job & Internship Tracker' in res_good.data or b'Job &amp; Internship Tracker' in res_good.data)

    def test_create_and_get_application_for_user(self):
        self.register('bob', 'bob@example.com', 'password123')

        # Test POST creation
        post_data = {
            'company_name': 'Acme Corp',
            'job_title': 'Software Engineer Intern',
            'status': 'Applied',
            'date_applied': '2026-08-01',
            'notes': 'Referred by John'
        }
        res = self.client.post('/applications', json=post_data)
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['company_name'], 'Acme Corp')
        app_id = data['id']

        # Test GET list
        res_get = self.client.get('/applications')
        self.assertEqual(res_get.status_code, 200)
        list_data = res_get.get_json()
        self.assertEqual(len(list_data), 1)
        self.assertEqual(list_data[0]['id'], app_id)

    def test_multi_user_data_isolation(self):
        # Register User A and create an application
        self.register('user_a', 'usera@example.com', 'password123')
        res_a = self.client.post('/applications', json={
            'company_name': 'Company A',
            'job_title': 'Developer A',
            'status': 'Applied'
        })
        app_a_id = res_a.get_json()['id']
        self.logout()

        # Register User B
        self.register('user_b', 'userb@example.com', 'password123')
        
        # User B should see 0 applications
        res_b_get = self.client.get('/applications')
        self.assertEqual(len(res_b_get.get_json()), 0)

        # User B cannot update User A's application
        res_b_put = self.client.put(f'/applications/{app_a_id}', json={'status': 'Offered'})
        self.assertEqual(res_b_put.status_code, 404)

        # User B cannot delete User A's application
        res_b_del = self.client.delete(f'/applications/{app_a_id}')
        self.assertEqual(res_b_del.status_code, 404)

    def test_followup_days_calculation(self):
        today = date.today()
        eight_days_ago = (today - timedelta(days=8)).strftime('%Y-%m-%d')
        three_days_ago = (today - timedelta(days=3)).strftime('%Y-%m-%d')

        self.assertEqual(calculate_days_since(eight_days_ago), 8)
        self.assertEqual(calculate_days_since(three_days_ago), 3)
        self.assertEqual(calculate_days_since(today.strftime('%Y-%m-%d')), 0)

    def test_send_reminder_email(self):
        from unittest.mock import patch
        self.register('carol', 'carol@example.com', 'password123')

        res_create = self.client.post('/applications', json={
            'company_name': 'Meta',
            'job_title': 'Production Engineer',
            'status': 'Applied'
        })
        app_id = res_create.get_json()['id']

        with patch('services.email_service.smtplib.SMTP_SSL') as mock_smtp:
            res_reminder = self.client.post(f'/applications/{app_id}/send-reminder')
            self.assertEqual(res_reminder.status_code, 200)
            self.assertTrue(res_reminder.get_json()['success'])

if __name__ == '__main__':
    unittest.main()
