import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const DB_PATH = path.join(process.cwd(), 'data', 'cold-caller.db');
const db = new Database(DB_PATH);

const password = 'password123';
const hashedPassword = bcrypt.hashSync(password, 10);

console.log(`Resetting passwords to: ${password}`);

const users = ['admin', 'dani', 'ico'];

for (const username of users) {
    const stmt = db.prepare('UPDATE users SET password = ? WHERE username = ?');
    const result = stmt.run(hashedPassword, username);

    if (result.changes > 0) {
        console.log(`✅ ${username} password updated successfully.`);
    } else {
        console.log(`❌ ${username} user not found. Creating it...`);
        // Create if missing
        const insert = db.prepare('INSERT INTO users (id, username, password, role, daily_target) VALUES (?, ?, ?, ?, ?)');
        const role = username === 'admin' ? 'ADMIN' : 'CALLER';
        insert.run(crypto.randomUUID(), username, hashedPassword, role, 50);
        console.log(`✅ ${username} user created.`);
    }
}
