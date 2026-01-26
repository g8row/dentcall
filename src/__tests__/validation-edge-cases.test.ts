import { describe, it, expect } from 'vitest';
import {
    generateScheduleSchema,
    updateDentistSchema,
    updateUserSchema,
    updateCallSchema,
} from '@/lib/validation';

describe('validation schemas - additional edge cases', () => {
    describe('generateScheduleSchema', () => {
        it('should accept valid schedule generation request', () => {
            const result = generateScheduleSchema.safeParse({
                regions: ['Sofia', 'Plovdiv'],
                startDate: '2025-01-15',
                days: 7,
                excludeDays: 7,
            });
            expect(result.success).toBe(true);
        });

        it('should reject empty regions array', () => {
            const result = generateScheduleSchema.safeParse({
                regions: [],
                startDate: '2025-01-15',
            });
            expect(result.success).toBe(false);
        });

        it('should reject invalid date format', () => {
            const result = generateScheduleSchema.safeParse({
                regions: ['Sofia'],
                startDate: '2025/01/15', // Wrong format
            });
            expect(result.success).toBe(false);
        });

        it('should reject invalid date format - american style', () => {
            const result = generateScheduleSchema.safeParse({
                regions: ['Sofia'],
                startDate: '01-15-2025', // MM-DD-YYYY
            });
            expect(result.success).toBe(false);
        });

        it('should enforce days upper limit', () => {
            const result = generateScheduleSchema.safeParse({
                regions: ['Sofia'],
                startDate: '2025-01-15',
                days: 31, // Max is 30
            });
            expect(result.success).toBe(false);
        });

        it('should use default values', () => {
            const result = generateScheduleSchema.safeParse({
                regions: ['Sofia'],
                startDate: '2025-01-15',
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.days).toBe(7);
                expect(result.data.excludeDays).toBe(7);
                expect(result.data.append).toBe(false);
            }
        });

        it('should accept optional callers array', () => {
            const result = generateScheduleSchema.safeParse({
                regions: ['Sofia'],
                startDate: '2025-01-15',
                callers: ['550e8400-e29b-41d4-a716-446655440000'],
            });
            expect(result.success).toBe(true);
        });

        it('should reject invalid caller UUIDs', () => {
            const result = generateScheduleSchema.safeParse({
                regions: ['Sofia'],
                startDate: '2025-01-15',
                callers: ['not-a-uuid'],
            });
            expect(result.success).toBe(false);
        });
    });

    describe('updateDentistSchema', () => {
        it('should accept partial update', () => {
            const result = updateDentistSchema.safeParse({
                facility_name: 'New Name',
            });
            expect(result.success).toBe(true);
        });

        it('should accept empty object (no updates)', () => {
            const result = updateDentistSchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('should accept phones array', () => {
            const result = updateDentistSchema.safeParse({
                phones: ['+359888123456', '+359889654321'],
            });
            expect(result.success).toBe(true);
        });

        it('should accept nullable manager', () => {
            const result = updateDentistSchema.safeParse({
                manager: null,
            });
            expect(result.success).toBe(true);
        });

        it('should accept nullable preferred_caller_id', () => {
            const result = updateDentistSchema.safeParse({
                preferred_caller_id: null,
            });
            expect(result.success).toBe(true);
        });
    });

    describe('updateUserSchema', () => {
        it('should accept partial update', () => {
            const result = updateUserSchema.safeParse({
                daily_target: 75,
            });
            expect(result.success).toBe(true);
        });

        it('should accept empty object', () => {
            const result = updateUserSchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('should reject short password on update', () => {
            const result = updateUserSchema.safeParse({
                password: '123',
            });
            expect(result.success).toBe(false);
        });

        it('should accept valid role change', () => {
            const result = updateUserSchema.safeParse({
                role: 'ADMIN',
            });
            expect(result.success).toBe(true);
        });
    });

    describe('updateCallSchema', () => {
        it('should accept outcome update only', () => {
            const result = updateCallSchema.safeParse({
                outcome: 'CALLBACK',
            });
            expect(result.success).toBe(true);
        });

        it('should accept notes update only', () => {
            const result = updateCallSchema.safeParse({
                notes: 'Will call back tomorrow',
            });
            expect(result.success).toBe(true);
        });

        it('should accept empty object', () => {
            const result = updateCallSchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('should reject invalid outcome', () => {
            const result = updateCallSchema.safeParse({
                outcome: 'MAYBE',
            });
            expect(result.success).toBe(false);
        });
    });
});
