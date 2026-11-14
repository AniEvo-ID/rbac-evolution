<script setup lang="ts">
/**
 * Home background: a fixed grid whose lines carry glowing blue pulses, left→right and
 * top→bottom, spawned in a "lub-dub" heartbeat rhythm. Static grid only for reduced motion.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

const CELL = 56 // px, must match the grid size in CSS
const root = ref<HTMLElement>()
let timer: ReturnType<typeof setTimeout> | undefined

function pulse(el: HTMLElement) {
  const horizontal = Math.random() < 0.5
  const w = window.innerWidth
  const h = window.innerHeight
  const lines = Math.floor((horizontal ? h : w) / CELL)
  const line = (1 + Math.floor(Math.random() * Math.max(1, lines - 1))) * CELL
  const length = 140 + Math.random() * 120
  const span = document.createElement('span')
  span.className = horizontal ? 'beam h' : 'beam v'
  span.style[horizontal ? 'top' : 'left'] = `${line - 1}px`
  span.style[horizontal ? 'width' : 'height'] = `${length}px`
  el.appendChild(span)
  const travel = (horizontal ? w : h) + length
  const from = horizontal ? `translateX(${-length}px)` : `translateY(${-length}px)`
  const to = horizontal ? `translateX(${travel}px)` : `translateY(${travel}px)`
  span
    .animate([{ transform: from }, { transform: to }], { duration: 2600 + Math.random() * 2200, easing: 'cubic-bezier(.45,.05,.35,1)' })
    .finished.then(() => span.remove(), () => span.remove())
}

function beat() {
  // lub … dub … rest, like a heartbeat
  if (root.value && !document.hidden && root.value.childElementCount < 14) {
    pulse(root.value)
    setTimeout(() => root.value && pulse(root.value), 180)
  }
  timer = setTimeout(beat, 1100 + Math.random() * 500)
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  beat()
})
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="grid-pulse" aria-hidden="true">
    <div ref="root" class="beams" />
  </div>
</template>

<style scoped>
.grid-pulse {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(60% 45% at 50% 0%, rgba(37, 99, 235, 0.16), transparent 70%),
    linear-gradient(rgba(148, 163, 184, 0.07) 1px, transparent 1px) 0 0 / 56px 56px,
    linear-gradient(90deg, rgba(148, 163, 184, 0.07) 1px, transparent 1px) 0 0 / 56px 56px;
  -webkit-mask-image: radial-gradient(130% 100% at 50% 0%, #000 55%, transparent 100%);
  mask-image: radial-gradient(130% 100% at 50% 0%, #000 55%, transparent 100%);
}
.beams {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.beams :deep(.beam) {
  position: absolute;
  border-radius: 2px;
  will-change: transform;
}
.beams :deep(.beam.h) {
  left: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.5) 60%, #93c5fd 96%, #ffffff);
  box-shadow: 0 0 10px 1px rgba(59, 130, 246, 0.55);
}
.beams :deep(.beam.v) {
  top: 0;
  width: 2px;
  background: linear-gradient(180deg, transparent, rgba(59, 130, 246, 0.5) 60%, #93c5fd 96%, #ffffff);
  box-shadow: 0 0 10px 1px rgba(59, 130, 246, 0.55);
}
</style>
