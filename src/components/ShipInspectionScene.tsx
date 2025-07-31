import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sky, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface ShipInspectionSceneProps {
  shipId: string;
  shipHeading: number;
  onClose: () => void;
  isVisible: boolean;
}

// Ocean Component with animated waves
function Ocean() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useEffect(() => {
    if (!meshRef.current) return;
    
    const geometry = meshRef.current.geometry as THREE.PlaneGeometry;
    const positionAttribute = geometry.getAttribute('position');
    const positions = positionAttribute.array as Float32Array;
    
    // Store original positions for wave animation
    const originalPositions = positions.slice();
    (meshRef.current as any).originalPositions = originalPositions;
  }, []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    
    const time = clock.getElapsedTime();
    const geometry = meshRef.current.geometry as THREE.PlaneGeometry;
    const positionAttribute = geometry.getAttribute('position');
    const positions = positionAttribute.array as Float32Array;
    const originalPositions = (meshRef.current as any).originalPositions;
    
    if (!originalPositions) return;
    
    // Animate waves
    for (let i = 0; i < positions.length; i += 3) {
      const x = originalPositions[i];
      const y = originalPositions[i + 1];
      
      positions[i + 2] = 
        Math.sin(x * 0.5 + time * 2) * 0.15 +
        Math.sin(y * 0.3 + time * 1.5) * 0.08 +
        Math.sin((x + y) * 0.2 + time * 0.8) * 0.05 +
        Math.cos(x * 0.1 + time * 3) * 0.03;
    }
    
    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
      <planeGeometry args={[500, 500, 256, 256]} />
      <meshPhongMaterial
        color="#1e40af"
        transparent
        opacity={0.85}
        shininess={300}
        specular="#87ceeb"
        reflectivity={0.3}
      />
    </mesh>
  );
}

// Ship Model Component - STATIC POSITION WITH SAILING ANIMATION
function ShipModel() {
  const groupRef = useRef<THREE.Group>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  useEffect(() => {
    const loader = new GLTFLoader();
    
    const modelPaths = [
      '/assets/ship.glb',
      '/public/assets/ship.glb',
      './assets/ship.glb',
      '/ship.glb'
    ];
    
    let currentPathIndex = 0;
    
    const tryLoadModel = () => {
      if (currentPathIndex >= modelPaths.length) {
        console.log('No GLB model found - showing empty ocean');
        return;
      }
      
      const currentPath = modelPaths[currentPathIndex];
      
      loader.load(
        currentPath,
        (gltf) => {
          console.log('Ship GLB model loaded successfully');
          
          if (groupRef.current) {
            // Clear any existing models
            while (groupRef.current.children.length > 0) {
              groupRef.current.remove(groupRef.current.children[0]);
            }
            
            const model = gltf.scene;
            
            // STATIC POSITIONING WITH 180° ROTATION
            model.scale.setScalar(0.005);
            model.position.set(0, 0, 0); // Always center of ocean
            model.rotation.y = Math.PI; // 180 degree rotation
            
            // Setup materials and shadows
            model.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                if (child.material) {
                  if (Array.isArray(child.material)) {
                    child.material.forEach((mat) => {
                      if (mat instanceof THREE.MeshStandardMaterial) {
                        mat.needsUpdate = true;
                        mat.metalness = 0.3;
                        mat.roughness = 0.4;
                      }
                    });
                  } else if (child.material instanceof THREE.MeshStandardMaterial) {
                    child.material.needsUpdate = true;
                    child.material.metalness = 0.3;
                    child.material.roughness = 0.4;
                  }
                }
              }
            });
            
            groupRef.current.add(model);
            setIsLoaded(true);
          }
        },
        undefined,
        () => {
          console.log(`GLB model not found at ${currentPath}, trying next path...`);
          currentPathIndex++;
          tryLoadModel();
        }
      );
    };
    
    tryLoadModel();
  }, []); // NO DEPENDENCIES - loads once and never changes

  // SAILING ANIMATION - Ship movement like sailing through water
  useFrame(({ clock }) => {
    if (!groupRef.current || !isLoaded) return;
    
    const time = clock.getElapsedTime();
    
    // Gentle bobbing motion (up and down)
    const bobbing = Math.sin(time * 1.2) * 0.01; // Subtle vertical movement
    
    // Gentle pitch motion (bow up/down like going through waves)
    const pitching = Math.sin(time * 0.8) * 0.02; // Bow dips and rises
    
    // Gentle roll motion (side to side like ocean swell)
    const rolling = Math.sin(time * 0.6) * 0.01; // Gentle side-to-side roll
    
    // Apply the sailing motions
    groupRef.current.position.y = bobbing; // Vertical bobbing
    groupRef.current.rotation.x = pitching; // Pitch (bow up/down)
    groupRef.current.rotation.z = rolling; // Roll (side to side)
    
    // Keep the 180° heading rotation constant
    groupRef.current.rotation.y = Math.PI; // Always facing 180°
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* No fallback model - just empty ocean if GLB doesn't load */}
    </group>
  );
}

// Camera Controller - SMOOTH ANIMATION TO SHIP
function CameraController({ isAnimating }: { isAnimating: boolean }) {
  const { camera } = useThree();
  const animationRef = useRef<{
    progress: number;
    startPos: THREE.Vector3;
    targetPos: THREE.Vector3;
    isActive: boolean;
  } | null>(null);

  useEffect(() => {
    if (isAnimating) {
      animationRef.current = {
        progress: 0,
        startPos: new THREE.Vector3(0, 10, 10),
        targetPos: new THREE.Vector3(-4, 3, 5),
        isActive: true,
      };
    }
  }, [isAnimating]);

  useFrame(() => {
    if (animationRef.current && animationRef.current.isActive) {
      const anim = animationRef.current;
      anim.progress += 0.02;

      const easedProgress = THREE.MathUtils.smoothstep(anim.progress, 0, 1);
      camera.position.lerpVectors(
        anim.startPos,
        anim.targetPos,
        easedProgress
      );

      camera.lookAt(0, 0, 0);

      if (anim.progress >= 1) {
        camera.position.copy(anim.targetPos);
        camera.lookAt(0, 0, 0);
        anim.isActive = false;
      }
    }
  });

  return null;
}

// Main Scene Component
function InspectionScene({ onClose }: { onClose: () => void }) {
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onClose]);

  return (
    <>
      {/* Sky and Environment */}
      <Sky
        distance={450000}
        sunPosition={[100, 20, 100]}
        inclination={0}
        azimuth={0.25}
      />
      <Environment preset="sunset" />
      
      {/* Fog for infinite ocean effect */}
      <fog attach="fog" args={['#1e40af', 20, 80]} />
      
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 15, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={50}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />
      
      {/* Ocean */}
      <Ocean />
      
      {/* Static Ship Model */}
      <ShipModel />
      
      {/* Camera Controller */}
      <CameraController isAnimating={isAnimating} />
      
      {/* Camera Controls */}
      <OrbitControls
        enabled={!isAnimating}
        target={[0, 0, 0]}
        minDistance={3}
        maxDistance={12}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2.2}
        minAzimuthAngle={-Math.PI / 3}
        maxAzimuthAngle={Math.PI / 3}
        enablePan={false}
        enableZoom={true}
        enableRotate={true}
        enableDamping={true}
        dampingFactor={0.1}
      />
    </>
  );
}

// Main Component
const ShipInspectionScene: React.FC<ShipInspectionSceneProps> = ({
  shipId,
  onClose,
  isVisible,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(onClose, 500);
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(() => setShowControls(true), 3500);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible && !isClosing) return null;

  return (
    <div
      className={`fixed inset-0 z-50 transition-all duration-500 ease-in-out ${
        isClosing 
          ? 'opacity-0 scale-95' 
          : 'opacity-100 scale-100'
      }`}
      style={{
        background: 'linear-gradient(to bottom, #87ceeb 0%, #1e40af 60%, #0f172a 100%)',
      }}
    >
      {/* Close Button */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 z-10 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
        style={{
          backdropFilter: 'blur(10px)',
          border: '2px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        ✕ Exit Inspection
      </button>

      {/* Ship Info Panel */}
      <div className="absolute top-6 left-6 z-10 bg-white bg-opacity-90 backdrop-blur-md rounded-lg p-4 shadow-lg max-w-xs">
        <h3 className="text-lg font-bold text-gray-800 mb-2">
          🚢 {shipId}
        </h3>
        <div className="space-y-1 text-sm text-gray-600">
          <p><strong>Status:</strong> Under Inspection</p>
          <p><strong>View:</strong> Sky-to-Sea Mode</p>
          <p><strong>Environment:</strong> Realistic Ocean</p>
        </div>
      </div>

      {/* Control Instructions */}
      {showControls && (
        <div 
          className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 text-white text-center transition-all duration-1000 ${
            showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="bg-black bg-opacity-50 backdrop-blur-md rounded-lg px-6 py-3">
            <p className="text-sm font-semibold mb-2">🎮 Navigation Controls</p>
            <div className="text-xs space-y-1 opacity-90 grid grid-cols-2 gap-3">
              <div className="text-left">
                <p><strong>🖱️ Drag:</strong> Orbit</p>
                <p><strong>🔄 Scroll:</strong> Zoom</p>
              </div>
              <div className="text-left">
                <p><strong>⌨️ ESC:</strong> Exit</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas
        camera={{ 
          position: [0, 10, 10], 
          fov: 60,
          near: 0.1,
          far: 1000
        }}
        shadows
        style={{ width: '100%', height: '100%' }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.2;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <InspectionScene onClose={handleClose} />
      </Canvas>
    </div>
  );
};

export default ShipInspectionScene;