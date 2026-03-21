"use client"

import { useEffect, useState } from 'react'
import { api } from '@/lib/apiClient'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any | null>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const me = await api.auth.me()
        setUser(me)
        const list = await api.projects.list()
        setProjects(list || [])
      } catch (e) {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  if (loading) return <div className="flex items-center justify-center min-h-[40vh]">Loading…</div>

  return (
    <div className="app-container space-y-6">
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-white text-xl">{(user?.display_name || user?.handle || 'U').charAt(0)}</div>
          <div>
            <div className="text-2xl font-semibold">{user?.display_name || user?.handle}</div>
            <div className="muted">@{user?.handle}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-sm muted">Email</div>
            <div className="mt-1">{user?.email || '—'}</div>
          </div>
          <div>
            <div className="text-sm muted">Member since</div>
            <div className="mt-1">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</div>
          </div>
          <div>
            <div className="text-sm muted">Role</div>
            <div className="mt-1">{user?.role || 'Member'}</div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Projects</div>
        </div>

        <div className="mt-4 space-y-2">
          {projects.length === 0 ? (
            <div className="muted">You don't have access to any projects yet.</div>
          ) : (
            projects.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm muted">ID: {p.id}</div>
                </div>
                <div>
                  <button className="neu-btn px-3 py-2" onClick={() => router.push('/')}>Open</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
