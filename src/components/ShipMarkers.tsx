import * as THREE from "three";
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useSpring, animated } from "@react-spring/three";
import { Html } from "@react-three/drei";
import { useThree, useFrame } from "@react-three/fiber";
import { latLonToVector3 } from "../utils/geo";
import { useMockShips } from "../data/ships";
import { ShipRoutes } from "./ShipRoutes";
import { mockRoute } from "../data/mockRoutes";
import SkyToView from "./SkyToView";

// Enhanced type definitions
interface Ship {
  id: string;
  lat: number;
  lon: number;
  heading: number;
  speed?: number;
  route?: string;
}

interface ShipMesh {
  id: string;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  heading: number;
}

interface ViewState {
  mode: 'normal' | 'skyview';
  selectedShip: {
    id: string;
    position: THREE.Vector3;
    heading: number;
  } | null;
  originalCameraPosition: THREE.Vector3 | null;
  loadedModel: THREE.Mesh | null;
}

interface ShipInfo {
  id: string;
  speed: number;
  heading: number;
  route: string;
}

const SHIP_INFO_MAP: Record<string, ShipInfo> = {
  'SHIP_001': { id: 'MV Ocean Explorer', speed: 18, heading: 135, route: 'Dubai → Mumbai → Singapore' },
  'SHIP_002': { id: 'SS Atlantic Voyager', speed: 22, heading: 45, route: 'Rotterdam → New York → Miami' },
  'SHIP_003': { id: 'MS Pacific Dawn', speed: 16, heading: 270, route: 'Tokyo → Los Angeles → Vancouver' },
};

export function ShipMarkers() {
  const ships = useMockShips();
  const { camera, scene } = useThree();
  const radius = 2.05;
  
  // State management
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [viewState, setViewState] = useState<ViewState>({
    mode: 'normal',
    selectedShip: null,
    originalCameraPosition: null,
    loadedModel: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for cleanup and animation
  const animationRef = useRef<number | null>(null);
  const cameraTransitionRef = useRef<{
    progress: number;
    startPos: THREE.Vector3;
    targetPos: THREE.Vector3;
    isAnimating: boolean;
  } | null>(null);

  // Memoized ship meshes calculation
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
    } catch (err) {
      setError('Failed to calculate ship positions');
      return [];
    }
  }, [ships, radius]);

  // Get ship information
  const getShipInfo = useCallback((shipId: string): ShipInfo => {
    return SHIP_INFO_MAP[shipId] || {
      id: shipId,
      speed: 20,
      heading: 135,
      route: 'Unknown Route'
    };
  }, []);

  // Handle ship selection
  const handleShipSelect = useCallback((ship: ShipMesh) => {
    if (viewState.mode === 'skyview') return;
    
    setViewState(prev => ({
      ...prev,
      selectedShip: {
        id: ship.id,
        position: ship.position,
        heading: ship.heading,
      }
    }));
  }, [viewState.mode]);

  // Handle view details
  const handleViewDetails = useCallback((shipId: string) => {
    const ship = shipMeshes.find((s) => s.id === shipId);
    if (!ship) return;

    setIsLoading(true);
    setError(null);
    
    // Save current camera position
    const currentCameraPos = camera.position.clone();
    
    setViewState({
      mode: 'skyview',
      selectedShip: {
        id: ship.id,
        position: ship.position,
        heading: ship.heading,
      },
      originalCameraPosition: currentCameraPos,
      loadedModel: null
    });
  }, [shipMeshes, camera]);

  // Handle close sky-to-view mode
  const handleCloseSkyToView = useCallback(() => {
    if (!viewState.originalCameraPosition || viewState.mode !== 'skyview') return;

    // Clean up existing model
    if (viewState.loadedModel) {
      scene.remove(viewState.loadedModel);
      viewState.loadedModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });
    }

    // Setup camera transition
    cameraTransitionRef.current = {
      progress: 0,
      startPos: camera.position.clone(),
      targetPos: viewState.originalCameraPosition.clone(),
      isAnimating: true
    };

    // Reset view state
    setViewState({
      mode: 'normal',
      selectedShip: null,
      originalCameraPosition: null,
      loadedModel: null
    });
    setIsLoading(false);
    setError(null);
  }, [viewState.originalCameraPosition, viewState.loadedModel, viewState.mode, camera, scene]);

  // Handle model loaded callback
  const handleModelLoaded = useCallback((model: THREE.Mesh) => {
    setViewState(prev => ({
      ...prev,
      loadedModel: model
    }));
    setIsLoading(false);
  }, []);

  // Handle model loading error
  const handleModelError = useCallback((error: string) => {
    setError(error);
    setIsLoading(false);
  }, []);

  // Close ship info panel
  const handleCloseShipInfo = useCallback(() => {
    setViewState(prev => ({
      ...prev,
      selectedShip: null
    }));
  }, []);

  // Camera transition animation
  useFrame(() => {
    if (cameraTransitionRef.current && cameraTransitionRef.current.isAnimating) {
      const transition = cameraTransitionRef.current;
      transition.progress += 0.02;
      
      camera.position.lerpVectors(
        transition.startPos,
        transition.targetPos,
        transition.progress
      );
      
      if (viewState.selectedShip) {
        // Calculate elevated ship position for proper camera lookAt
        const normalDirection = viewState.selectedShip.position.clone().normalize();
        const elevatedShipPos = viewState.selectedShip.position.clone()
          .add(normalDirection.multiplyScalar(0.05)); // Same as MODEL_HEIGHT_OFFSET
        camera.lookAt(elevatedShipPos);
      }
      
      if (transition.progress >= 1) {
        camera.position.copy(transition.targetPos);
        cameraTransitionRef.current.isAnimating = false;
        cameraTransitionRef.current = null;
      }
    }
  });

  // Keyboard event handler
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (viewState.mode === 'skyview') {
          handleCloseSkyToView();
        } else if (viewState.selectedShip) {
          handleCloseShipInfo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [viewState.mode, viewState.selectedShip, handleCloseSkyToView, handleCloseShipInfo]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (viewState.loadedModel) {
        scene.remove(viewState.loadedModel);
      }
    };
  }, []);

  // Error display
  if (error) {
    return (
      <Html center>
        <div style={{
          background: '#ff4444',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          fontFamily: 'Arial, sans-serif'
        }}>
          Error: {error}
        </div>
      </Html>
    );
  }

  return (
    <>
      {/* Ship Markers */}
      {shipMeshes.map((ship) => {
        const { scale } = useSpring({
          scale: hoveredId === ship.id ? 2 : 1,
          config: { tension: 300, friction: 15 },
        });

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
              color={hoveredId === ship.id ? "#ff6666" : "#ff0000"}
              transparent
              opacity={0.9}
            />
          </animated.mesh>
        );
      })}

      {/* Ship Info Panel */}
      {viewState.selectedShip && viewState.mode === 'normal' && (
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
                marginBottom: "8px"
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            
            <h3 style={{ 
              margin: "0 0 8px 0",
              color: "#333",
              fontSize: "16px"
            }}>
              {getShipInfo(viewState.selectedShip.id).id}
            </h3>
            
            <hr style={{ 
              border: "none", 
              borderTop: "1px solid #ddd",
              margin: "8px 0"
            }} />
            
            <div style={{ 
              display: "grid", 
              gap: "4px",
              fontSize: "14px",
              color: "#555"
            }}>
              <p style={{ margin: "0" }}>
                <strong>Speed:</strong> {getShipInfo(viewState.selectedShip.id).speed} knots
              </p>
              <p style={{ margin: "0" }}>
                <strong>Heading:</strong> {getShipInfo(viewState.selectedShip.id).heading}°
              </p>
              <p style={{ margin: "0" }}>
                <strong>Route:</strong> {getShipInfo(viewState.selectedShip.id).route}
              </p>
            </div>
            
            <div style={{ 
              display: "flex", 
              gap: "8px", 
              marginTop: "12px" 
            }}>
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
                  transition: "background-color 0.2s"
                }}
                onMouseOver={(e) => (e.target as HTMLButtonElement).style.backgroundColor = "#ff3333"}
                onMouseOut={(e) => (e.target as HTMLButtonElement).style.backgroundColor = "#ff5555"}
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
                  transition: "background-color 0.2s"
                }}
                onMouseOver={(e) => {
                  if (!isLoading) {
                    (e.target as HTMLButtonElement).style.backgroundColor = "#449944";
                  }
                }}
                onMouseOut={(e) => {
                  if (!isLoading) {
                    (e.target as HTMLButtonElement).style.backgroundColor = "#55aa55";
                  }
                }}
              >
                {isLoading ? "Loading..." : "View Details"}
              </button>
            </div>
          </div>
        </Html>
      )}

      {/* Sky-to-View Component */}
      {viewState.mode === 'skyview' && viewState.selectedShip && (
        <SkyToView
          shipPosition={viewState.selectedShip.position}
          shipId={viewState.selectedShip.id}
          shipHeading={viewState.selectedShip.heading}
          onModelLoaded={handleModelLoaded}
          onError={handleModelError}
        />
      )}

      {/* Sky-to-View Controls */}
      {viewState.mode === 'skyview' && (
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
                minWidth: "200px"
              }}
              onMouseOver={(e) => {
                (e.target as HTMLDivElement).style.background = "rgba(255, 85, 85, 1)";
                (e.target as HTMLDivElement).style.transform = "translateX(-50%) scale(1.05)";
              }}
              onMouseOut={(e) => {
                (e.target as HTMLDivElement).style.background = "rgba(255, 85, 85, 0.9)";
                (e.target as HTMLDivElement).style.transform = "translateX(-50%) scale(1)";
              }}
            >
              ✕ Close Sky-To-View Mode
            </div>
          </Html>
          
          {isLoading && (
            <Html center>
              <div style={{
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
                zIndex: 999
              }}>
                <div>Loading 3D Model...</div>
                <div style={{ 
                  marginTop: "10px", 
                  fontSize: "14px", 
                  opacity: 0.7 
                }}>
                  Please wait
                </div>
              </div>
            </Html>
          )}
        </>
      )}

      {/* Ship Routes */}
      {viewState.selectedShip && <ShipRoutes waypoints={mockRoute} />}
    </>
  );
}