<script setup lang="ts">
/**
 * "Meet the Sect": a character select. One guardian at a time, an avatar rail to switch, and a mode switch:
 * still 2D art, an animated chibi clip or an animated full-size anime clip.
 */
import { withBase } from 'vitepress'
import { computed, onMounted, ref } from 'vue'
import { mascots } from '../mascots'

const index = ref(0)
type Mode = 'still' | 'chibi' | 'anime'
const modes: { id: Mode; label: string }[] = [
  { id: 'still', label: '2D' },
  { id: 'chibi', label: 'Chibi' },
  { id: 'anime', label: 'Anime' },
]
const mode = ref<Mode>('still')
const rail = ref<HTMLElement>()
const current = computed(() => mascots[index.value]!)
const reducedMotion = ref(false)
onMounted(() => (reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches))

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
          <!-- Animated modes play the action once, then rest on the last frame (the starting pose). -->
          <video
            v-if="mode !== 'still' && !reducedMotion"
            :key="`${current.id}-${mode}`"
            class="figure clip"
            :class="mode"
            :poster="withBase(`/mascots/${current.id}-${mode}.webp`)"
            :aria-label="`${current.name}, the ${current.title}, in action`"
            autoplay
            muted
            playsinline
            preload="auto"
          >
            <!-- Safari: HEVC with alpha; other browsers skip this type and use VP9 with alpha. -->
            <source :src="withBase(`/mascots/${current.id}-${mode}.mov`)" type='video/quicktime; codecs="hvc1"' />
            <source :src="withBase(`/mascots/${current.id}-${mode}.webm`)" type="video/webm" />
          </video>
          <img
            v-else
            :key="`${current.id}-${mode}`"
            class="figure"
            :class="{ clip: mode !== 'still', [mode]: true }"
            :src="withBase(`/mascots/${current.id}${mode === 'still' ? '' : `-${mode}`}.webp`)"
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

        <div class="modes" role="group" aria-label="Art style">
          <button
            v-for="m in modes"
            :key="m.id"
            type="button"
            :aria-pressed="mode === m.id"
            @click="mode = m.id"
          >
            {{ m.label }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.roster {
  /* --gutter: where the 1152px content column starts, so the text lines up with the heading above */
  --gutter: max(24px, calc((100vw - 1152px) / 2));
  padding: 72px 24px 48px;
  /* the stage is wider than the page (100vw incl. scrollbar); clip that sliver instead of scrolling */
  overflow-x: clip;
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
  min-height: 640px;
  /* full bleed: no box, the art and its glow run to the right edge of the screen */
  width: 100vw;
  margin-left: calc(50% - 50vw);
  overflow: hidden;
  background: radial-gradient(45% 75% at 74% 55%, color-mix(in srgb, var(--accent) 32%, transparent), transparent 72%);
  transition: background 0.5s;
}
.ghost {
  position: absolute;
  left: calc(var(--gutter) - 16px);
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
  width: calc(var(--gutter) + min(470px, 40vw));
  padding: 96px 0 160px var(--gutter);
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
  right: max(110px, calc(var(--gutter) - 60px));
  bottom: 36px;
  height: min(580px, 88%);
  width: auto;
  max-width: 48%;
  object-fit: contain;
  object-position: bottom;
  filter: drop-shadow(0 30px 40px rgba(0, 0, 0, 0.5));
}
.picker {
  position: absolute;
  z-index: 3;
  left: var(--gutter);
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
.modes {
  position: absolute;
  z-index: 3;
  right: 40px;
  bottom: 48px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 5px;
  border-radius: 999px;
  background: rgba(17, 20, 24, 0.88);
  border: 1px solid var(--vp-c-border);
}
.modes button {
  min-width: 64px;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  font-family: var(--sect-font-label);
  font-size: 13px;
  color: var(--vp-c-text-2);
  transition: background 0.2s, color 0.2s;
}
.modes button:hover {
  color: var(--vp-c-text-1);
}
.modes button[aria-pressed='true'] {
  background: var(--vp-c-text-1);
  color: #0a0c0e;
}
/* Animated clips carry empty space for the action; give them more room so nothing gets cut. */
.figure.clip {
  /* wide clips (fire, wind, cranes) stop at the text column: viewport minus .info width, right offset and a gap */
  max-width: min(980px, calc(100vw - var(--gutter) - min(470px, 40vw) - max(40px, calc(var(--gutter) - 140px)) - 16px));
  right: max(40px, calc(var(--gutter) - 140px));
  bottom: 20px;
}
.figure.anime {
  height: min(640px, 96%);
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
    order: 3;
    width: auto;
    padding: 12px var(--gutter) 16px;
  }
  .picker {
    position: relative;
    order: 4;
    left: auto;
    bottom: auto;
    margin: 0 12px 16px;
  }
  .avatars {
    width: auto;
    flex: 1;
  }
  /* phones: the style switch sits under the art instead of on top of it */
  .modes {
    position: relative;
    order: 2;
    right: auto;
    bottom: auto;
    align-self: center;
    flex-direction: row;
    margin-top: 8px;
  }
  .figure.clip {
    max-width: 100%;
    height: 320px;
    right: auto;
    bottom: auto;
  }
}
@media (prefers-reduced-motion: reduce) {
  .stage,
  .avatar,
  .modes button {
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
