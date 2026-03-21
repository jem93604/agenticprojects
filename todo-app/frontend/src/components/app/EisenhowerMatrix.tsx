'use client'

import type { Task } from '@/types/app'

const URGENT_WINDOW_HOURS = 48

function isImportant(t: Task) {
  return t.importance === 'HIGH'
}

function isUrgent(t: Task) {
  if (typeof t.urgent_override === 'boolean') return t.urgent_override
  if (!t.due_date) return false
  const due = new Date(t.due_date).getTime()
  const now = Date.now()
  if (Number.isNaN(due)) return false
  if (due < now) return true
  return due <= now + URGENT_WINDOW_HOURS * 60 * 60 * 1000
}

export function EisenhowerMatrix({ tasks, onSelect }: { tasks: Task[]; onSelect: (t: Task) => void }) {
  const quadrants = {
    'urgent-important': [] as Task[],
    'urgent-not-important': [] as Task[],
    'not-urgent-important': [] as Task[],
    'not-urgent-not-important': [] as Task[],
  }

  for (const t of tasks) {
    const urgent = isUrgent(t)
    const important = isImportant(t)
    if (urgent && important) quadrants['urgent-important'].push(t)
    else if (urgent && !important) quadrants['urgent-not-important'].push(t)
    else if (!urgent && important) quadrants['not-urgent-important'].push(t)
    else quadrants['not-urgent-not-important'].push(t)
  }

  const CardStack = ({ list }: { list: Task[] }) => {
    return (
      <div className="space-y-2">
        {list
          .slice()
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .slice(0, 50)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t)}
              className="w-full text-left card glass p-3 rounded-xl hover:shadow-md transition"
            >
              <div className="font-semibold text-sm truncate">{t.title}</div>
              {t.due_date && (
                <div className="text-[11px] muted mt-1">
                  Due {new Date(t.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              )}
            </button>
          ))}
        {list.length === 0 && <div className="text-sm muted text-center py-6">No tasks</div>}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="card glass p-4 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Urgent & Important</div>
          <div className="muted text-sm">{quadrants['urgent-important'].length}</div>
        </div>
        <CardStack list={quadrants['urgent-important']} />
      </div>

      <div className="card glass p-4 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Urgent & Not Important</div>
          <div className="muted text-sm">{quadrants['urgent-not-important'].length}</div>
        </div>
        <CardStack list={quadrants['urgent-not-important']} />
      </div>

      <div className="card glass p-4 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Not Urgent & Important</div>
          <div className="muted text-sm">{quadrants['not-urgent-important'].length}</div>
        </div>
        <CardStack list={quadrants['not-urgent-important']} />
      </div>

      <div className="card glass p-4 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Not Urgent & Not Important</div>
          <div className="muted text-sm">{quadrants['not-urgent-not-important'].length}</div>
        </div>
        <CardStack list={quadrants['not-urgent-not-important']} />
      </div>
    </div>
  )
}

