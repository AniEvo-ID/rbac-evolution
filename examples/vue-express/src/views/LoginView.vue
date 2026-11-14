<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import { type SessionUser, refreshSession } from '../session'

const route = useRoute()
const router = useRouter()
const users = ref<(SessionUser & { roles: string[] })[]>([])

onMounted(async () => {
  users.value = await api('/users')
})

// Fake login: the API stores the chosen user id in a cookie. No password, no auth provider.
async function loginAs(userId: number) {
  await api('/login', { method: 'POST', body: { userId } })
  await refreshSession()
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/articles'
  await router.push(redirect)
}
</script>

<template>
  <h1>Log in as…</h1>
  <p class="muted">Demo only: pick a seeded user. The choice is stored in a cookie.</p>
  <div v-for="user in users" :key="user.id" class="card row">
    <strong>{{ user.name }}</strong>
    <span class="muted">{{ user.roles.join(', ') || 'no role' }}</span>
    <button style="margin-left: auto" @click="loginAs(user.id)">Log in</button>
  </div>
</template>
