// ShipMarkers.tsx
import * as THREE from "three";
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useSpring, animated } from "@react-spring/three";
import { Html } from "@react-three/drei";
import { useThree, useFrame } from "@react-three/fiber";
import axios from "axios";
import { latLonToVector3 } from "../utils/geo";
import { ShipRoutes } from "./ShipRoutes";
import SkyToView from "./SkyToView";

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

function ShipMarker({ ship, hoveredId, setHoveredId, handleShipSelect }: {
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
}

export function ShipMarkers() {
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

  const animationRef = useRef<number | null>(null);
  const cameraTransitionRef = useRef<{
    progress: number;
    startPos: THREE.Vector3;
    targetPos: THREE.Vector3;
    isAnimating: boolean;
  } | null>(null);

  const [ships, setShips] = useState<Ship[]>([]);
  const [route, setRoute] = useState<Waypoint[] | null>(null);
  const selectedInfo = ships.find(s => s.id === viewState.selectedShip?.id);

  useEffect(() => {
    axios
      .get(`http://52.241.6.183:8079/ships`)
      .then((res) => {
        setShips(res.data);
      })
      .catch(() => setError("Failed to load ship data"));
  }, []);

  useEffect(() => {
    if (viewState.selectedShip) {
      axios
        .get(`http://52.241.6.183:8079/ships/routes/${viewState.selectedShip.id}`)
        .then((res) => {
          // Transform waypoints to { latitude, longitude }
          const waypoints = (res.data.waypoints || []).map((wp: { lat: number; lon: number }) => ({
            latitude: wp.lat,
            longitude: wp.lon,
          }));
          setRoute(waypoints);
        })
        .catch(() => setError("Failed to load ship route"));
    } else {
      setRoute(null);
    }
  }, [viewState.selectedShip]);

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
      setError("Failed to calculate ship positions");
      return [];
    }
  }, [ships, radius]);

  const handleShipSelect = useCallback(
    (ship: ShipMesh) => {
      if (viewState.mode === "skyview") return;
      setViewState((prev) => ({
        ...prev,
        selectedShip: {
          id: ship.id,
          position: ship.position,
          heading: ship.heading,
        },
      }));
    },
    [viewState.mode]
  );

  const handleViewDetails = useCallback(
    (shipId: string) => {
      const ship = shipMeshes.find((s) => s.id === shipId);
      if (!ship) return;

      setIsLoading(true);
      setError(null);

      const currentCameraPos = camera.position.clone();

      setViewState({
        mode: "skyview",
        selectedShip: {
          id: ship.id,
          position: ship.position,
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
  }, [viewState.originalCameraPosition, viewState.loadedModel, viewState.mode, camera, scene]);

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
    if (cameraTransitionRef.current && cameraTransitionRef.current.isAnimating) {
      const transition = cameraTransitionRef.current;
      transition.progress += 0.02;

      camera.position.lerpVectors(
        transition.startPos,
        transition.targetPos,
        transition.progress
      );

      if (viewState.selectedShip) {
        const normalDirection = viewState.selectedShip.position.clone().normalize();
        const elevatedShipPos = viewState.selectedShip.position.clone().add(normalDirection.multiplyScalar(0));
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
  }, [viewState.mode, viewState.selectedShip, handleCloseSkyToView, handleCloseShipInfo]);

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
        <div style={{
          background: "#ff4444",
          color: "white",
          padding: "10px",
          borderRadius: "5px",
          fontFamily: "Arial, sans-serif"
        }}>
          Error: {error}
        </div>
      </Html>
    );
  }

  return (
    <>
      {shipMeshes.map((ship) => (
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
          <div style={{
            background: "rgba(255, 255, 255, 0.95)",
            padding: "12px",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            width: "320px",
            fontFamily: "Arial, sans-serif",
            backdropFilter: "blur(10px)",
          }}>
            <img
              src="/assets/ship.jfif"
              alt="Ship"
              style={{ width: "100%", borderRadius: "6px", marginBottom: "8px" }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />

            <h3 style={{ margin: "0 0 8px 0", color: "#333", fontSize: "16px" }}>
              {selectedInfo?.id ?? "Unknown Ship"}
            </h3>

            <hr style={{ border: "none", borderTop: "1px solid #ddd", margin: "8px 0" }} />

            <div style={{ display: "grid", gap: "4px", fontSize: "14px", color: "#555" }}>
              <p><strong>Speed:</strong> {selectedInfo?.speed ?? "N/A"} knots</p>
              <p><strong>Heading:</strong> {selectedInfo?.heading ?? "N/A"}°</p>
              {/* <p><strong>Route:</strong> {route ? route.map(wp => `${wp.latitude},${wp.longitude}`).join(" → ") : "N/A"}</p> */}
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
                  transition: "background-color 0.2s"
                }}
                onMouseOver={(e) => ((e.target as HTMLButtonElement).style.backgroundColor = "#ff3333")}
                onMouseOut={(e) => ((e.target as HTMLButtonElement).style.backgroundColor = "#ff5555")}
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
                <div style={{ marginTop: "10px", fontSize: "14px", opacity: 0.7 }}>
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
