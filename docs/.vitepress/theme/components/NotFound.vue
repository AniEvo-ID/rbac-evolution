<script setup lang="ts">
import { withBase } from 'vitepress'
</script>

<template>
  <div class="not-found">
    <img :src="withBase('/mascots/spirit-fox.webp')" alt="Kitsu the Spirit Fox tilting its head" width="300" height="250" />
    <p class="code">404 · Path not in the scrolls</p>
    <h1>Kyu? This page wandered off the sect grounds.</h1>
    <p class="hint">The scroll you’re looking for was moved or never written. Kitsu can lead you back.</p>
    <div class="actions">
      <a class="btn primary" :href="withBase('/')">Back to the gate</a>
      <a class="btn" :href="withBase('/guide/introduction')">Read the guide</a>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 64px 24px 96px;
}
img {
  width: min(280px, 70vw);
  height: auto;
  animation: bob 4s ease-in-out infinite;
}
.code {
  margin: 20px 0 6px;
  display: inline-block;
  padding: 2px 10px;
  font-family: var(--sect-font-label);
  font-size: 15px;
  letter-spacing: 0.06em;
  color: var(--sect-ink);
  background: var(--sect-yellow);
}
h1 {
  font-family: var(--sect-font-label);
  font-weight: 400;
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1.05;
  max-width: 640px;
  margin: 0;
}
.hint {
  color: var(--vp-c-text-2);
  max-width: 520px;
  margin: 12px 0 28px;
}
.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}
.btn {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 20px;
  border-radius: 2px;
  border: 2px solid var(--vp-c-text-1);
  font-family: var(--sect-font-label);
  font-weight: 400;
  text-decoration: none;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
}
.btn.primary {
  border-color: transparent;
  color: var(--vp-button-brand-text);
  background: var(--vp-button-brand-bg);
}
.btn:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}
@keyframes bob {
  0%, 100% { translate: 0 0; rotate: 0deg; }
  50% { translate: 0 -8px; rotate: -3deg; }
}
@media (prefers-reduced-motion: reduce) {
  img { animation: none; }
}
</style>
