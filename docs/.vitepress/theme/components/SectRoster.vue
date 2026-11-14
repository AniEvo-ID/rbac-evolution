<script setup lang="ts">
import { withBase } from 'vitepress'
import { mascots } from '../mascots'
</script>

<template>
  <section class="roster" aria-labelledby="roster-title">
    <div class="roster-inner">
      <p class="eyebrow">Meet the Sect</p>
      <h2 id="roster-title">Every part of the docs has a guardian</h2>
      <p class="lede">
        rbac-evolution is a sect: roles are ranks, permissions are technique scrolls, and these nine keep watch over
        each chapter.
      </p>
      <ul class="cards">
        <li v-for="m in mascots" :key="m.id" class="card" :style="{ '--accent': m.accent }">
          <a :href="withBase(m.link)" class="card-link">
            <span class="portrait">
              <img :src="withBase(`/mascots/${m.id}.webp`)" :alt="`${m.name}, the ${m.title}`" loading="lazy" width="200" height="260" />
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
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--vp-c-brand-1);
  margin: 0 0 8px;
}
h2 {
  font-family: var(--sect-font-display);
  font-size: clamp(26px, 4vw, 36px);
  line-height: 1.2;
  margin: 0 0 12px;
  border: 0;
  padding: 0;
}
.lede {
  max-width: 640px;
  color: var(--vp-c-text-2);
  margin: 0 0 36px;
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
  border-radius: 18px;
  border: 1px solid var(--vp-c-divider);
  background:
    radial-gradient(120% 70% at 50% 0%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 70%),
    var(--vp-c-bg-soft);
  color: inherit;
  text-decoration: none;
  overflow: hidden;
  transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
}
.card-link:hover,
.card-link:focus-visible {
  transform: translateY(-4px);
  border-color: var(--accent);
  box-shadow: 0 14px 34px -14px var(--accent);
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
  filter: drop-shadow(0 10px 14px rgba(5, 10, 25, 0.28));
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
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  border-radius: 999px;
  color: var(--vp-c-text-1);
  background: color-mix(in srgb, var(--accent) 22%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  margin-bottom: 6px;
}
.name {
  font-family: var(--sect-font-display);
  font-size: 20px;
  font-weight: 700;
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
