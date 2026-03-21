'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDroppable } from '@dnd-kit/core'
import { api } from '@/lib/apiClient'
import { useToast } from '@/components/ToastProvider'
import type { Status, Task } from '@/types/app'

const STATUSES: Status[] = ['TODO', 'DOING', 'DONE']

function TaskCard({ task, onSelect }: { task: Task; onSelect: (t: Task) => void }) {
  const toast = useToast()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    cursor: 'grab',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="card glass p-3 rounded-xl hover:shadow-lg transition select-none"
      onClick={() => onSelect(task)}
      role="button"
      tabIndex={0}
      aria-label={`Open task ${task.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(task)
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-sm font-semibold truncate ${task.status === 'DONE' ? 'line-through text-muted/80' : ''}`}>
            {task.title}
          </div>
          {task.due_date && (
            <div className="text-[11px] muted mt-1">
              Due {new Date(task.due_date).toLocaleDateString()}
            </div>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span
            className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white"
            style={{
              background:
                task.importance === 'HIGH'
                  ? 'rgba(239, 68, 68, 0.25)'
                  : task.importance === 'MEDIUM'
                    ? 'rgba(245, 158, 11, 0.22)'
                    : 'rgba(99, 102, 241, 0.20)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
            aria-label={`Importance ${task.importance}`}
          >
            {task.importance}
          </span>
        </div>
      </div>

      {task.assignees.length > 0 && (
        <div className="mt-2 flex -space-x-2">
          {task.assignees.slice(0, 3).map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent-1/20 border border-white/10 text-xs font-semibold"
              title={u.handle}
            >
              {u.handle.slice(0, 2).toUpperCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Column({
  status,
  tasks,
  onSelect,
}: {
  status: Status
  tasks: Task[]
  onSelect: (t: Task) => void
}) {
  const columnId = `column-${status}`
  const { setNodeRef, isOver } = useDroppable({ id: columnId })
  const title =
    status === 'TODO' ? 'To Do' : status === 'DOING' ? 'Doing' : status === 'DONE' ? 'Done' : status

  const tint =
    status === 'DONE'
      ? 'rgba(16, 185, 129, 0.20)'
      : status === 'DOING'
        ? 'rgba(6, 182, 212, 0.20)'
        : 'rgba(99, 102, 241, 0.20)'

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl p-3 ${
        isOver ? 'ring-2 ring-accent-1/50' : 'ring-1 ring-white/10'
      }`}
      style={{ background: isOver ? tint : 'rgba(255,255,255,0.02)' }}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="font-semibold">
          {title} <span className="muted text-sm">({tasks.length})</span>
        </div>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[60px]">
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} onSelect={onSelect} />
          ))}
          {tasks.length === 0 && (
            <div className="text-sm muted text-center py-6">Drop tasks here</div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

export function KanbanBoard({
  projectId,
  columns,
  setColumns,
  onSelectTask,
  onRefresh,
}: {
  projectId: number
  columns: Record<Status, Task[]>
  setColumns: React.Dispatch<React.SetStateAction<Record<Status, Task[]>>>
  onSelectTask: (t: Task) => void
  onRefresh: () => void
}) {
  const toast = useToast()
  const [activeId, setActiveId] = useState<number | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const statusOfTask = (taskId: number): Status | null => {
    for (const s of STATUSES) {
      if (columns[s].some((t) => t.id === taskId)) return s
    }
    return null
  }

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const activeNumeric = Number(active.id)
    if (Number.isNaN(activeNumeric)) return

    const sourceStatus = statusOfTask(activeNumeric)
    if (!sourceStatus) return

    const overId = over.id

    let targetStatus: Status = sourceStatus
    let insertIndex = 0

    const sourceList = [...columns[sourceStatus]]
    const movedIndex = sourceList.findIndex((t) => t.id === activeNumeric)
    if (movedIndex < 0) return
    const movedTask = sourceList[movedIndex]
    sourceList.splice(movedIndex, 1)

    if (typeof overId === 'string' && overId.startsWith('column-')) {
      targetStatus = overId.replace('column-', '') as Status
      const targetList = [...columns[targetStatus]]
      insertIndex = targetList.length
      targetList.splice(insertIndex, 0, movedTask)

      const next: Record<Status, Task[]> = {
        ...columns,
        [sourceStatus]: sourceList.map((t, idx) => ({ ...t, position: idx, status: sourceStatus })),
        [targetStatus]: targetList.map((t, idx) => ({
          ...t,
          position: idx,
          status: targetStatus,
        })),
      }
      setColumns(next)

      const updates = targetStatus !== sourceStatus
        ? next[sourceStatus].map((t, idx) => ({ task_id: t.id, status: sourceStatus, position: idx })).concat(
            next[targetStatus].map((t, idx) => ({ task_id: t.id, status: targetStatus, position: idx })),
          )
        : next[sourceStatus].map((t, idx) => ({ task_id: t.id, status: sourceStatus, position: idx }))

      try {
        await api.tasks.batchUpdate(projectId, updates)
        await onRefresh()
      } catch (e: any) {
        setColumns(columns)
        toast.push({ type: 'error', title: 'Move failed', message: e?.message || 'Unknown error' })
      }
      return
    }

    const overNumeric = Number(overId)
    const targetInColumn = statusOfTask(overNumeric)
    if (!targetInColumn) return
    targetStatus = targetInColumn

    const targetList = [...columns[targetStatus]]
    const overIndex = targetList.findIndex((t) => t.id === overNumeric)
    if (overIndex < 0) return

    // When moving within same column, we should compute the index after removal.
    const targetListAfterRemove =
      targetStatus === sourceStatus ? [...sourceList] : targetList

    let actualInsertIndex = overIndex
    if (targetStatus === sourceStatus) {
      // overIndex was computed on the pre-removal list; adjust if needed.
      const overIndexInRemoved = targetListAfterRemove.findIndex((t) => t.id === overNumeric)
      actualInsertIndex = overIndexInRemoved >= 0 ? overIndexInRemoved : targetListAfterRemove.length
    }

    targetListAfterRemove.splice(actualInsertIndex, 0, { ...movedTask, status: targetStatus, position: actualInsertIndex })

    const next: Record<Status, Task[]> = {
      ...columns,
      [sourceStatus]: targetStatus === sourceStatus ? targetListAfterRemove : sourceList.map((t, idx) => ({ ...t, position: idx })),
      [targetStatus]: targetStatus === sourceStatus ? targetListAfterRemove : targetListAfterRemove.map((t, idx) => ({ ...t, position: idx })),
    }

    // Ensure moved task status is reflected for optimistic UI.
    next[targetStatus] = next[targetStatus].map((t) =>
      t.id === movedTask.id ? { ...t, status: targetStatus } : t,
    )

    setColumns(next)

    const affectedStatuses = Array.from(new Set([sourceStatus, targetStatus])) as Status[]
    const updates = affectedStatuses.flatMap((s) =>
      next[s].map((t, idx) => ({ task_id: t.id, status: s, position: idx })),
    )

    try {
      await api.tasks.batchUpdate(projectId, updates)
      await onRefresh()
    } catch (e: any) {
      setColumns(columns)
      toast.push({ type: 'error', title: 'Move failed', message: e?.message || 'Unknown error' })
    }
  }

  const onDragStart = (event: any) => {
    const id = Number(event.active?.id)
    setActiveId(Number.isNaN(id) ? null : id)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {STATUSES.map((s) => (
          <Column key={s} status={s} tasks={columns[s]} onSelect={onSelectTask} />
        ))}
      </div>
    </DndContext>
  )
}

