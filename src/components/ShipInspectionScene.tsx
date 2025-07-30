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
    
    // Animate waves with multiple frequencies for realistic ocean
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
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[100, 100, 256, 256]} />
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

// Ship Model Component
function ShipModel({ shipId, heading }: { shipId: string; heading: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  
  useEffect(() => {
    const loader = new GLTFLoader();
    
    const loadTimeout = setTimeout(() => {
      setLoadError(true);
      console.error('Ship model loading timeout');
    }, 10000);
    
    loader.load(
      '/assets/ship.glb',
      (gltf) => {
        clearTimeout(loadTimeout);
        
        if (groupRef.current) {
          // Clear any existing models
          while (groupRef.current.children.length > 0) {
            groupRef.current.remove(groupRef.current.children[0]);
          }
          
          const model = gltf.scene;
          
          // Scale and position the ship properly
          model.scale.setScalar(3); // Larger scale for better visibility
          model.position.set(0, 0.2, 0); // Slightly above water surface
          
          // Orient ship based on heading (0° = facing north/+Z)
          model.rotation.y = THREE.MathUtils.degToRad(heading - 90); // Adjust for model orientation
          
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
                      // Enhance material properties
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
      (progress) => {
        console.log('Ship model loading progress:', (progress.loaded / progress.total) * 100 + '%');
      },
      (error) => {
        clearTimeout(loadTimeout);
        console.error('Error loading ship model:', error);
        setLoadError(true);
      }
    );

    return () => {
      clearTimeout(loadTimeout);
    };
  }, [shipId, heading]);

  return (
    <group ref={groupRef}>
      {/* Placeholder/Fallback while loading or on error */}
      {(!isLoaded || loadError) && (
        <group>
          {/* Ship hull */}
          <mesh position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[3, 0.6, 0.8]} />
            <meshStandardMaterial color={loadError ? "#ff4444" : "#666666"} />
          </mesh>
          {/* Ship superstructure */}
          <mesh position={[0, 0.8, -0.5]} castShadow>
            <boxGeometry args={[1.5, 0.8, 0.6]} />
            <meshStandardMaterial color={loadError ? "#ff6666" : "#888888"} />
          </mesh>
          {/* Mast */}
          <mesh position={[0, 1.5, -0.5]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 1, 8]} />
            <meshStandardMaterial color="#333333" />
          </mesh>
          {/* Bridge */}
          <mesh position={[0, 1.1, -0.2]} castShadow>
            <boxGeometry args={[0.8, 0.4, 0.4]} />
            <meshStandardMaterial color={loadError ? "#ff8888" : "#aaaaaa"} />
          </mesh>
        </group>
      )}
      
      {/* Error indicator */}
      {loadError && (
        <mesh position={[0, 2.5, 0]}>
          <sphereGeometry args={[0.1]} />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
      )}
    </group>
  );
}

// Camera Controller for smooth entry animation
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
      // Start camera animation from dramatic aerial view to inspection position
      animationRef.current = {
        progress: 0,
        startPos: new THREE.Vector3(0, 25, 25), // High aerial view
        targetPos: new THREE.Vector3(-8, 4, 12), // Side inspection view
        isActive: true,
      };
    }
  }, [isAnimating]);

  useFrame(() => {
    if (animationRef.current && animationRef.current.isActive) {
      const anim = animationRef.current;
      anim.progress += 0.015; // Smooth animation speed

      // Smooth camera position interpolation with easing
      const easedProgress = THREE.MathUtils.smoothstep(anim.progress, 0, 1);
      camera.position.lerpVectors(
        anim.startPos,
        anim.targetPos,
        easedProgress
      );

      // Always look at ship
      camera.lookAt(0, 0.5, 0);

      if (anim.progress >= 1) {
        camera.position.copy(anim.targetPos);
        anim.isActive = false;
      }
    }
  });

  return null;
}

// Floating particles for atmosphere
function FloatingParticles() {
  const particlesRef = useRef<THREE.Points>(null);
  
  const { particleGeometry } = React.useMemo(() => {
    // const { particlePositions, particleGeometry } = React.useMemo(() => {
    const positions = new Float32Array(200 * 3);
    for (let i = 0; i < 200; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = Math.random() * 10 + 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    return { particleGeometry: geometry };
    // return { particlePositions: positions, particleGeometry: geometry };
  }, []);

  useFrame(({ clock }) => {
    if (!particlesRef.current) return;
    
    const time = clock.getElapsedTime();
    const positions = particlesRef.current.geometry.getAttribute('position').array as Float32Array;
    
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] += Math.sin(time + positions[i]) * 0.01;
    }
    
    particlesRef.current.geometry.getAttribute('position').needsUpdate = true;
  });

  return (
    <points ref={particlesRef} geometry={particleGeometry}>
      <pointsMaterial
        color="#ffffff"
        size={0.02}
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

// Seagulls for added realism
function Seagulls() {
  const birdsRef = useRef<THREE.Group>(null);
  
  const birdPositions = React.useMemo(() => {
    const positions = [];
    for (let i = 0; i < 5; i++) {
      positions.push({
        x: (Math.random() - 0.5) * 40,
        y: Math.random() * 8 + 5,
        z: (Math.random() - 0.5) * 40,
        speed: Math.random() * 0.02 + 0.01,
        radius: Math.random() * 15 + 10,
      });
    }
    return positions;
  }, []);

  useFrame(({ clock }) => {
    if (!birdsRef.current) return;
    
    const time = clock.getElapsedTime();
    
    birdsRef.current.children.forEach((bird, index) => {
      const birdData = birdPositions[index];
      bird.position.x = Math.cos(time * birdData.speed) * birdData.radius;
      bird.position.z = Math.sin(time * birdData.speed) * birdData.radius;
      bird.position.y = birdData.y + Math.sin(time * birdData.speed * 2) * 1;
      
      // Make birds face their movement direction
      bird.rotation.y = time * birdData.speed + Math.PI / 2;
    });
  });

  return (
    <group ref={birdsRef}>
      {birdPositions.map((_, index) => (
        <mesh key={index}>
          <sphereGeometry args={[0.05, 8, 6]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

// Main Scene Component
function InspectionScene({ shipId, shipHeading, onClose }: Omit<ShipInspectionSceneProps, 'isVisible'>) {
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    // Stop animation after 3 seconds for dramatic effect
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
      
      {/* Enhanced Lighting */}
      <ambientLight intensity={0.3} />
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
      
      {/* Additional atmospheric lighting */}
      <pointLight position={[5, 3, 5]} intensity={0.5} color="#ffd700" />
      <pointLight position={[-5, 3, -5]} intensity={0.3} color="#87ceeb" />
      
      {/* Ocean */}
      <Ocean />
      
      {/* Ship Model */}
      <ShipModel shipId={shipId} heading={shipHeading} />
      
      {/* Floating Particles for atmosphere */}
      <FloatingParticles />
      
      {/* Seagulls for realism */}
      <Seagulls />
      
      {/* Camera Controller */}
      <CameraController isAnimating={isAnimating} />
      
      {/* Orbit Controls (disabled during animation) */}
      <OrbitControls
        enabled={!isAnimating}
        target={[0, 0.5, 0]}
        minDistance={5}
        maxDistance={30}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 2.2}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
      />
    </>
  );
}

// Main Component with Overlay
const ShipInspectionScene: React.FC<ShipInspectionSceneProps> = ({
  shipId,
  shipHeading,
  onClose,
  isVisible,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    // Delay actual close to allow exit animation
    setTimeout(onClose, 500);
  }, [onClose]);

  // Show controls after initial animation
  useEffect(() => {
    const timer = setTimeout(() => setShowControls(true), 3500);
    return () => clearTimeout(timer);
  }, []);

  // Hide loading overlay after initial setup
  useEffect(() => {
    const timer = setTimeout(() => setShowLoadingOverlay(false), 2000);
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
        className={`absolute top-6 right-6 z-10 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg ${
          showLoadingOverlay ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          backdropFilter: 'blur(10px)',
          border: '2px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        ✕ Exit Inspection
      </button>

      {/* Ship Info Panel */}
      <div className={`absolute top-6 left-6 z-10 bg-white bg-opacity-90 backdrop-blur-md rounded-lg p-4 shadow-lg max-w-xs transition-all duration-1000 ${
        showLoadingOverlay ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
      }`}>
        <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
          🚢 {shipId}
        </h3>
        <div className="space-y-1 text-sm text-gray-600">
          <p><strong>Heading:</strong> {shipHeading}°</p>
          <p><strong>Status:</strong> Under Inspection</p>
          <p><strong>View:</strong> Sky-to-Sea Mode</p>
          <p><strong>Environment:</strong> Realistic Ocean</p>
        </div>
        
        {/* Inspection Features */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-2">🔍 <strong>Inspection Features:</strong></p>
          <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
            <span>• Animated waves</span>
            <span>• Dynamic lighting</span>
            <span>• 3D ship model</span>
            <span>• Free camera</span>
          </div>
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
            <p className="text-sm font-semibold mb-2 flex items-center justify-center gap-2">
              🎮 Navigation Controls
            </p>
            <div className="text-xs space-y-1 opacity-90 grid grid-cols-2 gap-3">
              <div className="text-left">
                <p><strong>🖱️ Left Drag:</strong> Orbit</p>
                <p><strong>🔄 Scroll:</strong> Zoom</p>
              </div>
              <div className="text-left">
                <p><strong>🖱️ Right Drag:</strong> Pan</p>
                <p><strong>⌨️ ESC:</strong> Exit</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {showLoadingOverlay && (
        <div className="absolute inset-0 flex items-center justify-center text-white pointer-events-none z-20">
          <div className="bg-black bg-opacity-40 backdrop-blur-sm rounded-xl px-8 py-6 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-xl font-bold mb-2">🌊 Initializing Sea View</p>
            <p className="text-sm opacity-75 mb-3">Preparing realistic ocean environment...</p>
            <div className="flex items-center justify-center gap-2 text-xs opacity-60">
              <span className="animate-pulse">🚢</span>
              <span>Loading vessel details</span>
              <span className="animate-pulse">🌊</span>
            </div>
          </div>
        </div>
      )}

      {/* Performance Monitor (Development only) */}
      {import.meta.env.DEV && !showLoadingOverlay && (
        <div className="absolute top-20 right-6 z-10 bg-black bg-opacity-70 text-green-400 text-xs p-3 rounded-lg font-mono">
          <div className="space-y-1">
            <div>🎬 Sky-to-Sea Mode Active</div>
            <div>🌊 Ocean Waves: Animated</div>
            <div>🚢 Ship Model: {shipId}</div>
            <div>🧭 Heading: {shipHeading}°</div>
          </div>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas
        camera={{ 
          position: [0, 25, 25], 
          fov: 60,
          near: 0.1,
          far: 1000
        }}
        shadows
        style={{ width: '100%', height: '100%' }}
        onCreated={({ gl }) => {
          // Enable better rendering
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.2;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <InspectionScene
          shipId={shipId}
          shipHeading={shipHeading}
          onClose={handleClose}
        />
      </Canvas>
    </div>
  );
};

export default ShipInspectionScene;