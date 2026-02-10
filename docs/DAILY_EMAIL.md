# Daily Email Summary Setup

The system can automatically send daily summary emails containing:
- Call statistics (total calls, interested rate, callbacks, etc.)
- Individual caller summaries (if they submitted one)
- System logs and warnings
- Analysis and trends

## Configuration

### 1. Email Provider Setup

Add the following environment variables to your `.env.local` file:

```env
# Email Configuration (Required)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=DentCall <your-email@gmail.com>
EMAIL_TO=admin1@company.com,admin2@company.com

# API Key for Cron Jobs (Optional but recommended)
DAILY_EMAIL_API_KEY=your-secret-key-here
```

### 2. Email Provider Options

#### Gmail
1. Enable 2-factor authentication
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the app password in `EMAIL_PASSWORD`

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASSWORD=your-app-password
```

#### SendGrid
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
```

#### AWS SES
```env
EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
EMAIL_PORT=587
EMAIL_USER=your-ses-smtp-username
EMAIL_PASSWORD=your-ses-smtp-password
```

### 3. Install Nodemailer

To actually send emails (not just preview), install nodemailer:

```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

Then uncomment the nodemailer code in `src/lib/email.ts`.

### 4. Manual Testing

You can manually trigger the daily email from the admin dashboard or via API:

**Via Admin Panel:**
1. Go to Admin Dashboard
2. Click on "Daily Summaries" tab
3. Click "Send Daily Email" button

**Via API:**
```bash
# Send email for yesterday (default)
curl http://localhost:3000/api/daily-email?api_key=your-secret-key

# Send email for specific date
curl http://localhost:3000/api/daily-email?api_key=your-secret-key&date=2026-02-09
```

## Automated Scheduling

### Option 1: External Cron Job

Use a service like cron-job.org or your server's crontab:

```cron
# Send daily email every day at 8 PM
0 20 * * * curl -X GET "https://your-domain.com/api/daily-email?api_key=your-secret-key"
```

### Option 2: Vercel Cron (Vercel Deployment)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/daily-email?api_key=your-secret-key",
      "schedule": "0 20 * * *"
    }
  ]
}
```

### Option 3: GitHub Actions

Create `.github/workflows/daily-email.yml`:

```yaml
name: Daily Email Summary
on:
  schedule:
    - cron: '0 20 * * *'  # 8 PM UTC daily
  workflow_dispatch:  # Allow manual trigger

jobs:
  send-email:
    runs-on: ubuntu-latest
    steps:
      - name: Send Daily Summary
        run: |
          curl -X GET "${{ secrets.APP_URL }}/api/daily-email?api_key=${{ secrets.DAILY_EMAIL_API_KEY }}"
```

### Option 4: Node Cron (Self-Hosted)

If you're self-hosting, you can use node-cron:

```bash
npm install node-cron
```

Create `src/lib/cron-jobs.ts`:

```typescript
import cron from 'node-cron';

// Run every day at 8 PM
cron.schedule('0 20 * * *', async () => {
  console.log('Running daily email job...');
  try {
    const response = await fetch(`http://localhost:3000/api/daily-email?api_key=${process.env.DAILY_EMAIL_API_KEY}`);
    const data = await response.json();
    console.log('Daily email sent:', data);
  } catch (error) {
    console.error('Failed to send daily email:', error);
  }
});
```

Then import it in your `src/lib/db.ts` at the bottom.

## Email Preview

If email is not configured, the system will log the email content to the console instead of sending it. This is useful for development and testing.

## Troubleshooting

### Email not sending
1. Check console for error messages
2. Verify environment variables are set correctly
3. Check that nodemailer is installed and uncommented in `email.ts`
4. Test with a simple email first
5. Check spam folder

### Cron job not working
1. Verify the cron schedule syntax
2. Check that the API endpoint is accessible from external sources
3. Verify API key is correct
4. Check server logs for errors

## Security Notes

- **Never commit** `.env.local` to git
- Use a **strong API key** for `DAILY_EMAIL_API_KEY`
- Restrict API key access to trusted services only
- Consider using environment-specific keys for production
