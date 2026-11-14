import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { h } from 'vue'
import BoundFormations from './components/BoundFormations.vue'
import FeatureRows from './components/FeatureRows.vue'
import GridPulse from './components/GridPulse.vue'
import HomeCta from './components/HomeCta.vue'
import HomeHero from './components/HomeHero.vue'
import MotionLayer from './components/MotionLayer.vue'
import NotFound from './components/NotFound.vue'
import PageGuide from './components/PageGuide.vue'
import SectRoster from './components/SectRoster.vue'
import './style.css'

export default {
  extends: DefaultTheme,
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
