<script setup lang="ts">
import { withBase } from 'vitepress'
import { onBeforeUnmount, onMounted, ref } from 'vue'

const root = ref<HTMLElement>()
let cleanup: (() => void) | undefined
let alive = true

const trigrams = ['☰', '☱', '☲', '☳', '☴', '☵', '☶', '☷']
const tags = [
  { text: "can('scrolls.read')", state: 'ALLOW', cls: 't1' },
  { text: "assignRole('gatekeeper')", state: 'BOUND', cls: 't2' },
  { text: "hasRole('sect-master')", state: 'ROOT', cls: 't3' },
  { text: 'cache · permissions', state: 'HIT', cls: 't4' },
]

onMounted(async () => {
  if (!root.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const { gsap } = await import('../motion/gsap')
  if (!alive) return
  const el = root.value
  const ctx = gsap.context(() => {
    gsap.from('.ring', { scale: 0.6, opacity: 0, rotate: -40, duration: 1.6, ease: 'expo.out', stagger: 0.12 })
    gsap.from('.cast', { y: 60, opacity: 0, scale: 0.85, duration: 1.1, ease: 'back.out(1.6)', stagger: 0.12, delay: 0.35 })
    gsap.from('.tag', { x: (i) => (i % 2 ? 30 : -30), opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.15, delay: 1.1 })
  }, el)

  // Cursor parallax: deeper layers move more.
  const layers = gsap.utils.toArray<HTMLElement>('[data-depth]', el).map((n) => ({
    x: gsap.quickTo(n, 'x', { duration: 0.9, ease: 'power3' }),
    y: gsap.quickTo(n, 'y', { duration: 0.9, ease: 'power3' }),
    d: Number(n.dataset.depth),
  }))
  const onMove = (e: PointerEvent) => {
    const nx = e.clientX / window.innerWidth - 0.5
    const ny = e.clientY / window.innerHeight - 0.5
    for (const l of layers) {
      l.x(nx * l.d * 36)
      l.y(ny * l.d * 24)
    }
  }
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
  <div ref="root" class="hero-cast" aria-hidden="true">
    <div class="formation" data-depth="0.3">
      <svg class="ring ring-outer" viewBox="0 0 400 400">
        <defs>
          <path id="rune-path" d="M200 200 m-172 0 a172 172 0 1 1 344 0 a172 172 0 1 1 -344 0" />
        </defs>
        <circle cx="200" cy="200" r="190" class="thin" />
        <text class="runes">
          <textPath href="#rune-path">
            ROLE · PERMISSION · GUARD · TEAM · WILDCARD · SEAL · ROLE · PERMISSION · GUARD · TEAM · WILDCARD · SEAL ·
          </textPath>
        </text>
        <circle cx="200" cy="200" r="158" class="dashed" />
      </svg>
      <svg class="ring ring-mid" viewBox="0 0 400 400">
        <g v-for="(t, i) in trigrams" :key="i" :transform="`rotate(${i * 45} 200 200)`">
          <text x="200" y="64" class="trigram">{{ t }}</text>
          <line x1="200" y1="72" x2="200" y2="96" class="spoke" />
        </g>
        <circle cx="200" cy="200" r="122" class="thin" />
      </svg>
      <svg class="ring ring-inner" viewBox="0 0 400 400">
        <polygon points="200,92 293,146 293,254 200,308 107,254 107,146" />
        <polygon points="200,120 269,240 131,240" class="gold" />
        <polygon points="200,280 131,160 269,160" class="gold" />
        <circle cx="200" cy="200" r="38" class="core" />
      </svg>
    </div>

    <div class="layer" data-depth="0.8">
      <img class="cast cast-gatekeeper" :src="withBase('/mascots/gatekeeper.webp')" alt="" width="280" height="370" />
    </div>
    <div class="layer" data-depth="0.7">
      <img class="cast cast-scroll" :src="withBase('/mascots/scroll-keeper.webp')" alt="" width="280" height="370" />
    </div>
    <div class="layer" data-depth="0.5">
      <img class="cast cast-master" :src="withBase('/mascots/sect-master.webp')" alt="" width="320" height="420" fetchpriority="high" />
    </div>
    <div class="layer" data-depth="1.2">
      <img class="cast cast-fox" :src="withBase('/mascots/spirit-fox.webp')" alt="" width="180" height="150" />
    </div>

    <div class="layer tags" data-depth="1.5">
      <span v-for="t in tags" :key="t.cls" class="tag" :class="t.cls">
        <code>{{ t.text }}</code><b>{{ t.state }}</b>
      </span>
    </div>
  </div>
</template>

<style scoped>
.hero-cast {
  position: relative;
  width: min(100%, 500px);
  aspect-ratio: 1 / 1;
  margin: 0 auto;
}
.formation,
.layer {
  position: absolute;
  inset: 0;
}
.ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: var(--sect-line);
}
.ring-outer { animation: spin 90s linear infinite; }
.ring-mid { inset: 6%; width: 88%; height: 88%; animation: spin 60s linear infinite reverse; }
.ring-inner { inset: 18%; width: 64%; height: 64%; animation: spin 40s linear infinite; }
.thin { stroke-width: 1; opacity: 0.45; }
.dashed { stroke: var(--sect-jade); stroke-width: 3; stroke-dasharray: 2 10; }
.runes {
  fill: var(--vp-c-text-1);
  stroke: none;
  font-family: var(--sect-font-label);
  font-size: 11px;
  letter-spacing: 3px;
  opacity: 0.55;
}
.trigram {
  fill: var(--sect-jade);
  stroke: none;
  font-size: 20px;
  text-anchor: middle;
  opacity: 0.8;
}
.spoke { stroke-width: 1; opacity: 0.4; }
.ring-inner polygon { stroke-width: 1.2; opacity: 0.5; }
.ring-inner .gold { stroke: var(--sect-jade); opacity: 0.6; }
.core { fill: var(--sect-yellow); stroke: var(--sect-ink); stroke-width: 3; }

.cast {
  position: absolute;
  height: auto;
  transition: scale 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
  pointer-events: auto;
  cursor: var(--cursor-grab);
}
.cast:active { cursor: var(--cursor-grabbing); }
.cast:hover { scale: 1.05; }
.cast-master { width: 54%; left: 23%; bottom: 4%; z-index: 3; animation: float 6s ease-in-out infinite; }
.cast-gatekeeper { width: 38%; left: -2%; bottom: 13%; animation: float 7s ease-in-out -2s infinite; }
.cast-scroll { width: 38%; right: -2%; bottom: 13%; animation: float 6.5s ease-in-out -4s infinite; }
.cast-fox { width: 25%; right: 8%; bottom: -1%; animation: float 5s ease-in-out -1s infinite; }

.tags { pointer-events: none; z-index: 10; }
.tag {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px 5px 10px;
  border-radius: 2px;
  border: 2px solid var(--sect-ink);
  border-left: 4px solid var(--sect-line);
  background: var(--sect-ink);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  white-space: nowrap;
  animation: hover-tag 5s ease-in-out infinite;
}
.tag code {
  color: #ededed;
  background: none;
  padding: 0;
  font-size: inherit;
}
.tag b {
  font-weight: 600;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 2px;
  font-family: var(--sect-font-label);
  font-weight: 400;
  color: var(--sect-ink);
  background: var(--sect-yellow);
}
.t1 { top: 6%; left: -6%; }
.t2 { top: 24%; right: -10%; animation-delay: -1.5s; }
.t3 { bottom: 30%; left: -12%; animation-delay: -3s; }
.t3 b { background: var(--sect-signal); color: #fff; }
.t1 b { background: var(--sect-jade); }
.t4 { bottom: 3%; left: 4%; animation-delay: -2.2s; }

@media (max-width: 959px) {
  .hero-cast { width: min(320px, 84vw); }
  .t2, .t3 { display: none; }
  .t1 { left: 0; top: 0; }
  .t4 { left: 0; }
}
@keyframes float {
  0%, 100% { translate: 0 0; }
  50% { translate: 0 -10px; }
}
@keyframes hover-tag {
  0%, 100% { translate: 0 0; }
  50% { translate: 0 -6px; }
}
@keyframes spin {
  to { rotate: 360deg; }
}
@media (prefers-reduced-motion: reduce) {
  .ring, .cast, .tag { animation: none; }
  .cast { transition: none; }
}
</style>
