import { gsap } from "./vendor/gsap/index.js";
import { ScrollTrigger } from "./vendor/gsap/ScrollTrigger.js";

gsap.registerPlugin(ScrollTrigger);

export class MotionOrchestrator {
  constructor(options = {}) {
    this.sections = new Map();
    this.context = null;
    this.options = {
      baseDuration: options.baseDuration ?? 0.9,
      baseStagger: options.baseStagger ?? 0.08,
      ease: options.ease ?? "power3.out",
    };
  }

  init() {
    this.context = gsap.context(() => {
      this.setupSections();
      this.setupCardInteractions();
    }, document.body);
  }

  setupSections() {
    const sectionElements = gsap.utils.toArray(".scene-section");

    sectionElements.forEach((section, index) => {
      this.registerSection(section, {
        index,
        revealDelay: index * 0.05,
        depthStart: 56 + index * 8,
        parallaxStrength: 14 + index * 2,
      });
    });
  }

  registerSection(section, config = {}) {
    const existing = this.sections.get(section);
    if (existing) {
      existing.reveal?.kill();
      existing.parallax?.kill();
      existing.blend?.kill();
    }

    const content = section.querySelector(".scene-content");
    if (!content) return;

    const revealItems = gsap.utils.toArray(
      ":scope .section-title, :scope .hero-subtitle, :scope .philosophy-card, :scope .service-card, :scope .contact-message, :scope .contact-form, :scope .contact-info",
      content
    );

    this.prepareTypography(content);
    this.applyReveal(section, content, revealItems, config);
    this.applyParallax(section, content, config);
    this.applyOpacityBlend(section);
  }

  prepareTypography(container) {
    const headings = gsap.utils.toArray(":scope .hero-title, :scope .section-title", container);

    headings.forEach((heading) => {
      if (heading.dataset.motionPrepared === "1") return;

      if (heading.classList.contains("hero-title")) {
        gsap.utils.toArray(".title-line", heading).forEach((line) => {
          line.classList.add("heading-mask");
          const span = document.createElement("span");
          span.className = "heading-word";
          span.textContent = line.textContent.trim();
          line.textContent = "";
          line.appendChild(span);
        });
      } else {
        const words = heading.textContent.trim().split(/\s+/);
        heading.innerHTML = words
          .map((word) => `<span class="heading-mask"><span class="heading-word">${word}</span></span>`)
          .join(" ");
      }

      heading.dataset.motionPrepared = "1";
    });
  }

  applyReveal(section, content, revealItems, config) {
    const headingWords = gsap.utils.toArray(".heading-word", content);
    const delay = config.revealDelay ?? 0;
    const depthStart = config.depthStart ?? 64;

    gsap.set(content, { willChange: "transform, opacity" });
    gsap.set(headingWords, { yPercent: 120, opacity: 0, rotateX: -8, force3D: true });
    gsap.set(revealItems, { y: depthStart, opacity: 0, force3D: true });

    const revealTimeline = gsap.timeline({
      defaults: { ease: this.options.ease, duration: this.options.baseDuration },
      scrollTrigger: {
        trigger: section,
        start: "top 78%",
        end: "top 35%",
        toggleActions: "play none none reverse",
      },
    });

    revealTimeline
      .to(headingWords, {
        yPercent: 0,
        opacity: 1,
        rotateX: 0,
        stagger: this.options.baseStagger * 0.9,
        delay,
      })
      .to(
        revealItems,
        {
          y: 0,
          opacity: 1,
          stagger: this.options.baseStagger,
          duration: this.options.baseDuration * 0.82,
          clearProps: "willChange",
        },
        "-=0.45"
      );

    this.sections.set(section, {
      ...(this.sections.get(section) || {}),
      reveal: revealTimeline,
    });
  }

  applyParallax(section, content, config) {
    const layers = [content, ...gsap.utils.toArray(".parallax-layer", section)];
    const viewportFactor = window.innerWidth < 768 ? 0.55 : 1;
    const strength = (config.parallaxStrength ?? 14) * viewportFactor;

    gsap.set(layers, { force3D: true, willChange: "transform" });

    const parallaxTween = gsap.to(layers, {
      y: (_, el) => (el === content ? -strength : -strength * 0.65),
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top bottom",
        end: "bottom top",
        scrub: 0.8,
      },
    });

    this.sections.set(section, {
      ...(this.sections.get(section) || {}),
      parallax: parallaxTween,
    });
  }

  applyOpacityBlend(section) {
    const blendTween = gsap.fromTo(
      section,
      { opacity: 0.4 },
      {
        opacity: 1,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top 90%",
          end: "center center",
          scrub: true,
        },
      }
    );

    this.sections.set(section, {
      ...(this.sections.get(section) || {}),
      blend: blendTween,
    });
  }

  setupCardInteractions() {
    const cards = gsap.utils.toArray(".service-card, .project-card, .pricing-card, .philosophy-card");

    cards.forEach((card) => {
      gsap.set(card, { transformOrigin: "50% 50%", force3D: true, willChange: "transform, box-shadow" });

      const hoverIn = () => {
        gsap.killTweensOf(card);
        gsap.to(card, {
          y: -12,
          scale: 1.015,
          boxShadow: "0 24px 44px rgba(10, 10, 10, 0.34)",
          duration: 0.28,
          ease: "power3.out",
          overwrite: "auto",
        });
      };

      const hoverOut = () => {
        gsap.killTweensOf(card);
        gsap.to(card, {
          y: 0,
          scale: 1,
          boxShadow: "0 0 0 rgba(10, 10, 10, 0)",
          duration: 0.45,
          ease: "power2.out",
          overwrite: "auto",
        });
      };

      card.addEventListener("mouseenter", hoverIn);
      card.addEventListener("mouseleave", hoverOut);
      card.addEventListener("focusin", hoverIn);
      card.addEventListener("focusout", hoverOut);
    });
  }

  refresh() {
    ScrollTrigger.refresh();
  }

  dispose() {
    this.sections.forEach((entry) => {
      entry.reveal?.kill();
      entry.parallax?.kill();
      entry.blend?.kill();
    });
    this.sections.clear();
    if (this.context) this.context.revert();
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  }
}
