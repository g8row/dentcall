import { describe, it, expect } from 'vitest';
import {
    successResponse,
    errorResponse,
    paginatedResponse,
    messageResponse,
    unauthorizedResponse,
    forbiddenResponse,
    notFoundResponse,
    internalErrorResponse,
    getUserFromHeaders,
} from '@/lib/api-response';

describe('api-response utilities', () => {
    describe('successResponse', () => {
        it('should create a basic success response', async () => {
            const response = successResponse({ id: 1, name: 'Test' });
            const json = await response.json();

            expect(response.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.data).toEqual({ id: 1, name: 'Test' });
        });

        it('should handle null data', async () => {
            const response = successResponse(null);
            const json = await response.json();

            expect(json.success).toBe(true);
            expect(json.data).toBeNull();
        });

        it('should handle array data', async () => {
            const response = successResponse([1, 2, 3]);
            const json = await response.json();

            expect(json.data).toEqual([1, 2, 3]);
        });

        it('should include meta when provided', async () => {
            const response = successResponse({ id: 1 }, { page: 1, total: 100 });
            const json = await response.json();

            expect(json.meta).toEqual({ page: 1, total: 100 });
        });
    });

    describe('messageResponse', () => {
        it('should create a message response', async () => {
            const response = messageResponse('Operation successful');
            const json = await response.json();

            expect(response.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.message).toBe('Operation successful');
        });

        it('should use custom status code', async () => {
            const response = messageResponse('Created', 201);

            expect(response.status).toBe(201);
        });
    });

    describe('errorResponse', () => {
        it('should create a basic error response', async () => {
            const response = errorResponse('Something went wrong');
            const json = await response.json();

            expect(response.status).toBe(400);
            expect(json.success).toBe(false);
            expect(json.error).toBe('Something went wrong');
        });

        it('should use custom status code', async () => {
            const response = errorResponse('Not found', 404);

            expect(response.status).toBe(404);
        });
    });

    describe('paginatedResponse', () => {
        it('should create paginated response with metadata', async () => {
            const items = [{ id: 1 }, { id: 2 }];
            const response = paginatedResponse(items, 1, 10, 100);
            const json = await response.json();

            expect(json.success).toBe(true);
            expect(json.data).toEqual(items);
            expect(json.meta).toEqual({
                page: 1,
                limit: 10,
                total: 100,
                totalPages: 10,
            });
        });

        it('should calculate total pages correctly', async () => {
            const response = paginatedResponse([], 1, 10, 25);
            const json = await response.json();

            expect(json.meta?.totalPages).toBe(3);
        });

        it('should handle zero total items', async () => {
            const response = paginatedResponse([], 1, 10, 0);
            const json = await response.json();

            expect(json.meta?.totalPages).toBe(0);
        });
    });

    describe('HTTP error responses', () => {
        it('unauthorizedResponse should return 401', async () => {
            const response = unauthorizedResponse();
            const json = await response.json();

            expect(response.status).toBe(401);
            expect(json.error).toBe('Authentication required');
        });

        it('forbiddenResponse should return 403', async () => {
            const response = forbiddenResponse();
            const json = await response.json();

            expect(response.status).toBe(403);
            expect(json.error).toBe('Access denied');
        });

        it('notFoundResponse should return 404', async () => {
            const response = notFoundResponse('User');
            const json = await response.json();

            expect(response.status).toBe(404);
            expect(json.error).toBe('User not found');
        });

        it('internalErrorResponse should return 500', async () => {
            const response = internalErrorResponse();
            const json = await response.json();

            expect(response.status).toBe(500);
            expect(json.error).toBe('Internal server error');
        });
    });

    describe('getUserFromHeaders', () => {
        it('should extract user info from headers', () => {
            const headers = new Headers();
            headers.set('x-user-id', 'user-123');
            headers.set('x-user-role', 'ADMIN');

            const user = getUserFromHeaders(headers);
            expect(user).toEqual({ userId: 'user-123', role: 'ADMIN' });
        });

        it('should return null if headers missing', () => {
            const headers = new Headers();

            const user = getUserFromHeaders(headers);
            expect(user).toBeNull();
        });

        it('should return null if only userId present', () => {
            const headers = new Headers();
            headers.set('x-user-id', 'user-123');

            const user = getUserFromHeaders(headers);
            expect(user).toBeNull();
        });
    });
});
