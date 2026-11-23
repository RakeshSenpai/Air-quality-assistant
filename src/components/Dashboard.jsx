import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Activity, ArrowRight, BarChart3, BusFront, CalendarDays, Check, ChevronDown, CircleCheck, Cloud, Grip, House, Info, Leaf, Moon, Recycle, Sprout, Sun, Sunrise } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getCategory, indexLabel, pollutants, scaleFor } from '../data/air'
import { actions, dailyPlan, questions, replyTo, tips } from '../data/guidance'

export function Card({ children, className = '' }) {
  return <section className={`panel ${className}`}>{children}</section>
}

export function Heading({ icon: Icon, children, detail }) {
  return <div className="section-heading">
    {Icon && <Icon aria-hidden="true" />}
    <div><h2>{children}</h2>{detail && <p>{detail}</p>}</div>
  </div>
}

export function AQICard({ city }) {
  const category = getCategory(city.aqi, city.standard)
  const reduced = useReducedMotion()
  const arc = 'M 15 87 A 79 57 0 0 1 173 87'
  return <Card className="aqi-card">
    <div className="flex items-center justify-between gap-2">
      <Heading>Current AQI</Heading>
      <span className="badge"><i />{city.sourceDemo ? 'Demo Data' : city.pending ? 'Loading' : city.failed ? 'Unavailable' : 'Modeled'}</span>
    </div>
    <p className="metadata">{city.name}{city.timestamp && ` · ${city.timestamp}`}</p>
    <div className="aqi-reading">
      <div>{Number.isFinite(city.aqi) ? <AnimatePresence mode="wait" initial={false}><motion.strong key={city.aqi} className="aqi-number" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>{city.aqi ?? '—'}</motion.strong></AnimatePresence> : <strong className="aqi-number">—</strong>}
        <span className="category" style={{ '--status': category.color }}>{city.pending ? 'Loading AQI…' : category.label}</span>
      </div>
      <svg className="gauge" viewBox="0 0 188 107" role="img" aria-label={`${indexLabel(city.standard)} ${city.aqi ?? 'unavailable'}`}>
        <path d={arc} fill="none" stroke="#333333" strokeWidth="17" strokeLinecap="round" />
        <motion.path d={arc} fill="none" stroke={category.color} strokeWidth="17" strokeLinecap="round"
          initial={false} animate={{ pathLength: Math.min(1, city.aqi / 500) }} transition={{ duration: reduced || !Number.isFinite(city.aqi) ? 0 : 0.65 }} />
        <circle cx="94" cy="87" r="2.5" fill="#333333" />
      </svg>
    </div>
    <div className="aqi-note"><Activity aria-hidden="true" /><p>{category.detail}</p></div>
    {Number.isFinite(city.aqi) && <div className="aqi-scale" aria-label={`${indexLabel(city.standard)} category scale`}>
      {scaleFor(city.standard).map(({ max, label, color }, index, scale) => <span key={label} title={`${label} · up to ${max}`} style={{ background: color, flexGrow: max - (scale[index - 1]?.max ?? 0) }} />)}
      <i style={{ left: `${Math.min(100, city.aqi / 5)}%` }} />
    </div>}
    <p className="metadata">{indexLabel(city.standard)} · {city.sourceDemo ? 'Local demo dataset' : 'Open-Meteo / CAMS'}</p>
  </Card>
}

export function Pollutants({ city, compact = false }) {
  return <Card className={compact ? 'pollutants compact-pollutants' : 'pollutants'}>
    <div className="flex justify-between items-center gap-2">
      <div className="flex items-baseline gap-3 flex-wrap"><Heading>Key Pollutants</Heading><span className="unit">(µg/m³)</span></div>
      <Info className="text-muted shrink-0" size={19} aria-label="Pollutant concentrations and averaging periods" />
    </div>
    <div className="pollutant-grid">
      {pollutants.map(({ name, period, particle, detail }, index) => {
        const Icon = particle ? Grip : Cloud
        return <div key={name} className="inset pollutant">
          <div className="flex gap-3 items-center"><Icon size={24} aria-hidden="true" /><h3>{name}</h3></div>
          {Number.isFinite(city.values[index])
            ? <><strong>{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(city.values[index])}</strong><span className="unit">µg/m³</span>
                <p>{city.modeled ? 'Modeled concentration' : period}</p></>
            : <><strong>—</strong><p>Unavailable</p></>}
          {!compact && <details className="pollutant-detail"><summary>About {name}</summary><p>{detail}</p></details>}
        </div>
      })}
    </div>
  </Card>
}

function ChartTooltip({ active, payload, standard }) {
  const point = payload?.[0]?.payload
  if (!active || !Number.isFinite(point?.aqi)) return null
  return <div className="chart-tooltip">
    <span>{point.time} · {point.type}</span>
    <strong>AQI {point.aqi} · {getCategory(point.aqi, standard).label}</strong>
  </div>
}

export function AQIChart({ city, large = false, daily = false }) {
  const reduced = useReducedMotion()
  const gradient = useId()
  const accent = getCategory(city.aqi, city.standard).color
  const points = daily ? city.daily ?? [] : city.hours
  const values = points.map(({ aqi }) => aqi).filter(Number.isFinite)
  const low = Math.max(0, Math.floor(Math.min(...values) / 20) * 20 - 20)
  const high = Math.ceil(Math.max(...values) / 20) * 20 + 20
  return <Card className={large ? 'chart-panel chart-large' : 'chart-panel'}>
    <Heading icon={BarChart3}>{daily ? 'Daily Forecast Peaks' : 'Hourly Air Quality'}</Heading>
    {values.length === 0 ? <p className="body-copy">{daily ? city.sourceDemo ? 'Daily forecasts are available in Modeled data mode.' : 'No daily forecast is available for this location.' : 'No hourly values are available.'}</p> : <>
      <div className="chart" aria-label={`${indexLabel(city.standard)} for ${city.name}`}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 340, height: 156 }}>
          <AreaChart data={points} margin={{ top: 10, right: 14, bottom: 0, left: 0 }} accessibilityLayer>
            <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.34} /><stop offset="100%" stopColor={accent} stopOpacity={0.015} />
            </linearGradient></defs>
            <CartesianGrid vertical={false} stroke="#2d2d2d" strokeOpacity={0.65} />
            <XAxis dataKey="time" tick={{ fill: '#bcbcbc', fontSize: 11 }} minTickGap={22} tickLine={false} tickMargin={8} />
            <YAxis domain={[low, high]} width={36} tick={{ fill: '#bcbcbc', fontSize: 11 }} tickLine={false} />
            {!daily && <ReferenceLine x={city.currentLabel} stroke={accent} strokeOpacity={0.55} strokeDasharray="4 4" />}
            <Tooltip content={<ChartTooltip standard={city.standard} />} cursor={{ stroke: accent, strokeDasharray: '3 3' }} />
            <Area type="monotone" dataKey="aqi" stroke={accent} strokeWidth={3} fill={`url(#${gradient})`}
              isAnimationActive={!reduced} animationDuration={440} dot={points.length < 8} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-key">{city.modeled ? daily ? 'Forecast · peak of available hourly estimates · ' + city.timeZoneLabel : 'Past hours are modeled estimates · later hours are forecast · ' + city.timeZoneLabel : 'Demo data · earlier points are historical samples · later points are sample forecasts'}</p>
      <ul className="sr-only">{points.map(({ time, type, aqi }) => <li key={time}>{time}, {type}, {aqi ?? 'Unavailable'}</li>)}</ul>
    </>}
  </Card>
}

export function PollutantComparison({ city }) {
  const reduced = useReducedMotion()
  const rows = pollutants.flatMap(({ name }, i) => Number.isFinite(city.values[i]) ? [{ name, value: city.values[i] }] : [])
  return <Card className="chart-panel">
    <Heading icon={BarChart3} detail="Concentration in µg/m³. Bar lengths do not rank health risk.">Pollutant Comparison</Heading>
    {rows.length ? <div className="chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={rows} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="#2d2d2d" />
          <XAxis dataKey="name" tick={{ fill: '#bcbcbc', fontSize: 11 }} />
          <YAxis width={46} tick={{ fill: '#bcbcbc', fontSize: 11 }} />
          <Tooltip formatter={(value) => [`${value} µg/m³`, 'Concentration']} contentStyle={{ background: '#1b1b1b', borderColor: '#444444' }} itemStyle={{ color: '#eeeeee' }} />
          <Bar dataKey="value" fill="#dedede" radius={[5, 5, 0, 0]} isAnimationActive={!reduced} />
        </BarChart>
      </ResponsiveContainer>
    </div> : <p className="body-copy">No pollutant concentrations are available.</p>}
  </Card>
}

const timeIcons = [Sunrise, Sun, Moon]

export function Plan({ city, profile, full = false }) {
  return <Card className="plan-panel">
    <Heading icon={CalendarDays} detail={city.modeled ? 'Tailored to modeled AQI and your household.' : city.sourceDemo ? 'Tailored to the sample AQI and your household.' : 'Local air quality is unavailable. Household preferences still apply.'}>Your Daily Plan</Heading>
    <div className="plan-grid timeline">
      {dailyPlan(city, profile).map(({ title, time, peak, tips: entries }, index) => {
        const Icon = timeIcons[index]
        return <div className="inset plan-period" key={title}>
          <div className="flex gap-3 items-center"><Icon size={29} aria-hidden="true" /><div><h3>{title}</h3><p>{time}</p></div></div>
          {full && <p className="metadata mt-3">{peak == null ? 'No AQI for this period' : `Peak ${indexLabel(city.standard)} ${peak} · ${getCategory(peak, city.standard).label}`}</p>}
          <ul>{entries.map((entry) => <li key={entry}><CircleCheck aria-hidden="true" />{entry}</li>)}</ul>
        </div>
      })}
    </div>
  </Card>
}

export function Tips({ items = tips.slice(0, 4), title = 'Indoor Air Quality Tips', detail = 'Simple ways to keep the air at home cleaner.' }) {
  const [expanded, setExpanded] = useState('')
  return <Card className="tips-panel">
    <Heading icon={House} detail={detail}>{title}</Heading>
    <div className="tip-list">
      {items.map((tip) => {
        const open = expanded === tip.title
        return <div key={tip.title}>
          <button className="tip-trigger" aria-expanded={open} onClick={() => setExpanded(open ? '' : tip.title)}>
            <Check aria-hidden="true" /><span>{tip.title}</span><ChevronDown className={open ? 'turned' : ''} aria-hidden="true" />
          </button>
          <AnimatePresence initial={false}>
            {open && <motion.div className="tip-content" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}><p>{tip.detail}</p></motion.div>}
          </AnimatePresence>
        </div>
      })}
    </div>
  </Card>
}

const actionIcons = [BusFront, Recycle, Sprout]

export function Choices({ selected, toggleAction, full = false }) {
  const active = actions.filter(({ id }) => selected.includes(id))
  return <Card className="choices-panel">
    <Heading icon={Leaf} detail="Everyday ways to reduce emissions.">Sustainable Choices, Cleaner Air</Heading>
    <div className="choices-grid">
      {actions.map(({ id, title, short, benefit }, index) => {
        const Icon = actionIcons[index]
        return <div key={id} className="choice">
          <button aria-pressed={selected.includes(id)} onClick={() => toggleAction(id)} title={benefit}>
            <Icon aria-hidden="true" /><strong>{title}</strong><span>{short}</span>
          </button>
          {(full || selected.includes(id)) && <p>{benefit}</p>}
        </div>
      })}
    </div>
    {full && <div className="progress-block">
      <label htmlFor="action-progress">{active.length} of {actions.length} actions selected</label>
      <progress id="action-progress" max={actions.length} value={active.length} />
      {active.length === 0 ? <p>Select an action to start your local checklist.</p> :
        <ul>{active.map(({ id, title }) => <li key={id}><Check size={16} aria-hidden="true" />{title}</li>)}</ul>}
      <p>These choices can reduce emissions. Your exposure also depends on local air quality, route, and timing.</p>
    </div>}
  </Card>
}

export function Assistant({ city, profile }) {
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const timeout = useRef()
  const log = useRef()
  const locationKey = city.coordinates.join(',')
  const activeLocation = useRef(locationKey)
  activeLocation.current = locationKey
  useEffect(() => () => clearTimeout(timeout.current), [])
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight
  }, [messages, pending])

  function send(value) {
    const question = value.trim()
    if (!question || pending) return
    if (question.length > 500) {
      setError('Keep your question to 500 characters or fewer.')
      return
    }
    setError('')
    setMessages((previous) => [...previous, { role: 'You', text: question }])
    setDraft('')
    setPending(true)
    timeout.current = setTimeout(() => {
      const text = activeLocation.current === locationKey ? replyTo(question, city, profile) : 'The location changed while preparing your reply. Please send your question again.'
      setMessages((previous) => [...previous, { role: 'Demo assistant', text }])
      setPending(false)
    }, 550)
  }

  return <Card className="assistant-panel">
    <p className="assistant-intro"><span className="badge">Demo</span> Ask about outdoor activity, cleaner indoor air, or routines for your household.</p>
    <div ref={log} role="log" aria-label="Conversation" className="chat-log">
      {messages.map(({ role, text }, index) => <div className={role === 'You' ? 'message user-message' : 'message'} key={index}><strong>{role}</strong><p>{text}</p></div>)}
      {pending && <div className="typing">Preparing a demo reply<span>…</span></div>}
    </div>
    <form className="chat-form" onSubmit={(event) => { event.preventDefault(); send(draft) }}>
      <textarea aria-label="Ask the demo assistant" rows={2} placeholder="Ask anything… (e.g., Is it safe for my child to play outside today?)"
        value={draft} onChange={(event) => { setDraft(event.target.value); setError('') }}
        onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(draft) } }} />
      <button type="submit" disabled={pending || !draft.trim()} aria-label="Send message"><ArrowRight aria-hidden="true" /></button>
    </form>
    {error && <p className="chat-error" role="alert">{error}</p>}
    <div className="question-chips">{questions.map(({ label, prompt }) =>
      <button key={label} disabled={pending} onClick={() => send(prompt)}>{label}</button>)}</div>
  </Card>
}
