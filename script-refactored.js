/**
 * MAIN APPLICATION - Cinematic WebGL Experience
 * 
 * Orchestrates all systems for Peach-level spatial storytelling:
 * - SceneManager: Narrative zone architecture
 * - CameraDirector: Cinematic camera choreography  
 * - GeometryLibrary: Hero asset creation
 * - TransitionEngine: Scene morph orchestration
 * 
 * Architecture Philosophy:
 * The experience is a continuous journey through crafted 3D space,
 * not sections scrolling past a camera.
 */

import * as THREE from './vendor/three.module.js';
import { SceneManager } from './SceneManager.js';
import { CameraDirector } from './CameraDirector.js';
import { GeometryLibrary } from './GeometryLibrary.js';
import { TransitionEngine } from './TransitionEngine.js';
import { EffectComposer } from './vendor/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from './vendor/postprocessing/SMAAPass.js';
import { ShaderPass } from './vendor/postprocessing/ShaderPass.js';
import { SSRPass } from './vendor/postprocessing/SSRPass.js';
import { GammaCorrectionShader } from './vendor/shaders/GammaCorrectionShader.js';
import { gsap } from './vendor/gsap/index.js';

class CinematicExperience {
  constructor() {
    // Core Three.js components
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.canvas = null;
    
    // Architecture systems
    this.sceneManager = null;
    this.cameraDirector = null;
    this.geometryLibrary = null;
    this.transitionEngine = null;
    
    // Background shader
    this.backgroundMesh = null;
    this.backgroundPass = null;
    this.mainPass = null;
    this.foregroundSilhouette = null;
    this.volumetricBeam = null;
    this.baseFogDensity = 0.0045;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.depthParallaxGroups = [];
    this.ssrPass = null;
    this.interactiveObjects = [];
    this.microMotionMeshes = [];
    this.raycastAccumulator = 0;
    this.raycastInterval = 0.1;
    
    // Animation state
    this.clock = new THREE.Clock();
    this.scrollProgress = 0;
    this.targetScrollProgress = 0;
    
    // Performance monitoring
    this.frameCount = 0;
    this.fps = 60;
    this.lastFpsUpdate = 0;
    
    // Quality settings
    this.quality = this.detectQuality();
    
    this.init();
  }

  /**
   * Detect device capabilities and set quality
   */
  detectQuality() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const hasGoodGPU = this.checkWebGLCapabilities();
    
    if (isMobile) return 'low';
    if (!hasGoodGPU) return 'medium';
    return 'high';
  }

  /**
   * Check WebGL capabilities
   */
  checkWebGLCapabilities() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) return false;
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      // Simple heuristic - check for common low-end GPU indicators
      return !renderer.includes('Intel') || renderer.includes('Iris');
    }
    
    return true;
  }

  /**
   * Initialize all systems
   */
  init() {
    console.log(`[Init] Starting cinematic experience at ${this.quality} quality`);
    
    // Setup Three.js foundation
    this.setupThreeJS();
    
    // Initialize architecture systems
    this.sceneManager = new SceneManager();
    this.sceneManager.defineScenes();
    
    this.cameraDirector = new CameraDirector(this.camera, this.sceneManager);
    this.cameraDirector.setQuality(this.quality);
    
    this.geometryLibrary = new GeometryLibrary(this.scene, this.sceneManager);
    this.transitionEngine = new TransitionEngine(this.sceneManager);
    
    // Create visual content
    this.createBackground();
    this.createSceneContent();
    
    // Setup interaction
    this.setupScrollControl();
    this.setupTransitionCallbacks();
    this.setupPremiumUI();
    this.setupRaycastInteraction();
    
    // Start render loop
    this.animate();
    
    // Setup responsive handling
    window.addEventListener('resize', () => this.handleResize());
    
    window.__APP_BOOTED__ = true;
    const loading = document.querySelector('.loading-screen');
    if (loading) {
      loading.classList.add('hidden');
      setTimeout(() => {
        loading.style.display = 'none';
      }, 900);
    }

    console.log('[Init] Experience ready');
  }

  /**
   * Setup Three.js core
   */
  setupThreeJS() {
    // Canvas
    this.canvas = document.getElementById('webgl-canvas');
    
    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0a0a, this.baseFogDensity);
    
    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 10);
    
    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.quality !== 'low',
      alpha: true,
      powerPreference: 'high-performance',
    });
    
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    const maxPixelRatio = this.quality === 'high' ? 1.5 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    this.renderer.physicallyCorrectLights = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.shadowMap.enabled = this.quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ('outputColorSpace' in this.renderer && THREE.SRGBColorSpace) {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else {
      this.renderer.outputEncoding = THREE.sRGBEncoding;
    }

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const tempScene = new THREE.Scene();
    tempScene.background = new THREE.Color(0x111111);
    const envRT = pmrem.fromScene(tempScene);
    if (this.environmentTexture) this.environmentTexture.dispose();
    this.environmentTexture = envRT.texture;
    this.environmentRT = envRT;
    this.scene.environment = envRT.texture;
    pmrem.dispose();
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0x111111);
    this.scene.add(ambientLight);
    
    const keyLight = new THREE.DirectionalLight(0x7B2CBF, 1.2);
    keyLight.position.set(10, 10, 10);
    keyLight.intensity *= 1.3;
    keyLight.castShadow = this.quality === 'high';
    keyLight.shadow.mapSize.set(this.quality === 'high' ? 1024 : 512, this.quality === 'high' ? 1024 : 512);
    this.scene.add(keyLight);
    
    const fillLight = new THREE.DirectionalLight(0x9D4EDD, 0.5);
    fillLight.position.set(-10, -10, -10);
    fillLight.intensity *= 0.6;
    this.scene.add(fillLight);

    const premiumSpot = new THREE.SpotLight(0xffffff, 1.8, 200, 0.35);
    premiumSpot.position.set(0, 20, 20);
    premiumSpot.castShadow = this.quality === 'high';
    premiumSpot.shadow.mapSize.set(this.quality === 'high' ? 1024 : 512, this.quality === 'high' ? 1024 : 512);
    this.scene.add(premiumSpot);
    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(-20, 5, -5);
    this.scene.add(rim);
    const accent = new THREE.PointLight(0xC77DFF, 1.5, 60);
    accent.position.set(5, -3, -8);
    this.scene.add(accent);
  }

  /**
   * Create animated background shader
   */
  createBackground() {
    const geometry = new THREE.PlaneGeometry(2, 2);
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        colorA: { value: new THREE.Vector3(0.48, 0.17, 0.75) },
        colorB: { value: new THREE.Vector3(0.2, 0.1, 0.3) },
        frequency: { value: 0.8 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec2 resolution;
        uniform vec3 colorA;
        uniform vec3 colorB;
        uniform float frequency;
        
        varying vec2 vUv;
        
        // Simplex noise implementation (abbreviated for brevity)
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
        
        float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
          vec2 i  = floor(v + dot(v, C.yy));
          vec2 x0 = v -   i + dot(i, C.xx);
          vec2 i1;
          i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod289(i);
          vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
          m = m*m;
          m = m*m;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
          vec3 g;
          g.x  = a0.x  * x0.x  + h.x  * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }
        
        void main() {
          vec2 uv = vUv;
          
          // Create layered noise
          float noise1 = snoise(uv * frequency + time * 0.1) * 0.5 + 0.5;
          float noise2 = snoise(uv * frequency * 2.0 - time * 0.05) * 0.5 + 0.5;
          float noise3 = snoise(uv * frequency * 4.0 + time * 0.15) * 0.5 + 0.5;
          
          // Combine noise layers
          float finalNoise = noise1 * 0.6 + noise2 * 0.3 + noise3 * 0.1;
          
          // Create gradient based on position and noise
          vec3 color = mix(colorA, colorB, finalNoise);
          
          // Add subtle vignette
          float vignette = 1.0 - length(uv - 0.5) * 0.8;
          color *= vignette;
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      depthWrite: false,
    });
    
    this.backgroundMesh = new THREE.Mesh(geometry, material);
    this.backgroundMesh.renderOrder = -1;
    
    // Create orthographic camera for background
    const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.backgroundCamera = bgCamera;
    
    // Create separate scene for background
    this.backgroundScene = new THREE.Scene();
    this.backgroundScene.add(this.backgroundMesh);
    const vignetteOverlay = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,
        uniforms: {
          strength: { value: 0.35 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float strength;
          varying vec2 vUv;
          void main() {
            vec2 p = vUv - 0.5;
            float vignette = smoothstep(0.2, 0.85, length(p) * 1.25);
            gl_FragColor = vec4(0.0, 0.0, 0.0, vignette * strength);
          }
        `,
      })
    );
    vignetteOverlay.renderOrder = 5;
    this.backgroundScene.add(vignetteOverlay);

    this.composer = new EffectComposer(this.renderer);
    this.backgroundPass = new RenderPass(this.backgroundScene, this.backgroundCamera);
    this.backgroundPass.clear = true;
    this.mainPass = new RenderPass(this.scene, this.camera);
    this.mainPass.clear = false;
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.35,
      0.55,
      0.9
    );
    const smaaPass = new SMAAPass(
      window.innerWidth * this.renderer.getPixelRatio(),
      window.innerHeight * this.renderer.getPixelRatio()
    );
    const gammaPass = new ShaderPass(GammaCorrectionShader);
    if (this.quality === 'high') {
      this.ssrPass = new SSRPass({
        renderer: this.renderer,
        scene: this.scene,
        camera: this.camera,
        width: Math.floor(window.innerWidth * 0.75),
        height: Math.floor(window.innerHeight * 0.75),
        groundReflector: null,
        selects: null,
      });
      this.ssrPass.maxDistance = 90;
      this.ssrPass.thickness = 0.012;
      this.ssrPass.opacity = 0.45;
    }
    if (this.composer && this.backgroundPass) this.composer.addPass(this.backgroundPass);
    if (this.composer && this.mainPass) this.composer.addPass(this.mainPass);
    if (this.composer && this.ssrPass) this.composer.addPass(this.ssrPass);
    if (this.composer && bloomPass) this.composer.addPass(bloomPass);
    if (this.composer && smaaPass) this.composer.addPass(smaaPass);
    if (this.composer && gammaPass) this.composer.addPass(gammaPass);
  }

  /**
   * Create scene content using GeometryLibrary
   */
  createSceneContent() {
    console.log('[Content] Creating scene geometries');
    
    // Create hero assets for each scene
    this.geometryLibrary.createHeroCluster();
    this.geometryLibrary.createPhilosophyElements();
    this.geometryLibrary.createServiceConstellation();
    this.geometryLibrary.createContactPortal();
    
    // Create depth-staged particles
    if (this.quality !== 'low') {
      this.geometryLibrary.createParticleLayers();
    }
    const silhouetteGeo = new THREE.TorusGeometry(10, 1.4, 48, 220);
    const silhouetteMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    });
    this.foregroundSilhouette = new THREE.Mesh(silhouetteGeo, silhouetteMat);
    this.foregroundSilhouette.position.set(0, 0, -6);
    this.scene.add(this.foregroundSilhouette);

    const beamGeo = new THREE.ConeGeometry(5, 20, 32, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.05,
      depthWrite: false,
    });
    this.volumetricBeam = new THREE.Mesh(beamGeo, beamMat);
    this.volumetricBeam.position.set(0, 10, -8);
    this.volumetricBeam.rotation.x = Math.PI;
    this.scene.add(this.volumetricBeam);

    const depthParticleCount = this.quality === 'high' ? 120 : this.quality === 'medium' ? 70 : 35;
    for (let l = 0; l < 3; l++) {
      const g = new THREE.Group();
      for (let i = 0; i < depthParticleCount; i++) {
        const p = new THREE.Mesh(
          new THREE.SphereGeometry(0.02 + Math.random() * 0.015, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        p.position.set(
          Math.random() * 30 - 15,
          Math.random() * 30 - 15,
          Math.random() * -40
        );
        g.add(p);
      }
      g.userData.depth = l;
      this.depthParallaxGroups.push(g);
      this.scene.add(g);
    }

    this.createMoon();

    this.collectInteractionTargets();
    
    console.log('[Content] Scene geometries created');
  }

  createMoon() {
    const texLoader = new THREE.TextureLoader();

    const maps = {};

    const files = [
      "albedo", "color", "diff", "basecolor",
      "normal", "nor",
      "rough", "roughness",
      "ao", "ambient",
      "disp", "height", "displacement",
      "metal", "metallic"
    ];

    const extList = ["jpg", "jpeg", "png", "webp"];

    const classifyMap = (filename) => {
      const lower = filename.toLowerCase();
      if (/albedo|basecolor|color|diff/.test(lower)) return "albedo";
      if (/normal|_nor|nor_gl|nor/.test(lower)) return "normal";
      if (/roughness|rough/.test(lower)) return "rough";
      if (/ambient|_ao|ao/.test(lower)) return "ao";
      if (/displacement|height|disp/.test(lower)) return "disp";
      if (/metallic|metal/.test(lower)) return "metal";
      return null;
    };

    const loadTextureSafe = async (url) => {
      try {
        return await texLoader.loadAsync(url);
      } catch (_) {
        return null;
      }
    };

    async function loadMoonTextures() {
      const materialMaps = {};
      const discovered = [];

      try {
        const res = await fetch("/assets/moon/");
        if (res.ok) {
          const html = await res.text();
          const links = [...html.matchAll(/href=["']([^"']+\.(?:png|jpe?g|webp))["']/gi)]
            .map((m) => m[1]);
          links.forEach((href) => {
            const clean = href.split("?")[0];
            const file = clean.split("/").pop();
            if (file) discovered.push(file);
          });
        }
      } catch (_) {}

      for (const file of discovered) {
        const type = classifyMap(file);
        if (!type || materialMaps[type]) continue;
        const tex = await loadTextureSafe(`/assets/moon/${file}`);
        if (tex) materialMaps[type] = tex;
      }

      for (const key of files) {
        if (materialMaps[key]) continue;
        for (const ext of extList) {
          const tex = await loadTextureSafe(`/assets/moon/${key}.${ext}`);
          if (tex) {
            materialMaps[key] = tex;
            break;
          }
        }
      }

      return materialMaps;
    }

    loadMoonTextures().then((t) => {
      Object.assign(maps, t);

      const mat = new THREE.MeshStandardMaterial({
        map: t.albedo || t.color || t.basecolor || t.diff,
        normalMap: t.normal || t.nor,
        roughnessMap: t.rough || t.roughness,
        aoMap: t.ao || t.ambient,
        displacementMap: t.disp || t.height || t.displacement,
        metalnessMap: t.metal || t.metallic,
        displacementScale: 0.3,
        metalness: 0,
        roughness: 1,
      });

      const geo = new THREE.SphereGeometry(5, 128, 128);
      geo.setAttribute('uv2', new THREE.BufferAttribute(geo.attributes.uv.array, 2));
      const mesh = new THREE.Mesh(geo, mat);

      mesh.position.set(6, -2, -15);
      this.scene.add(mesh);
    });
  }

  /**
   * Setup scroll control with smooth interpolation
   */
  setupScrollControl() {
    let ticking = false;
    
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
          this.targetScrollProgress = window.scrollY / scrollHeight;
          ticking = false;
        });
        ticking = true;
      }
    });
    
    // Initialize scroll position
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    this.targetScrollProgress = window.scrollY / scrollHeight;
    this.scrollProgress = this.targetScrollProgress;
  }

  /**
   * Setup transition event callbacks
   */
  setupTransitionCallbacks() {
    this.transitionEngine.on('onAnticipate', (scene, index) => {
      console.log(`[Transition Event] Anticipating: ${scene.name}`);
      // Could trigger subtle UI changes, sound effects, etc.
    });
    
    this.transitionEngine.on('onMorph', (fromScene, toScene, index) => {
      console.log(`[Transition Event] Morphing: ${fromScene.name} → ${toScene?.name}`);
      
      // Update lighting for next scene
      if (toScene) {
        const lighting = toScene.lighting;
        // Smoothly transition lighting (simplified)
      }
    });
    
    this.transitionEngine.on('onComplete', (transition) => {
      console.log(`[Transition Event] Complete: ${transition?.to?.name}`);
    });
  }

  setupPremiumUI() {
    const cards = document.querySelectorAll('.service-card, .project-card, .pricing-card, .philosophy-card');
    cards.forEach((card) => {
      card.style.background = 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))';
      card.style.backdropFilter = 'blur(18px)';
      card.style.border = '1px solid rgba(255,255,255,0.08)';
      card.onmouseenter = () => {
        gsap.to(card, { y: -8, duration: 0.4 });
        if (this.cameraDirector) {
          this.cameraDirector.shake(0.15, 0.25);
        }
        const nodeIndex = Number(card.dataset.node);
        if (!Number.isNaN(nodeIndex)) {
          this.pulseServiceNode(nodeIndex);
        }
      };
      card.onmouseleave = () => {
        gsap.to(card, { y: 0, duration: 0.6 });
      };
    });
  }

  setupRaycastInteraction() {
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }, { passive: true });
  }

  collectInteractionTargets() {
    this.microMotionMeshes = [];
    this.scene.traverse((obj) => {
      if (obj.isMesh && obj !== this.backgroundMesh && obj !== this.volumetricBeam) {
        this.microMotionMeshes.push(obj);
      }
    });

    const serviceConstellation = this.geometryLibrary?.objects?.serviceConstellation;
    if (serviceConstellation) {
      serviceConstellation.traverse((obj) => {
        if (obj.isMesh) this.interactiveObjects.push(obj);
      });
    }
    const heroCluster = this.geometryLibrary?.objects?.heroCluster;
    if (heroCluster) {
      heroCluster.traverse((obj) => {
        if (obj.isMesh) this.interactiveObjects.push(obj);
      });
    }
  }

  pulseServiceNode(nodeIndex) {
    const constellation = this.geometryLibrary?.objects?.serviceConstellation;
    if (!constellation) return;
    const node = constellation.children[nodeIndex];
    const nodeMesh = node?.children?.find((child) => child.isMesh);
    if (!nodeMesh?.material?.emissive) return;
    gsap.killTweensOf(nodeMesh.material);
    gsap.fromTo(
      nodeMesh.material,
      { emissiveIntensity: 0.15 },
      { emissiveIntensity: 0.85, duration: 0.22, yoyo: true, repeat: 1, ease: 'power2.inOut' }
    );
  }

  /**
   * Main animation loop
   */
  animate() {
    requestAnimationFrame(() => this.animate());
    
    let deltaTime = this.clock.getDelta();
    deltaTime *= 0.92;
    const elapsedTime = this.clock.getElapsedTime();
    
    // Smooth scroll interpolation
    this.scrollProgress += (this.targetScrollProgress - this.scrollProgress) * 0.065;
    
    // Update transition engine
    this.transitionEngine.update(this.scrollProgress, deltaTime);
    
    // Update camera choreography
    this.cameraDirector.update(this.scrollProgress, deltaTime);
    this.camera.position.z += Math.sin(elapsedTime * 0.3) * 0.01;
    this.camera.position.x += Math.cos(elapsedTime * 0.2) * 0.005;
    
    // Update geometry animations
    this.geometryLibrary.update(elapsedTime, this.scrollProgress);
    for (let i = 0; i < this.microMotionMeshes.length; i++) {
      const obj = this.microMotionMeshes[i];
      obj.rotation.x += deltaTime * 0.15;
      obj.rotation.y += deltaTime * 0.1;
      obj.position.y += Math.sin(elapsedTime * 0.6 + obj.id) * 0.002;
    }
    if (this.foregroundSilhouette) {
      this.foregroundSilhouette.rotation.z += deltaTime * 0.08;
      this.foregroundSilhouette.rotation.x += deltaTime * 0.03;
    }
    if (this.volumetricBeam) {
      this.volumetricBeam.material.opacity = 0.04 + Math.sin(elapsedTime * 1.3) * 0.01;
    }
    if (this.scene.fog) {
      this.scene.fog.density = this.baseFogDensity + Math.sin(elapsedTime * 0.2) * 0.0004;
    }
    this.raycastAccumulator += deltaTime;
    if (this.raycastAccumulator >= this.raycastInterval && this.interactiveObjects.length > 0) {
      this.raycastAccumulator = 0;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const hits = this.raycaster.intersectObjects(this.interactiveObjects, false);
      if (hits.length) {
        hits[0].object.rotation.y += 0.03;
      }
    }
    this.depthParallaxGroups.forEach((o) => {
      o.position.z += deltaTime * (o.userData.depth + 1) * 0.7;
      if (o.position.z > 8) o.position.z = -40;
    });
    
    // Update background shader
    if (this.backgroundMesh) {
      const shaderUniforms = this.sceneManager.getInterpolatedShader(this.scrollProgress);
      this.backgroundMesh.material.uniforms.time.value = elapsedTime;
      this.backgroundMesh.material.uniforms.colorA.value.set(...shaderUniforms.colorA);
      this.backgroundMesh.material.uniforms.colorB.value.set(...shaderUniforms.colorB);
      this.backgroundMesh.material.uniforms.frequency.value = shaderUniforms.frequency;
    }
    
    // Render
    this.render();
    
    // FPS monitoring (optional, can be removed in production)
    this.updateFPS();
  }

  /**
   * Render scene
   */
  render() {
    if (this.composer) {
      this.composer.render();
    }
  }

  /**
   * Update FPS counter
   */
  updateFPS() {
    this.frameCount++;
    const now = performance.now();
    
    if (now >= this.lastFpsUpdate + 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = now;
      
      // Quality adjustment based on FPS (optional)
      if (this.fps < 30 && this.quality !== 'low') {
        console.warn('[Performance] Low FPS detected, consider reducing quality');
      }
    }
  }

  /**
   * Handle window resize
   */
  handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setSize(width, height);
    }
    
    if (this.backgroundMesh) {
      this.backgroundMesh.material.uniforms.resolution.value.set(width, height);
    }
  }

  /**
   * Dispose and cleanup
   */
  dispose() {
    console.log('[Cleanup] Disposing resources');
    
    if (this.geometryLibrary) this.geometryLibrary.dispose();
    if (this.cameraDirector) this.cameraDirector.dispose();
    
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.composer) {
      this.composer.dispose();
    }
    if (this.environmentTexture) {
      this.environmentTexture.dispose();
    }
    if (this.environmentRT) {
      this.environmentRT.dispose();
    }
    if (this.foregroundSilhouette?.geometry) this.foregroundSilhouette.geometry.dispose();
    if (this.foregroundSilhouette?.material) this.foregroundSilhouette.material.dispose();
    if (this.volumetricBeam?.geometry) this.volumetricBeam.geometry.dispose();
    if (this.volumetricBeam?.material) this.volumetricBeam.material.dispose();
    this.depthParallaxGroups.forEach((group) => {
      group.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
    });
    
    window.removeEventListener('resize', this.handleResize);
  }
}

// Initialize application
const bootstrap = () => {
  console.log('[App] Initializing Cinematic WebGL Experience');
  const app = new CinematicExperience();
  
  // Expose to window for debugging
  window.cinematicApp = app;
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (window.cinematicApp) {
    window.cinematicApp.dispose();
  }
});
