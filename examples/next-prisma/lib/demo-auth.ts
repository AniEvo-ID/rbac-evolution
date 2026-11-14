// Fake authentication: the "session" is a cookie holding a demo user id.
// Swap this for Auth.js, Clerk, Lucia, iron-session, ... in a real app.

export const SESSION_COOKIE = 'demo_user'

export function parseUserId(value: string | undefined): number | null {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}
