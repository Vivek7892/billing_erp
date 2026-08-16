# Deployment: Render + Vercel

This repository is configured as a monorepo: Render deploys `backend/` and Vercel deploys `frontend/`.

## 1. Protect secrets before the first push

The existing `backend/.env` and `frontend/.env` files contain local secrets. They must not be committed. The new root `.gitignore` prevents future additions, but files already tracked still need to be removed from Git's index by the repository owner:

```bash
git rm --cached backend/.env frontend/.env
git add .gitignore backend/.env.example frontend/.env.example
```

Keep the local files; the command only stops tracking them. If a secret was pushed to a remote repository, rotate it in the relevant provider.

## 2. Create the Render backend

1. Push this repository and create a new Render **Blueprint** from it. Render reads `render.yaml` and creates `billing-system-api` plus PostgreSQL.
2. In the API service environment settings, set:

   - `ALLOWED_HOSTS`: `your-api-name.onrender.com`
   - `CORS_ALLOWED_ORIGINS`: your Vercel URL, for example `https://your-app.vercel.app`
   - `CSRF_TRUSTED_ORIGINS`: the same Vercel URL
   - `FRONTEND_URL`: the same Vercel URL
   - `SECURE_HSTS_SECONDS`: `31536000` after confirming the API is always served over HTTPS
   - `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and optionally `SUPABASE_SHOP_LOGO_BUCKET` if logo uploads are enabled
   - Any Twilio values used by the application.
3. Deploy. The blueprint installs dependencies, collects static files, runs migrations when the service starts, and starts Gunicorn. Confirm `https://your-api-name.onrender.com/health/` returns `{"status":"ok"}`.

The blueprint uses Render's Free plans to get started. A Free Render Postgres database expires after 30 days and has no backups, so upgrade the database before using this for a real business. [Render’s Free-instance documentation](https://render.com/docs/free) describes those limits.

## 3. Create the Vercel frontend

1. Import the same repository into Vercel.
2. Set **Root Directory** to `frontend` and use the Vite preset (build command `npm run build`, output directory `dist`).
3. Add production environment variables:

   ```
   VITE_API_URL=https://your-api-name.onrender.com/api
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
   ```

4. Deploy, then copy the Vercel production URL into the three Render URL settings above and redeploy Render once.

`frontend/vercel.json` rewrites client-side routes to `index.html`, so deep links such as `/billing/new` work after a refresh.

## Production checks

- Login succeeds from the Vercel domain.
- Create a bill and open both A4 and thermal PDFs.
- Upload a shop logo (requires a public Supabase Storage bucket named by `SUPABASE_SHOP_LOGO_BUCKET`).
- Visit `/health/` on the Render service.

For preview deployments, add each preview domain to `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`, or use a separate preview API environment.
