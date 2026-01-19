import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Common validation schemas for API requests
 */

// User schemas
export const loginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
});

export const createUserSchema = z.object({
    username: z.string().min(2, 'Username must be at least 2 characters'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(['ADMIN', 'CALLER']).default('CALLER'),
    daily_target: z.number().int().min(0).max(500).default(50),
});

export const updateUserSchema = z.object({
    username: z.string().min(2).optional(),
    password: z.string().min(6).optional(),
    role: z.enum(['ADMIN', 'CALLER']).optional(),
    daily_target: z.number().int().min(0).max(500).optional(),
});

// Dentist schemas
export const createDentistSchema = z.object({
    facility_name: z.string().min(1, 'Facility name is required'),
    region: z.string().min(1, 'Region is required'),
    city: z.string().min(1, 'City is required'),
    manager: z.string().optional(),
    phone: z.string().min(1, 'Phone is required'),
    address: z.string().optional(),
    preferred_caller_id: z.string().uuid().optional().nullable(),
});

export const updateDentistSchema = z.object({
    facility_name: z.string().min(1).optional(),
    region: z.string().min(1).optional(),
    cities_served: z.string().optional(),
    city: z.string().optional(),
    manager: z.string().optional().nullable(),
    phones: z.array(z.string()).optional(),
    preferred_caller_id: z.string().uuid().optional().nullable(),
});

export const addPhoneSchema = z.object({
    dentist_id: z.string().uuid('Invalid dentist ID'),
    add_phone: z.string().min(1, 'Phone number is required'),
});

// Call schemas
export const logCallSchema = z.object({
    dentist_id: z.string().uuid('Invalid dentist ID'),
    outcome: z.enum(['INTERESTED', 'NOT_INTERESTED', 'NO_ANSWER', 'CALLBACK', 'ORDER_TAKEN']),
    notes: z.string().optional().default(''),
});

export const updateCallSchema = z.object({
    outcome: z.enum(['INTERESTED', 'NOT_INTERESTED', 'NO_ANSWER', 'CALLBACK', 'ORDER_TAKEN']).optional(),
    notes: z.string().optional(),
});

// Schedule generation schema
export const generateScheduleSchema = z.object({
    regions: z.array(z.string()).min(1, 'At least one region is required'),
    cities: z.array(z.string()).optional(),
    callers: z.array(z.string().uuid()).optional(),
    days: z.number().int().min(1).max(30).default(7),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    excludeDays: z.number().int().min(0).max(365).default(7),
    append: z.boolean().default(false),
});

// Reset password schema
export const resetPasswordSchema = z.object({
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});

/**
 * Validate request body against a Zod schema
 * Returns parsed data on success, or NextResponse error on failure
 */
export async function validateBody<T>(
    request: NextRequest,
    schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
    try {
        const body = await request.json();
        const result = schema.safeParse(body);

        if (!result.success) {
            const errors = result.error.issues.map(e => ({
                field: e.path.join('.'),
                message: e.message,
            }));

            return {
                success: false,
                response: NextResponse.json(
                    {
                        success: false,
                        error: 'Validation failed',
                        details: errors,
                    },
                    { status: 400 }
                ),
            };
        }

        return { success: true, data: result.data };
    } catch {
        return {
            success: false,
            response: NextResponse.json(
                { success: false, error: 'Invalid JSON body' },
                { status: 400 }
            ),
        };
    }
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T>(
    searchParams: URLSearchParams,
    schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; response: NextResponse } {
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
        params[key] = value;
    });

    const result = schema.safeParse(params);

    if (!result.success) {
        const errors = result.error.issues.map(e => ({
            field: e.path.join('.'),
            message: e.message,
        }));

        return {
            success: false,
            response: NextResponse.json(
                {
                    success: false,
                    error: 'Invalid query parameters',
                    details: errors,
                },
                { status: 400 }
            ),
        };
    }

    return { success: true, data: result.data };
}
