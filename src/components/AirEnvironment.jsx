import { useId, useRef } from 'react'
import { useAtmosphereLoop } from '../hooks/useAtmosphereMotion'

const cloudFrames = [
  { transform: 'translateX(-33.333333%)' },
  { transform: 'translateX(-66.666667%)' },
]

const clouds = [
  [18, 16, 0, 44], [68, 31, 1, 37], [2, 52, 1, 32], [45, 51, 0, 38],
  [86, 10, 0, 31], [30, 31, 1, 28], [81, 57, 0, 48],
]

const buildings = [
  [0, 64, 33], [38, 81, 47], [92, 45, 40], [138, 104, 62], [174, 48, 52],
  [230, 82, 31], [268, 60, 46], [320, 120, 39], [363, 73, 49],
  [420, 94, 38], [464, 53, 46], [515, 78, 60], [580, 50, 48],
  [635, 107, 43], [687, 83, 35], [726, 61, 47], [781, 121, 58],
  [849, 61, 44], [899, 91, 57], [963, 52, 42], [1011, 112, 48],
  [1065, 79, 46], [1117, 46, 39], [1163, 66, 38],
]

function Skyline() {
  return <svg className="atmosphere-skyline" viewBox="0 0 1200 150" preserveAspectRatio="none" aria-hidden="true">
    <path opacity=".42" fill="currentColor" d="M0 150v-46h49v-22h31v29h42V85h53v18h38V63h37v38h70V79h48v31h40V73h31v24h55V62h42v49h74V72h43v31h32V80h56v34h52V87h34v14h45V66h55v43h60V83h47v20h46V76h49v23h45v51Z" />
    {buildings.map(([x, height, width], i) => <path key={x} fill="currentColor"
      d={`M${x} 150v-${height}h${width * .29}v-${i % 3 === 0 ? 9 : 4}h${width * .42}v${i % 3 === 0 ? 9 : 4}h${width * .29}v${height}Z`} />)}
    <path fill="currentColor" opacity=".65" d="M324 31h2V13h-2zm479 1h2V11h-2zm227 18h2V22h-2zM0 146h1200v4H0z" />
  </svg>
}

function CloudTrack({ name, density, offset, shapes, seconds, running }) {
  const track = useRef(null)
  useAtmosphereLoop(track, cloudFrames, seconds, running)
  return <div className={`atmosphere-layer atmosphere-layer--${name}`}>
    <div className="atmosphere-track" ref={track} data-loop-seconds={seconds}>
      {[0, 1, 2].map((copy) => <div key={copy} className="atmosphere-track-copy">
        {clouds.map(([x, y, shape, width], i) => (
          <svg key={i} className="atmosphere-cloud" viewBox="0 0 240 88"
            style={{ left: `${(x + offset) % 100}%`, top: `${y}%`, width: `${width}%`,
              opacity: ((i + (name === 'back' ? 0 : 1)) < density) ? 1 : 0 }}>
            <use href={`#${shapes}-${shape}`} />
          </svg>
        ))}
      </div>)}
    </div>
  </div>
}

export default function AirEnvironment({ scene, running }) {
  const shapes = useId()
  const density = scene?.density ?? 0
  return <div className="air-environment" aria-hidden="true">
    <svg className="atmosphere-definitions" width="0" height="0">
      <defs>
        <path id={`${shapes}-0`} d="M20 72C7 70 4 60 12 51c7-8 20-11 33-9C46 26 60 18 76 20c11 1 20 5 26 11C108 14 126 7 145 11c15 3 26 13 29 26 12-6 24-4 34 3 7 4 11 11 11 17 11 1 20 8 16 15-4 8-24 10-39 10H51c-13 0-25-3-31-10Z" />
        <path id={`${shapes}-1`} d="M12 66c-5-10 11-21 27-18 4-12 16-19 30-17 8 1 13 4 17 7 3-20 21-32 42-27 14 3 25 11 29 26 8-6 20-8 30-3 10 5 15 12 16 18 17-3 34 6 33 16-1 8-15 13-27 13H41c-16 0-27-5-29-15Z" />
      </defs>
    </svg>
    <CloudTrack name="back" seconds={scene?.cloudLoops.back ?? 80} running={running && Boolean(scene)} density={density} offset={0} shapes={shapes} />
    <Skyline />
    <CloudTrack name="mid" seconds={scene?.cloudLoops.mid ?? 67.5} running={running && Boolean(scene)} density={density} offset={30} shapes={shapes} />
    <div className="atmosphere-haze" />
    <CloudTrack name="front" seconds={scene?.cloudLoops.front ?? 55} running={running && Boolean(scene)} density={Math.max(0, density - 1)} offset={63} shapes={shapes} />
  </div>
}
