# 📧 Email Notification Setup Guide

This guide will help you configure email notifications for Tangerin Audiobook Converter.

## 🎯 Overview

When an audiobook transformation completes (successfully or with errors), the system will automatically send an email notification to `paradymuseless@gmail.com`.

---

## 🔧 Gmail Configuration Steps

### Step 1: Enable 2-Factor Authentication

1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security** → **2-Step Verification**
3. Follow the steps to enable 2FA if not already enabled

### Step 2: Generate App Password

1. Go to: https://myaccount.google.com/apppasswords
2. Select **App**: Choose "Mail"
3. Select **Device**: Choose "Other (Custom name)" and enter "Tangerin Audiobook"
4. Click **Generate**
5. **Copy the 16-character password** (it will look like: `abcd efgh ijkl mnop`)

### Step 3: Update `.env` File

Open your `.env` file and update the following variables:

```env
# Email Notifications
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-gmail-address@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop
EMAIL_TO=paradymuseless@gmail.com
```

**Replace:**
- `your-gmail-address@gmail.com` with your actual Gmail address
- `abcdefghijklmnop` with the 16-character App Password (remove spaces)

---

## 📨 Email Templates

### ✅ Success Email

When a transformation completes successfully, you'll receive:

**Subject:** `✅ Audiobook Ready: [Book Title]`

**Content:**
- Book title
- Output file path
- Success message

### ❌ Failure Email

When a transformation fails, you'll receive:

**Subject:** `❌ Audiobook Failed: [Book Title]`

**Content:**
- Book title
- Error message
- Troubleshooting information

---

## 🧪 Testing

To test the email configuration:

1. Make sure your `.env` file is properly configured
2. Start the server: `node server.mjs`
3. Run a transformation
4. Check the console for: `📧 Email sent successfully: [message-id]`
5. Check your inbox at `paradymuseless@gmail.com`

---

## 🔍 Troubleshooting

### Email not sending?

Check the server console for error messages:

```
⚠️  Email not configured, skipping notification
```
→ Make sure all EMAIL_* variables are set in `.env`

```
❌ Error sending email: Invalid login
```
→ Check that EMAIL_USER and EMAIL_PASSWORD are correct

```
❌ Error sending email: Connection timeout
```
→ Check your internet connection and firewall settings

### Gmail blocking the connection?

1. Make sure you're using an **App Password**, not your regular Gmail password
2. Verify that 2-Factor Authentication is enabled
3. Check that "Less secure app access" is NOT required (App Passwords bypass this)

---

## 🔒 Security Notes

- **Never commit your `.env` file** to version control
- The `.env` file is already in `.gitignore`
- App Passwords are safer than using your main Gmail password
- You can revoke App Passwords at any time from your Google Account settings

---

## 📝 Configuration Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `EMAIL_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP server port | `587` (TLS) or `465` (SSL) |
| `EMAIL_USER` | Your Gmail address | `yourname@gmail.com` |
| `EMAIL_PASSWORD` | Gmail App Password | `abcdefghijklmnop` |
| `EMAIL_TO` | Recipient email | `paradymuseless@gmail.com` |

---

## 🎨 Customization

To customize the email templates, edit `src/utils/email.mjs`:

- Change the HTML styling
- Add more information to the email body
- Modify the subject line format
- Add attachments (if needed)

---

## ✅ Checklist

- [ ] 2-Factor Authentication enabled on Gmail
- [ ] App Password generated
- [ ] `.env` file updated with correct credentials
- [ ] Server restarted after updating `.env`
- [ ] Test email sent successfully

---

**Need help?** Check the server logs for detailed error messages.

