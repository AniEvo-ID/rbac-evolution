import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { createRbacPlugin, createRbacState } from '../src'

const superAdmin = { roles: ['super-admin'], permissions: [], denied: ['audit-log.delete'] }

describe('snapshot.denied (before hooks)', () => {
  it('denies the listed names even to a super-admin', () => {
    const rbac = createRbacState({ snapshot: superAdmin, superAdminRoles: ['super-admin'] })
    expect(rbac.isSuperAdmin()).toBe(true)
    expect(rbac.can('audit-log.delete')).toBe(false)
    expect(rbac.can(' audit-log.delete ')).toBe(false)
    expect(rbac.cannot('audit-log.delete')).toBe(true)
    expect(rbac.can('flags.manage')).toBe(true)
    expect(rbac.canAny(['audit-log.delete', 'flags.manage'])).toBe(true)
    expect(rbac.canAny(['audit-log.delete'])).toBe(false)
    expect(rbac.canAll(['audit-log.delete', 'flags.manage'])).toBe(false)
    expect(rbac.canAny([])).toBe(false)
  })

  it('wins over stored grants and wildcards, but matches exact names only', () => {
    const rbac = createRbacState({
      snapshot: { roles: [], permissions: ['audit-log.*'], denied: [' audit-log.delete'] },
      wildcard: true,
    })
    expect(rbac.can('audit-log.delete')).toBe(false)
    expect(rbac.can('audit-log.delete.own')).toBe(true)
    expect(rbac.can('audit-log.view')).toBe(true)
    expect(rbac.snapshot.value.denied).toEqual(['audit-log.delete'])
  })

  it('behaves as before for snapshots without `denied`, and setSnapshot() replaces it', () => {
    const rbac = createRbacState({ snapshot: { roles: ['super-admin'], permissions: [] }, superAdminRoles: ['super-admin'] })
    expect('denied' in rbac.snapshot.value).toBe(false)
    expect(rbac.can('audit-log.delete')).toBe(true)
    rbac.setSnapshot(superAdmin)
    expect(rbac.can('audit-log.delete')).toBe(false)
    rbac.setSnapshot({ roles: ['super-admin'], permissions: [] })
    expect(rbac.can('audit-log.delete')).toBe(true)
  })

  it('reaches v-can and <Can> reactively', async () => {
    const rbac = createRbacPlugin({ snapshot: { roles: ['super-admin'], permissions: [] }, superAdminRoles: ['super-admin'] })
    const wrapper = mount(
      defineComponent({
        template: `
          <div>
            <Can permission="audit-log.delete"><p id="can">delete</p><template #fallback><p id="fb">no</p></template></Can>
            <button id="dir" v-can="'audit-log.delete'">delete</button>
            <p id="flags" v-if="$can('flags.manage')">flags</p>
          </div>`,
      }),
      { global: { plugins: [rbac] } },
    )
    const has = (id: string) => wrapper.find(`#${id}`).exists()
    const shown = () => (wrapper.find('#dir').element as HTMLElement).style.display !== 'none'
    expect(has('can')).toBe(true)
    expect(shown()).toBe(true)

    rbac.setSnapshot(superAdmin)
    await nextTick()
    expect(has('can')).toBe(false)
    expect(has('fb')).toBe(true)
    expect(shown()).toBe(false)
    expect(has('flags')).toBe(true)
  })
})
