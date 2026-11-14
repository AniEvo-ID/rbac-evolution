<script setup lang="ts">
import { withBase } from 'vitepress'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { byId } from '../mascots'

const stages = [
  {
    realm: 'Realm I',
    stage: 'Qi Condensation',
    concept: 'Permissions',
    mascot: byId['disciple']!,
    copy: 'Every journey starts with a single technique scroll. Grant it straight to a user, then check it anywhere.',
    code: `const user = rbac.for(currentUser)

await user.givePermissionTo('read scrolls')
await user.can('read scrolls') // true`,
    link: '/basic-usage/direct-permissions',
  },
  {
    realm: 'Realm II',
    stage: 'Foundation Establishment',
    concept: 'Roles',
    mascot: byId['gatekeeper']!,
    copy: 'Bundle scrolls into a rank. Disciples inherit everything their role carries, and guards check it on every request.',
    code: `await rbac.role('gatekeeper')
  .givePermissionTo('open gate', 'inspect pass')

await user.assignRole('gatekeeper')
await user.can('open gate') // true`,
    link: '/basic-usage/roles',
  },
  {
    realm: 'Realm III',
    stage: 'Core Formation',
    concept: 'Teams',
    mascot: byId['twins']!,
    copy: 'Same sect, different branches. A role in the east branch means nothing in the west.',
    code: `const rbac = createRbac({ adapter, teams: true })

await rbac.for(user, { team: 'east' }).assignRole('elder')
await rbac.for(user, { team: 'west' }).hasRole('elder') // false`,
    link: '/basic-usage/teams',
  },
  {
    realm: 'Realm IV',
    stage: 'Ascension',
    concept: 'Super-admin',
    mascot: byId['sect-master']!,
    copy: 'The Sect Master’s seal opens every gate: one option, and every can() check says yes.',
    code: `const rbac = createRbac({
  adapter,
  superAdminRoles: ['sect-master'],
})`,
    link: '/basic-usage/super-admin',
  },
]

const root = ref<HTMLElement>()
const active = ref(0)
let cleanup: (() => void) | undefined
let alive = true

onMounted(async () => {
  if (!root.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const { gsap, ScrollTrigger } = await import('../motion/gsap')
  if (!alive) return
  const el = root.value
  const mm = gsap.matchMedia()

  // Desktop: pin the section and travel sideways through the realms.
  mm.add('(min-width: 960px)', () => {
    const track = el.querySelector<HTMLElement>('.track')!
    const distance = () => track.scrollWidth - el.querySelector<HTMLElement>('.viewport')!.clientWidth
    gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: el,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        // Measure the pin before triggers further down the page (roster reveals).
        refreshPriority: 1,
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          active.value = Math.min(stages.length - 1, Math.round(self.progress * (stages.length - 1)))
          el.style.setProperty('--progress', String(self.progress))
        },
      },
    })
  })

  // Mobile: cards rise in as they enter.
  mm.add('(max-width: 959px)', () => {
    el.style.setProperty('--progress', '1')
    gsap.utils.toArray<HTMLElement>('.stage', el).forEach((card) =>
      gsap.from(card, { y: 50, opacity: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: card, start: 'top 85%' } }),
    )
  })

  // Inside mm so mm.revert() also removes this trigger.
  mm.add('all', () => gsap.from(el.querySelectorAll('.head > *'), {
    y: 30,
    opacity: 0,
    stagger: 0.1,
    duration: 0.8,
    ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 75%' },
  }))
  // The pin is created after other triggers; re-measure them with its spacing.
  ScrollTrigger.refresh()
  cleanup = () => mm.revert()
})

onBeforeUnmount(() => {
  alive = false
  cleanup?.()
})
</script>

<template>
  <section ref="root" class="evo" aria-labelledby="evo-title">
    <div class="head">
      <p class="eyebrow">[ Cultivation path ]</p>
      <h2 id="evo-title">From disciple to Sect Master</h2>
      <p class="lede">Four realms, four ideas. Each one builds on the last, exactly like spatie/laravel-permission.</p>
      <ol class="meter" aria-hidden="true">
        <li v-for="(s, i) in stages" :key="s.realm" :class="{ on: i <= active }">
          <span class="dot" /><span class="label">{{ s.concept }}</span>
        </li>
        <span class="fill" />
      </ol>
    </div>
    <div class="viewport">
      <ol class="track">
        <li v-for="(s, i) in stages" :key="s.realm" class="stage" :class="{ current: i === active }" :style="{ '--accent': s.mascot.accent }">
          <div class="card">
            <header>
              <span class="realm">{{ s.realm }} · {{ s.stage }}</span>
              <span class="concept">{{ s.concept }}</span>
            </header>
            <div class="body">
              <img :src="withBase(`/mascots/${s.mascot.id}.webp`)" :alt="`${s.mascot.name}, the ${s.mascot.title}`" loading="lazy" width="200" height="260" />
              <div>
                <h3>{{ s.mascot.name }} <small>{{ s.mascot.title }}</small></h3>
                <p>{{ s.copy }}</p>
                <a :href="withBase(s.link)">Learn {{ s.concept.toLowerCase() }} →</a>
              </div>
            </div>
            <pre><code>{{ s.code }}</code></pre>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.evo {
  --progress: 0;
  padding: 96px 0 72px;
  overflow: hidden;
}
.head {
  max-width: 1152px;
  margin: 0 auto;
  padding: 0 24px;
}
.eyebrow {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--sect-gold);
  margin: 0 0 8px;
}
h2 {
  font-family: var(--sect-font-display);
  font-size: clamp(28px, 4.4vw, 44px);
  line-height: 1.15;
  margin: 0 0 12px;
}
.lede {
  color: var(--vp-c-text-2);
  max-width: 620px;
  margin: 0 0 28px;
}
.meter {
  position: relative;
  display: flex;
  justify-content: space-between;
  list-style: none;
  margin: 0 0 32px;
  padding: 0;
  max-width: 720px;
}
.meter::before,
.fill {
  content: '';
  position: absolute;
  top: 7px;
  left: 7px;
  right: 7px;
  height: 2px;
  background: var(--vp-c-divider);
}
.fill {
  right: auto;
  width: calc((100% - 14px) * var(--progress));
  background: linear-gradient(90deg, var(--sect-jade), var(--sect-gold));
  box-shadow: 0 0 12px var(--sect-jade-glow);
}
.meter li {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-3);
  transition: color 0.3s;
}
.dot {
  width: 16px;
  height: 16px;
  rotate: 45deg;
  border: 2px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  transition: all 0.3s;
}
.meter li.on { color: var(--vp-c-text-1); }
.meter li.on .dot {
  border-color: var(--sect-jade);
  background: var(--sect-jade);
  box-shadow: 0 0 12px var(--sect-jade-glow);
}
.viewport {
  padding: 0 24px;
}
.track {
  display: flex;
  gap: 28px;
  list-style: none;
  margin: 0;
  padding: 0 max(0px, calc((100vw - 1152px) / 2));
  width: max-content;
}
.stage {
  width: min(560px, 80vw);
  flex: none;
}
.card {
  position: relative;
  height: 100%;
  border-radius: 18px;
  padding: 22px;
  border: 1px solid var(--vp-c-divider);
  background:
    radial-gradient(90% 60% at 100% 0%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 70%),
    color-mix(in srgb, var(--vp-c-bg-soft) 88%, transparent);
  backdrop-filter: blur(6px);
  transition: border-color 0.4s, box-shadow 0.4s;
}
.current .card,
.stage:hover .card,
.stage:focus-within .card {
  border-color: color-mix(in srgb, var(--accent) 70%, transparent);
  box-shadow: 0 24px 60px -30px var(--accent);
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.realm { color: var(--vp-c-text-3); }
.concept {
  padding: 2px 8px;
  border-radius: 6px;
  color: var(--vp-c-text-1);
  border: 1px solid color-mix(in srgb, var(--accent) 60%, transparent);
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}
.body {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 16px;
  align-items: end;
}
.body img {
  width: 110px;
  height: auto;
  filter: drop-shadow(0 10px 14px rgba(5, 10, 25, 0.3));
  /* Only the art dims on inactive realms; text keeps full contrast. */
  opacity: 0.55;
  transition: opacity 0.4s;
}
.current .body img,
.stage:hover .body img,
.stage:focus-within .body img {
  opacity: 1;
}
h3 {
  font-family: var(--sect-font-display);
  font-size: 22px;
  margin: 0 0 6px;
}
h3 small {
  font-family: var(--vp-font-family-base);
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  margin-left: 4px;
}
.body p {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.55;
  color: var(--vp-c-text-2);
}
.body a {
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}
pre {
  margin: 16px 0 0;
  padding: 14px 16px;
  border-radius: 12px;
  overflow-x: auto;
  background: var(--vp-code-block-bg);
  border: 1px solid var(--vp-c-divider);
  font-size: 13px;
  line-height: 1.6;
}
pre code {
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-1);
}
@media (max-width: 959px) {
  .evo { padding: 72px 0 48px; }
  .track { flex-direction: column; width: auto; padding: 0; }
  .stage { width: auto; }
  .body img { opacity: 1; }
  .meter { display: none; }
}
@media (max-width: 520px) {
  .body { grid-template-columns: 76px 1fr; }
  .body img { width: 76px; }
}
@media (prefers-reduced-motion: reduce) {
  .track { flex-direction: column; width: auto; padding: 0; max-width: 1152px; margin: 0 auto; }
  .stage { width: auto; }
  .card { transition: none; }
  .body img { opacity: 1; transition: none; }
  .evo { --progress: 1; }
}
</style>
