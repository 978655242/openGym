import { describe, expect, it } from 'vitest'
import { checkInsOf, checkInSummary, deleteCheckIn, mergeCheckIns, normalizeCheckIns, saveCheckIn } from './checkin.js'

const time = (d, hour = 12) => new Date(`${d}T${String(hour).padStart(2, '0')}:00:00`).getTime()
const photo = (hash = 'a') => ({ kind: 'image', hash: hash.repeat(64), mime: 'image/jpeg', size: 100, width: 640, height: 480, at: 1 })
const record = (d, over = {}) => ({ id: d, d, at: time(d), _ts: time(d), media: photo(), ...over })

it('replaces the current photo without awarding a second attendance day', () => {
  const S = {}
  expect(saveCheckIn(S, photo(), '2026-10-08', time('2026-10-08', 9))).toBe(true)
  expect(saveCheckIn(S, photo('b'), '2026-10-08', time('2026-10-08', 18))).toBe(true)
  expect(S.gymCheckIns).toEqual([record('2026-10-08', {
    at: time('2026-10-08', 9), _ts: time('2026-10-08', 18), media: photo('b')
  })])
  expect(checkInSummary(S, time('2026-10-08')).total).toBe(1)
})

it('refuses backfill, historical edits, and a photo returned after midnight', () => {
  const S = { gymCheckIns: [record('2026-10-07')] }
  const before = structuredClone(S)
  expect(saveCheckIn(S, photo('b'), '2026-10-07', time('2026-10-08'))).toBe(false)
  expect(deleteCheckIn(S, '2026-10-07', time('2026-10-08'))).toBe(false)
  expect(saveCheckIn(S, photo('b'), '2026-10-09', time('2026-10-08'))).toBe(false)
  expect(saveCheckIn(S, photo('b'), '2026-10-08', time('2026-10-09', 0))).toBe(false)
  expect(S).toEqual(before)
})

it('requires a valid still photo and leaves the existing journal untouched on refusal', () => {
  const S = { gymCheckIns: [record('2026-10-07')] }
  const before = structuredClone(S)
  for (const media of [null, photo('x'), { ...photo(), size: 0 }, { ...photo(), kind: 'gif', mime: 'image/gif' }, { ...photo(), kind: 'video', mime: 'video/mp4' }]) {
    expect(saveCheckIn(S, media, '2026-10-08', time('2026-10-08'))).toBe(false)
  }
  expect(S).toEqual(before)
})

it('deletes today with a tombstone and permits another check-in the same day', () => {
  const S = { gymCheckIns: [record('2026-10-07'), record('2026-10-08')] }
  expect(deleteCheckIn(S, '2026-10-08', time('2026-10-08', 15))).toBe(true)
  expect(S.gymCheckIns.at(-1)).toEqual({ id: '2026-10-08', d: '2026-10-08', at: time('2026-10-08'), _ts: time('2026-10-08', 15), deleted: true })
  expect(checkInSummary(S, time('2026-10-08'))).toMatchObject({ today: null, total: 1, streak: 1 })
  expect(saveCheckIn(S, photo('b'), '2026-10-08', time('2026-10-08', 16))).toBe(true)
  expect(checkInsOf(S).map(c => [c.d, c.media.hash])).toEqual([['2026-10-08', 'b'.repeat(64)], ['2026-10-07', 'a'.repeat(64)]])
})

it('merges by per-day edit time, keeps deletion on ties, and never duplicates a day', () => {
  const old = record('2026-10-08')
  const edit = record('2026-10-08', { _ts: time('2026-10-08', 13), media: photo('b') })
  const deleted = { id: old.id, d: old.d, at: old.at, _ts: time('2026-10-08', 13), deleted: true }
  expect(mergeCheckIns([old], [edit])).toEqual([edit])
  expect(mergeCheckIns([deleted], [edit])).toEqual([deleted])
  expect(mergeCheckIns([edit], [deleted])).toEqual([deleted])
  const conflict = record('2026-10-08', { _ts: edit._ts, media: photo('c') })
  expect(mergeCheckIns([edit], [conflict])).toEqual(mergeCheckIns([conflict], [edit]))
})

it('converges when simultaneous copies have the same photo but different metadata', () => {
  const first = record('2026-10-08')
  const second = { ...first, media: { ...first.media, width: 800 } }
  expect(mergeCheckIns([first], [second])).toEqual(mergeCheckIns([second], [first]))
})

it('ignores malformed, deleted and future attendance when counting honors', () => {
  const valid = record('2026-10-07')
  const S = { gymCheckIns: [valid, { ...valid, id: 'other' }, record('2026-02-30'), record('2026-10-09'), record('2026-10-06', { deleted: true }), record('2026-10-05', { media: { ...photo(), kind: 'video', mime: 'video/mp4' } }), null] }
  expect(checkInSummary(S, time('2026-10-08'))).toMatchObject({ total: 1, streak: 1, earned: [], next: 7, today: null })
  expect(normalizeCheckIns('not a journal')).toEqual([])
})

describe('consecutive local calendar days', () => {
  it.each([
    { days: ['2026-10-06', '2026-10-07', '2026-10-08'], now: '2026-10-08', want: 3 },
    { days: ['2026-10-06', '2026-10-07'], now: '2026-10-08', want: 2 },
    { days: ['2026-10-05', '2026-10-06'], now: '2026-10-08', want: 0 },
    { days: ['2026-10-05', '2026-10-07', '2026-10-08'], now: '2026-10-08', want: 2 },
    { days: ['2026-12-31', '2027-01-01'], now: '2027-01-01', want: 2 },
    { days: ['2028-02-28', '2028-02-29', '2028-03-01'], now: '2028-03-01', want: 3 },
    { days: ['2026-03-07', '2026-03-08', '2026-03-09'], now: '2026-03-09', want: 3 }
  ])('counts $days at $now as $want, not elapsed 24-hour periods', ({ days, now, want }) => {
    expect(checkInSummary({ gymCheckIns: days.map(d => record(d)) }, time(now)).streak).toBe(want)
  })
})

it.each([
  [6, [], 7], [7, [7], 30], [29, [7], 30], [30, [7, 30], 100],
  [99, [7, 30], 100], [100, [7, 30, 100], 365], [364, [7, 30, 100], 365], [365, [7, 30, 100, 365], null]
])('awards cumulative milestones for %i days even after a break', (count, earned, next) => {
  const gymCheckIns = Array.from({ length: count }, (_, i) => {
    const d = new Date(2025, 0, i + 1)
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return record(date)
  })
  expect(checkInSummary({ gymCheckIns }, time('2026-10-08'))).toMatchObject({ total: count, streak: 0, earned, next })
})
