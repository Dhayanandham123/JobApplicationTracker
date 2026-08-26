from services.email_service import send_followup_email

if __name__ == '__main__':
    print("Testing follow-up email dispatch...")
    success, message = send_followup_email(
        receiver_email="717823i161@kce.ac.in",
        company="Google",
        job_title="Software Engineer Intern"
    )
    print(f"Result: {success} - {message}")