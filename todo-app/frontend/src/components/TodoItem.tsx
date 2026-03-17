'use client'

import { useMemo, useState } from 'react'
import { Todo } from '@/types/todo'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Trash2, Edit, Plus, ChevronDown, ChevronRight } from 'lucide-react'

interface TodoItemProps {
  todo: Todo
  subtasks?: Todo[]
  onToggle: (id: number) => void
  onDelete: (id: number) => void
  onEdit: (todo: Todo) => void
  onAddSubtask?: (title: string, description?: string) => void
}

export function TodoItem({
  todo,
  subtasks = [],
  onToggle,
  onDelete,
  onEdit,
  onAddSubtask,
}: TodoItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(todo.title)
  const [editDescription, setEditDescription] = useState(todo.description || '')
  const [showSubtasks, setShowSubtasks] = useState(true)
  const [showSubtaskForm, setShowSubtaskForm] = useState(false)
  const [subtaskTitle, setSubtaskTitle] = useState('')

  const formattedDue = useMemo(() => {
    if (!todo.due_date) return null
    try {
      return new Date(todo.due_date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return null
    }
  }, [todo.due_date])

  const tagPills = useMemo(
    () =>
      (todo.tags ?? []).map(tag => (
        <span
          key={tag.id}
          className="text-[11px] leading-none inline-flex items-center px-2 py-0.5 rounded-full bg-white/10 text-white"
          style={{ backgroundColor: tag.color, opacity: 0.92 }}
        >
          {tag.name}
        </span>
      )),
    [todo.tags]
  )

  const handleSave = () => {
    onEdit({
      ...todo,
      title: editTitle,
      description: editDescription,
    })
    setIsEditing(false)
  }

  const handleAddSubtask = () => {
    const trimmed = subtaskTitle.trim()
    if (!trimmed || !onAddSubtask) return

    onAddSubtask(trimmed)
    setSubtaskTitle('')
    setShowSubtaskForm(false)
  }

  if (isEditing) {
    return (
      <div className="card p-4">
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-md border bg-white/10"
            placeholder="Task title"
          />
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-md border bg-white/10 resize-none"
            placeholder="Task details"
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <Button onClick={() => setIsEditing(false)} variant="outline" size="sm">
              Cancel
            </Button>
            <Button onClick={handleSave} size="sm">
              Save
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-4">
      <div className="flex items-start gap-4">
        <Checkbox checked={todo.completed} onCheckedChange={() => onToggle(todo.id)} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3
                  className={`text-lg font-semibold truncate ${
                    todo.completed ? 'line-through text-muted/80' : ''
                  }`}
                >
                  {todo.title}
                </h3>
                {formattedDue && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-muted">
                    Due {formattedDue}
                  </span>
                )}
              </div>
              {todo.description && (
                <p className={`mt-1 text-sm ${todo.completed ? 'line-through text-muted/80' : 'text-muted'}`}>
                  {todo.description}
                </p>
              )}
              {tagPills.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{tagPills}</div>}
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsEditing(true)}
                variant="ghost"
                size="sm"
                className="neu-btn text-muted hover:text-accent"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => onDelete(todo.id)}
                variant="ghost"
                size="sm"
                className="neu-btn text-red-400 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowSubtasks(prev => !prev)}
              className="flex items-center gap-1 text-xs text-muted hover:text-foreground"
            >
              {showSubtasks ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              {subtasks.length} subtask{subtasks.length === 1 ? '' : 's'}
            </button>
            {onAddSubtask && (
              <button
                type="button"
                onClick={() => setShowSubtaskForm(prev => !prev)}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent"
              >
                <Plus className="w-4 h-4" />
                Add subtask
              </button>
            )}
          </div>

          {showSubtaskForm && onAddSubtask && (
            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex flex-col gap-2">
                <input
                  value={subtaskTitle}
                  onChange={(e) => setSubtaskTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border bg-white/10"
                  placeholder="Subtask title"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowSubtaskForm(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleAddSubtask} disabled={!subtaskTitle.trim()}>
                    Add
                  </Button>
                </div>
              </div>
            </div>
          )}

          {showSubtasks && subtasks.length > 0 && (
            <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
              {subtasks.map((sub) => (
                <div key={sub.id} className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
                  <Checkbox checked={sub.completed} onCheckedChange={() => onToggle(sub.id)} />
                  <div className="min-w-0">
                    <p className={`text-sm truncate ${sub.completed ? 'line-through text-muted/80' : ''}`}>
                      {sub.title}
                    </p>
                    {sub.description && (
                      <p className="text-xs text-muted truncate">{sub.description}</p>
                    )}
                  </div>
                  <Button
                    onClick={() => onDelete(sub.id)}
                    variant="ghost"
                    size="sm"
                    className="neu-btn text-red-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
