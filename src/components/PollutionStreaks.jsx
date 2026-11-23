import AtmosphereCanvas, { particleSeeds, wrap } from './AtmosphereCanvas'

const streaks = particleSeeds(55)

function drawStreak(ctx, seed, time, width, height, opacity, stage) {
  const y = wrap(seed.y + time * (.066 + seed.variant * .081))
  const x = wrap(seed.x + y * .04) * width
  const head = y * height
  const length = 14 + seed.variant * 21 + stage * 1.3
  const lean = length * .16
  const alpha = opacity * (.36 + seed.variant * .22 + stage * .03)
    * Math.min(1, y * 10, (1 - y) * 5)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x - lean, head - length)
  ctx.lineTo(x, head)
  ctx.lineWidth = 2
  ctx.strokeStyle = `rgba(51,34,44,${alpha * .45})`
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x - lean * .72, head - length * .72)
  ctx.lineTo(x, head)
  ctx.lineWidth = 1.1 + seed.variant * .35
  ctx.strokeStyle = `rgba(252,239,234,${alpha})`
  ctx.stroke()
}

export default function PollutionStreaks({ count, stage, running }) {
  return <AtmosphereCanvas name="pollution-streaks" count={count} stage={stage} running={running}
    seeds={streaks} draw={drawStreak} />
}
