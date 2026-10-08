import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { DAYS, MONTHS_LONG, fmtDate, isoOf, todayISO, weekStartOf, weekOrder, weekDayOffset } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { MILESTONES, checkInsOf, checkInSummary, saveCheckIn, deleteCheckIn } from '../lib/checkin.js'
import { useLocalDay } from '../lib/use-local-day.js'
import { syncMedia } from '../lib/media-sync.js'
import { MOBILE } from '../lib/mobile.js'
import { useMediaPicker } from '../components/CustomMediaField.jsx'
import { MediaView } from '../components/CustomMedia.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { confirmSheet } from '../sheets.jsx'

const toast = message => useUI.getState().toast(message)
const accountOf = state => [state.user?.id || null, state.sync?.server || ''].join('|')

export default function CheckIn() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const config = useStore(s => s.config)
  const update = useStore(s => s.update)
  const day = useLocalDay()
  const { pick, busy, note, canAdd } = useMediaPicker()
  const camera = useRef(null), album = useRef(null), selection = useRef(null)
  const processing = useRef(false), mounted = useRef(true)
  const [month, setMonth] = useState(() => new Date(day.slice(0, 7) + '-01T12:00:00'))
  const summary = checkInSummary(S)
  const history = checkInsOf(S).filter(c => c.d <= day)
  // Old servers do not keep journal references during media GC. Never send them these photos.
  const serverLacks = (!!user || !MOBILE) && !!config && !config.media?.checkins
  const canPick = canAdd && !serverLacks
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const begin = input => {
    if (!canPick || processing.current) return
    selection.current = { day: todayISO(), account: accountOf(useStore.getState()) }
    input.current?.click()
  }
  const onFile = async ev => {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    const attempt = selection.current
    selection.current = null
    if (!file || !attempt || processing.current) return
    const stillCurrent = () => mounted.current && attempt.account === accountOf(useStore.getState())
    if (!stillCurrent() || attempt.day !== todayISO()) {
      if (stillCurrent()) toast(t('Today has changed — open check-in again.'))
      return
    }
    processing.current = true
    try {
      const media = await pick(file)
      if (!media || !stillCurrent()) return
      if (media.kind !== 'image') { toast(t('Choose a still photo for check-in.')); return }
      const current = useStore.getState()
      if ((current.user || !MOBILE) && current.config && !current.config.media?.checkins) return
      let saved = false
      update(s => { saved = saveCheckIn(s, media, attempt.day) })
      if (!saved) { toast(t('Today has changed — open check-in again.')); return }
      toast(t('Check-in saved'))
      syncMedia({ force: true }).catch(() => {})
    } finally {
      processing.current = false
    }
  }
  const view = entry => useUI.getState().openSheet(close => <PhotoViewer entry={entry} close={close} />, { kind: 'viewer' })
  const remove = () => {
    const attempt = { day, account: accountOf(useStore.getState()) }
    confirmSheet({
      title: t("Delete today's check-in?"),
      message: t('Deleting removes today from your check-in total.'),
      confirmText: t('Remove'), danger: true,
      onConfirm: () => {
        if (attempt.account !== accountOf(useStore.getState())) return
        let removed = false
        update(s => { removed = deleteCheckIn(s, attempt.day) })
        toast(t(removed ? 'Check-in removed' : 'Today has changed — open check-in again.'))
      },
    })
  }

  const y = month.getFullYear(), mo = month.getMonth(), ws = weekStartOf(S)
  const monthKey = isoOf(month).slice(0, 7)
  const byDay = new Map(history.filter(c => c.d.startsWith(monthKey)).map(c => [c.d, c]))
  const offset = weekDayOffset(new Date(y, mo, 1, 12).getDay(), ws)
  const cells = Array.from({ length: offset }, (_, i) => <div key={'empty' + i} />)
  for (let d = 1; d <= new Date(y, mo + 1, 0, 12).getDate(); d++) {
    const iso = monthKey + '-' + String(d).padStart(2, '0')
    const entry = byDay.get(iso)
    cells.push(<button key={iso} className={'cal-d' + (entry ? ' has' : '') + (iso === day ? ' today' : '')}
      disabled={!entry} onClick={() => view(entry)} aria-current={iso === day ? 'date' : undefined}
      aria-label={entry ? t('Check-in on {0}', fmtDate(iso, true, true)) : fmtDate(iso, true, true)}>
      <time dateTime={iso}>{d}</time><i className={entry ? 'done' : ''} aria-hidden="true" />
    </button>)
  }

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/home')} aria-label={t('Home')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1 }}><h1 style={{ fontSize: 28 }}>{t('Daily check-in')}</h1><div className="sub">{fmtDate(day, true, true)}</div></div>
    </div>

    <div className="card">
      <div className="row" style={{ gap: 10, marginBottom: 14 }}>
        <span className="lrow-i" style={{ background: summary.today ? 'var(--green)' : 'var(--blue)' }}><Icon name={summary.today ? 'checkCircle' : 'camera'} /></span>
        <div><div className="lbl2">{t('Today')}</div><div className="ttl" aria-live="polite">{t(summary.today ? 'Checked in today' : 'Not checked in today')}</div></div>
      </div>
      {summary.today
        ? <button className="ci-photo" onClick={() => view(summary.today)} aria-label={t('Check-in on {0}', fmtDate(day, true, true))}>
          <MediaView key={summary.today.media.hash} m={summary.today.media} cls="exmedia ci-today" name={t('Check-in on {0}', fmtDate(day, true, true))} />
        </button>
        : <div className="ci-empty"><Icon name="camera" /><p className="small muted">{t('Check in with a gym photo to start your journal.')}</p></div>}
      <div className="ci-actions">
        <Button variant={summary.today ? 'plain' : 'primary'} icon="camera" disabled={!canPick} onClick={() => begin(camera)}>{busy ? t('Loading…') : t(summary.today ? 'Replace photo' : 'Take a gym photo')}</Button>
        <Button icon="image" disabled={!canPick} onClick={() => begin(album)}>{t('Choose from album')}</Button>
        {summary.today && <button className="iconbtn" style={{ color: 'var(--red)' }} disabled={busy} onClick={remove} aria-label={t("Delete today's check-in?")}><Icon name="trash" /></button>}
      </div>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={album} type="file" accept="image/*" hidden onChange={onFile} />
      {(serverLacks || note) && <p className="small muted" style={{ marginTop: 12 }} role={serverLacks ? 'status' : undefined}>{serverLacks ? t('Your server does not support check-in photos yet.') : note}</p>}
    </div>

    <div className="card">
      <div className="ci-stats">
        <div><div className="stat-v">{summary.total}</div><div className="small muted">{t('Total check-ins')}</div></div>
        <div><div className="stat-v">{summary.streak}</div><div className="small muted">{t('Consecutive days')}</div></div>
      </div>
      <h2>{t('Honors')}</h2>
      <div className="ci-honors">
        {MILESTONES.map((n, i) => {
          const earned = summary.earned.includes(n), count = Math.min(summary.total, n)
          return <div key={n} className={'ci-honor' + (earned ? ' earned' : '')} role="progressbar"
            aria-valuemin={0} aria-valuemax={n} aria-valuenow={count}
            aria-label={t('{0} check-ins', n) + ': ' + t(earned ? 'Honor earned' : 'Honor not earned yet')}>
            <div className="ci-honor-badge">
              <svg className="ci-honor-ring" viewBox="0 0 60 60" fill="none" aria-hidden="true">
                <circle cx="30" cy="30" r="26" stroke="var(--label-3)" strokeWidth="4" />
                <circle cx="30" cy="30" r="26" pathLength="100" stroke="var(--acc)" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${count / n * 100} 100`} opacity={count ? 1 : 0} />
              </svg>
              <Icon name={['medal', 'trophy', 'star', 'crown'][i]} />
              {earned && <Icon name="checkCircle" className="ci-honor-check" />}
            </div>
            <b>{n}</b>
          </div>
        })}
      </div>
    </div>

    <div className="card ci-calendar">
      <h2>{t('Check-in history')}</h2>
      <div className="row between">
        <button className="iconbtn" onClick={() => setMonth(new Date(y, mo - 1, 1, 12))} aria-label={t('Previous month')}><Icon name="chevronLeft" /></button>
        <h3 style={{ margin: 0 }} aria-live="polite">{t(MONTHS_LONG[mo])} {y}</h3>
        <button className="iconbtn" onClick={() => setMonth(new Date(y, mo + 1, 1, 12))} aria-label={t('Next month')}><Icon name="chevronRight" /></button>
      </div>
      <div className="small muted" style={{ textAlign: 'center' }}>{t('{0} check-ins', byDay.size)}</div>
      <div className="cal-grid">{weekOrder(ws).map(d => <div key={d} className="cal-h">{t(DAYS[d])}</div>)}{cells}</div>
      <div className="cal-legend"><span><i style={{ background: 'var(--acc)' }} />{t('Daily check-in')}</span></div>
      {history.length === 0 && <p className="small muted">{t('No check-ins yet')}</p>}
      <p className="small muted" style={{ marginTop: 12 }}>{t('Your photos are kept without an expiry date.')}</p>
      {history.length > 0 && <p className="small muted">{t('Only today can be changed. Past check-ins are read-only.')}</p>}
    </div>
  </div>
}


// ponytail: history is view-only; all edits stay in today's card. Close is the only focus target.
function PhotoViewer({ entry, close }) {
  const box = useRef(null)
  const account = useRef(accountOf(useStore.getState()))
  const currentAccount = useStore(s => accountOf(s))
  const S = useStore(s => s.S)
  const record = checkInsOf(S).find(c => c.d === entry.d)
  useEffect(() => { if (!record || account.current !== currentAccount) close() }, [record?.media.hash, currentAccount])
  useEffect(() => {
    const before = document.activeElement
    box.current?.querySelector('button')?.focus()
    return () => { if (before?.isConnected) before.focus?.() }
  }, [])
  if (!record || account.current !== currentAccount) return null
  return <div className="mviewer" role="dialog" aria-modal="true" aria-label={t('Check-in photos')} ref={box} tabIndex={-1}
    onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); box.current?.querySelector('button')?.focus() } }}>
    <div className="mviewer-bar">
      <button className="iconbtn" aria-label={t('Close')} onClick={close}><Icon name="xmark" /></button>
      <span className="mviewer-count">{fmtDate(entry.d, true, true)}</span>
    </div>
    <div className="mviewer-stage"><MediaView m={record.media} cls="exmedia viewer" name={t('Check-in on {0}', fmtDate(entry.d, true, true))} /></div>
  </div>
}
