import { useEffect, useMemo, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PointMaterial, Points } from "@react-three/drei";
import * as THREE from "three";
import { CountryLabels } from "./components/CountryLabels";
import { CountryBorders } from "./components/CountryBorders";
import { ShipMarkers } from "./components/ShipMarkers";
import { Sidebar } from "./components/Sidebar/Sidebar";
import ShipInspectionScene from "./components/ShipInspectionScene";
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
    <mesh rotation={[0, Math.PI / 2, 0]} renderOrder={1}>
      <sphereGeometry args={[2, 64, 64]} />
      <meshPhongMaterial
          color="#E1E7EA"
          side={THREE.DoubleSide} // Only render inside face
          // side={THREE.BackSide} // Only render inside face
          depthWrite={false}
          depthTest={true}
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

// Ship Info Modal Component (Outside Canvas)
function ShipInfoModal({ 
  selectedInfo, 
  onClose, 
  onInspect 
}: { 
  selectedInfo: Ship;
  onClose: () => void;
  onInspect: () => void;
}) {
  return (
    <div className="fixed top-20 right-6 z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          🚢 {selectedInfo.id}
        </h3>
        <p className="text-sm opacity-90">Vessel Information</p>
      </div>

      {/* Ship Image */}
      <div className="relative">
        <img
          src="/assets/ship.jfif"
          alt="Ship"
          className="w-full h-32 object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
      </div>

      {/* Ship Details */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">⚡ Speed:</span>
              <span className="font-semibold text-gray-800">
                {selectedInfo.speed ?? "N/A"} knots
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">🧭 Heading:</span>
              <span className="font-semibold text-gray-800">
                {selectedInfo.heading}°
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">📍 Lat:</span>
              <span className="font-semibold text-gray-800">
                {selectedInfo.lat.toFixed(3)}°
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">📍 Lon:</span>
              <span className="font-semibold text-gray-800">
                {selectedInfo.lon.toFixed(3)}°
              </span>
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-gray-700">
            {selectedInfo.speed && selectedInfo.speed > 0 ? "In Transit" : "Anchored"}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded transition-colors duration-200"
          >
            Close
          </button>
          <button
            onClick={onInspect}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors duration-200 flex items-center justify-center gap-2"
          >
            🔍 Inspect Vessel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [ships, setShips] = useState<Ship[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null);
  const [route, setRoute] = useState<Waypoint[]>([]);
  const [showInspectionScene, setShowInspectionScene] = useState(false);
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
  }, []);

  const handleViewDetails = useCallback(() => {
    setShowInspectionScene(true);
  }, []);

  const handleCloseInspection = useCallback(() => {
    setShowInspectionScene(false);
  }, []);

  const handleCloseShipInfo = useCallback(() => {
    setSelectedShipId(null);
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

  const selectedInfo = ships.find((s) => s.id === selectedShipId);

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

        {/* Canvas - ONLY 3D objects */}
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
          <color attach="background" args={["#efefef"]} />
          <Stars />
          <ambientLight intensity={2.5} />
          <Earth />
          <CountryBorders />
          <CountryLabels />
          <ShipMarkers
            ships={ships}
            selectedShipId={selectedShipId}
            setSelectedShipId={handleShipSelection}
            route={route}
          />
        </Canvas>

        {/* Ship Info Modal - OUTSIDE Canvas */}
        {selectedInfo && !showInspectionScene && (
          <ShipInfoModal
            selectedInfo={selectedInfo}
            onClose={handleCloseShipInfo}
            onInspect={handleViewDetails}
          />
        )}

        {/* Inspection Scene Overlay - OUTSIDE Canvas */}
        {showInspectionScene && selectedInfo && (
          <ShipInspectionScene
            shipId={selectedInfo.id}
            shipHeading={selectedInfo.heading}
            onClose={handleCloseInspection}
            isVisible={showInspectionScene}
          />
        )}
      </div>
    </>
  );
}