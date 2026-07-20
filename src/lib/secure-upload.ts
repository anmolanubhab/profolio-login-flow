import { supabase } from '@/integrations/supabase/client';

// File type validation
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const ALLOWED_CERTIFICATE_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];
// Post "document" attachments are scoped to PDF only, unlike certificates/
// resumes which also accept Word docs -- keeps the inline preview in
// PostCard simple (browsers can render a PDF in an <iframe> natively).
const ALLOWED_POST_DOCUMENT_TYPES = ['application/pdf'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

// File size limits (in bytes)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

export interface SecureUploadOptions {
  bucket: 'avatars' | 'post-images' | 'certificates' | 'resumes' | 'stories' | 'post-videos' | 'post-documents';
  file: File;
  userId: string;
  allowedTypes?: string[];
  maxSize?: number;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  filePath?: string;
  error?: string;
}

/**
 * Validates file type and size
 */
function validateFile(file: File, allowedTypes: string[], maxSize: number): string | null {
  if (!allowedTypes.includes(file.type)) {
    return `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`;
  }
  
  if (file.size > maxSize) {
    return `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum ${(maxSize / 1024 / 1024).toFixed(2)}MB`;
  }
  
  return null;
}

/**
 * Generates a secure filename without exposing user email
 */
function generateSecureFilename(originalName: string): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const fileExt = originalName.split('.').pop() || '';
  return `${timestamp}-${randomString}.${fileExt}`;
}

/**
 * Uploads a file securely to Supabase storage
 */
export async function secureUpload({
  bucket,
  file,
  userId,
  allowedTypes,
  maxSize
}: SecureUploadOptions): Promise<UploadResult> {
  try {
    // Set default validation rules based on bucket
    let defaultAllowedTypes: string[];
    let defaultMaxSize: number;
    
    switch (bucket) {
      case 'avatars':
      case 'post-images':
      case 'stories':
        defaultAllowedTypes = ALLOWED_IMAGE_TYPES;
        defaultMaxSize = MAX_IMAGE_SIZE;
        break;
      case 'certificates':
        defaultAllowedTypes = ALLOWED_CERTIFICATE_TYPES;
        defaultMaxSize = MAX_DOCUMENT_SIZE;
        break;
      case 'resumes':
        defaultAllowedTypes = ALLOWED_DOCUMENT_TYPES;
        defaultMaxSize = MAX_DOCUMENT_SIZE;
        break;
      case 'post-documents':
        defaultAllowedTypes = ALLOWED_POST_DOCUMENT_TYPES;
        defaultMaxSize = MAX_DOCUMENT_SIZE;
        break;
      case 'post-videos':
        defaultAllowedTypes = ALLOWED_VIDEO_TYPES;
        defaultMaxSize = MAX_VIDEO_SIZE;
        break;
      default:
        return { success: false, error: 'Invalid bucket specified' };
    }

    const finalAllowedTypes = allowedTypes || defaultAllowedTypes;
    const finalMaxSize = maxSize || defaultMaxSize;

    // Validate file
    const validationError = validateFile(file, finalAllowedTypes, finalMaxSize);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // Generate secure filename and path
    const secureFilename = generateSecureFilename(file.name);
    const filePath = `${userId}/${secureFilename}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false // Prevent overwriting
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    // For private buckets (certificates, resumes), store the file path instead of public URL
    // Public URL won't work for private buckets
    const isPrivateBucket = bucket === 'certificates' || bucket === 'resumes';
    
    if (isPrivateBucket) {
      return {
        success: true,
        url: filePath, // Store the path, we'll generate signed URLs when viewing
        filePath
      };
    }

    // Get public URL for public buckets
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return {
      success: true,
      url: publicUrl,
      filePath
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
}

/**
 * Deletes a file from storage
 */
export async function secureDelete(bucket: string, filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed'
    };
  }
}