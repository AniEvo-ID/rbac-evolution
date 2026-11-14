<script setup lang="ts">
import { withBase } from 'vitepress'
import HeroExtras from './HeroExtras.vue'
</script>

<template>
  <section class="cta">
    <h2>Start cultivating in five minutes</h2>
    <p>Install the core, pick an adapter, guard your first route.</p>
    <HeroExtras part="install" />
    <div class="cta-actions">
      <a class="btn primary" :href="withBase('/guide/quick-start')">Quick start</a>
      <a class="btn" :href="withBase('/guide/coming-from-laravel')">Coming from Laravel?</a>
    </div>
  </section>
</template>

<style scoped>
.cta {
  max-width: 760px;
  margin: 96px auto 24px;
  padding: 48px 24px;
  text-align: center;
  border-radius: 16px;
  border: 1px solid var(--vp-c-border);
  background: radial-gradient(80% 100% at 50% 0%, rgba(37, 99, 235, 0.22), transparent 70%), var(--vp-c-bg-soft);
}
.cta h2 {
  margin-bottom: 8px;
}
.cta p {
  margin: 0;
  color: var(--vp-c-text-2);
}
.cta-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
}
.btn {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 22px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg-elv);
  font-family: var(--sect-font-label);
  font-size: 16px;
  color: var(--vp-c-text-1);
  text-decoration: none;
}
.btn:hover {
  border-color: var(--sect-accent);
}
.btn.primary {
  border-color: var(--sect-accent-strong);
  background: var(--sect-accent-strong);
  color: #fff;
}
.btn.primary:hover {
  background: var(--sect-accent);
}
.btn {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 22px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg-elv);
  font-family: var(--sect-font-label);
  font-size: 16px;
  color: var(--vp-c-text-1);
  text-decoration: none;
}
.btn:hover {
  border-color: var(--sect-accent);
}
.btn.primary {
  border-color: var(--sect-accent-strong);
  background: var(--sect-accent-strong);
  color: #fff;
}
.btn.primary:hover {
  background: var(--sect-accent);
}
h2 {
  margin: 0 0 8px;
  font-family: var(--sect-font-label);
  font-weight: 400;
  font-size: clamp(28px, 3.6vw, 40px);
  line-height: 1.1;
  color: var(--vp-c-text-1);
}
@media (max-width: 860px) {
  .cta {
    margin: 64px 16px 24px;
  }
}
</style>
