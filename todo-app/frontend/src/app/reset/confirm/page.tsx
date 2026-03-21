'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/apiClient'
import { useToast } from '@/components/ToastProvider'

export default function PasswordResetConfirmPage() {
  const toast = useToast()
  const router = useRouter()
  const [token, setToken] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search)
      setToken(sp.get('token') || '')
    } catch {
      setToken('')
    }
  }, [])

  useEffect(() => {
    if (!token) setMessage('Missing reset token')
    else setMessage(null)
  }, [token])

  const submit = async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await api.auth.passwordResetConfirm({ reset_token: token, new_password: newPassword })
      setMessage(res?.message || 'Password updated')
      toast.push({ type: 'success', title: 'Password updated' })
      router.push('/login')
    } catch (e: any) {
      toast.push({ type: 'error', title: 'Reset failed', message: e?.message || 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-4 pt-10">
      <div className="card glass p-6 rounded-2xl">
        <div className="text-2xl font-bold">Confirm reset</div>
        <div className="text-sm muted mt-2">Choose a new password.</div>

        <div className="space-y-3 mt-5">
          <div className="space-y-1">
            <div className="text-sm font-medium muted">New password</div>
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type="password"
              placeholder="Minimum 8 characters"
              className="neu-input w-full px-3 py-2 rounded-md"
            />
          </div>

          {message && <div className="text-sm muted">{message}</div>}

          <button
            type="button"
            className="neu-btn w-full px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || !token || newPassword.length < 8}
            onClick={() => void submit()}
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </div>
    </div>
  )
}

