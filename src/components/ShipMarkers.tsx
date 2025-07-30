import * as THREE from "three";
import { useMemo, useState, useCallback } from "react";
import { useSpring, animated } from "@react-spring/three";
import { latLonToVector3 } from "../utils/geo";
import { ShipRoutes } from "./ShipRoutes";

// Type for ship data from API
interface Ship {
  id: string;
  lat: number;
  lon: number;
  heading: number;
  speed?: number;
}

// Type for route waypoints
interface Waypoint {
  latitude: number;
  longitude: number;
}

interface ShipMesh {
  id: string;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  heading: number;
}

interface ShipMarkersProps {
  ships: Ship[];
  selectedShipId: string | null;
  setSelectedShipId: (id: string) => void;
  route: Waypoint[];
}

function ShipMarker({
  ship,
  hoveredId,
  setHoveredId,
  handleShipSelect,
  isSelected,
}: {
  ship: ShipMesh;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  handleShipSelect: (ship: ShipMesh) => void;
  isSelected: boolean;
}) {
  const { scale } = useSpring({
    scale: hoveredId === ship.id || isSelected ? 2 : 1,
    config: { tension: 300, friction: 15 },
  });

  const baseColor = isSelected ? "#00ff00" : "#ff0000";
  const hoverColor = isSelected ? "#66ff66" : "#ff6666";

  return (
    <animated.mesh
      key={ship.id}
      position={[ship.position.x, ship.position.y, ship.position.z]}
      quaternion={ship.quaternion}
      scale={scale}
      onPointerOver={() => setHoveredId(ship.id)}
      onPointerOut={() => setHoveredId(null)}
      onClick={() => handleShipSelect(ship)}
    >
      <coneGeometry args={[0.02, 0.05, 8]} />
      <meshPhongMaterial
        color={hoveredId === ship.id ? hoverColor : baseColor}
        transparent
        opacity={0.9}
      />
    </animated.mesh>
  );
}

export function ShipMarkers({ ships, selectedShipId, setSelectedShipId, route }: ShipMarkersProps) {
  const radius = 2.02;

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Memoize ship meshes
  const shipMeshes = useMemo(() => {
    try {
      return ships.map((ship): ShipMesh => {
        const pos = latLonToVector3(ship.lat, ship.lon, radius);
        const up = new THREE.Vector3(0, -1, 0);
        const dir = pos.clone().normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, dir);
        return {
          id: ship.id,
          position: pos,
          quaternion,
          heading: ship.heading,
        };
      });
    } catch {
      return [];
    }
  }, [ships, radius]);

  // When a ship is selected in 3D, update selectedShipId in parent
  const handleShipSelect = useCallback(
    (ship: ShipMesh) => {
      setSelectedShipId(ship.id);
    },
    [setSelectedShipId]
  );

  return (
    <>
      {/* Render ship markers - ONLY 3D objects inside Canvas */}
      {shipMeshes.map((ship) => (
        <ShipMarker
          key={ship.id}
          ship={ship}
          hoveredId={hoveredId}
          setHoveredId={setHoveredId}
          handleShipSelect={handleShipSelect}
          isSelected={selectedShipId === ship.id}
        />
      ))}

      {/* Ship routes - ONLY 3D objects inside Canvas */}
      {selectedShipId && route && route.length > 0 && (
        <ShipRoutes waypoints={route} />
      )}
    </>
  );
}