# Urban Air Quality Assistant

**Read the air. Plan your day.**

Urban Air Quality Assistant is a browser dashboard for exploring local air quality, weather and practical ways to plan around pollution. Search worldwide or select one of five Indian presets. The dashboard loads location-based modeled air quality by default.

## The problem

Urban pollution and winter smog can change throughout the day. A single AQI number gives residents limited context for decisions such as when to exercise outdoors, ventilate a home or plan a family outing.

## Our solution

The dashboard pairs AQI with pollutant concentrations, local weather and hourly trends. An illustrated scene makes pollution severity easy to scan. Household-specific guidance helps users find practical alternatives when the air is poor.

## Key features

- Worldwide location search and opt-in device location.
- Current modeled US AQI, six pollutant types where available, hourly trends and daily forecast peaks. Preset demos use fictional Indian National AQI snapshots.
- Six character illustrations and AQI-reactive skies, clouds, haze, dust and streaks. The streaks are an artistic pollution cue.
- Local temperature, conditions, humidity, wind and UV where available.
- Map for the selected location and five demo cities, with OpenStreetMap tiles.
- Daily plans for individuals, households with children and households with older adults. Includes indoor air guidance and a sustainability checklist.
- Groq chat and structured daily plans in modeled mode when the backend key is configured. Chat remembers the last four completed exchanges for follow-ups, renders Markdown, and offers retry and New conversation controls. Demo mode keeps the local scripted assistant and planner.
- Ask for AQI, weather, forecasts, or a comparison of up to three cities in chat. For example, ask “What is the AQI in Bengaluru?” while Mumbai is selected. Lookups leave the dashboard selection unchanged. If the assistant suggests a location, reply “yes” to fetch data for that place, or name a different region or country. The assistant remembers the resolved place for follow-ups.

## Technology stack

| Area | Tools |
| --- | --- |
| Backend | Node.js, Express 5, Zod, Groq SDK |
| Frontend | React 19, JavaScript, Vite 7, React Router 7 |
| UI and atmosphere | Tailwind CSS 4, Motion 12, Lucide, SVG and Canvas 2D |
| Charts and maps | Recharts 3, Leaflet 1.9, OpenStreetMap |
| Data | Open-Meteo Air Quality and Forecast, Copernicus CAMS, Open-Meteo Geocoding and BigDataCloud |

## How it works

1. Search for a city, choose a preset or grant device location access.
2. Read the AQI, pollutant concentrations, weather and forecasts. The source label identifies modeled estimates. If air quality is unavailable, the dashboard shows a retry action. The map and Compare cities retain separately labeled sample readings.
3. Open the planner, choose a household profile or ask the assistant for guidance.

The app uses coordinates for air quality and weather queries. When you request device location, it also sends the coordinates to BigDataCloud for a readable locality name. Device location and searched locations are held in the current page session. Preset city, household profile and action selections are saved locally in the browser.

## Screenshots

*Screenshots placeholder. No dashboard screenshots are included in this workspace.*

## Getting started

Use Node.js 24 LTS or 22.12+ in the Node 22 LTS line.

```sh
npm ci
npm --prefix backend ci
npm --prefix backend run dev
```

In another terminal, run `npm run dev` and open the Vite address. To check the build, run `npm run build`. The backend test suite runs with `npm --prefix backend test`.

To enable the hero simulator, run `VITE_ENABLE_AQI_SIMULATION=true npm run dev`. It accepts 0–500 across both supported AQI scales and shows particle counts and cloud loop durations. To test the scripted assistant and fictional preset readings, run `VITE_ENABLE_DEMO_DATA=true npm run dev`. Both flags default to off and apply only to the development server.

## Environment configuration

The public endpoints run with default local settings. To enable Groq, set `GROQ_API_KEY` in the private `backend/.env` file. See [backend setup](backend/README.md) for `AI_PROVIDER=groq`, `GROQ_MODEL=openai/gpt-oss-120b`, and origin settings. Vite development and preview proxy `/api/v1` to `127.0.0.1:5001`. If you override `FRONTEND_ORIGIN`, include the exact local preview origin to use API-backed features on port 4173. Device geolocation requires permission and a secure context.

## Project structure

| Path | Purpose |
| --- | --- |
| [backend/](backend/) | REST API, Groq and provider adapters, tests |
| [src/App.jsx](src/App.jsx) | Routes, shared state and page composition |
| [src/components/](src/components/) | Dashboard, hero, weather, search and map |
| [src/data/](src/data/) | AQI scales, scene settings, data adapters and guidance |
| [src/hooks/](src/hooks/) | Air quality requests and atmospheric motion |
| [public/images/aqi-states/](public/images/aqi-states/) | Six character illustrations |

See [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for the architecture, exact package versions, feature inventory and AQI mappings.

## Development status

This is a full-stack prototype. Open-Meteo returns model estimates and forecasts. Demo readings and community activities are fictional. Groq integration requires a private key and project access. No production deployment is configured.

The 2026-11-24 local pre-production audit covered all seven primary routes, live Open-Meteo comparisons and Groq workflows, a simulated provider outage, six AQI stages, and three browser viewport widths. The backend suite, lint, formatting, dependency audits and production build passed. Public deployment remains pending. See the [audit findings](PROJECT_CONTEXT.md#pre-production-audit) for launch blockers and verification limits.

## Deployment preparation

See [DEPLOYMENT.md](DEPLOYMENT.md) for the GitHub, Vercel Hobby and Render Free setup, verification steps and publishing prerequisites. Production chat and planning use short-lived anonymous sessions and quota limits. Visitors can use the dashboard without an account.

## Future improvements

- Expand backend regression tests with browser automation.
- Expand accessibility and device testing.
- Verify hosted ingress, free-tier behavior, privacy disclosures and asset rights before public exposure.

## Contributing

Read [AGENTS.md](AGENTS.md) and the relevant sections of [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md). Keep changes focused, verify affected behavior locally and run `npm run build`. Document verified changes and call out any remaining testing gaps.

## License

No license file is included. Licensing for the code and assets has not been established in this workspace.
