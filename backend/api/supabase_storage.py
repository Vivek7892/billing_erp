"""Small, server-side wrapper for persistent shop-logo storage."""
from pathlib import Path
from uuid import uuid4
from urllib.parse import quote

from django.conf import settings
import httpx


class SupabaseStorageError(Exception):
    pass


def upload_shop_logo(uploaded_file, business_id):
    if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
        raise SupabaseStorageError('Logo storage is not configured. Contact your administrator.')
    try:
        extension = Path(uploaded_file.name).suffix.lower() or '.png'
        object_name = f"businesses/{business_id}/{uuid4().hex}{extension}"
        base_url = settings.SUPABASE_URL.rstrip('/')
        bucket = quote(settings.SUPABASE_SHOP_LOGO_BUCKET, safe='')
        object_path = quote(object_name, safe='/')
        headers = {
            'Authorization': f'Bearer {settings.SUPABASE_SECRET_KEY}',
            'apikey': settings.SUPABASE_SECRET_KEY,
            'Content-Type': uploaded_file.content_type or 'image/png',
            'x-upsert': 'false',
        }
        response = httpx.post(
            f'{base_url}/storage/v1/object/{bucket}/{object_path}',
            headers=headers,
            content=uploaded_file.read(),
            timeout=30,
        )
        if response.status_code in (401, 403):
            raise SupabaseStorageError(
                'Logo storage credentials are invalid or not authorized for this bucket.'
            )
        response.raise_for_status()
        return f'{base_url}/storage/v1/object/public/{bucket}/{object_path}'
    except SupabaseStorageError:
        raise
    except Exception as exc:
        if 'invalid api key' in str(exc).lower():
            raise SupabaseStorageError(
                'Logo storage credentials are invalid. Configure a valid '
                'Supabase service-role key on the backend.'
            ) from exc
        raise SupabaseStorageError('Could not upload the logo. Please try again.') from exc
