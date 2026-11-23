# Urban Air Quality Assistant

**Read the air. Plan your day.**

Urban Air Quality Assistant is a browser dashboard for exploring local air quality, weather and practical ways to plan around pollution. Search worldwide or try one of five Indian demo cities.

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
- A **scripted demo assistant** that uses the current location, AQI and household profile.

## Technology stack

| Area | Tools |
| --- | --- |
| Frontend | React 19, JavaScript, Vite 7, React Router 7 |
| UI and atmosphere | Tailwind CSS 4, Motion 12, Lucide, SVG and Canvas 2D |
| Charts and maps | Recharts 3, Leaflet 1.9, OpenStreetMap |
| Data | Open-Meteo Air Quality and Forecast, Copernicus CAMS, Open-Meteo Geocoding and BigDataCloud |

## How it works

1. Search for a city, choose a preset or grant device location access.
2. Read the AQI, pollutant concentrations, weather and forecasts. The source label identifies modeled estimates and fictional demo data.
3. Open the planner, choose a household profile or ask the demo assistant for guidance.

The app uses coordinates for air quality and weather queries. When you request device location, it also sends the coordinates to BigDataCloud for a readable locality name. Device location and searched locations are held in the current page session. Preset city, household profile and action selections are saved locally in the browser.

## Screenshots

*Screenshots placeholder. No dashboard screenshots are included in this workspace.*

## Getting started

Use Node.js 20.19 or later in the 20.x line, or Node.js 22.12 or later, with npm.

```sh
npm install
npm run dev
```

Open the local address printed by Vite. To build and preview the production assets:

```sh
npm run build
npm run preview
```

The development-only AQI simulator accepts 0–500 and previews the hero across both supported AQI scales. It displays particle counts and cloud loop durations. It leaves provider readings intact.

## Environment configuration

No environment variables or API keys are required. The browser requests public data directly. Device geolocation requires permission and a secure context, such as localhost or HTTPS. Public service availability affects live results.

## Project structure

| Path | Purpose |
| --- | --- |
| [src/App.jsx](src/App.jsx) | Routes, shared state and page composition |
| [src/components/](src/components/) | Dashboard, hero, weather, search and map |
| [src/data/](src/data/) | AQI scales, scene settings, data adapters and guidance |
| [src/hooks/](src/hooks/) | Air quality requests and atmospheric motion |
| [public/images/aqi-states/](public/images/aqi-states/) | Six character illustrations |

See [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for the architecture, exact package versions, feature inventory and AQI mappings.

## Development status

This is a frontend prototype. Open-Meteo returns model estimates and forecasts. Demo readings and community activities are fictional, and assistant responses are scripted. The workspace has no backend, automated test suite or deployment configuration.

## Future improvements

- Add regression tests for AQI boundaries, location changes and provider errors.
- Expand accessibility and device testing.
- Evaluate a secure AI backend and document deployment when a target is chosen.

## Contributing

Read [AGENTS.md](AGENTS.md) and the relevant sections of [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md). Keep changes focused, verify affected behavior locally and run `npm run build`. Document verified changes and call out any remaining testing gaps.

## License

No license file is included. Licensing for the code and assets has not been established in this workspace.
