import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { parseHTML } from 'linkedom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const state = {
    S: null, sheets: [], work: null, timer: null,
    startSpeech: vi.fn(() => true), stopSpeech: vi.fn(),
  }
  state.store = () => ({
    S: state.S, user: null,
    update: mut => { const next = structuredClone(state.S); mut(next); state.S = next },
  })
  state.ui = () => ({
    sheets: state.sheets, work: state.work, timer: state.timer,
    startRest: vi.fn(), stopRest: vi.fn(), stopWork: vi.fn(), shiftRestOwner: vi.fn(),
    startWork: vi.fn(), toast: vi.fn(),
  })
  return state
})

vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector(mocks.store())
  useStore.getState = mocks.store
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const useUI = selector => selector ? selector(mocks.ui()) : mocks.ui()
  useUI.getState = mocks.ui
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../components/Media.jsx', () => ({ default: () => null }))
vi.mock('../components/ExerciseSpeech.jsx', () => ({ default: ({ preview }) => preview ? null : <div data-testid="speech-control" /> }))
vi.mock('../lib/exercise-speech.js', () => {
  const snapshot = { owner: null, exerciseId: null, status: 'idle', stepIndex: 0, error: null, voicesVersion: 0 }
  return {
    getSpeechSnapshot: () => snapshot,
    subscribeSpeech: () => () => {},
    speechAvailability: () => null,
    startSpeech: mocks.startSpeech,
    stopSpeech: mocks.stopSpeech,
  }
})
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn() }))
vi.mock('../sheets.jsx', () => ({
  startFlow: vi.fn(), exercisePicker: vi.fn(), exConfigSheet: vi.fn(), exerciseDetailSheet: vi.fn(),
  finishWorkout: vi.fn(), exitWorkoutEdit: vi.fn(), workoutCompleteSheet: vi.fn(), confirmSheet: vi.fn(),
  exerciseNoteSheet: vi.fn(), sessionNoteSheet: vi.fn(), renameWorkoutSheet: vi.fn(),
  swapActiveWorkoutExercise: vi.fn(), barWeightSheet: vi.fn(), menuSheet: vi.fn(), effortPickerSheet: vi.fn(),
  exerciseHistorySheet: vi.fn(), addRoutineToSessionSheet: vi.fn(),
}))

import Workout from './Workout.jsx'

let dom, root, container
const entry = id => ({
  id, target: { mode: 'reps', reps: 5, weight: 60, bodyweight: false },
  sets: [{ w: 60, r: 5, done: false }],
})
const state = (entries, cur = 0, active = {}) => ({
  unit: 'kg', lang: 'en', restSec: 90, sound: false, effort: 'none', gifSize: 'off', workoutView: 'cards', routines: [], workouts: [], exWeights: {},
  active: { id: 'speech-workout', name: 'Speech workout', start: Date.now(), cur, entries, ...active },
})

beforeEach(async () => {
  vi.clearAllMocks()
  mocks.sheets = []
  mocks.S = state([entry('0043'), entry('0054')])
  const parsed = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>')
  dom = parsed.window
  globalThis.window = dom
  globalThis.document = dom.document
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.navigator })
  for (const key of ['HTMLElement', 'Node', 'Element', 'Event', 'Blob']) globalThis[key] = dom[key]
  dom.Element.prototype.scrollIntoView = () => {}
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.getElementById('root')
  root = createRoot(container)
  await act(async () => { root.render(<Workout />) })
})
afterEach(async () => {
  if (root) await act(async () => { root.unmount() })
  root = null
})

it('stays silent until auto narration is explicitly enabled, then reads current and next IDs once', async () => {
  expect(mocks.startSpeech).not.toHaveBeenCalled()
  const auto = container.querySelector('[role="switch"]')
  expect(auto).toBeTruthy()
  await act(async () => { auto.dispatchEvent(new dom.Event('click', { bubbles: true })) })
  expect(mocks.startSpeech).toHaveBeenCalledWith(expect.objectContaining({ exerciseId: '0043' }))
  expect(container.querySelectorAll('[data-testid="speech-control"]')).toHaveLength(1)

  const next = [...container.querySelectorAll('button')].find(button => button.textContent.trim() === 'Next')
  await act(async () => { next.dispatchEvent(new dom.Event('click', { bubbles: true })) })
  await act(async () => { root.render(<Workout />) })
  expect(mocks.stopSpeech).toHaveBeenCalled()
  expect(mocks.startSpeech).toHaveBeenLastCalledWith(expect.objectContaining({ exerciseId: '0054' }))

  const previous = [...container.querySelectorAll('button')].find(button => button.textContent.trim() === 'Prev')
  await act(async () => { previous.dispatchEvent(new dom.Event('click', { bubbles: true })) })
  expect(mocks.startSpeech.mock.calls.filter(([call]) => call.exerciseId === '0043')).toHaveLength(1)
})

it('does not mount narration controls for cards SwipeCards renders as previews', () => {
  expect(container.querySelectorAll('[data-testid="speech-control"]')).toHaveLength(1)
})
