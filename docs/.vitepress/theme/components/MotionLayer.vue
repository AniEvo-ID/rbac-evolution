<script setup lang="ts">
/**
 * Site-wide motion: home intro + scroll reveals, magnetic buttons, tilt cards
 * and a reading-progress bar. Everything is skipped when the visitor prefers
 * reduced motion.
 */
import { useRoute } from 'vitepress'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const route = useRoute()
const bar = ref<HTMLElement>()
let gsapMod: typeof import('../motion/gsap') | undefined
let pageCtx: { revert(): void } | undefined
const offs: (() => void)[] = []

function on<K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void) {
  window.addEventListener(type, fn, { passive: true })
  offs.push(() => window.removeEventListener(type, fn))
}

function progressBar() {
  let ticking = false
  const update = () => {
    ticking = false
    const max = document.documentElement.scrollHeight - window.innerHeight
    bar.value?.style.setProperty('--p', String(max > 0 ? window.scrollY / max : 0))
  }
  on('scroll', () => {
    if (!ticking) {
      ticking = true
      requestAnimationFrame(update)
    }
  })
  update()
}

function magnetic(el: HTMLElement, gsap: typeof import('gsap').gsap) {
  const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' })
  const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' })
  const move = (e: PointerEvent) => {
    const r = el.getBoundingClientRect()
    x((e.clientX - r.left - r.width / 2) * 0.3)
    y((e.clientY - r.top - r.height / 2) * 0.4)
  }
  const leave = () => {
    x(0)
    y(0)
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerleave', leave)
  return () => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerleave', leave)
  }
}

function tilt(el: HTMLElement, gsap: typeof import('gsap').gsap) {
  const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' })
  const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' })
  gsap.set(el, { transformPerspective: 900 })
  const move = (e: PointerEvent) => {
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    ry((px - 0.5) * 10)
    rx(-(py - 0.5) * 8)
    el.style.setProperty('--mx', `${px * 100}%`)
    el.style.setProperty('--my', `${py * 100}%`)
  }
  const leave = () => {
    rx(0)
    ry(0)
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerleave', leave)
  return () => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerleave', leave)
  }
}

async function animatePage() {
  pageCtx?.revert()
  pageCtx = undefined
  if (!gsapMod) return
  await nextTick()
  const { gsap, ScrollTrigger } = gsapMod
  const isHome = !!document.querySelector('.VPHome')
  const finePointer = window.matchMedia('(pointer: fine)').matches
  const undo: (() => void)[] = []

  const ctx = gsap.context(() => {
    if (isHome) {
      // Hero: the title rises letter group by group, then the rest fades up in order.
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
      tl.from('.home-hero .sect-status', { y: -16, opacity: 0, duration: 0.8 })
        .fromTo('.home-hero .title', { y: 40, opacity: 0, filter: 'blur(10px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.2, clearProps: 'filter' }, '<0.1')
        .from('.home-hero .script', { y: 16, opacity: 0, duration: 0.8 }, '<0.35')
        .from('.home-hero .lede, .home-hero .sect-install, .home-hero .actions .btn', { y: 22, opacity: 0, duration: 0.8, stagger: 0.07 }, '<0.15')
        .from('.home-hero .guardians li', { y: 30, opacity: 0, duration: 0.8, stagger: 0.08, ease: 'back.out(1.5)' }, '<0.2')

      // Feature rows: copy slides in from its side, the code panel from the other.
      gsap.utils.toArray<HTMLElement>('.rows .row').forEach((row) => {
        const flip = row.classList.contains('flip')
        const st = { trigger: row, start: 'top 82%' }
        gsap.from(row.querySelector('.copy'), { x: flip ? 40 : -40, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: st })
        gsap.from(row.querySelector('.panel'), { x: flip ? -40 : 40, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: st })
      })
      gsap.from('.cta', { y: 40, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: '.cta', start: 'top 88%' } })
      gsap.from('.roster-inner > *', { y: 30, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: '.roster', start: 'top 80%' } })

      if (finePointer) {
        document.querySelectorAll<HTMLElement>('.home-hero .actions .btn').forEach((b) => undo.push(magnetic(b, gsap)))
        document.querySelectorAll<HTMLElement>('.rows .panel').forEach((c) => undo.push(tilt(c, gsap)))
      }
    } else {
      // Docs stay calm: a short rise for the first blocks of the page.
      const blocks = [...document.querySelectorAll('.vp-doc > div > *')].slice(0, 8)
      if (blocks.length) gsap.from(blocks, { y: 14, opacity: 0, duration: 0.5, ease: 'power2.out', stagger: 0.04, clearProps: 'all' })
    }
  })
  ScrollTrigger.refresh()
  pageCtx = { revert: () => (ctx.revert(), undo.forEach((f) => f())) }
}

onMounted(async () => {
  progressBar()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  gsapMod = await import('../motion/gsap')
  document.documentElement.classList.add('motion-ready')
  animatePage()
})

watch(() => route.path, animatePage)

onBeforeUnmount(() => {
  pageCtx?.revert()
  offs.forEach((f) => f())
})
</script>

<template>
  <div ref="bar" class="qi-progress" aria-hidden="true" />
</template>

<style scoped>
.qi-progress {
  --p: 0;
  position: fixed;
  inset: 0 0 auto;
  height: 4px;
  z-index: 100;
  transform: scaleX(var(--p));
  transform-origin: left;
  background: var(--sect-accent);
  pointer-events: none;
}
</style>
