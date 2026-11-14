import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { rbac } from './session'
import './style.css'

// rbac registers v-can / v-role, <Can> / <HasRole> and $can / $hasRole globally.
createApp(App).use(rbac).use(router).mount('#app')
