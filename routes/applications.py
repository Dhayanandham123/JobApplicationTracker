import os
from flask import Blueprint, render_template, request, jsonify, redirect, url_for, session, g, current_app
from datetime import datetime, date
from database.db import get_db
from routes.auth import login_required
from services.email_service import send_followup_email

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
    date_keys = ['date_applied', 'last_updated', 'interview_date', 'deadline_date', 'assessment_date', 'followup_date']
    for key in date_keys:
        if isinstance(app_dict.get(key), (date, datetime)):
            app_dict[key] = app_dict[key].strftime('%Y-%m-%d')
        elif app_dict.get(key) is not None:
            app_dict[key] = str(app_dict[key])

    days_since = calculate_days_since(app_dict.get('last_updated') or app_dict.get('date_applied'))
    app_dict['days_since_update'] = days_since
    app_dict['needs_followup'] = days_since >= 7 and app_dict['status'] in ['Applied', 'Interviewing']

    # Formatted display dates
    for key in ['interview_date', 'deadline_date', 'assessment_date', 'followup_date']:
        fmt_key = f"formatted_{key}"
        val = app_dict.get(key)
        if val:
            try:
                d = datetime.strptime(val, '%Y-%m-%d')
                app_dict[fmt_key] = d.strftime('%b %d, %Y')
            except ValueError:
                app_dict[fmt_key] = val
        else:
            app_dict[fmt_key] = None

    # Parse missing_skills JSON list
    raw_skills = app_dict.get('missing_skills')
    if raw_skills:
        try:
            app_dict['missing_skills_list'] = json.loads(raw_skills) if isinstance(raw_skills, str) else list(raw_skills)
        except Exception:
            app_dict['missing_skills_list'] = []
    else:
        app_dict['missing_skills_list'] = []

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

    # Upcoming interviews filter
    upcoming_interviews = [
        a for a in applications 
        if a['status'] == 'Interviewing' or a.get('interview_date')
    ]
    upcoming_interviews.sort(
        key=lambda x: x.get('interview_date') or x.get('last_updated') or '',
        reverse=False
    )

    today_str = date.today().strftime('%Y-%m-%d')

    return render_template('dashboard.html', 
                           grouped=grouped, 
                           counts=counts, 
                           today_str=today_str,
                           all_applications=applications,
                           upcoming_interviews=upcoming_interviews,
                           current_user=g.user)

@applications_bp.route('/api/calendar-events', methods=['GET'])
@login_required
def get_calendar_events():
    user_id = session['user_id']
    db = get_db()
    rows = db.execute('SELECT * FROM applications WHERE user_id = ?', (user_id,)).fetchall()
    events = []

    for r in rows:
        app = format_application_row(r)
        app_id = app['id']
        company = app['company_name']
        title = app['job_title']
        status = app['status']

        # 1. Date Applied Event
        if app.get('date_applied'):
            events.append({
                'app_id': app_id,
                'company_name': company,
                'job_title': title,
                'status': status,
                'event_type': status.lower(),
                'label': status,
                'date': app['date_applied']
            })

        # 2. Interview Date Event
        if app.get('interview_date'):
            events.append({
                'app_id': app_id,
                'company_name': company,
                'job_title': title,
                'status': 'Interviewing',
                'event_type': 'interviewing',
                'label': 'Interviewing',
                'date': app['interview_date']
            })

        # 3. Assessment Date Event
        if app.get('assessment_date'):
            events.append({
                'app_id': app_id,
                'company_name': company,
                'job_title': title,
                'status': 'Interviewing',
                'event_type': 'interviewing',
                'label': 'Interviewing',
                'date': app['assessment_date']
            })

    return jsonify(events)

@applications_bp.route('/api/analytics', methods=['GET'])
@login_required
def get_analytics():
    user_id = session['user_id']
    db = get_db()
    rows = db.execute('SELECT * FROM applications WHERE user_id = ?', (user_id,)).fetchall()
    applications = [format_application_row(r) for r in rows]

    total = len(applications)
    applied = sum(1 for a in applications if a['status'] == 'Applied')
    interviewing = sum(1 for a in applications if a['status'] == 'Interviewing')
    offered = sum(1 for a in applications if a['status'] == 'Offered')
    rejected = sum(1 for a in applications if a['status'] == 'Rejected')

    interview_rate = round((interviewing / total * 100), 1) if total > 0 else 0.0
    offer_rate = round((offered / total * 100), 1) if total > 0 else 0.0
    rejection_rate = round((rejected / total * 100), 1) if total > 0 else 0.0
    applied_rate = round((applied / total * 100), 1) if total > 0 else 0.0

    return jsonify({
        'total': total,
        'applied': applied,
        'interviewing': interviewing,
        'offered': offered,
        'rejected': rejected,
        'interview_rate': interview_rate,
        'offer_rate': offer_rate,
        'rejection_rate': rejection_rate,
        'applied_rate': applied_rate,
        'funnel': {
            'Applied': {'count': applied, 'percentage': applied_rate},
            'Interviewing': {'count': interviewing, 'percentage': interview_rate},
            'Offered': {'count': offered, 'percentage': offer_rate},
            'Rejected': {'count': rejected, 'percentage': rejection_rate}
        }
    })

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

import urllib.request
import re
from html.parser import HTMLParser

import json

class MetaTagParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta_tags = {}
        self.title = ""
        self.in_title = False
        self.h1_tags = []
        self.in_h1 = False
        self.current_h1 = ""
        self.json_ld_blocks = []
        self.in_json_ld = False
        self.current_json_ld = ""

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == 'meta':
            name = attrs_dict.get('property') or attrs_dict.get('name')
            content = attrs_dict.get('content')
            if name and content:
                self.meta_tags[name.lower()] = content.strip()
        elif tag == 'title':
            self.in_title = True
        elif tag == 'h1':
            self.in_h1 = True
            self.current_h1 = ""
        elif tag == 'script' and attrs_dict.get('type') == 'application/ld+json':
            self.in_json_ld = True
            self.current_json_ld = ""

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False
        elif tag == 'h1':
            self.in_h1 = False
            if self.current_h1.strip():
                self.h1_tags.append(self.current_h1.strip())
        elif tag == 'script' and self.in_json_ld:
            self.in_json_ld = False
            if self.current_json_ld.strip():
                self.json_ld_blocks.append(self.current_json_ld.strip())

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        if self.in_h1:
            self.current_h1 += data
        if self.in_json_ld:
            self.current_json_ld += data

def get_groq_api_key():
    api_key = os.environ.get('GROQ_API_KEY', '').strip()
    if not api_key:
        try:
            from flask import current_app, has_app_context
            if has_app_context():
                api_key = current_app.config.get('GROQ_API_KEY', '').strip()
        except Exception:
            pass
    return api_key

def extract_job_details_with_groq(html_content, domain=""):
    api_key = get_groq_api_key()
    if not api_key:
        return None

    clean_text = re.sub(r'<script.*?>.*?</script>', ' ', html_content, flags=re.DOTALL | re.IGNORECASE)
    clean_text = re.sub(r'<style.*?>.*?</style>', ' ', clean_text, flags=re.DOTALL | re.IGNORECASE)
    clean_text = re.sub(r'<[^>]+>', ' ', clean_text)
    clean_text = ' '.join(clean_text.split())

    text_snippet = clean_text[:6000]

    system_prompt = (
        "You are an expert job metadata extraction AI. "
        "Your task is to parse a job posting web page and extract details into JSON format.\n\n"
        "Return ONLY a single valid JSON object matching this schema:\n"
        "{\n"
        '  "company_name": "Company hiring (e.g. Stripe, Salesforce, Google)",\n'
        '  "job_title": "Exact position title (e.g. Software Engineer, Intern)",\n'
        '  "job_type": "One of: Internship, Full-time, Part-time, Contract, Other",\n'
        '  "location": "Exact location string (e.g. San Francisco, CA; Remote; Seattle, WA; Hybrid)",\n'
        '  "salary": "Salary or compensation if stated, else empty string",\n'
        '  "job_description": "Concise summary of job overview, key responsibilities, and qualifications (2-4 sentences)"\n'
        "}\n\n"
        "Rules:\n"
        "- Do NOT wrap JSON in extra markdown text. Output strictly valid JSON.\n"
        "- For job_type: set 'Internship' if the title or text mentions intern/co-op/student, else 'Full-time', 'Part-time', 'Contract', or 'Other'.\n"
        "- For location: carefully search the text for city, state, country, 'Remote', 'Hybrid', or office locations. If multiple, separate with commas."
    )

    model_opt = 'qwen/qwen3.8-27b'
    try:
        from flask import current_app, has_app_context
        if has_app_context():
            model_opt = current_app.config.get('GROQ_MODEL', 'qwen/qwen3.8-27b')
    except Exception:
        pass

    models_to_try = [
        model_opt,
        'qwen/qwen3.8-27b',
        'qwen/qwen3.6-27b',
        'openai/gpt-oss-20b'
    ]

    for model in models_to_try:
        groq_payload = json.dumps({
            'model': model,
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': f"Target Domain: {domain}\n\nJob Page Text:\n{text_snippet}"}
            ],
            'temperature': 0.1,
            'max_tokens': 400
        }).encode('utf-8')

        try:
            req = urllib.request.Request(
                'https://api.groq.com/openai/v1/chat/completions',
                data=groq_payload,
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                method='POST'
            )

            with urllib.request.urlopen(req, timeout=6) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                raw_json = res_data['choices'][0]['message']['content'].strip()
                
                if raw_json.startswith('```'):
                    raw_json = re.sub(r'^```(?:json)?\s*', '', raw_json)
                    raw_json = re.sub(r'\s*```$', '', raw_json)
                
                parsed = json.loads(raw_json)
                if isinstance(parsed, dict):
                    jt = str(parsed.get('job_type', 'Full-time')).strip()
                    if jt not in ['Full-time', 'Internship', 'Part-time', 'Contract', 'Other']:
                        jt = 'Internship' if 'intern' in str(parsed.get('job_title', '')).lower() else 'Full-time'
                    return {
                        'company_name': str(parsed.get('company_name', '')).strip(),
                        'job_title': str(parsed.get('job_title', '')).strip(),
                        'job_type': jt,
                        'location': str(parsed.get('location', '')).strip(),
                        'salary': str(parsed.get('salary', '')).strip(),
                        'job_description': str(parsed.get('job_description', '')).strip()
                    }
        except Exception as e:
            print(f"Groq Auto-Fill Extraction error with {model}: {e}")
            continue

    return None

def parse_url_job_details(url):
    company_name = ""
    job_title = ""
    job_type = "Full-time"
    location = ""
    salary = ""
    job_description = ""
    domain = ""

    try:
        from urllib.parse import urlparse
        domain = urlparse(url).netloc.lower()
        if 'linkedin.com' in domain:
            company_name = "LinkedIn"
        elif 'greenhouse.io' in domain:
            parts = [p for p in urlparse(url).path.split('/') if p]
            if parts:
                company_name = parts[0].replace('-', ' ').title()
        elif 'lever.co' in domain:
            parts = [p for p in urlparse(url).path.split('/') if p]
            if parts:
                company_name = parts[0].replace('-', ' ').title()
        elif 'myworkdayjobs.com' in domain:
            company_name = domain.split('.')[0].replace('-', ' ').title()
        else:
            base_domain = domain.replace('www.', '').split('.')[0]
            company_name = base_domain.capitalize()
    except Exception:
        pass

    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            html_content = response.read().decode('utf-8', errors='ignore')

        # 1. Try Groq AI Extraction first for 100% precision
        ai_extracted = extract_job_details_with_groq(html_content, domain)
        if ai_extracted and (ai_extracted.get('company_name') or ai_extracted.get('job_title')):
            return {
                'company_name': ai_extracted.get('company_name') or company_name,
                'job_title': ai_extracted.get('job_title') or job_title,
                'job_type': ai_extracted.get('job_type') or 'Full-time',
                'location': ai_extracted.get('location') or location,
                'salary': ai_extracted.get('salary') or salary,
                'job_description': ai_extracted.get('job_description') or ""
            }

        # 2. Fallback HTML Meta Tag / Regex Parsing
        parser = MetaTagParser()
        parser.feed(html_content)

        job_description = parser.meta_tags.get('og:description') or parser.meta_tags.get('description') or parser.meta_tags.get('twitter:description') or ""

        for block in parser.json_ld_blocks:
            try:
                data = json.loads(block)
                if isinstance(data, list):
                    data = data[0] if data else {}
                if isinstance(data, dict) and data.get('@type') == 'JobPosting':
                    if data.get('title'):
                        job_title = data['title'].strip()
                    if data.get('description'):
                        clean_desc = re.sub(r'<[^>]+>', ' ', str(data['description']))
                        job_description = ' '.join(clean_desc.split())[:1000]
                    if data.get('hiringOrganization'):
                        org = data['hiringOrganization']
                        if isinstance(org, dict) and org.get('name'):
                            company_name = org['name'].strip()
                        elif isinstance(org, str):
                            company_name = org.strip()
                    if data.get('jobLocation'):
                        loc_obj = data['jobLocation']
                        if isinstance(loc_obj, dict):
                            addr = loc_obj.get('address', {})
                            if isinstance(addr, dict):
                                parts = [addr.get('addressLocality'), addr.get('addressRegion'), addr.get('addressCountry')]
                                location = ", ".join([p for p in parts if p])
                            elif isinstance(addr, str):
                                location = addr
                        elif isinstance(loc_obj, str):
                            location = loc_obj
            except Exception:
                pass

        if not location:
            loc_label_match = re.search(r'Location\s*:\s*([^\n\r<]+)', html_content, re.IGNORECASE)
            if loc_label_match:
                extracted_loc = loc_label_match.group(1).strip()
                extracted_loc = re.sub(r'<[^>]+>', '', extracted_loc).strip()
                if extracted_loc and len(extracted_loc) < 80:
                    location = extracted_loc

        if not location:
            loc_match = re.search(r'(Remote|Hybrid|On-site|[A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z]{2})', html_content)
            if loc_match:
                location = loc_match.group(1)

        if not job_title and parser.h1_tags:
            for h in parser.h1_tags:
                if len(h) > 3 and not h.lower().endswith('jobs') and h.lower() != 'careers':
                    job_title = h
                    break
            if not job_title:
                job_title = parser.h1_tags[0]

        if not job_title:
            og_title = parser.meta_tags.get('og:title') or parser.meta_tags.get('twitter:title') or parser.title.strip()
            if og_title:
                cleaned_title = og_title
                if ' at ' in cleaned_title:
                    parts = cleaned_title.split(' at ')
                    job_title = parts[0].strip()
                    if not company_name or company_name == 'LinkedIn':
                        company_name = parts[1].split('-')[0].split('|')[0].strip()
                elif ' - ' in cleaned_title:
                    parts = cleaned_title.split(' - ')
                    job_title = parts[0].strip()
                    if len(parts) > 1 and not company_name:
                        company_name = parts[1].strip()
                elif ' | ' in cleaned_title:
                    parts = cleaned_title.split(' | ')
                    job_title = parts[0].strip()
                    if len(parts) > 1 and not company_name:
                        company_name = parts[1].strip()
                else:
                    job_title = cleaned_title

        if not job_title and parser.title:
            clean_t = parser.title.strip()
            for sep in [' | ', ' - ', ' at ']:
                if sep in clean_t:
                    parts = clean_t.split(sep)
                    job_title = parts[0].strip()
                    if len(parts) > 1 and not company_name:
                        company_name = parts[1].strip()
                    break
            if not job_title:
                job_title = clean_t

        if job_title.lower().endswith('jobs') and parser.h1_tags:
            for h in parser.h1_tags:
                if not h.lower().endswith('jobs') and h.lower() != 'careers':
                    job_title = h
                    break

        og_site = parser.meta_tags.get('og:site_name') or parser.meta_tags.get('twitter:site')
        if og_site:
            company_name = og_site

        sal_match = re.search(r'(\$[\d,]+\s*(?:-|to)\s*\$[\d,]+|\$[\d,]+(?:\/yr|\/hr)?|₹\d+(?:\.\d+)?\s*(?:LPA|Lacs|Lakhs))', html_content, re.IGNORECASE)
        if sal_match:
            salary = sal_match.group(1)

    except Exception as e:
        print(f"URL fetch error: {e}")

    if not job_title:
        # Fallback URL Slug parsing
        try:
            from urllib.parse import urlparse
            path_parts = [p for p in urlparse(url).path.split('/') if p and not p.isdigit() and len(p) > 3]
            if path_parts:
                last_slug = path_parts[-1].replace('-', ' ').replace('_', ' ')
                if any(k in last_slug.lower() for k in ['engineer', 'developer', 'analyst', 'manager', 'intern', 'specialist', 'associate', 'lead', 'designer']):
                    job_title = last_slug.title()
        except Exception:
            pass

    if 'intern' in job_title.lower() or 'co-op' in job_title.lower() or 'intern' in url.lower():
        job_type = 'Internship'

    return {
        'company_name': company_name,
        'job_title': job_title,
        'job_type': job_type,
        'location': location,
        'salary': salary,
        'job_description': job_description
    }

@applications_bp.route('/api/autofill-url', methods=['POST'])
@login_required
def autofill_url():
    data = request.get_json() or {}
    url = data.get('url', '').strip()
    if not url:
        return jsonify({'error': 'Please provide a valid URL.'}), 400

    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    extracted = parse_url_job_details(url)
    return jsonify({
        'success': True,
        'company_name': extracted.get('company_name', ''),
        'job_title': extracted.get('job_title', ''),
        'job_type': extracted.get('job_type', 'Full-time'),
        'location': extracted.get('location', ''),
        'salary': extracted.get('salary', ''),
        'notes': extracted.get('job_description', '')
    })

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
    interview_date = data.get('interview_date', '').strip() or None
    deadline_date = None
    assessment_date = data.get('assessment_date', '').strip() or None
    followup_date = None
    job_url = data.get('job_url', '').strip() or None
    salary = data.get('salary', '').strip() or None
    location = data.get('location', '').strip() or None
    job_type = data.get('job_type', 'Full-time').strip() or 'Full-time'
    resume_version = data.get('resume_version', '').strip() or None

    if not company_name or not job_title:
        return jsonify({'error': 'Company name and job title are required.'}), 400

    if status not in VALID_STATUSES:
        return jsonify({'error': f'Invalid status. Must be one of {VALID_STATUSES}'}), 400

    last_updated = date.today().strftime('%Y-%m-%d')

    db = get_db()
    
    # Check if user has resume_text to compute fit_score
    user_row = db.execute('SELECT resume_text FROM users WHERE id = ?', (user_id,)).fetchone()
    resume_text = user_row['resume_text'] if user_row and user_row['resume_text'] else ''
    
    fit_score = None
    missing_skills_str = None
    if resume_text:
        jd_text = notes or f"{company_name} {job_title} {location or ''} {job_type}"
        from services.groq_service import compute_fit_score
        fit_score, skills_list = compute_fit_score(jd_text, resume_text)
        if skills_list:
            missing_skills_str = json.dumps(skills_list)

    cursor = db.execute(
        'INSERT INTO applications (user_id, company_name, job_title, status, date_applied, last_updated, notes, interview_date, deadline_date, assessment_date, followup_date, job_url, salary, location, job_type, resume_version, fit_score, missing_skills) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (user_id, company_name, job_title, status, date_applied, last_updated, notes, interview_date, deadline_date, assessment_date, followup_date, job_url, salary, location, job_type, resume_version, fit_score, missing_skills_str)
    )
    db.commit()

    new_id = cursor.lastrowid
    row = db.execute('SELECT * FROM applications WHERE id = ? AND user_id = ?', (new_id, user_id)).fetchone()
    new_app = format_application_row(row)

    if request.is_json:
        return jsonify(new_app), 201
    return redirect(url_for('applications.index'))

@applications_bp.route('/applications/<int:app_id>', methods=['GET'])
@login_required
def get_application_details(app_id):
    user_id = session['user_id']
    db = get_db()
    row = db.execute('SELECT * FROM applications WHERE id = ? AND user_id = ?', (app_id, user_id)).fetchone()
    if not row:
        return jsonify({'error': 'Application not found'}), 404
    return jsonify(format_application_row(row))

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
    
    interview_date = data.get('interview_date', existing_dict.get('interview_date'))
    if interview_date is not None:
        interview_date = str(interview_date).strip() or None

    deadline_date = None

    assessment_date = data.get('assessment_date', existing_dict.get('assessment_date'))
    if assessment_date is not None:
        assessment_date = str(assessment_date).strip() or None

    followup_date = None

    job_url = data.get('job_url', existing_dict.get('job_url'))
    if job_url is not None:
        job_url = str(job_url).strip() or None

    salary = data.get('salary', existing_dict.get('salary'))
    if salary is not None:
        salary = str(salary).strip() or None

    location = data.get('location', existing_dict.get('location'))
    if location is not None:
        location = str(location).strip() or None

    job_type = data.get('job_type', existing_dict.get('job_type', 'Full-time'))
    if job_type is not None:
        job_type = str(job_type).strip() or 'Full-time'

    resume_version = data.get('resume_version', existing_dict.get('resume_version'))
    if resume_version is not None:
        resume_version = str(resume_version).strip() or None

    if status not in VALID_STATUSES:
        return jsonify({'error': f'Invalid status. Must be one of {VALID_STATUSES}'}), 400

    last_updated = date.today().strftime('%Y-%m-%d')

    # Re-calculate fit_score if notes or job_url changed or fit_score is missing
    fit_score = existing_dict.get('fit_score')
    missing_skills_str = existing_dict.get('missing_skills')

    user_row = db.execute('SELECT resume_text FROM users WHERE id = ?', (user_id,)).fetchone()
    resume_text = user_row['resume_text'] if user_row and user_row['resume_text'] else ''

    if resume_text and (notes != (existing_dict['notes'] or '') or job_url != existing_dict.get('job_url') or fit_score is None):
        jd_text = notes or f"{company_name} {job_title} {location or ''} {job_type}"
        from services.groq_service import compute_fit_score
        fit_score, skills_list = compute_fit_score(jd_text, resume_text)
        if skills_list:
            missing_skills_str = json.dumps(skills_list)
        else:
            missing_skills_str = None

    db.execute(
        'UPDATE applications SET company_name = ?, job_title = ?, status = ?, date_applied = ?, last_updated = ?, notes = ?, interview_date = ?, deadline_date = ?, assessment_date = ?, followup_date = ?, job_url = ?, salary = ?, location = ?, job_type = ?, resume_version = ?, fit_score = ?, missing_skills = ? WHERE id = ? AND user_id = ?',
        (company_name, job_title, status, date_applied, last_updated, notes, interview_date, deadline_date, assessment_date, followup_date, job_url, salary, location, job_type, resume_version, fit_score, missing_skills_str, app_id, user_id)
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


