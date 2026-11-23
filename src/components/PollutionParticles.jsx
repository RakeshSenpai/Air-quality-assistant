import AtmosphereCanvas, { particleSeeds, wrap } from './AtmosphereCanvas'

const dust = particleSeeds(75)

function drawDust(ctx, seed, time, width, height, opacity, stage) {
  const { x, y, variant, direction } = seed
  const angle = time * (.45 + variant * .5) + x * 7
  const dx = wrap(x + direction * time * (.009 + variant * .014) + Math.sin(angle) * .023)
  const dy = wrap(y + direction * time * .008 + Math.cos(angle) * .026)
  const radius = 1.05 + variant * 1.15
  const alpha = opacity * (.34 + variant * .28 + stage * .028)
    * Math.min(1, dx * 14, (1 - dx) * 14, dy * 14, (1 - dy) * 14)
  ctx.beginPath()
  ctx.arc(dx * width, dy * height, radius + .65, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(43,32,40,${alpha * .48})`
  ctx.fill()
  ctx.beginPath()
  ctx.arc(dx * width, dy * height, radius, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255,246,238,${alpha})`
  ctx.fill()
}

export default function PollutionParticles({ count, stage, running }) {
  return <AtmosphereCanvas name="pollution-dust" count={count} stage={stage} running={running}
    seeds={dust} draw={drawDust} />
}
