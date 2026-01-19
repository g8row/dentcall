import { performServerBackup } from './backup';

let schedulerStarted = false;

export function initBackupScheduler() {
    if (schedulerStarted) return;
    schedulerStarted = true;

    console.log('[Scheduler] Backup scheduler started. Running daily at midnight (approx).');

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
    console.log('[Scheduler] Starting automated backup...');
    const result = performServerBackup();
    if (result.success) {
        console.log(`[Scheduler] Backup success: ${result.path}`);
    } else {
        console.error(`[Scheduler] Backup failed: ${result.error}`);
    }
}
