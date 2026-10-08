import { isoOf } from './format.js'
import { normalizeMediaRef } from './media-refs.js'

export const MILESTONES = [7, 30, 100, 365]
const validDay = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && isoOf(new Date(d + 'T12:00:00')) === d
const positiveTime = v => Number.isFinite(v) && v > 0

// ponytail: one entry per local date; tombstones keep an offline device from undoing a deletion.
export function normalizeCheckIns(records) {
  const days = new Map()
  for (const r of Array.isArray(records) ? records : []) {
    if (!r || !validDay(r.d) || !positiveTime(r.at)) continue
    const media = r.deleted === true ? null : normalizeMediaRef(r.media)
    if (r.deleted !== true && media?.kind !== 'image') continue
    const c = { id: r.d, d: r.d, at: r.at, _ts: positiveTime(r._ts) ? r._ts : r.at,
      ...(r.deleted === true ? { deleted: true } : { media }) }
    const old = days.get(c.d)
    // Stable tie-break on every device; a deletion wins a simultaneous replacement.
    const wins = !old || c._ts > old._ts || (c._ts === old._ts && (
      Number(!!c.deleted) > Number(!!old.deleted) || (c.deleted === old.deleted && (
        (c.media?.hash || '') > (old.media?.hash || '') || ((c.media?.hash || '') === (old.media?.hash || '') && (
          c.at > old.at || (c.at === old.at && JSON.stringify(c.media) > JSON.stringify(old.media))
        ))
      ))
    ))
    if (wins) days.set(c.d, c)
  }
  return [...days.values()].sort((a, b) => a.d.localeCompare(b.d))
}

export const mergeCheckIns = (a, b) => normalizeCheckIns([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])
export const checkInsOf = S => normalizeCheckIns(S?.gymCheckIns).filter(c => !c.deleted).reverse()

export function checkInSummary(S, now = Date.now()) {
  const day = isoOf(new Date(now))
  const records = checkInsOf(S).filter(c => c.d <= day)
  const days = new Set(records.map(c => c.d))
  const cursor = new Date(day + 'T12:00:00')
  if (!days.has(day)) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(isoOf(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  const total = records.length
  return { today: records.find(c => c.d === day) || null, total, streak,
    earned: MILESTONES.filter(n => total >= n), next: MILESTONES.find(n => total < n) || null }
}

export function saveCheckIn(S, ref, day, now = Date.now()) {
  if (!positiveTime(now) || day !== isoOf(new Date(now))) return false
  const media = normalizeMediaRef(ref)
  if (media?.kind !== 'image') return false
  const records = normalizeCheckIns(S.gymCheckIns)
  const previous = records.find(c => c.d === day)
  const entry = { id: day, d: day, at: previous && !previous.deleted ? previous.at : now,
    _ts: Math.max(now, (previous?._ts || 0) + 1), media }
  S.gymCheckIns = mergeCheckIns(records, [entry])
  return true
}

export function deleteCheckIn(S, day, now = Date.now()) {
  if (!positiveTime(now) || day !== isoOf(new Date(now))) return false
  const records = normalizeCheckIns(S.gymCheckIns)
  const previous = records.find(c => c.d === day && !c.deleted)
  if (!previous) return false
  S.gymCheckIns = mergeCheckIns(records, [{ id: day, d: day, at: previous.at,
    _ts: Math.max(now, previous._ts + 1), deleted: true }])
  return true
}
