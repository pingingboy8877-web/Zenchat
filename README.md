# Zenchat

Zenchat is a modern social platform built with Next.js, TypeScript and Supabase.

## Backend

The production Supabase project is:

- Project: `zenchat`
- Region: `eu-west-1`
- Ref: `ewmumgvarramlaootfan`

The backend includes:

- Email OTP authentication
- Profiles
- Posts and media
- Likes, comments, follows and bookmarks
- Stories and story views
- Direct/group conversations
- Realtime messages, reactions, notifications and presence
- Storage buckets for avatars, post media, stories and chat attachments
- Row Level Security on all application tables

## Local / Vercel environment

Set these variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ewmumgvarramlaootfan.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Never put a Supabase service-role/secret key in a browser or `NEXT_PUBLIC_` variable.

## Email OTP

Supabase Auth must use an email template containing `{{ .Token }}` for the Magic Link / OTP template. That makes the email deliver a six-digit code that Zenchat verifies with `verifyOtp({ email, token, type: "email" })`.

Configure your production site URL and redirect URLs in Supabase Auth URL Configuration before testing the deployed app.

## Development

```bash
npm install
npm run dev
```
