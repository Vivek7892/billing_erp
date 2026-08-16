"""Small, server-side wrapper for persistent shop-logo storage."""
from pathlib import Path
from uuid import uuid4

from django.conf import settings


class SupabaseStorageError(Exception):
    pass


def upload_shop_logo(uploaded_file, business_id):
    if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
        raise SupabaseStorageError('Logo storage is not configured. Contact your administrator.')
    try:
        from supabase import create_client

        extension = Path(uploaded_file.name).suffix.lower() or '.png'
        object_name = f"businesses/{business_id}/{uuid4().hex}{extension}"
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SECRET_KEY)
        bucket = client.storage.from_(settings.SUPABASE_SHOP_LOGO_BUCKET)
        bucket.upload(
            object_name,
            uploaded_file.read(),
            file_options={'content-type': uploaded_file.content_type or 'image/png', 'upsert': 'false'},
        )
        return bucket.get_public_url(object_name)
    except SupabaseStorageError:
        raise
    except Exception as exc:
        raise SupabaseStorageError('Could not upload the logo. Please try again.') from exc
