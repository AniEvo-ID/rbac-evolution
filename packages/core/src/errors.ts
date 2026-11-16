export type RbacErrorCode =
  | 'PERMISSION_DOES_NOT_EXIST'
  | 'PERMISSION_ALREADY_EXISTS'
  | 'ROLE_DOES_NOT_EXIST'
  | 'ROLE_ALREADY_EXISTS'
  | 'GUARD_DOES_NOT_MATCH'
  | 'TEAM_DOES_NOT_MATCH'
  | 'TEAMS_NOT_ENABLED'
  | 'INVALID_NAME'
  | 'INVALID_WILDCARD_PERMISSION'
  | 'INVALID_SYNC_DEFINITION'
  | 'ADAPTER_METHOD_MISSING'

export class RbacError extends Error {
  readonly code: RbacErrorCode

  constructor(code: RbacErrorCode, message: string) {
    super(message)
    this.name = new.target.name
    this.code = code
  }
}

export class PermissionDoesNotExist extends RbacError {
  constructor(name: string, guardName: string) {
    super('PERMISSION_DOES_NOT_EXIST', `There is no permission named \`${name}\` for guard \`${guardName}\`.`)
  }
}

export class PermissionAlreadyExists extends RbacError {
  constructor(name: string, guardName: string) {
    super('PERMISSION_ALREADY_EXISTS', `A permission \`${name}\` already exists for guard \`${guardName}\`.`)
  }
}

export class RoleDoesNotExist extends RbacError {
  constructor(name: string, guardName: string) {
    super('ROLE_DOES_NOT_EXIST', `There is no role named \`${name}\` for guard \`${guardName}\`.`)
  }
}

export class RoleAlreadyExists extends RbacError {
  constructor(name: string, guardName: string) {
    super('ROLE_ALREADY_EXISTS', `A role \`${name}\` already exists for guard \`${guardName}\`.`)
  }
}

export class GuardDoesNotMatch extends RbacError {
  constructor(given: string, expected: string) {
    super('GUARD_DOES_NOT_MATCH', `The given role or permission uses guard \`${given}\` instead of \`${expected}\`.`)
  }
}

export class InvalidWildcardPermission extends RbacError {
  constructor(permission: string) {
    super('INVALID_WILDCARD_PERMISSION', `Wildcard permission \`${permission}\` is not valid.`)
  }
}
