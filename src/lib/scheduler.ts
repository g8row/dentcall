import { performServerBackup } from './backup';
import { logger } from './logger';

let schedulerStarted = false;

export function initBackupScheduler() {
    if (schedulerStarted) return;
    schedulerStarted = true;

    logger.scheduler('Backup scheduler started. Running daily at midnight (approx).');

    // Calculate time until next midnight
    const now = new Date();
    const night = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1, // tomorrow
        0, 0, 0 // midnight
    );
    const msToMidnight = night.getTime() - now.getTime();

    // Schedule first run
    setTimeout(() => {
        runBackupTask();
        // Then run every 24 hours
        setInterval(runBackupTask, 24 * 60 * 60 * 1000);
    }, msToMidnight);
}

function runBackupTask() {
    logger.scheduler('Starting automated backup...');
    const result = performServerBackup();
    if (result.success) {
        logger.scheduler(`Backup success: ${result.path}`);
    } else {
        logger.error('Scheduler', `Backup failed: ${result.error}`);
    }
}

