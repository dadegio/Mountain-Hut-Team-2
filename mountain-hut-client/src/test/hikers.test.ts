import { describe, expect, it } from 'vitest'
import { searchHikers } from '../api/hikers'

const names = async (query: string) =>
  (await searchHikers(query)).map((hiker) => hiker.name)

// MH-07: a hiker can be matched by name, phone or email
describe('searchHikers', () => {
  it.each([
    ['name', 'mario', ['Mario']],
    ['surname', 'VERDI', ['Giulia']],
    ['full name', 'giulia verdi', ['Giulia']],
    ['email', 'rossi@example', ['Mario']],
    ['phone', '3339876543', ['Giulia']],
    ['spaces around the text', '  mario ', ['Mario']],
    ['text shared by more hikers', 'example.com', ['Mario', 'Giulia']],
    ['text nobody has', 'nobody', []],
  ])('finds by %s', async (_label, query, expected) => {
    expect(await names(query)).toEqual(expected)
  })
})
