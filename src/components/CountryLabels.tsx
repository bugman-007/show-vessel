import { Text } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, Euler, Matrix4 } from "three";
import { latLonToVector3 } from "../utils/geo";

interface CountryLabel {
  name: string;
  position: Vector3;
}

export function CountryLabels() {
  const [labels, setLabels] = useState<CountryLabel[]>([]);
  const labelRefs = useRef<(THREE.Mesh | null)[]>([]);
  const { camera } = useThree();

  // Load label data only once
  useEffect(() => {
    fetch("/data/label.json")
      .then((res) => res.json())
      .then((data) => {
        const newLabels: CountryLabel[] = data.map(
          (item: { name: string; position: [number, number] }) => {
            const [lon, lat] = item.position;
            return {
              name: item.name,
              position: latLonToVector3(lat, lon, 2.1),
            };
          }
        );
        setLabels(newLabels);
      })
      .catch((error) => {
        console.error("Error loading label data:", error);
      });
  }, []);

  // Update visibility + rotation per frame, without triggering React renders
  useFrame(() => {
    const cameraPosition = camera.position.clone();

    labelRefs.current.forEach((labelMesh, index) => {
      if (!labelMesh) return;
      const label = labels[index];
      if (!label) return;

      const direction = new Vector3()
        .subVectors(cameraPosition, label.position)
        .normalize();

      const normal = label.position.clone().normalize();
      const dot = normal.dot(direction);

      // Hide if facing away
      labelMesh.visible = dot > 0.1;

      // Face camera
      const up = new Vector3(0, 1, 0);
      const right = new Vector3().crossVectors(up, direction).normalize();
      const correctedUp = new Vector3().crossVectors(direction, right);
      const matrix = new Matrix4().makeBasis(right, correctedUp, direction);
      const rotation = new Euler().setFromRotationMatrix(matrix);

      labelMesh.rotation.copy(rotation);
    });
  });

  return (
    <>
      {labels.map((label, index) => (
        <Text
          key={index}
          ref={(el) => (labelRefs.current[index] = el)}
          position={label.position}
          fontSize={0.04}
          color="#333333"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.004}
          outlineColor="white"
          outlineOpacity={0.8}
          fontWeight="bold"
        >
          {label.name}
        </Text>
      ))}
    </>
  );
}
