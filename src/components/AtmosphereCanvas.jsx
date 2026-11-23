import { useEffect, useRef } from 'react'

export const mobileAtmosphereQuery = '(max-width: 580px)'
export const visibleCount = (count, mobile) => mobile ? Math.ceil(count * .52) : count

export default function AtmosphereCanvas({ name, count, stage, running, seeds, draw }) {
  const canvas = useRef(null)
  const target = useRef({ count, stage })
  const phase = useRef({ time: 0, count: 0, stage })
  const populated = count > 0
  useEffect(() => { target.current = { count, stage } }, [count, stage])

  useEffect(() => {
    const node = canvas.current
    const context = node?.getContext('2d')
    if (!context) return
    if (!running) {
      if (target.current.count === 0) context.clearRect(0, 0, node.width, node.height)
      return
    }
    const mobile = window.matchMedia(mobileAtmosphereQuery)
    let width = 0
    let height = 0
    let frame
    let previous
    function resize() {
      width = node.clientWidth
      height = node.clientHeight
      const ratio = Math.min(window.devicePixelRatio || 1, mobile.matches ? 1.25 : 1.75)
      node.width = Math.round(width * ratio)
      node.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    function tick(now) {
      const dt = previous === undefined ? 0 : Math.min((now - previous) / 1000, .05)
      previous = now
      const state = phase.current
      const ease = 1 - Math.exp(-5 * dt)
      const desired = visibleCount(target.current.count, mobile.matches)
      state.count += (desired - state.count) * ease
      state.stage += (target.current.stage - state.stage) * ease
      state.time += dt * (1 + .19 * Math.max(0, state.stage - 2))
      context.clearRect(0, 0, width, height)
      const limit = Math.min(seeds.length, Math.ceil(Math.min(state.count, visibleCount(seeds.length, mobile.matches))))
      for (let i = 0; i < limit; i++) {
        const opacity = Math.min(1, state.count - i)
        if (opacity > .02) draw(context, seeds[i], state.time, width, height, opacity, state.stage)
      }
      if (desired > 0 || state.count > .02) frame = requestAnimationFrame(tick)
    }
    const observer = new ResizeObserver(resize)
    resize()
    observer.observe(node)
    frame = requestAnimationFrame(tick)
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [draw, populated, running, seeds])

  return <canvas ref={canvas} className={`atmosphere-canvas ${name}`} data-count={count} aria-hidden="true" />
}

export function particleSeeds(length) {
  return Array.from({ length }, (_, index) => ({
    x: (index * .61803398875 + .071) % 1,
    y: (index * .41421356237 + .35) % 1,
    variant: (index * .73205080757 + .19) % 1,
    direction: index % 2 ? 1 : -1,
  }))
}

export const wrap = (value) => ((value % 1) + 1) % 1
