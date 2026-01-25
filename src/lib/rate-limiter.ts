/**
 * Client-side rate limiting to prevent abuse
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();

  /**
   * Check if action is rate limited
   */
  isRateLimited(key: string, config: RateLimitConfig): boolean {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now > entry.resetTime) {
      // Reset or create new entry
      this.limits.set(key, {
        count: 1,
        resetTime: now + config.windowMs
      });
      return false;
    }

    if (entry.count >= config.maxRequests) {
      return true;
    }

    entry.count++;
    return false;
  }

  /**
   * Get remaining time until reset
   */
  getTimeUntilReset(key: string): number {
    const entry = this.limits.get(key);
    if (!entry) return 0;
    
    return Math.max(0, entry.resetTime - Date.now());
  }

  /**
   * Clear rate limit for a key
   */
  clearLimit(key: string): void {
    this.limits.delete(key);
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();

// Predefined rate limit configurations
export const RATE_LIMITS = {
  FILE_UPLOAD: { maxRequests: 10, windowMs: 60 * 1000 }, // 10 uploads per minute
  POST_CREATE: { maxRequests: 5, windowMs: 60 * 1000 }, // 5 posts per minute
  PROFILE_UPDATE: { maxRequests: 3, windowMs: 60 * 1000 }, // 3 updates per minute
  MESSAGE_SEND: { maxRequests: 30, windowMs: 60 * 1000 }, // 30 messages per minute
} as const;

// Cleanup expired entries every 5 minutes
setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);