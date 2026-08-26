import smtplib
import logging
from email.message import EmailMessage
from datetime import date, datetime, timedelta
from flask import current_app

logger = logging.getLogger(__name__)

def send_followup_email(receiver_email, company, job_title):
    try:
        if current_app:
            server_host = current_app.config.get('MAIL_SERVER', 'smtp.gmail.com')
            server_port = current_app.config.get('MAIL_PORT', 465)
            sender_email = current_app.config.get('MAIL_USERNAME', 'akashempire183@gmail.com')
            sender_password = current_app.config.get('MAIL_PASSWORD', 'cbonariqjbjwwgxt')
        else:
            from config import Config
            server_host = Config.MAIL_SERVER
            server_port = Config.MAIL_PORT
            sender_email = Config.MAIL_USERNAME
            sender_password = Config.MAIL_PASSWORD

        if not receiver_email or not sender_email or not sender_password:
            return False, "Missing email configuration or receiver address."

        msg = EmailMessage()
        msg["Subject"] = f"Follow-up Reminder: {job_title} at {company}"
        msg["From"] = sender_email
        msg["To"] = receiver_email

        msg.set_content(f"""Hello,

This is an automated reminder from your Job & Internship Tracker to follow up regarding your application:

  Company:  {company}
  Position: {job_title}

It has been more than 7 days since your last status update for this application. Following up with the recruiter or hiring manager increases your chances of getting a response!

Best regards,
Job & Internship Tracker
""")

        with smtplib.SMTP_SSL(server_host, server_port, timeout=10) as smtp:
            smtp.login(sender_email, sender_password)
            smtp.send_message(msg)

        logger.info(f"Follow-up email sent to {receiver_email} for {company} - {job_title}")
        return True, f"Follow-up email sent successfully to {receiver_email}!"

    except Exception as e:
        logger.error(f"Failed to send email to {receiver_email}: {e}")
        return False, str(e)

def process_automated_stale_reminders():
    """Scans DB for stale applications (>= 7 days untouched) and sends reminder emails."""
    from database.db import get_db
    try:
        db = get_db()
        # Find active applications with user email where days since last update >= 7
        rows = db.execute('''
            SELECT a.id, a.company_name, a.job_title, a.last_updated, a.date_applied, a.last_email_sent, u.email as user_email
            FROM applications a
            JOIN users u ON a.user_id = u.id
            WHERE a.status IN ('Applied', 'Interviewing')
        ''').fetchall()

        today = date.today()
        emails_sent = 0

        for row in rows:
            app_dict = dict(row)
            updated_str = app_dict.get('last_updated') or app_dict.get('date_applied')
            
            if not updated_str:
                continue

            try:
                if isinstance(updated_str, (date, datetime)):
                    updated_date = updated_str if isinstance(updated_str, date) else updated_str.date()
                else:
                    updated_date = datetime.strptime(str(updated_str), '%Y-%m-%d').date()
            except ValueError:
                continue

            days_since = (today - updated_date).days

            if days_since >= 7:
                last_email_sent = app_dict.get('last_email_sent')
                already_sent_recently = False
                
                if last_email_sent:
                    try:
                        if isinstance(last_email_sent, (date, datetime)):
                            email_date = last_email_sent if isinstance(last_email_sent, date) else last_email_sent.date()
                        else:
                            email_date = datetime.strptime(str(last_email_sent), '%Y-%m-%d').date()
                        
                        # Only send at most once every 7 days per application
                        if (today - email_date).days < 7:
                            already_sent_recently = True
                    except ValueError:
                        pass

                if not already_sent_recently and app_dict.get('user_email'):
                    success, msg = send_followup_email(
                        receiver_email=app_dict['user_email'],
                        company=app_dict['company_name'],
                        job_title=app_dict['job_title']
                    )
                    if success:
                        emails_sent += 1
                        db.execute('UPDATE applications SET last_email_sent = ? WHERE id = ?', (today.strftime('%Y-%m-%d'), app_dict['id']))
                        db.commit()

        return emails_sent

    except Exception as e:
        logger.error(f"Error processing automated stale reminders: {e}")
        return 0
