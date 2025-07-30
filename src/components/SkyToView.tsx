import * as THREE from "three";
import { useEffect, useRef, useCallback } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface SkyToViewProps {
  shipPosition: THREE.Vector3;
  shipId: string;
  shipHeading: number;
  onModelLoaded: (model: THREE.Object3D) => void;
  onError: (error: string) => void;
}

interface CameraAnimation {
  progress: number;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  startTarget: THREE.Vector3;
  endTarget: THREE.Vector3;
  isAnimating: boolean;
}

const SkyToView: React.FC<SkyToViewProps> = ({
  shipPosition,
  shipHeading,
  onModelLoaded,
  onError,
}) => {
  const { camera, scene } = useThree();
  const shipModelRef = useRef<THREE.Object3D | null>(null);
  const oceanSurfaceRef = useRef<THREE.Mesh | null>(null);
  const animationRef = useRef<CameraAnimation | null>(null);
  const loaderRef = useRef<GLTFLoader | null>(null);
  const timeoutRef = useRef<number | null>(null);

  // FIXED CONFIGURATION - Much better values
  const MODEL_HEIGHT_OFFSET = 0.08; // Above surface (positive!)
  const CAMERA_HEIGHT_OFFSET = 0.4; // Much higher camera
  const CAMERA_DISTANCE_OFFSET = 1.2; // Much further back
  const MODEL_SCALE = 0.025; // Much larger model
  const ANIMATION_SPEED = 0.015; // Slightly slower for smoothness
  const LOADING_TIMEOUT = 10000;
  // const OCEAN_RADIUS = 2.005; // Slightly above globe

  // Calculate ship model position (FIXED: above surface)
  const calculateShipModelPosition = useCallback(() => {
    const normalDirection = shipPosition.clone().normalize();
    return shipPosition
      .clone()
      .add(normalDirection.multiplyScalar(MODEL_HEIGHT_OFFSET));
  }, [shipPosition]);

  // FIXED: Much better camera positioning
  const calculateCameraPosition = useCallback(() => {
    const shipModelPos = calculateShipModelPosition();
    const normalDirection = shipPosition.clone().normalize();

    // Calculate ship's forward direction based on heading
    const headingRad = THREE.MathUtils.degToRad(shipHeading);
    
    // Create proper tangent vectors on sphere surface
    const east = new THREE.Vector3(0, 1, 0).cross(normalDirection).normalize();
    const north = normalDirection.clone().cross(east).normalize();
    
    // Ship's forward direction
    const shipForward = north
      .clone()
      .multiplyScalar(Math.cos(headingRad))
      .add(east.clone().multiplyScalar(Math.sin(headingRad)))
      .normalize();

    // Position camera behind and above the ship
    const cameraPos = shipModelPos
      .clone()
      .add(normalDirection.multiplyScalar(CAMERA_HEIGHT_OFFSET)) // Much higher
      .add(shipForward.multiplyScalar(-CAMERA_DISTANCE_OFFSET)); // Much further back

    return cameraPos;
  }, [shipPosition, shipHeading, calculateShipModelPosition]);

  // Create ocean surface around ship
  const createOceanSurface = useCallback(() => {
    if (oceanSurfaceRef.current) {
      scene.remove(oceanSurfaceRef.current);
      oceanSurfaceRef.current.geometry.dispose();
      (oceanSurfaceRef.current.material as THREE.Material).dispose();
    }

    // Create a local ocean patch around the ship
    const oceanGeometry = new THREE.PlaneGeometry(4, 4, 32, 32);
    const oceanMaterial = new THREE.MeshPhongMaterial({
      color: "#1e40af",
      transparent: true,
      opacity: 0.8,
      shininess: 100,
    });

    const oceanMesh = new THREE.Mesh(oceanGeometry, oceanMaterial);
    
    // Position ocean surface at ship location on globe
    const normalDirection = shipPosition.clone().normalize();
    oceanMesh.position.copy(shipPosition.clone().add(normalDirection.multiplyScalar(0.001)));
    
    // Orient ocean surface to be tangent to globe
    oceanMesh.lookAt(shipPosition.clone().add(normalDirection.multiplyScalar(2)));
    
    oceanSurfaceRef.current = oceanMesh;
    scene.add(oceanMesh);
  }, [shipPosition, scene]);

  // FIXED: Better model loading and positioning
  const loadShipModel = useCallback(() => {
    if (!loaderRef.current) {
      loaderRef.current = new GLTFLoader();
    }

    timeoutRef.current = window.setTimeout(() => {
      onError("Model loading timeout. Please try again.");
    }, LOADING_TIMEOUT);

    loaderRef.current.load(
      `/assets/ship.glb`,
      (gltf) => {
        try {
          if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }

          // Clean up existing model
          if (shipModelRef.current) {
            scene.remove(shipModelRef.current);
            disposeModel(shipModelRef.current);
          }

          const model = gltf.scene;
          shipModelRef.current = model;

          // FIXED: Proper positioning and scaling
          const shipModelPosition = calculateShipModelPosition();
          model.position.copy(shipModelPosition);
          model.scale.setScalar(MODEL_SCALE); // Much larger

          // FIXED: Better orientation
          const normalDirection = shipPosition.clone().normalize();
          model.up.copy(normalDirection);

          // Calculate proper heading direction
          const headingRad = THREE.MathUtils.degToRad(shipHeading);
          const east = new THREE.Vector3(0, 1, 0).cross(normalDirection).normalize();
          const north = normalDirection.clone().cross(east).normalize();
          const headingDir = north
            .clone()
            .multiplyScalar(Math.cos(headingRad))
            .add(east.clone().multiplyScalar(Math.sin(headingRad)))
            .normalize();

          const lookAtTarget = model.position.clone().add(headingDir);
          model.lookAt(lookAtTarget);

          // Setup materials
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach((mat) => {
                    if (mat instanceof THREE.MeshStandardMaterial) {
                      mat.needsUpdate = true;
                    }
                  });
                } else if (child.material instanceof THREE.MeshStandardMaterial) {
                  child.material.needsUpdate = true;
                }
              }
            }
          });

          scene.add(model);
          
          // Create ocean surface after model is loaded
          createOceanSurface();
          
          onModelLoaded(model);
        } catch (error) {
          console.error("Error setting up 3D model:", error);
          onError("Failed to setup 3D model");
        }
      },
      (progress) => {
        console.log("Loading progress:", (progress.loaded / progress.total) * 100 + "%");
      },
      (error) => {
        console.error("Error loading ship model:", error);
        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        onError("Failed to load ship model. Please check the model file exists.");
      }
    );
  }, [shipPosition, shipHeading, scene, onModelLoaded, onError, calculateShipModelPosition, createOceanSurface]);

  // Dispose of model resources
  const disposeModel = useCallback((model: THREE.Object3D) => {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => disposeMaterial(mat));
          } else {
            disposeMaterial(child.material);
          }
        }
      }
    });
  }, []);

  const disposeMaterial = (material: THREE.Material) => {
    if (material instanceof THREE.MeshStandardMaterial) {
      if (material.map) material.map.dispose();
      if (material.normalMap) material.normalMap.dispose();
      if (material.roughnessMap) material.roughnessMap.dispose();
      if (material.metalnessMap) material.metalnessMap.dispose();
      if (material.aoMap) material.aoMap.dispose();
      if (material.emissiveMap) material.emissiveMap.dispose();
    }
    material.dispose();
  };

  // FIXED: Better camera animation with proper target
  useEffect(() => {
    const targetPosition = calculateCameraPosition();
    const shipModelPos = calculateShipModelPosition();

    animationRef.current = {
      progress: 0,
      startPos: camera.position.clone(),
      targetPos: targetPosition,
      startTarget: new THREE.Vector3(0, 0, 0), // Current look target (globe center)
      endTarget: shipModelPos, // Look at ship model
      isAnimating: true,
    };
  }, [camera.position, calculateCameraPosition, calculateShipModelPosition]);

  // FIXED: Better animation with proper look-at transition
  useFrame(() => {
    if (animationRef.current && animationRef.current.isAnimating) {
      const animation = animationRef.current;
      animation.progress += ANIMATION_SPEED;

      // Smooth camera position interpolation
      camera.position.lerpVectors(
        animation.startPos,
        animation.targetPos,
        animation.progress
      );

      // Smooth look-at target interpolation
      const currentTarget = new THREE.Vector3().lerpVectors(
        animation.startTarget,
        animation.endTarget,
        animation.progress
      );
      camera.lookAt(currentTarget);

      // Check if animation is complete
      if (animation.progress >= 1) {
        camera.position.copy(animation.targetPos);
        camera.lookAt(animation.endTarget);
        animation.isAnimating = false;

        // Start loading the model after camera animation completes
        loadShipModel();
      }
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      if (shipModelRef.current) {
        scene.remove(shipModelRef.current);
        disposeModel(shipModelRef.current);
        shipModelRef.current = null;
      }

      if (oceanSurfaceRef.current) {
        scene.remove(oceanSurfaceRef.current);
        oceanSurfaceRef.current.geometry.dispose();
        (oceanSurfaceRef.current.material as THREE.Material).dispose();
        oceanSurfaceRef.current = null;
      }

      if (animationRef.current) {
        animationRef.current.isAnimating = false;
      }
    };
  }, [scene, disposeModel]);

  // Update model position if ship data changes
  useEffect(() => {
    if (shipModelRef.current) {
      const shipModelPosition = calculateShipModelPosition();
      shipModelRef.current.position.copy(shipModelPosition);

      // Update orientation
      const normalDirection = shipPosition.clone().normalize();
      shipModelRef.current.up.copy(normalDirection);
      const headingRad = THREE.MathUtils.degToRad(shipHeading);
      const east = new THREE.Vector3(0, 1, 0).cross(normalDirection).normalize();
      const north = normalDirection.clone().cross(east).normalize();
      const headingDir = north
        .clone()
        .multiplyScalar(Math.cos(headingRad))
        .add(east.clone().multiplyScalar(Math.sin(headingRad)))
        .normalize();
      const lookAtTarget = shipModelRef.current.position.clone().add(headingDir);
      shipModelRef.current.lookAt(lookAtTarget);
    }
  }, [shipPosition, shipHeading, calculateShipModelPosition]);

  return null;
};

export default SkyToView;