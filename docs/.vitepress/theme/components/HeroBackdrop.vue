<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const root = ref<HTMLElement>()
let cleanup: (() => void) | undefined
// The import below is async: stop if the page was left before it resolved.
let alive = true

// Topographic contour rings: the sect's mountain, drawn like a survey map.
const contours = Array.from({ length: 11 }, (_, i) => {
  const r = 40 + i * 38
  const cx = 1060
  const cy = 330
  return `M${cx - r} ${cy} C ${cx - r} ${cy - r * 0.92}, ${cx + r * 0.78} ${cy - r * 1.06}, ${cx + r} ${cy - 10} S ${cx + r * 0.25} ${cy + r * 1.08}, ${cx - r} ${cy}Z`
})

onMounted(async () => {
  if (!root.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const { gsap } = await import('../motion/gsap')
  if (!alive || !root.value) return
  const el = root.value
  const ctx = gsap.context(() => {
    const scroll = { trigger: el, start: 'top top', end: 'bottom top', scrub: true }
    gsap.to('.giant', { xPercent: -18, ease: 'none', scrollTrigger: scroll })
    gsap.to('.topo', { yPercent: -12, rotate: 6, ease: 'none', scrollTrigger: scroll })
    gsap.from('.giant', { opacity: 0, x: 120, duration: 1.4, ease: 'expo.out' })
  }, el)
  const turn = gsap.quickTo(el.querySelector('.topo'), 'x', { duration: 1.4, ease: 'power3' })
  const onMove = (e: PointerEvent) => turn((e.clientX / window.innerWidth - 0.5) * -30)
  window.addEventListener('pointermove', onMove, { passive: true })
  cleanup = () => {
    window.removeEventListener('pointermove', onMove)
    ctx.revert()
  }
})

onBeforeUnmount(() => {
  alive = false
  cleanup?.()
})
</script>

<template>
  <div ref="root" class="sect-backdrop" aria-hidden="true">
    <div class="grid" />
    <svg class="topo" viewBox="0 0 1440 700" preserveAspectRatio="xMidYMid slice">
      <path v-for="(d, i) in contours" :key="i" :d="d" :class="{ major: i % 4 === 3 }" />
    </svg>
    <p class="giant">Evolution</p>
    <div class="hud">
      <span class="corner tl" /><span class="corner tr" />
      <span class="coord">REALM 03 · SECT GATE · ALT 3,000</span>
    </div>
  </div>
</template>

<style scoped>
.sect-backdrop {
  position: absolute;
  inset: 0 0 auto;
  height: 860px;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
  --topo: #cfcfc8;
  --topo-major: #b4b4ad;
  --grid: #e3e3dd;
  --giant: #d9d9d3;
}
:global(.dark .sect-backdrop) {
  --topo: #262626;
  --topo-major: #333333;
  --grid: #1b1b1b;
  --giant: #242424;
}
.grid {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(var(--grid) 1px, transparent 1px) 0 0 / 80px 80px,
    linear-gradient(90deg, var(--grid) 1px, transparent 1px) 0 0 / 80px 80px;
}
.topo {
  position: absolute;
  inset: -10% -5% 0;
  width: 110%;
  height: 110%;
  fill: none;
}
.topo path {
  stroke: var(--topo);
  stroke-width: 1.5;
}
.topo path.major {
  stroke: var(--topo-major);
  stroke-width: 2.5;
}
.giant {
  position: absolute;
  left: 2%;
  bottom: 70px;
  margin: 0;
  /* Anton is only used for all-caps display text. */
  font-family: var(--sect-font-display);
  text-transform: uppercase;
  font-size: clamp(120px, 22vw, 340px);
  line-height: 0.8;
  white-space: nowrap;
  color: transparent;
  -webkit-text-stroke: 2px var(--giant);
}
.hud {
  position: absolute;
  inset: calc(var(--vp-nav-height) + 18px) 18px 120px;
}
.corner {
  position: absolute;
  width: 28px;
  height: 28px;
  border: 0 solid var(--sect-line);
}
.tl { top: 0; left: 0; border-top-width: 4px; border-left-width: 4px; }
.tr { top: 0; right: 0; border-top-width: 4px; border-right-width: 4px; }
.coord {
  position: absolute;
  right: 0;
  bottom: 0;
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--vp-c-text-3);
}
@media (max-width: 959px) {
  .sect-backdrop { height: 1080px; }
  .hud { display: none; }
  .giant { bottom: 60px; }
}
</style>
