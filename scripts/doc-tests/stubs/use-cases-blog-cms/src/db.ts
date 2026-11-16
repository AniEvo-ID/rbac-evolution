// `./db`: the blog's own data layer (any ORM) and the rbac adapter built on it.
import { MemoryAdapter, type RbacAdapter } from '@anievo-id/rbac-evolution'

export interface Post {
  id: number
  authorId: number
  title: string
  status: 'draft' | 'published'
}

export interface User {
  id: number
  email: string
  bannedAt: Date | null
}

export declare const db: {
  posts: {
    find(id: number): Promise<Post | null>
    create(data: { authorId: number; title: string }): Promise<Post>
    update(id: number, data: Partial<Omit<Post, 'id'>>): Promise<Post>
    delete(id: number): Promise<void>
  }
  users: {
    find(id: number): Promise<User | null>
    findByEmail(email: string): Promise<User | null>
    create(data: { email: string }): Promise<User>
    update(id: number, data: Partial<Omit<User, 'id'>>): Promise<User>
  }
}

export const adapter: RbacAdapter = new MemoryAdapter()
