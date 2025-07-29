import { Text } from "@react-three/drei";
import { useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, Euler, Matrix4 } from "three";
import { latLonToVector3 } from "../utils/geo";

interface CountryLabel {
  name: string;
  position: Vector3;
  visible: boolean;
  rotation: Euler;
}

export function CountryLabels() {
  const [labels, setLabels] = useState<CountryLabel[]>([]);
  const { camera } = useThree();

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
              visible: true,
              rotation: new Euler(0, 0, 0),
            };
          }
        );
        setLabels(newLabels);
      })
      .catch((error) => {
        console.error("Error loading label data:", error);
      });
  }, []);

  useFrame(() => {
    const cameraPosition = camera.position.clone();

    setLabels((prevLabels) =>
      prevLabels.map((label) => {
        const labelToCamera = new Vector3().subVectors(
          cameraPosition,
          label.position
        );
        const labelNormal = label.position.clone().normalize();

        const dotProduct = labelNormal.dot(labelToCamera.normalize());

        const direction = new Vector3()
          .subVectors(cameraPosition, label.position)
          .normalize();
        const up = new Vector3(0, 1, 0);
        const right = new Vector3().crossVectors(up, direction).normalize();
        const correctedUp = new Vector3().crossVectors(direction, right);

        const matrix = new Matrix4();
        matrix.makeBasis(right, correctedUp, direction);
        const rotation = new Euler().setFromRotationMatrix(matrix);

        return {
          ...label,
          visible: dotProduct > 0.1,
          rotation: rotation,
        };
      })
    );
  });

  return (
    <>
      {labels.map(
        (label, index) =>
          label.visible && (
            <Text
              key={index}
              position={label.position}
              rotation={label.rotation}
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
          )
      )}
    </>
  );
}
