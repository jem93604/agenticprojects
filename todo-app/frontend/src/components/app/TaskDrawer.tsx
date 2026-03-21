'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { api } from '@/lib/apiClient'
import { useToast } from '@/components/ToastProvider'
import type { Importance, ProjectMember as ProjectMemberType, Status, Task, TaskComment } from '@/types/app'
import type { ReactNode } from 'react'

const STATUSES: Status[] = ['TODO', 'DOING', 'DONE']

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function isoToDatetimeLocal(value?: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(
    d.getMinutes(),
  )}`
}

function datetimeLocalToIso(value: string) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function renderWithMentions(content: string, mentionedHandles: Set<string>): ReactNode {
  const re = /@([A-Za-z0-9_\-]+)/g
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null = null

  while ((match = re.exec(content))) {
    const start = match.index
    const end = re.lastIndex
    const handle = match[1]
    if (start > lastIndex) {
      parts.push(content.slice(lastIndex, start))
    }
    const full = content.slice(start, end)
    if (mentionedHandles.has(handle)) {
      parts.push(
        <span key={`${start}-${end}`} className="px-1 rounded bg-accent-1/20 border border-accent-1/20 text-accent-1 font-semibold">
          {full}
        </span>,
      )
    } else {
      parts.push(full)
    }
    lastIndex = end
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex))
  return parts
}

export function TaskDrawer({
  projectId,
  task,
  members,
  onClose,
  onRefreshTasks,
}: {
  projectId: number
  task: Task | null
  members: ProjectMemberType[]
  onClose: () => void
  onRefreshTasks: () => void
}) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [comments, setComments] = useState<TaskComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState<string>('')
  const [dueLocal, setDueLocal] = useState('')
  const [importance, setImportance] = useState<Importance>('MEDIUM')
  const [status, setStatus] = useState<Status>('TODO')
  const [assigneeIds, setAssigneeIds] = useState<number[]>([])

  const [commentText, setCommentText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionTokenRange, setMentionTokenRange] = useState<{ start: number; end: number } | null>(null)

  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setDescription(task.description ?? '')
    setDueLocal(isoToDatetimeLocal(task.due_date))
    setImportance(task.importance)
    setStatus(task.status)
    setAssigneeIds(task.assignees?.map((a) => a.id) ?? [])
    setCommentText('')
  }, [task])

  const refreshComments = async () => {
    if (!task) return
    setCommentsLoading(true)
    try {
      const res = await api.comments.list(projectId, task.id)
      setComments(res)
    } catch (e: any) {
      toast.push({ type: 'error', title: 'Failed to load comments', message: e?.message || 'Unknown error' })
    } finally {
      setCommentsLoading(false)
    }
  }

  useEffect(() => {
    if (!task) return
    void refreshComments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id])

  const toggleAssignee = (userId: number) => {
    setAssigneeIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))
  }

  const submitComment = async () => {
    if (!task) return
    const content = commentText.trim()
    if (!content) return
    try {
      setLoading(true)
      await api.comments.create(projectId, task.id, { content })
      setCommentText('')
      setMentionOpen(false)
      await refreshComments()
    } catch (e: any) {
      toast.push({ type: 'error', title: 'Comment failed', message: e?.message || 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }

  const mentionSuggestions = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase()
    if (!q) return []
    return members
      .filter((m) => m.handle.toLowerCase().startsWith(q))
      .slice(0, 8)
  }, [mentionQuery, members])

  const updateMentionState = () => {
    const el = textareaRef.current
    if (!el) return
    const value = el.value
    const cursor = el.selectionStart ?? value.length
    const beforeCursor = value.slice(0, cursor)
    const match = /@([A-Za-z0-9_\-]{0,30})$/.exec(beforeCursor)
    if (!match) {
      setMentionOpen(false)
      setMentionTokenRange(null)
      return
    }
    const query = match[1]
    const tokenLen = match[0].length
    const start = cursor - tokenLen
    const end = cursor
    setMentionQuery(query)
    setMentionTokenRange({ start, end })
    setMentionOpen(true)
  }

  const insertMention = (handle: string) => {
    const el = textareaRef.current
    if (!el) return
    if (!mentionTokenRange) return
    const { start, end } = mentionTokenRange
    const current = el.value
    const next = current.slice(0, start) + `@${handle} ` + current.slice(end)
    setCommentText(next)
    setMentionOpen(false)

    requestAnimationFrame(() => {
      const nextCursor = start + handle.length + 3
      el.focus()
      el.setSelectionRange(nextCursor, nextCursor)
    })
  }

  if (!task) return null

  return (
    <div className="fixed inset-0 z-[60]">
      <button type="button" className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close drawer" />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-background/90 backdrop-blur-xl border-l border-white/10 shadow-2xl p-4 overflow-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="muted text-sm">Task</div>
            <div className="text-xl font-bold truncate">{task.title}</div>
          </div>
          <button type="button" className="neu-btn p-2" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="card glass p-3 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Details</div>
              <div className="text-xs muted">ID #{task.id}</div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-sm font-medium muted">Title</div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="neu-input w-full px-3 py-2 rounded-md"
                />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium muted">Description</div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="neu-input w-full px-3 py-2 rounded-md resize-none"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium muted">Due date</div>
                  <input type="datetime-local" value={dueLocal} onChange={(e) => setDueLocal(e.target.value)} className="neu-input w-full px-3 py-2 rounded-md" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium muted">Importance</div>
                  <select value={importance} onChange={(e) => setImportance(e.target.value as any)} className="neu-input w-full px-3 py-2 rounded-md">
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium muted">Status</div>
                <div className="flex gap-2 flex-wrap">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`neu-btn px-4 py-2 ${
                        status === s ? 'border-accent-1/50 border-2' : 'border-white/10'
                      }`}
                    >
                      {s === 'TODO' ? 'To Do' : s === 'DOING' ? 'Doing' : 'Done'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium muted">Assignees</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {members.map((m) => (
                    <label
                      key={m.user_id}
                      className="flex items-center gap-2 card glass p-2 rounded-xl cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={assigneeIds.includes(m.user_id)}
                        onChange={() => toggleAssignee(m.user_id)}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">@{m.handle}</div>
                        {m.display_name && <div className="text-xs muted truncate">{m.display_name}</div>}
                      </div>
                    </label>
                  ))}
                  {members.length === 0 && <div className="text-sm muted">No members</div>}
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    setLoading(true)
                    const dueIso = datetimeLocalToIso(dueLocal)
                    await api.tasks.update(projectId, task.id, {
                      title: title.trim(),
                      description: description.trim() || null,
                      due_date: dueIso,
                      importance,
                      status,
                      assignee_ids: assigneeIds,
                    })
                    toast.push({ type: 'success', title: 'Task updated' })
                    await onRefreshTasks()
                  } catch (e: any) {
                    toast.push({ type: 'error', title: 'Update failed', message: e?.message || 'Unknown error' })
                  } finally {
                    setLoading(false)
                  }
                }}
                className="neu-btn w-full px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>

          <div className="card glass p-3 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Comments</div>
              <div className="text-xs muted">{comments.length} total</div>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={commentText}
                  onChange={(e) => {
                    setCommentText(e.target.value)
                    updateMentionState()
                  }}
                  onKeyUp={() => updateMentionState()}
                  onClick={() => updateMentionState()}
                  placeholder="Write a comment… use @handle to mention"
                  className="neu-input w-full px-3 py-2 rounded-md resize-none"
                  rows={3}
                />

                {mentionOpen && mentionSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] card glass p-2 rounded-2xl border border-white/10 z-10">
                    {mentionSuggestions.map((m) => (
                      <button
                        type="button"
                        key={m.user_id}
                        className="w-full text-left rounded-xl p-2 hover:bg-white/5"
                        onClick={() => insertMention(m.handle)}
                      >
                        <span className="accent font-semibold">@{m.handle}</span>{' '}
                        {m.display_name ? <span className="muted text-xs">({m.display_name})</span> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="neu-btn px-4 py-2 w-full disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => void submitComment()}
                disabled={loading || !commentText.trim()}
              >
                {loading ? 'Posting…' : 'Post comment'}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {commentsLoading ? (
                <div className="text-sm muted">Loading comments…</div>
              ) : comments.length === 0 ? (
                <div className="text-sm muted text-center py-6">No comments yet. Mention someone with `@`.</div>
              ) : (
                comments.map((c) => {
                  const handles = new Set(c.mentioned_users.map((u) => u.handle))
                  return (
                    <div key={c.id} className="card glass p-3 rounded-2xl">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">
                            @{c.author.handle}{' '}
                            {c.edited_at ? <span className="text-[11px] muted">(edited)</span> : null}
                          </div>
                          <div className="text-[11px] muted">{new Date(c.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="mt-2 text-sm leading-relaxed">
                        {renderWithMentions(c.content, handles)}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

