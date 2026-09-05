import { supabase } from './supabase'

const BUCKET = 'shop-logos'

/**
 * Uploads a logo file to Supabase Storage and returns the public URL.
 *
 * SUPABASE SETUP (run once in Supabase SQL Editor):
 * -------------------------------------------------
 * -- 1. Allow anyone to upload to shop-logos bucket
 * CREATE POLICY "allow_public_upload"
 * ON storage.objects FOR INSERT
 * TO anon
 * WITH CHECK (bucket_id = 'shop-logos');
 *
 * -- 2. Allow anyone to update (upsert) existing logos
 * CREATE POLICY "allow_public_update"
 * ON storage.objects FOR UPDATE
 * TO anon
 * USING (bucket_id = 'shop-logos');
 *
 * -- 3. Allow anyone to read logos (needed for public URLs)
 * CREATE POLICY "allow_public_read"
 * ON storage.objects FOR SELECT
 * TO anon
 * USING (bucket_id = 'shop-logos');
 * -------------------------------------------------
 */
export async function uploadLogoToSupabase(file, shopId = 'default') {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your .env file.'
    )
  }

  const ext = file.name.split('.').pop().toLowerCase()
  const path = `${shopId}/logo.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: '3600',
    })

  if (error) {
    if (error.message?.toLowerCase().includes('row-level security') ||
        error.message?.toLowerCase().includes('policy') ||
        error.statusCode === '403' ||
        error.error === 'Unauthorized') {
      throw new Error(
        'Storage permission denied. In Supabase → SQL Editor, run:\n\n' +
        "CREATE POLICY \"allow_public_upload\" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'shop-logos');\n" +
        "CREATE POLICY \"allow_public_update\" ON storage.objects FOR UPDATE TO anon USING (bucket_id = 'shop-logos');"
      )
    }
    throw new Error(error.message)
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}`
}
