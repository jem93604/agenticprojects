'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { api } from '@/lib/apiClient'
import { useToast } from '@/components/ToastProvider'

export function NewProjectForm({ onCreated }: { onCreated: () => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const submit = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      await api.projects.create({ name: name.trim() })
      setName('')
      setOpen(false)
      onCreated()
      toast.push({ type: 'success', title: 'Project created' })
    } catch (e: any) {
      toast.push({ type: 'error', title: 'Project create failed', message: e?.message || 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      {open ? (
        <div className="flex gap-2 items-center">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className="neu-input px-3 py-2 rounded-md w-full"
          />
          <button type="button" className="neu-btn px-4 py-2 disabled:opacity-50" onClick={() => void submit()} disabled={loading || !name.trim()}>
            {loading ? 'Creating…' : 'Create'}
          </button>
          <button type="button" className="neu-btn px-3 py-2" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="neu-btn px-4 py-2 inline-flex items-center gap-2" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" />
          New Project
        </button>
      )}
    </div>
  )
}

export function InviteMemberForm({
  projectId,
  onInvited,
}: {
  projectId: number
  onInvited: () => void
}) {
  const toast = useToast()
  const [handle, setHandle] = useState('')
  const [role, setRole] = useState<'OWNER' | 'MEMBER'>('MEMBER')
  const [loading, setLoading] = useState(false)

  const invite = async () => {
    if (!handle.trim()) return
    setLoading(true)
    try {
      await api.projects.invite(projectId, { handle: handle.trim(), role })
      setHandle('')
      onInvited()
      toast.push({ type: 'success', title: 'Invite sent' })
    } catch (e: any) {
      toast.push({ type: 'error', title: 'Invite failed', message: e?.message || 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card glass p-3 space-y-2">
      <div className="text-sm font-semibold">Invite member</div>
      <div className="flex gap-2">
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="User handle (e.g. alex)"
          className="neu-input px-3 py-2 rounded-md w-full"
        />
        <select value={role} onChange={(e) => setRole(e.target.value as any)} className="neu-input px-2 py-2 rounded-md">
          <option value="MEMBER">Member</option>
          <option value="OWNER">Owner</option>
        </select>
      </div>
      <button type="button" className="neu-btn px-4 py-2 w-full disabled:opacity-50" onClick={() => void invite()} disabled={loading || !handle.trim()}>
        {loading ? 'Inviting…' : 'Invite'}
      </button>
    </div>
  )
}

