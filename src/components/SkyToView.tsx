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

const MODEL_SCALE = 0.00007;
const OCEAN_RADIUS = 2.001;
const MODEL_HEIGHT_OFFSET = 0.05;
const CAMERA_HEIGHT_OFFSET = 0.5;
const CAMERA_DISTANCE_OFFSET = 0.1;
const ANIMATION_SPEED = 0.015;

const SkyToView: React.FC<SkyToViewProps> = ({
  shipPosition,
  shipHeading,
  onModelLoaded,
  onError,
}) => {
  const { camera, scene } = useThree();
  const modelRef = useRef<THREE.Object3D | null>(null);
  const animationRef = useRef<CameraAnimation | null>(null);

  const calculateShipModelPosition = useCallback(() => {
    return shipPosition
      .clone()
      .normalize()
      .multiplyScalar(OCEAN_RADIUS + MODEL_HEIGHT_OFFSET);
  }, [shipPosition]);

  const calculateCameraPosition = useCallback(() => {
    const shipModelPos = calculateShipModelPosition();
    const up = shipPosition.clone().normalize();
    const east = new THREE.Vector3(0, 1, 0).cross(up).normalize();
    const north = up.clone().cross(east).normalize();

    const headingRad = THREE.MathUtils.degToRad(shipHeading);
    const forwardDir = north
      .clone()
      .multiplyScalar(Math.cos(headingRad))
      .add(east.clone().multiplyScalar(Math.sin(headingRad)))
      .normalize();

    return shipModelPos
      .clone()
      .add(up.clone().multiplyScalar(CAMERA_HEIGHT_OFFSET))
      .add(forwardDir.clone().multiplyScalar(-CAMERA_DISTANCE_OFFSET));
  }, [shipHeading, shipPosition, calculateShipModelPosition]);

  const calculateCameraTarget = useCallback(() => {
    const shipModelPos = calculateShipModelPosition();
    const up = shipPosition.clone().normalize();
    const east = new THREE.Vector3(0, 1, 0).cross(up).normalize();
    const north = up.clone().cross(east).normalize();

    const headingRad = THREE.MathUtils.degToRad(shipHeading);
    const forwardDir = north
      .clone()
      .multiplyScalar(Math.cos(headingRad))
      .add(east.clone().multiplyScalar(Math.sin(headingRad)))
      .normalize();

    return shipModelPos.clone().add(forwardDir.multiplyScalar(0.1));
  }, [shipPosition, shipHeading, calculateShipModelPosition]);

  // Load model (can be preloaded, here we dynamically load if not present)
  const loadModel = useCallback(() => {
    const loader = new GLTFLoader();

    loader.load(
      "/assets/ship.glb",
      (gltf) => {
        try {
          const model = gltf.scene;

          if (modelRef.current) {
            scene.remove(modelRef.current);
            disposeModel(modelRef.current);
          }

          const pos = calculateShipModelPosition();
          model.position.copy(pos);
          model.scale.setScalar(MODEL_SCALE);

          const up = shipPosition.clone().normalize();
          const east = new THREE.Vector3(0, 1, 0).cross(up).normalize();
          const north = up.clone().cross(east).normalize();

          const headingRad = THREE.MathUtils.degToRad(shipHeading);
          const forward = north
            .clone()
            .multiplyScalar(Math.cos(headingRad))
            .add(east.clone().multiplyScalar(Math.sin(headingRad)))
            .normalize();

          model.up.copy(up);
          model.lookAt(pos.clone().add(forward));

          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material instanceof THREE.Material) {
                child.material.needsUpdate = true;
              } else if (Array.isArray(child.material)) {
                child.material.forEach((m) => {
                  if (m instanceof THREE.Material) m.needsUpdate = true;
                });
              }
            }
          });

          scene.add(model);
          modelRef.current = model;
          onModelLoaded(model);
        } catch (e) {
          console.error("Model setup error", e);
          onError("3D model setup failed");
        }
      },
      undefined,
      (err) => {
        console.error("Model load error:", err);
        onError("Failed to load model");
      }
    );
  }, [scene, shipPosition, shipHeading, calculateShipModelPosition]);

  const disposeModel = useCallback((model: THREE.Object3D) => {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });
  }, []);

  useEffect(() => {
    animationRef.current = {
      progress: 0,
      startPos: camera.position.clone(),
      targetPos: calculateCameraPosition(),
      startTarget: new THREE.Vector3(0, 0, 0),
      endTarget: calculateCameraTarget(),
      isAnimating: true,
    };
  }, [camera.position, calculateCameraPosition, calculateCameraTarget]);

  useFrame(() => {
    const anim = animationRef.current;
    if (anim && anim.isAnimating) {
      anim.progress += ANIMATION_SPEED;

      camera.position.lerpVectors(anim.startPos, anim.targetPos, anim.progress);
      const target = new THREE.Vector3().lerpVectors(
        anim.startTarget,
        anim.endTarget,
        anim.progress
      );
      camera.lookAt(target);

      if (anim.progress >= 1) {
        anim.isAnimating = false;
        camera.position.copy(anim.targetPos);
        camera.lookAt(anim.endTarget);
        loadModel(); // Load after camera settles
      }
    }
  });

  useEffect(() => {
    return () => {
      if (modelRef.current) {
        scene.remove(modelRef.current);
        disposeModel(modelRef.current);
        modelRef.current = null;
      }
    };
  }, [scene, disposeModel]);

  return null;
};

export default SkyToView;
