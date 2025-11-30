import { createClient } from '@supabase/supabase-js';
import { env } from '../env';

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase credentials');
}

export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const DEFAULT_BUCKET = 'video-assets';

export async function uploadFile(
  path: string,
  fileBody: Buffer | ArrayBuffer | Blob | string,
  contentType?: string,
  bucketName: string = DEFAULT_BUCKET
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(path, fileBody, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return null;
    }

    return data.path;
  } catch (err) {
    console.error('Unexpected error uploading file:', err);
    return null;
  }
}

export function getPublicUrl(path: string, bucketName: string = DEFAULT_BUCKET): string {
  const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
  return data.publicUrl;
}

export async function getSignedUrl(path: string, bucketName: string = DEFAULT_BUCKET): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(path, 60 * 60); // 1 hour expiry

    if (error) {
      console.error('Supabase signed URL error:', error);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error('Unexpected error getting signed URL:', err);
    return null;
  }
}

export async function downloadFile(path: string, bucketName: string = DEFAULT_BUCKET): Promise<Buffer | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(path);

    if (error) {
      console.error('Supabase download error:', error);
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error('Unexpected error downloading file:', err);
    return null;
  }
}
