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
      color: 0xffffff,
      metalness: 0.85,
      roughness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      transmission: 0.25,
      thickness: 1.2,
      envMapIntensity: 2.0,
    });

    // Particle material
    this.materials.particle = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0x9D4EDD) },
        opacity: { value: 0.6 },
      },
      vertexShader: `
        uniform float time;
        varying float vDistance;
        attribute float sizeVariance;
        
        void main() {
          vDistance = length(position);
          vec3 pos = position;
          
          // Slow floating motion
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
          
          // Soft edges
          float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
          
          // Depth fade
          float depthFade = 1.0 - (vDistance / 50.0);
          
          gl_FragColor = vec4(color, alpha * opacity * depthFade);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Glass/Refraction material for depth objects
    this.materials.glass = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.75,
      roughness: 0.25,
      emissive: 0x1a1a1a,
      emissiveIntensity: 0.15,
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

    const spiralPoints = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const a = t * Math.PI * 4.5;
      const r = 2.0 - t * 0.8;
      spiralPoints.push(new THREE.Vector3(
        Math.cos(a) * r,
        (t - 0.5) * 2.2,
        Math.sin(a) * r
      ));
    }
    const tubeGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiralPoints), 120, 0.07, 14, false);
    const tubeMesh = new THREE.Mesh(tubeGeo, this.materials.secondary.clone());
    tubeMesh.material.color.setHex(0xdac4ff);
    heroCore.add(tubeMesh);

    const knotGeo = new THREE.TorusKnotGeometry(1.3, 0.22, 220, 28);
    const knotMesh = new THREE.Mesh(knotGeo, this.materials.hero.clone());
    knotMesh.material.color.setHex(0xf4edff);
    knotMesh.rotation.set(Math.PI * 0.25, Math.PI * 0.15, 0);
    heroCore.add(knotMesh);

    group.add(heroCore);

    // Orbiting satellites
    const satelliteGeo = new THREE.TorusKnotGeometry(0.35, 0.08, 180, 24);
    for (let i = 0; i < 5; i++) {
      const satellite = new THREE.Mesh(satelliteGeo, this.materials.secondary.clone());
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

    return group;
  }

  /**
   * Create floating text planes for Scene 2 (Philosophy)
   */
  createPhilosophyElements() {
    const group = new THREE.Group();
    group.name = 'philosophyGroup';
    group.position.set(0, 0, -85);

    // Create torus knot as philosophical symbol
    const torusGeo = new THREE.TorusKnotGeometry(2, 0.6, 100, 16);
    const torusMesh = new THREE.Mesh(torusGeo, this.materials.hero.clone());
    torusMesh.material.color.setHex(0x9D4EDD);
    group.add(torusMesh);

    // Orbiting rings for depth
    for (let i = 0; i < 3; i++) {
      const ringGeo = new THREE.TorusKnotGeometry(3 + i, 0.1, 240, 32);
      const ringMesh = new THREE.Mesh(ringGeo, this.materials.glass);
      ringMesh.rotation.x = Math.PI / 2 + (i * 0.2);
      ringMesh.rotation.y = i * 0.5;
      ringMesh.userData.rotationSpeed = 0.1 + i * 0.05;
      group.add(ringMesh);
    }

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
      sphereMesh.material.color.setHex(0xC77DFF);
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
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x9D4EDD,
      transparent: true,
      opacity: 0.3,
    });

    for (let i = 0; i < nodeGroups.length; i++) {
      const node = nodeGroups[i];
      const nextNode = nodeGroups[(i + 1) % nodeGroups.length];
      
      const points = [
        node.position.clone(),
        nextNode.position.clone(),
      ];
      
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeo, lineMaterial);
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

    // Spiral vortex geometry
    const spiralPoints = [];
    const spiralSegments = 100;
    const spiralRevolutions = 5;
    
    for (let i = 0; i < spiralSegments; i++) {
      const t = i / spiralSegments;
      const angle = t * Math.PI * 2 * spiralRevolutions;
      const radius = 5 * (1 - t);
      
      spiralPoints.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        t * -5
      ));
    }

    const spiralGeo = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(spiralPoints),
      64,
      0.15,
      8,
      false
    );
    
    const spiralMesh = new THREE.Mesh(spiralGeo, this.materials.hero.clone());
    spiralMesh.material.color.setHex(0xE0AAFF);
    group.add(spiralMesh);

    // Portal ring
    const ringGeo = new THREE.TorusKnotGeometry(6, 0.2, 260, 36);
    const ringMesh = new THREE.Mesh(ringGeo, this.materials.secondary.clone());
    ringMesh.rotation.x = Math.PI / 2;
    group.add(ringMesh);

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

    // Update philosophy group
    if (this.objects.philosophyGroup) {
      const torus = this.objects.philosophyGroup.children[0];
      torus.rotation.x = time * 0.15;
      torus.rotation.y = time * 0.2;
      this.applyPremiumMicroMotion(torus, time, delta);
      
      // Update rings
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
      this.objects.contactPortal.rotation.z = time * 0.1;
      this.objects.contactPortal.children.forEach((child) => {
        if (child.isMesh) this.applyPremiumMicroMotion(child, time, delta);
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
    Object.values(this.geometries).forEach(geo => geo.dispose());
    Object.values(this.materials).forEach(mat => mat.dispose());
    Object.values(this.objects).forEach(obj => {
      if (obj.parent) obj.parent.remove(obj);
    });
  }
}
