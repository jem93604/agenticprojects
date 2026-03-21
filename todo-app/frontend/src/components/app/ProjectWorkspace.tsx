'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/apiClient'
import type { Project, ProjectMember, Status, Task } from '@/types/app'
import { KanbanBoard } from '@/components/app/KanbanBoard'
import { EisenhowerMatrix } from '@/components/app/EisenhowerMatrix'
import { TaskDrawer } from '@/components/app/TaskDrawer'
import { NotificationsBell } from '@/components/app/NotificationsBell'
import { InviteMemberForm, NewProjectForm } from '@/components/app/ProjectForms'
import { useToast } from '@/components/ToastProvider'

const STATUSES: Status[] = ['TODO', 'DOING', 'DONE']

function groupTasks(tasks: Task[]): Record<Status, Task[]> {
  return {
    TODO: tasks.filter((t) => t.status === 'TODO').sort((a, b) => a.position - b.position),
    DOING: tasks.filter((t) => t.status === 'DOING').sort((a, b) => a.position - b.position),
    DONE: tasks.filter((t) => t.status === 'DONE').sort((a, b) => a.position - b.position),
  }
}

export function ProjectWorkspace() {
  const toast = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [members, setMembers] = useState<ProjectMember[]>([])

  const [columns, setColumns] = useState<Record<Status, Task[]>>({ TODO: [], DOING: [], DONE: [] })
  const [view, setView] = useState<'KANBAN' | 'EISENHOWER'>('KANBAN')

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)

  const selectedTask = useMemo(() => {
    if (selectedTaskId == null) return null
    for (const s of STATUSES) {
      const found = columns[s].find((t) => t.id === selectedTaskId)
      if (found) return found
    }
    return null
  }, [columns, selectedTaskId])

  const tasksFlat = useMemo(() => STATUSES.flatMap((s) => columns[s]), [columns])

  const refreshProjects = async () => {
    const list = await api.projects.list()
    const next = list as any
    setProjects(next)
    if (selectedProjectId == null && next?.[0]?.id) setSelectedProjectId(next[0].id)
  }

  const refreshMembers = async (projectId: number) => {
    const list = await api.projects.members(projectId)
    setMembers(list as any)
  }

  const refreshTasks = async (projectId: number) => {
    const tasks = await api.tasks.list(projectId)
    setColumns(groupTasks(tasks as any))
  }

  const init = async () => {
    try {
      setLoading(true)
      await api.auth.me()
      const projList = await api.projects.list()
      const next = projList as any
      setProjects(next)
      const first = next?.[0]?.id
      setSelectedProjectId(first ?? null)
    } catch (e: any) {
      toast.push({ type: 'info', title: 'Please log in', message: e?.message || 'Not authenticated' })
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedProjectId == null) return
    void (async () => {
      try {
        await refreshMembers(selectedProjectId)
        await refreshTasks(selectedProjectId)
      } catch (e: any) {
        toast.push({ type: 'error', title: 'Failed to load project', message: e?.message || 'Unknown error' })
      }
    })()
    setSelectedTaskId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId])

  const onProjectChanged = (id: number) => {
    setSelectedProjectId(id)
  }

  const refreshEverything = async () => {
    if (selectedProjectId == null) return
    await refreshMembers(selectedProjectId)
    await refreshTasks(selectedProjectId)
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-lg">Loading…</div>
      </div>
    )
  }

  if (!selectedProjectId) {
    return (
      <div className="space-y-4">
        <div className="card glass p-6">
          <div className="text-2xl font-bold">Start a project</div>
          <div className="text-sm muted mt-2">Create a shared workspace and start planning.</div>
          <div className="mt-4">
            <NewProjectForm onCreated={() => void refreshProjects()} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="card glass p-4 rounded-2xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2 min-w-[260px]">
            <div className="text-sm muted">Project</div>
            <div className="flex gap-2">
              <select
                value={selectedProjectId}
                onChange={(e) => onProjectChanged(Number(e.target.value))}
                className="neu-input px-3 py-2 rounded-md w-full"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="flex-shrink-0">
                <NewProjectForm onCreated={() => void refreshProjects()} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NotificationsBell />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setView('KANBAN')}
                className={`neu-btn px-4 py-2 ${view === 'KANBAN' ? 'border-2 border-accent-1/50' : ''}`}
              >
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setView('EISENHOWER')}
                className={`neu-btn px-4 py-2 ${view === 'EISENHOWER' ? 'border-2 border-accent-1/50' : ''}`}
              >
                Eisenhower
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="card glass p-3 rounded-2xl mb-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm muted">Board overview</div>
                <div className="text-xs muted">
                  Drag tasks between <span className="accent font-semibold">To Do</span>, <span className="accent font-semibold">Doing</span>, and{' '}
                  <span className="accent font-semibold">Done</span>
                </div>
              </div>
            </div>

            {view === 'KANBAN' ? (
              <KanbanBoard
                projectId={selectedProjectId}
                columns={columns}
                setColumns={setColumns}
                onSelectTask={(t) => setSelectedTaskId(t.id)}
                onRefresh={refreshEverything}
              />
            ) : (
              <EisenhowerMatrix tasks={tasksFlat} onSelect={(t) => setSelectedTaskId(t.id)} />
            )}
          </div>

          <div className="space-y-4">
            <InviteMemberForm
              projectId={selectedProjectId}
              onInvited={() => void refreshMembers(selectedProjectId)}
            />
            <div className="card glass p-3 rounded-2xl space-y-2">
              <div className="font-semibold">Add task</div>
              <AddTaskInline
                projectId={selectedProjectId}
                onAdded={() => void refreshTasks(selectedProjectId)}
                defaultStatus="TODO"
              />
              <div className="text-xs muted">Assign later from the task drawer.</div>
            </div>
          </div>
        </div>
      </div>

      <TaskDrawer
        projectId={selectedProjectId}
        task={selectedTask}
        members={members}
        onClose={() => setSelectedTaskId(null)}
        onRefreshTasks={() => void refreshTasks(selectedProjectId)}
      />
    </div>
  )
}

function AddTaskInline({
  projectId,
  onAdded,
  defaultStatus,
}: {
  projectId: number
  onAdded: () => void
  defaultStatus: Status
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const create = async () => {
    if (!title.trim()) return
    setLoading(true)
    try {
      await api.tasks.create(projectId, {
        title: title.trim(),
        description: description.trim() || null,
        status: defaultStatus,
      })
      setTitle('')
      setDescription('')
      setOpen(false)
      onAdded()
      toast.push({ type: 'success', title: 'Task created' })
    } catch (e: any) {
      toast.push({ type: 'error', title: 'Create failed', message: e?.message || 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      {open ? (
        <>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="neu-input px-3 py-2 rounded-md w-full" placeholder="Task title" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="neu-input px-3 py-2 rounded-md resize-none w-full" rows={3} placeholder="Description (optional)" />
          <div className="flex gap-2">
            <button type="button" className="neu-btn px-4 py-2 flex-1 disabled:opacity-50" disabled={loading || !title.trim()} onClick={() => void create()}>
              {loading ? 'Adding…' : 'Add'}
            </button>
            <button type="button" className="neu-btn px-3 py-2" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="neu-btn w-full px-4 py-2" onClick={() => setOpen(true)}>
          + New task
        </button>
      )}
    </div>
  )
}

