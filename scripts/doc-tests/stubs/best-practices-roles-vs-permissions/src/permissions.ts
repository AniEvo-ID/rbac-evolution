// `lib/permissions.ts` (the block before).
export const Permissions = {
  ArticlesView: 'articles.view',
  ArticlesEdit: 'articles.edit',
  ArticlesPublish: 'articles.publish',
} as const

export type PermissionName = (typeof Permissions)[keyof typeof Permissions]
