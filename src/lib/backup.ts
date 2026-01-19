import fs from 'fs';
import path from 'path';
import { logger } from './logger';

const DB_PATH = path.join(process.cwd(), 'data', 'cold-caller.db');
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');

export function performServerBackup(): { success: boolean; path?: string; error?: string } {
    try {
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }

        if (!fs.existsSync(DB_PATH)) {
            return { success: false, error: 'Database file not found' };
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `cold-caller-${timestamp}.db`;
        const backupPath = path.join(BACKUP_DIR, backupName);

        // Copy file
        fs.copyFileSync(DB_PATH, backupPath);

        // Usage: Rotate backups (keep last 30)
        cleanOldBackups();

        return { success: true, path: backupName };

    } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        logger.error('Backup', 'Backup failed', error);
        return { success: false, error: error.message };
    }
}

function cleanOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.endsWith('.db'))
            .map(f => ({
                name: f,
                path: path.join(BACKUP_DIR, f),
                time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time); // Newest first

        // Keep last 30
        const toDelete = files.slice(30);
        toDelete.forEach(f => {
            fs.unlinkSync(f.path);
            logger.debug('Backup', `Rotated backup (deleted): ${f.name}`);
        });
    } catch (e) {
        logger.error('Backup', 'Error rotating backups', e);
    }
}

