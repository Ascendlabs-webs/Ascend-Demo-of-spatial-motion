/**
 * CAMERA DIRECTOR - Cinematic Choreography Engine
 * 
 * Orchestrates camera movement as narrative device, not mere viewport.
 * Implements:
 * - Catmull-Rom spline paths for smooth trajectories
 * - Dynamic FOV for emotional emphasis
 * - Look-at target interpolation with anticipation
 * - Momentum-based mouse parallax
 * - Camera shake/drift for organic life
 * 
 * Philosophy:
 * Camera leads the viewer's attention through spatial story.
 * Movement should feel authored, not mechanical.
 */

import * as THREE from './vendor/three.module.js';

export class CameraDirector {
  constructor(camera, sceneManager) {
    this.camera = camera;
    this.sceneManager = sceneManager;
    
    // Current camera state
    this.targetPosition = new THREE.Vector3();
    this.targetLookAt = new THREE.Vector3();
    this.currentLookAt = new THREE.Vector3();
    this.targetFov = 75;
    
    // Mouse parallax state
    this.mouse = { x: 0, y: 0 };
    this.mouseVelocity = { x: 0, y: 0 };
    this.smoothMouse = { x: 0, y: 0 };
    
    // Momentum physics
    this.velocity = new THREE.Vector3();
    this.acceleration = new THREE.Vector3();
    
    // Organic motion
    this.drift = { x: 0, y: 0, z: 0 };
    this.driftSpeed = 0.0005;
    this.driftTime = 0;
    
    // Configuration
    this.config = {
      positionLerp: 0.08, // Camera position smoothing
      lookAtLerp: 0.06, // Look-at target smoothing (slightly slower for weight)
      fovLerp: 0.1, // FOV transition speed
      mouseInfluence: 0.4, // Mouse parallax strength
      mouseSmoothness: 0.12, // Mouse movement smoothing
      momentumDrag: 0.92, // Velocity decay
      driftAmplitude: 0.3, // Organic drift amount
      shakeEnabled: false, // Camera shake toggle
      shakeAmount: 0,
    };
    this.handleMouseMove = this.handleMouseMove.bind(this);

    this.setupEventListeners();
  }

  /**
   * Setup mouse tracking for parallax
   */
  setupEventListeners() {
    document.addEventListener('mousemove', this.handleMouseMove, { passive: true });
  }

  handleMouseMove(e) {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    // Calculate velocity for momentum
    this.mouseVelocity.x = x - this.mouse.x;
    this.mouseVelocity.y = y - this.mouse.y;
    
    this.mouse.x = x;
    this.mouse.y = y;
  }

  /**
   * Update camera based on scroll progress and interaction
   * @param {number} scrollProgress - 0 to 1
   * @param {number} deltaTime - Frame delta in seconds
   */
  update(scrollProgress, deltaTime) {
    // Get target camera state from scene manager
    const cameraState = this.sceneManager.getInterpolatedCamera(scrollProgress);
    
    // Set target position and look-at
    this.targetPosition.set(
      cameraState.position.x,
      cameraState.position.y,
      cameraState.position.z
    );
    
    this.targetLookAt.set(
      cameraState.lookAt.x,
      cameraState.lookAt.y,
      cameraState.lookAt.z
    );
    
    this.targetFov = cameraState.fov;

    // Apply mouse parallax influence
    this.applyMouseParallax();
    
    // Apply organic drift
    this.applyDrift(deltaTime);
    
    // Apply momentum physics
    this.applyMomentum();
    
    // Smooth interpolate to target
    this.camera.position.lerp(this.targetPosition, this.config.positionLerp);
    this.currentLookAt.lerp(this.targetLookAt, this.config.lookAtLerp);
    
    // Update look-at
    this.camera.lookAt(this.currentLookAt);
    
    // Smooth FOV transition
    if (Math.abs(this.camera.fov - this.targetFov) > 0.1) {
      this.camera.fov += (this.targetFov - this.camera.fov) * this.config.fovLerp;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Apply mouse parallax with momentum
   */
  applyMouseParallax() {
    // Smooth mouse movement
    this.smoothMouse.x += (this.mouse.x - this.smoothMouse.x) * this.config.mouseSmoothness;
    this.smoothMouse.y += (this.mouse.y - this.smoothMouse.y) * this.config.mouseSmoothness;
    
    // Calculate parallax offset based on current scene depth
    const depthFactor = Math.abs(this.targetPosition.z) / 100; // Deeper = more parallax
    const influenceMultiplier = this.config.mouseInfluence * (1 + depthFactor * 0.3);
    
    // Apply to target position (not direct to camera for smoothness)
    this.targetPosition.x += this.smoothMouse.x * influenceMultiplier * 2;
    this.targetPosition.y += this.smoothMouse.y * influenceMultiplier * 1.5;
    
    // Also affect look-at for subtle gaze shift
    this.targetLookAt.x += this.smoothMouse.x * influenceMultiplier * 0.5;
    this.targetLookAt.y += this.smoothMouse.y * influenceMultiplier * 0.5;
  }

  /**
   * Apply organic drift using perlin-like motion
   */
  applyDrift(deltaTime) {
    this.driftTime += deltaTime * this.driftSpeed * 60;
    
    // Create organic motion using multiple sine waves at different frequencies
    this.drift.x = Math.sin(this.driftTime * 1.3) * 0.5 + Math.sin(this.driftTime * 2.7) * 0.3;
    this.drift.y = Math.cos(this.driftTime * 1.7) * 0.4 + Math.cos(this.driftTime * 3.1) * 0.2;
    this.drift.z = Math.sin(this.driftTime * 0.9) * 0.3 + Math.cos(this.driftTime * 2.3) * 0.2;
    
    // Apply drift to camera position
    this.camera.position.x += this.drift.x * this.config.driftAmplitude;
    this.camera.position.y += this.drift.y * this.config.driftAmplitude;
    this.camera.position.z += this.drift.z * this.config.driftAmplitude * 0.5;
  }

  /**
   * Apply momentum physics for weight
   */
  applyMomentum() {
    // Convert mouse velocity to acceleration
    this.acceleration.x = this.mouseVelocity.x * 0.1;
    this.acceleration.y = this.mouseVelocity.y * 0.1;
    
    // Update velocity
    this.velocity.add(this.acceleration);
    this.velocity.multiplyScalar(this.config.momentumDrag);
    
    // Apply velocity to camera
    this.camera.position.add(this.velocity);
    
    // Decay mouse velocity
    this.mouseVelocity.x *= 0.85;
    this.mouseVelocity.y *= 0.85;
  }

  /**
   * Trigger camera shake (for impact moments)
   * @param {number} intensity - 0 to 1
   * @param {number} duration - seconds
   */
  shake(intensity = 0.5, duration = 0.3) {
    this.config.shakeEnabled = true;
    this.config.shakeAmount = intensity;
    
    setTimeout(() => {
      this.config.shakeEnabled = false;
      this.config.shakeAmount = 0;
    }, duration * 1000);
  }

  /**
   * Get camera shake offset if enabled
   */
  getShakeOffset() {
    if (!this.config.shakeEnabled) return { x: 0, y: 0, z: 0 };
    
    return {
      x: (Math.random() - 0.5) * this.config.shakeAmount,
      y: (Math.random() - 0.5) * this.config.shakeAmount,
      z: (Math.random() - 0.5) * this.config.shakeAmount * 0.5,
    };
  }

  /**
   * Set mouse influence strength
   */
  setMouseInfluence(amount) {
    this.config.mouseInfluence = Math.max(0, Math.min(1, amount));
  }

  /**
   * Enable/disable camera features for performance
   */
  setQuality(quality) {
    switch(quality) {
      case 'high':
        this.config.positionLerp = 0.08;
        this.config.lookAtLerp = 0.06;
        this.config.driftAmplitude = 0.3;
        break;
      case 'medium':
        this.config.positionLerp = 0.12;
        this.config.lookAtLerp = 0.1;
        this.config.driftAmplitude = 0.15;
        break;
      case 'low':
        this.config.positionLerp = 0.2;
        this.config.lookAtLerp = 0.18;
        this.config.driftAmplitude = 0;
        break;
    }
  }

  /**
   * Animate camera to specific position (for special moments)
   * Returns promise that resolves when animation completes
   */
  animateTo(position, lookAt, fov, duration = 2) {
    return new Promise((resolve) => {
      const startPos = this.camera.position.clone();
      const startLookAt = this.currentLookAt.clone();
      const startFov = this.camera.fov;
      
      const targetPos = new THREE.Vector3(position.x, position.y, position.z);
      const targetLook = new THREE.Vector3(lookAt.x, lookAt.y, lookAt.z);
      
      let elapsed = 0;
      
      const animate = (deltaTime) => {
        elapsed += deltaTime;
        const progress = Math.min(1, elapsed / duration);
        const eased = this.easeInOutQuart(progress);
        
        this.camera.position.lerpVectors(startPos, targetPos, eased);
        this.currentLookAt.lerpVectors(startLookAt, targetLook, eased);
        this.camera.fov = startFov + (fov - startFov) * eased;
        this.camera.lookAt(this.currentLookAt);
        this.camera.updateProjectionMatrix();
        
        if (progress < 1) {
          requestAnimationFrame(() => animate(0.016));
        } else {
          resolve();
        }
      };
      
      animate(0);
    });
  }

  /**
   * Easing function for smooth animations
   */
  easeInOutQuart(t) {
    return t < 0.5
      ? 8 * t * t * t * t
      : 1 - Math.pow(-2 * t + 2, 4) / 2;
  }

  /**
   * Reset camera to default state
   */
  reset() {
    this.velocity.set(0, 0, 0);
    this.acceleration.set(0, 0, 0);
    this.mouse = { x: 0, y: 0 };
    this.smoothMouse = { x: 0, y: 0 };
    this.mouseVelocity = { x: 0, y: 0 };
  }

  /**
   * Cleanup
   */
  dispose() {
    document.removeEventListener('mousemove', this.handleMouseMove);
  }
}
