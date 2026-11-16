// `@/auth`: Auth.js v5's `auth.ts`.
import NextAuth from 'next-auth'

export const { handlers, auth, signIn, signOut } = NextAuth({ providers: [] })
