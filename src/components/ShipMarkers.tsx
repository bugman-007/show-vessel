// Enhanced ShipMarkers.tsx with smooth real-time movement
import * as THREE from "three";
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useSpring, animated } from "@react-spring/three";
import { Html } from "@react-three/drei";
import { useThree, useFrame } from "@react-three/fiber";
import { latLonToVector3 } from "../utils/geo";
import { ShipRoutes } from "./ShipRoutes";
import SkyToView from "./SkyToView";

// Enhanced ship interface with movement tracking
interface Ship {
  id: string;
  lat: number;
  lon: number;
  heading: number;
  speed?: number;
  timestamp?: number; // When this position was recorded
}

interface Waypoint {
  latitude: number;
  longitude: number;
}

// Enhanced ship mesh with movement state
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
  routeProgress: number; // Progress along current route segment
  currentRouteSegment: number; // Which route segment ship is on
}

interface ViewState {
  mode: "normal" | "skyview";
  selectedShip: {
    id: string;
    position: THREE.Vector3;
    heading: number;
  } | null;
  originalCameraPosition: THREE.Vector3 | null;
  loadedModel: THREE.Object3D | null;
}

interface ShipMarkersProps {
  ships: Ship[];
  selectedShipId: string | null;
  setSelectedShipId: (id: string) => void;
  route: Waypoint[];
}

// Utility functions for ship movement calculations
const calculateDistance = (pos1: THREE.Vector3, pos2: THREE.Vector3): number => {
  return pos1.distanceTo(pos2);
};

// const calculateBearing = (from: THREE.Vector3, to: THREE.Vector3): number => {
//   const direction = new THREE.Vector3().subVectors(to, from).normalize();
//   return Math.atan2(direction.x, direction.z) * (180 / Math.PI);
// };

const knotsToUnitsPerSecond = (knots: number): number => {
  // Convert knots to Three.js units per second
  // Assuming 1 Three.js unit = ~100 nautical miles for our globe scale
  return (knots * 0.01) / 3600; // Adjust this scaling factor as needed
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
  
  const startWaypoint = route[currentSegment];
  const endWaypoint = route[currentSegment + 1];
  
  const startPos = latLonToVector3(startWaypoint.latitude, startWaypoint.longitude, radius);
  const endPos = latLonToVector3(endWaypoint.latitude, endWaypoint.longitude, radius);
  
  // Spherical interpolation for smooth movement along globe surface
  const quaternionStart = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1), 
    startPos.clone().normalize()
  );
  const quaternionEnd = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1), 
    endPos.clone().normalize()
  );
  
  const interpolatedQuaternion = new THREE.Quaternion().slerpQuaternions(
    quaternionStart, 
    quaternionEnd, 
    segmentT
  );
  
  return new THREE.Vector3(0, 0, radius).applyQuaternion(interpolatedQuaternion);
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
      position={[ship.currentPosition.x, ship.currentPosition.y, ship.currentPosition.z]}
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
      {/* Speed indicator trail */}
      {ship.isMoving && (
        <mesh position={[0, 0, -0.03]}>
          <coneGeometry args={[0.01, 0.02, 6]} />
          <meshPhongMaterial color="#ffaa00" transparent opacity={0.6} />
        </mesh>
      )}
    </animated.mesh>
  );
}

export function ShipMarkers({ ships, selectedShipId, setSelectedShipId, route }: ShipMarkersProps) {
  const { camera, scene } = useThree();
  const radius = 2.02;

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [viewState, setViewState] = useState<ViewState>({
    mode: "normal",
    selectedShip: null,
    originalCameraPosition: null,
    loadedModel: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enhanced ship state management with movement tracking
  const [shipMeshes, setShipMeshes] = useState<Map<string, ShipMesh>>(new Map());
  const animationRef = useRef<number | null>(null);
  // const lastUpdateTime = useRef<number>(Date.now());
  const cameraTransitionRef = useRef<{
    progress: number;
    startPos: THREE.Vector3;
    targetPos: THREE.Vector3;
    isAnimating: boolean;
  } | null>(null);

  // Create or update ship meshes with smooth movement
  const updateShipMeshes = useCallback((newShips: Ship[]) => {
    const currentTime = Date.now();
    const newShipMeshes = new Map<string, ShipMesh>();

    newShips.forEach((ship) => {
      const existingShip = shipMeshes.get(ship.id);
      const newTargetPos = latLonToVector3(ship.lat, ship.lon, radius);
      
      if (existingShip) {
        // Update existing ship with new target
        // const timeDelta = (currentTime - existingShip.lastUpdateTime) / 1000; // seconds
        // const expectedDistance = knotsToUnitsPerSecond(ship.speed || 0) * timeDelta;
        const actualDistance = calculateDistance(existingShip.currentPosition, newTargetPos);
        
        // Check if ship has moved significantly (not just GPS noise)
        const isSignificantMovement = actualDistance > 0.001;
        
        newShipMeshes.set(ship.id, {
          ...existingShip,
          targetPosition: newTargetPos,
          previousPosition: existingShip.currentPosition.clone(),
          heading: ship.heading,
          speed: ship.speed || 0,
          lastUpdateTime: currentTime,
          interpolationProgress: 0, // Reset interpolation
          isMoving: isSignificantMovement && (ship.speed || 0) > 0,
        });
      } else {
        // Create new ship
        const pos = latLonToVector3(ship.lat, ship.lon, radius);
        const up = new THREE.Vector3(0, -1, 0);
        const dir = pos.clone().normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, dir);
        
        newShipMeshes.set(ship.id, {
          id: ship.id,
          currentPosition: pos.clone(),
          targetPosition: pos.clone(),
          previousPosition: pos.clone(),
          quaternion,
          heading: ship.heading,
          speed: ship.speed || 0,
          lastUpdateTime: currentTime,
          interpolationProgress: 1, // Start at target
          isMoving: false,
          route: [],
          routeProgress: 0,
          currentRouteSegment: 0,
        });
      }
    });

    setShipMeshes(newShipMeshes);
  }, [shipMeshes, radius]);

  // Update ship meshes when ships data changes
  useEffect(() => {
    updateShipMeshes(ships);
  }, [ships, updateShipMeshes]);

  // Update ship routes when route data changes
  useEffect(() => {
    if (selectedShipId && route.length > 0) {
      setShipMeshes(prev => {
        const updated = new Map(prev);
        const ship = updated.get(selectedShipId);
        if (ship) {
          updated.set(selectedShipId, {
            ...ship,
            route: route,
            routeProgress: 0,
            currentRouteSegment: 0,
          });
        }
        return updated;
      });
    }
  }, [selectedShipId, route]);

  // Smooth movement animation loop
  useFrame((state, delta) => {
    // useFrame((state, delta) => {
    // const currentTime = Date.now();
    
    setShipMeshes(prev => {
      const updated = new Map();
      console.log(state);
      
      prev.forEach((ship, id) => {
        const updatedShip = { ...ship };
        
        if (updatedShip.isMoving && updatedShip.interpolationProgress < 1) {
          // Calculate movement based on ship speed and time
          const speed = knotsToUnitsPerSecond(updatedShip.speed);
          const distance = calculateDistance(updatedShip.previousPosition, updatedShip.targetPosition);
          const timeToTarget = distance / (speed || 0.001); // Avoid division by zero
          
          // Update interpolation progress
          updatedShip.interpolationProgress = Math.min(1, updatedShip.interpolationProgress + (delta / timeToTarget));
          
          // Smooth interpolation between positions
          if (updatedShip.route.length > 1) {
            // Move along route
            updatedShip.currentPosition = interpolateAlongRoute(
              updatedShip.route, 
              updatedShip.routeProgress, 
              radius
            );
            
            // Update route progress based on speed
            const routeSpeed = 0.01; // Adjust this for route following speed
            updatedShip.routeProgress = Math.min(1, updatedShip.routeProgress + (delta * routeSpeed));
          } else {
            // Direct interpolation to target
            updatedShip.currentPosition.lerpVectors(
              updatedShip.previousPosition,
              updatedShip.targetPosition,
              updatedShip.interpolationProgress
            );
          }
          
          // Update ship orientation to face movement direction
          if (updatedShip.interpolationProgress > 0.01) {
            const direction = new THREE.Vector3()
              .subVectors(updatedShip.targetPosition, updatedShip.previousPosition)
              .normalize();
            
            if (direction.length() > 0) {
              const up = updatedShip.currentPosition.clone().normalize();
              const right = new THREE.Vector3().crossVectors(up, direction).normalize();
              const forward = new THREE.Vector3().crossVectors(right, up).normalize();
              
              const matrix = new THREE.Matrix4().makeBasis(right, up, forward);
              updatedShip.quaternion.setFromRotationMatrix(matrix);
            }
          }
          
          // Stop movement when reached target
          if (updatedShip.interpolationProgress >= 1) {
            updatedShip.isMoving = false;
            updatedShip.currentPosition.copy(updatedShip.targetPosition);
          }
        }
        
        updated.set(id, updatedShip);
      });
      
      return updated;
    });
  });

  // Convert map to array for rendering
  const shipMeshArray = useMemo(() => {
    return Array.from(shipMeshes.values());
  }, [shipMeshes]);

  // Find selected ship info from props
  const selectedInfo = ships.find((s) => s.id === selectedShipId);

  const handleShipSelect = useCallback(
    (ship: ShipMesh) => {
      if (viewState.mode === "skyview") return;
      setSelectedShipId(ship.id);
      setViewState((prev) => ({
        ...prev,
        selectedShip: {
          id: ship.id,
          position: ship.currentPosition,
          heading: ship.heading,
        },
      }));
    },
    [viewState.mode, setSelectedShipId]
  );

  // Update selected ship when selectedShipId changes
  useEffect(() => {
    if (selectedShipId) {
      const ship = shipMeshes.get(selectedShipId);
      if (ship) {
        setViewState((prev) => ({
          ...prev,
          selectedShip: {
            id: ship.id,
            position: ship.currentPosition,
            heading: ship.heading,
          },
        }));
      }
    } else {
      setViewState((prev) => ({ ...prev, selectedShip: null }));
    }
  }, [selectedShipId, shipMeshes]);

  const handleViewDetails = useCallback(
    (shipId: string) => {
      const ship = shipMeshes.get(shipId);
      if (!ship) return;

      setIsLoading(true);
      setError(null);

      const currentCameraPos = camera.position.clone();

      setViewState({
        mode: "skyview",
        selectedShip: {
          id: ship.id,
          position: ship.currentPosition,
          heading: ship.heading,
        },
        originalCameraPosition: currentCameraPos,
        loadedModel: null,
      });
    },
    [shipMeshes, camera]
  );

  const handleCloseSkyToView = useCallback(() => {
    if (!viewState.originalCameraPosition || viewState.mode !== "skyview")
      return;

    if (viewState.loadedModel) {
      scene.remove(viewState.loadedModel);
      viewState.loadedModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });
    }

    cameraTransitionRef.current = {
      progress: 0,
      startPos: camera.position.clone(),
      targetPos: viewState.originalCameraPosition.clone(),
      isAnimating: true,
    };

    setViewState({
      mode: "normal",
      selectedShip: null,
      originalCameraPosition: null,
      loadedModel: null,
    });
    setIsLoading(false);
    setError(null);
  }, [
    viewState.originalCameraPosition,
    viewState.loadedModel,
    viewState.mode,
    camera,
    scene,
  ]);

  const handleModelLoaded = useCallback((model: THREE.Object3D) => {
    setViewState((prev) => ({
      ...prev,
      loadedModel: model,
    }));
    setIsLoading(false);
  }, []);

  const handleModelError = useCallback((error: string) => {
    setError(error);
    setIsLoading(false);
  }, []);

  const handleCloseShipInfo = useCallback(() => {
    setViewState((prev) => ({
      ...prev,
      selectedShip: null,
    }));
  }, []);

  useFrame(() => {
    if (
      cameraTransitionRef.current &&
      cameraTransitionRef.current.isAnimating
    ) {
      const transition = cameraTransitionRef.current;
      transition.progress += 0.02;

      camera.position.lerpVectors(
        transition.startPos,
        transition.targetPos,
        transition.progress
      );

      if (viewState.selectedShip) {
        const normalDirection = viewState.selectedShip.position
          .clone()
          .normalize();
        const elevatedShipPos = viewState.selectedShip.position
          .clone()
          .add(normalDirection.multiplyScalar(0));
        camera.lookAt(elevatedShipPos);
      }

      if (transition.progress >= 1) {
        camera.position.copy(transition.targetPos);
        cameraTransitionRef.current.isAnimating = false;
        cameraTransitionRef.current = null;
      }
    }
  });

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (viewState.mode === "skyview") {
          handleCloseSkyToView();
        } else if (viewState.selectedShip) {
          handleCloseShipInfo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [
    viewState.mode,
    viewState.selectedShip,
    handleCloseSkyToView,
    handleCloseShipInfo,
  ]);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (viewState.loadedModel) {
        scene.remove(viewState.loadedModel);
      }
    };
  }, [scene, viewState.loadedModel]);

  if (error) {
    return (
      <Html center>
        <div
          style={{
            background: "#ff4444",
            color: "white",
            padding: "10px",
            borderRadius: "5px",
            fontFamily: "Arial, sans-serif",
          }}
        >
          Error: {error}
        </div>
      </Html>
    );
  }

  return (
    <>
      {shipMeshArray.map((ship) => (
        <ShipMarker
          key={ship.id}
          ship={ship}
          hoveredId={hoveredId}
          setHoveredId={setHoveredId}
          handleShipSelect={handleShipSelect}
        />
      ))}

      {viewState.selectedShip && viewState.mode === "normal" && (
        <Html
          position={[
            viewState.selectedShip.position.x - 0.35,
            viewState.selectedShip.position.y + 0.35,
            viewState.selectedShip.position.z,
          ]}
          center
        >
          <div
            style={{
              background: "rgba(255, 255, 255, 0.95)",
              padding: "12px",
              borderRadius: "8px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              width: "320px",
              fontFamily: "Arial, sans-serif",
              backdropFilter: "blur(10px)",
            }}
          >
            <img
              src="/assets/ship.jfif"
              alt="Ship"
              style={{
                width: "100%",
                borderRadius: "6px",
                marginBottom: "8px",
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />

            <h3
              style={{ margin: "0 0 8px 0", color: "#333", fontSize: "16px" }}
            >
              {selectedInfo?.id ?? "Unknown Ship"}
            </h3>

            <hr
              style={{
                border: "none",
                borderTop: "1px solid #ddd",
                margin: "8px 0",
              }}
            />

            <div
              style={{
                display: "grid",
                gap: "4px",
                fontSize: "14px",
                color: "#555",
              }}
            >
              <p>
                <strong>Speed:</strong> {selectedInfo?.speed ?? "N/A"} knots
              </p>
              <p>
                <strong>Heading:</strong> {selectedInfo?.heading ?? "N/A"}°
              </p>
              <p>
                <strong>Status:</strong> {
                  shipMeshes.get(selectedShipId || "")?.isMoving ? "Moving" : "Stationary"
                }
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <button
                onClick={handleCloseShipInfo}
                style={{
                  flex: 1,
                  background: "#ff5555",
                  color: "white",
                  padding: "8px 12px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px",
                  transition: "background-color 0.2s",
                }}
                onMouseOver={(e) =>
                  ((e.target as HTMLButtonElement).style.backgroundColor =
                    "#ff3333")
                }
                onMouseOut={(e) =>
                  ((e.target as HTMLButtonElement).style.backgroundColor =
                    "#ff5555")
                }
              >
                Close
              </button>
              <button
                onClick={() => handleViewDetails(viewState.selectedShip!.id)}
                disabled={isLoading}
                style={{
                  flex: 1,
                  background: isLoading ? "#999" : "#55aa55",
                  color: "white",
                  padding: "8px 12px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  transition: "background-color 0.2s",
                }}
                onMouseOver={(e) => {
                  if (!isLoading) {
                    (e.target as HTMLButtonElement).style.backgroundColor =
                      "#449944";
                  }
                }}
                onMouseOut={(e) => {
                  if (!isLoading) {
                    (e.target as HTMLButtonElement).style.backgroundColor =
                      "#55aa55";
                  }
                }}
              >
                {isLoading ? "Loading..." : "View Details"}
              </button>
            </div>
          </div>
        </Html>
      )}

      {viewState.mode === "skyview" && viewState.selectedShip && (
        <SkyToView
          shipPosition={viewState.selectedShip.position}
          shipId={viewState.selectedShip.id}
          shipHeading={viewState.selectedShip.heading}
          onModelLoaded={handleModelLoaded}
          onError={handleModelError}
        />
      )}

      {viewState.mode === "skyview" && (
        <>
          <Html center>
            <div
              onClick={handleCloseSkyToView}
              style={{
                position: "fixed",
                top: "20px",
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(255, 85, 85, 0.9)",
                padding: "12px 20px",
                color: "white",
                fontSize: "16px",
                cursor: "pointer",
                borderRadius: "8px",
                zIndex: 1000,
                backdropFilter: "blur(10px)",
                border: "2px solid rgba(255, 255, 255, 0.2)",
                transition: "all 0.2s ease",
                fontFamily: "Arial, sans-serif",
                fontWeight: "bold",
                textAlign: "center",
                minWidth: "200px",
              }}
              onMouseOver={(e) => {
                (e.target as HTMLDivElement).style.background =
                  "rgba(255, 85, 85, 1)";
                (e.target as HTMLDivElement).style.transform =
                  "translateX(-50%) scale(1.05)";
              }}
              onMouseOut={(e) => {
                (e.target as HTMLDivElement).style.background =
                  "rgba(255, 85, 85, 0.9)";
                (e.target as HTMLDivElement).style.transform =
                  "translateX(-50%) scale(1)";
              }}
            >
              ✕ Close Sky-To-View Mode
            </div>
          </Html>

          {isLoading && (
            <Html center>
              <div
                style={{
                  position: "fixed",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  background: "rgba(0, 0, 0, 0.8)",
                  color: "white",
                  padding: "20px",
                  borderRadius: "8px",
                  fontSize: "18px",
                  fontFamily: "Arial, sans-serif",
                  textAlign: "center",
                  zIndex: 999,
                }}
              >
                <div>Loading 3D Model...</div>
                <div
                  style={{ marginTop: "10px", fontSize: "14px", opacity: 0.7 }}
                >
                  Please wait
                </div>
              </div>
            </Html>
          )}
        </>
      )}

      {viewState.selectedShip && route && <ShipRoutes waypoints={route} />}
    </>
  );
}