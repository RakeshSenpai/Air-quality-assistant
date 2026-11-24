import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react'
import { ArrowUpRight, MapPin, Shield } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { getCategory, indexLabel, scaleFor } from '../data/air'
import { locationLabel } from '../data/locations'

import { airScenes, getAirScene } from '../data/airScenes'
import AirEnvironment from './AirEnvironment'
import HeroWeather from './HeroWeather'
import PollutionParticles from './PollutionParticles'
import PollutionStreaks from './PollutionStreaks'
import { mobileAtmosphereQuery, visibleCount } from './AtmosphereCanvas'
import { useAtmosphereMotion } from '../hooks/useAtmosphereMotion'

const imagePath = (file) => `${import.meta.env.BASE_URL}images/aqi-states/${file}.png`

const simulationEnabled = __AQI_DEV_SERVER__ && import.meta.env.DEV && import.meta.env.VITE_ENABLE_AQI_SIMULATION === 'true'

function AqiCounter({ value }) {
  const output = useRef(null)
  const previous = useRef(value)
  const reduced = useReducedMotion()
  useEffect(() => {
    const start = previous.current
    if (reduced || start === value) {
      output.current.textContent = value
      previous.current = value
      return
    }
    const animation = animate(start, value, {
      duration: .42,
      onUpdate: (reading) => {
        previous.current = reading
        if (output.current) output.current.textContent = Math.round(reading)
      },
    })
    return () => animation.stop()
  }, [value, reduced])
  return <strong className="hero-number" aria-label={`AQI ${value}`}><span ref={output} aria-hidden="true">{value}</span></strong>
}

function AqiScale({ value, standard }) {
  const categories = scaleFor(standard)
  return <div className="hero-scale" aria-label={`${indexLabel(standard)} category scale`}>
    <div className="hero-scale-track">
      {categories.map(({ max, color, label }, i) => <span title={label} key={label} style={{ background: color, flexGrow: max - (categories[i - 1]?.max ?? 0) }} />)}
      <i style={{ left: `${Math.min(100, value / 5)}%` }} />
    </div>
    <div className="scale-labels"><span>0 · Good</span><span>500{standard === 'us' ? '+' : ''} · {categories.at(-1).label}</span></div>
  </div>
}

export default function AirHero({ city }) {
  const hero = useRef(null)
  const atmosphereRunning = useAtmosphereMotion(hero)
  const identity = `${city.id}:${city.coordinates.join(',')}:${city.sourceDemo}`
  const [simulation, setSimulation] = useState(null)
  if (simulation && simulation.identity !== identity) setSimulation(null)
  const simulated = simulationEnabled && simulation?.identity === identity
  const reduced = useReducedMotion()
  const standard = simulated ? simulation.standard : city.standard
  const value = simulated ? simulation.value : city.aqi
  const scene = getAirScene(!simulated && city.beyondScale ? 500 : value, standard)
  const category = scene?.category ?? getCategory(null, standard)
  const stage = scene ? scene.stage + 1 : 0
  const [simulationStandard, setSimulationStandard] = useState('us')
  const [mobileEffects, setMobileEffects] = useState(false)
  const sliderValue = simulated ? value : scene ? Math.min(500, Math.round(value)) : 0

  useEffect(() => {
    if (!simulationEnabled) return
    const preloaded = airScenes.map(({ file }) => {
      const image = new Image()
      image.src = imagePath(file)
      return image
    })
    return () => { preloaded.length = 0 }
  }, [])

  useEffect(() => {
    if (!simulationEnabled) return
    const query = window.matchMedia(mobileAtmosphereQuery)
    const update = () => setMobileEffects(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  function preview(value, index = simulationStandard) {
    if (!Number.isFinite(value)) return
    setSimulation({ identity, value: Math.max(0, Math.min(500, Math.round(value))), standard: index })
  }

  return <>
    <section className="air-hero" ref={hero} data-stage={stage}
      style={scene ? {
        '--sky': scene.sky, '--horizon': scene.horizon, '--cloud': scene.cloud,
        '--cloud-strength': scene.cloudOpacity, '--haze': scene.haze, '--skyline': scene.skyline,
      } : undefined}>
      <AirEnvironment scene={scene} running={atmosphereRunning} />
      <PollutionParticles count={scene?.dust ?? 0} stage={stage} running={atmosphereRunning && Boolean(scene)} />
      <PollutionStreaks count={scene?.streaks ?? 0} stage={stage} running={atmosphereRunning && Boolean(scene)} />
      <div className="air-hero-copy">
        <div className="hero-location"><MapPin size={17} aria-hidden="true" />{locationLabel(city)}</div>
        <div className="hero-aqi">{scene ? <AqiCounter key={identity} value={value} /> : <strong className="hero-number" aria-label="AQI unavailable">—</strong>}<span>{indexLabel(standard)}</span></div>
        <p className="hero-category" key={category.label} style={{ '--severity': category.color }}><i />{city.pending && !simulated ? 'Loading AQI…' : category.label}</p>
        {!simulated && city.beyondScale && <p className="metadata">Above the standard 0–500 AQI scale</p>}
        <dl className="hero-particles">
          {['PM2.5', 'PM10'].map((name, index) => <div key={name}><dt>{name}</dt><dd>
            {Number.isFinite(city.values[index]) ? <>{city.values[index]} <small>µg/m³</small></> : '—'}
          </dd></div>)}
        </dl>
        {scene && <AqiScale value={value} standard={standard} />}
        <div className="hero-guidance"><Shield size={18} aria-hidden="true" /><div><h2>Exposure guidance</h2><p>{city.pending && !simulated ? 'Waiting for air quality data for this location.' : category.detail}</p></div></div>
        <p className="metadata">{simulated ? 'Development simulation · no live reading' : city.timestamp && `${city.timestamp} · ${city.sourceDemo ? 'Demo data' : 'Modeled AQI estimate'}`}</p>
        <NavLink className="primary-button" to="/air-quality">Explore air quality <ArrowUpRight size={16} /></NavLink>
      </div>
      <figure className="air-scene" data-stage={stage}>
        <div className="air-character">
          {scene && <AnimatePresence initial={false}>
            <motion.img key={`${identity}:${scene.file}`} src={imagePath(scene.file)} alt={scene.alt} width="1024" height="1536"
              initial={{ opacity: 0, scale: reduced ? 1 : .985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: reduced ? 1 : 1.01 }}
              transition={{ duration: reduced ? 0 : .5 }} />
          </AnimatePresence>}
        </div>
        <figcaption>{scene ? 'Illustration of potential exposure risk' : city.pending ? 'Loading local conditions…' : 'No current AQI for this location'}</figcaption>
      </figure>
      <HeroWeather city={city} />
    </section>
    {simulationEnabled && <details className="dev-simulation">
      <summary>Development AQI simulation</summary>
      <label htmlFor="simulation">Simulated AQI</label>
      <div className="simulation-inputs">
        <input id="simulation" type="range" min="0" max="500" step="1" value={sliderValue}
          onChange={(event) => preview(event.target.valueAsNumber)} />
        <input type="number" min="0" max="500" aria-label="Exact simulated AQI" value={sliderValue}
          onChange={(event) => preview(event.target.valueAsNumber)} />
        <select aria-label="Simulation AQI standard" value={simulationStandard} onChange={(event) => {
          setSimulationStandard(event.target.value)
          if (simulated) preview(sliderValue, event.target.value)
        }}>
          <option value="us">US AQI</option><option value="in">Indian National AQI</option>
        </select>
      </div>
      <p className="metadata" aria-live="polite">{simulated ? 'Simulated' : 'Current'} · {category.label}
        {' · Dust: '}{reduced ? 0 : visibleCount(scene?.dust ?? 0, mobileEffects)}
        {' · Streaks: '}{reduced ? 0 : visibleCount(scene?.streaks ?? 0, mobileEffects)}
        {' · Cloud loops (back / mid / front): '}{reduced || !scene ? 'paused' : Object.values(scene.cloudLoops).map((seconds) => `${seconds}s`).join(' / ')}
      </p>
      <button className="outline-control" onClick={() => setSimulation(null)} disabled={!simulated}>Use current location AQI</button>
    </details>}
  </>
}
