import { getCategory, scaleFor } from './air'

const scenes = [
  ['good', 'Smiling traveler in a blue hoodie', '#59BDF4', '#B9E7FA', '#F8FDFF', 2, .21, .02, .66, 80, 55, 0, 0],
  ['moderate', 'Relaxed traveler in a mustard hoodie', '#D9AD72', '#F0D6A7', '#F3E8D9', 3, .27, .12, .51, 65, 45, 8, 0],
  ['sensitive', 'Traveler in an orange hoodie coughing into their hand', '#E99779', '#F4C1A4', '#C79B8E', 4, .39, .22, .42, 50, 35, 20, 10],
  ['unhealthy', 'Traveler in a red hoodie coughing with a hand on their chest', '#D76C8D', '#8E4A57', '#C38A99', 5, .51, .36, .29, 40, 28, 35, 22],
  ['very-unhealthy', 'Masked traveler in a purple hoodie', '#97639E', '#49304F', '#66516B', 6, .64, .53, .18, 30, 22, 55, 38],
  ['hazardous', 'Traveler in a burgundy hoodie wearing a mask and goggles', '#754653', '#241B25', '#403039', 7, .78, .72, .08, 22, 16, 75, 55],
]

export const airScenes = scenes.map(([file, alt, sky, horizon, cloud, density, cloudOpacity, haze, skyline, back, front, dust, streaks]) => ({
  file, alt, sky, horizon, cloud, density, cloudOpacity, haze, skyline,
  cloudLoops: { back, mid: (back + front) / 2, front },
  dust, streaks,
}))

export function getAirScene(aqi, standard) {
  const category = getCategory(aqi, standard)
  if (!Number.isFinite(aqi) || aqi < 0 || aqi > 500) return null
  const stage = scaleFor(standard).indexOf(category)
  return { ...airScenes[stage], category, stage }
}
