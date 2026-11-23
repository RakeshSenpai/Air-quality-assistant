import { getCategory, indexLabel } from './air'

export const profiles = [
  { id: 'individual', label: 'Individual', concern: 'Pay attention to how you feel and adjust your pace.' },
  { id: 'children', label: 'Family with children', concern: 'Plan active play indoors when pollution rises.' },
  { id: 'older', label: 'Household with older adults', concern: 'Build in breaks and arrange a less strenuous option for older adults.' },
]

const periods = [
  { title: 'Morning', time: '6 AM – 12 PM', high: 'Move your morning workout indoors and combine essential errands.', mild: 'Pick a short, quiet route away from busy roads.', low: 'A walk on a quiet route is an option if you feel well.' },
  { title: 'Afternoon', time: '12 PM – 5 PM', high: 'Keep outdoor trips brief. Try an indoor workout or activity.', mild: 'Keep exertion light and choose an indoor alternative if sensitive.', low: 'Plan outdoor errands around quieter traffic times.' },
  { title: 'Evening', time: '5 PM – 10 PM', high: 'Choose indoor activities and check air quality again before tomorrow’s plans.', mild: 'Keep walks short if sensitive and check conditions before heading out.', low: 'Consider a relaxed walk and review tomorrow’s conditions.' },
]

export function dailyPlan(city, profile) {
  return periods.map(({ title, time, high, mild, low }, index) => {
    const [start, end] = [[6, 12], [12, 17], [17, 22]][index]
    const values = city.hours.filter(({ hour, aqi }) => hour >= start && hour < end && Number.isFinite(aqi)).map(({ aqi }) => aqi)
    const peak = values.length ? Math.max(...values) : null
    const highThreshold = city.standard === 'us' ? 150 : 200
    const advice = peak == null ? 'Check local conditions before planning this period.' : peak > highThreshold ? high : peak > 100 ? mild : low
    return { title, time, peak, tips: [advice, profile.concern] }
  })
}

export const tips = [
  { title: 'Use suitable HEPA filtration', category: 'Indoor', detail: 'Match a portable HEPA cleaner to room size if available. If a purifier is out of budget, focus first on reducing indoor smoke and dust.' },
  { title: 'Time ventilation around outdoor conditions', category: 'Smog safety', detail: 'When outdoor air is especially polluted, limit window opening where practical. Ventilate when conditions improve and use kitchen exhaust while cooking.' },
  { title: 'Reduce dust with damp cleaning', category: 'Low-cost', detail: 'Use a damp cloth or mop to capture settled dust instead of dry sweeping it back into the air.' },
  { title: 'Avoid unnecessary incense and open burning', category: 'Indoor', detail: 'Skip incense, candles, and indoor smoking to avoid adding particles inside. Use unscented products where practical.' },
  { title: 'Plan around high-pollution periods', category: 'Smog safety', detail: 'Before an outing, check the hourly trend. Have an indoor alternative ready for periods with higher pollution.' },
  { title: 'Choose lower-emission travel', category: 'Sustainable', detail: 'Combine errands, share rides, or use public transport where practical. Consider air quality along the route separately.' },
]

export const actions = [
  { id: 'travel', title: 'Choose greener travel', short: 'Transit or shared rides', benefit: 'Shared or public transport can reduce the number of vehicle trips. Avoid unnecessary idling while waiting.' },
  { id: 'waste', title: 'Reduce waste & recycle', short: 'At home and work', benefit: 'Avoiding open waste burning reduces smoke emissions. Repair and reuse items when possible.' },
  { id: 'energy', title: 'Save energy', short: 'Use power efficiently', benefit: 'Using efficient appliances and switching off unused devices can reduce electricity demand and associated emissions.' },
]

export const events = [
  { title: 'Clean commute walk-through', time: 'Saturday · 10 AM', detail: 'A sample neighbourhood session on shared travel and avoiding vehicle idling.' },
  { title: 'Indoor air workshop', time: 'Sunday · 11 AM', detail: 'A sample community centre workshop on smoke sources, filtration, and low-cost cleaning.' },
  { title: 'Know your AQI', time: 'Self-guided activity', detail: 'Compare two times of day and discuss which activities could move indoors when air quality worsens.' },
]

export const questions = [
  { label: 'Outdoor play', prompt: 'Is it safe for my child to play outside?', terms: /outside|outdoor|play|child/ },
  { label: 'Indoor air', prompt: 'How can I improve indoor air quality?', terms: /indoor|filter|purifier|clean|ventilat/ },
  { label: 'Daily routine', prompt: 'What should my family do today?', terms: /routine|schedule|plan|exercise|family do today/ },
  { label: 'Cleaner commute', prompt: 'How can I reduce pollution from my commute?', terms: /commute|travel|bus|transport|drive/ },
  { label: 'Reduce exposure', prompt: 'How can I reduce pollution exposure?', terms: /exposure/ },
]

export function replyTo(message, city, profile) {
  const question = questions.find(({ terms }) => terms.test(message.toLowerCase()))
  if (!Number.isFinite(city.aqi)) return `Current AQI for ${city.name} is unavailable. Check local conditions before making outdoor plans. ${profile.concern}`
  const context = `${city.name}’s ${city.modeled ? 'modeled' : 'sample'} ${indexLabel(city.standard)} is ${city.aqi} (${getCategory(city.aqi, city.standard).label}).`
  const plan = dailyPlan(city, profile)
  const replies = [
    Math.max(city.aqi, ...city.hours.filter(({ type, aqi }) => type === 'Forecast' && Number.isFinite(aqi)).map(({ aqi }) => aqi)) > 100
      ? 'Choose indoor play for now or check conditions again before planning a short, gentle outing.'
      : 'Short outdoor play on a quiet route may be an option if everyone feels well. Recheck conditions before going out.',
    'Start by removing smoke sources and damp-mopping dust. Use a room-sized HEPA cleaner if available, and time ventilation for cleaner outdoor periods.',
    plan.map(({ title, tips }) => `${title}: ${tips[0]}`).join(' '),
    'Consider public transit, sharing a ride, or combining errands to reduce vehicle trips. Check the route and time of day separately to manage personal exposure.',
    `${getCategory(city.aqi, city.standard).detail} Check the latest local conditions before planning prolonged outdoor activity.`,
  ]
  return question
    ? `${context} ${replies[questions.indexOf(question)]} ${profile.concern}`
    : `${context} This demo uses preset responses. Try asking about outdoor play, indoor air, a daily routine, or your commute.`
}
