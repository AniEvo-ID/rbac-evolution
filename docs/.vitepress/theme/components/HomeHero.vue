<script setup lang="ts">
import { withBase } from 'vitepress'
import { byId } from '../mascots'
import HeroExtras from './HeroExtras.vue'

const guardians = ['sect-master', 'gatekeeper', 'scroll-keeper', 'spirit-fox'].map((id) => byId[id]!)
</script>

<template>
  <section class="home-hero">
    <HeroExtras part="status" />
    <h1 class="title">
      RBAC <span class="hl">Evolution</span>
    </h1>
    <p class="script">roles &amp; permissions, cultivated.</p>
    <p class="lede">
      Everything you love about spatie/laravel-permission, for Node.js and Bun. One typed core, every framework, every
      database.
    </p>
    <HeroExtras part="install" />
    <div class="actions">
      <a class="btn primary" :href="withBase('/guide/quick-start')">Get started</a>
      <a class="btn" :href="withBase('/guide/introduction')">Read the guide</a>
      <a class="btn" href="https://github.com/AniEvo-ID/rbac-evolution">GitHub</a>
    </div>

    <p class="strip-label"><span class="dot" />Guardians of the sect</p>
    <ul class="guardians">
      <li v-for="m in guardians" :key="m.id" :style="{ '--accent': m.accent }">
        <a :href="withBase(m.link)">
          <img :src="withBase(`/mascots/${m.id}-3d.webp`)" :alt="`${m.name}, the ${m.title}`" width="96" height="128" />
          <span class="name">{{ m.title }}</span>
          <span class="role">{{ m.role }}</span>
        </a>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.home-hero {
  max-width: 960px;
  margin: 0 auto;
  padding: 72px 24px 48px;
  text-align: center;
}
.title {
  margin: 18px 0 6px;
  font-family: var(--sect-font-label);
  font-weight: 400;
  font-size: clamp(48px, 9vw, 104px);
  line-height: 1;
  letter-spacing: 0.01em;
  color: var(--vp-c-text-1);
}
.hl {
  position: relative;
  color: var(--sect-accent-text);
  text-shadow: 0 0 32px rgba(59, 130, 246, 0.45);
}
.hl::after {
  content: '';
  position: absolute;
  left: 2%;
  right: 2%;
  bottom: 0.02em;
  height: 0.16em;
  border-radius: 4px;
  background: rgba(37, 99, 235, 0.28);
  z-index: -1;
}
.script {
  margin: 4px 0 18px;
  font-family: var(--sect-font-script);
  font-size: clamp(26px, 3.4vw, 36px);
  color: var(--sect-jade);
}
.lede {
  max-width: 620px;
  margin: 0 auto;
  font-size: 18px;
  line-height: 1.65;
  color: var(--vp-c-text-2);
}
.actions {
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
  background: var(--vp-c-bg-soft);
  font-family: var(--sect-font-label);
  font-size: 16px;
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s;
}
.btn:hover {
  border-color: var(--sect-accent);
}
.btn.primary {
  border-color: var(--sect-accent-strong);
  background: var(--sect-accent-strong);
  color: #fff;
  box-shadow: 0 8px 28px -10px rgba(37, 99, 235, 0.8);
}
.btn.primary:hover {
  background: var(--sect-accent);
}
.strip-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 64px 0 16px;
  font-family: var(--sect-font-label);
  font-size: 13px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--sect-jade);
  box-shadow: 0 0 8px var(--sect-jade);
}
.guardians {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.guardians a {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 14px 10px 14px;
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
  background: rgba(17, 20, 24, 0.8);
  text-decoration: none;
  transition: border-color 0.2s, transform 0.2s;
}
.guardians a:hover {
  border-color: var(--accent);
  transform: translateY(-3px);
}
.guardians img {
  height: 112px;
  width: auto;
  margin-bottom: 6px;
}
.name {
  font-family: var(--sect-font-label);
  font-size: 15px;
  color: var(--vp-c-text-1);
}
.role {
  font-size: 12px;
  color: var(--vp-c-text-3);
}
@media (max-width: 640px) {
  .home-hero { padding-top: 40px; }
  .guardians { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .guardians img { height: 92px; }
}
@media (prefers-reduced-motion: reduce) {
  .btn, .guardians a { transition: none; }
  .guardians a:hover { transform: none; }
}
</style>
