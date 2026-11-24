# Urban Air Quality Assistant API

This Express service serves the existing React app. It validates requests, fetches modeled conditions from Open-Meteo, and uses the official Google Gen AI SDK for live chat and structured daily plans.

## Start locally

Use Node.js 24 LTS or 22.12+ in the Node 22 LTS line. From the repository root:

```sh
npm --prefix backend ci
npm --prefix backend run dev
```

Use `npm --prefix backend start` for normal startup. The listener defaults to loopback and port 5001 during development. The frontend's Vite development and preview servers proxy `/api/v1` to port 5001. For another port or a separate host, set the public frontend variable `VITE_API_BASE_URL` and allow the frontend's exact origin on the backend. For local preview on port 4173, include the exact preview origin in any existing private `FRONTEND_ORIGIN` override. The local defaults and example already allow port 4173.

### Configuration

Use [the example](.env.example) to create `backend/.env` if it is absent. Keep an existing private file and add missing named settings locally.

| Setting | Purpose |
| --- | --- |
| `NODE_ENV` | Defaults to `development`. Production requires explicit allowed origins |
| `PORT` | Defaults to `5001` |
| `FRONTEND_ORIGIN` | Comma-separated exact HTTP(S) origins. Defaults to the localhost and loopback Vite origins |
| `AI_PROVIDER` | Defaults to `groq` |
| `GROQ_API_KEY` | Private Groq key for chat and planner. These routes return 503 if it is absent |
| `GROQ_MODEL` | Defaults to `openai/gpt-oss-120b`. Set a supported model available to your project if necessary |
| `TRUST_PROXY_HOPS` | `0` locally. Set `1` on the documented single-hop Render production deployment |
| `AI_GLOBAL_PER_MINUTE`, `AI_GLOBAL_PER_DAY` | Production Groq completion budgets, default 6 and 80 |
| `CACHE_TTL_MS` | Environmental and location cache lifetime. Defaults to 120000 ms |

Chat and the planner use the official Groq SDK with a 20-second timeout and no automatic generation retries. GPT-OSS uses strict structured output for the planner and suppresses reasoning output. Chat includes up to four completed exchanges and a bounded AQI forecast. On HTTP 429, the backend forwards the provider's Retry-After and suppresses new provider calls during that interval. Verify model access in the account before changing the configured model. [Groq models](https://console.groq.com/docs/models) · [Groq rate limits](https://console.groq.com/docs/rate-limits)

## Endpoints

All paths are relative to `/api/v1`. Coordinates are decimal degrees.

| Method | Path | Input and response |
| --- | --- | --- |
| GET | `/health` | Service uptime probe independent of providers |
| GET | `/locations/search` | Query `q` of 2–120 characters. Returns up to eight places with coordinates and available region, country and timezone |
| GET | `/air-quality` | Query `latitude` and `longitude`. Modeled US AQI, category, pollutants and units, local timestamp, hourly trend and future daily peaks |
| GET | `/weather` | Same coordinate query. Current temperature, apparent temperature, humidity, wind, weather code and precipitation, with hourly values and current-hour UV |
| POST | `/assistant/chat` | Coordinates, `message` up to 500 characters and up to eight history messages. Optional `location`, `profile`, `language`, and `preferences`. Returns a reply and model ID |
| POST | `/planner/generate` | Coordinates and optional `location`, `profile`, `language`, and `preferences`. Returns validated morning, afternoon and evening tips with the modeled peak AQI where available |
| POST | `/recommendations/indoor-air` | Coordinates. Returns general tips and a ventilation note based on available modeled conditions |
| POST | `/recommendations/sustainability` | Coordinates and optional selected action IDs. Returns practical actions and a suggested next step |

Profiles are `individual`, `children` and `older`. History entries contain `role` (`user` or `assistant`) and `text`. A successful request returns `{ "success": true, "data": ... }`. A failure returns `{ "success": false, "error": { "code": "...", "message": "..." } }` with an appropriate HTTP status. Missing readings stay null or unavailable.

## Follow an air quality request

```sh
curl 'http://127.0.0.1:5001/api/v1/air-quality?latitude=28.61&longitude=77.21'
```

1. [app.js](src/app.js) applies security headers, origin policy, rate limiting and JSON handling.
2. [routes.js](src/routes.js) matches the URL and invokes [validation.js](src/validation.js) to check both coordinates. The small route handler passes the validated values to the provider.
3. [providers.js](src/providers.js) reuses a fresh cache entry or calls Open-Meteo with a timeout. It validates the reply, classifies US AQI using the shared AQI table, and normalizes timestamps, concentrations and forecasts.
4. The route returns the normalized data under `data`. React updates its cards, charts and visual severity stage. [errors.js](src/errors.js) sends a safe error if the request fails.

Separate [server.js](src/server.js) starts the listener and handles shutdown. Importing the app for testing does not start that listener.

## Testing

```sh
npm --prefix backend test
npm --prefix backend run lint
npm --prefix backend run format:check
```

Vitest and Supertest exercise requests with mocked Open-Meteo and Groq responses. Tests need no credentials and consume no Groq quota. For local smoke tests, call `/api/v1/health`, then search and query air quality and weather. Use the frontend modeled-data mode to test the live assistant or planner after configuring Groq.

## Security and limits

Helmet, a 32 KB JSON limit, Zod, restricted CORS and request limits protect the API. The general limit is 120 requests per minute per IP, with a shared limit of eight per minute for chat and planner. Limits and the bounded provider cache are per process. Only normalized environmental data and place searches are cached. Chat and planner use server-fetched context, keep system instructions separate from submitted text, and omit raw coordinate fields from Groq prompts. The caller's message and preferences may still contain personal information.

This service has no authentication. Before public exposure, protect the AI endpoints with authenticated access or an equivalent access policy and provider quota controls. If deploying behind a proxy, configure trusted proxy hops for correct client IP limits. Verify provider terms and secure transport for the deployment. No deployment target is configured.


Production chat and planning require a signed anonymous session issued by `POST /api/v1/assistant/session` from the approved HTTPS frontend origin. Send the token in `X-AI-Session`. The frontend handles this internally. The session, IP and global completion budgets are per process. See [DEPLOYMENT.md](../DEPLOYMENT.md) for ingress, quota configuration, logs and smoke tests.
