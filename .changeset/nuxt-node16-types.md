---
'@anievo-id/rbac-evolution-nuxt': patch
---

Types now resolve under `moduleResolution: "node16"` / `"nodenext"`. The declaration files imported their siblings without a `.js` extension (`'./runtime/rule'`), which those settings can't resolve, so `RbacRouteRule`, `RouteRuleResult`, `NuxtRbac` and `RbacPublicConfig` silently became `any` and a wrong `rbac` route rule type-checked. Found by the new package lint (publint and arethetypeswrong) that now runs in CI.
