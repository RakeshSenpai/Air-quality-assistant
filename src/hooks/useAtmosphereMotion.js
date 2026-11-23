import { useEffect, useRef, useState } from 'react'

const baseDuration = 80000
const speedTransition = 900

export function useAtmosphereMotion(hero) {
  const [running, setRunning] = useState(false)

  useEffect(() => {
    const element = hero.current
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let onscreen = typeof IntersectionObserver === 'undefined'
    function update() {
      setRunning(onscreen && !document.hidden && !motion.matches)
    }
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      onscreen = entry.isIntersecting
      update()
    })
    if (element) observer?.observe(element)
    document.addEventListener('visibilitychange', update)
    motion.addEventListener('change', update)
    update()
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', update)
      motion.removeEventListener('change', update)
    }
  }, [hero])

  return running
}

export function useAtmosphereLoop(element, keyframes, seconds, running) {
  const loop = useRef(null)
  const speed = useRef(1)
  const initialSeconds = useRef(seconds)

  useEffect(() => {
    if (!element.current?.animate) return
    const animation = element.current.animate(keyframes, { duration: baseDuration, iterations: Infinity })
    speed.current = baseDuration / (initialSeconds.current * 1000)
    animation.updatePlaybackRate(speed.current)
    animation.pause()
    loop.current = animation
    return () => {
      loop.current = null
      animation.cancel()
    }
  }, [element, keyframes])

  useEffect(() => {
    const animation = loop.current
    if (!animation) return
    const goal = baseDuration / (seconds * 1000)
    if (!running) {
      animation.pause()
      return
    }

    animation.play()
    if (speed.current === goal) return
    const start = speed.current
    let started
    let frame
    function step(now) {
      started ??= now
      const progress = Math.min(1, (now - started) / speedTransition)
      const eased = progress * progress * (3 - 2 * progress)
      speed.current = progress === 1 ? goal : start + (goal - start) * eased
      // Changing playback rate preserves the current position within the loop.
      animation.updatePlaybackRate(speed.current)
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [seconds, running])
}
