# Deployment guide

This setup is for a low-traffic, personal or noncommercial pilot on Vercel Hobby and Render Free. It uses a single Render web service, static Vite hosting, and the existing Open-Meteo and Groq API access. No accounts are required for visitors. No cloud changes are required to run the local checks.

## Before publishing

- Confirm permission to publish the six illustrations and the skyline asset. The repository contains the supplied files and no license or provenance record that establishes redistribution rights. The repository also has no project license. Resolve these with the rights holders before making the repo or assets public.
- Publish a privacy notice for the deployed site. Explain that Open-Meteo receives coordinates, optional device geolocation sends coordinates to BigDataCloud, map tiles load from OpenStreetMap, and Groq receives chat text, bounded conversation history, household context and modeled data. Verify the applicable Groq data controls in your account.
- Keep an eye on the free quotas and test the single-ingress proxy behavior before sharing the URL. Anonymous sessions and global limits cap local use. They do not identify people or prevent a distributed client from consuming the shared allowance.

Provider references reviewed on 2026-11-24. Vercel Hobby is limited to personal or noncommercial use. Render describes Free services as suitable for hobby and preview work and cautions against production use. Open-Meteo's free API is noncommercial and requires attribution. Groq limits are organization-wide and model-specific. OpenStreetMap public tiles are best effort and require visible attribution and normal browser referrer and caching behavior.

[Vercel terms](https://vercel.com/legal/terms) · [Render Free limits](https://render.com/docs/free) · [Open-Meteo terms](https://open-meteo.com/en/terms) · [Groq Services Agreement](https://console.groq.com/docs/legal/services-agreement) · [Groq rate limits](https://console.groq.com/docs/rate-limits) · [Groq data controls](https://console.groq.com/docs/your-data) · [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/)

## 1. Prepare the GitHub repository

1. Complete the local checks below. Review Git status before staging. Commit the frontend, backend source, both lockfiles, `vercel.json` and this guide. Leave private `.env` files, `node_modules` and `dist` out of Git. Share the repository only after approving the launch and licensing.
2. Once approval is given, use a personal GitHub repository and the branch you want to release, for example `main`. Reserve a Vercel project name so you know its exact production origin. The examples below use `https://urban-air-assistant.vercel.app` and `https://urban-air-api.onrender.com`. Substitute the actual assigned URLs.
3. Link the GitHub repo separately in Render and Vercel. Disable Render auto-deploy for the first verification. Vercel Git integration builds the selected production branch when linked and on subsequent pushes.

## 2. Render Free backend

| Setting | Value |
| --- | --- |
| Service type | Web Service |
| Runtime and plan | Node, Free |
| Source | Same GitHub repo and approved branch |
| Root Directory | Leave blank for the repository root |
| Build Command | `npm --prefix backend ci --omit=dev` |
| Start Command | `npm --prefix backend start` |
| Health Check Path | `/api/v1/health` |
| Instance count | One |

The repository root is necessary because backend routes import the shared modules under `src/data/`. Render injects `PORT` (normally 10000); leave it to Render. Express binds to `0.0.0.0` in production. Render terminates TLS and redirects public HTTP to HTTPS. The backend requires forwarded HTTPS and a valid client address for API requests, with an exception for the lightweight internal health GET.

| Render variable | Value |
| --- | --- |
| `NODE_VERSION` | `24.x` |
| `NODE_ENV` | `production` |
| `FRONTEND_ORIGIN` | Actual exact Vercel origin, e.g. `https://urban-air-assistant.vercel.app`. Additional approved HTTPS origins may be comma-separated. No trailing slash or wildcard. |
| `TRUST_PROXY_HOPS` | `1`, for a single direct Render ingress hop |
| `AI_PROVIDER` | `groq` |
| `GROQ_API_KEY` | Private existing key, entered only in Render's environment settings |
| `GROQ_MODEL` | `openai/gpt-oss-120b` |
| `AI_GLOBAL_PER_MINUTE` | `6` |
| `AI_GLOBAL_PER_DAY` | `80` |
| `CACHE_TTL_MS` | `120000` |

Use the Render public HTTPS URL directly from the browser. Express uses the closest forwarded client address and ignores entries farther from Render for rate limiting. This configuration assumes Render is the only ingress path and supplies the rightmost client IP and the HTTPS header. Do not add an API rewrite, CDN, service mesh, or direct path to the process without revalidating those assumptions. [Render Web Services](https://render.com/docs/web-services) · [Render TLS](https://render.com/docs/tls) · [Render health checks](https://render.com/docs/health-checks) · [Express proxy reference](https://expressjs.com/en/guide/behind-proxies/)

### Troubleshooting `FRONTEND_ORIGIN.0` and `EADDRINUSE`

For this frontend, set the Render environment variable **name** to `FRONTEND_ORIGIN` and paste this exact **value** into its value field:

```text
https://urban-air-quality-assistant-pi.vercel.app
```

Render's value field takes the bare origin. Leave out shell quotes, the variable name, a trailing slash, paths, query strings and trailing commas. `FRONTEND_ORIGIN.0` identifies the first entry of the comma-separated allowlist.

A startup error containing `listen EADDRINUSE` means the requested address and port are already occupied. Check the listener before restarting locally, or choose another free local test port. Keep Render's port setting managed by Render.

### Troubleshooting a port scan timeout

Keep the Render Start Command as `npm --prefix backend start` and remove any custom `PORT=5001` override. Render provides `RENDER=true` and the runtime `PORT`. The app forces production mode on Render, skips `backend/.env` on hosted and production startup, and requires the runtime port. Its startup log shows the actual bound address, port and mode. Expect `Urban Air Quality API listening on 0.0.0.0:10000 (production)` with Render's default port.

If the log still says only `listening on port 5001`, check the deployed Git revision and start command. That is the older log format. The local development fallback remains `127.0.0.1:5001`. Internal HTTP `GET /api/v1/health` returns 200 without forwarded HTTPS or client-IP headers. Other production API requests still require the existing forwarding checks.

## 3. Vercel Hobby frontend

| Setting | Value |
| --- | --- |
| Framework Preset | Vite |
| Plan | Hobby |
| Source | Same GitHub repo and approved branch |
| Root Directory | Repository root |
| Node.js Version | `24.x` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Start Command | None. Vercel serves static files. |
| Production environment variable | `VITE_API_BASE_URL=https://urban-air-api.onrender.com`, using your actual Render origin |

Do not add any provider keys to Vercel or use a `VITE_` prefix for secrets. The API URL is public. Set it before building so the production CSP can allow that exact origin. Preview deployments have distinct origins and intentionally do not share API access unless individually approved in Render. Hash routing requires no catch-all rewrite. `vercel.json` supplies static security headers. The build injects a CSP that allows same-origin assets and fonts, OpenStreetMap images, the Render API and optional BigDataCloud lookup. Inline styles are allowed for current Motion, Leaflet and canvas layout; scripts remain same-origin. [Vercel configuration](https://vercel.com/docs/project-configuration) · [Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

## 4. Local tests and approved post-deploy smoke test

Run from the repository root with Node 24:

```sh
npm ci
npm --prefix backend ci
npm --prefix backend test
npm --prefix backend run lint
npm --prefix backend run format:check
VITE_API_BASE_URL=https://urban-air-api.onrender.com npm run build
```

After an approved deployment:

1. Open `https://<render-service>.onrender.com/api/v1/health` and confirm HTTP 200 with `success: true`. The first request after idle may wait for Render to wake. Do not add keep-awake pings.
2. Confirm the Vercel URL and Render URL redirect to HTTPS, and check the CSP and security headers on the Vercel page. On a real device verify geolocation allow and deny, character images, animated sky, chart, fonts and map attribution.
3. In the browser, search a public city, ask one cross-city chat question and refresh the planner once. Check that browser API requests go directly to Render. Confirm the session request succeeds and subsequent AI requests use `X-AI-Session`. A direct AI POST without a session should return 401. An unlisted frontend origin should get 403.
4. Verify from Render that different actual clients are bucketed separately and that a client-supplied forwarding prefix cannot change the observed nearest client address. Use the Render logs and request IDs with a small, approved traffic sample. Do not increase proxy trust to make a failing test pass.
5. In Render's service logs, filter for `api_request`, HTTP 429 and 5xx, or the `X-Request-Id`. Logs contain request IDs, route templates, status, sanitized error codes and latency. Private text, positions, headers and keys are excluded.

The local guard allows six anonymous session issues per IP per minute, four AI actions per IP per minute and 30 per day, and three AI actions per session per minute. Sessions expire after 30 minutes, bind to the origin and client IP bucket, and live only in browser memory. Groq completions, including tool follow-ups, share a global budget and two concurrent slots. These counters, signatures and cache are per process and reset when Render restarts. Quota responses include `Retry-After` where available. A free-service restart, model throttling, provider outage, or distributed client can still interrupt chat or planning.
