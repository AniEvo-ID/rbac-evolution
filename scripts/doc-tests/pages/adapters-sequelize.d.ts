declare const rbac: Rbac
declare const sequelize: import('sequelize').Sequelize
/** The app's own model. */
declare const User: { create(values: { email: string }, options?: object): Promise<{ id: number }> }
