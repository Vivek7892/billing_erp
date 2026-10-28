"""Small, server-side wrapper for persistent shop-logo storage."""
from pathlib import Path
from uuid import uuid4
from urllib.parse import quote

from django.conf import settings
import httpx


class SupabaseStorageError(Exception):
    pass


def upload_shop_logo(uploaded_file, business_id):
    """Upload shop logo to Supabase Storage and return its public URL."""
    url = getattr(settings, 'SUPABASE_URL', '').strip()
    key = getattr(settings, 'SUPABASE_SECRET_KEY', '').strip()
    bucket_name = getattr(settings, 'SUPABASE_SHOP_LOGO_BUCKET', 'shop-logos').strip()

    if not url or not key:
        raise SupabaseStorageError(
            'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY in your .env file.'
        )

    extension = Path(uploaded_file.name).suffix.lower() or '.png'
    object_name = f"businesses/{business_id}/{uuid4().hex}{extension}"
    base_url = url.rstrip('/')
    bucket = quote(bucket_name, safe='')
    object_path = quote(object_name, safe='/')

    headers = {
        'Authorization': f'Bearer {key}',
        'apikey': key,
        'Content-Type': uploaded_file.content_type or 'image/png',
        'x-upsert': 'true',
    }

    try:
        response = httpx.post(
            f'{base_url}/storage/v1/object/{bucket}/{object_path}',
            headers=headers,
            content=uploaded_file.read(),
            timeout=30,
        )
    except Exception as exc:
        raise SupabaseStorageError(f'Network error uploading logo: {exc}') from exc

    if response.status_code == 401:
        raise SupabaseStorageError(
            'Invalid Supabase key (401). Go to Supabase Dashboard → Settings → API '
            'and copy the service_role secret key into SUPABASE_SECRET_KEY in your .env.'
        )
    if response.status_code == 403:
        raise SupabaseStorageError(
            f'Bucket "{bucket_name}" access denied (403). Make sure the bucket exists '
            'and the service_role key has storage permissions.'
        )
    if response.status_code == 404:
        raise SupabaseStorageError(
            f'Bucket "{bucket_name}" not found (404). Create it in Supabase Dashboard → Storage.'
        )

    if not response.is_success:
        raise SupabaseStorageError(
            f'Supabase upload failed ({response.status_code}): {response.text[:200]}'
        )

    return f'{base_url}/storage/v1/object/public/{bucket}/{object_path}'
