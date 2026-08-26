from flask import Blueprint, render_template, request, jsonify, redirect, url_for, session, g
from datetime import datetime, date
from database.db import get_db, query_db
from routes.auth import login_required

applications_bp = Blueprint('applications', __name__)

VALID_STATUSES = ['Applied', 'Interviewing', 'Offered', 'Rejected']

def calculate_days_since(val):
    if not val:
        return 0
    if isinstance(val, datetime):
        val = val.date()
    if isinstance(val, date):
        delta = (date.today() - val).days
        return max(0, delta)
    try:
        updated_date = datetime.strptime(str(val), '%Y-%m-%d').date()
        delta = (date.today() - updated_date).days
        return max(0, delta)
    except (ValueError, TypeError):
        return 0

def format_application_row(row):
    app_dict = dict(row)
    for key in ['date_applied', 'last_updated']:
        if isinstance(app_dict.get(key), (date, datetime)):
            app_dict[key] = app_dict[key].strftime('%Y-%m-%d')
        elif app_dict.get(key) is not None:
            app_dict[key] = str(app_dict[key])

    days_since = calculate_days_since(app_dict.get('last_updated') or app_dict.get('date_applied'))
    app_dict['days_since_update'] = days_since
    app_dict['needs_followup'] = days_since >= 7 and app_dict['status'] in ['Applied', 'Interviewing']
    return app_dict

@applications_bp.route('/')
@login_required
def index():
    user_id = session['user_id']
    db = get_db()
    rows = db.execute('SELECT * FROM applications WHERE user_id = ? ORDER BY last_updated DESC, id DESC', (user_id,)).fetchall()
    applications = [format_application_row(r) for r in rows]

    counts = {
        'total': len(applications),
        'Applied': sum(1 for a in applications if a['status'] == 'Applied'),
        'Interviewing': sum(1 for a in applications if a['status'] == 'Interviewing'),
        'Offered': sum(1 for a in applications if a['status'] == 'Offered'),
        'Rejected': sum(1 for a in applications if a['status'] == 'Rejected'),
        'needs_followup': sum(1 for a in applications if a['needs_followup'])
    }

    grouped = {
        'Applied': [a for a in applications if a['status'] == 'Applied'],
        'Interviewing': [a for a in applications if a['status'] == 'Interviewing'],
        'Offered': [a for a in applications if a['status'] == 'Offered'],
        'Rejected': [a for a in applications if a['status'] == 'Rejected']
    }

    today_str = date.today().strftime('%Y-%m-%d')

    return render_template('dashboard.html', 
                           grouped=grouped, 
                           counts=counts, 
                           today_str=today_str,
                           all_applications=applications,
                           current_user=g.user)

@applications_bp.route('/applications', methods=['GET'])
@login_required
def get_applications():
    user_id = session['user_id']
    db = get_db()
    search = request.args.get('search', '').strip().lower()
    rows = db.execute('SELECT * FROM applications WHERE user_id = ? ORDER BY last_updated DESC, id DESC', (user_id,)).fetchall()
    applications = [format_application_row(r) for r in rows]

    if search:
        applications = [
            a for a in applications 
            if search in a['company_name'].lower() or search in a['job_title'].lower()
        ]

    return jsonify(applications)

@applications_bp.route('/applications', methods=['POST'])
@login_required
def create_application():
    user_id = session['user_id']
    if request.is_json:
        data = request.get_json()
    else:
        data = request.form

    company_name = data.get('company_name', '').strip()
    job_title = data.get('job_title', '').strip()
    status = data.get('status', 'Applied').strip()
    date_applied = data.get('date_applied', '').strip() or date.today().strftime('%Y-%m-%d')
    notes = data.get('notes', '').strip()

    if not company_name or not job_title:
        return jsonify({'error': 'Company name and job title are required.'}), 400

    if status not in VALID_STATUSES:
        return jsonify({'error': f'Invalid status. Must be one of {VALID_STATUSES}'}), 400

    last_updated = date.today().strftime('%Y-%m-%d')

    db = get_db()
    cursor = db.execute(
        'INSERT INTO applications (user_id, company_name, job_title, status, date_applied, last_updated, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        (user_id, company_name, job_title, status, date_applied, last_updated, notes)
    )
    db.commit()

    new_id = cursor.lastrowid
    row = db.execute('SELECT * FROM applications WHERE id = ? AND user_id = ?', (new_id, user_id)).fetchone()
    new_app = format_application_row(row)

    if request.is_json:
        return jsonify(new_app), 201
    return redirect(url_for('applications.index'))

@applications_bp.route('/applications/<int:app_id>', methods=['PUT', 'PATCH'])
@login_required
def update_application(app_id):
    user_id = session['user_id']
    db = get_db()
    existing = db.execute('SELECT * FROM applications WHERE id = ? AND user_id = ?', (app_id, user_id)).fetchone()
    if not existing:
        return jsonify({'error': 'Application not found'}), 404

    data = request.get_json() or request.form

    existing_dict = dict(existing)
    company_name = str(data.get('company_name', existing_dict['company_name'])).strip()
    job_title = str(data.get('job_title', existing_dict['job_title'])).strip()
    status = str(data.get('status', existing_dict['status'])).strip()
    date_applied = str(data.get('date_applied', existing_dict['date_applied'])).strip()
    notes = str(data.get('notes', existing_dict['notes'] or '')).strip()

    if status not in VALID_STATUSES:
        return jsonify({'error': f'Invalid status. Must be one of {VALID_STATUSES}'}), 400

    last_updated = date.today().strftime('%Y-%m-%d')

    db.execute(
        'UPDATE applications SET company_name = ?, job_title = ?, status = ?, date_applied = ?, last_updated = ?, notes = ? WHERE id = ? AND user_id = ?',
        (company_name, job_title, status, date_applied, last_updated, notes, app_id, user_id)
    )
    db.commit()

    updated_row = db.execute('SELECT * FROM applications WHERE id = ? AND user_id = ?', (app_id, user_id)).fetchone()
    return jsonify(format_application_row(updated_row))

@applications_bp.route('/applications/<int:app_id>', methods=['DELETE'])
@login_required
def delete_application(app_id):
    user_id = session['user_id']
    db = get_db()
    existing = db.execute('SELECT * FROM applications WHERE id = ? AND user_id = ?', (app_id, user_id)).fetchone()
    if not existing:
        return jsonify({'error': 'Application not found'}), 404

    db.execute('DELETE FROM applications WHERE id = ? AND user_id = ?', (app_id, user_id))
    db.commit()
    return jsonify({'success': True, 'id': app_id})

@applications_bp.route('/applications/<int:app_id>/send-reminder', methods=['POST'])
@login_required
def send_application_reminder(app_id):
    from services.email_service import send_followup_email
    user_id = session['user_id']
    db = get_db()

    app_row = db.execute('''
        SELECT a.id, a.company_name, a.job_title, u.email as user_email
        FROM applications a
        JOIN users u ON a.user_id = u.id
        WHERE a.id = ? AND a.user_id = ?
    ''', (app_id, user_id)).fetchone()

    if not app_row:
        return jsonify({'error': 'Application not found'}), 404

    app_dict = dict(app_row)
    user_email = app_dict.get('user_email') or (g.user.get('email') if g.user else None)

    if not user_email:
        return jsonify({'error': 'No user email address found for sending reminder.'}), 400

    success, message = send_followup_email(
        receiver_email=user_email,
        company=app_dict['company_name'],
        job_title=app_dict['job_title']
    )

    if success:
        today_str = date.today().strftime('%Y-%m-%d')
        db.execute('UPDATE applications SET last_email_sent = ? WHERE id = ?', (today_str, app_id))
        db.commit()
        return jsonify({'success': True, 'message': f'Follow-up reminder email sent to {user_email}!'})
    else:
        return jsonify({'error': f'Failed to send email: {message}'}), 500
