import json
import urllib.request
from flask import Blueprint, request, jsonify, session, current_app
from routes.auth import login_required
from database.db import get_db
from routes.applications import format_application_row

chatbot_bp = Blueprint('chatbot', __name__)

@chatbot_bp.route('/api/chat', methods=['POST'])
@login_required
def chat():
    user_id = session.get('user_id')
    data = request.get_json() or {}
    user_message = data.get('message', '').strip()
    history = data.get('history', [])

    if not user_message:
        return jsonify({'error': 'Please provide a message.'}), 400

    api_key = current_app.config.get('GROQ_API_KEY', '').strip()

    if not api_key:
        fallback_msg = (
            "**Groq API Key Required**\n\n"
            "To activate your AI Career Assistant powered by **Qwen 2.5 (`qwen-2.5-32b`)**, please add your Groq API key to the `.env` file:\n"
            "```env\nGROQ_API_KEY=gsk_your_actual_key_here\n```\n\n"
            "**How to get a FREE key (1 minute):**\n"
            "1. Visit [console.groq.com/keys](https://console.groq.com/keys)\n"
            "2. Sign in with Google / GitHub\n"
            "3. Click **Create API Key** and copy your `gsk_...` key\n"
            "4. Paste it in `.env` and restart the server!"
        )
        return jsonify({
            'reply': fallback_msg,
            'api_key_missing': True
        })

    # Fetch User's Applications to build real-time context
    db = get_db()
    rows = db.execute('SELECT * FROM applications WHERE user_id = ? ORDER BY last_updated DESC', (user_id,)).fetchall()
    apps = [format_application_row(r) for r in rows]

    app_context_lines = []
    for a in apps:
        line = f"- {a['company_name']} ({a['job_title']}): Status={a['status']}"
        if a.get('formatted_interview_date'):
            line += f", Interview={a['formatted_interview_date']}"
        if a.get('location'):
            line += f", Location={a['location']}"
        if a.get('salary'):
            line += f", Salary={a['salary']}"
        app_context_lines.append(line)

    app_context_str = "\n".join(app_context_lines) if app_context_lines else "No applications logged yet."

    system_prompt = (
        "You are an expert AI Career Coach & Interview Assistant embedded in the 'Job & Internship Tracker' app. "
        "Your goal is to empower the user in their job search, interview preparation, resume tuning, and follow-up emails.\n\n"
        "Here is the user's real-time job application portfolio:\n"
        f"{app_context_str}\n\n"
        "Guidelines:\n"
        "1. Be direct, encouraging, practical, and highly relevant to their target companies and roles.\n"
        "2. When asked about interview prep, tailor questions specifically to the roles and companies in their tracker.\n"
        "3. Keep formatting clean with markdown, bullet points, and bold emphasis where helpful.\n"
        "4. If writing email templates, include placeholders like [Recruiter Name]."
    )

    # Build full messages payload
    messages = [{'role': 'system', 'content': system_prompt}]
    for msg in history[-6:]:  # include up to last 6 turns for context
        if isinstance(msg, dict) and msg.get('role') in ('user', 'assistant') and msg.get('content'):
            messages.append({'role': msg['role'], 'content': msg['content']})

    messages.append({'role': 'user', 'content': user_message})

    configured_model = current_app.config.get('GROQ_MODEL', 'qwen/qwen3.8-27b')
    models_to_try = [configured_model]
    for m in ['qwen/qwen3.8-27b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-20b']:
        if m not in models_to_try:
            models_to_try.append(m)

    last_error_msg = ""
    for model_name in models_to_try:
        groq_payload = json.dumps({
            'model': model_name,
            'messages': messages,
            'temperature': 0.7,
            'max_tokens': 1024
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

            with urllib.request.urlopen(req, timeout=12) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                reply = res_data['choices'][0]['message']['content']
                return jsonify({'reply': reply, 'model': model_name})

        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8', errors='ignore')
            print(f"Groq API Error for model {model_name} ({e.code}): {error_body}")
            last_error_msg = error_body
            if e.code == 401:
                return jsonify({
                    'reply': "**Invalid Groq API Key**. Please check your `GROQ_API_KEY` in `.env` and verify it starts with `gsk_`."
                })
            # If 400 bad model, loop to try next fallback model in list
            continue
        except Exception as e:
            print(f"Chatbot Exception for model {model_name}: {e}")
            last_error_msg = str(e)
            continue

    return jsonify({
        'reply': f"Groq API Error. Details: {last_error_msg[:120] if last_error_msg else 'Could not query Groq AI model.'}"
    })
