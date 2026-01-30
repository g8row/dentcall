# Password Reset Guide

Since passwords are securely hashed using `bcrypt`, it is **impossible to recover** a forgotten password. However, you can **reset** it to a new value using the steps below.

## Prerequisites
- SSH access to your home server.
- Docker installed and running.

## Method: Using Docker Exec

You can run a one-line Node.js script inside your running container to update the password in the SQLite database.

1. **SSH into your server**.
2. **Find your container name**:
   ```bash
   docker ps | grep dentcall
   ```
   *Note: The name is likely something like `cold-caller-app-dentcall-1` or similar.*

3. **Run the reset command**:
   Replace `YOUR_CONTAINER_NAME` with the actual name and `NEW_PASSWORD` with your desired password.

   ```bash
   docker exec -it YOUR_CONTAINER_NAME node -e "
     const Database = require('better-sqlite3');
     const bcrypt = require('bcryptjs');
     const db = new Database('data/cold-caller.db');
     const hash = bcrypt.hashSync('NEW_PASSWORD', 10);
     const stmt = db.prepare('UPDATE users SET password = ? WHERE username = ?');
     const info = stmt.run(hash, 'admin');
     console.log('Password update result:', info);
   "
   ```

## Alternative: Using the dedicated script (if mounted)

If you have mapped the `scripts` directory into your container (which is not default in the updated Dockerfile), you could run:
```bash
docker exec -it YOUR_CONTAINER_NAME npx tsx scripts/reset-password.ts
```
*Note: This requires the `scripts` folder to be present inside `/app` in the container.*

## Troubleshooting
- **"Error: Cannot find module 'better-sqlite3'"**: Ensure you are running the command in the standard production image which includes dependencies.
- **"Database is locked"**: Ensure no other heavy operations are locking the SQLite DB, though WAL mode usually handles this.
