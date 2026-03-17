'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Sparkles } from 'lucide-react'

interface TodoFormProps {
  onAdd: (title: string, description?: string) => void
}

export function TodoForm({ onAdd }: TodoFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus title input on mount
  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.focus()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Please enter a task title')
      return
    }
    
    if (isSubmitting) return
    
    setIsSubmitting(true)
    setError(null)
    
    try {
      await onAdd(title.trim(), description.trim() || undefined)
      setTitle('')
      setDescription('')
      
      // Re-focus title input after successful submission
      if (titleInputRef.current) {
        titleInputRef.current.focus()
      }
    } catch (err) {
      setError('Failed to add task. Please try again.')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 card glass slide-in">
      <div className="space-y-2">
        <div className="flex items-center space-x-2 mb-2">
          <Sparkles className="w-4 h-4 accent" />
          <label htmlFor="title" className="text-sm font-medium text-foreground-secondary">
            New Task
          </label>
        </div>
        <Input
          ref={titleInputRef}
          id="title"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            if (error) setError(null)
          }}
          onKeyPress={handleKeyPress}
          placeholder="What needs to be done?"
          className="text-lg placeholder:muted neu-input"
          disabled={isSubmitting}
          aria-label="Task title"
          aria-required="true"
        />
        {error && (
          <p className="text-sm text-error mt-1" role="alert">
            {error}
          </p>
        )}
      </div>
      
      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium text-foreground-secondary">
          Description (optional)
        </label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Add details..."
          className="resize-none placeholder:muted neu-input"
          disabled={isSubmitting}
          aria-label="Task description"
          rows={3}
        />
      </div>
      
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center space-x-2">
          <div className="text-sm muted flex items-center space-x-1">
            <span>💡</span>
            <span>Press Enter to add quickly</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            type="submit"
            disabled={!title.trim() || isSubmitting}
            className="px-6 py-2 neu-btn flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full spin" />
                <span>Adding...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Add Task</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}