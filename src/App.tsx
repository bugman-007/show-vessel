// Updated App.tsx with real-time data fetching
import { useEffect, useMemo, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PointMaterial, Points } from "@react-three/drei";
import { CountryLabels } from "./components/CountryLabels";
import { CountryBorders } from "./components/CountryBorders";
import { ShipMarkers } from "./components/ShipMarkers";
import { Sidebar } from "./components/Sidebar/Sidebar";
import "./App.css";

// Enhanced ship interface with timestamp
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
  const [ships, setShips] = useState<Ship[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null);
  const [route, setRoute] = useState<Waypoint[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  // Enhanced ship data fetching with error handling and status tracking
  const fetchShips = useCallback(async () => {
    try {
      setConnectionStatus('connecting');
      const response = await fetch("/api/ships", {
        // const response = await fetch("http://52.241.6.183:8079/ships", {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timeout
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Add timestamp to each ship record
      const shipsWithTimestamp = data.map((ship: Ship) => ({
        ...ship,
        timestamp: Date.now(),
      }));
      
      setShips(shipsWithTimestamp);
      setConnectionStatus('connected');
      setIsOnline(true);
      setLastUpdateTime(new Date());
      
    } catch (error) {
      console.error('Error fetching ships:', error);
      setConnectionStatus('error');
      setIsOnline(false);
      
      // Don't clear ships data on error - keep last known positions
      // This prevents ships from disappearing during temporary network issues
    }
  }, []);

  // Enhanced route fetching with error handling
  const fetchRoute = useCallback(async (shipId: string) => {
    if (!shipId) {
      setRoute([]);
      return;
    }
    
    try {
      const response = await fetch(`api/ships/routes/${shipId}`, {
        // const response = await fetch(`http://52.241.6.183:8079/ships/routes/${shipId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(8000), // 8 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const waypoints = (data.waypoints || []).map((wp: any) => ({
        latitude: wp.lat,
        longitude: wp.lon,
      }));
      
      setRoute(waypoints);
      
    } catch (error) {
      console.error(`Error fetching route for ship ${shipId}:`, error);
      setRoute([]); // Clear route on error
    }
  }, []);

  // Initial data fetch on component mount
  useEffect(() => {
    fetchShips();
  }, [fetchShips]);

  // Set up 5-second interval for real-time ship data updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchShips();
    }, 5000); // 5 seconds

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, [fetchShips]);

  // Fetch route when selectedShipId changes
  useEffect(() => {
    fetchRoute(selectedShipId || '');
  }, [selectedShipId, fetchRoute]);

  // Enhanced ship selection handler
  const handleShipSelection = useCallback((shipId: string) => {
    setSelectedShipId(shipId);
    // Route will be fetched automatically by the useEffect above
  }, []);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      fetchShips(); // Immediately fetch when back online
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchShips]);

  // Status indicator component
  const StatusIndicator = () => (
    <div style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      zIndex: 1000,
      background: connectionStatus === 'connected' ? '#4CAF50' : 
                 connectionStatus === 'connecting' ? '#FF9800' : '#F44336',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 'bold',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    }}>
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: 'currentColor',
        animation: connectionStatus === 'connecting' ? 'pulse 1.5s infinite' : 'none',
      }} />
      <span>
        {connectionStatus === 'connected' ? 'Live' : 
         connectionStatus === 'connecting' ? 'Connecting...' : 'Offline'}
      </span>
      {lastUpdateTime && connectionStatus === 'connected' && (
        <span style={{ opacity: 0.8, fontSize: '10px' }}>
          {lastUpdateTime.toLocaleTimeString()}
        </span>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      
      <div style={{ display: "flex", width: "100vw", height: "100vh", position: 'relative' }}>
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
            setSelectedShipId={handleShipSelection}
            route={route}
          />
        </Canvas>
      </div>
    </>
  );
}