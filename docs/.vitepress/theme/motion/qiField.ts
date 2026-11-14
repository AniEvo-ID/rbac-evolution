/**
 * Hero backdrop: rising qi particles that part around the cursor, over a
 * scrolling hologram grid. Loaded lazily (dynamic import) on the home page only.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  NormalBlending,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from 'three'

export interface QiField {
  setDark(dark: boolean): void
  dispose(): void
}

const particleVert = /* glsl */ `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uPixelRatio;
  attribute float aSeed;
  attribute float aSize;
  varying float vSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float speed = 0.25 + aSeed * 0.45;
    p.y = mod(p.y + uTime * speed + 7.0, 14.0) - 7.0;
    p.x += sin(uTime * 0.35 + aSeed * 6.2831) * 0.45;
    p.z += cos(uTime * 0.25 + aSeed * 12.0) * 0.3;
    // Qi parts around the cursor.
    vec2 d = p.xy - uMouse;
    float falloff = exp(-dot(d, d) * 0.35);
    p.xy += normalize(d + 0.0001) * falloff * 1.6;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (26.0 / -mv.z) * (1.0 + falloff * 1.5);
    vSeed = aSeed;
    // Fade in at the bottom and out at the top of the column.
    vAlpha = smoothstep(-7.0, -4.5, p.y) * (1.0 - smoothstep(4.0, 7.0, p.y));
  }
`

const particleFrag = /* glsl */ `
  uniform vec3 uJade;
  uniform vec3 uGold;
  uniform float uTime;
  uniform float uIntensity;
  varying float vSeed;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    if (r > 0.5) discard;
    float core = smoothstep(0.5, 0.0, r);
    float glow = pow(core, 2.4);
    vec3 col = mix(uJade, uGold, step(0.78, vSeed));
    float twinkle = 0.65 + 0.35 * sin(uTime * 2.0 + vSeed * 40.0);
    gl_FragColor = vec4(col, glow * vAlpha * twinkle * uIntensity);
  }
`

const gridVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const gridFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uJade;
  uniform vec3 uGold;
  uniform float uIntensity;
  varying vec2 vUv;
  float line(float v, float w) {
    float f = abs(fract(v) - 0.5);
    return smoothstep(w, 0.0, 0.5 - f);
  }
  void main() {
    vec2 uv = vec2(vUv.x * 36.0, vUv.y * 24.0 - uTime * 0.6);
    float g = max(line(uv.x, 0.04), line(uv.y, 0.05));
    // Fade toward the horizon (vUv.y -> 1) and toward the sides.
    float fade = (1.0 - smoothstep(0.15, 0.95, vUv.y)) * smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
    float horizon = smoothstep(0.75, 0.97, vUv.y) * (1.0 - smoothstep(0.97, 1.0, vUv.y));
    vec3 col = mix(uJade, uGold, horizon);
    gl_FragColor = vec4(col, (g * 0.55 * fade + horizon * 0.08) * uIntensity);
  }
`

const palette = {
  dark: { jade: '#34d3a6', gold: '#e7b75f', particles: 1, grid: 1 },
  light: { jade: '#2bb48c', gold: '#d9a441', particles: 0.55, grid: 0.35 },
}

export function createQiField(canvas: HTMLCanvasElement, opts: { dark: boolean; reducedMotion: boolean }): QiField {
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'low-power' })
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75)
  renderer.setPixelRatio(pixelRatio)

  const scene = new Scene()
  const camera = new PerspectiveCamera(50, 1, 0.1, 60)
  camera.position.set(0, 0, 10)

  const small = window.matchMedia('(max-width: 768px)').matches
  const count = small ? 320 : 1100
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  const sizes = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 26
    positions[i * 3 + 1] = (Math.random() - 0.5) * 14
    positions[i * 3 + 2] = Math.random() * -9 + 3
    seeds[i] = Math.random()
    sizes[i] = 4 + Math.random() * 10
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(positions, 3))
  geo.setAttribute('aSeed', new BufferAttribute(seeds, 1))
  geo.setAttribute('aSize', new BufferAttribute(sizes, 1))

  const mouse = new Vector2(99, 99)
  const target = new Vector2(99, 99)
  const shared = {
    uTime: { value: 0 },
    uJade: { value: new Color() },
    uGold: { value: new Color() },
  }
  const particleMat = new ShaderMaterial({
    vertexShader: particleVert,
    fragmentShader: particleFrag,
    transparent: true,
    depthWrite: false,
    uniforms: { ...shared, uMouse: { value: mouse }, uPixelRatio: { value: pixelRatio }, uIntensity: { value: 1 } },
  })
  scene.add(new Points(geo, particleMat))

  const gridMat = new ShaderMaterial({
    vertexShader: gridVert,
    fragmentShader: gridFrag,
    transparent: true,
    depthWrite: false,
    uniforms: { ...shared, uIntensity: { value: 1 } },
  })
  const grid = new Mesh(new PlaneGeometry(40, 22), gridMat)
  grid.rotation.x = -Math.PI / 2.25
  grid.position.set(0, -4.2, -6)
  scene.add(grid)

  function setDark(dark: boolean) {
    const p = dark ? palette.dark : palette.light
    shared.uJade.value.set(p.jade)
    shared.uGold.value.set(p.gold)
    particleMat.blending = dark ? AdditiveBlending : NormalBlending
    particleMat.uniforms.uIntensity!.value = p.particles
    gridMat.uniforms.uIntensity!.value = p.grid
    particleMat.needsUpdate = true
    if (!running) renderer.render(scene, camera)
  }

  let halfW = 1
  let halfH = 1
  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z
    halfW = halfH * camera.aspect
    if (!running) renderer.render(scene, camera)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)

  function onPointer(e: PointerEvent) {
    const r = canvas.getBoundingClientRect()
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1
    const ny = -(((e.clientY - r.top) / r.height) * 2 - 1)
    target.set(nx * halfW, ny * halfH)
  }
  window.addEventListener('pointermove', onPointer, { passive: true })

  let running = false
  let visible = true
  let raf = 0
  let last = performance.now()
  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    shared.uTime.value += dt
    mouse.lerp(target, 0.08)
    camera.position.x += (mouse.x * 0.04 - camera.position.x) * 0.05
    camera.position.y += (mouse.y * 0.03 - camera.position.y) * 0.05
    camera.lookAt(0, 0, 0)
    renderer.render(scene, camera)
    raf = requestAnimationFrame(frame)
  }
  function sync() {
    const should = visible && !document.hidden && !opts.reducedMotion
    if (should && !running) {
      running = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    } else if (!should && running) {
      running = false
      cancelAnimationFrame(raf)
    }
  }
  const io = new IntersectionObserver(([entry]) => {
    visible = !!entry?.isIntersecting
    sync()
  })
  io.observe(canvas)
  document.addEventListener('visibilitychange', sync)

  // Reduced motion: one still frame with the particles mid-flight.
  shared.uTime.value = 8
  setDark(opts.dark)
  resize()
  sync()

  return {
    setDark,
    dispose() {
      running = false
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('pointermove', onPointer)
      geo.dispose()
      grid.geometry.dispose()
      particleMat.dispose()
      gridMat.dispose()
      renderer.dispose()
    },
  }
}
