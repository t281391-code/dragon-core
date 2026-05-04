"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from "react";
import { Canvas, invalidate, useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Sparkles,
  Html,
  OrbitControls,
  useFBX,
  useGLTF,
  useProgress,
} from "@react-three/drei";
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const isMeshObject = (object: THREE.Object3D): object is THREE.Mesh =>
  "isMesh" in object && object.isMesh === true;

const isLightObject = (object: THREE.Object3D): object is THREE.Light =>
  "isLight" in object && object.isLight === true;

export interface ViewerProps {
  url: string;
  width?: number | string;
  height?: number | string;
  modelXOffset?: number;
  modelYOffset?: number;
  defaultRotationX?: number;
  defaultRotationY?: number;
  defaultZoom?: number;
  minZoomDistance?: number;
  maxZoomDistance?: number;
  enableMouseParallax?: boolean;
  enableManualRotation?: boolean;
  enableHoverRotation?: boolean;
  enableManualZoom?: boolean;
  ambientIntensity?: number;
  keyLightIntensity?: number;
  fillLightIntensity?: number;
  rimLightIntensity?: number;
  environmentPreset?: "city" | "sunset" | "night" | "dawn" | "studio" | "apartment" | "forest" | "park" | "none";
  autoFrame?: boolean;
  placeholderSrc?: string;
  showScreenshotButton?: boolean;
  fadeIn?: boolean;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  onModelLoaded?: () => void;
}

const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
const deg2rad = (degrees: number) => (degrees * Math.PI) / 180;
const DECIDE = 8;
const ROTATE_SPEED = 0.0042;
const INERTIA = 0.918;
const PARALLAX_MAG = 0.022;
const PARALLAX_EASE = 0.08;
const HOVER_MAG = deg2rad(2.8);
const HOVER_EASE = 0.1;
const FLOAT_MAG = 0.035;
const FLOAT_SPEED = 1.05;

const Loader: FC<{ placeholderSrc?: string }> = ({ placeholderSrc }) => {
  const { progress, active } = useProgress();

  if (!active && placeholderSrc) return null;

  return (
    <Html center>
      {placeholderSrc ? (
        <img
          src={placeholderSrc}
          width={128}
          height={128}
          alt=""
          style={{ filter: "blur(8px)", borderRadius: 8, opacity: 0.82 }}
        />
      ) : (
        <div
          style={{
            padding: "0.55rem 0.9rem",
            border: "1px solid rgba(168, 222, 255, 0.28)",
            borderRadius: 999,
            background: "rgba(8, 16, 30, 0.78)",
            color: "#d9f6ff",
            fontSize: "0.82rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          {`${Math.round(progress)}%`}
        </div>
      )}
    </Html>
  );
};

const DesktopControls: FC<{
  pivot: THREE.Vector3;
  min: number;
  max: number;
  zoomEnabled: boolean;
}> = ({ pivot, min, max, zoomEnabled }) => {
  const ref = useRef<any>(null);

  useFrame(() => {
    ref.current?.target.copy(pivot);
  });

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enablePan={false}
      enableRotate={false}
      enableZoom={zoomEnabled}
      minDistance={min}
      maxDistance={max}
    />
  );
};

const createGlowTexture = (innerColor: string, outerColor: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.Texture();

  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, innerColor);
  gradient.addColorStop(0.45, outerColor);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};


const SceneBackdrop: FC = () => {
  const glowTexture = useMemo(() => createGlowTexture("rgba(142, 247, 255, 0.95)", "rgba(21, 121, 184, 0.3)"), []);
  const cyanGlowTexture = useMemo(
    () => createGlowTexture("rgba(101, 255, 233, 0.88)", "rgba(36, 123, 214, 0.18)"),
    [],
  );
  return (
    <group>
      <mesh position={[0, 0.3, -5.8]} scale={[14, 9.8, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#06111e" transparent opacity={0} depthWrite={false} />
      </mesh>

      <sprite position={[0, 0.7, -4.6]} scale={[6.8, 6.8, 1]}>
        <spriteMaterial
          map={glowTexture}
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          color="#8fe8ff"
        />
      </sprite>

      <sprite position={[0.35, 0.25, -4.3]} scale={[4.2, 4.2, 1]}>
        <spriteMaterial
          map={cyanGlowTexture}
          transparent
          opacity={0.38}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          color="#6efff0"
        />
      </sprite>

      <Sparkles
        count={26}
        size={2.2}
        speed={0.18}
        opacity={0.24}
        scale={[6.2, 3.8, 3.2]}
        position={[0, 0.2, -1.6]}
        color="#9aefff"
      />
    </group>
  );
};

const StyledPrimitive: FC<{
  object: THREE.Object3D;
  onReady: (object: THREE.Object3D) => void;
}> = ({ object, onReady }) => {
  const clone = useMemo(() => object.clone(true), [object]);

  useEffect(() => {
    clone.traverse((child) => {
      if (!isMeshObject(child)) return;

      const name = child.name.toLowerCase();
      let color = new THREE.Color("#f97316");
      let emissive = new THREE.Color("#7c2d12");
      let emissiveIntensity = 0.4;
      let metalness = 0.2;
      let roughness = 0.38;
      let material: THREE.Material;

      if (name.includes("frame") || name.includes("stand")) {
        color = new THREE.Color("#0f2238");
        emissive = new THREE.Color("#07121f");
        metalness = 0.65;
        roughness = 0.42;
        emissiveIntensity = 0.12;
      } else if (name.includes("screen")) {
        color = new THREE.Color("#7be8ff");
        emissive = new THREE.Color("#36d5ff");
        metalness = 0.05;
        roughness = 0.08;
        emissiveIntensity = 1.05;
      } else if (name.includes("header") || name.includes("top")) {
        color = new THREE.Color("#f5fbff");
        emissive = new THREE.Color("#82dfff");
        metalness = 0.06;
        roughness = 0.12;
        emissiveIntensity = 0.62;
      } else if (name.includes("card") || name.includes("widget")) {
        color = new THREE.Color("#1a2f1a");
        emissive = new THREE.Color("#0f4c0f");
        metalness = 0.22;
        roughness = 0.2;
        emissiveIntensity = 0.38;
      } else if (name.includes("bar") || name.includes("accent")) {
        color = new THREE.Color("#f97316");
        emissive = new THREE.Color("#7c2d12");
        metalness = 0.12;
        roughness = 0.14;
        emissiveIntensity = 0.78;
      } else if (name.includes("gauge") || name.includes("needle") || name.includes("beacon")) {
        color = new THREE.Color("#f2fbff");
        emissive = new THREE.Color("#94ebff");
        metalness = 0.12;
        roughness = 0.16;
        emissiveIntensity = 0.7;
      }

      if (name.includes("screen")) {
        material = new THREE.MeshPhysicalMaterial({
          color,
          emissive,
          emissiveIntensity,
          metalness,
          roughness,
          transmission: 0.18,
          thickness: 0.7,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
          reflectivity: 0.72,
          transparent: true,
          opacity: 0.98,
        });
      } else if (name.includes("card") || name.includes("widget") || name.includes("bar")) {
        material = new THREE.MeshPhysicalMaterial({
          color,
          emissive,
          emissiveIntensity,
          metalness,
          roughness,
          clearcoat: 0.65,
          clearcoatRoughness: 0.18,
          reflectivity: 0.56,
        });
      } else {
        material = new THREE.MeshStandardMaterial({
          color,
          emissive,
          emissiveIntensity,
          metalness,
          roughness,
        });
      }

      child.material = material;
    });

    onReady(clone);
  }, [clone, onReady]);

  return <primitive object={clone} />;
};

const GLTFAsset: FC<{ url: string; onReady: (object: THREE.Object3D) => void }> = ({ url, onReady }) => {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    clone.traverse((child) => {
      if (!isMeshObject(child)) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });
    onReady(clone);
  }, [clone, onReady]);

  return <primitive object={clone} />;
};

const FBXAsset: FC<{ url: string; onReady: (object: THREE.Object3D) => void }> = ({ url, onReady }) => {
  const object = useFBX(url);
  return <StyledPrimitive object={object} onReady={onReady} />;
};

const OBJAsset: FC<{ url: string; onReady: (object: THREE.Object3D) => void }> = ({ url, onReady }) => {
  const object = useLoader(OBJLoader, url);
  return <StyledPrimitive object={object} onReady={onReady} />;
};

const LoadedAsset: FC<{
  url: string;
  ext: string;
  onReady: (object: THREE.Object3D) => void;
}> = ({ url, ext, onReady }) => {
  if (ext === "glb" || ext === "gltf") return <GLTFAsset url={url} onReady={onReady} />;
  if (ext === "fbx") return <FBXAsset url={url} onReady={onReady} />;
  if (ext === "obj") return <OBJAsset url={url} onReady={onReady} />;
  return null;
};

interface ModelInnerProps {
  url: string;
  xOff: number;
  yOff: number;
  pivot: THREE.Vector3;
  initYaw: number;
  initPitch: number;
  minZoom: number;
  maxZoom: number;
  enableMouseParallax: boolean;
  enableManualRotation: boolean;
  enableHoverRotation: boolean;
  enableManualZoom: boolean;
  autoFrame: boolean;
  fadeIn: boolean;
  autoRotate: boolean;
  autoRotateSpeed: number;
  onLoaded?: () => void;
}

const ModelInner: FC<ModelInnerProps> = ({
  url,
  xOff,
  yOff,
  pivot,
  initYaw,
  initPitch,
  minZoom,
  maxZoom,
  enableMouseParallax,
  enableManualRotation,
  enableHoverRotation,
  enableManualZoom,
  autoFrame,
  fadeIn,
  autoRotate,
  autoRotateSpeed,
  onLoaded,
}) => {
  const outer = useRef<THREE.Group>(null!);
  const inner = useRef<THREE.Group>(null!);
  const { camera, gl } = useThree();
  const [content, setContent] = useState<THREE.Object3D | null>(null);

  const vel = useRef({ x: 0, y: 0 });
  const tPar = useRef({ x: 0, y: 0 });
  const cPar = useRef({ x: 0, y: 0 });
  const tHov = useRef({ x: 0, y: 0 });
  const cHov = useRef({ x: 0, y: 0 });
  const pivotW = useRef(new THREE.Vector3());

  const ext = useMemo(() => url.split(".").pop()?.toLowerCase() ?? "", [url]);

  const handleReady = useCallback((object: THREE.Object3D) => {
    setContent(object);
    invalidate();
  }, []);

  useLayoutEffect(() => {
    if (!content) return;

    const group = inner.current;
    group.updateWorldMatrix(true, true);

    const sphere = new THREE.Box3().setFromObject(group).getBoundingSphere(new THREE.Sphere());
    const rawScale = sphere.radius > 0 ? 1 / (sphere.radius * 1.5) : 1;
    const scale = isFinite(rawScale) && rawScale > 0 ? rawScale : 1;
    group.position.set(-sphere.center.x, -sphere.center.y, -sphere.center.z);
    group.scale.setScalar(scale);

    group.traverse((object) => {
      if (!isMeshObject(object)) return;

      object.castShadow = true;
      object.receiveShadow = true;

      if (fadeIn) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          material.transparent = true;
          material.opacity = 0;
        });
      }
    });

    group.getWorldPosition(pivotW.current);
    pivot.copy(pivotW.current);
    outer.current.rotation.set(initPitch, initYaw, 0);

    if (autoFrame && (camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const perspectiveCamera = camera as THREE.PerspectiveCamera;
      const fitRadius = sphere.radius * scale;
      const distance = (fitRadius * 0.62) / Math.sin((perspectiveCamera.fov * Math.PI) / 180 / 2);
      perspectiveCamera.position.set(pivotW.current.x, pivotW.current.y + 0.02, pivotW.current.z + distance);
      perspectiveCamera.near = distance / 10;
      perspectiveCamera.far = distance * 10;
      perspectiveCamera.updateProjectionMatrix();
    }

    if (!fadeIn) {
      onLoaded?.();
      invalidate();
      return;
    }

    let progress = 0;
    const id = window.setInterval(() => {
      progress += 0.05;
      const value = Math.min(progress, 1);

      group.traverse((object) => {
        if (!isMeshObject(object)) return;

        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          material.opacity = value;
        });
      });

      invalidate();

      if (value === 1) {
        window.clearInterval(id);
        onLoaded?.();
      }
    }, 16);

    return () => window.clearInterval(id);
  }, [autoFrame, camera, content, fadeIn, initPitch, initYaw, onLoaded, pivot]);

  useEffect(() => {
    if (!enableManualRotation || isTouch) return;

    const element = gl.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const handleDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      window.addEventListener("pointerup", handleUp);
    };

    const handleMove = (event: PointerEvent) => {
      if (!dragging) return;

      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;

      outer.current.rotation.y += dx * ROTATE_SPEED;
      outer.current.rotation.x += dy * ROTATE_SPEED;
      vel.current = { x: dx * ROTATE_SPEED, y: dy * ROTATE_SPEED };
      invalidate();
    };

    const handleUp = () => {
      dragging = false;
    };

    element.addEventListener("pointerdown", handleDown);
    element.addEventListener("pointermove", handleMove);

    return () => {
      element.removeEventListener("pointerdown", handleDown);
      element.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [enableManualRotation, gl]);

  useEffect(() => {
    if (!isTouch) return;

    const element = gl.domElement;
    const points = new Map<number, { x: number; y: number }>();
    type Mode = "idle" | "decide" | "rotate" | "pinch";
    let mode: Mode = "idle";
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let startDistance = 0;
    let startZoom = 0;

    const handleDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;

      points.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (points.size === 1) {
        mode = "decide";
        startX = lastX = event.clientX;
        startY = lastY = event.clientY;
      } else if (points.size === 2 && enableManualZoom) {
        mode = "pinch";
        const [p1, p2] = [...points.values()];
        startDistance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        startZoom = camera.position.z;
        event.preventDefault();
      }

      invalidate();
    };

    const handleMove = (event: PointerEvent) => {
      const point = points.get(event.pointerId);
      if (!point) return;
      point.x = event.clientX;
      point.y = event.clientY;

      if (mode === "decide") {
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;

        if (Math.abs(dx) > DECIDE || Math.abs(dy) > DECIDE) {
          if (enableManualRotation && Math.abs(dx) > Math.abs(dy)) {
            mode = "rotate";
            element.setPointerCapture(event.pointerId);
          } else {
            mode = "idle";
            points.clear();
          }
        }
      }

      if (mode === "rotate") {
        event.preventDefault();
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        outer.current.rotation.y += dx * ROTATE_SPEED;
        outer.current.rotation.x += dy * ROTATE_SPEED;
        vel.current = { x: dx * ROTATE_SPEED, y: dy * ROTATE_SPEED };
        invalidate();
      } else if (mode === "pinch" && points.size === 2) {
        event.preventDefault();
        const [p1, p2] = [...points.values()];
        const distance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const ratio = startDistance / distance;
        camera.position.z = THREE.MathUtils.clamp(startZoom * ratio, minZoom, maxZoom);
        invalidate();
      }
    };

    const handleUp = (event: PointerEvent) => {
      points.delete(event.pointerId);
      if (mode === "rotate" && points.size === 0) mode = "idle";
      if (mode === "pinch" && points.size < 2) mode = "idle";
    };

    element.addEventListener("pointerdown", handleDown, { passive: true });
    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp, { passive: true });
    window.addEventListener("pointercancel", handleUp, { passive: true });

    return () => {
      element.removeEventListener("pointerdown", handleDown);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [camera.position, enableManualRotation, enableManualZoom, gl, maxZoom, minZoom]);

  useEffect(() => {
    if (isTouch) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const nx = (event.clientX / window.innerWidth) * 2 - 1;
      const ny = (event.clientY / window.innerHeight) * 2 - 1;
      if (enableMouseParallax) tPar.current = { x: -nx * PARALLAX_MAG, y: -ny * PARALLAX_MAG };
      if (enableHoverRotation) tHov.current = { x: ny * HOVER_MAG, y: nx * HOVER_MAG };
      invalidate();
    };

    window.addEventListener("pointermove", handlePointerMove);

    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [enableHoverRotation, enableMouseParallax]);

  useFrame((_, dt) => {
    let needsFrame = false;

    cPar.current.x += (tPar.current.x - cPar.current.x) * PARALLAX_EASE;
    cPar.current.y += (tPar.current.y - cPar.current.y) * PARALLAX_EASE;

    const previousHoverX = cHov.current.x;
    const previousHoverY = cHov.current.y;
    cHov.current.x += (tHov.current.x - cHov.current.x) * HOVER_EASE;
    cHov.current.y += (tHov.current.y - cHov.current.y) * HOVER_EASE;

    const ndc = pivotW.current.clone().project(camera);
    ndc.x += xOff + cPar.current.x;
    ndc.y += yOff + cPar.current.y + Math.sin(_.clock.elapsedTime * FLOAT_SPEED) * FLOAT_MAG;
    outer.current.position.copy(ndc.unproject(camera));

    outer.current.rotation.x += cHov.current.x - previousHoverX;
    outer.current.rotation.y += cHov.current.y - previousHoverY;

    if (autoRotate) {
      outer.current.rotation.y += autoRotateSpeed * dt;
      needsFrame = true;
    }

    outer.current.rotation.y += vel.current.x;
    outer.current.rotation.x += vel.current.y;
    vel.current.x *= INERTIA;
    vel.current.y *= INERTIA;

    if (Math.abs(vel.current.x) > 1e-4 || Math.abs(vel.current.y) > 1e-4) needsFrame = true;

    if (
      Math.abs(cPar.current.x - tPar.current.x) > 1e-4 ||
      Math.abs(cPar.current.y - tPar.current.y) > 1e-4 ||
      Math.abs(cHov.current.x - tHov.current.x) > 1e-4 ||
      Math.abs(cHov.current.y - tHov.current.y) > 1e-4
    ) {
      needsFrame = true;
    }

    if (needsFrame) invalidate();
  });

  if (!url) return null;

  return (
    <group ref={outer}>
      <group ref={inner}>
        <LoadedAsset url={url} ext={ext} onReady={handleReady} />
      </group>
    </group>
  );
};

export default function ModelViewer({
  url,
  width = "100%",
  height = "100%",
  modelXOffset = 0,
  modelYOffset = 0,
  defaultRotationX = -18,
  defaultRotationY = 22,
  defaultZoom = 2.8,
  minZoomDistance = 0.1,
  maxZoomDistance = 20,
  enableMouseParallax = true,
  enableManualRotation = true,
  enableHoverRotation = true,
  enableManualZoom = true,
  ambientIntensity = 0.34,
  keyLightIntensity = 1.65,
  fillLightIntensity = 0.58,
  rimLightIntensity = 2.1,
  environmentPreset = "studio",
  autoFrame = true,
  placeholderSrc,
  showScreenshotButton = false,
  fadeIn = true,
  autoRotate = true,
  autoRotateSpeed = 0.12,
  onModelLoaded,
}: ViewerProps) {
  useEffect(() => {
    const ext = url.split(".").pop()?.toLowerCase();
    if (ext === "glb" || ext === "gltf") {
      void useGLTF.preload(url);
    }
  }, [url]);

  const pivot = useRef(new THREE.Vector3()).current;
  const contactRef = useRef<THREE.Object3D>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);

  const initYaw = deg2rad(defaultRotationX);
  const initPitch = deg2rad(defaultRotationY);
  const cameraZ = Math.min(Math.max(defaultZoom, minZoomDistance), maxZoomDistance);

  const capture = () => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;

    renderer.shadowMap.enabled = false;
    const lights: Array<{ light: THREE.Light; castShadow: boolean }> = [];

    scene.traverse((object) => {
      if (!isLightObject(object)) return;
      lights.push({ light: object, castShadow: object.castShadow });
      object.castShadow = false;
    });

    if (contactRef.current) contactRef.current.visible = false;

    renderer.render(scene, camera);
    const png = renderer.domElement.toDataURL("image/png");
    const anchor = document.createElement("a");
    anchor.download = "model.png";
    anchor.href = png;
    anchor.click();

    renderer.shadowMap.enabled = true;
    lights.forEach(({ light, castShadow }) => {
      light.castShadow = castShadow;
    });
    if (contactRef.current) contactRef.current.visible = true;
    invalidate();
  };

  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        touchAction: "pan-y pinch-zoom",
      }}
    >
      {showScreenshotButton && (
        <button
          type="button"
          onClick={capture}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 10,
            padding: "8px 16px",
            border: "1px solid rgba(255, 255, 255, 0.62)",
            borderRadius: 10,
            background: "rgba(9, 18, 34, 0.72)",
            color: "#f6fbff",
            cursor: "pointer",
          }}
        >
          Take Screenshot
        </button>
      )}

      <Canvas
        shadows
        frameloop="demand"
        gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
        onCreated={({ gl, scene, camera }) => {
          rendererRef.current = gl;
          sceneRef.current = scene;
          cameraRef.current = camera;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.18;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.setClearColor("#040b04", 0);
          gl.shadowMap.type = THREE.VSMShadowMap;
          scene.fog = new THREE.FogExp2("#0d1a0d", 0.08);
        }}
        camera={{ fov: 40, position: [0, 0.02, cameraZ], near: 0.01, far: 100 }}
        style={{ touchAction: "pan-y pinch-zoom" }}
      >
        {environmentPreset !== "none" && <Environment preset={environmentPreset} background={false} />}
        <SceneBackdrop />

        <ambientLight intensity={ambientIntensity} color="#d6f5ff" />
        <hemisphereLight args={["#c6f7ff", "#04101d", 0.62]} />
        <directionalLight
          position={[4.8, 6.8, 5.8]}
          intensity={keyLightIntensity}
          color="#f7fcff"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.00008}
        />
        <directionalLight position={[-4.8, 2.4, 4.8]} intensity={fillLightIntensity} color="#9fdbff" />
        <pointLight position={[0, 1.2, -3.4]} intensity={rimLightIntensity} distance={10} color="#59e8ff" />
        <pointLight position={[-2, 1, 2]} intensity={1.4} color="#f97316" />
        <pointLight position={[0.4, 0.3, -2.2]} intensity={1.15} distance={6} color="#52dfff" />

        <ContactShadows
          ref={contactRef as any}
          position={[0, -0.5, 0]}
          opacity={0}
          scale={12}
          blur={1.9}
          far={3.2}
          frames={1}
          color="#06111d"
        />

        <Suspense fallback={<Loader placeholderSrc={placeholderSrc} />}>
          <ModelInner
            url={url}
            xOff={modelXOffset}
            yOff={modelYOffset}
            pivot={pivot}
            initYaw={initYaw}
            initPitch={initPitch}
            minZoom={minZoomDistance}
            maxZoom={maxZoomDistance}
            enableMouseParallax={enableMouseParallax}
            enableManualRotation={enableManualRotation}
            enableHoverRotation={enableHoverRotation}
            enableManualZoom={enableManualZoom}
            autoFrame={autoFrame}
            fadeIn={fadeIn}
            autoRotate={autoRotate}
            autoRotateSpeed={autoRotateSpeed}
            onLoaded={onModelLoaded}
          />
        </Suspense>

        {!isTouch && (
          <DesktopControls pivot={pivot} min={minZoomDistance} max={maxZoomDistance} zoomEnabled={enableManualZoom} />
        )}
      </Canvas>
    </div>
  );
}
