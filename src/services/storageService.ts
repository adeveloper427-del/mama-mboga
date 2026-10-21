/**
 * Image upload to Supabase Storage. Each user may only write inside their own
 * folder (`<bucket>/<user id>/...`), enforced by storage policies; buckets are
 * public-read so product and shop photos load without signing.
 */
import { supabase } from '@/backend/supabase';

import { fail, request } from './api';
import { requireUser } from './session';

export type ImageBucket = 'products' | 'shops' | 'avatars';

const MAX_BYTES = 5 * 1024 * 1024;

export interface PickedImage {
  uri: string;
  fileSize?: number;
  mimeType?: string;
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };

export async function uploadImage(image: PickedImage, bucket: ImageBucket): Promise<string> {
  return request(async () => {
    const me = requireUser();
    if (image.fileSize && image.fileSize > MAX_BYTES) fail('validation', 'That photo is too large. Choose one under 5 MB.');
    const type = image.mimeType ?? 'image/jpeg';
    if (!EXT[type]) fail('validation', 'Choose a JPG, PNG or WEBP photo.');

    const body = await (await fetch(image.uri)).arrayBuffer();
    if (body.byteLength > MAX_BYTES) fail('validation', 'That photo is too large. Choose one under 5 MB.');
    const path = `${me.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXT[type]}`;
    const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: type, upsert: false });
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  });
}
