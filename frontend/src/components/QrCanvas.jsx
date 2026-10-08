import { useEffect, useRef, useState } from 'react'
import { renderQrToCanvas } from '../lib/qr.js'
import { t } from '../lib/i18n.js'

// Device-link QR codes render one module per pixel; CSS keeps them crisp at display size.
// Values are rendered on demand, never stored as pictures. Hide the canvas until ready.
export default function QrCanvas({ value, size = 240, className = '' }) {
  const ref = useRef(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    let alive = true
    setOk(false)
    renderQrToCanvas(ref.current, value)
      .then(mods => { if (alive) setOk(mods > 0) })
      .catch(() => { if (alive) setOk(false) })
    return () => { alive = false }
  }, [value])

  return (
    <canvas
      ref={ref}
      className={'qr-canvas ' + className}
      style={{ width: size, height: size, opacity: ok ? 1 : 0 }}
      aria-label={t('QR code')}
    />
  )
}
