// The custom adapter under test (its constructor takes whatever database client it needs).
import { MemoryAdapter } from '@anievo-id/rbac-evolution'

export declare class MyAdapter extends MemoryAdapter {
  constructor(db: unknown)
}
