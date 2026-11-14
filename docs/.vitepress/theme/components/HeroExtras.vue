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
  border-radius: 999px;
  border: 1px solid rgba(59, 130, 246, 0.4);
  background: rgba(37, 99, 235, 0.1);
  font-family: var(--sect-font-label);
  font-size: 11px;
  letter-spacing: 0.12em;
  white-space: nowrap;
  color: var(--vp-c-text-2);
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--sect-jade);
  box-shadow: 0 0 8px var(--sect-jade);
  animation: blink 2.4s ease-in-out infinite;
}
.sep {
  color: var(--sect-accent-text);
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
  border-radius: 10px;
  border: 1px solid var(--vp-c-border);
  background: rgba(17, 20, 24, 0.9);
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
  border-radius: 6px;
  font-family: var(--sect-font-label);
  font-size: 11px;
  letter-spacing: 0.1em;
  color: #fff;
  background: var(--sect-accent-strong);
  border: 0;
  cursor: var(--cursor-copy);
}
.copy:hover {
  background: var(--sect-accent);
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
