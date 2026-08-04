# MEPS Trip Coordinator PWA

A mobile-first, installable web app for coordinating MEPS trips across a team.

## Included

- Trip board with primary and backup coordinators
- Rider and seat tracking
- Team availability and vehicle capacity
- Automatic conflict warnings
- Offline/local mode
- Installable PWA manifest and service worker
- Optional shared Supabase backend with email magic-link verification and row-level security
- JSON export/import for backup

## Local preview

A PWA must be served through `https://` or `localhost`; opening `index.html` directly will not install the service worker.

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Deploy

This is a static app. Deploy the folder to GitHub Pages, Netlify, Vercel, Cloudflare Pages, or another HTTPS static host.

## Shared team setup with Supabase

1. Create a Supabase project.
2. Run `supabase-schema.sql` in the Supabase SQL editor.
3. In Supabase Authentication > Providers, make sure Email is enabled.
4. Set the Site URL and allowed redirect URL to the deployed PWA URL.
5. Open the PWA's Settings tab and confirm the project URL and public/publishable key.
6. Enter an email address and open the verification link on the same device.
7. One person creates the team and shares the join code.
8. Other authorized users verify their email and join using that code.

## Privacy

Use applicant IDs or initials only. Do not store SSNs, full birth dates, medical details, or other sensitive applicant information. Use only an approved hosting and data-storage environment.
