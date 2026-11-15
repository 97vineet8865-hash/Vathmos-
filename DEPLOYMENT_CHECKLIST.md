# Vathmos Launch & Deployment Guide (Oct 15 Launch)

This guide covers connecting your **Vercel subdomain**, **Google Cloud Run backend**, **Supabase database/auth**, and **Payment setup**.

---

## 1. Architecture Overview for Launch

* **Backend / Full-Stack Node Engine**: 
  - Hosted on **Google Cloud Run** via the included multi-stage `Dockerfile`.
  - Cloud Run handles the Gemini API orchestration, PDF parsing, zero-retention memory buffers, and rate limiting.
  - Automatically receives `PORT=8080`, `GEMINI_API_KEY`, and `APP_URL`.

* **Frontend / Vercel Subdomain**:
  - Hosted directly on **Vercel** pointing to your custom domain or Vercel subdomain (e.g. `vathmos.vercel.app` or `app.yourdomain.com`).
  - Pre-configured with `vercel.json` for SPA routing and asset caching.
  - Can point API calls to your Google Cloud Run service URL.

* **Database & Auth (Supabase)**:
  - Database schema ready in `supabase/schema.sql` (profiles, subscriptions, quotas, and zero-retention audit logs).

---

## 2. Deploying to Vercel (Subdomain Setup)

### Step A: Push to GitHub / Connect Repository
1. Import your project repo into Vercel (`https://vercel.com/new`).
2. Framework Preset: **Vite**.
3. Build Command: `npm run build` (or Vite default).
4. Output Directory: `dist`.

### Step B: Configure Vercel Subdomain
1. In your Vercel Project Dashboard, go to **Settings** -> **Domains**.
2. To use a **free Vercel subdomain**:
   - Type your desired name, for example: `vathmos-app.vercel.app` or `vathmos.vercel.app`.
   - Click **Add**. Vercel will instantly provision the SSL certificate and deploy to that subdomain.
3. To use a **custom subdomain** (e.g., `app.yourcompany.com`):
   - Type `app.yourcompany.com` and click **Add**.
   - Add the CNAME record in your DNS provider pointing to `cname.vercel-dns.com`.

### Step C: Environment Variables in Vercel
In Vercel **Settings** -> **Environment Variables**, add:
- `VITE_SUPABASE_URL`: Your Supabase Project URL (`https://xyz.supabase.co`)
- `VITE_SUPABASE_ANON_KEY`: Your Supabase public anon key
- `VITE_API_URL`: Your Google Cloud Run backend URL (e.g., `https://ais-pre-vxvge35ccnyfi6rhqj4xu5-502612456715.asia-east1.run.app`)

---

## 3. Google Cloud Run Deployment

Your container is already packaged and dockerized:
1. Build & submit container via Google Cloud CLI:
   ```bash
   gcloud builds submit --tag gcr.io/PROJECT_ID/vathmos
   ```
2. Deploy to Cloud Run:
   ```bash
   gcloud run deploy vathmos \
     --image gcr.io/PROJECT_ID/vathmos \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars GEMINI_API_KEY="YOUR_KEY"
   ```
*(Note: Your AI Studio live instance is already running on Google Cloud Run at the URLs in your dashboard).*

---

## 4. Connecting Supabase (5-Minute Setup)

1. Open **Supabase Dashboard** (`https://supabase.com/dashboard`) and create a new project.
2. In the left sidebar, click **SQL Editor**.
3. Copy the full contents of `supabase/schema.sql` from this codebase and click **Run**.
   - This creates:
     * `public.profiles`
     * `public.subscriptions`
     * `public.usage_quotas`
     * `public.evaluation_audit_logs`
     * Automatic user trigger `handle_new_user()`
4. Go to **Project Settings** -> **API**:
   - Copy **Project URL** -> `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - Copy **anon public** -> `VITE_SUPABASE_ANON_KEY`
   - Copy **service_role secret** -> `SUPABASE_SERVICE_ROLE_KEY` (Keep server-side only)

---

## 5. Launch Day Verification Checklist (Tomorrow)

- [ ] All PDF formats (text-based & image scanned) parsed cleanly with zero file drops.
- [ ] Unique naming logic verified: No name collisions or overwrites.
- [ ] Rate limits and backoff handling: Smooth multi-tier retry with zero crashes.
- [ ] Payment gateway test keys verified (Stripe / Razorpay).
- [ ] Vercel subdomain active with HTTPS.
