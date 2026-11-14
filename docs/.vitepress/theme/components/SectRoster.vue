<script setup lang="ts">
import { withBase } from 'vitepress'
import { ref } from 'vue'
import { mascots } from '../mascots'

const view = ref<'2d' | '3d'>('2d')
</script>

<template>
  <section class="roster" aria-labelledby="roster-title">
    <div class="roster-inner">
      <p class="eyebrow">Meet the Sect</p>
      <h2 id="roster-title">Every part of the docs has a guardian</h2>
      <p class="lede">
        RBAC Evolution is a sect: roles are ranks, permissions are technique scrolls, and these nine keep watch over
        each chapter.
      </p>
      <div class="switch" role="group" aria-label="Character art style">
        <button type="button" :aria-pressed="view === '2d'" @click="view = '2d'">2D</button>
        <button type="button" :aria-pressed="view === '3d'" @click="view = '3d'">3D</button>
      </div>
      <ul class="cards">
        <li v-for="m in mascots" :key="m.id" class="card" :style="{ '--accent': m.accent }">
          <a :href="withBase(m.link)" class="card-link">
            <span class="portrait">
              <img :src="withBase(`/mascots/${m.id}${view === '3d' ? '-3d' : ''}.webp`)" :alt="`${m.name}, the ${m.title}`" loading="lazy" width="200" height="260" />
            </span>
            <span class="meta">
              <span class="role">{{ m.role }}</span>
              <span class="name">{{ m.name }}</span>
              <span class="title">{{ m.title }}</span>
              <span class="line">“{{ m.line }}”</span>
            </span>
          </a>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.roster {
  padding: 72px 24px 48px;
}
.roster-inner {
  max-width: 1152px;
  margin: 0 auto;
}
.eyebrow {
  font-family: var(--sect-font-script);
  font-size: 30px;
  line-height: 1;
  color: var(--sect-jade);
  margin: 0 0 6px;
}
h2 {
  font-family: var(--sect-font-label);
  font-weight: 400;
  font-size: clamp(34px, 4.8vw, 56px);
  line-height: 1.05;
  margin: 0 0 12px;
  border: 0;
  padding: 0;
}
.lede {
  max-width: 640px;
  color: var(--vp-c-text-2);
  margin: 0 0 36px;
}
.switch {
  display: inline-flex;
  margin: -12px 0 28px;
  border: 2px solid var(--vp-c-text-1);
  border-radius: 2px;
}
.switch button {
  min-width: 56px;
  min-height: 40px;
  padding: 0 14px;
  font-family: var(--sect-font-label);
  font-size: 15px;
  color: var(--vp-c-text-1);
}
.switch button[aria-pressed='true'] {
  background: var(--vp-c-text-1);
  color: var(--vp-c-bg);
}
:global(.dark .roster .switch button[aria-pressed='true']) {
  background: var(--sect-yellow);
  color: var(--sect-ink);
}
.cards {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 20px;
}
.card-link {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-radius: 2px;
  border: 2px solid var(--vp-c-divider);
  background:
    linear-gradient(var(--accent), var(--accent)) top left / 100% 6px no-repeat,
    var(--vp-c-bg-soft);
  clip-path: polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 0 100%);
  color: inherit;
  text-decoration: none;
  overflow: hidden;
  transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
}
.card-link:hover,
.card-link:focus-visible {
  transform: translateY(-4px);
  border-color: var(--vp-c-text-1);
}
.card-link:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}
.portrait {
  display: grid;
  place-items: end center;
  height: 210px;
  padding-top: 14px;
}
.portrait img {
  height: 196px;
  width: auto;
  transition: transform 0.3s ease;
}
.card-link:hover .portrait img {
  transform: scale(1.05) rotate(-1.5deg);
}
.meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 18px 18px;
}
.role {
  align-self: flex-start;
  font-family: var(--sect-font-label);
  font-size: 12px;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: 2px;
  color: var(--sect-ink);
  background: var(--accent);
  margin-bottom: 6px;
}
.name {
  font-family: var(--sect-font-label);
  font-size: 24px;
  font-weight: 400;
}
.title {
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.line {
  margin-top: 8px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}
@media (prefers-reduced-motion: reduce) {
  .card-link, .portrait img { transition: none; }
  .card-link:hover, .card-link:hover .portrait img { transform: none; }
}
</style>
