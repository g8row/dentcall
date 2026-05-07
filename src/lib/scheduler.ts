import { performServerBackup } from './backup';
import { logger } from './logger';

let schedulerStarted = false;

/**
 * Initializes all automated background tasks
 */
export function initScheduler() {
    if (schedulerStarted) return;
    schedulerStarted = true;

    logger.scheduler('Scheduler system initialized.');

    // Schedule automated backup at 03:00 AM (nightly)
    scheduleTask(3, 0, runBackupTask, 'Nightly Backup');
    
    // Schedule daily summary email at 06:00 PM (18:00)
    scheduleTask(18, 0, runEmailTask, 'Daily Summary Email');
}

/**
 * Helper to schedule a task to run daily at a specific hour/minute
 */
function scheduleTask(hour: number, minute: number, task: () => void, name: string) {
    const now = new Date();
    let target = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hour, minute, 0
    );
    
    // If the time has already passed today, schedule for tomorrow
    if (target <= now) {
        target.setDate(target.getDate() + 1);
    }
    
    const msToTarget = target.getTime() - now.getTime();
    
    // Convert MS to a readable duration
    const hours = Math.floor(msToTarget / (1000 * 60 * 60));
    const mins = Math.floor((msToTarget % (1000 * 60 * 60)) / (1000 * 60));

    logger.scheduler(`${name} scheduled for ${target.toLocaleString()} (in ${hours}h ${mins}m)`);

    setTimeout(() => {
        task();
        // After the first run, set it to repeat every 24 hours
        setInterval(task, 24 * 60 * 60 * 1000);
    }, msToTarget);
}

/**
 * Task: Perform automated database backup
 */
function runBackupTask() {
    logger.scheduler('Starting automated backup...');
    try {
        const result = performServerBackup();
        if (result.success) {
            logger.scheduler(`Backup success: ${result.path}`);
        } else {
            logger.error('Scheduler', `Backup failed: ${result.error}`);
        }
    } catch (error) {
        logger.error('Scheduler', `Backup task error: ${error}`);
    }
}

/**
 * Task: Trigger the daily email summary API
 */
async function runEmailTask() {
    logger.scheduler('Starting automated daily email summary...');
    
    const apiKey = process.env.DAILY_EMAIL_API_KEY;
    const port = process.env.PORT || 4000;
    const host = process.env.HOSTNAME || 'localhost';
    
    // We hit our own API endpoint to trigger the email logic
    const url = `http://${host}:${port}/api/daily-email?api_key=${apiKey}`;

    if (!apiKey) {
        logger.error('Scheduler', 'DAILY_EMAIL_API_KEY not configured. Cannot send automated email.');
        return;
    }

    try {
        const response = await fetch(url, { method: 'GET' });
        const data = await response.json();
        
        if (response.ok) {
            logger.scheduler(`Daily email sent successfully: ${JSON.stringify(data.stats || data)}`);
        } else {
            logger.error('Scheduler', `Daily email API returned error: ${data.error || 'Unknown error'}`);
        }
    } catch (error) {
        logger.error('Scheduler', `Failed to trigger daily email: ${error}`);
    }
}
