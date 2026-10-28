import logging
import threading
from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_async_notification_task(
    self,
    recipient_user_ids,
    title,
    message,
    notification_type="general",
    action_url="",
    send_email=True
):
    """
    Celery task to asynchronously create in-app notifications and send emails.
    """
    from django.db import connection
    from .models import CustomUser
    from .services import NotificationService

    try:
        users = list(CustomUser.objects.filter(id__in=recipient_user_ids))
        for user in users:
            NotificationService.create_notification(
                user=user,
                notification_type=notification_type,
                title=title,
                message=message,
                action_url=action_url,
                send_email=send_email
            )
        logger.info("[CELERY_NOTIF] Sent %d notifications: %s", len(users), title)
        return {"status": "success", "count": len(users)}
    except Exception as exc:
        logger.warning("[CELERY_NOTIF] Task error: %s. Retrying...", exc)
        try:
            raise self.retry(exc=exc)
        except Exception:
            logger.error("[CELERY_NOTIF] Task failed completely: %s", exc)
            return {"status": "error", "error": str(exc)}
    finally:
        connection.close()


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def send_bulk_email_task(self, recipient_emails, subject, body_text):
    """
    Celery task to dispatch bulk emails without blocking web requests.
    """
    from django.core.mail import send_mail

    try:
        sent_count = 0
        for email in recipient_emails:
            if email and "@" in email:
                send_mail(
                    subject=subject,
                    message=body_text,
                    from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@utc.edu.vn"),
                    recipient_list=[email],
                    fail_silently=True
                )
                sent_count += 1
        logger.info("[CELERY_EMAIL] Dispatched %d emails for subject: %s", sent_count, subject)
        return {"status": "success", "sent_count": sent_count}
    except Exception as exc:
        logger.warning("[CELERY_EMAIL] Error sending bulk email: %s", exc)
        raise self.retry(exc=exc)


def dispatch_async_notification(recipient_user_ids, title, message, notification_type="general", action_url="", send_email=True):
    """
    Dispatches notification via Celery if available, or gracefully falls back to a background thread.
    """
    try:
        # Try Celery delay first
        send_async_notification_task.delay(
            recipient_user_ids=recipient_user_ids,
            title=title,
            message=message,
            notification_type=notification_type,
            action_url=action_url,
            send_email=send_email
        )
        return True
    except Exception as exc:
        # Graceful fallback to background thread (dev / test environment without Redis)
        logger.debug("[TASK_FALLBACK] Celery broker unavailable (%s), running via daemon thread", exc)
        
        def _fallback_runner():
            from django.db import connection
            connection.close()
            try:
                from .models import CustomUser
                from .services import NotificationService
                users = list(CustomUser.objects.filter(id__in=recipient_user_ids))
                for u in users:
                    NotificationService.create_notification(
                        user=u,
                        notification_type=notification_type,
                        title=title,
                        message=message,
                        action_url=action_url,
                        send_email=send_email
                    )
            except Exception as thread_exc:
                logger.warning("[THREAD_NOTIF_FALLBACK] Failed: %s", thread_exc)
            finally:
                connection.close()

        thread = threading.Thread(target=_fallback_runner, daemon=True)
        thread.start()
        return True
