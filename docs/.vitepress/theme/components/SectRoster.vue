<script setup lang="ts">
/** "Meet the Sect": a character select. One guardian at a time, an avatar rail to switch, a 2D/3D toggle. */
import { withBase } from 'vitepress'
import { computed, ref } from 'vue'
import { mascots } from '../mascots'

const index = ref(0)
const view = ref<'2d' | '3d'>('2d')
const rail = ref<HTMLElement>()
const current = computed(() => mascots[index.value]!)

function select(i: number) {
  index.value = (i + mascots.length) % mascots.length
  rail.value?.children[index.value]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowRight') select(index.value + 1)
  else if (e.key === 'ArrowLeft') select(index.value - 1)
  else return
  e.preventDefault()
  ;(rail.value?.children[index.value] as HTMLElement | undefined)?.focus()
}
</script>

<template>
  <section class="roster" aria-labelledby="roster-title" :style="{ '--accent': current.accent }">
    <div class="roster-inner">
      <p class="eyebrow">Meet the Sect</p>
      <h2 id="roster-title">Every part of the docs has a guardian</h2>

      <div class="stage">
        <p class="ghost" aria-hidden="true">{{ current.name }}</p>

        <Transition name="swap" mode="out-in">
          <div :key="current.id" class="info" aria-live="polite">
            <h3 class="name">{{ current.name }}</h3>
            <p class="tags">
              <span class="chip">{{ current.role }}</span><span class="title">{{ current.title }}</span>
            </p>
            <p class="quote">“{{ current.line }}”</p>
            <p class="desc">{{ current.description }}</p>
            <a class="more" :href="withBase(current.link)">Learn {{ current.topic }} →</a>
          </div>
        </Transition>

        <Transition name="figure" mode="out-in">
          <img
            :key="`${current.id}-${view}`"
            class="figure"
            :src="withBase(`/mascots/${current.id}${view === '3d' ? '-3d' : ''}.webp`)"
            :alt="`${current.name}, the ${current.title}`"
            width="480"
            height="560"
          />
        </Transition>

        <div class="picker">
          <button type="button" class="arrow" aria-label="Previous guardian" @click="select(index - 1)">‹</button>
          <div ref="rail" class="avatars" role="group" aria-label="Choose a guardian" @keydown="onKey">
            <button
              v-for="(m, i) in mascots"
              :key="m.id"
              type="button"
              class="avatar"
              :class="{ on: i === index }"
              :aria-pressed="i === index"
              :aria-label="`${m.name}, ${m.title}`"
              :tabindex="i === index ? 0 : -1"
              @click="select(i)"
            >
              <img :src="withBase(`/mascots/${m.id}-avatar.webp`)" alt="" width="64" height="64" loading="lazy" />
            </button>
          </div>
          <button type="button" class="arrow" aria-label="Next guardian" @click="select(index + 1)">›</button>
        </div>

        <button
          type="button"
          class="toggle"
          :class="{ is3d: view === '3d' }"
          :aria-pressed="view === '3d'"
          :aria-label="`Show ${view === '3d' ? '2D' : '3D'} art`"
          @click="view = view === '3d' ? '2d' : '3d'"
        >
          <span class="lbl top" aria-hidden="true">3D</span>
          <span class="lbl bottom" aria-hidden="true">2D</span>
          <span class="knob" aria-hidden="true">{{ view.toUpperCase() }}</span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.roster {
  padding: 72px 24px 48px;
}
.roster-inner {
  max-width: 1152px;
  margin: 0 auto;
}
.eyebrow {
  font-family: var(--sect-font-script);
  font-size: 30px;
  line-height: 1;
  color: var(--sect-jade);
  margin: 0 0 6px;
}
h2 {
  font-family: var(--sect-font-label);
  font-weight: 400;
  font-size: clamp(34px, 4.8vw, 56px);
  line-height: 1.05;
  margin: 0 0 24px;
  border: 0;
  padding: 0;
}
.stage {
  position: relative;
  min-height: 600px;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid var(--vp-c-divider);
  background:
    radial-gradient(50% 65% at 72% 55%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 70%),
    linear-gradient(rgba(148, 163, 184, 0.06) 1px, transparent 1px) 0 0 / 56px 56px,
    linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px) 0 0 / 56px 56px,
    #0b0e12;
  transition: background 0.5s;
}
.ghost {
  position: absolute;
  left: 40px;
  top: 40px;
  margin: 0;
  font-family: var(--sect-font-label);
  font-size: clamp(90px, 13vw, 150px);
  line-height: 1;
  white-space: nowrap;
  text-transform: uppercase;
  color: transparent;
  -webkit-text-stroke: 1.5px rgba(255, 255, 255, 0.07);
  pointer-events: none;
}
.info {
  position: relative;
  z-index: 2;
  width: min(470px, 46%);
  padding: 96px 0 150px 56px;
}
.name {
  margin: 0;
  font-family: var(--sect-font-label);
  font-weight: 400;
  font-size: clamp(44px, 5.4vw, 68px);
  line-height: 1;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--vp-c-text-1);
}
.tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 14px 0 18px;
}
.chip {
  padding: 4px 14px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 13px;
  color: #0a0c0e;
  background: var(--accent);
}
.title {
  font-size: 14px;
  color: var(--vp-c-text-2);
}
.quote {
  margin: 0 0 12px;
  font-weight: 700;
  font-size: 19px;
  line-height: 1.45;
  color: var(--vp-c-text-1);
}
.desc {
  margin: 0 0 18px;
  font-size: 15px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}
.more {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 18px;
  border-radius: 8px;
  background: var(--sect-accent-strong);
  font-family: var(--sect-font-label);
  font-size: 15px;
  color: #fff;
  text-decoration: none;
}
.more:hover {
  background: var(--sect-accent);
}
.figure {
  position: absolute;
  right: 110px;
  bottom: 36px;
  height: min(520px, 86%);
  width: auto;
  max-width: 48%;
  object-fit: contain;
  object-position: bottom;
  filter: drop-shadow(0 30px 40px rgba(0, 0, 0, 0.5));
}
.picker {
  position: absolute;
  z-index: 3;
  left: 40px;
  bottom: 32px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 999px;
  background: rgba(17, 20, 24, 0.88);
  border: 1px solid var(--vp-c-border);
}
.arrow {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--vp-c-text-1);
  color: #0a0c0e;
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}
.arrow:hover {
  background: var(--sect-accent-text);
}
.avatars {
  display: flex;
  gap: 10px;
  width: 304px;
  padding: 4px 2px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}
.avatars::-webkit-scrollbar {
  display: none;
}
.avatar {
  flex: none;
  width: 64px;
  height: 64px;
  padding: 0;
  overflow: hidden;
  border-radius: 50%;
  border: 3px solid transparent;
  background: #1c222b;
  scroll-snap-align: center;
  transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar:hover {
  border-color: var(--vp-c-border);
}
.avatar.on {
  border-color: var(--sect-accent-text);
  transform: scale(1.06);
  box-shadow: 0 0 16px rgba(59, 130, 246, 0.6);
}
.toggle {
  position: absolute;
  z-index: 3;
  right: 36px;
  bottom: 48px;
  width: 56px;
  height: 104px;
  padding: 0;
  border-radius: 999px;
  background: rgba(17, 20, 24, 0.88);
  border: 1px solid var(--vp-c-border);
}
.lbl {
  position: absolute;
  left: 0;
  right: 0;
  font-family: var(--sect-font-label);
  font-size: 12px;
  color: var(--vp-c-text-3);
}
.lbl.top {
  top: 10px;
}
.lbl.bottom {
  bottom: 10px;
}
.knob {
  position: absolute;
  left: 5px;
  top: 53px;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--vp-c-text-1);
  color: #0a0c0e;
  font-family: var(--sect-font-label);
  font-size: 15px;
  transition: top 0.25s;
}
.toggle.is3d .knob {
  top: 5px;
  background: var(--sect-accent-text);
}

/* transitions */
.swap-enter-active,
.swap-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.swap-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.swap-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.figure-enter-active,
.figure-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.figure-enter-from {
  opacity: 0;
  transform: translateX(40px);
}
.figure-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}

/* phones and small tablets: figure on top, text below, rail full width */
@media (max-width: 859px) {
  .stage {
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .ghost {
    left: 20px;
    top: 20px;
  }
  .figure {
    position: relative;
    order: 1;
    right: auto;
    bottom: auto;
    align-self: center;
    height: 300px;
    max-width: 90%;
    margin-top: 24px;
  }
  .info {
    order: 2;
    width: auto;
    padding: 12px 20px 16px;
  }
  .picker {
    position: relative;
    order: 3;
    left: auto;
    bottom: auto;
    margin: 0 12px 16px;
  }
  .avatars {
    width: auto;
    flex: 1;
  }
  .toggle {
    top: 24px;
    right: 16px;
    bottom: auto;
  }
}
@media (prefers-reduced-motion: reduce) {
  .stage,
  .avatar,
  .knob {
    transition: none;
  }
  .swap-enter-active,
  .swap-leave-active,
  .figure-enter-active,
  .figure-leave-active {
    transition: none;
  }
}
</style>
