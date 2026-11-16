/// <reference types="vitest/globals" />
// Test files with Vitest globals (`it`, `expect`) and the helpers defined in the page's earlier blocks.

/** `makeRbac()` of `test/rbac.ts` (first block). */
declare const makeRbac: typeof import('../src/test/rbac').makeRbac
/** `deleteArticle()` of `articles.ts` ("Injecting the engine"). */
declare function deleteArticle(rbac: Rbac, user: Subject, articleId: number): Promise<void>
declare const runAdapterTests: typeof import('@anievo-id/rbac-evolution/testing').runAdapterTests
/** The adapter factory passed to `runAdapterTests`. */
declare const factory: () => RbacAdapter | Promise<RbacAdapter>
