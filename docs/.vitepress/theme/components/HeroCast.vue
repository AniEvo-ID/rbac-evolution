<script setup lang="ts">
import { withBase } from 'vitepress'
</script>

<template>
  <div class="hero-cast" aria-hidden="true">
    <svg class="formation" viewBox="0 0 400 400">
      <circle cx="200" cy="200" r="180" />
      <circle cx="200" cy="200" r="150" class="dashed" />
      <circle cx="200" cy="200" r="110" />
      <polygon points="200,40 339,280 61,280" />
      <polygon points="200,360 61,120 339,120" />
    </svg>
    <img class="cast cast-gatekeeper" :src="withBase('/mascots/gatekeeper.webp')" alt="" width="280" height="370" />
    <img class="cast cast-scroll" :src="withBase('/mascots/scroll-keeper.webp')" alt="" width="280" height="370" />
    <img class="cast cast-master" :src="withBase('/mascots/sect-master.webp')" alt="" width="320" height="420" fetchpriority="high" />
    <img class="cast cast-fox" :src="withBase('/mascots/spirit-fox.webp')" alt="" width="180" height="150" />
  </div>
</template>

<style scoped>
.hero-cast {
  position: relative;
  width: min(100%, 460px);
  aspect-ratio: 1 / 1;
  margin: 0 auto;
}
.formation {
  position: absolute;
  inset: 4%;
  fill: none;
  stroke: var(--sect-jade);
  stroke-width: 1.2;
  opacity: 0.35;
  animation: spin 80s linear infinite;
  filter: drop-shadow(0 0 12px var(--sect-jade-glow));
}
.formation .dashed {
  stroke: var(--sect-gold);
  stroke-dasharray: 4 10;
}
.cast {
  position: absolute;
  height: auto;
  filter: drop-shadow(0 18px 24px rgba(5, 10, 25, 0.35));
  transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
  cursor: var(--cursor-grab);
}
.cast:active {
  cursor: var(--cursor-grabbing);
}
.cast-master {
  width: 56%;
  left: 22%;
  bottom: 2%;
  z-index: 3;
  animation: float 6s ease-in-out infinite;
}
.cast-gatekeeper {
  width: 40%;
  left: -4%;
  bottom: 12%;
  z-index: 2;
  animation: float 7s ease-in-out -2s infinite;
}
.cast-scroll {
  width: 40%;
  right: -4%;
  bottom: 12%;
  z-index: 2;
  animation: float 6.5s ease-in-out -4s infinite;
}
.cast-fox {
  width: 26%;
  right: 6%;
  bottom: -2%;
  z-index: 4;
  animation: float 5s ease-in-out -1s infinite;
}
.cast:hover {
  transform: translateY(-8px) scale(1.04);
}
/* VitePress stacks the hero image above the title on narrow screens and pulls it down with a
   negative margin — keep the cast from covering the title. */
@media (max-width: 959px) {
  .hero-cast {
    width: min(300px, 82vw);
  }
}
@keyframes float {
  0%, 100% { translate: 0 0; }
  50% { translate: 0 -10px; }
}
@keyframes spin {
  to { rotate: 360deg; }
}
@media (prefers-reduced-motion: reduce) {
  .formation, .cast { animation: none; }
  .cast { transition: none; }
}
</style>
