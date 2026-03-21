'use client'

import React, { createContext, useContext, useMemo, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'

type Toast = {
  id: string
  type: ToastType
  title: string
  message?: string
}

type ToastContextValue = {
  push: (toast: Omit<Toast, 'id'> & { id?: string }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const value = useMemo<ToastContextValue>(
    () => ({
      push: (t) => {
        const id = t.id ?? crypto.randomUUID()
        const toast: Toast = { id, type: t.type, title: t.title, message: t.message }
        setToasts((prev) => [toast, ...prev].slice(0, 4))

        window.setTimeout(() => {
          setToasts((prev) => prev.filter((x) => x.id !== id))
        }, 3500)
      },
    }),
    [],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`card glass p-3 w-[320px] ${
              t.type === 'error'
                ? 'border-red-300/30'
                : t.type === 'success'
                  ? 'border-emerald-300/30'
                  : 'border-blue-300/30'
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  {t.type === 'error' ? 'Error' : t.type === 'success' ? 'Success' : 'Info'}: {t.title}
                </div>
                {t.message && <div className="text-xs muted mt-1">{t.message}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

