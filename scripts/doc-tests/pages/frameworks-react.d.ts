// React guide: the server side is an Express app (with the Express package's `req.rbac`).
/// <reference types="@anievo-id/rbac-evolution-express" />
declare const rbac: Rbac
declare const app: import('express').Express
declare function App(): React.JSX.Element
declare const useRbac: typeof import('@anievo-id/rbac-evolution-react').useRbac
/** A navigation menu, some items behind a permission. */
declare const menu: { label: string; href: string; permission?: string }[]
