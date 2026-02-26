const HTMLKeyEventValues = {
  Enter: 'Enter',
  Escape: 'Escape',
  Tab: 'Tab',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Space: ' ',
} as const

type HTMLKeyEventValue = (typeof HTMLKeyEventValues)[keyof typeof HTMLKeyEventValues]

export { HTMLKeyEventValues }
export type { HTMLKeyEventValue }
