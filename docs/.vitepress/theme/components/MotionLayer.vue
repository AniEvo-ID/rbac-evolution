<script setup lang="ts">
/**
 * Site-wide motion: home intro + scroll reveals, magnetic buttons, tilt cards,
 * a qi cursor trail and a reading-progress bar. Everything is skipped when the
 * visitor prefers reduced motion; the trail is skipped on touch screens.
 */
import { useRoute } from 'vitepress'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const route = useRoute()
const bar = ref<HTMLElement>()
const trail = ref<HTMLCanvasElement>()
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

function cursorTrail(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const resize = () => {
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  on('resize', resize)
  const sparks: { x: number; y: number; vx: number; vy: number; life: number; gold: boolean }[] = []
  let raf = 0
  let lx = 0
  let ly = 0
  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const dark = document.documentElement.classList.contains('dark')
    ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over'
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]!
      s.life -= 0.022
      if (s.life <= 0) {
        sparks.splice(i, 1)
        continue
      }
      s.x += s.vx
      s.y += s.vy
      s.vy -= 0.02 // qi rises
      const r = 1 + s.life * 2.6
      ctx.beginPath()
      ctx.fillStyle = s.gold
        ? `rgba(${dark ? '231,183,95' : '176,122,31'},${s.life * 0.8})`
        : `rgba(${dark ? '52,211,166' : '11,127,98'},${s.life * 0.8})`
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    raf = sparks.length ? requestAnimationFrame(tick) : 0
  }
  on('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return
    const dist = Math.hypot(e.clientX - lx, e.clientY - ly)
    lx = e.clientX
    ly = e.clientY
    if (dist < 6 || sparks.length > 60) return
    sparks.push({
      x: e.clientX,
      y: e.clientY,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      life: 1,
      gold: Math.random() > 0.75,
    })
    if (!raf) raf = requestAnimationFrame(tick)
  })
  offs.push(() => cancelAnimationFrame(raf))
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
      // Split the tagline headline into words so it can rise word by word.
      const text = document.querySelector<HTMLElement>('.VPHero .text')
      if (text && !text.dataset.split) {
        text.dataset.split = '1'
        text.innerHTML = (text.textContent ?? '')
          .trim()
          .split(/\s+/)
          .map((w) => `<span class="w"><span>${w}</span></span>`)
          .join(' ')
      }
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
      tl.from('.VPHero .sect-status', { y: -16, opacity: 0, duration: 0.8 })
        .fromTo('.VPHero .name', { clipPath: 'inset(0 100% 0 0)', filter: 'blur(8px)' }, { clipPath: 'inset(0 0% 0 0)', filter: 'blur(0px)', duration: 1.4, clearProps: 'clipPath,filter' }, '<0.1')
        .from('.VPHero .text .w > span', { yPercent: 110, opacity: 0, rotate: 4, duration: 1, stagger: 0.06 }, '<0.35')
        .from('.VPHero .tagline', { y: 20, opacity: 0, duration: 0.9 }, '<0.3')
        .from('.VPHero .actions .action, .VPHero .sect-install', { y: 24, opacity: 0, duration: 0.8, stagger: 0.08 }, '<0.2')

      ScrollTrigger.batch('.VPFeature', {
        start: 'top 88%',
        once: true,
        onEnter: (els) => gsap.from(els, { y: 60, opacity: 0, scale: 0.96, duration: 0.9, ease: 'power3.out', stagger: 0.1 }),
      })
      ScrollTrigger.batch('.roster .card', {
        start: 'top 90%',
        once: true,
        onEnter: (els) => gsap.from(els, { y: 50, opacity: 0, rotate: -1.5, duration: 0.8, ease: 'back.out(1.4)', stagger: 0.07 }),
      })
      gsap.from('.roster-inner > :not(.cards)', { y: 30, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: '.roster', start: 'top 80%' } })

      if (finePointer) {
        document.querySelectorAll<HTMLElement>('.VPHero .actions .VPButton').forEach((b) => undo.push(magnetic(b, gsap)))
        document.querySelectorAll<HTMLElement>('.VPFeature, .roster .card-link').forEach((c) => undo.push(tilt(c, gsap)))
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
  if (trail.value && window.matchMedia('(pointer: fine)').matches) cursorTrail(trail.value)
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
  <canvas ref="trail" class="qi-trail" aria-hidden="true" />
</template>

<style scoped>
.qi-progress {
  --p: 0;
  position: fixed;
  inset: 0 0 auto;
  height: 2px;
  z-index: 100;
  transform: scaleX(var(--p));
  transform-origin: left;
  background: linear-gradient(90deg, var(--sect-jade), var(--sect-gold));
  box-shadow: 0 0 10px var(--sect-jade-glow);
  pointer-events: none;
}
.qi-trail {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 99;
  pointer-events: none;
}
</style>
