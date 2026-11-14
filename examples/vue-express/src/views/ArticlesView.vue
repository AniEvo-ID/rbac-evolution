<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ApiError, api } from '../api'

interface Article {
  id: number
  title: string
  body: string
  published: boolean
}

const articles = ref<Article[]>([])
const title = ref('')
const body = ref('')
const message = ref<{ ok: boolean; text: string } | null>(null)

async function load() {
  articles.value = await api<Article[]>('/articles')
}

/** Runs an API call and shows the result; 403s from the server end up here. */
async function run(work: () => Promise<unknown>, success: string) {
  try {
    await work()
    message.value = { ok: true, text: success }
    await load()
  } catch (error) {
    if (!(error instanceof ApiError) || error.status === 401) throw error // 401: api() already redirected
    message.value = { ok: false, text: `${error.status}: ${error.message}` }
  }
}

const create = () =>
  run(async () => {
    await api('/articles', { method: 'POST', body: { title: title.value, body: body.value } })
    title.value = ''
    body.value = ''
  }, 'Article created.')
const publish = (id: number) => run(() => api(`/articles/${id}/publish`, { method: 'POST' }), `Published #${id}.`)
const remove = (id: number) => run(() => api(`/articles/${id}`, { method: 'DELETE' }), `Deleted #${id}.`)

onMounted(load)
</script>

<template>
  <h1>Articles</h1>

  <p v-if="message" :class="message.ok ? 'ok' : 'error'">{{ message.text }}</p>

  <!-- <Can> removes the form from the DOM; #fallback renders instead -->
  <Can permission="create articles">
    <form class="card row" @submit.prevent="create">
      <strong>New article</strong>
      <input v-model="title" placeholder="Title" required />
      <input v-model="body" placeholder="Body" />
      <button type="submit">Create</button>
    </form>
    <template #fallback>
      <p class="muted">You can't write articles.</p>
    </template>
  </Can>

  <div v-for="article in articles" :key="article.id" class="card">
    <div class="row">
      <strong>#{{ article.id }} {{ article.title }}</strong>
      <em v-if="!article.published" class="muted">(draft)</em>
    </div>
    <p>{{ article.body }}</p>
    <div class="row">
      <!-- v-can hides the element (display: none) when the snapshot lacks the permission -->
      <button v-if="!article.published" v-can="'publish articles'" @click="publish(article.id)">Publish</button>
      <button v-can="'delete articles'" @click="remove(article.id)">Delete</button>
      <span v-can.not="'edit articles'" class="muted">read only</span>
    </div>
  </div>

  <div v-if="articles[0]" class="card">
    <strong>Bypass the UI</strong>
    <p class="muted">
      This button is always visible and calls <code>DELETE /api/articles/{{ articles[0].id }}</code> directly, so you
      can see the API's <code>requirePermission('delete articles')</code> answer 403.
    </p>
    <button @click="remove(articles[0].id)">Try to delete article #{{ articles[0].id }}</button>
  </div>
</template>
