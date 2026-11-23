export const categories = [
  { max: 50, label: 'Good', color: '#48C7A5', detail: 'Low pollution on this index.' },
  { max: 100, label: 'Satisfactory', color: '#8FCBB0', detail: 'Sensitive people may still notice symptoms.' },
  { max: 200, label: 'Moderately Polluted', color: '#F28A55', detail: 'People with heart or lung conditions may be more affected. Keep outdoor exertion light if you are sensitive.' },
  { max: 300, label: 'Poor', color: '#EF7950', detail: 'Limit prolonged or strenuous outdoor activity, especially for sensitive groups.' },
  { max: 400, label: 'Very Poor', color: '#E76B6B', detail: 'Move strenuous activities indoors and limit time outside.' },
  { max: 500, label: 'Severe', color: '#D85F6C', detail: 'Keep outdoor activity to essential trips when possible.' },
]

export const usCategories = [
  { max: 50, label: 'Good', color: '#48C7A5', detail: 'Air pollution poses little risk for most people.' },
  { max: 100, label: 'Moderate', color: '#E5C85C', detail: 'People who are unusually sensitive may want to reduce prolonged outdoor exertion.' },
  { max: 150, label: 'Unhealthy for Sensitive Groups', color: '#F28A55', detail: 'Sensitive groups may need to take more breaks and reduce prolonged outdoor exertion.' },
  { max: 200, label: 'Unhealthy', color: '#F27073', detail: 'Reduce prolonged outdoor exertion. Sensitive groups should consider moving activities indoors.' },
  { max: 300, label: 'Very Unhealthy', color: '#B28AEB', detail: 'Avoid strenuous outdoor activity and consider indoor alternatives.' },
  { max: 500, label: 'Hazardous', color: '#C65A77', detail: 'Keep outdoor activity to essential trips when possible.' },
]

export const scaleFor = (standard) => standard === 'us' ? usCategories : categories
export const indexLabel = (standard) => standard === 'us' ? 'US AQI' : 'Indian National AQI'
export const getCategory = (aqi, standard) => Number.isFinite(aqi)
  ? scaleFor(standard).find(({ max }) => aqi <= max) ?? scaleFor(standard).at(-1)
  : { label: 'Unavailable', color: '#a3a3a3', detail: 'Air quality is unavailable for this location. Check local conditions before planning outdoor activity.' }

export const pollutants = [
  { name: 'PM2.5', key: 'pm2_5', period: '24-hour average', particle: true, detail: 'Fine airborne particles from sources such as combustion, smoke and atmospheric reactions.' },
  { name: 'PM10', key: 'pm10', period: '24-hour average', particle: true, detail: 'Airborne particles up to 10 µm, including road and construction dust.' },
  { name: 'NO₂', key: 'nitrogen_dioxide', period: '24-hour average', detail: 'Nitrogen dioxide is a gas associated with traffic and fuel combustion.' },
  { name: 'O₃', key: 'ozone', period: '8-hour average', detail: 'Ground-level ozone forms when pollutants react in sunlight.' },
  { name: 'CO', key: 'carbon_monoxide', detail: 'Carbon monoxide is an odorless gas released by incomplete combustion.' },
  { name: 'SO₂', key: 'sulphur_dioxide', detail: 'Sulfur dioxide is associated with burning sulfur-containing fuels and industrial activity.' },
]

const coordinates = {
  delhi: [28.6139, 77.209],
  mumbai: [19.076, 72.8777],
  kolkata: [22.5726, 88.3639],
  bengaluru: [12.9716, 77.5946],
  guwahati: [26.1445, 91.7362],
}

const times = ['6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM']
export const currentHour = '3 PM'

export const cities = [
  ['delhi', 'New Delhi', [92, 142, 56, 78], [153, 159, 170, 168, 157, 150]],
  ['mumbai', 'Mumbai', [47, 87, 36, 59], [84, 91, 97, 94, 88, 81]],
  ['kolkata', 'Kolkata', [113, 224, 81, 66], [240, 228, 219, 216, 234, 249]],
  ['bengaluru', 'Bengaluru', [27, 48, 19, 43], [54, 49, 45, 46, 53, 61]],
  ['guwahati', 'Guwahati', [76, 132, 49, 51], [162, 147, 139, 148, 160, 176]],
].map(([id, name, values, hours]) => ({
  id, name, country: 'India', demo: true, values, aqi: hours[3], coordinates: coordinates[id], standard: 'in', sourceDemo: true, currentLabel: currentHour, timestamp: '3 PM IST · fictional snapshot',
  hours: hours.map((aqi, i) => ({
    time: times[i], hour: [6, 9, 12, 15, 18, 21][i], aqi, type: i < 3 ? 'Historical' : i === 3 ? 'Current sample' : 'Forecast',
  })),
}))
