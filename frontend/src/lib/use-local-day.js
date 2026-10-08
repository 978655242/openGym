import { useEffect, useState } from 'react'
import { todayISO } from './format.js'

// The home card and journal roll over at local midnight, including after backgrounding.
export function useLocalDay() {
  const [day, setDay] = useState(todayISO)
  useEffect(() => {
    let timer
    const refresh = () => {
      setDay(todayISO())
      clearTimeout(timer)
      const next = new Date()
      next.setHours(24, 0, 0, 0)
      timer = setTimeout(refresh, next.getTime() - Date.now() + 50)
    }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return day
}
