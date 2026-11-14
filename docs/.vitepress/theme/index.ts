import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { h } from 'vue'
import HeroCast from './components/HeroCast.vue'
import NotFound from './components/NotFound.vue'
import PageGuide from './components/PageGuide.vue'
import SectRoster from './components/SectRoster.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'home-hero-image': () => h(HeroCast),
      'home-features-after': () => h(SectRoster),
      'aside-outline-after': () => h(PageGuide, { placement: 'aside' }),
      'doc-footer-before': () => h(PageGuide, { placement: 'footer' }),
      'not-found': () => h(NotFound),
    }),
} satisfies Theme
