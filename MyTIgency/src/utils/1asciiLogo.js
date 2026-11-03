import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const MODEL_URL = new URL('../models/myt.glb', import.meta.url).href
// Rampa por luminância (sombra → luz), como no AsciiEffect clássico: a face
// de frente satura em '&'; paredes viradas pra câmera sobem pra '%@#' e as
// viradas pra longe descem pra '+-:'. Nada de glifo por forma/contorno — o
// volume vem só da luz
const RAMP = '.:-+*=%@#&'
// Os níveis mais escuros ('.:-+') saem no tom secundário: sombra em cinza
const SHADOW_LEVELS = 4
// Pixels amostrados por célula; a célula é desenhada se ao menos
// MIN_COVERAGE deles tiver o modelo, com a média da luz dos que têm
const SX = 2
const SY = 4
const MIN_COVERAGE = 0.25
// Mesma fonte do resto do site (DESIGN.md); 700 é o peso carregado mais
// próximo do 600 que a Source Code Pro usava
const FONT_WEIGHT = 700
const MODEL_BASE_ROTATION = { x: 0, y: 0, z: 0 }

// Todo modelo é renderizado com este shader, que não desenha cor e sim dados
// por pixel lidos de volta no passo ASCII (renderer sem antialias, então os
// valores chegam intactos): R = luz, G = face (>0) ou parede, B = máscara (>0).
// Contrato com o Blender: Base Color branco na frente/verso, preto nas
// laterais — o preto vira um albedo menor, então a parede fica uma faixa
// abaixo da face na rampa e os traços não se fundem com a extrusão
const WALL_ALBEDO = 0.32
// Ganho da luz: >1 satura a face de frente em '&' em quase todo o balanço,
// e a variação aparece só onde a superfície vira de verdade
const LIGHT_GAIN = 1.35
const GLYPH_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const GLYPH_FRAGMENT = /* glsl */ `
  uniform float uAlbedo;
  uniform float uFace;
  varying vec3 vNormal;
  void main() {
    // Normais invertidas no Blender ou verso visto por dentro: vira pra câmera
    vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    // Luz direcional quase frontal, presa à câmera (levemente de cima/esquerda)
    vec3 l = normalize(vec3(-0.2, 0.3, 1.0));
    float light = clamp(uAlbedo * ${LIGHT_GAIN} * max(dot(n, l), 0.0), 0.0, 1.0);
    // Gamma: abre os meios-tons, como a saída sRGB de um material comum
    gl_FragColor = vec4(pow(light, 1.0 / 2.2), uFace, 1.0, 1.0);
  }
`

// Luminância do Base Color que veio do GLB (sem material = branco, padrão glTF)
function createGlyphMaterial(source) {
  const c = source?.color
  const luminance = c ? 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b : 1
  return new THREE.ShaderMaterial({
    uniforms: {
      uAlbedo: { value: luminance > 0.35 ? 1 : WALL_ALBEDO },
      uFace: { value: luminance > 0.35 ? 1 : 0 },
    },
    vertexShader: GLYPH_VERTEX,
    fragmentShader: GLYPH_FRAGMENT,
    side: THREE.DoubleSide,
  })
}

let modelLoadPromise = null

function loadModel() {
  if (!modelLoadPromise) {
    modelLoadPromise = new GLTFLoader().loadAsync(MODEL_URL)
  }
  return modelLoadPromise
}

// Exposto pro gate de loading (ver useAppReady) — mesma promise cacheada
// que createAsciiLogoScene usa, então não dispara um segundo fetch.
export function getHeroModelReady() {
  return loadModel()
}

function getAsciiResolution() {
  const area = window.innerWidth * window.innerHeight
  const resolution = 0.2 - 0.00000006 * Math.max(area - 1200000, 0)
  return Math.max(0.12, Math.min(0.22, resolution))
}

class AsciiLogoSceneEffect {
  constructor(renderer, options = {}) {
    this.renderer = renderer
    this.fResolution = options.resolution || 0.16
    this.iScale = options.scale || 1
    this.backgroundColor = options.backgroundColor || '#fafafa'
    this.foregroundColor = options.foregroundColor || '#050505'
    this.edgeColor = options.edgeColor || '#6B6B64'
    this.fillScene = options.fillScene !== undefined ? options.fillScene : true
    this.density = options.density !== undefined ? options.density : 1.0

    this.domElement = document.createElement('div')
    this.domElement.style.cursor = 'default'
    this.domElement.style.position = 'absolute'
    this.domElement.style.inset = '0'
    this.domElement.style.width = '100%'
    this.domElement.style.height = '100%'
    this.domElement.style.overflow = 'hidden'
    this.domElement.style.pointerEvents = 'none'
    this.domElement.style.backgroundColor = this.backgroundColor

    // Canvas 2D de alta performance para desenhar o grid ASCII.
    // alpha:true é proposital (não é o mais barato) — resize() limpa o canvas
    // pra transparente, então até o próximo render ele deixa o backgroundColor
    // do domElement (abaixo) aparecer em vez de pintar um retângulo preto.
    this.displayCanvas = document.createElement('canvas')
    this.displayCanvas.style.position = 'absolute'
    this.displayCanvas.style.inset = '0'
    this.displayCanvas.style.width = '100%'
    this.displayCanvas.style.height = '100%'
    this.displayCanvas.style.pointerEvents = 'none'
    this.displayCtx = this.displayCanvas.getContext('2d', { alpha: true })
    this.domElement.appendChild(this.displayCanvas)

    // Leitura direta do framebuffer do WebGL (ver render)
    this.pixels = null

    this.width = 0
    this.height = 0
    this.dpr = 1
    this.cols = 0
    this.rows = 0

    this.charWidth = 7.5
    this.charHeight = 12.5

    this.rowChars = null
    this.edgeChars = null

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        this.updateCharMetrics()
      })
    }
  }

  setDensity(val) {
    this.density = Math.max(0, Math.min(1, val))
  }

  updateCharMetrics() {
    const fFontSize = (2 / this.fResolution) * this.iScale
    const fLineHeight = (2 / this.fResolution) * this.iScale
    this.charHeight = fLineHeight

    const font = `${FONT_WEIGHT} ${fFontSize}px "JetBrains Mono", "Courier New", monospace`
    if (this.displayCtx) {
      this.displayCtx.font = font
      if ('letterSpacing' in this.displayCtx) {
        this.displayCtx.letterSpacing = '-0.6px'
      }
      const metrics = this.displayCtx.measureText('M')
      this.charWidth = metrics.width || (fFontSize * 0.6 - 0.6)
    } else {
      this.charWidth = fFontSize * 0.6 - 0.6
    }
  }

  setSize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.dpr = dpr
    this.width = w
    this.height = h

    this.updateCharMetrics()

    this.displayCanvas.width = Math.round(w * dpr)
    this.displayCanvas.height = Math.round(h * dpr)
    this.displayCanvas.style.width = `${w}px`
    this.displayCanvas.style.height = `${h}px`

    // Grid dimension calculations based on actual charWidth & charHeight
    this.cols = Math.ceil(w / this.charWidth) + 1
    this.rows = Math.ceil(h / this.charHeight) + 1

    this.offsetX = (w - this.cols * this.charWidth) / 2
    this.offsetY = (h - this.rows * this.charHeight) / 2

    // O Three.js renderiza SX×SY pixels por célula do grid ASCII
    this.renderer.setSize(this.cols * SX, this.rows * SY)
    this.pixels = new Uint8Array(this.cols * SX * this.rows * SY * 4)

    this.rowChars = new Array(this.cols)
    this.edgeChars = new Array(this.cols)
  }

  render(scene, camera) {
    this.renderer.render(scene, camera)

    if (!this.pixels || !this.rowChars || !this.displayCtx) return

    // 1. Lê de volta os dados do shader (ver GLYPH_FRAGMENT). Logo após o
    // render, na mesma task, o drawing buffer ainda é válido. Linhas vêm de
    // baixo pra cima (convenção do GL)
    const gl = this.renderer.getContext()
    const W = this.cols * SX
    const H = this.rows * SY
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels)
    const px = this.pixels

    const ctx = this.displayCtx
    const dpr = this.dpr
    const fFontSize = (2 / this.fResolution) * this.iScale

    ctx.save()
    ctx.scale(dpr, dpr)

    ctx.fillStyle = this.backgroundColor
    ctx.fillRect(0, 0, this.width, this.height)

    ctx.font = `${FONT_WEIGHT} ${fFontSize}px "JetBrains Mono", "Courier New", monospace`
    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = '-0.6px'
    }
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'

    const rowChars = this.rowChars
    const edgeChars = this.edgeChars
    const lastLevel = RAMP.length - 1
    const minCovered = Math.ceil(SX * SY * MIN_COVERAGE)

    // 3. Monta e desenha cada linha no canvas com aceleração direta por hardware
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        edgeChars[col] = ' '

        // Luz média separada por material: célula metade face, metade parede
        // usa só a luz do material majoritário — a média das duas caía no
        // meio da rampa e virava '@%#' com cara de aleatório na borda
        let faceN = 0
        let faceLight = 0
        let wallN = 0
        let wallLight = 0
        for (let sy = 0; sy < SY; sy++) {
          const rowBase = ((H - 1 - (row * SY + sy)) * W + col * SX) * 4
          for (let sx = 0; sx < SX; sx++) {
            const o = rowBase + sx * 4
            if (px[o + 2] === 0) continue
            if (px[o + 1] > 0) {
              faceN++
              faceLight += px[o]
            } else {
              wallN++
              wallLight += px[o]
            }
          }
        }

        if (faceN + wallN >= minCovered) {
          // Ponderada pela cobertura: célula de borda, parcialmente vazia,
          // desce na rampa ('&' → '=' / '+'), então um vão mais estreito que
          // a célula vira uma costura visível em vez de os traços se fundirem
          const coverage = (faceN + wallN) / (SX * SY)
          const light = (faceN >= wallN ? faceLight / faceN : wallLight / wallN) * coverage
          const level = Math.min(lastLevel, Math.floor((light / 255) * RAMP.length))
          // Faixas escuras no tom secundário, o resto em tinta
          if (level < SHADOW_LEVELS) {
            rowChars[col] = ' '
            edgeChars[col] = RAMP[level]
          } else {
            rowChars[col] = RAMP[level]
          }
        } else {
          if (this.fillScene && this.density > 0.01) {
            if (this.density >= 0.99) {
              rowChars[col] = '.'
            } else {
              // Dissolução orgânica determinística por célula
              const cellHash = Math.sin(row * 12.9898 + col * 78.233) * 43758.5453
              const seed = Math.abs(cellHash - Math.floor(cellHash))
              rowChars[col] = seed < this.density ? '.' : ' '
            }
          } else {
            rowChars[col] = ' '
          }
        }
      }

      // Desenha a linha inteira de caracteres perfeitamente centralizada;
      // as laterais saem numa segunda camada, no tom secundário
      const y = this.offsetY + row * this.charHeight
      ctx.fillStyle = this.foregroundColor
      ctx.fillText(rowChars.join(''), this.offsetX, y)
      ctx.fillStyle = this.edgeColor
      ctx.fillText(edgeChars.join(''), this.offsetX, y)
    }

    ctx.restore()
  }

  dispose() {
    this.rowChars = null
    this.edgeChars = null
    this.pixels = null
    this.displayCtx = null
    if (this.displayCanvas?.parentNode) {
      this.displayCanvas.parentNode.removeChild(this.displayCanvas)
    }
  }
}

export function createAsciiLogoScene(container, options = {}) {
  if (!container) return null

  const {
    targetSize = 8.5,
    cameraZ = 10,
    fov = 70,
    autoRotateSpeed = 0,
    swingAngle = 0,
    swingPeriod = 24,
    fitToContainer = false,
    fillScene = true,
    resolution,
    backgroundColor,
    foregroundColor,
    edgeColor,
  } = options

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)

  const initialSize = fitToContainer
    ? {
        width: Math.max(container.clientWidth, 1),
        height: Math.max(container.clientHeight, 1),
      }
    : {
        width: Math.max(container.clientWidth, window.innerWidth),
        height: Math.max(container.clientHeight, window.innerHeight),
      }

  const camera = new THREE.PerspectiveCamera(
    fov,
    initialSize.width / initialSize.height,
    1,
    1000,
  )
  camera.position.set(0, 0, cameraZ)

  // Sem luzes na cena: a iluminação é calculada no GLYPH_FRAGMENT

  // Three.js configurado para alta performance sem MSAA desnecessário
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(1)

  const effect = new AsciiLogoSceneEffect(renderer, {
    resolution: resolution ?? getAsciiResolution(),
    backgroundColor,
    foregroundColor,
    edgeColor,
    fillScene,
  })
  effect.setSize(initialSize.width, initialSize.height)
  container.appendChild(effect.domElement)

  const logoRig = new THREE.Group()
  scene.add(logoRig)

  // Rotation is a constant spin or a swing (see animate()) — no cursor tracking
  // drives it anymore, so there's no target/current split to lerp between.
  let rotationY = MODEL_BASE_ROTATION.y
  let swingPhase = 0
  // Movimento reduzido: o símbolo fica parado na vista frontal
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let isVisible = true
  let isScrolling = false
  let frameId = 0
  let isFrozen = false
  let sceneProgress = 0
  let loadedMeshLargestDimension = 0

  loadModel().then((gltf) => {
    const logoMesh = gltf.scene.clone(true)

    // Contrato com o Blender: Base Color branco = frente/verso, preto = laterais.
    // Um shader por material de origem (primitivas que o compartilham reusam)
    const glyphMaterials = new Map()
    logoMesh.traverse((node) => {
      if (!node.isMesh) return
      const source = node.material
      if (!glyphMaterials.has(source)) glyphMaterials.set(source, createGlyphMaterial(source))
      node.material = glyphMaterials.get(source)
    })

    const box = new THREE.Box3().setFromObject(logoMesh)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    logoMesh.position.sub(center)

    const largestDimension = Math.max(size.x, size.y, size.z)
    loadedMeshLargestDimension = largestDimension
    const currentScaleBoost = 1 + sceneProgress * 0.35
    logoRig.scale.setScalar((targetSize / largestDimension) * currentScaleBoost)

    logoRig.rotation.set(
      MODEL_BASE_ROTATION.x,
      MODEL_BASE_ROTATION.y,
      MODEL_BASE_ROTATION.z,
    )

    logoRig.add(logoMesh)
  })

  const observer = new IntersectionObserver(
    ([entry]) => {
      isVisible = entry.isIntersecting
    },
    { threshold: 0.05 },
  )
  observer.observe(container)

  const clock = new THREE.Clock()
  let frameCounter = 0

  function animate() {
    frameId = requestAnimationFrame(animate)
    if (!isVisible) return

    const delta = clock.getDelta()

    // Idle motion, no cursor input. Swing: oscila em senoide em torno da vista
    // frontal, então o símbolo nunca passa pelo perfil (onde vira uma "laje"
    // ilegível); sem swing, giro constante. Segue avançando mesmo com o render
    // estrangulado abaixo, então a peça nunca trava visivelmente no reveal.
    if (!isFrozen && !reduceMotion) {
      if (swingAngle) {
        swingPhase += (delta / swingPeriod) * Math.PI * 2
        rotationY = MODEL_BASE_ROTATION.y + swingAngle * Math.sin(swingPhase)
      } else if (autoRotateSpeed) {
        rotationY += autoRotateSpeed * delta
      }
    }
    if (logoRig.children.length) {
      logoRig.rotation.x = MODEL_BASE_ROTATION.x
      logoRig.rotation.y = rotationY
    }

    // The sample-and-draw pass below forces a GPU readback (getImageData)
    // every frame, which stalls the pipeline — cheap enough at rest, but it
    // competes with the main thread for the scroll-driven reveal transition.
    // Rather than fully pausing it (which froze the rotation on screen and
    // could leave the canvas mid-resize/blank), render less often instead,
    // so the spin stays visibly smooth without a bigger stutter.
    frameCounter++
    const everyNth = isScrolling ? 4 : 2
    if (frameCounter % everyNth !== 0) return

    effect.render(scene, camera)
  }

  animate()

  function getContainerSize() {
    const rect = container.getBoundingClientRect()
    if (fitToContainer) {
      return {
        width: Math.max(Math.round(rect.width), 1),
        height: Math.max(Math.round(rect.height), 1),
      }
    }

    return {
      width: Math.max(Math.round(rect.width), window.innerWidth),
      height: Math.max(Math.round(rect.height), window.innerHeight),
    }
  }

  // force: remede mesmo sem mudança de tamanho (fonte carregada). O
  // ResizeObserver passa entries como 1º argumento, por isso `=== true`.
  function applySize(force) {
    const { width: w, height: h } = getContainerSize()
    // A hidden ancestor (Hero gets display:none once docked — see
    // useHeroMarqueeReveal) collapses this container to ~0, which the
    // ResizeObserver still reports. Shrinking the renderer down to that and
    // back once Hero reappears was corrupting the WebGL readback into visible
    // noise, so degenerate sizes are ignored — the renderer just keeps its
    // last real dimensions while hidden, and resumes cleanly when shown again.
    if (w < 10 || h < 10) return
    // Resize de janela sem mudar o box (barra do navegador recolhendo no
    // mobile): setSize recriaria o canvas e piscaria o ASCII à toa.
    if (force !== true && w === effect.width && h === effect.height) return

    effect.setSize(w, h)

    camera.aspect = (effect.cols * effect.charWidth) / (effect.rows * effect.charHeight)
    camera.updateProjectionMatrix()
  }

  applySize(true)

  // A fonte do grid (JetBrains Mono) costuma chegar depois do primeiro
  // setSize: a largura do caractere muda, mas grid e aspect da câmera ficavam
  // velhos até o próximo resize — no mobile, o primeiro scroll (barra do
  // navegador), que fazia o ASCII "pular" de tamanho. Remede tudo ao carregar.
  let destroyed = false
  document.fonts?.ready.then(() => {
    if (!destroyed) applySize(true)
  })

  const resizeObserver = new ResizeObserver(applySize)
  resizeObserver.observe(container)

  window.addEventListener('resize', applySize)

  function setProgress(progress) {
    const p = Math.max(0, Math.min(1, progress))
    sceneProgress = p

    // Curva de perda de densidade: 0.15 -> 0.70 desmancha os pontos de fundo
    const density = 1 - Math.min(1, Math.max(0, (p - 0.15) / 0.55))
    effect.setDensity(density)

    // Ajuste dinâmico calibrado de escala 3D
    if (loadedMeshLargestDimension && logoRig.children.length) {
      const scaleBoost = 1 + p * 0.35
      logoRig.scale.setScalar((targetSize / loadedMeshLargestDimension) * scaleBoost)
    }
  }

  function setFreeze(frozen) {
    isFrozen = Boolean(frozen)
  }

  function setScrolling(scrolling) {
    isScrolling = Boolean(scrolling)
  }

  function setDensity(density) {
    effect.setDensity(density)
  }

  function destroy() {
    destroyed = true
    cancelAnimationFrame(frameId)
    window.removeEventListener('resize', applySize)
    resizeObserver.disconnect()
    observer.disconnect()

    if (effect.domElement.parentNode === container) {
      container.removeChild(effect.domElement)
    }

    effect.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry?.dispose()
        obj.material?.dispose()
      }
    })
  }

  return {
    destroy,
    setProgress,
    setFreeze,
    setDensity,
    setScrolling,
  }
}
