// Admin UI recipe: the snippets continue `admin.ts` of "The router" (Express 5, with the Express
// package's `req.rbac`).
/// <reference types="@anievo-id/rbac-evolution-express" />
declare const rbac: Rbac
declare const express: typeof import('express')
declare namespace express {
  type Request = import('express').Request
  type Response = import('express').Response
  type NextFunction = import('express').NextFunction
}
declare const admin: import('express').Router
declare const user: (id: string) => SubjectRbac
// From "Validation and errors".
declare const PROTECTED_ROLES: Set<string>
declare function stringList(value: unknown): string[]
