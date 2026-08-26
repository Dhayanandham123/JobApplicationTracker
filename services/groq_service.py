import json
import re
import urllib.request
import logging
from flask import current_app

logger = logging.getLogger(__name__)

def compute_fit_score(jd_text, resume_text):
    """
    Sends job description (jd_text) and candidate resume (resume_text) to Groq AI API
    and requests STRICT JSON output:
    {"fit_score": <0-100 int>, "missing_skills": ["skill1", "skill2", ...]}
    Handles errors gracefully by returning (None, []).
    """
    if not jd_text or not resume_text:
        return None, []

    api_key = current_app.config.get('GROQ_API_KEY', '').strip() if current_app else ''
    if not api_key:
        logger.warning("Missing GROQ_API_KEY for compute_fit_score")
        return None, []

    system_prompt = (
        "You are an expert ATS (Applicant Tracking System) & technical resume recruiter.\n"
        "Compare the candidate's Resume against the Job Description (JD) text.\n"
        "Assess match quality and return STRICT JSON with exact structure:\n"
        "{\n"
        '  "fit_score": <integer from 0 to 100 representing overall percentage match>,\n'
        '  "missing_skills": ["List", "of", "3-6", "key", "required", "skills", "technologies", "or", "qualifications", "missing", "or", "weak", "in", "resume"]\n'
        "}\n\n"
        "Rules:\n"
        "- Do NOT include any intro or conversational text. Output ONLY valid JSON.\n"
        "- fit_score must be an integer between 0 and 100.\n"
        "- missing_skills must be a JSON list of concise strings (e.g. ['Kubernetes', 'AWS', 'System Design'])."
    )

    user_prompt = f"JOB DESCRIPTION:\n{jd_text[:4000]}\n\nCANDIDATE RESUME:\n{resume_text[:4000]}"

    models_to_try = [
        current_app.config.get('GROQ_MODEL', 'qwen/qwen3.8-27b') if current_app else 'qwen/qwen3.8-27b',
        'qwen/qwen3.8-27b',
        'qwen/qwen3.6-27b',
        'openai/gpt-oss-20b'
    ]

    for model in models_to_try:
        groq_payload = json.dumps({
            'model': model,
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt}
            ],
            'temperature': 0.1,
            'max_tokens': 300,
            'response_format': {'type': 'json_object'}
        }).encode('utf-8')

        try:
            req = urllib.request.Request(
                'https://api.groq.com/openai/v1/chat/completions',
                data=groq_payload,
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                },
                method='POST'
            )

            with urllib.request.urlopen(req, timeout=8) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                raw_content = res_data['choices'][0]['message']['content'].strip()

                if raw_content.startswith('```'):
                    raw_content = re.sub(r'^```(?:json)?\s*', '', raw_content)
                    raw_content = re.sub(r'\s*```$', '', raw_content)

                parsed = json.loads(raw_content)
                if isinstance(parsed, dict):
                    raw_score = parsed.get('fit_score')
                    try:
                        fit_score = int(raw_score)
                        fit_score = max(0, min(100, fit_score))
                    except (ValueError, TypeError):
                        fit_score = None

                    raw_skills = parsed.get('missing_skills', [])
                    if isinstance(raw_skills, list):
                        missing_skills = [str(s).strip() for s in raw_skills if str(s).strip()][:8]
                    else:
                        missing_skills = []

                    return fit_score, missing_skills

        except Exception as e:
            logger.error(f"Groq compute_fit_score error with {model}: {e}")
            continue

    return None, []
