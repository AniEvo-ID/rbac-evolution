# @anievo-id/rbac-evolution-vue

Vue 3 bindings for [RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution): `v-can` and `v-role`, `<Can>` and
`<HasRole>`, composables and `$can()`, the counterpart of spatie's `@can` and `@role` Blade directives.

> **UI only.** Everything in this package runs in the browser and only decides what the UI shows. Always check
> permissions on the server too.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-vue vue
```

## Usage

```ts
import { createApp } from 'vue'
import { createRbacPlugin } from '@anievo-id/rbac-evolution-vue'

// the snapshot comes from the server: await rbac.for(user).snapshot(), or null for guests
export const rbac = createRbacPlugin({
  snapshot: await fetch('/api/me/permissions').then((r) => r.json()),
  wildcard: true, // must mirror createRbac({ wildcard })
})

createApp(App).use(rbac).mount('#app')

rbac.setSnapshot(null) // after logout; everything re-renders
```

```vue
<button v-can="'edit articles'">Edit</button>
<a v-role="'admin|editor'">Staff</a>
<Can permission="publish articles"><PublishButton /></Can>
```

`v-can` hides the element with `display: none`. Use `v-if="$can(...)"` or `<Can>` to keep it out of the DOM.

## Documentation

https://creation.anievo.id/rbac-evolution/frameworks/vue

## License

MIT
