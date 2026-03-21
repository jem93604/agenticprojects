import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./session"

const rawBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"
const API_BASE_URL = rawBase.replace(/\/$/, "")

export type ApiError = {
  message: string
  detail?: string
  status?: number
}

async function readJsonSafe(res: Response): Promise<any> {
  const contentType = res.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    return res.json()
  }
  return null
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit & { retryOn401?: boolean } = {},
): Promise<T> {
  const retryOn401 = init.retryOn401 ?? true
  const accessToken = getAccessToken()

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  }
  if (!headers["Content-Type"] && init.body) {
    headers["Content-Type"] = "application/json"
  }
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  })

  if (res.status === 401 && retryOn401) {
    const refreshToken = getRefreshToken()
    if (!refreshToken) {
      throw { message: "Not authenticated", status: 401 } satisfies ApiError
    }

    const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!refreshRes.ok) {
      clearTokens()
      throw { message: "Session expired", status: 401 } satisfies ApiError
    }

    const tokens = (await refreshRes.json()) as { access_token: string; refresh_token: string }
    setTokens({ access_token: tokens.access_token, refresh_token: tokens.refresh_token })

    // Retry once with new access token
    return apiRequest<T>(path, { ...init, retryOn401: false })
  }

  if (!res.ok) {
    const payload = await readJsonSafe(res)
    const message =
      (payload && (payload.detail || payload.message)) || `Request failed (${res.status})`
    throw { message, detail: payload?.detail, status: res.status } satisfies ApiError
  }

  const payload = await readJsonSafe(res)
  return payload as T
}

export const api = {
  auth: {
    async login(data: { handle: string; password: string }) {
      const res = await apiRequest<{ tokens: { access_token: string; refresh_token: string }; user: any }>(
        "/auth/login",
        { method: "POST", body: JSON.stringify(data) },
      )
      setTokens({
        access_token: res.tokens.access_token,
        refresh_token: res.tokens.refresh_token,
      })
      return res.user
    },
    async register(data: { handle: string; password: string; display_name?: string }) {
      return apiRequest<any>("/auth/register", { method: "POST", body: JSON.stringify(data) })
    },
    async me() {
      return apiRequest<any>("/auth/me", { method: "GET", retryOn401: true })
    },
    async logout() {
      const refreshToken = getRefreshToken()
      if (!refreshToken) {
        clearTokens()
        return
      }
      try {
        await apiRequest<any>("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refresh_token: refreshToken }),
          retryOn401: false,
        })
      } finally {
        clearTokens()
      }
    },
    async passwordResetRequest(data: { handle: string }) {
      return apiRequest<any>("/auth/password-reset/request", { method: "POST", body: JSON.stringify(data) })
    },
    async passwordResetConfirm(data: { reset_token: string; new_password: string }) {
      return apiRequest<any>("/auth/password-reset/confirm", { method: "POST", body: JSON.stringify(data) })
    },
  },
  projects: {
    async list() {
      return apiRequest<any[]>("/projects/", { method: "GET" })
    },
    async create(data: { name: string }) {
      return apiRequest<any>("/projects/", { method: "POST", body: JSON.stringify(data) })
    },
    async members(projectId: number) {
      return apiRequest<any[]>(`/projects/${projectId}/members`, { method: "GET" })
    },
    async invite(projectId: number, data: { handle: string; role?: "OWNER" | "MEMBER" }) {
      return apiRequest<any>(`/projects/${projectId}/invites`, { method: "POST", body: JSON.stringify(data) })
    },
    async removeMember(projectId: number, userId: number) {
      return apiRequest<any>(`/projects/${projectId}/members/${userId}`, { method: "DELETE" })
    },
  },
  tasks: {
    async list(projectId: number, status?: "TODO" | "DOING" | "DONE") {
      const q = status ? `?status=${encodeURIComponent(status)}` : ""
      return apiRequest<any[]>(`/projects/${projectId}/tasks${q}`, { method: "GET" })
    },
    async get(projectId: number, taskId: number) {
      return apiRequest<any>(`/projects/${projectId}/tasks/${taskId}`, { method: "GET" })
    },
    async create(projectId: number, data: any) {
      return apiRequest<any>(`/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(data) })
    },
    async update(projectId: number, taskId: number, data: any) {
      return apiRequest<any>(`/projects/${projectId}/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(data) })
    },
    async delete(projectId: number, taskId: number) {
      return apiRequest<any>(`/projects/${projectId}/tasks/${taskId}`, { method: "DELETE" })
    },
    async batchUpdate(projectId: number, updates: { task_id: number; status: any; position: number }[]) {
      return apiRequest<any[]>(
        `/projects/${projectId}/tasks/batch`,
        { method: "PATCH", body: JSON.stringify({ updates }) },
      )
    },
  },
  comments: {
    async list(projectId: number, taskId: number) {
      return apiRequest<any[]>(`/projects/${projectId}/tasks/${taskId}/comments`, { method: "GET" })
    },
    async create(projectId: number, taskId: number, data: { content: string }) {
      return apiRequest<any>(`/projects/${projectId}/tasks/${taskId}/comments`, {
        method: "POST",
        body: JSON.stringify(data),
      })
    },
    async edit(projectId: number, taskId: number, commentId: number, data: { content: string }) {
      return apiRequest<any>(
        `/projects/${projectId}/tasks/${taskId}/comments/${commentId}`,
        { method: "PATCH", body: JSON.stringify(data) },
      )
    },
    async delete(projectId: number, taskId: number, commentId: number) {
      return apiRequest<any>(
        `/projects/${projectId}/tasks/${taskId}/comments/${commentId}`,
        { method: "DELETE" },
      )
    },
  },
  notifications: {
    async list() {
      return apiRequest<any[]>(`/notifications`, { method: "GET" })
    },
    async markRead(notificationId: number) {
      return apiRequest<any>(`/notifications/${notificationId}/mark-read`, { method: "PATCH" })
    },
  },
}

