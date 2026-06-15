'use client'

import * as React from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastVariant = 'default' | 'destructive' | 'success' | 'warning'

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

interface ToastState {
  toasts: Toast[]
}

type ToastAction =
  | { type: 'ADD_TOAST'; toast: Toast }
  | { type: 'REMOVE_TOAST'; id: string }
  | { type: 'DISMISS_TOAST'; id: string }

// ─── Reducer ──────────────────────────────────────────────────────────────────

const TOAST_LIMIT = 3
const TOAST_REMOVE_DELAY = 1000

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }
    case 'REMOVE_TOAST':
      return {
        toasts: state.toasts.filter((t) => t.id !== action.id),
      }
    case 'DISMISS_TOAST':
      return {
        toasts: state.toasts.map((t) =>
          t.id === action.id ? { ...t, dismissed: true } : t
        ) as Toast[],
      }
  }
}

// ─── Global store (simple event-based) ───────────────────────────────────────

let count = 0
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

const listeners: Array<(state: ToastState) => void> = []
let memoryState: ToastState = { toasts: [] }

function dispatch(action: ToastAction) {
  memoryState = toastReducer(memoryState, action)
  listeners.forEach((listener) => listener(memoryState))
}

export function toast(props: Omit<Toast, 'id'>) {
  const id = genId()
  const duration = props.duration ?? 5000

  dispatch({ type: 'ADD_TOAST', toast: { ...props, id } })

  if (duration > 0) {
    setTimeout(() => {
      dispatch({ type: 'REMOVE_TOAST', id })
    }, duration + TOAST_REMOVE_DELAY)
  }

  return { id, dismiss: () => dispatch({ type: 'REMOVE_TOAST', id }) }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast() {
  const [state, setState] = React.useState<ToastState>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) listeners.splice(index, 1)
    }
  }, [])

  return {
    toasts: state.toasts,
    toast,
    dismiss: (id: string) => dispatch({ type: 'REMOVE_TOAST', id }),
  }
}
