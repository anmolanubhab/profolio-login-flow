/**
 * Input sanitization utilities to prevent XSS attacks
 */

// HTML entities to escape
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

/**
 * Escapes HTML entities to prevent XSS
 */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"'/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Sanitizes user input for safe storage and display
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .slice(0, 10000); // Limit length to prevent abuse
}

/**
 * Validates and sanitizes text content
 */
export function sanitizeTextContent(content: string): string {
  return escapeHtml(sanitizeInput(content));
}

/**
 * Validates file names to prevent path traversal
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace unsafe characters
    .replace(/^\.+/, '') // Remove leading dots
    .slice(0, 255); // Limit length
}

/**
 * Validates URL to prevent malicious redirects
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return ['http:', 'https:'].includes(parsedUrl.protocol);
  } catch {
    return false;
  }
}