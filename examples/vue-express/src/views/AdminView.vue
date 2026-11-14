<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../api'
import { refreshSession, session } from '../session'

interface AdminUser {
  id: number
  name: string
  roles: string[]
}

const ROLE_OPTIONS = ['admin', 'editor', 'viewer']
const users = ref<AdminUser[]>([])

async function load() {
  users.value = await api<AdminUser[]>('/admin/users')
}

async function setRole(user: AdminUser, role: string) {
  await api(`/admin/users/${user.id}/role`, { method: 'PUT', body: { role } })
  // Changed your own role? Refresh the snapshot so v-can / <Can> update.
  if (user.id === session.user?.id) await refreshSession()
  await load()
}

onMounted(load)
</script>

<template>
  <h1>Admin</h1>
  <p class="muted">
    Guarded three times: <code>v-role</code> hides the nav link, the router checks <code>meta.role</code>, and the API
    uses <code>requireRole('admin')</code>.
  </p>
  <table>
    <thead>
      <tr>
        <th>User</th>
        <th>Roles</th>
        <th>Change role</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="user in users" :key="user.id">
        <td>#{{ user.id }} {{ user.name }}</td>
        <td>{{ user.roles.join(', ') || 'none' }}</td>
        <td>
          <select :value="user.roles[0] ?? ''" @change="setRole(user, ($event.target as HTMLSelectElement).value)">
            <option value="">(no role)</option>
            <option v-for="role in ROLE_OPTIONS" :key="role" :value="role">{{ role }}</option>
          </select>
        </td>
      </tr>
    </tbody>
  </table>
</template>
