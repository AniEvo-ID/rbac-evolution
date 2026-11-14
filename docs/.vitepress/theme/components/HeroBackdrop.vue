<script setup lang="ts">
import { useData } from 'vitepress'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { QiField } from '../motion/qiField'

const { isDark } = useData()
const root = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
let field: QiField | undefined
let cleanup: (() => void) | undefined
// The imports below are async: stop if the page was left before they resolved.
let alive = true

onMounted(async () => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // WebGL is optional decoration: if it fails we keep the CSS/SVG backdrop.
  try {
    const { createQiField } = await import('../motion/qiField')
    if (alive && canvas.value) field = createQiField(canvas.value, { dark: isDark.value, reducedMotion: reduced })
    root.value?.classList.add('has-webgl')
  } catch {}
  if (reduced || !root.value) return

  const { gsap, ScrollTrigger } = await import('../motion/gsap')
  if (!alive) return
  const layers = gsap.utils.toArray<HTMLElement>('[data-depth]', root.value)
  const ctx = gsap.context(() => {
    // Scroll: layers drift at different speeds, the qi field dims.
    for (const el of layers) {
      const depth = Number(el.dataset.depth)
      gsap.to(el, { yPercent: -depth * 18, ease: 'none', scrollTrigger: { trigger: root.value, start: 'top top', end: 'bottom top', scrub: true } })
    }
    gsap.fromTo(canvas.value!, { opacity: 1 }, { opacity: 0.25, ease: 'none', immediateRender: false, scrollTrigger: { trigger: root.value, start: 'top top', end: 'bottom top', scrub: true } })
  }, root.value)

  // Pointer: mountains sway against the cursor for depth.
  const movers = layers.map((el) => ({ x: gsap.quickTo(el, 'x', { duration: 1.2, ease: 'power3' }), d: Number(el.dataset.depth) }))
  const onMove = (e: PointerEvent) => {
    const nx = e.clientX / window.innerWidth - 0.5
    for (const m of movers) m.x(-nx * m.d * 28)
  }
  window.addEventListener('pointermove', onMove, { passive: true })
  ScrollTrigger.refresh()
  cleanup = () => {
    window.removeEventListener('pointermove', onMove)
    ctx.revert()
  }
})

watch(isDark, (d) => field?.setDark(d))

onBeforeUnmount(() => {
  alive = false
  cleanup?.()
  field?.dispose()
})
</script>

<template>
  <div ref="root" class="sect-backdrop" aria-hidden="true">
    <div class="sky" />
    <div class="moon" data-depth="0.4" />
    <canvas ref="canvas" class="qi" />
    <svg class="range far" data-depth="0.6" viewBox="0 0 1440 360" preserveAspectRatio="none">
      <path d="M0 250 L90 190 L170 230 L260 140 L340 200 L430 120 L520 210 L610 160 L700 230 L800 130 L880 190 L980 110 L1080 200 L1170 150 L1260 220 L1350 170 L1440 210 V360 H0Z" />
    </svg>
    <div class="mist mist-a" data-depth="0.8" />
    <svg class="range mid" data-depth="1" viewBox="0 0 1440 360" preserveAspectRatio="none">
      <path d="M0 290 Q80 240 150 260 T300 220 Q360 170 420 230 T560 250 Q640 190 720 240 T900 230 Q980 160 1060 230 T1220 250 Q1300 200 1360 240 L1440 230 V360 H0Z" />
    </svg>
    <div class="mist mist-b" data-depth="1.2" />
    <svg class="range near" data-depth="1.5" viewBox="0 0 1440 360" preserveAspectRatio="none">
      <path d="M0 320 Q120 280 220 300 T460 290 Q560 250 660 300 T900 300 Q1010 260 1120 300 T1440 290 V360 H0Z" />
    </svg>
    <div class="hud">
      <span class="corner tl" /><span class="corner tr" /><span class="corner bl" /><span class="corner br" />
    </div>
    <div class="scan" />
  </div>
</template>

<style scoped>
.sect-backdrop {
  position: absolute;
  inset: 0 0 auto;
  height: 1000px;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
  -webkit-mask-image: linear-gradient(#000 70%, transparent);
  mask-image: linear-gradient(#000 70%, transparent);
  --m-far: #c8d6cd;
  --m-mid: #b3c6ba;
  --m-near: #9fb7a9;
  --mist: rgba(251, 250, 246, 0.85);
}
:global(.dark .sect-backdrop) {
  --m-far: #15223b;
  --m-mid: #101a30;
  --m-near: #0c1426;
  --mist: rgba(140, 190, 200, 0.12);
}
.sky {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(60% 50% at 75% 22%, rgba(231, 183, 95, 0.16), transparent 70%),
    radial-gradient(70% 60% at 20% 30%, rgba(14, 159, 122, 0.14), transparent 70%);
}
:global(.dark .sky) {
  background:
    radial-gradient(55% 45% at 75% 22%, rgba(231, 183, 95, 0.14), transparent 70%),
    radial-gradient(70% 60% at 18% 30%, rgba(45, 212, 167, 0.16), transparent 70%),
    linear-gradient(#070b17, #0b1020 60%);
}
.moon {
  position: absolute;
  width: 260px;
  aspect-ratio: 1;
  right: 9%;
  top: 14%;
  border-radius: 50%;
  background: radial-gradient(circle at 40% 38%, #f6e3b4, #e7b75f 55%, #c98f2c);
  box-shadow: 0 0 80px 20px rgba(231, 183, 95, 0.28);
  opacity: 0.14;
}
:global(.dark .moon) {
  background: radial-gradient(circle at 38% 36%, #fdf6e3, #d9e6df 50%, #9fc3b6);
  box-shadow: 0 0 140px 40px rgba(52, 211, 166, 0.35);
  opacity: 0.2;
}
.qi {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 1.2s ease;
}
.has-webgl .qi {
  opacity: 1;
}
.range {
  position: absolute;
  left: -3%;
  width: 106%;
  height: 360px;
  bottom: 0;
}
.far { bottom: 120px; height: 300px; }
.far path { fill: var(--m-far); }
.mid { bottom: 40px; }
.mid path { fill: var(--m-mid); }
.near path { fill: var(--m-near); }
.mist {
  position: absolute;
  left: -20%;
  width: 140%;
  height: 120px;
  background: radial-gradient(50% 50% at 50% 50%, var(--mist), transparent 70%);
  filter: blur(8px);
  animation: drift 26s ease-in-out infinite alternate;
}
.mist-a { bottom: 210px; }
.mist-b { bottom: 90px; animation-duration: 34s; animation-direction: alternate-reverse; }
.hud {
  position: absolute;
  inset: calc(var(--vp-nav-height) + 18px) 18px 140px;
}
.corner {
  position: absolute;
  width: 26px;
  height: 26px;
  border: 0 solid var(--vp-c-brand-1);
  opacity: 0.55;
}
.tl { top: 0; left: 0; border-top-width: 2px; border-left-width: 2px; }
.tr { top: 0; right: 0; border-top-width: 2px; border-right-width: 2px; }
.bl { bottom: 0; left: 0; border-bottom-width: 2px; border-left-width: 2px; }
.br { bottom: 0; right: 0; border-bottom-width: 2px; border-right-width: 2px; }
.scan {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(0deg, rgba(52, 211, 166, 0.035) 0 1px, transparent 1px 4px);
}
@keyframes drift {
  from { transform: translateX(-6%); }
  to { transform: translateX(6%); }
}
@media (max-width: 959px) {
  .sect-backdrop { height: 1150px; }
  .moon { width: 130px; right: -24px; top: 7%; }
  .hud { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .mist { animation: none; }
}
</style>
