// Fixed SkyToView.tsx
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

  // FIXED Configuration - Much more realistic values
  const MODEL_HEIGHT_OFFSET = 0.05;   // POSITIVE - above ocean surface
  const CAMERA_HEIGHT_OFFSET = 0.5;   // Higher camera position
  const CAMERA_DISTANCE_OFFSET = 0.1; // Further back from ship
  const MODEL_SCALE = 0.000007;           // Much larger, visible scale
  const OCEAN_RADIUS = 2.001;         // Slightly above globe surface
  const ANIMATION_SPEED = 0.015;      // Slightly slower for smoother effect
  const LOADING_TIMEOUT = 10000;

  // FIXED: Calculate proper ship model position
  const calculateShipModelPosition = useCallback(() => {
    // Position ship ABOVE the ocean surface
    return shipPosition
      .clone()
      .normalize()
      .multiplyScalar(OCEAN_RADIUS + MODEL_HEIGHT_OFFSET);
  }, [shipPosition]);

  // FIXED: Calculate proper camera position
  const calculateCameraPosition = useCallback(() => {
    const shipModelPos = calculateShipModelPosition();
    const normalDirection = shipPosition.clone().normalize();

    // Calculate proper heading direction
    const headingRad = THREE.MathUtils.degToRad(shipHeading);
    
    // Create local coordinate system at ship position
    const up = normalDirection.clone();
    const east = new THREE.Vector3(0, 1, 0).cross(up).normalize();
    const north = up.clone().cross(east).normalize();
    
    // Ship's forward direction based on heading (0° = North, 90° = East)
    const forwardDir = north.clone()
      .multiplyScalar(Math.cos(headingRad))
      .add(east.clone().multiplyScalar(Math.sin(headingRad)))
      .normalize();

    // Position camera behind and above the ship
    const cameraPos = shipModelPos.clone()
      .add(up.multiplyScalar(CAMERA_HEIGHT_OFFSET))           // Above ocean
      .add(forwardDir.multiplyScalar(-CAMERA_DISTANCE_OFFSET)); // Behind ship

    return cameraPos;
  }, [shipPosition, shipHeading, calculateShipModelPosition]);

  // Calculate camera look-at target
  const calculateCameraTarget = useCallback(() => {
    const shipModelPos = calculateShipModelPosition();
    // Look slightly ahead of the ship
    const normalDirection = shipPosition.clone().normalize();
    const headingRad = THREE.MathUtils.degToRad(shipHeading);
    
    const up = normalDirection.clone();
    const east = new THREE.Vector3(0, 1, 0).cross(up).normalize();
    const north = up.clone().cross(east).normalize();
    
    const forwardDir = north.clone()
      .multiplyScalar(Math.cos(headingRad))
      .add(east.clone().multiplyScalar(Math.sin(headingRad)))
      .normalize();

    return shipModelPos.clone().add(forwardDir.multiplyScalar(0.1));
  }, [shipPosition, shipHeading, calculateShipModelPosition]);

  // FIXED: Load ship model with proper scaling and positioning
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

          // FIXED: Position ship model properly
          const shipModelPosition = calculateShipModelPosition();
          model.position.copy(shipModelPosition);
          model.scale.setScalar(MODEL_SCALE); // Much larger scale

          // FIXED: Proper ship orientation
          const normalDirection = shipPosition.clone().normalize();
          const headingRad = THREE.MathUtils.degToRad(shipHeading);
          
          // Set up local coordinate system
          const up = normalDirection.clone();
          const east = new THREE.Vector3(0, 1, 0).cross(up).normalize();
          const north = up.clone().cross(east).normalize();
          
          // Ship's forward direction
          const forwardDir = north.clone()
            .multiplyScalar(Math.cos(headingRad))
            .add(east.clone().multiplyScalar(Math.sin(headingRad)))
            .normalize();

          // Orient ship: up vector = normal to globe, forward = heading direction
          model.up.copy(up);
          const lookAtTarget = model.position.clone().add(forwardDir);
          model.lookAt(lookAtTarget);

          // Ensure proper material setup
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
  }, [shipPosition, shipHeading, scene, onModelLoaded, onError, calculateShipModelPosition]);

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

  // FIXED: Initialize camera animation with proper target
  useEffect(() => {
    const targetPosition = calculateCameraPosition();
    const targetLookAt = calculateCameraTarget();
    const currentLookAt = new THREE.Vector3(0, 0, 0); // Current globe center

    animationRef.current = {
      progress: 0,
      startPos: camera.position.clone(),
      targetPos: targetPosition,
      startTarget: currentLookAt,
      endTarget: targetLookAt,
      isAnimating: true,
    };
  }, [camera.position, calculateCameraPosition, calculateCameraTarget]);

  // FIXED: Camera animation with proper look-at interpolation
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

  return null;
};

export default SkyToView;