export type Priority = 'high' | 'medium' | 'low'
export type Status = 'todo' | 'in_progress' | 'on_hold' | 'review' | 'done'

export interface Project {
  id: string
  name: string
  icon: string | null
  position: number
  created_at: string
}

export interface Memo {
  id: string
  project_id: string
  title: string
  content: string
  position: number
  updated_at: string
}

export interface MindMapNode {
  id: string
  position: { x: number; y: number }
  data: { label: string }
  type?: string
}

export interface MindMapEdge {
  id: string
  source: string
  target: string
}

export interface MindMap {
  id: string
  project_id: string
  nodes: MindMapNode[]
  edges: MindMapEdge[]
  updated_at: string
}

export interface Task {
  id: string
  project_id: string
  title: string
  status: Status
  priority: Priority
  due_date: string | null
  position: number
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: Project
        Insert: { name: string; icon?: string | null; position?: number }
        Update: { name?: string; icon?: string | null; position?: number }
        Relationships: []
      }
      memos: {
        Row: Memo
        Insert: { project_id: string; title?: string; content?: string }
        Update: { title?: string; content?: string }
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
          position?: number
        }
        Update: {
          title?: string
          status?: Status
          priority?: Priority
          due_date?: string | null
          position?: number
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
