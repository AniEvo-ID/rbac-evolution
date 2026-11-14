import { createRouter, createWebHistory } from 'vue-router'
import { rbac, refreshSession, session } from './session'
import AdminView from './views/AdminView.vue'
import ArticlesView from './views/ArticlesView.vue'
import ForbiddenView from './views/ForbiddenView.vue'
import LoginView from './views/LoginView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    /** Logged-in users only. */
    auth?: boolean
    permission?: string
    role?: string
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/articles' },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/articles', name: 'articles', component: ArticlesView, meta: { auth: true, permission: 'view articles' } },
    { path: '/admin', name: 'admin', component: AdminView, meta: { auth: true, role: 'admin' } },
    { path: '/forbidden', name: 'forbidden', component: ForbiddenView },
  ],
})

// Guarded routes: a UX nicety only. The API answers 401/403 on its own.
router.beforeEach(async (to) => {
  if (!session.loaded) await refreshSession()
  if (to.meta.auth && !session.user) return { name: 'login', query: { redirect: to.fullPath } }
  if (to.meta.permission && !rbac.can(to.meta.permission)) return { name: 'forbidden' }
  if (to.meta.role && !rbac.hasRole(to.meta.role)) return { name: 'forbidden' }
  return true
})
