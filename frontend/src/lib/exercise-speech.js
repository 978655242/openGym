// One module-level task keeps speech exclusive across every detail sheet and workout card.
const subscribers = new Set()
let snapshot = {
  owner: null, exerciseId: null, status: 'idle', stepIndex: 0, error: null, voicesVersion: 0
}
let task = null
let generation = 0
let utterance = null // Keep the active utterance strongly referenced until the engine finishes it.
let listeningForVoices = false

const hasSpeech = () => typeof speechSynthesis !== 'undefined'
  && typeof SpeechSynthesisUtterance !== 'undefined'

const normalizeLang = lang => String(lang || '').replace(/_/g, '-').toLowerCase()
const languageBase = lang => normalizeLang(lang).split('-')[0]
const sameSnapshot = next => Object.keys(snapshot).every(key => snapshot[key] === next[key])
const publish = next => {
  if (sameSnapshot(next)) return
  snapshot = next
  subscribers.forEach(listener => listener())
}
const setSnapshot = changes => publish({ ...snapshot, ...changes })
const voices = () => hasSpeech() && typeof speechSynthesis.getVoices === 'function'
  ? speechSynthesis.getVoices() || [] : []

export function chooseSpeechVoice(list, lang) {
  const local = (list || []).filter(voice => voice?.localService === true)
  const wanted = normalizeLang(lang)
  const exact = local.filter(voice => normalizeLang(voice.lang) === wanted)
  const language = exact.length ? exact : local.filter(voice => languageBase(voice.lang) === languageBase(lang))
  return language.find(voice => voice.default) || language[0] || null
}

export function speechAvailability(lang) {
  if (!hasSpeech()) return 'unsupported'
  return chooseSpeechVoice(voices(), lang) ? null : 'voice-missing'
}

const onVoicesChanged = () => {
  setSnapshot({ voicesVersion: snapshot.voicesVersion + 1 })
}

export function subscribeSpeech(listener) {
  subscribers.add(listener)
  if (!listeningForVoices && hasSpeech() && typeof speechSynthesis.addEventListener === 'function') {
    voices()
    speechSynthesis.addEventListener('voiceschanged', onVoicesChanged)
    listeningForVoices = true
  }
  return () => {
    subscribers.delete(listener)
    if (!subscribers.size && listeningForVoices) {
      speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged)
      listeningForVoices = false
    }
  }
}

export const getSpeechSnapshot = () => snapshot

const clearTask = (status = 'idle', error = null) => {
  task = null
  utterance = null
  setSnapshot({ owner: null, exerciseId: null, status, stepIndex: 0, error })
}

const errorFor = error => {
  if (error === 'not-allowed') return 'not-allowed'
  if (error === 'language-unavailable' || error === 'voice-unavailable') return 'voice-missing'
  return 'synthesis-failed'
}

const speakStep = (current, token) => {
  const text = current.steps[current.stepIndex]
  const next = new SpeechSynthesisUtterance(text)
  utterance = next
  next.lang = current.lang
  next.voice = current.voice
  next.onstart = () => {
    if (token !== generation || task !== current || utterance !== next) return
    setSnapshot({ status: 'speaking', error: null })
  }
  next.onend = () => {
    if (token !== generation || task !== current || utterance !== next) return
    if (current.stepIndex + 1 < current.steps.length) {
      current.stepIndex++
      setSnapshot({ stepIndex: current.stepIndex, status: 'starting', error: null })
      speakStep(current, token)
      return
    }
    task = null
    utterance = null
    setSnapshot({ status: 'ended', error: null })
  }
  next.onerror = event => {
    if (token !== generation || task !== current || utterance !== next) return
    const error = event?.error
    task = null
    utterance = null
    if (error === 'interrupted' || error === 'canceled') {
      setSnapshot({ status: 'ended', error: null })
      return
    }
    setSnapshot({ status: 'error', error: errorFor(error) })
  }
  try {
    speechSynthesis.speak(next)
  } catch (_) {
    next.onerror({ error: 'synthesis-failed' })
  }
}

export function startSpeech({ owner, exerciseId, steps, lang } = {}) {
  const validSteps = Array.isArray(steps) && steps.length && steps.every(step => typeof step === 'string' && step.trim())
  const availability = speechAvailability(lang)
  if (!validSteps || availability) {
    generation++
    if (hasSpeech()) speechSynthesis.cancel()
    clearTask('error', availability || 'synthesis-failed')
    return false
  }
  const voice = chooseSpeechVoice(voices(), lang)
  generation++
  if (hasSpeech()) speechSynthesis.cancel()
  const current = task = { owner, exerciseId, steps, lang, voice, stepIndex: 0 }
  setSnapshot({ owner, exerciseId, status: 'starting', stepIndex: 0, error: null })
  speakStep(current, generation)
  return true
}

export function pauseSpeech(owner) {
  if (!task || task.owner !== owner || !hasSpeech()) return
  generation++
  speechSynthesis.cancel()
  utterance = null
  setSnapshot({ status: 'paused', error: null })
}

export function resumeSpeech(owner) {
  if (!task || task.owner !== owner || snapshot.status !== 'paused') return
  generation++
  setSnapshot({ status: 'starting', error: null })
  // ponytail: resume restarts the current instruction step; word-level resume is not portable.
  speakStep(task, generation)
}

export function stopSpeech(owner) {
  if (!task || (owner !== undefined && task.owner !== owner)) return
  generation++
  if (hasSpeech()) speechSynthesis.cancel()
  clearTask()
}
