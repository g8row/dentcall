import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '@/lib/logger';

describe('logger', () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('debug', () => {
        it('should log messages with prefix and timestamp', () => {
            // In test/dev mode, debug should log
            logger.debug('Test', 'Debug message');

            expect(consoleLogSpy).toHaveBeenCalled();
            const loggedMessage = consoleLogSpy.mock.calls[0]?.[0];
            if (loggedMessage) {
                expect(loggedMessage).toContain('[Test]');
                expect(loggedMessage).toContain('Debug message');
            }
        });
    });

    describe('info', () => {
        it('should log info messages', () => {
            logger.info('Auth', 'User logged in');

            expect(consoleLogSpy).toHaveBeenCalled();
            const loggedMessage = consoleLogSpy.mock.calls[0]?.[0];
            if (loggedMessage) {
                expect(loggedMessage).toContain('[Auth]');
                expect(loggedMessage).toContain('User logged in');
            }
        });
    });

    describe('warn', () => {
        it('should always log warnings', () => {
            logger.warn('Security', 'Rate limit exceeded');

            expect(consoleWarnSpy).toHaveBeenCalled();
            const loggedMessage = consoleWarnSpy.mock.calls[0]?.[0];
            if (loggedMessage) {
                expect(loggedMessage).toContain('[Security]');
                expect(loggedMessage).toContain('Rate limit exceeded');
            }
        });
    });

    describe('error', () => {
        it('should always log errors', () => {
            const testError = new Error('Test error');
            logger.error('Database', 'Connection failed', testError);

            expect(consoleErrorSpy).toHaveBeenCalled();
            const loggedMessage = consoleErrorSpy.mock.calls[0]?.[0];
            if (loggedMessage) {
                expect(loggedMessage).toContain('[Database]');
                expect(loggedMessage).toContain('Connection failed');
            }
        });

        it('should log without error object', () => {
            logger.error('API', 'Request failed');

            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe('migration', () => {
        it('should log migration messages', () => {
            logger.migration('Added new column');

            expect(consoleLogSpy).toHaveBeenCalled();
            const loggedMessage = consoleLogSpy.mock.calls[0]?.[0];
            if (loggedMessage) {
                expect(loggedMessage).toContain('[Migration]');
                expect(loggedMessage).toContain('Added new column');
            }
        });
    });

    describe('scheduler', () => {
        it('should log scheduler messages', () => {
            logger.scheduler('Backup started');

            expect(consoleLogSpy).toHaveBeenCalled();
            const loggedMessage = consoleLogSpy.mock.calls[0]?.[0];
            if (loggedMessage) {
                expect(loggedMessage).toContain('[Scheduler]');
                expect(loggedMessage).toContain('Backup started');
            }
        });
    });
});
