import * as THREE from "three";
import { useMemo, useState, useCallback, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
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
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [currentScale, setCurrentScale] = useState(1);
  const targetScaleRef = useRef(1);
  
  // Update every frame for both rotation and scale
  useFrame(() => {
    if (!groupRef.current) return;
    
    // Make marker always face camera (billboard effect)
    groupRef.current.lookAt(camera.position);
    
    // Calculate distance-based scale
    const distance = camera.position.distanceTo(ship.position);
    
    // This formula maintains approximately constant screen size
    const constantScreenScale = distance * 0.1;
    
    // Apply hover/selection multiplier
    const hoverMultiplier = (hoveredId === ship.id || isSelected) ? 1.3 : 1;
    targetScaleRef.current = constantScreenScale * hoverMultiplier;
    
    // Smooth scale transition
    setCurrentScale(prev => {
      const diff = targetScaleRef.current - prev;
      return prev + diff * 0.15; // Smooth factor
    });
    
    groupRef.current.scale.setScalar(currentScale);
  });

  const isHovered = hoveredId === ship.id;
  
  // Dynamic colors based on state
  const bgColor = isSelected ? "#00ff00" : isHovered ? "#ff6666" : "#EA3B3A";
  const iconColor = isSelected ? "#003300" : "#ffffff";
  const ringOpacity = isSelected || isHovered ? 0.3 : 0;

  return (
    <group
      ref={groupRef}
      position={[ship.position.x, ship.position.y, ship.position.z]}
      onPointerOver={() => setHoveredId(ship.id)}
      onPointerOut={() => setHoveredId(null)}
      onClick={() => handleShipSelect(ship)}
    >
      {/* Outer ring animation */}
      <mesh>
        <ringGeometry args={[0.08, 0.09, 32]} />
        <meshBasicMaterial 
          color={bgColor} 
          transparent 
          opacity={ringOpacity}
        />
      </mesh>
      
      {/* Main circle background */}
      <mesh>
        <circleGeometry args={[0.06, 32]} />
        <meshBasicMaterial color={bgColor} />
      </mesh>
      
      {/* Inner circle for contrast */}
      <mesh position={[0, 0, 0.001]}>
        <circleGeometry args={[0.05, 32]} />
        <meshBasicMaterial color={bgColor} opacity={0.9} transparent />
      </mesh>
      
      {/* Ship icon using Text */}
      <Text
        position={[0, 0, 0.002]}
        fontSize={0.06}
        color={iconColor}
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        ⚓
      </Text>
      
      {/* Pulse effect for selected ships */}
      {isSelected && (
        <mesh scale={[1, 1, 1]}>
          <ringGeometry args={[0.07, 0.08, 32]} />
          <meshBasicMaterial 
            color="#00ff00" 
            transparent 
            opacity={0.5}
          />
        </mesh>
      )}
    </group>
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