import { supabase } from "@/integrations/supabase/client";
import { uploadLimiter, isRateLimited } from "@/lib/security";

export type BucketName = 'avatars' | 'covers' | 'posts' | 'stories' | 'marketplace' | 'events' | 'circles' | 'lost-found' | 'chat' | 'videos';

/**
 * CLOUDINARY CONFIG
 * Sourced from environment variables with hardcoded fallbacks.
 * CLOUD_NAME and UPLOAD_PRESET are not secrets — they are public identifiers
 * required for unsigned uploads. The upload preset on Cloudinary must be set
 * to "unsigned" with strict allowed file types and size limits configured
 * in the Cloudinary dashboard.
 */
// ⚠️ HARDCODED DEFAULTS: Use these if ENV vars are missing or invalid (dq9kqhji0 / alliance_preset)
const DEFAULT_CLOUD = "dq9kqhji0";
const DEFAULT_PRESET = "alliance_preset";

const CLOUD_NAME = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME && import.meta.env.VITE_CLOUDINARY_CLOUD_NAME !== "undefined")
  ? import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  : DEFAULT_CLOUD;
const UPLOAD_PRESET = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET && import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET !== "undefined")
  ? import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  : DEFAULT_PRESET;

/** Max file size: 100MB (Support for high-quality videos) */
const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024;

/** Allowed MIME types for uploads */
const ALLOWED_UPLOAD_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime'
]);

/**
 * Helper: Hyper-optimized image compression for mobile feeds.
 */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  if (file.size < 200 * 1024) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(file);

      const MAX_SIZE = 1080;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
      } else {
        if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (!blob) return resolve(file);
        const fileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
        const compressedFile = new File([blob], fileName, {
          type: 'image/webp',
          lastModified: Date.now()
        });
        resolve(compressedFile);
      }, 'image/webp', 0.75);
    };

    img.onerror = () => resolve(file);
    img.src = url;
  });
}

/**
 * Uploads to Cloudinary instead of Supabase Storage.
 * Saves your 1GB Supabase limit!
 */
export async function uploadFile(
  bucket: BucketName,
  file: File,
  userId: string
): Promise<{ url: string | null; error: Error | null }> {
  try {
    // SECURITY: Rate limit uploads (10 per 5 minutes)
    if (isRateLimited(uploadLimiter, 'file_upload')) {
      return { url: null, error: new Error('Upload rate limited. Please wait.') };
    }

    // SECURITY: Validate file size
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return { url: null, error: new Error(`File too large (max ${MAX_UPLOAD_SIZE_BYTES / 1024 / 1024}MB)`) };
    }

    // SECURITY: Validate file type
    if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
      return { url: null, error: new Error(`Unsupported file type: ${file.type}`) };
    }

    // 1. Compress if it's an image
    let processedFile = file;
    try {
      processedFile = await compressImage(file);
      console.log(`[Storage] File processed: ${file.name} (${(file.size / 1024).toFixed(1)}KB) -> ${processedFile.name} (${(processedFile.size / 1024).toFixed(1)}KB)`);
    } catch (compressError) {
      console.error("[Storage] Compression failed, using original file:", compressError);
    }

    // 2. Prepare Cloudinary Form Data
    const formData = new FormData();
    formData.append('file', processedFile);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('tags', bucket);

    // Determine if it's a video (Improved detection for mobile)
    const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|quicktime|m4v)$/i.test(file.name);

    // Force resource_type to auto for best compatibility
    formData.append('resource_type', 'auto');

    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;
    console.log(`[Storage] ---------------------------------------------------`);
    console.log(`[Storage] DEBUG: Uploading to Cloud Name: "${CLOUD_NAME}"`);
    console.log(`[Storage] DEBUG: Using Upload Preset: "${UPLOAD_PRESET}"`);
    console.log(`[Storage] DEBUG: File: ${file.name}, Type: ${file.type}`);
    console.log(`[Storage] ---------------------------------------------------`);

    // 3. Upload to Cloudinary
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[Storage] Cloudinary Error:", errorData);
      throw new Error(`[Cloudinary] ${errorData.error?.message || 'Upload failed'}`);
    }

    const data = await response.json();
    console.log(`[Storage] Upload Successful [${data.secure_url}]`);

    // 4. Return the secure URL
    return { url: data.secure_url, error: null };
  } catch (error: any) {
    console.error("[Storage] Upload Error:", error);
    return { url: null, error: error };
  }
}

export async function uploadMultipleFiles(
  bucket: BucketName,
  files: File[],
  userId: string
): Promise<{ urls: string[]; errors: Error[] }> {
  const results = await Promise.all(
    files.map(file => uploadFile(bucket, file, userId))
  );

  return {
    urls: results.filter(r => r.url).map(r => r.url!),
    errors: results.filter(r => r.error).map(r => r.error!)
  };
}

/**
 * Note: Deleting from Cloudinary requires a 'Signed' request or an API key.
 * For an MVP, we can keep the files there or implement a Supabase Edge Function later.
 */
export async function deleteFile(
  bucket: BucketName,
  filePath: string
): Promise<{ error: Error | null }> {
  console.warn("Delete requested for:", filePath, " - Implement signed delete if needed.");
  return { error: null };
}

export function getPublicUrl(bucket: BucketName, path: string): string {
  // Since Cloudinary URLs are absolute, we just return the path if it's already a URL
  return path;
}