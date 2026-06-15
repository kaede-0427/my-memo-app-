export type Priority = 'high' | 'medium' | 'low'
export type Status = 'todo' | 'in_progress' | 'on_hold' | 'review' | 'done'

export interface Project {
  id: string
  name: string
  created_at: string
}

export interface Memo {
  id: string
  project_id: string
  content: string
  updated_at: string
}

export interface Task {
  id: string
  project_id: string
  title: string
  status: Status
  priority: Priority
  due_date: string | null
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: Project
        Insert: { name: string }
        Update: { name?: string }
        Relationships: []
      }
      memos: {
        Row: Memo
        Insert: { project_id: string; content?: string }
        Update: { content?: string }
        Relationships: []
      }
      tasks: {
        Row: Task
        Insert: {
          project_id: string
          title: string
          status?: Status
          priority?: Priority
          due_date?: string | null
        }
        Update: {
          title?: string
          status?: Status
          priority?: Priority
          due_date?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
