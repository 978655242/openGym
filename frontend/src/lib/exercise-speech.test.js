// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let speech
let utterances
let platform

const localVoice = (lang, extra = {}) => ({
  name: `Local ${lang}`, lang, localService: true, default: false, ...extra
})

beforeEach(async () => {
  vi.resetModules()
  utterances = []
  platform = new EventTarget()
  platform.getVoices = () => [localVoice('zh-CN', { default: true })]
  platform.speak = utterance => { utterances.push(utterance) }
  platform.cancel = vi.fn()
  vi.stubGlobal('speechSynthesis', platform)
  vi.stubGlobal('SpeechSynthesisUtterance', class {
    constructor(text) { this.text = text }
  })
  speech = await import('./exercise-speech.js')
})

afterEach(() => {
  speech?.stopSpeech()
  vi.unstubAllGlobals()
})

describe('chooseSpeechVoice', () => {
  it('uses a local exact-language default before another local voice', () => {
    const first = localVoice('zh-CN')
    const preferred = localVoice('zh-CN', { name: 'Preferred', default: true })
    expect(speech.chooseSpeechVoice([first, preferred], 'zh_CN')).toBe(preferred)
  })

  it('uses a same-language local voice but never remote or English fallback', () => {
    const Portuguese = localVoice('pt-PT')
    expect(speech.chooseSpeechVoice([Portuguese], 'pt-BR')).toBe(Portuguese)
    expect(speech.chooseSpeechVoice([{ ...localVoice('zh-CN'), localService: false }], 'zh-CN')).toBeNull()
    expect(speech.chooseSpeechVoice([localVoice('en-GB')], 'zh-CN')).toBeNull()
  })
})

describe('single narration task', () => {
  it('replaces an earlier task and ignores its late browser events', () => {
    speech.startSpeech({ owner: 'detail', exerciseId: '0043', steps: ['屈膝下蹲。'], lang: 'zh-CN' })
    const old = utterances.at(-1)
    speech.startSpeech({ owner: 'workout', exerciseId: '0029', steps: ['保持背部稳定。'], lang: 'zh-CN' })
    utterances.at(-1).onstart()
    old.onend()
    old.onerror({ error: 'interrupted' })
    expect(speech.getSpeechSnapshot()).toMatchObject({
      owner: 'workout', exerciseId: '0029', status: 'speaking', stepIndex: 0, error: null
    })
  })

  it('does not let a non-owner stop the active task', () => {
    speech.startSpeech({ owner: 'workout', exerciseId: '0043', steps: ['屈膝下蹲。'], lang: 'zh-CN' })
    platform.cancel.mockClear()
    speech.stopSpeech('detail')
    expect(speech.getSpeechSnapshot()).toMatchObject({ owner: 'workout', status: 'starting' })
    expect(platform.cancel).not.toHaveBeenCalled()
  })

  it('pauses at the current step and resumes it from the beginning', () => {
    speech.startSpeech({ owner: 'detail', exerciseId: '0043', steps: ['第一步。', '第二步。'], lang: 'zh-CN' })
    const first = utterances.at(-1)
    first.onstart()
    speech.pauseSpeech('detail')
    first.onend()
    expect(speech.getSpeechSnapshot()).toMatchObject({ status: 'paused', stepIndex: 0 })
    speech.resumeSpeech('detail')
    expect(utterances.at(-1).text).toBe('第一步。')
    utterances.at(-1).onend()
    expect(utterances.at(-1).text).toBe('第二步。')
  })

  it('restarts from step zero when explicitly started again', () => {
    speech.startSpeech({ owner: 'detail', exerciseId: '0043', steps: ['第一步。', '第二步。'], lang: 'zh-CN' })
    utterances.at(-1).onend()
    speech.startSpeech({ owner: 'detail', exerciseId: '0043', steps: ['第一步。', '第二步。'], lang: 'zh-CN' })
    expect(utterances.at(-1).text).toBe('第一步。')
    expect(speech.getSpeechSnapshot().stepIndex).toBe(0)
  })

  it('does not let a prior task error overwrite a replacement', () => {
    speech.startSpeech({ owner: 'detail', exerciseId: '0043', steps: ['第一步。'], lang: 'zh-CN' })
    const old = utterances.at(-1)
    speech.startSpeech({ owner: 'workout', exerciseId: '0029', steps: ['第二步。'], lang: 'zh-CN' })
    old.onerror({ error: 'not-allowed' })
    expect(speech.getSpeechSnapshot()).toMatchObject({ owner: 'workout', status: 'starting', error: null })
  })
})

describe('availability', () => {
  it('reports missing local voice and updates subscribers when voices arrive', () => {
    platform.getVoices = () => []
    expect(speech.speechAvailability('zh-CN')).toBe('voice-missing')
    const changed = vi.fn()
    const unsubscribe = speech.subscribeSpeech(changed)
    platform.getVoices = () => [localVoice('zh-CN')]
    platform.dispatchEvent(new Event('voiceschanged'))
    expect(changed).toHaveBeenCalledTimes(1)
    expect(speech.speechAvailability('zh-CN')).toBeNull()
    unsubscribe()
  })

  it('rejects absent browser speech APIs without queuing a request', async () => {
    vi.unstubAllGlobals()
    vi.resetModules()
    const noApi = await import('./exercise-speech.js')
    expect(noApi.speechAvailability('zh-CN')).toBe('unsupported')
    expect(noApi.startSpeech({ owner: 'detail', exerciseId: '0043', steps: ['第一步。'], lang: 'zh-CN' })).toBe(false)
    expect(noApi.getSpeechSnapshot()).toMatchObject({ status: 'error', error: 'unsupported' })
  })
})
