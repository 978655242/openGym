// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ExerciseSpeech from './ExerciseSpeech.jsx'
import { getSpeechSnapshot } from '../lib/exercise-speech.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
import { _setLangState } from '../lib/i18n-core.js'

let host, root, utterances, platform
const EX = { id: '0043', n: 'squat', st: ['Stand tall.', 'Bend your knees.'] }

beforeEach(() => {
  utterances = []
  platform = new EventTarget()
  platform.getVoices = () => [{ name: 'Local English', lang: 'en-GB', localService: true, default: true }]
  platform.cancel = vi.fn()
  platform.speak = utterance => utterances.push(utterance)
  vi.stubGlobal('speechSynthesis', platform)
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(text) { this.text = text } })
  _setLangState('en', {}, null, null)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})
const mount = props => act(() => root.render(<ExerciseSpeech ex={EX} {...props} />))

it('starts, pauses, and resumes the current instruction step', () => {
  mount()
  const read = host.querySelector('button')
  expect(read.textContent).toBe('Read instructions')
  act(() => read.click())
  utterances.at(-1).onstart()
  expect(host.textContent).toContain('Stand tall.')
  expect(host.textContent).toContain('Instruction 1 / 2')
  act(() => [...host.querySelectorAll('button')].find(button => button.textContent === 'Pause').click())
  expect(host.textContent).toContain('Resume restarts the current step.')
  act(() => [...host.querySelectorAll('button')].find(button => button.textContent === 'Resume').click())
  expect(utterances.at(-1).text).toBe('Stand tall.')
})

it('does not render or subscribe for a preview card', () => {
  mount({ preview: true })
  expect(host.innerHTML).toBe('')
})

it('does not speak English fallback steps through a Chinese voice', () => {
  platform.getVoices = () => [{ name: 'Local Mandarin', lang: 'zh-CN', localService: true, default: true }]
  _setLangState('zh', {}, {}, null)
  mount()
  expect(host.textContent).toContain('Instructions are not available in the current language.')
  expect(utterances).toHaveLength(0)
})

describe('ownership cleanup', () => {
  it('does not stop a replacement owned by another entrance', () => {
    const renderEntrances = first => act(() => root.render(<>
      {first && <div key="detail"><ExerciseSpeech ex={EX} /></div>}
      <div key="workout"><ExerciseSpeech ex={EX} /></div>
    </>))
    renderEntrances(true)
    act(() => host.querySelectorAll('.speech-controls')[0].querySelector('button').click())
    const firstOwner = getSpeechSnapshot().owner
    act(() => [...host.querySelectorAll('.speech-controls')[1].querySelectorAll('button')]
      .find(button => button.textContent === 'Replay instructions').click())
    const secondOwner = getSpeechSnapshot().owner
    expect(secondOwner).not.toBe(firstOwner)
    platform.cancel.mockClear()
    renderEntrances(false)
    expect(platform.cancel).not.toHaveBeenCalled()
    expect(getSpeechSnapshot().owner).toBe(secondOwner)
  })
})
