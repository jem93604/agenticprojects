'use client'

import { useState, useEffect, useMemo } from 'react'
import { TodoForm } from '@/components/TodoForm'
import { TodoItem } from '@/components/TodoItem'
import { api, Todo, CreateTodoData, UpdateTodoData } from '@/lib/api'

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchTodos()
  }, [])

  const fetchTodos = async () => {
    try {
      setLoading(true)
      const fetchedTodos = await api.getTodos()
      setTodos(fetchedTodos)
    } catch (err) {
      setError('Failed to fetch todos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const addTodo = async (title: string, description?: string, parent_id?: number) => {
    try {
      const newTodo: CreateTodoData = { title, description, parent_id }
      const createdTodo = await api.createTodo(newTodo)
      setTodos(prev => [createdTodo, ...prev])
    } catch (err) {
      setError('Failed to create todo')
      console.error(err)
    }
  }

  const toggleTodo = async (id: number) => {
    try {
      const todo = todos.find(t => t.id === id)
      if (!todo) return

      const updatedTodo: UpdateTodoData = { completed: !todo.completed }
      const result = await api.updateTodo(id, updatedTodo)
      setTodos(prev => prev.map(t => (t.id === id ? result : t)))
    } catch (err) {
      setError('Failed to update todo')
      console.error(err)
    }
  }

  const deleteTodo = async (id: number) => {
    try {
      await api.deleteTodo(id)
      setTodos(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      setError('Failed to delete todo')
      console.error(err)
    }
  }

  const updateTodo = async (updatedTodo: Todo) => {
    try {
      const result = await api.updateTodo(updatedTodo.id, {
        title: updatedTodo.title,
        description: updatedTodo.description,
        completed: updatedTodo.completed,
        due_date: updatedTodo.due_date,
        parent_id: updatedTodo.parent_id,
        tags: updatedTodo.tags,
      })
      setTodos(prev => prev.map(t => (t.id === updatedTodo.id ? result : t)))
    } catch (err) {
      setError('Failed to update todo')
      console.error(err)
    }
  }

  const rootTodos = useMemo(() => todos.filter(todo => !todo.parent_id), [todos])
  const subtasksByParent = useMemo(() => {
    const map: Record<number, Todo[]> = {}
    todos.forEach(todo => {
      if (todo.parent_id) {
        map[todo.parent_id] = map[todo.parent_id] ?? []
        map[todo.parent_id].push(todo)
      }
    })
    return map
  }, [todos])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-lg">Loading…</div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <header className="mb-4">
        <div className="card glass p-6">
          <h1 className="text-3xl font-bold">Your Tasks</h1>
          <p className="mt-2 text-sm subtitle">
            Capture what matters, then break things down into subtasks.
          </p>
        </div>
      </header>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <TodoForm onAdd={addTodo} />

      <section className="mt-10 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Tasks ({rootTodos.length})
          </h2>
          <span className="text-sm muted">Total items: {todos.length}</span>
        </div>

        {rootTodos.length === 0 ? (
          <div className="mt-8 text-center py-10 text-gray-500 dark:text-gray-400">
            No tasks yet. Add one above to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {rootTodos.map(todo => (
              <TodoItem
                key={todo.id}
                todo={todo}
                subtasks={subtasksByParent[todo.id] ?? []}
                onToggle={toggleTodo}
                onDelete={deleteTodo}
                onEdit={updateTodo}
                onAddSubtask={(title, description) => addTodo(title, description, todo.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
