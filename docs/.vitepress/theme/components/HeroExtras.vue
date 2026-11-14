<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ part: 'status' | 'install' }>()

const cmd = 'pnpm add @anievo-id/rbac-evolution'
const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(cmd)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {}
}
</script>

<template>
  <p v-if="part === 'status'" class="sect-status">
    <span class="dot" />FORMATION ONLINE<span class="sep">//</span>open source · MIT<span class="opt"><span class="sep">//</span>Node.js &amp; Bun</span>
  </p>
  <div v-else class="sect-install">
    <code><span class="prompt">$</span> {{ cmd }}</code>
    <button type="button" class="copy" :aria-label="copied ? 'Copied' : 'Copy install command'" @click="copy">
      {{ copied ? 'COPIED' : 'COPY' }}
    </button>
    <span class="sr-only" aria-live="polite">{{ copied ? 'Copied to clipboard' : '' }}</span>
  </div>
</template>

<style scoped>
.sect-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 18px;
  padding: 5px 12px;
  border-radius: 2px;
  border-left: 4px solid var(--sect-line);
  background: var(--sect-ink);
  font-family: var(--sect-font-label);
  font-size: 11px;
  letter-spacing: 0.12em;
  white-space: nowrap;
  color: #ededed;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 0;
  rotate: 45deg;
  background: var(--sect-jade);
  animation: blink 2.4s ease-in-out infinite;
}
.sep {
  color: var(--sect-yellow);
}
.opt {
  display: contents;
}
.sect-install {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  padding: 6px 6px 6px 14px;
  border-radius: 2px;
  border: 2px solid var(--vp-c-text-1);
  background: var(--vp-c-bg);
  max-width: 100%;
}
.sect-install code {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  color: var(--vp-c-text-1);
  background: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.prompt {
  color: var(--sect-jade);
}
.copy {
  flex: none;
  min-height: 32px;
  padding: 0 10px;
  border-radius: 2px;
  font-family: var(--sect-font-label);
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--sect-ink);
  background: var(--sect-yellow);
  border: 0;
  cursor: var(--cursor-copy);
}
.copy:hover {
  background: var(--sect-jade);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
@keyframes blink {
  50% { opacity: 0.35; }
}
@media (max-width: 639px) {
  .opt { display: none; }
  .sect-status { letter-spacing: 0.06em; }
  .sect-install code { font-size: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .dot { animation: none; }
}
</style>
