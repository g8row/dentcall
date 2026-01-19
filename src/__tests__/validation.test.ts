import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
    loginSchema,
    createUserSchema,
    createDentistSchema,
    logCallSchema,
    resetPasswordSchema,
    addPhoneSchema,
} from '@/lib/validation';

describe('validation schemas', () => {
    describe('loginSchema', () => {
        it('should accept valid login data', () => {
            const result = loginSchema.safeParse({
                username: 'testuser',
                password: 'password123',
            });
            expect(result.success).toBe(true);
        });

        it('should reject empty username', () => {
            const result = loginSchema.safeParse({
                username: '',
                password: 'password123',
            });
            expect(result.success).toBe(false);
        });

        it('should reject empty password', () => {
            const result = loginSchema.safeParse({
                username: 'testuser',
                password: '',
            });
            expect(result.success).toBe(false);
        });

        it('should reject missing fields', () => {
            const result = loginSchema.safeParse({});
            expect(result.success).toBe(false);
        });
    });

    describe('createUserSchema', () => {
        it('should accept valid user data', () => {
            const result = createUserSchema.safeParse({
                username: 'newuser',
                password: 'secure123',
                role: 'CALLER',
                daily_target: 50,
            });
            expect(result.success).toBe(true);
        });

        it('should use default values', () => {
            const result = createUserSchema.safeParse({
                username: 'newuser',
                password: 'secure123',
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.role).toBe('CALLER');
                expect(result.data.daily_target).toBe(50);
            }
        });

        it('should reject short username', () => {
            const result = createUserSchema.safeParse({
                username: 'a',
                password: 'secure123',
            });
            expect(result.success).toBe(false);
        });

        it('should reject short password', () => {
            const result = createUserSchema.safeParse({
                username: 'newuser',
                password: '123',
            });
            expect(result.success).toBe(false);
        });

        it('should reject invalid role', () => {
            const result = createUserSchema.safeParse({
                username: 'newuser',
                password: 'secure123',
                role: 'INVALID',
            });
            expect(result.success).toBe(false);
        });

        it('should reject daily_target over 500', () => {
            const result = createUserSchema.safeParse({
                username: 'newuser',
                password: 'secure123',
                daily_target: 501,
            });
            expect(result.success).toBe(false);
        });
    });

    describe('createDentistSchema', () => {
        it('should accept valid dentist data', () => {
            const result = createDentistSchema.safeParse({
                facility_name: 'Test Dental',
                region: 'Sofia',
                city: 'Sofia',
                phone: '+359888123456',
            });
            expect(result.success).toBe(true);
        });

        it('should accept optional fields', () => {
            const result = createDentistSchema.safeParse({
                facility_name: 'Test Dental',
                region: 'Sofia',
                city: 'Sofia',
                phone: '+359888123456',
                manager: 'Dr. John',
                address: '123 Main St',
            });
            expect(result.success).toBe(true);
        });

        it('should reject missing required fields', () => {
            const result = createDentistSchema.safeParse({
                facility_name: 'Test Dental',
                region: 'Sofia',
                // missing city and phone
            });
            expect(result.success).toBe(false);
        });
    });

    describe('logCallSchema', () => {
        it('should accept valid call log', () => {
            const result = logCallSchema.safeParse({
                dentist_id: '550e8400-e29b-41d4-a716-446655440000',
                outcome: 'INTERESTED',
                notes: 'Great call!',
            });
            expect(result.success).toBe(true);
        });

        it('should accept all valid outcomes', () => {
            const outcomes = ['INTERESTED', 'NOT_INTERESTED', 'NO_ANSWER', 'CALLBACK', 'ORDER_TAKEN'];

            for (const outcome of outcomes) {
                const result = logCallSchema.safeParse({
                    dentist_id: '550e8400-e29b-41d4-a716-446655440000',
                    outcome,
                });
                expect(result.success).toBe(true);
            }
        });

        it('should reject invalid outcome', () => {
            const result = logCallSchema.safeParse({
                dentist_id: '550e8400-e29b-41d4-a716-446655440000',
                outcome: 'INVALID',
            });
            expect(result.success).toBe(false);
        });

        it('should reject invalid UUID', () => {
            const result = logCallSchema.safeParse({
                dentist_id: 'not-a-uuid',
                outcome: 'INTERESTED',
            });
            expect(result.success).toBe(false);
        });
    });

    describe('resetPasswordSchema', () => {
        it('should accept matching passwords', () => {
            const result = resetPasswordSchema.safeParse({
                newPassword: 'newpass123',
                confirmPassword: 'newpass123',
            });
            expect(result.success).toBe(true);
        });

        it('should reject non-matching passwords', () => {
            const result = resetPasswordSchema.safeParse({
                newPassword: 'newpass123',
                confirmPassword: 'different',
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Passwords do not match');
            }
        });

        it('should reject short password', () => {
            const result = resetPasswordSchema.safeParse({
                newPassword: '123',
                confirmPassword: '123',
            });
            expect(result.success).toBe(false);
        });
    });

    describe('addPhoneSchema', () => {
        it('should accept valid phone addition', () => {
            const result = addPhoneSchema.safeParse({
                dentist_id: '550e8400-e29b-41d4-a716-446655440000',
                add_phone: '+359888123456',
            });
            expect(result.success).toBe(true);
        });

        it('should reject empty phone', () => {
            const result = addPhoneSchema.safeParse({
                dentist_id: '550e8400-e29b-41d4-a716-446655440000',
                add_phone: '',
            });
            expect(result.success).toBe(false);
        });
    });
});
