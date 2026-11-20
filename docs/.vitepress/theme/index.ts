import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { h } from 'vue'
import BoundFormations from './components/BoundFormations.vue'
import E2eReport from './components/E2eReport.vue'
import FeatureRows from './components/FeatureRows.vue'
import GridPulse from './components/GridPulse.vue'
import HomeCta from './components/HomeCta.vue'
import HomeHero from './components/HomeHero.vue'
import MermaidDiagram from './components/MermaidDiagram.vue'
import MotionLayer from './components/MotionLayer.vue'
import NotFound from './components/NotFound.vue'
import PageActions from './components/PageActions.vue'
import PageGuide from './components/PageGuide.vue'
import QualityReport from './components/QualityReport.vue'
import ReleaseSync from './components/ReleaseSync.vue'
import SectRoster from './components/SectRoster.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('QualityReport', QualityReport)
    app.component('E2eReport', E2eReport)
    app.component('ReleaseSync', ReleaseSync)
    app.component('MermaidDiagram', MermaidDiagram)
    app.component('PageActions', PageActions)
  },
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'layout-top': () => h(MotionLayer),
      // The home page is fully custom (index.md has no hero/features frontmatter).
      'home-hero-before': () => [h(GridPulse), h(HomeHero), h(BoundFormations), h(FeatureRows), h(SectRoster), h(HomeCta)],
      'aside-outline-after': () => h(PageGuide, { placement: 'aside' }),
      'doc-footer-before': () => h(PageGuide, { placement: 'footer' }),
      'not-found': () => h(NotFound),
    }),
} satisfies Theme
