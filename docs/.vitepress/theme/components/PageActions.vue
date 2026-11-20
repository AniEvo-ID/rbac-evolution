<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData, withBase } from 'vitepress'

// The build copies every page's Markdown source next to its HTML (config.ts `buildEnd`), so
// `/guide/installation` has `/guide/installation.md`. AI chats need a public URL, so they always get the live site.
const SITE = 'https://creation.anievo.id'

const { page, site } = useData()
const mdPath = computed(() => withBase(`/${page.value.relativePath}`))
const mdUrl = computed(() => `${SITE}${site.value.base}${page.value.relativePath}`)
const prompt = computed(() => encodeURIComponent(`Read ${mdUrl.value} so I can ask questions about it.`))

const copied = ref<'idle' | 'done' | 'failed'>('idle')
async function copyPage() {
  const text = fetch(mdPath.value).then((res) => {
    if (!res.ok) throw new Error(String(res.status))
    return res.text()
  })
  try {
    // Safari drops the click's permission at the first await, so the clipboard write starts now with a pending blob.
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/plain': text.then((t) => new Blob([t], { type: 'text/plain' })) }),
      ])
    } catch {
      await navigator.clipboard.writeText(await text)
    }
    copied.value = 'done'
  } catch {
    copied.value = 'failed'
  }
  setTimeout(() => (copied.value = 'idle'), 2000)
}
</script>

<template>
  <div class="page-actions">
    <button type="button" class="action copy" @click="copyPage">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>
      <span aria-live="polite">{{ copied === 'done' ? 'Copied' : copied === 'failed' ? 'Copy failed' : 'Copy page' }}</span>
    </button>
    <a class="action" :href="mdPath" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" /><path d="M9 13h6M9 17h4" /></svg>
      Markdown
    </a>
    <a class="action" :href="`https://chatgpt.com/?q=${prompt}`" target="_blank" rel="noopener">
      Ask ChatGPT
      <svg class="ext" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6M11 13l9-9M15 4h5v5" /></svg>
    </a>
    <a class="action" :href="`https://claude.ai/new?q=${prompt}`" target="_blank" rel="noopener">
      Ask Claude
      <svg class="ext" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6M11 13l9-9M15 4h5v5" /></svg>
    </a>
  </div>
</template>

<style scoped>
.page-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 24px;
}
.action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  color: var(--vp-c-text-1);
  text-decoration: none;
  background: none;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}
.action:hover {
  background: var(--vp-c-bg-elv);
  border-color: var(--vp-c-border);
}
.action.copy {
  background: var(--vp-c-bg-soft);
  border-color: var(--vp-c-border);
}
.action svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.action svg.ext {
  width: 12px;
  height: 12px;
  color: var(--vp-c-text-2);
}
</style>
