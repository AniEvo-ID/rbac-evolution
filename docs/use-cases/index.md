# Use cases

The other pages explain one feature at a time. These pages go the other way: they start from a kind of app and
show the whole setup for it. Each one covers the roles, the seed, how users get their roles, the route guards in
one framework, the edge cases of that app, and a test.

Pick the one closest to your app. Most real apps are a mix, for example a SaaS with a public API.

| App | Features | Integration | Page |
| --- | --- | --- | --- |
| Blog / CMS with writers, editors, moderators and admins | Ownership checks ("edit own post"), `'*'` in the seed, `before` hook for banned users, typed names | Express, Vue `v-can` | [Blog / CMS](/use-cases/blog-cms) |
| B2B SaaS where a user has a different role in each organization | Teams, invites, switching organization, stacked roles, typed names | Next.js, React `<Can>` | [B2B SaaS](/use-cases/saas-multi-tenant) |
| E-commerce back office for warehouse, cashier, support and manager | Wildcard permissions (`orders.*`), refund limits, typed names with wildcards | NestJS, Vue `v-can` | [E-commerce back office](/use-cases/ecommerce-admin) |
| Public REST API where API keys get scopes | Multiple guards (`web` and `api`), direct permissions, preset roles, `exposeRequirements` | Hono | [Public API](/use-cases/public-api) |
| Company admin panel with read-only support and temporary access | Super-admin (`superAdminRoles`), `before` hook, direct permissions that expire, events | Fastify, React `<Can>` | [Internal admin panel](/use-cases/internal-tools) |

Every page has the same sections:

1. **The app**: what it does and who uses it.
2. **Roles and permissions**: a table of roles and permissions, and why it is split that way.
3. **Seed it**: the definition for `rbac.sync()`, with typed names.
4. **Assign roles**: sign-up, invites, promotion, and so on.
5. **Guard the routes**: server guards, plus the UI where the app has one.
6. **Edge cases**: the things that are specific to this kind of app.
7. **Test it**: a Vitest test with the in-memory adapter.

::: tip Start from the principles
All five pages follow the same rule: check **permissions** in code, hand them out with **roles**. If you haven't
read it yet, [Roles vs permissions](/best-practices/roles-vs-permissions) explains why.
:::

For a single feature in more depth, see the [recipes](/recipes/multi-tenant) and the
[Basic usage](/basic-usage/basic-usage) pages.
