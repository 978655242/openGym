import { useEffect, useRef, useState } from 'react'
import { imgSrc, gifSrc, videoSrc } from '../lib/exercises.js'
import { useStore } from '../store/useStore.js'
import { t, exerciseNameFor } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import CustomMedia, { CustomThumb } from './CustomMedia.jsx'

// An exercise's picture, wherever one shows. A custom exercise goes to CustomMedia.jsx — its own
// photo, GIF, video or link, from the local media store — and never through imgSrc/gifSrc, which
// name files of the shipped dataset (a stray img/gif on a custom exercise, written by a fork, is
// ignored). The split is by component, not by branch, so each side keeps its own hooks in order.
export default function Media(p) {
  return p.ex?.custom ? <CustomMedia {...p} /> : <BuiltinMedia key={p.ex?.id} {...p} />
}

// Big animation; tap pauses a video or switches a GIF to its still. `compact` shrinks it.
// `minimizable` (workout view) adds a persistent minimize/expand control so the animation stops
// eating the screen; the chosen size is saved to settings and carries across exercises and
// future workouts (issue #12). Settings can also turn workout media off entirely
// (gifSize 'off') — then nothing renders here and the exercise card closes up, exactly like
// an exercise without media. Any other/legacy value behaves as 'full'.
function BuiltinMedia({ ex, id, compact, minimizable }) {
  const listLayout = useStore(s => !!minimizable && ((s.S.active?.workoutView || s.S.workoutView) === 'list'))
  const gifSize = useStore(s => s.S.gifSize)
  const update = useStore(s => s.update)
  const [playing, setPlaying] = useState(() => !ex.video || (!listLayout && !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches))
  const [failed, setFailed] = useState(null) // video → GIF → still → neutral tile
  const video = useRef(null)
  const showVideo = !!ex.video && failed == null && !(minimizable && gifSize === 'off')
  useEffect(() => {
    const v = video.current
    if (!showVideo || !v) return
    const play = () => v.play()?.catch(e => {
      if (e.name === 'AbortError') return
      if (e.name === 'NotAllowedError') setPlaying(false)
      else setFailed(ex.gif ? 'video' : 'gif')
    })
    if (playing) play()
    else v.pause()
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([entry]) => { if (entry.isIntersecting && playing) play(); else v.pause() })
      : null
    observer?.observe(v)
    return () => { observer?.disconnect(); v.pause() }
  }, [showVideo, playing, ex.gif])
  if (!ex.gif && !ex.video) return null
  if (minimizable && gifSize === 'off') return null
  const mini = minimizable && gifSize === 'mini'
  const toggleSize = e => { e.stopPropagation(); update(s => { s.gifSize = mini ? 'full' : 'mini' }) }
  const showGif = !!ex.gif && playing && (failed == null || failed === 'video')
  const onError = () => setFailed(showVideo ? (ex.gif ? 'video' : 'gif') : showGif ? 'gif' : 'all')
  const onTap = () => {
    if (failed) { setFailed(null); setPlaying(true); return }
    setPlaying(p => !p)
  }
  return (
    <div className={'exmedia' + (compact ? ' compact' : '') + (mini ? ' mini' : '') + (failed === 'all' ? ' broken' : '')} id={id} onClick={onTap}>
      {failed === 'all'
        ? <div className="exmedia-x"><Icon name="dumbbell" /></div>
        : showVideo
          ? <video ref={video} src={videoSrc(ex)} poster={ex.img ? imgSrc(ex) : undefined}
              muted loop playsInline preload="metadata" aria-label={exerciseNameFor(ex)} onError={onError} />
          : <img decoding="async" draggable={false} src={showGif ? gifSrc(ex) : imgSrc(ex)} alt={exerciseNameFor(ex)} onError={onError} />}
      {minimizable && (
        <button className="giftoggle" onClick={toggleSize}>
          <Icon name={mini ? 'expand' : 'minimize'} />{mini ? t('Expand') : t('Minimize')}
        </button>
      )}
      {!mini && !failed && (
        <button type="button" className="gifhint" onClick={e => { e.stopPropagation(); onTap() }}>
          <Icon name={playing ? 'pause' : 'play'} />{playing ? t('tap to pause') : t('tap to play')}
        </button>
      )}
    </div>
  )
}

// A still that will not load (offline and never cached, a lapsed session on a gated instance, a
// CDN hiccup) gets the same neutral tile as an exercise without media, instead of the browser's
// broken-image glyph in a list of them (#281). The failure is remembered per image, so a list
// that re-renders does not ask again; a new exercise in the same slot tries its own.
export function Thumb(p) {
  return p.ex?.custom ? <CustomThumb {...p} /> : <BuiltinThumb {...p} />
}
function BuiltinThumb({ ex }) {
  const src = ex.img ? imgSrc(ex) : null
  const [broken, setBroken] = useState(null)
  if (!src || broken === src) return <div className="thumb thumb-x"><Icon name="dumbbell" /></div>
  return <img className="thumb" loading="lazy" decoding="async" draggable={false} src={src} alt="" onError={() => setBroken(src)} />
}
