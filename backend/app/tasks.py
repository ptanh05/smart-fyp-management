import logging
import threading
try:
    from celery import shared_task
except ImportError:
    def shared_task(*args, **kwargs):
        def decorator(f):
            return f
        if len(args) == 1 and callable(args[0]):
            return args[0]
        return decorator
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

    Yêu cầu: API phải phản hồi nhanh (< 1s) vì có thể đang chạy sau reverse proxy
    với timeout 504. Vì vậy ta KHÔNG gọi `task.delay()` đồng bộ (Celery sẽ block
    khi Redis không sẵn sàng, gây timeout 19-30 giây), mà luôn chạy nền bằng
    daemon thread. Worker Celery có thể xử lý phần gửi email qua task riêng.
    """
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


@shared_task(ignore_result=True)
def send_deadline_reminders_task():
    """Nhắc SV các task sắp tới hạn (D-3, D-1) hoặc quá hạn, đồng thời quét quá hạn giai đoạn. Chạy hằng ngày qua Celery beat."""
    from .feature_services import send_deadline_reminders
    from .utils.stage_deadline_enforcement import enforce_all_active_batches_stage_deadlines

    sent = send_deadline_reminders()
    try:
        summary = enforce_all_active_batches_stage_deadlines()
        logger.info(
            "[STAGE_DEADLINE_ENFORCE] scanned=%s removed=%s",
            summary.get("scanned_batches", 0),
            summary.get("total_removed", 0),
        )
    except Exception as exc:
        logger.warning("[STAGE_DEADLINE_ENFORCE] error=%s", exc)
    logger.info("[DEADLINE_REMINDER] sent=%s", sent)
    return sent


@shared_task(ignore_result=True)
def enforce_stage_deadlines_task():
    """Task riêng quét quá hạn GĐ2–GĐ5 trên toàn bộ các đợt đang mở."""
    from .utils.stage_deadline_enforcement import enforce_all_active_batches_stage_deadlines

    return enforce_all_active_batches_stage_deadlines()
