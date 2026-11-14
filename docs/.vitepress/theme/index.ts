import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { h } from 'vue'
import BoundFormations from './components/BoundFormations.vue'
import EvolutionPath from './components/EvolutionPath.vue'
import HeroBackdrop from './components/HeroBackdrop.vue'
import HeroCast from './components/HeroCast.vue'
import HeroExtras from './components/HeroExtras.vue'
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
      'home-hero-before': () => h(HeroBackdrop),
      'home-hero-info-before': () => h(HeroExtras, { part: 'status' }),
      'home-hero-actions-after': () => h(HeroExtras, { part: 'install' }),
      'home-hero-image': () => h(HeroCast),
      'home-features-before': () => h(BoundFormations),
      'home-features-after': () => [h(EvolutionPath), h(SectRoster)],
      'aside-outline-after': () => h(PageGuide, { placement: 'aside' }),
      'doc-footer-before': () => h(PageGuide, { placement: 'footer' }),
      'not-found': () => h(NotFound),
    }),
} satisfies Theme
