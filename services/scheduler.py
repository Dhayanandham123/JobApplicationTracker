import threading
import time
import logging
from services.email_service import process_automated_stale_reminders

logger = logging.getLogger(__name__)

_scheduler_started = False
_lock = threading.Lock()

def start_email_scheduler(app, check_interval_seconds=3600):
    global _scheduler_started
    with _lock:
        if _scheduler_started:
            return
        _scheduler_started = True

    def run_loop():
        logger.info("Email follow-up background scheduler started.")
        # Delay initial run slightly to allow app to fully initialize
        time.sleep(5)
        while True:
            try:
                with app.app_context():
                    sent_count = process_automated_stale_reminders()
                    if sent_count > 0:
                        logger.info(f"Automated scheduler sent {sent_count} follow-up reminder email(s).")
            except Exception as e:
                logger.error(f"Error in email background scheduler: {e}")
            
            time.sleep(check_interval_seconds)

    thread = threading.Thread(target=run_loop, daemon=True)
    thread.start()
