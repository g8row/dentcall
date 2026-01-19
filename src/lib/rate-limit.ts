/**
 * Simple in-memory rate limiter for API protection.
 * 
 * Note: This is suitable for single-server deployments.
 * For distributed/serverless, consider using Redis or a service like Upstash.
 */

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

class RateLimiter {
    private cache: Map<string, RateLimitEntry> = new Map();
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;

    constructor() {
        // Clean up expired entries every 5 minutes
        if (typeof setInterval !== 'undefined') {
            this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
        }
    }

    /**
     * Check if a request should be rate limited
     * @param key Unique identifier (e.g., IP address, user ID)
     * @param limit Maximum requests allowed in the window
     * @param windowMs Time window in milliseconds
     * @returns { success: boolean, remaining: number, resetIn: number }
     */
    check(key: string, limit: number, windowMs: number): {
        success: boolean;
        remaining: number;
        resetIn: number;
    } {
        const now = Date.now();
        const entry = this.cache.get(key);

        // If no entry or window expired, create new entry
        if (!entry || now >= entry.resetTime) {
            this.cache.set(key, {
                count: 1,
                resetTime: now + windowMs,
            });
            return {
                success: true,
                remaining: limit - 1,
                resetIn: windowMs,
            };
        }

        // Window still active
        if (entry.count >= limit) {
            return {
                success: false,
                remaining: 0,
                resetIn: entry.resetTime - now,
            };
        }

        // Increment counter
        entry.count++;
        return {
            success: true,
            remaining: limit - entry.count,
            resetIn: entry.resetTime - now,
        };
    }

    /**
     * Clean up expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now >= entry.resetTime) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Stop the cleanup interval (for testing/shutdown)
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}

// Singleton instance
const rateLimiter = new RateLimiter();

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
    // Login attempts: 5 per 15 minutes per IP
    LOGIN: { limit: 5, windowMs: 15 * 60 * 1000 },
    // API requests: 100 per minute per user
    API_DEFAULT: { limit: 100, windowMs: 60 * 1000 },
    // Export requests: 10 per hour per user
    EXPORT: { limit: 10, windowMs: 60 * 60 * 1000 },
    // Backup requests: 5 per hour per user  
    BACKUP: { limit: 5, windowMs: 60 * 60 * 1000 },
} as const;

/**
 * Check rate limit for a key
 */
export function checkRateLimit(
    key: string,
    config: { limit: number; windowMs: number }
): { success: boolean; remaining: number; resetIn: number } {
    return rateLimiter.check(key, config.limit, config.windowMs);
}

/**
 * Get client IP from request headers
 * Works with proxies (x-forwarded-for) and direct connections
 */
export function getClientIp(headers: Headers): string {
    // Check x-forwarded-for first (common with proxies/load balancers)
    const forwarded = headers.get('x-forwarded-for');
    if (forwarded) {
        // Could be comma-separated list; take first IP
        return forwarded.split(',')[0].trim();
    }

    // Fall back to x-real-ip
    const realIp = headers.get('x-real-ip');
    if (realIp) {
        return realIp;
    }

    // Default fallback (might not be accurate behind proxy)
    return 'unknown';
}

export default rateLimiter;
