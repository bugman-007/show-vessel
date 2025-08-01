import { useMemo, useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { latLonToVector3 } from "../utils/geo";

interface Waypoint {
  latitude: number;
  longitude: number;
}

interface ShipRoutesProps {
  waypoints: Waypoint[];
}

export function ShipRoutes({ waypoints }: ShipRoutesProps) {
  const radius = 2.001;
  const mainLineRef = useRef<THREE.Line>(null);
  const glowLineRef = useRef<THREE.Line>(null);
  const materialRef = useRef<THREE.LineDashedMaterial>(null);
  const glowMaterialRef = useRef<THREE.LineBasicMaterial>(null);
  const [fadeIn, setFadeIn] = useState(0);

  // Fade in animation on mount
  useEffect(() => {
    setFadeIn(0);
    const timer = setTimeout(() => setFadeIn(1), 50);
    return () => clearTimeout(timer);
  }, [waypoints]);

  // Create materials
  const { mainMaterial, glowMaterial } = useMemo(() => {
    const main = new THREE.LineDashedMaterial({
      color: new THREE.Color("#ff3366"),
      linewidth: 4, // Increased from 2 to 4 for bolder line
      scale: 1,
      dashSize: 0.025, // Slightly larger dashes
      gapSize: 0.012, // Proportionally larger gaps
      opacity: 0.9,
      transparent: true,
      blending: THREE.NormalBlending,
    });

    const glow = new THREE.LineBasicMaterial({
      color: new THREE.Color("#ff6699"),
      linewidth: 8, // Increased from 4 to 8 for bolder glow
      opacity: 0.3,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });

    return { mainMaterial: main, glowMaterial: glow };
  }, []);

  // Store material references
  useEffect(() => {
    materialRef.current = mainMaterial;
    glowMaterialRef.current = glowMaterial;
    return () => {
      mainMaterial.dispose();
      glowMaterial.dispose();
    };
  }, [mainMaterial, glowMaterial]);

  // Create route geometry
  const routeGeometry = useMemo(() => {
    if (waypoints.length < 2) return null;

    const points = waypoints.map((wp) =>
      latLonToVector3(wp.latitude, wp.longitude, radius)
    );

    // Create smooth curve
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.BufferGeometry().setFromPoints(
      curve.getPoints(250)
    );

    // Compute line distances for dashed material
    const positions = geometry.attributes.position;
    const lineDistances = new Float32Array(positions.count);
    let distance = 0;

    for (let i = 0; i < positions.count; i++) {
      if (i > 0) {
        const dx = positions.getX(i) - positions.getX(i - 1);
        const dy = positions.getY(i) - positions.getY(i - 1);
        const dz = positions.getZ(i) - positions.getZ(i - 1);
        distance += Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
      lineDistances[i] = distance;
    }

    geometry.setAttribute(
      "lineDistance",
      new THREE.BufferAttribute(lineDistances, 1)
    );

    return geometry;
  }, [waypoints, radius]);

  // Animate the lines
  useFrame(({ clock }) => {
    if (!materialRef.current || !glowMaterialRef.current) return;

    const time = clock.getElapsedTime();

    // Smooth fade in
    if (fadeIn < 1) {
      setFadeIn((prev) => Math.min(prev + 0.05, 1));
    }

    // Animate main dashed line
    const pulseSpeed = 3;
    const flowSpeed = 0.5;

    // Pulsing opacity
    const opacityPulse = 0.7 + 0.3 * Math.sin(time * pulseSpeed);
    materialRef.current.opacity = opacityPulse * fadeIn;

    // Flowing dash effect
    const dashFlow = Math.sin(time * flowSpeed) * 0.012;
    materialRef.current.dashSize = 0.025 + dashFlow;
    materialRef.current.gapSize = 0.012 - dashFlow * 0.5;

    // Color animation - gradient effect
    const hue = (Math.sin(time * 0.5) * 0.1 + 0.95) % 1; // Red to orange range
    materialRef.current.color.setHSL(hue, 0.8, 0.6);

    // Glow line animation
    glowMaterialRef.current.opacity =
      (0.2 + 0.1 * Math.sin(time * pulseSpeed + Math.PI)) * fadeIn;
    glowMaterialRef.current.color.setHSL(hue, 0.7, 0.7);

    // Update dash offset for flowing effect
    if (mainLineRef.current) {
      (mainLineRef.current.material as THREE.LineDashedMaterial).dashSize =
        0.025 + dashFlow;
      (mainLineRef.current.material as THREE.LineDashedMaterial).gapSize =
        0.012 - dashFlow * 0.5;
    }
  });

  if (!routeGeometry) return null;

  // Calculate static positions for start/end markers with proper elevation
  const startPos = latLonToVector3(
    waypoints[0].latitude,
    waypoints[0].longitude,
    radius + 0.01
  );
  const endPos = latLonToVector3(
    waypoints[waypoints.length - 1].latitude,
    waypoints[waypoints.length - 1].longitude,
    radius + 0.01
  );

  // Calculate normal vectors for proper orientation
  const startNormal = startPos.clone().normalize();
  const endNormal = endPos.clone().normalize();

  // Create quaternions for proper orientation
  const startQuaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    startNormal
  );
  const endQuaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    endNormal
  );

  return (
    <group>
      {/* Glow line underneath for depth */}
      <primitive
        object={new THREE.Line(routeGeometry, glowMaterial)}
        ref={glowLineRef}
      />

      {/* Main animated dashed line */}
      <primitive
        object={new THREE.Line(routeGeometry, mainMaterial)}
        ref={mainLineRef}
      />

      {/* Static start point - Clean design with proper orientation */}
      <group position={startPos} quaternion={startQuaternion}>
        <mesh>
          <sphereGeometry args={[0.012, 32, 32]} />
          <meshPhongMaterial
            color="#00ff88"
            emissive="#00ff88"
            emissiveIntensity={0.5}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.018, 0.02, 32]} rotateY={Math.PI / 2}/>
          <meshBasicMaterial color="#00ff88" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Static end point - Clean design with proper orientation */}
      <group position={endPos} quaternion={endQuaternion}>
        <mesh>
          <sphereGeometry args={[0.012, 32, 32]} />
          <meshPhongMaterial
            color="#ff3366"
            emissive="#ff3366"
            emissiveIntensity={0.5}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.018, 0.02, 32]} />
          <meshBasicMaterial color="#ff3366" side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}
