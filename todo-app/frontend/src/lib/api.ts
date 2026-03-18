const rawBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
const API_BASE_URL = rawBase.replace(/\/$/, '')
    
export interface Tag {
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

export interface CreateTodoData {
  title: string
  description?: string
  completed?: boolean
  due_date?: string
  parent_id?: number
  tags?: Array<{ name: string; color?: string }>
}

export interface UpdateTodoData {
  title?: string
  description?: string
  completed?: boolean
  due_date?: string
  parent_id?: number | null
  tags?: Array<{ name: string; color?: string }>
}

export const api = {
  async getTodos(): Promise<Todo[]> {
    const response = await fetch(`${API_BASE_URL}/todos/`)
    if (!response.ok) {
      throw new Error('Failed to fetch todos')
    }
    return response.json()
  },

  async createTodo(data: CreateTodoData): Promise<Todo> {
    const response = await fetch(`${API_BASE_URL}/todos/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('Failed to create todo')
    }
    return response.json()
  },

  async getTodo(id: number): Promise<Todo> {
    const response = await fetch(`${API_BASE_URL}/todos/${id}`)
    if (!response.ok) {
      throw new Error('Failed to fetch todo')
    }
    return response.json()
  },

  async updateTodo(id: number, data: UpdateTodoData): Promise<Todo> {
    const response = await fetch(`${API_BASE_URL}/todos/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('Failed to update todo')
    }
    return response.json()
  },

  async deleteTodo(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/todos/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('Failed to delete todo')
    }
  },
}