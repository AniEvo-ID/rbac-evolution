/** Injection token for the resolved {@link RbacModuleOptions}. */
export const RBAC_MODULE_OPTIONS = Symbol.for('rbac-evolution:nestjs:options')

/** Injection token for the `Rbac` engine passed to `RbacModule.forRoot({ rbac })`. */
export const RBAC = Symbol.for('rbac-evolution:nestjs:rbac')

/** Metadata key under which `@Require*` decorators store their requirements. */
export const RBAC_REQUIREMENTS = 'rbac-evolution:requirements'
