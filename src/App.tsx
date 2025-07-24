import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { CountryLabels } from "./components/CountryLabels";
import { CountryBorders } from "./components/CountryBorders";
import { ShipMarkers } from "./components/ShipMarkers";
import "./App.css";

function Earth() {
  return (
    <>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <sphereGeometry args={[2, 64, 64]} />
        <meshPhongMaterial
          color="#AAFFFF"
          transparent={true}
          opacity={0.9}
          depthWrite={true}
        />
      </mesh>
    </>
  );
}

export default function App() {
  return (
    <>
      <Canvas camera={{ position: [3, 2, -3], fov: 25 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <Earth />
        <OrbitControls
          zoomSpeed={0.8}
          maxDistance={10}
          target={[0, 0, 0]}
          maxAzimuthAngle={-Math.PI}
          minPolarAngle={2 * Math.PI / 7}
          maxPolarAngle={Math.PI / 2}
        />
        <CountryBorders />
        <CountryLabels />
        <ShipMarkers />
      </Canvas>
    </>
  );
}
