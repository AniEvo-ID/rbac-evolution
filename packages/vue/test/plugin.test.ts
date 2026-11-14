import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  createRbacPlugin,
  useCan,
  useCanAll,
  useCanAny,
  useHasAnyRole,
  useHasRole,
  useRbac,
  type RbacPluginOptions,
} from '../src'

const writer = { roles: ['writer'], permissions: ['edit articles', 'publish articles'] }

function setup(template: string, options: RbacPluginOptions = { snapshot: writer }, setupFn?: () => object) {
  const rbac = createRbacPlugin(options)
  const wrapper = mount(defineComponent({ template, setup: setupFn ?? (() => ({})) }), {
    global: { plugins: [rbac] },
  })
  return { rbac, wrapper }
}

const visible = (el: Element | undefined) => (el as HTMLElement | undefined)?.style.display !== 'none'

describe('directives', () => {
  it('hides elements whose bound value is undefined or null (a typo must not show them)', () => {
    const { wrapper } = setup(
      `<div>
        <button id="u" v-can="cfg.missing">U</button>
        <button id="n" v-can.any="null">N</button>
        <button id="r" v-role="cfg.missing">R</button>
      </div>`,
      { snapshot: { roles: ['admin'], permissions: ['edit articles'] }, superAdminRoles: ['admin'] },
      () => ({ cfg: {} }),
    )
    for (const id of ['u', 'n', 'r']) expect(visible(wrapper.find(`#${id}`).element)).toBe(false)
  })

  it('v-can hides elements and reacts to setSnapshot', async () => {
    const { rbac, wrapper } = setup(`
      <div>
        <button id="edit" v-can="'edit articles'">Edit</button>
        <button id="delete" v-can="'delete articles'">Delete</button>
        <button id="any" v-can.any="['delete articles', 'edit articles']">Any</button>
        <button id="all" v-can.all="['delete articles', 'edit articles']">All</button>
        <span id="not" v-can.not="'delete articles'">Read-only</span>
        <span id="styled" style="display: inline-block" v-can="'edit articles'">Styled</span>
      </div>`)

    const el = (id: string) => wrapper.find(`#${id}`).element
    expect(visible(el('edit'))).toBe(true)
    expect(visible(el('delete'))).toBe(false)
    expect(visible(el('any'))).toBe(true)
    expect(visible(el('all'))).toBe(false)
    expect(visible(el('not'))).toBe(true)
    expect((el('styled') as HTMLElement).style.display).toBe('inline-block')

    rbac.setSnapshot({ roles: [], permissions: ['delete articles', 'edit articles'] })
    await nextTick()
    expect(visible(el('delete'))).toBe(true)
    expect(visible(el('all'))).toBe(true)
    expect(visible(el('not'))).toBe(false)

    rbac.setSnapshot(null)
    await nextTick()
    expect(visible(el('edit'))).toBe(false)
    expect(visible(el('any'))).toBe(false)
    expect((el('styled') as HTMLElement).style.display).toBe('none')

    rbac.setSnapshot(writer)
    await nextTick()
    expect((el('styled') as HTMLElement).style.display).toBe('inline-block')
  })

  it('v-can re-evaluates when the bound value changes', async () => {
    const perm = ref('edit articles')
    const { wrapper } = setup(`<div><b v-can="perm">x</b></div>`, { snapshot: writer }, () => ({ perm }))
    expect(visible(wrapper.find('b').element)).toBe(true)
    perm.value = 'delete articles'
    await nextTick()
    expect(visible(wrapper.find('b').element)).toBe(false)
  })

  it('v-role supports any (default), pipes, .all and .not', async () => {
    const { rbac, wrapper } = setup(`
      <div>
        <i id="admin" v-role="'admin'" />
        <i id="pipe" v-role="'admin|writer'" />
        <i id="list" v-role="['admin', 'writer']" />
        <i id="all" v-role.all="['admin', 'writer']" />
        <i id="not" v-role.not="'admin'" />
      </div>`)
    const el = (id: string) => wrapper.find(`#${id}`).element
    expect(visible(el('admin'))).toBe(false)
    expect(visible(el('pipe'))).toBe(true)
    expect(visible(el('list'))).toBe(true)
    expect(visible(el('all'))).toBe(false)
    expect(visible(el('not'))).toBe(true)

    rbac.setSnapshot({ roles: ['admin', 'writer'], permissions: [] })
    await nextTick()
    expect(visible(el('admin'))).toBe(true)
    expect(visible(el('all'))).toBe(true)
    expect(visible(el('not'))).toBe(false)
  })

  it('stops watching after unmount', async () => {
    const show = ref(true)
    const { rbac, wrapper } = setup(`<div><b v-if="show" v-can="'edit articles'">x</b></div>`, { snapshot: writer }, () => ({ show }))
    expect(wrapper.find('b').exists()).toBe(true)
    show.value = false
    await nextTick()
    expect(() => rbac.setSnapshot(null)).not.toThrow()
    show.value = true
    await nextTick()
    expect(visible(wrapper.find('b').element)).toBe(false)
  })
})

describe('components', () => {
  it('<Can> renders default or #fallback slot reactively', async () => {
    const { rbac, wrapper } = setup(`
      <div>
        <Can permission="edit articles"><p id="a">edit</p></Can>
        <Can permission="delete articles"><p id="b">delete</p><template #fallback><p id="b-fb">no</p></template></Can>
        <Can :any-of="['delete articles', 'publish articles']"><p id="c">any</p></Can>
        <Can :all-of="['delete articles', 'publish articles']"><p id="d">all</p></Can>
        <Can permission="delete articles" not><p id="e">not</p></Can>
        <Can><p id="f">nothing to check</p></Can>
      </div>`)
    const has = (id: string) => wrapper.find(`#${id}`).exists()
    expect(has('a')).toBe(true)
    expect(has('b')).toBe(false)
    expect(has('b-fb')).toBe(true)
    expect(has('c')).toBe(true)
    expect(has('d')).toBe(false)
    expect(has('e')).toBe(true)
    expect(has('f')).toBe(false)

    rbac.setSnapshot({ roles: [], permissions: ['delete articles', 'publish articles'] })
    await nextTick()
    expect(has('a')).toBe(false)
    expect(has('b')).toBe(true)
    expect(has('b-fb')).toBe(false)
    expect(has('d')).toBe(true)
    expect(has('e')).toBe(false)
  })

  it('<HasRole> supports role, any-of, all-of and fallback', async () => {
    const { rbac, wrapper } = setup(`
      <div>
        <HasRole role="writer"><p id="a" /></HasRole>
        <HasRole role="admin|editor"><p id="b" /><template #fallback><p id="b-fb" /></template></HasRole>
        <HasRole :all-of="['writer', 'admin']"><p id="c" /></HasRole>
      </div>`)
    const has = (id: string) => wrapper.find(`#${id}`).exists()
    expect(has('a')).toBe(true)
    expect(has('b')).toBe(false)
    expect(has('b-fb')).toBe(true)
    expect(has('c')).toBe(false)

    rbac.setSnapshot({ roles: ['writer', 'admin'], permissions: [] })
    await nextTick()
    expect(has('b')).toBe(true)
    expect(has('c')).toBe(true)
  })
})

describe('global properties', () => {
  it('exposes $can / $hasRole in templates', async () => {
    const { rbac, wrapper } = setup(`
      <div>
        <p v-if="$can('edit articles')" id="a" />
        <p v-if="$canAny(['x', 'publish articles'])" id="b" />
        <p v-if="$hasRole('admin')" id="c" />
        <p v-if="$rbac.isSuperAdmin()" id="d" />
      </div>`)
    expect(wrapper.find('#a').exists()).toBe(true)
    expect(wrapper.find('#b').exists()).toBe(true)
    expect(wrapper.find('#c').exists()).toBe(false)
    rbac.setSnapshot({ roles: ['admin'], permissions: [] })
    await nextTick()
    expect(wrapper.find('#a').exists()).toBe(false)
    expect(wrapper.find('#c').exists()).toBe(true)
  })

  it('can be disabled', () => {
    const { wrapper } = setup(`<p>{{ typeof $can }}</p>`, { snapshot: writer, globalProperties: false })
    expect(wrapper.text()).toBe('undefined')
  })
})

describe('composables', () => {
  it('return reactive computed refs', async () => {
    const perm = ref('edit articles')
    let api!: ReturnType<typeof useRbac>
    const Comp = defineComponent({
      setup() {
        api = useRbac()
        const canEdit = useCan(perm)
        const canAny = useCanAny(['x', 'publish articles'])
        const canAll = useCanAll(() => ['edit articles', 'x'])
        const isWriter = useHasRole('writer')
        const isStaff = useHasAnyRole(['admin', 'editor'])
        return () => h('p', [canEdit.value, canAny.value, canAll.value, isWriter.value, isStaff.value].map(Number).join(''))
      },
    })
    const rbac = createRbacPlugin({ snapshot: writer })
    const wrapper = mount(Comp, { global: { plugins: [rbac] } })
    expect(wrapper.text()).toBe('11010')
    expect(api.can('edit articles')).toBe(true)

    perm.value = 'x'
    await nextTick()
    expect(wrapper.text()).toBe('01010')

    rbac.setSnapshot({ roles: ['editor'], permissions: ['x', 'edit articles'] })
    await nextTick()
    expect(wrapper.text()).toBe('11101')
  })

  it('throws a helpful error without the plugin', () => {
    const Comp = defineComponent({
      setup() {
        useCan('x')
        return () => null
      },
    })
    expect(() => mount(Comp)).toThrow(/createRbacPlugin/)
  })

  it('wildcard and super-admin options apply to components', () => {
    const { wrapper } = setup(
      `<div><Can permission="articles.edit"><p id="a" /></Can><Can permission="users.delete"><p id="b" /></Can></div>`,
      { snapshot: { roles: [], permissions: ['articles.*'] }, wildcard: true },
    )
    expect(wrapper.find('#a').exists()).toBe(true)
    expect(wrapper.find('#b').exists()).toBe(false)

    const admin = setup(`<div><Can permission="users.delete"><p id="b" /></Can></div>`, {
      snapshot: { roles: ['root'], permissions: [] },
      superAdminRoles: ['root'],
    })
    expect(admin.wrapper.find('#b').exists()).toBe(true)
  })
})
