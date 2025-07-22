import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { CountryLabels } from "./components/CountryLabels";
import { CountryBorders } from "./components/CountryBorders";
import "./App.css";

function Earth() {
  return (
    <>
      <mesh>
        <sphereGeometry args={[2, 64, 64]} />
        <meshPhongMaterial color="#AAFFFF" transparent={true} opacity={0.9} depthWrite = {true} />
      </mesh>
    </>
  );
}

export default function App() {
  return (
    <>
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <Earth />
        <OrbitControls zoomSpeed={1} minDistance={2.5} maxDistance={10} />
        <CountryBorders />
        <CountryLabels />
      </Canvas>
    </>
  );
}
