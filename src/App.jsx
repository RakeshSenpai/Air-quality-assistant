import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowUpRight, Bell, CalendarDays, ChevronDown, CircleUserRound, BookOpen, House, Leaf, MapPin, Menu, Sparkles, Users, Wind, X } from 'lucide-react'
import { AQICard, AQIChart, Assistant, Card, Choices, Heading, Plan, PollutantComparison, Pollutants, Tips } from './components/Dashboard'
import { cities, getCategory, indexLabel, scaleFor } from './data/air'
import { events, profiles, tips } from './data/guidance'
import { useCityAir } from './hooks/useCityAir'
import AirHero from './components/AirHero'
import LocationSearch from './components/LocationSearch'

const PollutionMap = lazy(() => import('./components/PollutionMap'))

const navigation = [
  ['/', 'Dashboard', House], ['/air-quality', 'Air Quality', Wind],
  ['/daily-planner', 'Daily Planner', CalendarDays], ['/indoor-air', 'Indoor Air', BookOpen],
  ['/sustainability', 'Sustainability', Leaf],
]
const subtitles = {
  '/air-quality': ['Air Quality', 'Explore pollution readings, forecasts, and the air quality map.'],
  '/map': ['Pollution Map', 'Explore air quality at the selected location and compare demo cities.'],
  '/daily-planner': ['Daily Planner', 'Build a routine around local air quality and your household’s needs.'],
  '/indoor-air': ['Indoor Air', 'Practical ways to reduce indoor pollution and exposure at home.'],
  '/community': ['Community', 'Explore local sample activities and share air quality habits with neighbours.'],
  '/sustainability': ['Sustainability', 'Build daily habits that can help reduce emissions.'],
}

function MainLinks({ close }) {
  return navigation.map(([to, label]) => <NavLink key={to} end={to === '/'} to={to} onClick={close}>{label}</NavLink>)
}

function usePreference(key, fallback, isValid) {
  const [value, setValue] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key))
      return isValid(saved) ? saved : fallback
    } catch { return fallback }
  })
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Storage can be unavailable in private contexts. */ }
  }, [key, value])
  return [value, setValue]
}

function ProfileSelect({ profile, setProfile, id }) {
  return <div className="profile-field">
    <label htmlFor={id}>Family profile</label>
    <div className="select-wrap">
      <select id={id} value={profile.id} onChange={(event) => setProfile(event.target.value)}>
        {profiles.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
      </select>
      <ChevronDown aria-hidden="true" size={16} />
    </div>
  </div>
}

function Header({ city, selectLocation, profile, setProfile, drawer, setDrawer, openChat }) {
  const [panel, setPanel] = useState('')
  const [seen, setSeen] = useState([])
  const controls = useRef(null)
  const notifications = useRef(null)
  const account = useRef(null)
  useEffect(() => {
    function closeOutside(event) {
      if (!controls.current?.contains(event.target)) setPanel('')
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape' && panel) {
        setPanel('')
        const trigger = panel === 'alerts' ? notifications : account
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [panel])
  const category = getCategory(city.aqi, city.standard)
  const peak = city.hours.filter((point) => point.type === 'Forecast' && Number.isFinite(point.aqi))
    .reduce((highest, point) => !highest || point.aqi > highest.aqi ? point : highest, null)
  return <header className="topbar">
    <button className="icon-button menu-toggle" aria-label={drawer ? 'Close navigation' : 'Open navigation'} aria-expanded={drawer} aria-controls="mobile-nav" onClick={() => setDrawer(!drawer)}>
      {drawer ? <X /> : <Menu />}
    </button>
    <NavLink to="/" className="brand" aria-label="Urban Air Quality Assistant" onClick={() => setDrawer(false)}><span className="brand-mark"><Wind size={20} aria-hidden="true" /></span><span>Urban Air<span className="brand-extra"> Quality Assistant</span></span></NavLink>
    <nav className="desktop-nav" aria-label="Main navigation"><MainLinks /></nav>
    {drawer && <nav className="mobile-nav" id="mobile-nav" aria-label="Mobile navigation"><MainLinks close={() => setDrawer(false)} /></nav>}
    <LocationSearch city={city} selectLocation={selectLocation} />
    <div className="header-controls" ref={controls}>
      <button className="icon-button assistant-trigger" aria-label="Open AI assistant" aria-haspopup="dialog" onClick={() => {
        setPanel('')
        setDrawer(false)
        openChat()
      }}><Sparkles size={19} aria-hidden="true" /></button>
      <button ref={notifications} className="icon-button notification" aria-label="Notifications" aria-expanded={panel === 'alerts'} onClick={() => {
        setPanel(panel === 'alerts' ? '' : 'alerts')
        setSeen((previous) => previous.includes(city.id) ? previous : [...previous, city.id])
      }}>
        <Bell aria-hidden="true" />{!seen.includes(city.id) && <i />}
      </button>
      <button ref={account} className="icon-button avatar" aria-label="Profile preferences" aria-expanded={panel === 'profile'} onClick={() => setPanel(panel === 'profile' ? '' : 'profile')}><CircleUserRound aria-hidden="true" /></button>
      {panel === 'alerts' && <section className="popover" aria-label="Air quality alerts">
        <Heading>Air quality alerts</Heading>
        <p className="metadata">{city.sourceDemo ? 'Demo data' : 'Open-Meteo'} · {city.name}</p>
        <ul className="alert-list">
          <li><strong>{indexLabel(city.standard)} · {category.label}</strong><p>{Number.isFinite(city.aqi) ? `AQI ${city.aqi}. ` : ''}{category.detail}</p></li>
          {peak && <li><strong>Remaining hours</strong><p>Forecast peak AQI {peak.aqi} at {peak.time}.</p></li>}
        </ul>
      </section>}
      {panel === 'profile' && <section className="popover" aria-label="Profile preferences">
        <Heading>Profile preferences</Heading>
        <p className="metadata">Saved on this device.</p>
        <ProfileSelect id="header-profile" profile={profile} setProfile={setProfile} />
      </section>}
    </div>
  </header>
}

const shortcuts = [
  ['/air-quality', 'Air quality', 'Pollutants and forecasts', Wind],
  ['/daily-planner', 'Daily planner', 'Plans for your household', CalendarDays],
  ['/indoor-air', 'Indoor air', 'Practical home guidance', House],
  ['/sustainability', 'Sustainability', 'Everyday actions', Leaf],
]

function Dashboard({ city, demoMode }) {
  const forecast = city.hours.filter(({ type, aqi }) => type === 'Forecast' && Number.isFinite(aqi)).slice(0, 3)
  return <div className="dashboard-grid">
    <AirHero city={city} demoMode={demoMode} />
    <Pollutants city={city} compact />
    <div className="dashboard-outlook">
      <AQIChart city={city} />
      <Card className="forecast-card"><Heading icon={CalendarDays}>Short forecast</Heading>
        {forecast.length ? <ul>{forecast.map(({ time, aqi }) => {
          const category = getCategory(aqi, city.standard)
          return <li key={time}><span>{time}<small>{category.label}</small></span><strong style={{ color: category.color }}>{aqi}</strong></li>
        })}</ul> : <p className="body-copy">No later hourly values are available today.</p>}
        <Link className="text-link" to="/air-quality">View detailed forecast <ArrowUpRight size={15} /></Link>
      </Card>
    </div>
    <div className="shortcut-grid">{shortcuts.map(([to, title, description, Icon]) => <Link to={to} key={to}>
      <Icon size={19} aria-hidden="true" /><div><strong>{title}</strong><span>{description}</span></div><ArrowUpRight size={15} aria-hidden="true" />
    </Link>)}</div>
  </div>
}

function AirQuality({ city, setCity }) {
  const categories = scaleFor(city.standard)
  return <div className="page-stack">
    <AQICard city={city} />
    <Pollutants city={city} />
    <AQIChart city={city} large />
    <div className="two-columns"><AQIChart city={city} daily /><PollutantComparison city={city} /></div>
    <Card className="map-link"><Heading icon={MapPin} detail="View the selected location and demo cities.">Pollution Map</Heading><Link className="outline-control" to="/map">Open map</Link></Card>
    <div className="two-columns">
      <Card><Heading icon={MapPin} detail="Indian National AQI · demo readings">Compare cities</Heading><div className="comparison">
        {cities.map(({ id, name, aqi }) => <button key={id} aria-pressed={id === city.id} onClick={() => setCity(id)}>
          <span>{name}</span><strong>{aqi}</strong><small>{getCategory(aqi).label}</small>
        </button>)}
      </div></Card>
      <Card><Heading icon={Wind}>{indexLabel(city.standard)} categories</Heading><ul className="category-list">
        {categories.map(({ label, max, color, detail }, index) => <li key={label}>
          <span style={{ color }}>{index ? categories[index - 1].max + 1 : 0}{city.standard === 'us' && index === 5 ? '+' : `–${max}`}</span><div><strong>{label}</strong><p>{detail}</p></div>
        </li>)}
      </ul></Card>
    </div>
  </div>
}

function DailyPlanner({ city, profile, setProfile }) {
  const [revision, setRevision] = useState(0)
  return <div className="page-stack">
    <Card className="planner-settings"><div><Heading icon={Wind}>{city.name}</Heading><p className="body-copy">{Number.isFinite(city.aqi) ? `${indexLabel(city.standard)} ${city.aqi} · ${getCategory(city.aqi, city.standard).label}` : 'Current AQI unavailable'}</p></div><ProfileSelect id="planner-profile"  profile={profile} setProfile={setProfile} /><button className="primary-button" onClick={() => setRevision((value) => value + 1)}>Refresh plan</button></Card>
    <motion.div key={revision} initial={revision ? { opacity: .55 } : false} animate={{ opacity: 1 }}><Plan city={city} profile={profile} full /></motion.div>
    <p className="sr-only" role="status">{revision ? `Plan refreshed ${revision} ${revision === 1 ? 'time' : 'times'}` : ''}</p>
    <div className="two-columns">
      <Card><Heading icon={House}>Indoor options</Heading><p className="body-copy">Keep a short indoor movement routine or an activity for the household ready for higher AQI periods.</p></Card>
      <Card><Heading icon={Wind}>Outdoor planning</Heading><p className="body-copy">Use lower AQI periods for essential trips. Check actual conditions before making a real outing plan.</p></Card>
    </div>
  </div>
}

const filters = ['All', 'Indoor', 'Smog safety', 'Low-cost', 'Sustainable']
function Guides() {
  const [filter, setFilter] = useState('Indoor')
  return <div className="page-stack">
    <div className="filters" aria-label="Guide categories">
      {filters.map((label) => <button key={label} aria-pressed={filter === label} onClick={() => setFilter(label)}>{label}</button>)}
    </div>
    <Tips title="Air quality guides" detail="Expand a recommendation for practical steps."
      items={filter === 'All' ? tips : tips.filter(({ category }) => category === filter || (filter === 'Indoor' && ['Low-cost', 'Smog safety'].includes(category)))} />
  </div>
}

function Sustainability({ selected, toggleAction }) {
  return <div className="page-stack">
    <Choices selected={selected} toggleAction={toggleAction} full />
    <Card><Heading icon={House}>Household sustainability</Heading>
      <p className="body-copy">Reuse durable items where practical and follow local collection rules for recycling. Avoid burning household waste, which releases smoke and particles into the air.</p>
    </Card>
    <Card><Heading icon={CalendarDays}>Daily environmental habits</Heading>
      <p className="body-copy">Combine errands, switch off idle devices, and pick a small action to repeat this week. The checklist tracks your choices on this device.</p>
    </Card>
  </div>
}

function Community({ city }) {
  return <div className="page-stack">
    <Card>
      <Heading icon={Users} detail={`Sample local activities for ${city.name}.`}>Around your community</Heading>
      <div className="plan-grid">{events.map(({ title, time, detail }) => <article key={title} className="inset event"><p className="metadata">{time}</p><h3>{title}</h3><p>{detail}</p></article>)}</div>
    </Card>
    <div className="two-columns">
      <Card><Heading icon={Leaf}>Help reduce neighbourhood smoke</Heading><p className="body-copy">Share local waste collection and recycling information with neighbours. Encourage households to skip open burning.</p></Card>
      <Card><Heading icon={BookOpen}>Share an air quality habit</Heading><p className="body-copy">Agree on an indoor backup location for group events and share how attendees can check air quality before leaving.</p></Card>
    </div>
  </div>
}

export default function App() {
  const { pathname } = useLocation()
  const [cityId, saveDemoCity] = usePreference('uaqa:city', 'delhi', (value) => cities.some(({ id }) => id === value))
  const [searchedLocation, setSearchedLocation] = useState(null)
  const [profileId, setProfile] = usePreference('uaqa:profile', 'children', (value) => profiles.some(({ id }) => id === value))
  const [selected, setSelected] = usePreference('uaqa:actions', [], Array.isArray)
  const [drawer, setDrawer] = useState(false)
  const chat = useRef(null)
  const baseCity = searchedLocation ?? cities.find(({ id }) => id === cityId)
  function selectLocation(location, { rename = false } = {}) {
    if (location.demo) {
      setSearchedLocation(null)
      saveDemoCity(location.id)
      return
    }
    if (rename) {
      setSearchedLocation((current) => current?.device && current.coordinates === location.coordinates ? location : current)
    } else {
      setSearchedLocation(location)
    }
  }
  function setCity(id) {
    const city = cities.find((item) => item.id === id)
    if (city) selectLocation(city)
  }
  const { city, mode, chooseMode, pending, error, retry } = useCityAir(baseCity)
  const demoMode = mode === 'demo'
  const profile = profiles.find(({ id }) => id === profileId)
  const [title, description] = subtitles[pathname] ?? []
  const toggleAction = (id) => setSelected((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id])
  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = pathname === '/' || !title ? 'Urban Air Quality Assistant' : `${title} | Urban Air Quality Assistant`
  }, [pathname, title])
  useEffect(() => {
    const viewport = window.visualViewport
    const dialog = chat.current
    if (!viewport || !dialog) return
    const resize = () => {
      if (viewport.scale === 1) dialog.style.setProperty('--chat-viewport', `${viewport.height}px`)
    }
    resize()
    viewport.addEventListener('resize', resize)
    return () => viewport.removeEventListener('resize', resize)
  }, [])
  useEffect(() => {
    if (!drawer) return
    function close(event) { if (event.key === 'Escape') setDrawer(false) }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [drawer])

  return <>
    <button className="skip-link" onClick={() => document.getElementById('main-content')?.focus()}>Skip to content</button>
    <div className="shell">
      <Header {...{ city, selectLocation, profile, setProfile, drawer, setDrawer }} openChat={() => chat.current.showModal()} />
      <dialog className="assistant-drawer" ref={chat} aria-labelledby="assistant-title"
        onClick={(event) => { if (event.target === event.currentTarget) chat.current.close() }}>
        <div className="assistant-shell">
          <header><div><h2 id="assistant-title"><Sparkles size={18} /> AI Air Quality Assistant</h2><p className="metadata">{city.name} · {Number.isFinite(city.aqi) ? `${indexLabel(city.standard)} ${city.aqi}` : 'AQI unavailable'} · {profile.label}</p></div>
            <button className="icon-button" onClick={() => chat.current.close()} aria-label="Close assistant"><X size={21} /></button>
          </header>
          <Assistant city={city} profile={profile} />
        </div>
      </dialog>
      <main id="main-content" tabIndex={-1}>
        <div className="hero">
          <h1>{title ?? 'Urban Air Quality Assistant'}</h1>
          {description && <p>{description}</p>}
        </div>
        <motion.div className="content" key={pathname} initial={{ opacity: 0.65, y: 5 }} animate={{ opacity: 1, y: 0 }}>
          {['/', '/air-quality', '/map', '/daily-planner'].includes(pathname) && <div className="data-toolbar">
            <div className="data-toggle" aria-label="Air quality data source">
              <button disabled={!baseCity.demo} aria-pressed={demoMode} onClick={() => chooseMode('demo')}>Demo data</button>
              <button aria-pressed={!demoMode} onClick={() => chooseMode('modeled')}>Modeled data</button>
            </div>
            {pending ? <span className="data-loading" role="status">Loading modeled data for {city.name}…</span>
              : error ? <div role="status">Air quality is unavailable for {city.name}. <button onClick={retry}>Retry</button></div>
              : city.modeled ? <p>Modeled estimates from <a href="https://open-meteo.com/en/docs/air-quality-api">Open-Meteo</a> and <a href="https://atmosphere.copernicus.eu/">Copernicus CAMS</a></p>
              : <p>Indian National AQI · fictional city snapshots</p>}
          </div>}
          <Routes>
            <Route path="/" element={<Dashboard city={city} demoMode={demoMode} />} />
            <Route path="/air-quality" element={<AirQuality {...{ city, setCity }} />} />
            <Route path="/map" element={<Suspense fallback={<Card>Loading map…</Card>}><PollutionMap city={city} setCity={setCity} /></Suspense>} />
            <Route path="/daily-planner" element={<DailyPlanner {...{ city, profile, setProfile }} />} />
            <Route path="/indoor-air" element={<Guides />} />
            <Route path="/community" element={<Community city={city} />} />
            <Route path="/sustainability" element={<Sustainability selected={selected} toggleAction={toggleAction} />} />
            <Route path="/daily-plan" element={<Navigate to="/daily-planner" replace />} />
            <Route path="/tips" element={<Navigate to="/indoor-air" replace />} />
            <Route path="/impact" element={<Navigate to="/sustainability" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </motion.div>
      </main>
      <footer className="site-footer"><span>Urban Air Quality Assistant</span><Link to="/map">Pollution map</Link><Link to="/community">Community</Link></footer>
    </div>
  </>
}
