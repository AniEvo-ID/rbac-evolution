<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { api } from './api'
import { clearSession, rbac, session } from './session'

const router = useRouter()
const roles = computed(() => rbac.snapshot.value.roles.join(', ') || 'no role')

async function logout() {
  await api('/logout', { method: 'POST' })
  clearSession()
  await router.push({ name: 'login' })
}
</script>

<template>
  <header>
    <nav>
      <RouterLink to="/articles">Articles</RouterLink>
      <!-- v-role hides the link for non-admins; /admin is still guarded by the router and the API -->
      <RouterLink v-role="'admin'" to="/admin">Admin</RouterLink>
    </nav>
    <div v-if="session.user">
      {{ session.user.name }}
      <small>({{ roles }})</small>
      <button @click="logout">Log out</button>
    </div>
    <RouterLink v-else to="/login">Log in</RouterLink>
  </header>
  <main>
    <RouterView />
  </main>
</template>
