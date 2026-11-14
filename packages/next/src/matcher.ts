const cache = new Map<string, RegExp>()

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Compiles a Next.js-style path pattern to a RegExp.
 *
 * - `/admin` matches `/admin` (and `/admin/`)
 * - `/users/:id` matches one segment
 * - `/admin/:path*` matches `/admin`, `/admin/a`, `/admin/a/b`
 * - `/admin/:path+` matches `/admin/a`, `/admin/a/b` (not `/admin`)
 * - `/blog/:slug?` matches `/blog` and `/blog/x`
 */
export function compilePathPattern(pattern: string): RegExp {
  const hit = cache.get(pattern)
  if (hit) return hit

  let source = ''
  for (const segment of pattern.split('/')) {
    if (segment === '') continue
    const param = /^:[A-Za-z_][A-Za-z0-9_]*([*+?])?$/.exec(segment)
    if (!param) {
      source += `/${escape(segment)}`
      continue
    }
    switch (param[1]) {
      case '*':
        source += '(?:/[^/]+)*'
        break
      case '+':
        source += '(?:/[^/]+)+'
        break
      case '?':
        source += '(?:/[^/]+)?'
        break
      default:
        source += '/[^/]+'
    }
  }
  const regex = new RegExp(`^${source}/?$`)
  cache.set(pattern, regex)
  return regex
}

export type PathMatcher = string | RegExp | readonly (string | RegExp)[]

function testOne(matcher: string | RegExp, pathname: string): boolean {
  if (typeof matcher === 'string') return compilePathPattern(matcher).test(pathname || '/')
  matcher.lastIndex = 0 // a /g or /y RegExp keeps state between test() calls
  return matcher.test(pathname)
}

const decode = (pathname: string): string => {
  try {
    return decodeURI(pathname)
  } catch {
    return pathname
  }
}

/**
 * `true` if the pathname matches the pattern (or any of the patterns). Both the raw and the
 * percent-decoded pathname are tried, so `/%61dmin` is protected by a rule for `/admin`.
 */
export function matchPath(matcher: PathMatcher, pathname: string): boolean {
  const candidates = [pathname, decode(pathname)]
  const list = typeof matcher === 'string' || matcher instanceof RegExp ? [matcher] : matcher
  return list.some((m) => candidates.some((p) => testOne(m, p)))
}
