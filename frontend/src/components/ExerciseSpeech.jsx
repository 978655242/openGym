import { useEffect, useId, useSyncExternalStore } from 'react'
import { Button } from './ui.jsx'
import { baseLang, dateLocale, getLang, instructionInfoFor, t, useLang } from '../lib/i18n.js'
import {
  getSpeechSnapshot, pauseSpeech, resumeSpeech, speechAvailability, startSpeech, stopSpeech, subscribeSpeech
} from '../lib/exercise-speech.js'

const messageFor = error => {
  if (error === 'unsupported') return t('Speech is not supported on this device.')
  if (error === 'voice-missing') return t('No local voice is available for this language. Check your device speech settings.')
  if (error === 'not-allowed') return t('Tap Read instructions to try again.')
  return t('Could not play the instructions.')
}


export default function ExerciseSpeech({ ex, preview = false }) {
  return preview ? null : <ExerciseSpeechControl ex={ex} />
}

function ExerciseSpeechControl({ ex }) {
  const owner = useId()
  const snapshot = useSyncExternalStore(subscribeSpeech, getSpeechSnapshot)
  const { steps, lang } = instructionInfoFor(ex)
  const currentLang = baseLang(getLang())
  const speaksCurrentLanguage = !!steps.length && lang === currentLang
  const availability = speaksCurrentLanguage ? speechAvailability(dateLocale()) : null
  const active = snapshot.exerciseId === ex.id && ['starting', 'speaking', 'paused', 'ended'].includes(snapshot.status)

  useEffect(() => () => stopSpeech(owner), [owner, ex.id, currentLang])

  const quiet = event => event.stopPropagation()
  const start = event => {
    quiet(event)
    startSpeech({ owner, exerciseId: ex.id, steps, lang: dateLocale() })
  }
  const pause = event => { quiet(event); pauseSpeech(snapshot.owner) }
  const resume = event => { quiet(event); resumeSpeech(snapshot.owner) }
  const stop = event => { quiet(event); stopSpeech(snapshot.owner) }

  if (!speaksCurrentLanguage) return <div className="small dim speech-controls">{t('Instructions are not available in the current language.')}</div>
  if (availability) return <div className="small dim speech-controls">{messageFor(availability)}</div>
  if (snapshot.status === 'error' && snapshot.exerciseId === ex.id) {
    return <div className="small dim speech-controls">{messageFor(snapshot.error)}</div>
  }

  const step = active ? steps[snapshot.stepIndex] : null
  return <div className="speech-controls" onClick={quiet}>
    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
      {!active && <Button type="button" aria-label={t('Read instructions')} onClick={start}>{t('Read instructions')}</Button>}
      {active && snapshot.status === 'paused' && <Button type="button" icon="play" aria-label={t('Resume')} onClick={resume} />}
      {active && snapshot.status !== 'paused' && snapshot.status !== 'ended' && <Button type="button" icon="pause" aria-label={t('Pause')} onClick={pause} />}
      {active && snapshot.status !== 'ended' && <Button type="button" icon="xmark" aria-label={t('Stop narration')} onClick={stop} />}
      {snapshot.status === 'ended' && snapshot.exerciseId === ex.id && <Button type="button" aria-label={t('Replay instructions')} onClick={start}>{t('Replay instructions')}</Button>}
    </div>
    {step && <div className="small dim" style={{ marginTop: 5 }}>
      {t('Instruction {0} / {1}', snapshot.stepIndex + 1, steps.length)} · {step}
    </div>}
  </div>
}
