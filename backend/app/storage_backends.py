import os
from django.conf import settings
from django.core.files.storage import FileSystemStorage

try:
    from storages.backends.s3boto3 import S3Boto3Storage
except ImportError:
    S3Boto3Storage = None


class MediaStorage(S3Boto3Storage if S3Boto3Storage else FileSystemStorage):
    """
    Storage class for user-uploaded academic files (outlines, progress reports, thesis drafts, chat attachments).
    Supports Cloudflare R2, AWS S3, MinIO, or falls back to local FileSystemStorage.
    """
    location = getattr(settings, 'AWS_LOCATION', 'media')
    file_overwrite = False
    default_acl = None
    custom_domain = getattr(settings, 'AWS_S3_CUSTOM_DOMAIN', None)
    querystring_auth = getattr(settings, 'AWS_QUERYSTRING_AUTH', False)
    querystring_expire = getattr(settings, 'AWS_QUERYSTRING_EXPIRE', 3600)

    def url(self, name):
        """
        Always return relative /media/<name> so all download requests route
        through Django's SecureMediaDownloadView (enforcing JWT authentication,
        audit logs, and RBAC permissions).
        """
        clean_name = str(name).replace('\\', '/').lstrip('/')
        if clean_name.startswith('media/'):
            clean_name = clean_name[len('media/'):]
        return f"/media/{clean_name}"


def get_media_storage():
    """
    Dynamically returns the active storage instance based on configuration.
    """
    if getattr(settings, 'USE_S3', False) and getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None) and S3Boto3Storage:
        return MediaStorage()
    return FileSystemStorage(location=settings.MEDIA_ROOT, base_url=settings.MEDIA_URL)


def is_cloud_storage_active():
    """
    Returns True if cloud object storage (Cloudflare R2 / AWS S3) is enabled and active.
    """
    return bool(getattr(settings, 'USE_S3', False) and getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None) and S3Boto3Storage)
