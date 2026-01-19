// Test setup file for Vitest - Node environment
import { vi } from 'vitest';

// Mock Next.js headers for auth tests
vi.mock('next/headers', () => ({
    cookies: () => ({
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
    }),
}));
