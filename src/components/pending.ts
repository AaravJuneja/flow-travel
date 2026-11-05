type NavigationState = {
  isLoading: boolean
  location: { href: string }
  resolvedLocation?: { href: string }
}

export type TextNode = {
  nodeType: number
  textContent: string | null
  childNodes: ArrayLike<TextNode>
  getAttribute?: (name: string) => string | null
}

export const pendingDelayMs = 300

export function isNavigationPending(state: NavigationState) {
  return state.isLoading && state.resolvedLocation !== undefined && state.location.href !== state.resolvedLocation.href
}

export function pendingActionLabel(root: { querySelector(selector: string): unknown }) {
  const button = root.querySelector('[data-pending="true"]') as TextNode | null
  return button ? readableText(button).replace(/\s+/gu, ' ').trim() : ''
}

export function readableText(node: TextNode): string {
  if (node.nodeType === 3) return node.textContent ?? ''
  if (node.nodeType !== 1 || node.getAttribute?.('aria-hidden') === 'true') return ''
  return Array.from(node.childNodes, readableText).join('')
}
