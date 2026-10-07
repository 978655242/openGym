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
const EX2 = { id: '0054', n: 'lunge', st: ['Step forward.', 'Lower down.'] }

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

it('uses compact icon buttons for pause and stop narration', () => {
  mount()
  const read = host.querySelector('button')
  expect(read.textContent).toBe('Read instructions')
  act(() => read.click())
  utterances.at(-1).onstart()
  const controls = host.querySelector('.speech-controls > .row')
  const pause = controls.querySelector('[aria-label="Pause"]')
  const stop = controls.querySelector('[aria-label="Stop narration"]')
  expect(pause.textContent).toBe('')
  expect(stop.textContent).toBe('')
  expect(pause.querySelector('[data-icon="pause"]')).not.toBeNull()
  expect(stop.querySelector('[data-icon="xmark"]')).not.toBeNull()
  act(() => pause.click())
  expect([...controls.querySelectorAll('button')].map(button => button.getAttribute('aria-label'))).toEqual(['Resume', 'Stop narration'])
  const resume = controls.querySelector('[aria-label="Resume"]')
  expect(resume.textContent).toBe('')
  expect(resume.querySelector('[data-icon="play"]')).not.toBeNull()
  expect(stop.textContent).toBe('')
  expect(controls.style.gap).toBe('6px')
  expect(host.textContent).not.toContain('Resume restarts the current step.')
  act(() => controls.querySelector('[aria-label="Resume"]').click())
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
      <div key="workout"><ExerciseSpeech ex={EX2} /></div>
    </>))
    renderEntrances(true)
    act(() => host.querySelectorAll('.speech-controls')[0].querySelector('button').click())
    const firstOwner = getSpeechSnapshot().owner
    act(() => host.querySelectorAll('.speech-controls')[1].querySelector('button').click())
    const secondOwner = getSpeechSnapshot().owner
    expect(secondOwner).not.toBe(firstOwner)
    platform.cancel.mockClear()
    renderEntrances(false)
    expect(platform.cancel).not.toHaveBeenCalled()
    expect(getSpeechSnapshot().owner).toBe(secondOwner)
  })
})
