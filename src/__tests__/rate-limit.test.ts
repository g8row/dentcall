import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

describe('rate-limit', () => {
    describe('checkRateLimit', () => {
        beforeEach(() => {
            // Reset rate limiter state between tests by using unique keys
        });

        it('should allow requests within limit', () => {
            const key = `test-${Date.now()}-1`;
            const config = { limit: 3, windowMs: 60000 };

            const result1 = checkRateLimit(key, config);
            expect(result1.success).toBe(true);
            expect(result1.remaining).toBe(2);

            const result2 = checkRateLimit(key, config);
            expect(result2.success).toBe(true);
            expect(result2.remaining).toBe(1);

            const result3 = checkRateLimit(key, config);
            expect(result3.success).toBe(true);
            expect(result3.remaining).toBe(0);
        });

        it('should block requests exceeding limit', () => {
            const key = `test-${Date.now()}-2`;
            const config = { limit: 2, windowMs: 60000 };

            checkRateLimit(key, config);
            checkRateLimit(key, config);

            const result = checkRateLimit(key, config);
            expect(result.success).toBe(false);
            expect(result.remaining).toBe(0);
            expect(result.resetIn).toBeGreaterThan(0);
        });

        it('should use predefined limits correctly', () => {
            const key = `login-test-${Date.now()}`;

            // LOGIN allows 5 attempts
            for (let i = 0; i < 5; i++) {
                const result = checkRateLimit(key, RATE_LIMITS.LOGIN);
                expect(result.success).toBe(true);
            }

            // 6th attempt should fail
            const result = checkRateLimit(key, RATE_LIMITS.LOGIN);
            expect(result.success).toBe(false);
        });

        it('should track different keys independently', () => {
            const key1 = `user1-${Date.now()}`;
            const key2 = `user2-${Date.now()}`;
            const config = { limit: 1, windowMs: 60000 };

            const result1 = checkRateLimit(key1, config);
            expect(result1.success).toBe(true);

            const result2 = checkRateLimit(key2, config);
            expect(result2.success).toBe(true);

            // key1 should now be blocked
            const result3 = checkRateLimit(key1, config);
            expect(result3.success).toBe(false);

            // key2 should also be blocked independently
            const result4 = checkRateLimit(key2, config);
            expect(result4.success).toBe(false);
        });
    });

    describe('getClientIp', () => {
        it('should extract IP from x-forwarded-for header', () => {
            const headers = new Headers();
            headers.set('x-forwarded-for', '192.168.1.1, 10.0.0.1');

            const ip = getClientIp(headers);
            expect(ip).toBe('192.168.1.1');
        });

        it('should extract IP from x-real-ip header', () => {
            const headers = new Headers();
            headers.set('x-real-ip', '192.168.1.2');

            const ip = getClientIp(headers);
            expect(ip).toBe('192.168.1.2');
        });

        it('should prefer x-forwarded-for over x-real-ip', () => {
            const headers = new Headers();
            headers.set('x-forwarded-for', '192.168.1.1');
            headers.set('x-real-ip', '192.168.1.2');

            const ip = getClientIp(headers);
            expect(ip).toBe('192.168.1.1');
        });

        it('should return unknown when no IP headers present', () => {
            const headers = new Headers();

            const ip = getClientIp(headers);
            expect(ip).toBe('unknown');
        });
    });
});
