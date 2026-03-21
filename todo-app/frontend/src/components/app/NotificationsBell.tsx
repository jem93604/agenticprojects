'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { api } from '@/lib/apiClient'
import { Notification } from '@/types/app'
import { useToast } from '@/components/ToastProvider'

export function NotificationsBell() {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const unreadCount = useMemo(() => items.filter((n) => !n.read_at).length, [items])

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.notifications.list()
        setItems(res)
      } catch {
        // ignore; typically not authenticated yet
      }
    })()
  }, [])

  const refresh = async () => {
    const res = await api.notifications.list()
    setItems(res)
  }

  const markRead = async (id: number) => {
    try {
      await api.notifications.markRead(id)
      await refresh()
    } catch (e: any) {
      toast.push({ type: 'error', title: 'Notification error', message: e?.message || 'Unknown error' })
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="neu-btn p-2"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-accent-1 text-white text-[11px] leading-none rounded-full px-1.5 py-0.5">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[360px] card glass p-3 z-50"
          role="dialog"
          aria-label="Notifications panel"
        >
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="font-semibold">Notifications</div>
            <button type="button" className="neu-btn p-1" onClick={() => setOpen(false)} aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          {items.length === 0 ? (
            <div className="text-sm muted p-4 text-center">No notifications yet.</div>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => void markRead(n.id)}
                  className={`w-full text-left rounded-lg p-2 border transition ${
                    n.read_at ? 'bg-white/5 border-white/10' : 'bg-accent-1/10 border-accent-1/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {n.type === 'MENTION' ? 'Mention' : n.type}
                      </div>
                      <div className="text-xs muted truncate">
                        {n.payload?.mentioned_handle ? `@${n.payload.mentioned_handle}` : '—'}
                      </div>
                    </div>
                    {!n.read_at && <span className="text-[10px] accent font-semibold">New</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

