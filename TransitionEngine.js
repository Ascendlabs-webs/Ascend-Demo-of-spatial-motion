/**
 * TRANSITION ENGINE - Scene Morph Orchestration
 * 
 * Manages state transitions between narrative scenes.
 * Handles geometry morphing, shader crossfades, and timing choreography.
 * 
 * Transition Anatomy:
 * 1. ANTICIPATE - Pre-transition micro-movements (15% before boundary)
 * 2. INITIATE - Trigger point, begin morph
 * 3. CROSSFADE - Shader/opacity interpolation
 * 4. SETTLE - Arrival easing with slight overshoot
 * 5. HOLD - Static scene state
 * 
 * Philosophy:
 * Transitions are performances, not cuts.
 * Every scene change tells a micro-story.
 */

export class TransitionEngine {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    
    this.state = 'IDLE';
    this.transitionProgress = 0;
    this.currentTransition = null;
    
    // Transition timing configuration
    this.config = {
      anticipationDuration: 0.3, // seconds
      morphDuration: 0.8,
      settleDuration: 0.4,
      overshootAmount: 0.08,
    };
    
    // Track previous scroll for direction detection
    this.previousScroll = 0;
    this.scrollDirection = 1; // 1 = forward, -1 = backward
    
    // Transition callbacks
    this.callbacks = {
      onAnticipate: [],
      onMorph: [],
      onSettle: [],
      onComplete: [],
    };
  }

  /**
   * Update transition state based on scroll
   * @param {number} scrollProgress - 0 to 1
   * @param {number} deltaTime - frame delta in seconds
   */
  update(scrollProgress, deltaTime) {
    // Detect scroll direction
    if (scrollProgress !== this.previousScroll) {
      this.scrollDirection = scrollProgress > this.previousScroll ? 1 : -1;
      this.previousScroll = scrollProgress;
    }

    const { scene, index, localProgress } = this.sceneManager.getCurrentScene(scrollProgress);
    
    // Check if we're in transition zone
    const isAnticipating = localProgress > 0.85 && this.scrollDirection > 0;
    const isTransitioning = localProgress > 0.95;
    
    // State machine
    switch (this.state) {
      case 'IDLE':
        if (isAnticipating) {
          this.enterAnticipation(scene, index);
        }
        break;
        
      case 'ANTICIPATE':
        if (isTransitioning) {
          this.enterMorph(scene, index);
        } else if (!isAnticipating) {
          this.state = 'IDLE';
        }
        break;
        
      case 'MORPHING':
        this.updateMorph(deltaTime);
        break;
        
      case 'SETTLING':
        this.updateSettle(deltaTime);
        break;
    }
  }

  /**
   * Enter anticipation phase
   */
  enterAnticipation(scene, index) {
    this.state = 'ANTICIPATE';
    this.transitionProgress = 0;
    
    console.log(`[Transition] Anticipating exit from ${scene.name}`);
    
    // Trigger anticipation callbacks
    this.callbacks.onAnticipate.forEach(cb => cb(scene, index));
    
    // Subtle pre-transition movements
    this.anticipatoryMotion(scene);
  }

  /**
   * Enter morph phase
   */
  enterMorph(scene, index) {
    this.state = 'MORPHING';
    this.transitionProgress = 0;
    
    const nextScene = this.sceneManager.scenes[index + 1];
    
    console.log(`[Transition] Morphing from ${scene.name} to ${nextScene?.name || 'end'}`);
    
    this.currentTransition = {
      from: scene,
      to: nextScene,
      startTime: Date.now(),
    };
    
    // Trigger morph callbacks
    this.callbacks.onMorph.forEach(cb => cb(scene, nextScene, index));
  }

  /**
   * Update morph phase
   */
  updateMorph(deltaTime) {
    this.transitionProgress += (deltaTime / this.config.morphDuration);
    
    if (this.transitionProgress >= 1) {
      this.enterSettle();
    }
  }

  /**
   * Enter settle phase
   */
  enterSettle() {
    this.state = 'SETTLING';
    this.transitionProgress = 0;
    
    console.log(`[Transition] Settling into ${this.currentTransition?.to?.name || 'end'}`);
    
    // Trigger settle callbacks
    this.callbacks.onSettle.forEach(cb => cb(this.currentTransition));
  }

  /**
   * Update settle phase with overshoot
   */
  updateSettle(deltaTime) {
    this.transitionProgress += (deltaTime / this.config.settleDuration);
    
    if (this.transitionProgress >= 1) {
      this.state = 'IDLE';
      
      // Trigger complete callbacks
      this.callbacks.onComplete.forEach(cb => cb(this.currentTransition));
      
      this.currentTransition = null;
    }
  }

  /**
   * Apply anticipatory motion to scene objects
   * Subtle movements hinting at upcoming transition
   */
  anticipatoryMotion(scene) {
    const objects = this.sceneManager.getSceneObjects(scene.name);
    
    objects.forEach(obj => {
      // Add slight forward momentum
      if (obj.position) {
        const anticipationOffset = this.scrollDirection * 0.5;
        obj.position.z += anticipationOffset;
      }
    });
  }

  /**
   * Get eased transition progress with overshoot
   */
  getEasedProgress(phase = 'morph') {
    const t = this.transitionProgress;
    
    switch (phase) {
      case 'morph':
        // Ease in-out with slight acceleration at end
        return t < 0.5
          ? 4 * t * t * t
          : 1 - Math.pow(-2 * t + 2, 3) / 2;
        
      case 'settle':
        // Elastic ease with overshoot
        const c4 = (2 * Math.PI) / 3;
        return t === 0
          ? 0
          : t === 1
          ? 1
          : -Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
        
      default:
        return t;
    }
  }

  /**
   * Register callback for transition events
   */
  on(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback);
    }
  }

  /**
   * Get current transition state data
   */
  getTransitionData() {
    return {
      state: this.state,
      progress: this.transitionProgress,
      easedProgress: this.getEasedProgress(this.state === 'MORPHING' ? 'morph' : 'settle'),
      transition: this.currentTransition,
    };
  }

  /**
   * Force transition to specific scene (for special interactions)
   */
  forceTransitionTo(sceneIndex, duration = 1) {
    const targetScene = this.sceneManager.scenes[sceneIndex];
    if (!targetScene) return;
    
    console.log(`[Transition] Forcing transition to ${targetScene.name}`);
    
    this.state = 'MORPHING';
    this.transitionProgress = 0;
    this.config.morphDuration = duration;
    
    this.currentTransition = {
      from: this.sceneManager.scenes[this.sceneManager.currentSceneIndex],
      to: targetScene,
      forced: true,
    };
  }

  /**
   * Reset transition state
   */
  reset() {
    this.state = 'IDLE';
    this.transitionProgress = 0;
    this.currentTransition = null;
  }
}

/**
 * MORPH TARGET SYSTEM
 * 
 * Manages geometry morphing between scene transitions.
 * Uses vertex interpolation for smooth shape transformations.
 */
export class MorphTargetManager {
  constructor() {
    this.morphPairs = new Map(); // Map of object ID to morph targets
    this.activeMorphs = [];
  }

  /**
   * Register a morph pair (source geometry -> target geometry)
   */
  registerMorph(objectId, sourceGeometry, targetGeometry, duration = 1) {
    this.morphPairs.set(objectId, {
      source: sourceGeometry,
      target: targetGeometry,
      duration,
      progress: 0,
      active: false,
    });
  }

  /**
   * Trigger morph animation
   */
  triggerMorph(objectId) {
    const morph = this.morphPairs.get(objectId);
    if (morph) {
      morph.active = true;
      morph.progress = 0;
      this.activeMorphs.push(objectId);
    }
  }

  /**
   * Update all active morphs
   */
  update(deltaTime) {
    this.activeMorphs = this.activeMorphs.filter(id => {
      const morph = this.morphPairs.get(id);
      if (!morph || !morph.active) return false;
      
      morph.progress += deltaTime / morph.duration;
      
      if (morph.progress >= 1) {
        morph.active = false;
        morph.progress = 1;
        return false;
      }
      
      // Perform vertex interpolation
      this.interpolateGeometry(morph);
      
      return true;
    });
  }

  /**
   * Interpolate between source and target geometry vertices
   */
  interpolateGeometry(morph) {
    const { source, target, progress } = morph;
    const eased = this.easeInOutQuart(progress);
    
    // This is a simplified version - in production, you'd need to ensure
    // geometries have same vertex count and properly update buffer attributes
    
    if (source.attributes && target.attributes) {
      const sourcePos = source.attributes.position.array;
      const targetPos = target.attributes.position.array;
      
      for (let i = 0; i < sourcePos.length; i++) {
        sourcePos[i] = sourcePos[i] + (targetPos[i] - sourcePos[i]) * eased;
      }
      
      source.attributes.position.needsUpdate = true;
    }
  }

  /**
   * Easing function
   */
  easeInOutQuart(t) {
    return t < 0.5
      ? 8 * t * t * t * t
      : 1 - Math.pow(-2 * t + 2, 4) / 2;
  }

  /**
   * Clean up
   */
  dispose() {
    this.morphPairs.clear();
    this.activeMorphs = [];
  }
}
