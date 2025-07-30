import { useEffect, useMemo, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PointMaterial, Points } from "@react-three/drei";
import { CountryLabels } from "./components/CountryLabels";
import { CountryBorders } from "./components/CountryBorders";
import { ShipMarkers } from "./components/ShipMarkers";
import { Sidebar } from "./components/Sidebar/Sidebar";
// import SkyToView from "./components/SkyToView";
// import * as THREE from "three";
import "./App.css";

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

function Earth() {
  return (
    <mesh rotation={[0, Math.PI / 2, 0]}>
      <sphereGeometry args={[2, 64, 64]} />
      <meshPhongMaterial
        color="#6ec6f5"
        transparent
        opacity={0.9}
        depthWrite={true}
      />
    </mesh>
  );
}

function Stars() {
  const points = useMemo(() => {
    const arr = [];
    const minDistance = 70;
    const maxDistance = 100;
    for (let i = 0; i < 1000; i++) {
      let x, y, z, d;
      do {
        x = (Math.random() - 0.5) * 2 * maxDistance;
        y = (Math.random() - 0.5) * 2 * maxDistance;
        z = (Math.random() - 0.5) * 2 * maxDistance;
        d = Math.sqrt(x * x + y * y + z * z);
      } while (d < minDistance);
      arr.push(x, y, z);
    }
    return new Float32Array(arr);
  }, []);
  return (
    <Points positions={points} stride={3}>
      <PointMaterial color="white" size={0.3} sizeAttenuation />
    </Points>
  );
}

export default function App() {
  const [ships, setShips] = useState<Ship[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null);
  const [route, setRoute] = useState<Waypoint[]>([]);
  const [viewMode, setViewMode] = useState<"normal" | "skyview">("normal");
  const [isOnline, setIsOnline] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "error"
  >("connecting");

  const fetchShips = useCallback(async () => {
    try {
      setConnectionStatus("connecting");
      const response = await fetch("/api/ships", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) throw new Error(`HTTP error! ${response.status}`);

      const data = await response.json();
      const shipsWithTimestamp = data.map((ship: Ship) => ({
        ...ship,
        timestamp: Date.now(),
      }));

      setShips(shipsWithTimestamp);
      setConnectionStatus("connected");
      setIsOnline(true);
      setLastUpdateTime(new Date());
    } catch (err) {
      console.error("Error fetching ships:", err);
      setConnectionStatus("error");
      setIsOnline(false);
    }
  }, []);

  const fetchRoute = useCallback(async (shipId: string) => {
    if (!shipId) {
      setRoute([]);
      return;
    }
    try {
      const res = await fetch(`/api/ships/routes/${shipId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP error! ${res.status}`);
      const data = await res.json();
      const waypoints = (data.waypoints || []).map(
        (wp: { lat: number; lon: number }) => ({
          latitude: wp.lat,
          longitude: wp.lon,
        })
      );
      setRoute(waypoints);
    } catch (err) {
      console.error(`Error fetching route for ${shipId}:`, err);
      setRoute([]);
    }
  }, []);

  useEffect(() => {
    fetchShips();
    const interval = setInterval(fetchShips, 5000);
    return () => clearInterval(interval);
  }, [fetchShips]);

  useEffect(() => {
    fetchRoute(selectedShipId || "");
  }, [selectedShipId, fetchRoute]);

  const handleShipSelection = useCallback((shipId: string) => {
    setSelectedShipId(shipId);
    setViewMode("normal");
  }, []);

  // Network listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      fetchShips();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [fetchShips]);

  const StatusIndicator = () => (
    <div
      className="fixed top-4 right-4 z-50 px-3 py-1 rounded-full text-sm font-bold text-white shadow-md"
      style={{
        background:
          connectionStatus === "connected"
            ? "#4CAF50"
            : connectionStatus === "connecting"
            ? "#FF9800"
            : "#F44336",
      }}
    >
      ●{" "}
      {connectionStatus === "connected"
        ? "Live"
        : connectionStatus === "connecting"
        ? "Connecting..."
        : "Offline"}
    </div>
  );

  const selectedShip = ships.find((s) => s.id === selectedShipId);

  return (
    <>
      <div className="w-screen h-screen flex relative bg-black">
        <StatusIndicator />
        <Sidebar
          ships={ships}
          selectedShipId={selectedShipId}
          setSelectedShipId={handleShipSelection}
          route={route}
          connectionStatus={connectionStatus}
          lastUpdateTime={lastUpdateTime}
          isOnline={isOnline}
        />

        {/* Info Modal in Normal Mode */}
        {viewMode === "normal" && selectedShip && (
          <div className="fixed top-20 right-6 z-50 w-80 bg-white rounded-lg shadow-lg p-4 text-sm">
            <h3 className="text-lg font-bold mb-2">{selectedShip.id}</h3>
            <p>Speed: {selectedShip.speed || 0} knots</p>
            <p>Heading: {selectedShip.heading}°</p>
            <p>
              Status:{" "}
              {selectedShip.speed && selectedShip.speed > 0
                ? "Moving"
                : "Stationary"}
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setSelectedShipId(null)}
                className="bg-gray-300 hover:bg-gray-400 text-black px-4 py-1 rounded"
              >
                Close
              </button>
              <button
                onClick={() => setViewMode("skyview")}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded"
              >
                View Details
              </button>
            </div>
          </div>
        )}

        {/* Close button for Sky-To-View */}
        {viewMode === "skyview" && (
          <div className="fixed top-4 right-4 z-50">
            <button
              onClick={() => {
                setViewMode("normal");
                setSelectedShipId(null);
              }}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded shadow-md transition"
            >
              ✕ Exit Sky-To-View
            </button>
          </div>
        )}

        <Canvas camera={{ position: [3, 2, -3], fov: 35 }} className="flex-1">
          <OrbitControls
            zoomSpeed={0.8}
            minDistance={2.1}
            maxDistance={5.5}
            target={[0, 0, 0]}
            minAzimuthAngle={Math.PI * 0.65}
            maxAzimuthAngle={Math.PI * 1}
            minPolarAngle={(2 * Math.PI) / 7}
            maxPolarAngle={Math.PI / 2}
          />
          <color attach="background" args={["#375877"]} />
          <Stars />
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <Earth />
          <CountryBorders />
          <CountryLabels />
          <ShipMarkers
            ships={ships}
            selectedShipId={selectedShipId}
            setSelectedShipId={handleShipSelection}
            route={route}
            viewMode={viewMode}
            setViewMode={setViewMode}
          />
          {/* {viewMode === "skyview" && selectedShip && (
            <SkyToView
              shipId={selectedShip.id}
              shipHeading={selectedShip.heading}
              shipPosition={new THREE.Vector3()} // Placeholder — actual should come from state
              onModelLoaded={() => {}}
              onError={() => {}}
            />
          )} */}
        </Canvas>
      </div>
    </>
  );
}
