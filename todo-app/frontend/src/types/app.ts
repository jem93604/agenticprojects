export type Status = 'TODO' | 'DOING' | 'DONE'
export type Importance = 'LOW' | 'MEDIUM' | 'HIGH'

export type UserMini = {
  id: number
  handle: string
  display_name?: string | null
}

export type Project = {
  id: number
  name: string
  created_by: number
  created_at?: string | null
}

export type ProjectMember = {
  user_id: number
  handle: string
  display_name?: string | null
  role: string
  joined_at?: string | null
}

export type Task = {
  id: number
  project_id: number
  title: string
  description?: string | null
  status: Status
  due_date?: string | null
  importance: Importance
  urgent_override?: boolean | null
  position: number
  assignees: UserMini[]
}

export type TaskComment = {
  id: number
  project_id: number
  task_id: number
  author: UserMini
  content: string
  mentioned_users: UserMini[]
  created_at: string
  edited_at?: string | null
}

export type Notification = {
  id: number
  type: string
  payload: any
  created_at: string
  read_at?: string | null
}

