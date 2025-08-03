import * as THREE from "three";
import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { latLonToVector3 } from "../utils/geo";
import { fixCountryMesh } from "../utils/fixCountryMesh";

interface CountryMesh {
  geometry: THREE.BufferGeometry;
  position: THREE.Vector3; // approximate centroid for visibility check
}

export function CountryBorders() {
  const [fills, setFills] = useState<CountryMesh[]>([]);
  const [lines, setLines] = useState<
    { geometry: THREE.BufferGeometry; position: THREE.Vector3 }[]
  >([]);
  const { camera } = useThree();

  // References to meshes and lines for visibility updates
  const fillRefs = useRef<THREE.Mesh[]>([]);
  const lineRefs = useRef<THREE.Line[]>([]);

  useEffect(() => {
    fetch("/data/countries.geo.json")
      .then((res) => res.json())
      .then((data) => {
        const fillMeshes: CountryMesh[] = [];
        const lineGeoms: {
          geometry: THREE.BufferGeometry;
          position: THREE.Vector3;
        }[] = [];

        const processPolygon = (polygon: [number, number][]) => {
          // Border line geometry
          const borderPoints = polygon.map(([lon, lat]) => {
            return latLonToVector3(lat, lon, 2.0025);
          });
          const borderGeom = new THREE.BufferGeometry().setFromPoints(
            borderPoints
          );

          // Approximate centroid for visibility
          const centroid = borderPoints
            .reduce((sum, p) => sum.add(p.clone()), new THREE.Vector3())
            .divideScalar(borderPoints.length);

          lineGeoms.push({ geometry: borderGeom, position: centroid });

          // Filled mesh with perfect spherical triangulation
          const geom = fixCountryMesh(polygon, 2.002, 3); // minSubdivisions = 3
          fillMeshes.push({ geometry: geom, position: centroid });
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.features.forEach((feature: any) => {
          const type = feature.geometry.type;
          const coords = feature.geometry.coordinates;

          if (type === "Polygon") {
            coords.forEach((polygon: [number, number][]) =>
              processPolygon(polygon)
            );
          } else if (type === "MultiPolygon") {
            coords.forEach((multiPolygon: [number, number][][]) =>
              multiPolygon.forEach((polygon) => processPolygon(polygon))
            );
          }
        });

        setFills(fillMeshes);
        setLines(lineGeoms);
      });
  }, []);

  // Update visibility each frame based on camera position
  useFrame(() => {
    const camDir = camera.position.clone().normalize();

    fillRefs.current.forEach((mesh, i) => {
      if (mesh && fills[i]) {
        const countryDir = fills[i].position.clone().normalize();
        mesh.visible = camDir.dot(countryDir) > 0.2;
      }
    });

    lineRefs.current.forEach((line, i) => {
      if (line && lines[i]) {
        const countryDir = lines[i].position.clone().normalize();
        line.visible = camDir.dot(countryDir) > 0;
      }
    });
  });

  return (
    <>
      {/* White backing layer - using clipping for clean look */}
      <mesh rotation={[0, Math.PI / 2, 0]} renderOrder={1.5}>
        <sphereGeometry args={[2.00018, 128, 128]} />
        <meshPhongMaterial
          color="#FFFFFF"
          opacity={1} // Full opacity
          transparent={false} // No transparency needed
          depthWrite={true}
          depthTest={true}
        />
      </mesh>

      {/* Filled countries */}
      {fills.map((fill, index) => (
        <mesh
          key={`fill-${index}`}
          geometry={fill.geometry}
          ref={(el) => {
            if (el) fillRefs.current[index] = el;
          }}
          renderOrder={2}
        >
          <meshBasicMaterial
            color="#FFFFFF"
            side={THREE.FrontSide}
            depthWrite={true}
            depthTest={true}
          />
        </mesh>
      ))}

      {/* Border lines */}
      {lines.map((line, index) => (
        <primitive
          key={`line-${index}`}
          object={(() => {
            const lineObj = new THREE.Line(
              line.geometry,
              new THREE.LineBasicMaterial({
                color: "#BDBDBD",
                depthWrite: true,
                depthTest: true,
              })
            );
            lineObj.renderOrder = 3;
            return lineObj;
          })()}
          ref={(el: THREE.Line) => {
            if (el) lineRefs.current[index] = el;
          }}
        />
      ))}
    </>
  );
}
