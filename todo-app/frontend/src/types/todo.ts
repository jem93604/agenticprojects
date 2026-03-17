export type Tag = {
  id: number
  name: string
  color: string
}

export interface Todo {
  id: number
  title: string
  description?: string
  completed: boolean
  due_date?: string
  parent_id?: number | null
  tags?: Tag[]
}