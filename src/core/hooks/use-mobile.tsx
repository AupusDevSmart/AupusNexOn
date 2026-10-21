import * as React from "react"

const MOBILE_BREAKPOINT = 768

/** Menos que `breakpoint` px de largura. Padrão 768 (celular); 1024 pega também o tablet em pé. */
export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < breakpoint)
    return () => mql.removeEventListener("change", onChange)
  }, [breakpoint])

  return !!isMobile
}

/** Aparelho de toque (tablet, celular): sem hover, ponteiro grosso. */
export function useIsTouch() {
  const [isTouch, setIsTouch] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia("(pointer: coarse)")
    const onChange = () => setIsTouch(mql.matches)
    mql.addEventListener("change", onChange)
    setIsTouch(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isTouch
}
