import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import zh from '../exercise-names/zh.js'
import { EXDB } from './exercises-data.js'
import { EXERCISE_NAME_LANGS, _setLangState, exerciseNameFor } from './i18n-core.js'

const source = JSON.parse(readFileSync(new URL('../../../scripts/exercise-name-sources/zh.json', import.meta.url), 'utf8'))

afterEach(() => _setLangState('en', {}, null, null))

describe('Simplified Chinese exercise names', () => {
  it('is a complete runtime pack generated from its editable source', () => {
    expect(EXERCISE_NAME_LANGS).toContain('zh')
    expect(zh).toEqual(source)
    expect(Object.keys(zh)).toHaveLength(EXDB.length)
    for (const exercise of EXDB) {
      expect(zh[exercise.id]?.trim(), exercise.id).toBeTruthy()
      expect(zh[exercise.id], exercise.id).toMatch(/\p{Script=Han}/u)
    }
  })

  it('preserves equipment and identity-changing qualifiers', () => {
    const title = name => {
      const exercise = EXDB.find(item => item.n === name)
      expect(exercise, name).toBeTruthy()
      return zh[exercise.id]
    }
    expect(title('barbell bench press')).toContain('杠铃')
    expect(title('dumbbell bench press')).toContain('哑铃')
    expect(title('kettlebell alternating press')).toContain('壶铃')
    expect(title('assisted chest dip (kneeling)')).toMatch(/辅助.*跪姿/)
    expect(title('weighted cossack squats (male)')).toMatch(/负重.*男/)
    expect(title('dumbbell reverse grip row (female)')).toMatch(/哑铃.*反握.*女性/)
  })

  it('shows a translated title in the Chinese exercise library', () => {
    const exercise = EXDB.find(item => item.n === 'all fours squad stretch')
    expect(exercise).toBeTruthy()
    _setLangState('zh', {}, null, zh)
    expect(exerciseNameFor(exercise)).toBe(`${zh[exercise.id]} (${exercise.n})`)
    expect(zh[exercise.id]).toMatch(/\p{Script=Han}/u)
  })
})
