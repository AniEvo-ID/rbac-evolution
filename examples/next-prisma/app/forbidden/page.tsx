import Link from 'next/link'

export default function ForbiddenPage() {
  return (
    <>
      <h1>403 — Forbidden</h1>
      <p>You are logged in, but your roles don't allow this page.</p>
      <p>
        <Link href="/login">Log in as someone else</Link>
      </p>
    </>
  )
}
