<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, withBase } from 'vitepress'
import { mascotForPath } from '../mascots'

defineProps<{ placement: 'aside' | 'footer' }>()

const route = useRoute()
const mascot = computed(() => mascotForPath(route.path))
</script>

<template>
  <aside :class="['page-guide', placement]" :style="{ '--accent': mascot.accent }" :aria-label="`Tip from ${mascot.name}`">
    <img :src="withBase(`/mascots/${mascot.id}.webp`)" :alt="`${mascot.name}, the ${mascot.title}`" loading="lazy" width="120" height="156" />
    <div class="bubble">
      <p class="who">
        <strong>{{ mascot.name }}</strong> · {{ mascot.title }}
      </p>
      <p class="say">{{ mascot.line }}</p>
    </div>
  </aside>
</template>

<style scoped>
.page-guide {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}
.page-guide img {
  flex: none;
  height: 128px;
  width: auto;
  filter: drop-shadow(0 8px 12px rgba(5, 10, 25, 0.25));
  cursor: var(--cursor-grab);
  transition: transform 0.3s ease;
}
.page-guide img:hover {
  transform: translateY(-4px) rotate(-2deg);
}
.bubble {
  position: relative;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--accent) 50%, var(--vp-c-divider));
  background: color-mix(in srgb, var(--accent) 10%, var(--vp-c-bg-soft));
  margin-bottom: 28px;
}
.bubble::before {
  content: '';
  position: absolute;
  left: -7px;
  bottom: 14px;
  width: 12px;
  height: 12px;
  rotate: 45deg;
  background: inherit;
  border-left: inherit;
  border-bottom: inherit;
}
.who {
  margin: 0 0 4px;
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.who strong {
  font-family: var(--sect-font-display);
  color: var(--vp-c-text-1);
}
.say {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--vp-c-text-1);
}
/* In the right aside on wide screens; at the end of the page otherwise. */
.aside {
  margin-top: 28px;
  flex-direction: column;
  align-items: center;
  text-align: left;
}
.aside .bubble {
  margin-bottom: 0;
}
.aside .bubble::before {
  left: 50%;
  top: -7px;
  bottom: auto;
  translate: -50% 0;
  border-left: inherit;
  border-bottom: 0;
  border-top: inherit;
}
.footer {
  margin: 40px 0 0;
}
@media (min-width: 1280px) {
  .footer { display: none; }
}
@media (max-width: 1279px) {
  .aside { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .page-guide img { transition: none; }
}
</style>
