// ThreeJS Import
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TorusKnot} from 'three/addons/curves/CurveExtras.js';
import {EffectComposer, EffectPass, RenderPass, GodRaysEffect} from 'postprocessing';

// Params
const TK_RADIUS = 0.8;
const TK_TUBE_RADIUS = 0.3;
const COIL_TUBE_RADIUS = 0.2;
const TK_POINTS_COUNT = 200;
const TURNS_COUNT = 20.0;
const RAY_COLOR = '#000';
const ALBEDO0_URL = './images/tulip.png';
const ALBEDO1_URL = 'https://images.unsplash.com/photo-1585936529565-1871537209e3?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8MjB8fGZpc2h8ZW58MHx8MHx8&auto=format&fit=crop&w=600&q=60';
const ENV_URL = './images/greenSill.png';

// Main
const renderer = new THREE.WebGLRenderer({
    powerPreference: 'high-performance',
    antialias: false,
    stencil: false,
    depth: false
})

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 2, 0.1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
camera.position.set(0, 2, 4);
controls.target.set(0, 2, 0);
controls.enableDamping = true;
controls.autoRotate = true;
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.7;
renderer.outputEncoding = THREE.sRGBEncoding;
scene.background = new THREE.Color('lightcyan');

new THREE.TextureLoader().load(ENV_URL, (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping
    tex.encoding = THREE.sRGBEncoding
    const rt = new THREE.PMREMGenerator(renderer).fromEquirectangular(tex)
    scene.environment = rt.texture
})

const light = new THREE.DirectionalLight();
light.position.set(0, 1, 0);
light.castShadow = true;
scene.add(light);
scene.add(new THREE.AmbientLight());
const tk = new TorusKnot(TK_RADIUS);


// Eel
function create_eel(tk, tube_radius, points_count) {
    const origins = tk.getSpacedPoints(points_count - 1)
    const curve = new THREE.CurvePath()
    const points = []
    for (let i = 0; i < points_count; ++i) {
        points.push(origins[i])
        if (i > 0) {
            curve.add(new THREE.LineCurve3(points[i - 1], points[i]))
        }
    }

    const geom = new THREE.TubeGeometry(curve, points_count, tube_radius, 10, false)
    const mesh = new THREE.Mesh(geom)
    mesh.receiveShadow = true
    mesh.castShadow = true
    return mesh
}

const eel = create_eel(tk, TK_TUBE_RADIUS, TK_POINTS_COUNT)

const albedo0_tex = new THREE.TextureLoader().load(ALBEDO0_URL)
albedo0_tex.encoding = THREE.sRGBEncoding
albedo0_tex.wrapS = THREE.MirroredRepeatWrapping
albedo0_tex.wrapT = THREE.MirroredRepeatWrapping
albedo0_tex.repeat.set(10, 2)

eel.material = new THREE.MeshPhysicalMaterial({
    map: albedo0_tex,
    roughness: 1.0,
    clearcoat: 1.0,
    envMapIntensity: 5.0
})

scene.add(eel)


// Koi
function create_koi(tk, tk_tube_radius, tube_radius, points_count, turns_count) {
    const segments_count = points_count * turns_count
    const origins = tk.getSpacedPoints(segments_count - 1)
    const frames = tk.computeFrenetFrames(segments_count - 1)
    const curve = new THREE.CurvePath()
    const points = []
    for (let i = 0; i < segments_count; ++i) {
        const p = new THREE.Vector3(tk_tube_radius + tube_radius, 0, 0)
        const b = frames.binormals[i]
        const n = frames.normals[i]
        const t = frames.tangents[i]
        const tf = new THREE.Matrix4().makeBasis(b, n, t)
        const angle = i / segments_count * (Math.PI * 2 * turns_count)
        const tf2 = new THREE.Matrix4().makeRotationAxis(t, angle)
        const m = tf2.multiply(tf)
        points.push(p.applyMatrix4(m).add(origins[i]))
        if (i === 0) continue
        curve.add(new THREE.LineCurve3(points[i - 1], points[i]))
    }

    const geom = new THREE.TubeGeometry(curve, segments_count, tube_radius, 10)
    const mesh = new THREE.Mesh(geom)
    mesh.receiveShadow = true
    mesh.castShadow = true
    return mesh
}

const koi = create_koi(tk, TK_TUBE_RADIUS, COIL_TUBE_RADIUS, TK_POINTS_COUNT, TURNS_COUNT)

const albedo1_tex = new THREE.TextureLoader().load(ALBEDO1_URL)
albedo1_tex.encoding = THREE.sRGBEncoding
albedo1_tex.wrapS = THREE.RepeatWrapping
albedo1_tex.wrapT = THREE.RepeatWrapping
albedo1_tex.repeat.set(0.5, 20)
albedo1_tex.rotation = Math.PI / 2

koi.material = new THREE.MeshPhysicalMaterial({
    map: albedo1_tex,
    side: THREE.DoubleSide,
    alphaMap: albedo1_tex,
    alphaTest: 0.05
})

scene.add(koi)

// Render
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const light_src = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({
        color: RAY_COLOR
    })
)
light_src.position.set(0, 1, 0)
light_src.lookAt(new THREE.Vector3())
composer.addPass(new EffectPass(camera, new GodRaysEffect(camera, light_src, {
    density: 1.0,
    weight: 20,
    decay: 0.92
})))

renderer.setAnimationLoop(() => {
    composer.render()
    controls.update()
    albedo0_tex.offset.x += 0.001
    albedo0_tex.offset.y += 0.001
    albedo1_tex.offset.y -= 0.01
})

// RenderView
function resize(w, h, dpr = devicePixelRatio) {
    renderer.setPixelRatio(dpr)
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
}

addEventListener('resize', () => resize(innerWidth, innerHeight));
dispatchEvent(new Event('resize'));
document.body.prepend(renderer.domElement);