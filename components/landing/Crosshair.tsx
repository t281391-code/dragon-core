"use client";

import { useEffect, useId, useRef, type RefObject } from "react";
import { gsap } from "gsap";

const lerp = (a: number, b: number, n: number): number => (1 - n) * a + n * b;

const getMousePos = (event: MouseEvent, container: HTMLElement) => {
  const bounds = container.getBoundingClientRect();
  return {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
  };
};

interface CrosshairProps {
  color?: string;
  containerRef: RefObject<HTMLElement | null>;
}

export default function Crosshair({
  color = "rgba(22, 36, 133, 0.92)",
  containerRef,
}: CrosshairProps) {
  const lineHorizontalRef = useRef<HTMLDivElement>(null);
  const lineVerticalRef = useRef<HTMLDivElement>(null);
  const coordLabelRef = useRef<HTMLDivElement>(null);
  const filterXRef = useRef<SVGFETurbulenceElement>(null);
  const filterYRef = useRef<SVGFETurbulenceElement>(null);
  const filterId = useId().replace(/:/g, "");

  useEffect(() => {
    const container = containerRef.current;
    const lineHorizontal = lineHorizontalRef.current;
    const lineVertical = lineVerticalRef.current;
    const filterX = filterXRef.current;
    const filterY = filterYRef.current;

    const coordLabel = coordLabelRef.current;
    if (!container || !lineHorizontal || !lineVertical || !filterX || !filterY || !coordLabel) {
      return;
    }

    let mouse = { x: 0, y: 0 };
    let current = { x: 0, y: 0 };
    let hasStarted = false;
    let isActive = false;
    let frameId = 0;

    const primitives = { turbulence: 0.000001 };
    const lines = [lineHorizontal, lineVertical];

    const updateFilters = () => {
      filterX.setAttribute("baseFrequency", primitives.turbulence.toString());
      filterY.setAttribute("baseFrequency", primitives.turbulence.toString());
    };

    const stopRender = () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
    };

    const render = () => {
      current.x = lerp(current.x, mouse.x, 0.18);
      current.y = lerp(current.y, mouse.y, 0.18);

      gsap.set(lineVertical, { x: current.x });
      gsap.set(lineHorizontal, { y: current.y });

      if (isActive) {
        frameId = requestAnimationFrame(render);
      }
    };

    const startRender = () => {
      if (!frameId) {
        frameId = requestAnimationFrame(render);
      }
    };

    gsap.set(lines, { autoAlpha: 0 });
    updateFilters();

    const distortion = gsap.timeline({
      paused: true,
      onStart: () => {
        lineHorizontal.style.filter = `url(#${filterId}-noise-x)`;
        lineVertical.style.filter = `url(#${filterId}-noise-y)`;
      },
      onUpdate: updateFilters,
      onComplete: () => {
        lineHorizontal.style.filter = "none";
        lineVertical.style.filter = "none";
      },
    });

    distortion.fromTo(
      primitives,
      { turbulence: 0.16 },
      {
        duration: 0.45,
        ease: "power2.out",
        turbulence: 0.000001,
      },
    );

    const showLines = () => {
      gsap.to(lines, {
        autoAlpha: 1,
        duration: 0.22,
        ease: "power2.out",
        overwrite: true,
      });
      coordLabel.style.opacity = "1";
    };

    const hideLines = () => {
      gsap.to(lines, {
        autoAlpha: 0,
        duration: 0.18,
        ease: "power2.out",
        overwrite: true,
      });
      coordLabel.style.opacity = "0";
    };

    const updateCoordLabel = (px: number, py: number) => {
      const bounds = container.getBoundingClientRect();
      const xPct = Math.round((px / bounds.width) * 100);
      const yPct = Math.round((py / bounds.height) * 100);
      coordLabel.textContent = `x: ${xPct}  y: ${yPct}`;
      const offsetX = px > bounds.width * 0.75 ? -110 : 14;
      const offsetY = py > bounds.height * 0.85 ? -28 : 10;
      coordLabel.style.transform = `translate(${px + offsetX}px, ${py + offsetY}px)`;
    };

    const handleMouseEnter = (event: MouseEvent) => {
      mouse = getMousePos(event, container);
      current = { ...mouse };
      isActive = true;
      hasStarted = true;
      updateCoordLabel(mouse.x, mouse.y);
      showLines();
      distortion.restart();
      startRender();
    };

    const handleMouseMove = (event: MouseEvent) => {
      mouse = getMousePos(event, container);
      updateCoordLabel(mouse.x, mouse.y);

      if (!hasStarted) {
        current = { ...mouse };
        hasStarted = true;
        startRender();
      }

      if (!isActive) {
        isActive = true;
        showLines();
        startRender();
      }
    };

    const handleMouseLeave = () => {
      isActive = false;
      hasStarted = false;
      hideLines();
      stopRender();
    };

    const interactiveTargets = container.querySelectorAll("a, button");
    const handleInteractiveEnter = () => distortion.restart();
    const handleInteractiveLeave = () => {
      distortion.progress(1);
      lineHorizontal.style.filter = "none";
      lineVertical.style.filter = "none";
    };

    container.addEventListener("mouseenter", handleMouseEnter);
    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    interactiveTargets.forEach((element) => {
      element.addEventListener("mouseenter", handleInteractiveEnter);
      element.addEventListener("mouseleave", handleInteractiveLeave);
    });

    return () => {
      stopRender();
      distortion.kill();
      container.removeEventListener("mouseenter", handleMouseEnter);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      interactiveTargets.forEach((element) => {
        element.removeEventListener("mouseenter", handleInteractiveEnter);
        element.removeEventListener("mouseleave", handleInteractiveLeave);
      });
    };
  }, [containerRef, filterId]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 20,
      }}
    >
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <defs>
          <filter id={`${filterId}-noise-x`}>
            <feTurbulence ref={filterXRef} type="fractalNoise" baseFrequency="0.000001" numOctaves="1" />
            <feDisplacementMap in="SourceGraphic" scale="36" />
          </filter>
          <filter id={`${filterId}-noise-y`}>
            <feTurbulence ref={filterYRef} type="fractalNoise" baseFrequency="0.000001" numOctaves="1" />
            <feDisplacementMap in="SourceGraphic" scale="36" />
          </filter>
        </defs>
      </svg>
      <div
        ref={lineHorizontalRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "1px",
          background: color,
          opacity: 0,
          transform: "translateY(-50%)",
          boxShadow: `0 0 12px ${color}`,
        }}
      />
      <div
        ref={lineVerticalRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "1px",
          height: "100%",
          background: color,
          opacity: 0,
          transform: "translateX(-50%)",
          boxShadow: `0 0 12px ${color}`,
        }}
      />
      <div
        ref={coordLabelRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          opacity: 0,
          zIndex: 50,
          pointerEvents: "none",
          fontFamily: "monospace",
          fontSize: "12px",
          fontWeight: 600,
          color: "#00d4ff",
          background: "rgba(3, 12, 26, 0.85)",
          padding: "3px 8px",
          borderRadius: "4px",
          whiteSpace: "nowrap",
          border: "1px solid rgba(0, 212, 255, 0.5)",
          lineHeight: "1.8",
          willChange: "transform",
          transition: "opacity 0.15s ease",
        }}
      />
    </div>
  );
}
