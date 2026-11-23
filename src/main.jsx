import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { MotionConfig, useReducedMotion } from 'motion/react'
import '@fontsource-variable/inter'
import './styles.css'
import App from './App'

function Root() {
  const reduced = useReducedMotion()
  return <MotionConfig reducedMotion="user" transition={{ duration: reduced ? 0 : 0.22 }}>
    <HashRouter><App /></HashRouter>
  </MotionConfig>
}

createRoot(document.getElementById('root')).render(<Root />)
