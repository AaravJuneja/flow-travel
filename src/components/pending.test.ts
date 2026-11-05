import { describe, expect, test } from 'bun:test'
import { isNavigationPending, pendingActionLabel, readableText, type TextNode } from './pending'

const element = (children: TextNode[], hidden = false): TextNode => ({
  nodeType: 1,
  textContent: null,
  childNodes: children,
  getAttribute: (name: string) => (name === 'aria-hidden' && hidden ? 'true' : null),
})
const text = (value: string): TextNode => ({ nodeType: 3, textContent: value, childNodes: [] })

describe('pending feedback', () => {
  test('treats only unresolved location changes as page navigation', () => {
    expect(isNavigationPending({ isLoading: true, location: { href: '/wallet' }, resolvedLocation: { href: '/home' } })).toBe(true)
    expect(isNavigationPending({ isLoading: true, location: { href: '/home' }, resolvedLocation: { href: '/home' } })).toBe(false)
    expect(isNavigationPending({ isLoading: true, location: { href: '/home' } })).toBe(false)
    expect(isNavigationPending({ isLoading: false, location: { href: '/wallet' }, resolvedLocation: { href: '/home' } })).toBe(false)
  })

  test('reads the busy label without hidden icons', () => {
    const button = element([element([], true), text('Velo is planning...'), text(' '), element([text('↗')], true)])
    expect(readableText(button).trim()).toBe('Velo is planning...')
    expect(pendingActionLabel({ querySelector: () => button })).toBe('Velo is planning...')
    expect(pendingActionLabel({ querySelector: () => null })).toBe('')
  })
})
