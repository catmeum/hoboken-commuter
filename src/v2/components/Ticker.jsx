import { useRef, useEffect } from 'react'

export default function Ticker({ alerts }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let animId
    let pos = 0
    const speed = 0.5 // px per frame

    function animate() {
      pos += speed
      if (pos >= el.scrollWidth / 2) pos = 0
      el.scrollLeft = pos
      animId = requestAnimationFrame(animate)
    }
    animId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animId)
  }, [alerts])

  const text = alerts.map(a => a.text || a).join('  ·  ')

  return (
    <div className="v2-ticker">
      <div className="v2-ticker-scroll" ref={scrollRef}>
        <span className="v2-ticker-text">{text}  ·  {text}</span>
      </div>
    </div>
  )
}
