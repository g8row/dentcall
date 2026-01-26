import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock better-sqlite3 to avoid actual DB operations in tests
vi.mock('better-sqlite3', () => {
    return {
        default: vi.fn(() => ({
            prepare: vi.fn(() => ({
                run: vi.fn(),
                get: vi.fn(),
                all: vi.fn(() => []),
            })),
            exec: vi.fn(),
            pragma: vi.fn(() => []),
        })),
    };
});

// Import after mocking
import { hashPassword, verifyPassword, generateId } from '@/lib/auth';

describe('auth utilities', () => {
    describe('hashPassword', () => {
        it('should hash a password', async () => {
            const password = 'testPassword123';
            const hash = await hashPassword(password);

            expect(hash).toBeDefined();
            expect(hash).not.toBe(password);
            expect(hash.length).toBeGreaterThan(20);
        });

        it('should produce different hashes for same password', async () => {
            const password = 'samePassword';
            const hash1 = await hashPassword(password);
            const hash2 = await hashPassword(password);

            // bcrypt produces different hashes due to random salt
            expect(hash1).not.toBe(hash2);
        });
    });

    describe('verifyPassword', () => {
        it('should verify correct password', async () => {
            const password = 'correctPassword';
            const hash = await hashPassword(password);

            const isValid = await verifyPassword(password, hash);
            expect(isValid).toBe(true);
        });

        it('should reject incorrect password', async () => {
            const hash = await hashPassword('correctPassword');

            const isValid = await verifyPassword('wrongPassword', hash);
            expect(isValid).toBe(false);
        });

        it('should handle empty password', async () => {
            const hash = await hashPassword('somePassword');

            const isValid = await verifyPassword('', hash);
            expect(isValid).toBe(false);
        });
    });

    describe('generateId', () => {
        it('should generate a unique ID', () => {
            const id = generateId();

            expect(id).toBeDefined();
            expect(typeof id).toBe('string');
            expect(id.length).toBeGreaterThan(0);
        });

        it('should generate different IDs each time', () => {
            const ids = new Set<string>();

            for (let i = 0; i < 100; i++) {
                ids.add(generateId());
            }

            expect(ids.size).toBe(100);
        });

        it('should generate UUID-like format', () => {
            const id = generateId();

            // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
            expect(id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
        });
    });
});
