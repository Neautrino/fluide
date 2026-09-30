import { useCallback, useState } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
  )

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === 'light' ? 'dark' : 'light'
      if (next === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark')
      } else {
        document.documentElement.removeAttribute('data-theme')
      }
      try {
        localStorage.setItem('fluide.theme', next)
      } catch (e) {}
      return next
    })
  }, [])

  return { theme, toggleTheme: toggle }
}

export function useHiddenAmounts() {
  const [hidden, setHidden] = useState<boolean>(() =>
    document.documentElement.classList.contains('amounts-hidden')
  )

  const toggle = useCallback(() => {
    setHidden((current) => {
      const next = !current
      if (next) {
        document.documentElement.classList.add('amounts-hidden')
      } else {
        document.documentElement.classList.remove('amounts-hidden')
      }
      try {
        localStorage.setItem('fluide.amountsHidden', next ? '1' : '0')
      } catch (e) {}
      return next
    })
  }, [])

  return { hiddenAmounts: hidden, toggleHiddenAmounts: toggle }
}
