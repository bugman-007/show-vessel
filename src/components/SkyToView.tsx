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
  isAnimating: boolean;
}

const SkyToView: React.FC<SkyToViewProps> = ({
  shipPosition,
  // shipId,
  shipHeading,
  onModelLoaded,
  onError,
}) => {
  const { camera, scene } = useThree();
  const shipModelRef = useRef<THREE.Object3D | null>(null);
  const animationRef = useRef<CameraAnimation | null>(null);
  const loaderRef = useRef<GLTFLoader | null>(null);
  // Fixed: Use number instead of NodeJS.Timeout for browser compatibility
  const timeoutRef = useRef<number | null>(null);

  // Configuration
  const MODEL_HEIGHT_OFFSET = -0.0; // Distance above globe surface
  const CAMERA_HEIGHT_OFFSET = 0.15; // Camera height above ship model
  const CAMERA_DISTANCE_OFFSET = 0.2; // Camera distance from ship
  const MODEL_SCALE = 0.000003;
  // Fixed: Use number instead of NodeJS.Timeout
  const ANIMATION_SPEED = 0.02;
  const LOADING_TIMEOUT = 10000; // 10 seconds

  // Calculate ship model position (elevated above globe surface)
  const calculateShipModelPosition = useCallback(() => {
    // Get the direction from globe center to ship position (normal vector)
    const normalDirection = shipPosition.clone().normalize();
    // Move the ship model slightly above the globe surface
    return shipPosition
      .clone()
      .add(normalDirection.multiplyScalar(MODEL_HEIGHT_OFFSET));
  }, [shipPosition]);

  // Calculate camera target position (above and behind the ship)
  const calculateCameraPosition = useCallback(() => {
    const shipModelPos = calculateShipModelPosition();

    // Get the normal direction (away from globe center)
    const normalDirection = shipPosition.clone().normalize();

    // Calculate ship's forward direction based on heading
    const headingRad = THREE.MathUtils.degToRad(shipHeading);
    // Create forward direction in local space (relative to ship's orientation on globe)
    // const localForward = new THREE.Vector3(
    //   Math.sin(headingRad),
    //   0,
    //   Math.cos(headingRad)
    // );

    // Transform local forward to world space (considering globe curvature)
    const up = normalDirection.clone();
    const right = new THREE.Vector3(0, 1, 0).cross(up).normalize();
    const forward = up.clone().cross(right).normalize();

    // Apply heading rotation
    const rotatedForward = forward
      .clone()
      .multiplyScalar(Math.cos(headingRad))
      .add(right.clone().multiplyScalar(Math.sin(headingRad)));

    // Position camera behind and above the ship
    const cameraPos = shipModelPos
      .clone()
      .add(normalDirection.multiplyScalar(CAMERA_HEIGHT_OFFSET)) // Above
      .add(rotatedForward.multiplyScalar(-CAMERA_DISTANCE_OFFSET)); // Behind

    return cameraPos;
  }, [shipPosition, shipHeading, calculateShipModelPosition]);

  // Load ship model with error handling
  const loadShipModel = useCallback(() => {
    if (!loaderRef.current) {
      loaderRef.current = new GLTFLoader();
    }

    // Set loading timeout - Fixed: Use window.setTimeout for browser compatibility
    timeoutRef.current = window.setTimeout(() => {
      onError("Model loading timeout. Please try again.");
    }, LOADING_TIMEOUT);

    loaderRef.current.load(
      `/assets/ship.glb`,
      (gltf) => {
        try {
          // Clear timeout
          if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }

          // Clean up existing model
          if (shipModelRef.current) {
            scene.remove(shipModelRef.current);
            disposeModel(shipModelRef.current);
          }

          // Setup new model
          const model = gltf.scene;
          shipModelRef.current = model;

          // Calculate proper ship position (elevated above globe surface)
          const shipModelPosition = calculateShipModelPosition();

          // Position and orient the model
          model.position.copy(shipModelPosition);
          model.scale.setScalar(MODEL_SCALE);

          // Orient the ship model perpendicular to globe surface and facing heading
          const normalDirection = shipPosition.clone().normalize();
          model.up.copy(normalDirection);

          // Calculate heading direction tangent to the globe
          const headingRad = THREE.MathUtils.degToRad(shipHeading);
          // Find a vector tangent to the globe at this point, in the heading direction
          // We'll use the east and north directions at this point
          const east = new THREE.Vector3(0, 1, 0).cross(normalDirection).normalize();
          const north = normalDirection.clone().cross(east).normalize();
          // Heading: 0 = north, 90 = east
          const headingDir = north.clone().multiplyScalar(Math.cos(headingRad)).add(east.clone().multiplyScalar(Math.sin(headingRad))).normalize();
          // Target point in front of the ship
          const lookAtTarget = model.position.clone().add(headingDir);
          model.lookAt(lookAtTarget);

          // Ensure all materials are properly set up
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              // Enable shadows if needed
              child.castShadow = true;
              child.receiveShadow = true;

              // Ensure materials are properly configured
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach((mat) => {
                    if (mat instanceof THREE.MeshStandardMaterial) {
                      mat.needsUpdate = true;
                    }
                  });
                } else if (
                  child.material instanceof THREE.MeshStandardMaterial
                ) {
                  child.material.needsUpdate = true;
                }
              }
            }
          });

          // Add to scene
          console.log(model);
          scene.add(model);

          // Notify parent component
          onModelLoaded(model);
        } catch (error) {
          console.error("Error setting up 3D model:", error);
          onError("Failed to setup 3D model");
        }
      },
      (progress) => {
        // Optional: You could emit loading progress here
        console.log(
          "Loading progress:",
          (progress.loaded / progress.total) * 100 + "%"
        );
      },
      (error) => {
        console.error("Error loading ship model:", error);

        // Clear timeout
        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        onError(
          "Failed to load ship model. Please check the model file exists."
        );
      }
    );
  }, [shipPosition, shipHeading, scene, onModelLoaded, onError, calculateShipModelPosition]);

  // Dispose of model resources
  const disposeModel = useCallback((model: THREE.Object3D) => {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Dispose geometry
        if (child.geometry) {
          child.geometry.dispose();
        }

        // Dispose materials
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              disposeMaterial(mat);
            });
          } else {
            disposeMaterial(child.material);
          }
        }
      }
    });
  }, []);

  // Helper function to dispose materials
  const disposeMaterial = (material: THREE.Material) => {
    if (material instanceof THREE.MeshStandardMaterial) {
      // Dispose textures
      if (material.map) material.map.dispose();
      if (material.normalMap) material.normalMap.dispose();
      if (material.roughnessMap) material.roughnessMap.dispose();
      if (material.metalnessMap) material.metalnessMap.dispose();
      if (material.aoMap) material.aoMap.dispose();
      if (material.emissiveMap) material.emissiveMap.dispose();
    }
    material.dispose();
  };

  // Initialize camera animation
  useEffect(() => {
    const targetPosition = calculateCameraPosition();

    animationRef.current = {
      progress: 0,
      startPos: camera.position.clone(),
      targetPos: targetPosition,
      isAnimating: true,
    };
  }, [camera.position, calculateCameraPosition]);

  // Camera animation frame loop
  useFrame(() => {
    if (animationRef.current && animationRef.current.isAnimating) {
      const animation = animationRef.current;
      animation.progress += ANIMATION_SPEED;

      // Smooth camera interpolation
      camera.position.lerpVectors(
        animation.startPos,
        animation.targetPos,
        animation.progress
      );

      // Always look at the ship model (not the original ship position)
      const shipModelPos = calculateShipModelPosition();
      camera.lookAt(shipModelPos);

      // Check if animation is complete
      if (animation.progress >= 1) {
        camera.position.copy(animation.targetPos);
        animation.isAnimating = false;

        // Start loading the model after camera animation completes
        loadShipModel();
      }
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any pending timeouts - Fixed: Use window.clearTimeout
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      // Clean up model
      if (shipModelRef.current) {
        scene.remove(shipModelRef.current);
        disposeModel(shipModelRef.current);
        shipModelRef.current = null;
      }

      // Cancel any ongoing animations
      if (animationRef.current) {
        animationRef.current.isAnimating = false;
      }
    };
  }, [scene, disposeModel]);

  // Update model position and rotation if ship data changes
  useEffect(() => {
    if (shipModelRef.current) {
      const shipModelPosition = calculateShipModelPosition();
      shipModelRef.current.position.copy(shipModelPosition);

      // Re-orient the model using the robust lookAt method
      const normalDirection = shipPosition.clone().normalize();
      shipModelRef.current.up.copy(normalDirection);
      const headingRad = THREE.MathUtils.degToRad(shipHeading);
      const east = new THREE.Vector3(0, 1, 0).cross(normalDirection).normalize();
      const north = normalDirection.clone().cross(east).normalize();
      const headingDir = north.clone().multiplyScalar(Math.cos(headingRad)).add(east.clone().multiplyScalar(Math.sin(headingRad))).normalize();
      const lookAtTarget = shipModelRef.current.position.clone().add(headingDir);
      shipModelRef.current.lookAt(lookAtTarget);
    }
  }, [shipPosition, shipHeading, calculateShipModelPosition]);

  // This component doesn't render anything visible directly
  return null;
};

export default SkyToView;