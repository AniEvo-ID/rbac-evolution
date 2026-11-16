// Stub: a copy of the `src/policies.ts` block of docs/use-cases/ecommerce-admin.md.
import type { SubjectRbac } from '@anievo-id/rbac-evolution'

/** Refunds above this amount need `orders.refund.large`. */
export const LARGE_REFUND_CENTS = 100_00

export async function canRefund(access: SubjectRbac, amountCents: number): Promise<boolean> {
  return access.can(amountCents > LARGE_REFUND_CENTS ? 'orders.refund.large' : 'orders.refund.small')
}
