<script setup lang="ts">
// Renders a ```mermaid fence (see `mermaidFence` in ../../config.ts).
// Client only: the server build prints the diagram source as a <pre>, and the browser swaps it for an SVG.
// `mermaid` is a dynamic import, so its chunk is only downloaded by pages that have a diagram.
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ code: string }>()

const source = decodeURIComponent(props.code)
const svg = ref('')
const failed = ref(false)

// Colors follow the docs theme (style.css). The site is dark only today, but a light set is kept so the
// diagrams follow the `dark` class on <html> if a theme switch is ever turned on.
const palettes = {
  dark: {
    darkMode: true,
    background: '#0a0c0e',
    primaryColor: '#111418',
    primaryTextColor: '#e8eaed',
    primaryBorderColor: '#3b82f6',
    secondaryColor: '#0d1726',
    tertiaryColor: '#161a20',
    lineColor: '#7b8491',
    textColor: '#e8eaed',
    mainBkg: '#111418',
    nodeBorder: '#3b82f6',
    clusterBkg: '#0d1014',
    clusterBorder: '#2b333d',
    edgeLabelBackground: '#0a0c0e',
    actorBkg: '#111418',
    actorBorder: '#3b82f6',
    actorTextColor: '#e8eaed',
    actorLineColor: '#2b333d',
    signalColor: '#a3abb6',
    signalTextColor: '#e8eaed',
    labelBoxBkgColor: '#161a20',
    labelBoxBorderColor: '#2b333d',
    labelTextColor: '#e8eaed',
    loopTextColor: '#e8eaed',
    noteBkgColor: '#0d1726',
    noteBorderColor: '#3b82f6',
    noteTextColor: '#e8eaed',
    activationBkgColor: '#161a20',
    activationBorderColor: '#60a5fa',
    attributeBackgroundColorOdd: '#111418',
    attributeBackgroundColorEven: '#0d1014',
  },
  light: {
    darkMode: false,
    background: '#ffffff',
    primaryColor: '#eff6ff',
    primaryTextColor: '#1f2328',
    primaryBorderColor: '#2563eb',
    secondaryColor: '#f6f8fa',
    tertiaryColor: '#f6f8fa',
    lineColor: '#57606a',
    textColor: '#1f2328',
    mainBkg: '#eff6ff',
    nodeBorder: '#2563eb',
    clusterBkg: '#f6f8fa',
    clusterBorder: '#d0d7de',
    edgeLabelBackground: '#ffffff',
    actorBkg: '#eff6ff',
    actorBorder: '#2563eb',
    actorTextColor: '#1f2328',
    actorLineColor: '#d0d7de',
    signalColor: '#57606a',
    signalTextColor: '#1f2328',
    labelBoxBkgColor: '#f6f8fa',
    labelBoxBorderColor: '#d0d7de',
    labelTextColor: '#1f2328',
    loopTextColor: '#1f2328',
    noteBkgColor: '#fff8c5',
    noteBorderColor: '#d4a72c',
    noteTextColor: '#1f2328',
    activationBkgColor: '#f6f8fa',
    activationBorderColor: '#2563eb',
    attributeBackgroundColorOdd: '#ffffff',
    attributeBackgroundColorEven: '#f6f8fa',
  },
}

let counter = 0
let observer: MutationObserver | undefined
let renderedDark: boolean | undefined

async function render(): Promise<void> {
  const dark = document.documentElement.classList.contains('dark')
  if (dark === renderedDark) return
  renderedDark = dark
  const { default: mermaid } = await import('mermaid')
  // Mermaid measures label text when it renders, so the web font must be loaded first, or labels get clipped.
  await document.fonts.ready
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--vp-font-family-base').trim(),
    themeVariables: dark ? palettes.dark : palettes.light,
  })
  try {
    const id = `mermaid-${Math.random().toString(36).slice(2)}-${counter++}`
    svg.value = (await mermaid.render(id, source)).svg
    failed.value = false
  } catch (error) {
    console.error('[docs] Mermaid diagram failed to render', error)
    failed.value = true
  }
}

onMounted(() => {
  void render()
  observer = new MutationObserver(() => void render())
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="mermaid-diagram" :class="{ 'is-rendered': svg && !failed }">
    <div v-if="svg && !failed" class="mermaid-diagram__svg" v-html="svg" />
    <pre v-else class="mermaid-diagram__source"><code>{{ source }}</code></pre>
  </div>
</template>

<style scoped>
.mermaid-diagram {
  margin: 16px 0;
  overflow-x: auto;
}
.mermaid-diagram.is-rendered {
  padding: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}
.mermaid-diagram__svg {
  display: flex;
  justify-content: center;
}
/* Mermaid measures labels outside the page, with the body's text styles. Undo the .vp-doc paragraph styles
   inside the diagram, so the labels have the size they were measured with. */
.mermaid-diagram__svg {
  font-size: 16px;
  line-height: 24px;
}
.mermaid-diagram__svg :deep(p) {
  margin: 0;
  line-height: inherit;
}
.mermaid-diagram__svg :deep(svg) {
  max-width: 100%;
  height: auto;
}
.mermaid-diagram__source {
  margin: 0;
  padding: 16px;
  border-radius: 8px;
  background: var(--vp-code-block-bg);
  font-size: 13px;
  line-height: 1.5;
  white-space: pre;
}
</style>
