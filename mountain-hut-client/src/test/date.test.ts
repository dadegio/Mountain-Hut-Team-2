import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatDay,
  normalizeTime,
  openPicker,
  shiftDate,
  slotHasEnded,
  toDateString,
  todayString,
} from '../utils/date'

describe('slotHasEnded', () => {
  const now = new Date(2026, 10, 4, 12, 0)

  it.each([
    ['earlier today', '2026-11-04', '11:59', true],
    ['exactly now', '2026-11-04', '12:00', true],
    ['later today', '2026-11-04', '12:01', false],
    ['on a past day, even if later in the day', '2026-11-03', '23:00', true],
    ['on a future day, even if earlier in the day', '2026-11-05', '08:00', false],
  ])('a slot ending %s', (_label, date, to, expected) => {
    expect(slotHasEnded(date, to, now)).toBe(expected)
  })
})

describe('toDateString', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toDateString(new Date(2026, 10, 16))).toBe('2026-11-16')
  })

  it('pads month and day with a leading zero', () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('uses the local date, also right after midnight and late at night', () => {
    expect(toDateString(new Date(2026, 10, 6, 0, 30))).toBe('2026-11-06')
    expect(toDateString(new Date(2026, 10, 6, 23, 30))).toBe('2026-11-06')
  })
})

describe('todayString', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the current date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 11, 25, 12, 0))

    expect(todayString()).toBe('2026-12-25')
  })
})

describe('shiftDate', () => {
  it('moves forward and backward by the given days', () => {
    expect(shiftDate('2026-11-06', 1)).toBe('2026-11-07')
    expect(shiftDate('2026-11-06', -1)).toBe('2026-11-05')
    expect(shiftDate('2026-11-06', 0)).toBe('2026-11-06')
  })

  it('crosses month and year boundaries', () => {
    expect(shiftDate('2026-10-31', 1)).toBe('2026-11-01')
    expect(shiftDate('2026-11-01', -1)).toBe('2026-10-31')
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDate('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('handles leap years', () => {
    expect(shiftDate('2028-02-28', 1)).toBe('2028-02-29')
    expect(shiftDate('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('crosses the daylight saving changes without skipping a day', () => {
    expect(shiftDate('2026-03-28', 1)).toBe('2026-03-29')
    expect(shiftDate('2026-03-29', 1)).toBe('2026-03-30')
    expect(shiftDate('2026-10-24', 1)).toBe('2026-10-25')
    expect(shiftDate('2026-10-25', 1)).toBe('2026-10-26')
  })
})

describe('formatDay', () => {
  it('writes the day in full by default', () => {
    const text = formatDay('2026-11-02')

    expect(text).toContain('Monday')
    expect(text).toContain('2 November')
    expect(text).toContain('2026')
  })

  it('writes a compact day with the short style', () => {
    const text = formatDay('2026-11-02', 'short')

    expect(text).toContain('Mon')
    expect(text).toContain('2 Nov')
    expect(text).not.toContain('2026')
  })

  it('shows the day that was asked for, regardless of the time zone', () => {
    expect(formatDay('2026-01-01')).toContain('1 January')
    expect(formatDay('2026-12-31')).toContain('31 December')
  })
})

describe('normalizeTime', () => {
  it.each([
    ['12:30', '12:30'],
    ['12.30', '12:30'],
    ['1230', '12:30'],
    ['930', '09:30'],
    ['9:30', '09:30'],
    ['9', '09:00'],
    ['09', '09:00'],
    ['0', '00:00'],
    ['00:00', '00:00'],
    ['23:59', '23:59'],
    ['123', '01:23'],
    [' 19:00 ', '19:00'],
  ])('turns "%s" into %s', (input, expected) => {
    expect(normalizeTime(input)).toBe(expected)
  })

  it.each([
    [''],
    ['   '],
    ['abc'],
    ['12:'],
    [':30'],
    ['7:5'],
    ['24:00'],
    ['24'],
    ['2400'],
    ['12:60'],
    ['1260'],
    ['12:30:00'],
    ['12345'],
    ['-1'],
  ])('rejects "%s"', (input) => {
    expect(normalizeTime(input)).toBeNull()
  })
})

describe('openPicker', () => {
  it('opens the picker of the input', () => {
    const showPicker = vi.fn()

    openPicker({ showPicker } as unknown as HTMLInputElement)

    expect(showPicker).toHaveBeenCalledOnce()
  })

  it('does not fail when the browser refuses to open it', () => {
    const showPicker = vi.fn(() => {
      throw new Error('NotAllowedError')
    })

    expect(() =>
      openPicker({ showPicker } as unknown as HTMLInputElement),
    ).not.toThrow()
  })
})
