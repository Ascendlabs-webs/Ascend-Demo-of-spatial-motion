/**
 * GEOMETRY LIBRARY - Hero Asset Architecture
 * 
 * Defines signature visual language through custom geometries.
 * Creates depth-staged object hierarchies for each scene.
 * 
 * Design Philosophy:
 * - Hero objects embody brand identity
 * - Geometries morph between scenes
 * - Depth layers create parallax richness
 * - Custom shaders define material language
 * 
 * Asset Hierarchy:
 * PRIMARY: Main focal points (hero geometry)
 * SECONDARY: Supporting elements (context)
 * TERTIARY: Atmospheric particles (depth)
 */

import * as THREE from './vendor/three.module.js';

export class GeometryLibrary {
  constructor(scene, sceneManager) {
    this.scene = scene;
    this.sceneManager = sceneManager;
    this.geometries = {};
    this.materials = {};
    this.objects = {};
    this.lastUpdateTime = 0;
    
    this.initializeMaterials();
  }

  /**
   * Initialize custom materials with shaders
   */
  initializeMaterials() {
    this.materials.hero = new THREE.MeshPhysicalMaterial({
      color: 0xFF1493, // Hot pink like the shark
      metalness: 0.9,
      roughness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      transmission: 0.35,
      thickness: 1.8,
      envMapIntensity: 2.8,
    });

    // Particle material - purple nebula stars
    this.materials.particle = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0x8B5CF6) }, // Purple nebula
        opacity: { value: 0.75 },
      },
      vertexShader: `
        uniform float time;
        varying float vDistance;
        attribute float sizeVariance;
        
        void main() {
          vDistance = length(position);
          vec3 pos = position;
          
          // Slow floating motion like nebula stars
          pos.y += sin(time * 0.5 + position.x * 0.1) * 0.5;
          pos.x += cos(time * 0.3 + position.z * 0.1) * 0.3;
          pos.y += sin(time * 0.2 + position.z * 0.05) * 0.25;
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = (100.0 * sizeVariance) / -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float opacity;
        varying float vDistance;
        
        void main() {
          // Circular particle shape
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          if (dist > 0.5) discard;
          
          // Soft edges with nebula glow
          float alpha = 1.0 - smoothstep(0.2, 0.5, dist);
          
          // Depth fade
          float depthFade = 1.0 - (vDistance / 50.0);
          
          gl_FragColor = vec4(color, alpha * opacity * depthFade);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Glass/Refraction material - purple nebula glass
    this.materials.glass = new THREE.MeshStandardMaterial({
      color: 0x9D4EDD, // Purple nebula
      metalness: 0.85,
      roughness: 0.18,
      emissive: 0xFF1493, // Hot pink glow
      emissiveIntensity: 0.25,
    });
    this.materials.secondary = this.materials.glass.clone();
  }

  /**
   * Create hero geometry cluster for Scene 1
   * Primary brand identity object
   */
  createHeroCluster() {
    const group = new THREE.Group();
    group.name = 'heroCluster';

    const heroOrigin = new THREE.Vector3(-2.5, 1.2, -11);

    // Signature hero cluster with layered forms
    const heroCore = new THREE.Group();
    heroCore.position.copy(heroOrigin);

    const icoGeo = new THREE.IcosahedronGeometry(2.2, 4);
    const icoMesh = new THREE.Mesh(icoGeo, this.materials.hero.clone());
    icoMesh.material.envMapIntensity = 3.0;
    icoMesh.material.clearcoat = 1;
    icoMesh.material.clearcoatRoughness = 0.02;
    icoMesh.scale.setScalar(1.4);
    heroCore.add(icoMesh);

    // Hero cluster will have the main icosahedron and torus knot
    // Space Shark model will be loaded separately

    const knotGeo = new THREE.TorusKnotGeometry(0.95, 0.16, 200, 24);
    const knotMesh = new THREE.Mesh(knotGeo, this.materials.hero.clone());
    knotMesh.material.color.setHex(0xFFB6C1); // Soft pink
    knotMesh.rotation.set(Math.PI * 0.25, Math.PI * 0.15, 0);
    knotMesh.scale.setScalar(0.88);
    heroCore.add(knotMesh);

    group.add(heroCore);

    // Orbiting satellites
    const satelliteGeo = new THREE.TorusKnotGeometry(0.35, 0.08, 180, 24);
    for (let i = 0; i < 5; i++) {
      const satellite = new THREE.Mesh(satelliteGeo, this.materials.secondary.clone());
      satellite.material.color.setHex(0x9D4EDD); // Purple
      const angle = (i / 5) * Math.PI * 2;
      const radius = 4;
      satellite.position.set(
        heroOrigin.x + Math.cos(angle) * radius,
        heroOrigin.y + Math.sin(angle * 0.5) * 1.5,
        heroOrigin.z + Math.sin(angle) * radius
      );
      satellite.userData.orbitAngle = angle;
      satellite.userData.orbitRadius = radius;
      satellite.userData.orbitSpeed = 0.3 + Math.random() * 0.2;
      satellite.userData.orbitCenter = heroOrigin.clone();
      group.add(satellite);
    }

    // Add to scene and register
    this.scene.add(group);
    this.objects.heroCluster = group;
    this.sceneManager.addObjectToScene('hero', group);

    // Load Space Shark model
    this.loadSpaceShark(heroOrigin);

    return group;
  }

  /**
   * Load Space Shark 3D model from Sketchfab
   * 
   * SETUP REQUIRED:
   * 1. Download the Space Shark model from Sketchfab
   * 2. Create a /models folder in your project root
   * 3. Place the .glb file as: /models/space-shark.glb
   * 4. Make sure GLTFLoader is available in your Three.js build
   */
  loadSpaceShark(position) {
    // Check if GLTFLoader is available
    if (!window.THREE || !window.THREE.GLTFLoader) {
      console.warn('[GeometryLibrary] GLTFLoader not available, using fallback shark');
      this.createFallbackShark(position);
      return;
    }
    
    const loader = new THREE.GLTFLoader();
    
    // Path to your downloaded Space Shark model
    // Download from: https://sketchfab.com/3d-models/space-shark-cdbde9fd419644e3aeee3318aa7c1d68
    const modelUrl = './models/space-shark.glb';
    
    loader.load(
      modelUrl,
      (gltf) => {
        const shark = gltf.scene;
        
        // Position and scale the shark
        shark.position.copy(position);
        shark.position.y += 3; // Float above the hero cluster
        shark.position.z -= 2;
        shark.scale.setScalar(2.2); // Adjust size to fit scene
        
        // Apply premium materials to shark
        shark.traverse((child) => {
          if (child.isMesh) {
            // Preserve original textures but enhance materials
            if (child.material) {
              child.material.envMapIntensity = 1.5;
              child.material.metalness = Math.min((child.material.metalness || 0) + 0.2, 1);
              child.material.roughness = Math.max((child.material.roughness || 0.5) - 0.1, 0);
              
              // Enable transparency for fade effects
              child.material.transparent = true;
              child.material.opacity = 1;
            }
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        // Add rotation animation data
        shark.userData.rotationSpeed = 0.15;
        shark.userData.floatSpeed = 0.8;
        shark.userData.floatAmplitude = 0.6;
        shark.userData.baseY = shark.position.y;
        
        // Add to scene
        this.scene.add(shark);
        this.objects.spaceShark = shark;
        this.sceneManager.addObjectToScene('hero', shark);
        
        console.log('[GeometryLibrary] Space Shark loaded successfully');
      },
      (progress) => {
        if (progress.total > 0) {
          const percentComplete = (progress.loaded / progress.total) * 100;
          console.log(`[GeometryLibrary] Loading Space Shark: ${percentComplete.toFixed(0)}%`);
        }
      },
      (error) => {
        console.error('[GeometryLibrary] Error loading Space Shark:', error);
        console.log('[GeometryLibrary] Make sure to:');
        console.log('1. Download the model from Sketchfab');
        console.log('2. Place it in /models/space-shark.glb');
        console.log('3. Ensure GLTFLoader is available');
        // Fallback: Create a simple shark-like geometry
        this.createFallbackShark(position);
      }
    );
  }

  /**
   * Create fallback shark geometry if model fails to load
   */
  createFallbackShark(position) {
    const sharkGroup = new THREE.Group();
    
    // Shark body (elongated sphere)
    const bodyGeo = new THREE.SphereGeometry(1, 32, 32);
    const bodyMesh = new THREE.Mesh(bodyGeo, this.materials.hero.clone());
    bodyMesh.scale.set(1.5, 0.8, 3);
    bodyMesh.material.color.setHex(0x8B9DC3);
    sharkGroup.add(bodyMesh);
    
    // Dorsal fin
    const finGeo = new THREE.ConeGeometry(0.5, 1.5, 4);
    const finMesh = new THREE.Mesh(finGeo, this.materials.secondary.clone());
    finMesh.rotation.z = Math.PI / 2;
    finMesh.position.y = 0.8;
    finMesh.material.color.setHex(0x6B7D9B);
    sharkGroup.add(finMesh);
    
    // Tail
    const tailGeo = new THREE.ConeGeometry(0.8, 2, 3);
    const tailMesh = new THREE.Mesh(tailGeo, this.materials.secondary.clone());
    tailMesh.rotation.z = Math.PI / 2;
    tailMesh.position.z = -3;
    tailMesh.material.color.setHex(0x7B8DAB);
    sharkGroup.add(tailMesh);
    
    sharkGroup.position.copy(position);
    sharkGroup.position.y += 3;
    sharkGroup.position.z -= 2;
    sharkGroup.userData.rotationSpeed = 0.15;
    sharkGroup.userData.floatSpeed = 0.8;
    sharkGroup.userData.floatAmplitude = 0.6;
    
    this.scene.add(sharkGroup);
    this.objects.spaceShark = sharkGroup;
    this.sceneManager.addObjectToScene('hero', sharkGroup);
    
    console.log('[GeometryLibrary] Using fallback shark geometry');
  }

  /**
   * Create floating text planes for Scene 2 (Philosophy)
   */
  createPhilosophyElements() {
    const group = new THREE.Group();
    group.name = 'philosophyGroup';
    group.position.set(0, 0, -95);

    this.scene.add(group);
    this.objects.philosophyGroup = group;
    this.sceneManager.addObjectToScene('philosophy', group);

    return group;
  }

  /**
   * Create service constellation for Scene 3
   * Interactive node network
   */
  createServiceConstellation() {
    const group = new THREE.Group();
    group.name = 'serviceConstellation';
    group.position.set(0, 0, -165);

    // Create service nodes in circular arrangement
    const nodeCount = 6;
    const radius = 5;
    
    const nodeGroups = [];
    for (let i = 0; i < nodeCount; i++) {
      const angle = (i / nodeCount) * Math.PI * 2;
      const nodeGroup = new THREE.Group();
      
      // Node sphere
      const sphereGeo = new THREE.SphereGeometry(0.8, 20, 20);
      const sphereMesh = new THREE.Mesh(sphereGeo, this.materials.secondary.clone());
      sphereMesh.material.color.setHex(0xFF69B4); // Hot pink
      nodeGroup.add(sphereMesh);
      
      // Connection lines (will be created dynamically)
      nodeGroup.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle * 1.5) * 2,
        Math.sin(angle) * 2
      );
      
      nodeGroup.userData.angle = angle;
      nodeGroup.userData.baseY = nodeGroup.position.y;
      nodeGroup.userData.floatSpeed = 0.5 + Math.random() * 0.3;
      
      group.add(nodeGroup);
      nodeGroups.push(nodeGroup);
    }

    // Create connection lines between nodes
    if (!this.materials.line) {
      this.materials.line = new THREE.LineBasicMaterial({
        color: 0x9D4EDD,
        transparent: true,
        opacity: 0.3,
      });
    }

    for (let i = 0; i < nodeGroups.length; i++) {
      const node = nodeGroups[i];
      const nextNode = nodeGroups[(i + 1) % nodeGroups.length];
      
      const points = [
        node.position.clone(),
        nextNode.position.clone(),
      ];
      
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeo, this.materials.line);
      group.add(line);
    }

    this.scene.add(group);
    this.objects.serviceConstellation = group;
    this.sceneManager.addObjectToScene('services', group);

    return group;
  }

  /**
   * Create portal vortex for Scene 4 (Contact)
   */
  createContactPortal() {
    const group = new THREE.Group();
    group.name = 'contactPortal';
    group.position.set(0, 0, -250);

    this.scene.add(group);
    this.objects.contactPortal = group;
    this.sceneManager.addObjectToScene('contact', group);

    return group;
  }

  /**
   * Create depth-staged particle systems
   */
  createParticleLayers() {
    const layers = [];
    
    // Create 3 depth layers
    for (let layer = 0; layer < 3; layer++) {
      const particleCount = (200 - (layer * 50)) * 2;
      const positions = new Float32Array(particleCount * 3);
      const sizes = new Float32Array(particleCount);
      
      const depthRange = 100;
      const depthStart = -layer * depthRange;
      
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 50;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
        positions[i * 3 + 2] = depthStart + (Math.random() - 0.5) * depthRange;
        sizes[i] = 0.6 + Math.random() * 0.8;
      }
      
      const particleGeo = new THREE.BufferGeometry();
      particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      particleGeo.setAttribute('sizeVariance', new THREE.BufferAttribute(sizes, 1));
      
      const particles = new THREE.Points(particleGeo, this.materials.particle.clone());
      particles.userData.layer = layer;
      particles.userData.parallaxMultiplier = 1.8 - (layer * 0.6);
      
      this.scene.add(particles);
      layers.push(particles);
    }
    
    this.objects.particleLayers = layers;
    return layers;
  }

  /**
   * Update all geometry animations
   */
  update(time, scrollProgress) {
    const delta = this.lastUpdateTime > 0 ? Math.min(0.05, time - this.lastUpdateTime) : 0.016;
    this.lastUpdateTime = time;

    // Update shader uniforms
    Object.values(this.materials).forEach(material => {
      if (material.uniforms && material.uniforms.time) {
        material.uniforms.time.value = time;
      }
    });

    // Update hero cluster
    if (this.objects.heroCluster) {
      const hero = this.objects.heroCluster.children[0];
      hero.rotation.x = time * 0.2;
      hero.rotation.y = time * 0.3;
      this.applyPremiumMicroMotion(hero, time, delta);
      
      // Update satellites
      for (let i = 1; i < this.objects.heroCluster.children.length; i++) {
        const satellite = this.objects.heroCluster.children[i];
        satellite.userData.orbitAngle += satellite.userData.orbitSpeed * 0.01;
        
        const angle = satellite.userData.orbitAngle;
        const radius = satellite.userData.orbitRadius;
        const center = satellite.userData.orbitCenter || { x: 0, y: 0, z: -10 };
        
        satellite.position.x = center.x + Math.cos(angle) * radius;
        satellite.position.y = center.y + Math.sin(angle * 0.5) * 1.5;
        satellite.position.z = center.z + Math.sin(angle) * radius;
        
        satellite.rotation.x += 0.02;
        satellite.rotation.y += 0.03;
        this.applyPremiumMicroMotion(satellite, time, delta);
      }
      
      // Fade based on scene
      const visibility = this.sceneManager.getObjectVisibility('hero', scrollProgress);
      this.objects.heroCluster.traverse(child => {
        if (child.material && child.material.opacity !== undefined) {
          child.material.opacity = visibility * 0.85;
        }
      });
    }

    // Update Space Shark
    if (this.objects.spaceShark) {
      const shark = this.objects.spaceShark;
      
      // Smooth swimming rotation (shark faces forward)
      shark.rotation.y += shark.userData.rotationSpeed * 0.01;
      
      // Gentle roll motion (like swimming)
      shark.rotation.x = Math.sin(time * 0.3) * 0.08;
      shark.rotation.z = Math.cos(time * 0.4) * 0.05;
      
      // Vertical floating motion
      if (shark.userData.baseY) {
        const floatOffset = Math.sin(time * shark.userData.floatSpeed) * shark.userData.floatAmplitude;
        shark.position.y = shark.userData.baseY + floatOffset;
      }
      
      // Horizontal swimming motion (figure-8 pattern)
      const swimRadius = 1.2;
      shark.position.x += Math.sin(time * 0.5) * delta * swimRadius;
      shark.position.z += Math.cos(time * 0.3) * delta * swimRadius * 0.5;
      
      // Tail fin wiggle (if shark has animation mixer, this would use that instead)
      shark.traverse((child) => {
        if (child.isMesh && child.name.toLowerCase().includes('tail')) {
          child.rotation.y = Math.sin(time * 3) * 0.2;
        }
      });
      
      // Fade based on scene visibility
      const visibility = this.sceneManager.getObjectVisibility('hero', scrollProgress);
      shark.traverse(child => {
        if (child.material && child.material.transparent) {
          child.material.opacity = visibility * 0.9;
        }
      });
    }

    // Update philosophy group
    if (this.objects.philosophyGroup) {
      const torus = this.objects.philosophyGroup.children[0];
      if (torus) {
        torus.rotation.x = time * 0.15;
        torus.rotation.y = time * 0.2;
        this.applyPremiumMicroMotion(torus, time, delta);
      }

      for (let i = 1; i < this.objects.philosophyGroup.children.length; i++) {
        const ring = this.objects.philosophyGroup.children[i];
        if (ring.userData.rotationSpeed) {
          ring.rotation.z += ring.userData.rotationSpeed * 0.01;
        }
        this.applyPremiumMicroMotion(ring, time, delta);
      }
      
      const visibility = this.sceneManager.getObjectVisibility('philosophy', scrollProgress);
      this.objects.philosophyGroup.traverse(child => {
        if (child.material && child.material.opacity !== undefined) {
          child.material.opacity = visibility * 0.7;
        }
      });
    }

    // Update service constellation
    if (this.objects.serviceConstellation) {
      this.objects.serviceConstellation.children.forEach((child, i) => {
        if (child.userData.floatSpeed) {
          child.position.y = child.userData.baseY + Math.sin(time * child.userData.floatSpeed) * 0.5;
          child.traverse((node) => {
            if (node.isMesh) this.applyPremiumMicroMotion(node, time, delta);
          });
        }
      });
      
      const visibility = this.sceneManager.getObjectVisibility('services', scrollProgress);
      this.objects.serviceConstellation.traverse(child => {
        if (child.material && child.material.opacity !== undefined) {
          child.material.opacity = visibility * 0.8;
        }
      });
    }

    // Update contact portal
    if (this.objects.contactPortal) {
      this.objects.contactPortal.children.forEach((child, index) => {
        if (child.isMesh) {
          // Rotate each ring at different speeds
          if (child.userData.rotationSpeed !== undefined) {
            child.rotation.z += child.userData.rotationSpeed * 0.01;
            child.rotation.y += child.userData.rotationSpeed * 0.005;
          }
          this.applyPremiumMicroMotion(child, time, delta);
        }
      });
      
      const visibility = this.sceneManager.getObjectVisibility('contact', scrollProgress);
      this.objects.contactPortal.traverse(child => {
        if (child.material && child.material.opacity !== undefined) {
          child.material.opacity = visibility * 0.85;
        }
      });
    }

    // Update particles with parallax
    if (this.objects.particleLayers) {
      this.objects.particleLayers.forEach(particles => {
        particles.rotation.y = time * 0.02 * particles.userData.parallaxMultiplier;
        particles.position.y += Math.sin(time * 0.18 + particles.userData.layer) * 0.08 * delta;
      });
    }
  }

  applyPremiumMicroMotion(mesh, time, delta) {
    mesh.rotation.x += delta * 0.5;
    mesh.rotation.y += delta * 0.35;
    mesh.position.y += Math.sin(time * 0.6 + mesh.id) * 0.12 * delta;
  }

  /**
   * Dispose of all geometries and materials
   */
  dispose() {
    const uniqueGeometries = new Set();
    const uniqueMaterials = new Set();
    Object.values(this.geometries).forEach((geometry) => {
      if (geometry && !uniqueGeometries.has(geometry)) {
        uniqueGeometries.add(geometry);
        geometry.dispose();
      }
    });
    Object.values(this.materials).forEach((material) => {
      if (material && !uniqueMaterials.has(material)) {
        uniqueMaterials.add(material);
        material.dispose();
      }
    });
    Object.values(this.objects).forEach(obj => {
      obj.traverse((child) => {
        if (child.geometry && !uniqueGeometries.has(child.geometry)) {
          uniqueGeometries.add(child.geometry);
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((material) => {
              if (material && !uniqueMaterials.has(material)) {
                uniqueMaterials.add(material);
                material.dispose();
              }
            });
          } else if (!uniqueMaterials.has(child.material)) {
            uniqueMaterials.add(child.material);
            child.material.dispose();
          }
        }
      });
      if (obj.parent) obj.parent.remove(obj);
    });
  }
}
