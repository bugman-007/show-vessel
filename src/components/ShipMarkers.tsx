import * as THREE from "three";
import { useState, useCallback, useRef, useEffect } from "react";
import { useSpring, animated } from "@react-spring/three";
// import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
// import { useThree, useFrame } from "@react-three/fiber";
import { latLonToVector3 } from "../utils/geo";
import { ShipRoutes } from "./ShipRoutes";
import SkyToView from "./SkyToView";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface Ship {
  id: string;
  lat: number;
  lon: number;
  heading: number;
  speed?: number;
  timestamp?: number;
}

interface Waypoint {
  latitude: number;
  longitude: number;
}

interface ShipMesh {
  id: string;
  currentPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  previousPosition: THREE.Vector3;
  quaternion: THREE.Quaternion;
  heading: number;
  speed: number;
  lastUpdateTime: number;
  interpolationProgress: number;
  isMoving: boolean;
  route: Waypoint[];
  routeProgress: number;
  currentRouteSegment: number;
}

interface ShipMarkersProps {
  ships: Ship[];
  selectedShipId: string | null;
  setSelectedShipId: (id: string) => void;
  route: Waypoint[];
  viewMode: "normal" | "skyview";
  setViewMode: (mode: "normal" | "skyview") => void;
}

const radius = 2.02;

const knotsToUnitsPerSecond = (knots: number) => {
  return (knots * 0.01) / 3600;
};

const interpolateAlongRoute = (route: Waypoint[], progress: number, radius: number): THREE.Vector3 => {
  if (route.length < 2) return new THREE.Vector3();
  const totalSegments = route.length - 1;
  const segmentProgress = progress * totalSegments;
  const currentSegment = Math.floor(segmentProgress);
  const segmentT = segmentProgress - currentSegment;

  if (currentSegment >= totalSegments) {
    const lastWaypoint = route[route.length - 1];
    return latLonToVector3(lastWaypoint.latitude, lastWaypoint.longitude, radius);
  }

  const start = latLonToVector3(route[currentSegment].latitude, route[currentSegment].longitude, radius);
  const end = latLonToVector3(route[currentSegment + 1].latitude, route[currentSegment + 1].longitude, radius);

  const qStart = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), start.clone().normalize());
  const qEnd = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), end.clone().normalize());
  const qInterpolated = new THREE.Quaternion().slerpQuaternions(qStart, qEnd, segmentT);

  return new THREE.Vector3(0, 0, radius).applyQuaternion(qInterpolated);
};

function ShipMarker({
  ship,
  hoveredId,
  setHoveredId,
  handleShipSelect,
}: {
  ship: ShipMesh;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  handleShipSelect: (ship: ShipMesh) => void;
}) {
  const { scale } = useSpring({
    scale: hoveredId === ship.id ? 2 : 1,
    config: { tension: 300, friction: 15 },
  });

  return (
    <animated.mesh
      key={ship.id}
      position={ship.currentPosition}
      quaternion={ship.quaternion}
      scale={scale}
      onPointerOver={() => setHoveredId(ship.id)}
      onPointerOut={() => setHoveredId(null)}
      onClick={() => handleShipSelect(ship)}
    >
      <coneGeometry args={[0.02, 0.05, 8]} />
      <meshPhongMaterial
        color={ship.isMoving ? (hoveredId === ship.id ? "#ff6666" : "#ff0000") : "#888888"}
        transparent
        opacity={0.9}
      />
      {/* {ship.isMoving && (
        <mesh position={[0, 0, -0.03]}>
          <coneGeometry args={[0.01, 0.02, 6]} />
          <meshPhongMaterial color="#ffaa00" transparent opacity={0.6} />
        </mesh>
      )} */}
    </animated.mesh>
  );
}

export function ShipMarkers({
  ships,
  selectedShipId,
  setSelectedShipId,
  route,
  viewMode,
  // setViewMode,
}: ShipMarkersProps) {
  // const { camera, scene } = useThree();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [shipMeshes, setShipMeshes] = useState<Map<string, ShipMesh>>(new Map());
  // const animationRef = useRef<number | null>(null);
  const preloadedModelRef = useRef<THREE.Object3D | null>(null);

  // Preload ship model on mount
  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load("/assets/ship.glb", (gltf) => {
      preloadedModelRef.current = gltf.scene;
    });
  }, []);

  const updateShipMeshes = useCallback((newShips: Ship[]) => {
    const currentTime = Date.now();
    setShipMeshes((prev) => {
      const updated = new Map<string, ShipMesh>();

      newShips.forEach((ship) => {
        const newTargetPos = latLonToVector3(ship.lat, ship.lon, radius);
        const existing = prev.get(ship.id);

        if (existing) {
          const moved = existing.currentPosition.distanceTo(newTargetPos) > 0.001;
          updated.set(ship.id, {
            ...existing,
            previousPosition: existing.currentPosition.clone(),
            targetPosition: newTargetPos,
            heading: ship.heading,
            speed: ship.speed || 0,
            lastUpdateTime: currentTime,
            interpolationProgress: 0,
            isMoving: moved && (ship.speed || 0) > 0,
          });
        } else {
          const pos = latLonToVector3(ship.lat, ship.lon, radius);
          const up = new THREE.Vector3(0, -1, 0);
          const dir = pos.clone().normalize();
          const quaternion = new THREE.Quaternion().setFromUnitVectors(up, dir);

          updated.set(ship.id, {
            id: ship.id,
            currentPosition: pos,
            targetPosition: pos.clone(),
            previousPosition: pos.clone(),
            quaternion,
            heading: ship.heading,
            speed: ship.speed || 0,
            lastUpdateTime: currentTime,
            interpolationProgress: 1,
            isMoving: false,
            route: [],
            routeProgress: 0,
            currentRouteSegment: 0,
          });
        }
      });

      return updated;
    });
  }, []);

  useEffect(() => {
    updateShipMeshes(ships);
  }, [ships, updateShipMeshes]);

  useEffect(() => {
    if (selectedShipId && route.length > 0) {
      setShipMeshes((prev) => {
        const copy = new Map(prev);
        const ship = copy.get(selectedShipId);
        if (ship) {
          ship.route = route;
          ship.routeProgress = 0;
          ship.currentRouteSegment = 0;
        }
        return copy;
      });
    }
  }, [selectedShipId, route]);

  useFrame((_, delta) => {
    setShipMeshes((prev) => {
      const updated = new Map<string, ShipMesh>();
      prev.forEach((ship) => {
        const copy = { ...ship };
        if (copy.isMoving && copy.interpolationProgress < 1) {
          const speed = knotsToUnitsPerSecond(copy.speed);
          const distance = copy.previousPosition.distanceTo(copy.targetPosition);
          const timeToTarget = distance / (speed || 0.001);
          copy.interpolationProgress = Math.min(1, copy.interpolationProgress + delta / timeToTarget);

          if (copy.route.length > 1) {
            copy.currentPosition = interpolateAlongRoute(copy.route, copy.routeProgress, radius);
            copy.routeProgress = Math.min(1, copy.routeProgress + delta * 0.01);
          } else {
            copy.currentPosition.lerpVectors(copy.previousPosition, copy.targetPosition, copy.interpolationProgress);
          }

          if (copy.interpolationProgress > 0.01) {
            const dir = new THREE.Vector3().subVectors(copy.targetPosition, copy.previousPosition).normalize();
            if (dir.length() > 0) {
              const up = copy.currentPosition.clone().normalize();
              const right = new THREE.Vector3().crossVectors(up, dir).normalize();
              const forward = new THREE.Vector3().crossVectors(right, up).normalize();
              const matrix = new THREE.Matrix4().makeBasis(right, up, forward);
              copy.quaternion.setFromRotationMatrix(matrix);
            }
          }

          if (copy.interpolationProgress >= 1) {
            copy.isMoving = false;
            copy.currentPosition.copy(copy.targetPosition);
          }
        }
        updated.set(ship.id, copy);
      });
      return updated;
    });
  });

  const handleShipSelect = useCallback(
    (ship: ShipMesh) => {
      if (viewMode === "skyview") return;
      setSelectedShipId(ship.id);
    },
    [viewMode, setSelectedShipId]
  );

  const selectedShip = selectedShipId ? shipMeshes.get(selectedShipId) : null;

  return (
    <>
      {Array.from(shipMeshes.values()).map((ship) =>
        viewMode === "skyview" && selectedShipId === ship.id ? null : (
          <ShipMarker
            key={ship.id}
            ship={ship}
            hoveredId={hoveredId}
            setHoveredId={setHoveredId}
            handleShipSelect={handleShipSelect}
          />
        )
      )}

      {viewMode === "skyview" && selectedShip && (
        <SkyToView
          shipId={selectedShip.id}
          shipHeading={selectedShip.heading}
          shipPosition={selectedShip.targetPosition.clone()}
          onModelLoaded={() => {}}
          onError={(err) => console.error(err)}
        />
      )}

      {selectedShip && route.length > 0 && <ShipRoutes waypoints={route} />}
    </>
  );
}
