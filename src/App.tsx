import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PointMaterial, Points } from "@react-three/drei";
import { CountryLabels } from "./components/CountryLabels";
import { CountryBorders } from "./components/CountryBorders";
import { ShipMarkers } from "./components/ShipMarkers";
import { Sidebar } from "./components/Sidebar/Sidebar";
import "./App.css";

// Enhanced ship interface with timestamp
// interface Ship {
//   id: string;
//   lat: number;
//   lon: number;
//   heading: number;
//   speed?: number;
//   timestamp?: number;
// }

// interface Waypoint {
//   latitude: number;
//   longitude: number;
// }

function Earth() {
  return (
    <>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <sphereGeometry args={[2, 64, 64]} />
        <meshPhongMaterial
          color="#6ec6f5"
          transparent={true}
          opacity={0.9}
          depthWrite={true}
        />
      </mesh>
    </>
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
      <PointMaterial color="white" size={0.3} sizeAttenuation={true} />
    </Points>
  );
}

export default function App() {
  const [ships, setShips] = useState([]);
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null);
  const [route, setRoute] = useState([]);
  // const [isOnline, setIsOnline] = useState(true);
  // const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  // const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  // Fetch ships on mount
  useEffect(() => {
    fetch("http://52.241.6.183:8079/ships")
      .then((res) => res.json())
      .then(setShips)
      .catch(() => setShips([]));
  }, []);

  // Fetch route when selectedShipId changes
  useEffect(() => {
    if (!selectedShipId) {
      setRoute([]);
      return;
    }
    fetch(`http://52.241.6.183:8079/ships/routes/${selectedShipId}`)
      .then((res) => res.json())
      .then((data) => {
        const waypoints = (data.waypoints || []).map((wp: { lat: number; lon: number }) => ({
          latitude: wp.lat,
          longitude: wp.lon,
        }));
        setRoute(waypoints);
      })
      .catch(() => setRoute([]));
  }, [selectedShipId]);

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh" }}>
      <Sidebar
        ships={ships}
        selectedShipId={selectedShipId}
        setSelectedShipId={(id: string) => setSelectedShipId(id)}
        route={route}
      />
      <Canvas camera={{ position: [3, 2, -3], fov: 35 }} style={{ flex: 1 }}>
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
          setSelectedShipId={(id: string) => setSelectedShipId(id)}
          route={route}
        />
      </Canvas>
    </div>
  );
}
