/**
 * SCENE MANAGER - Narrative Zone Orchestration
 * 
 * Manages discrete 3D environments as narrative beats.
 * Each scene has spatial boundaries, camera targets, and transition states.
 * 
 * Architecture Philosophy:
 * - Scenes are spatial zones, not DOM sections
 * - Camera travels through scenes, not sections scrolling past camera
 * - Each scene has entry/hold/exit phases
 * - Transitions are choreographed, not abrupt
 */

export class SceneManager {
  constructor() {
    this.scenes = [];
    this.currentSceneIndex = 0;
    this.transitionProgress = 0;
    this.state = 'IDLE'; // IDLE, ANTICIPATE, TRANSITIONING, SETTLING
    
    this.config = {
      anticipationDistance: 0.15, // Start anticipating 15% before scene boundary
      settleOvershoot: 0.05, // Overshoot then settle back
      transitionDuration: 1.2, // Seconds for full transition
    };
  }

  /**
   * Define the narrative structure
   */
  defineScenes() {
    this.scenes = [
      {
        name: 'hero',
        zStart: 0,
        zEnd: -50,
        camera: {
          position: { x: 0, y: 0, z: 10 },
          lookAt: { x: 0, y: 0, z: 0 },
          fov: 75,
        },
        objects: [], // Populated by GeometryLibrary
        lighting: {
          ambient: 0x1a0a2e, // Deep purple space
          key: { color: 0xFF1493, intensity: 1.4 }, // Hot pink shark glow
        },
        shader: {
          colorA: [1.0, 0.08, 0.58], // Hot pink #FF1493
          colorB: [0.08, 0.04, 0.18], // Deep purple space
          frequency: 0.8,
        }
      },
      {
        name: 'philosophy',
        zStart: -50,
        zEnd: -120,
        camera: {
          position: { x: -5, y: 3, z: -80 },
          lookAt: { x: 0, y: 0, z: -85 },
          fov: 60,
        },
        objects: [],
        lighting: {
          ambient: 0x16001e, // Deep purple
          key: { color: 0x9D4EDD, intensity: 1.1 }, // Purple nebula
        },
        shader: {
          colorA: [0.62, 0.31, 0.87], // Purple #9D4EDD
          colorB: [0.09, 0.00, 0.12], // Dark purple
          frequency: 1.2,
        }
      },
      {
        name: 'services',
        zStart: -120,
        zEnd: -200,
        camera: {
          position: { x: 3, y: -2, z: -160 },
          lookAt: { x: 0, y: 0, z: -165 },
          fov: 50,
        },
        objects: [],
        lighting: {
          ambient: 0x1a0520, // Deep purple-pink
          key: { color: 0xFF69B4, intensity: 0.95 }, // Light pink
        },
        shader: {
          colorA: [1.0, 0.41, 0.71], // Light pink #FF69B4
          colorB: [0.10, 0.02, 0.13], // Deep space
          frequency: 1.5,
        }
      },
      {
        name: 'contact',
        zStart: -200,
        zEnd: -280,
        camera: {
          position: { x: 0, y: 5, z: -240 },
          lookAt: { x: 0, y: 0, z: -250 },
          fov: 80,
        },
        objects: [],
        lighting: {
          ambient: 0x0d0415, // Deep purple-black
          key: { color: 0x8B5CF6, intensity: 0.9 }, // Bright purple nebula
        },
        shader: {
          colorA: [0.55, 0.36, 0.96], // Bright purple #8B5CF6
          colorB: [0.05, 0.02, 0.08], // Deep purple space
          frequency: 2.0,
        }
      }
    ];
  }

  /**
   * Get current scene based on scroll progress
   * @param {number} scrollProgress - 0 to 1
   */
  getCurrentScene(scrollProgress) {
    const totalDistance = Math.abs(this.scenes[this.scenes.length - 1].zEnd);
    const currentZ = -scrollProgress * totalDistance;
    
    for (let i = 0; i < this.scenes.length; i++) {
      const scene = this.scenes[i];
      if (currentZ >= scene.zEnd && currentZ <= scene.zStart) {
        return { scene, index: i, localProgress: this.getLocalProgress(scene, currentZ) };
      }
    }
    
    return { scene: this.scenes[this.scenes.length - 1], index: this.scenes.length - 1, localProgress: 1 };
  }

  /**
   * Get progress within a scene (0 = start, 1 = end)
   */
  getLocalProgress(scene, currentZ) {
    const sceneLength = Math.abs(scene.zEnd - scene.zStart);
    const distanceInScene = Math.abs(currentZ - scene.zStart);
    return Math.min(1, Math.max(0, distanceInScene / sceneLength));
  }

  /**
   * Check if we should start anticipating next scene
   */
  shouldAnticipate(scene, localProgress) {
    return localProgress > (1 - this.config.anticipationDistance);
  }

  /**
   * Get interpolated camera properties for current position
   * Handles scene transitions with custom easing
   */
  getInterpolatedCamera(scrollProgress) {
    const { scene, index, localProgress } = this.getCurrentScene(scrollProgress);
    const nextScene = this.scenes[index + 1];
    
    if (!nextScene) {
      return {
        position: scene.camera.position,
        lookAt: scene.camera.lookAt,
        fov: scene.camera.fov,
      };
    }

    // Calculate transition progress if in anticipation or transition zone
    let transitionAmount = 0;
    
    if (localProgress > (1 - this.config.anticipationDistance)) {
      // In anticipation zone - ease into next scene
      const anticipateProgress = (localProgress - (1 - this.config.anticipationDistance)) / this.config.anticipationDistance;
      transitionAmount = this.easeInOutCubic(anticipateProgress) * 0.3; // 30% transition during anticipation
    }

    if (localProgress === 1) {
      // Fully in next scene
      transitionAmount = 1;
    }

    // Interpolate camera properties
    const currentCam = scene.camera;
    const nextCam = nextScene.camera;

    return {
      position: {
        x: this.lerp(currentCam.position.x, nextCam.position.x, transitionAmount),
        y: this.lerp(currentCam.position.y, nextCam.position.y, transitionAmount),
        z: this.lerp(currentCam.position.z, nextCam.position.z, transitionAmount),
      },
      lookAt: {
        x: this.lerp(currentCam.lookAt.x, nextCam.lookAt.x, transitionAmount),
        y: this.lerp(currentCam.lookAt.y, nextCam.lookAt.y, transitionAmount),
        z: this.lerp(currentCam.lookAt.z, nextCam.lookAt.z, transitionAmount),
      },
      fov: this.lerp(currentCam.fov, nextCam.fov, transitionAmount),
    };
  }

  /**
   * Get interpolated shader uniforms for smooth background transitions
   */
  getInterpolatedShader(scrollProgress) {
    const { scene, index, localProgress } = this.getCurrentScene(scrollProgress);
    const nextScene = this.scenes[index + 1];
    
    if (!nextScene) {
      return scene.shader;
    }

    let transitionAmount = 0;
    if (localProgress > (1 - this.config.anticipationDistance)) {
      const anticipateProgress = (localProgress - (1 - this.config.anticipationDistance)) / this.config.anticipationDistance;
      transitionAmount = this.easeInOutCubic(anticipateProgress);
    }

    return {
      colorA: [
        this.lerp(scene.shader.colorA[0], nextScene.shader.colorA[0], transitionAmount),
        this.lerp(scene.shader.colorA[1], nextScene.shader.colorA[1], transitionAmount),
        this.lerp(scene.shader.colorA[2], nextScene.shader.colorA[2], transitionAmount),
      ],
      colorB: [
        this.lerp(scene.shader.colorB[0], nextScene.shader.colorB[0], transitionAmount),
        this.lerp(scene.shader.colorB[1], nextScene.shader.colorB[1], transitionAmount),
        this.lerp(scene.shader.colorB[2], nextScene.shader.colorB[2], transitionAmount),
      ],
      frequency: this.lerp(scene.shader.frequency, nextScene.shader.frequency, transitionAmount),
    };
  }

  /**
   * Get lighting configuration for current scene
   */
  getLighting(scrollProgress) {
    const { scene } = this.getCurrentScene(scrollProgress);
    return scene.lighting;
  }

  /**
   * Utility: Linear interpolation
   */
  lerp(start, end, t) {
    return start + (end - start) * t;
  }

  /**
   * Utility: Cubic ease in-out
   */
  easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Utility: Exponential ease out (for settling)
   */
  easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  /**
   * Add object reference to scene
   */
  addObjectToScene(sceneName, object) {
    const scene = this.scenes.find(s => s.name === sceneName);
    if (scene) {
      scene.objects.push(object);
    }
  }

  /**
   * Get all objects for a scene
   */
  getSceneObjects(sceneName) {
    const scene = this.scenes.find(s => s.name === sceneName);
    return scene ? scene.objects : [];
  }

  /**
   * Calculate visibility opacity for scene objects based on camera distance
   * Objects fade in as camera approaches and fade out as it leaves
   */
  getObjectVisibility(sceneName, scrollProgress) {
    const scene = this.scenes.find(s => s.name === sceneName);
    if (!scene) return 0;

    const { scene: currentScene, localProgress } = this.getCurrentScene(scrollProgress);
    
    if (currentScene.name === sceneName) {
      // In scene - full visibility in middle, fade at edges
      if (localProgress < 0.2) {
        return localProgress / 0.2; // Fade in
      } else if (localProgress > 0.8) {
        return 1 - ((localProgress - 0.8) / 0.2); // Fade out
      }
      return 1; // Full visibility
    }

    return 0; // Not in scene
  }
}