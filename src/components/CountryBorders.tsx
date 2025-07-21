// import * as THREE from "three";
// import { useEffect, useState } from "react";
// import { latLonToVector3 } from "../utils/geo";

// export function CountryBorders() {
//     const [lines, setLines] = useState<THREE.BufferGeometry[]>([]);
    
//       useEffect(() => {
//         fetch("/data/countries.geo.json")
//           .then((res) => res.json())
//           .then((data) => {
//             const geoms: THREE.BufferGeometry[] = [];
//             data.features.forEach((feature: any) => {
//               const coords = feature.geometry.coordinates;
//               if (feature.geometry.type === "Polygon") {
//                 coords.forEach((polygon: any) => {
//                   const points = polygon.map((coord: number[]) =>
//                     latLonToVector3(coord[1], coord[0], 2)
//                   );
//                   const geometry = new THREE.BufferGeometry().setFromPoints(points);
//                   geoms.push(geometry);
//                 });
//               } else if (feature.geometry.type === "MultiPolygon") {
//                 coords.forEach((multiPolygon: any) => {
//                   multiPolygon.forEach((polygon: any) => {
//                     const points = polygon.map((coord: number[]) =>
//                       latLonToVector3(coord[1], coord[0], 2)
//                     );
//                     const geometry = new THREE.BufferGeometry().setFromPoints(
//                       points
//                     );
//                     geoms.push(geometry);
//                   });
//                 });
//               }
//             });
//             setLines(geoms);
//           });
//       }, []);
    
//       return (
//         <>
//           {lines.map((geometry, index) => (
//             <line key={index} geometry={geometry}>
//               <lineBasicMaterial color="#fff" />
//             </line>
//           ))}
//         </>
//       )
// }



// import * as THREE from "three";
// import { useEffect, useState } from "react";
// import { latLonToVector3 } from "../utils/geo";
// import { fixCountryMesh } from "../utils/fixCountryMesh";

// interface CountryMesh {
//   geometry: THREE.BufferGeometry;
//   color: string;
// }

// export function CountryBorders() {
//   const [fills, setFills] = useState<CountryMesh[]>([]);
//   const [lines, setLines] = useState<THREE.BufferGeometry[]>([]);

//   useEffect(() => {
//     async function loadData() {
//       // Load highlighted countries from label.json
//       const labelRes = await fetch("/data/label.json");
//       const labelData = await labelRes.json();
//       const highlightNames = new Set(labelData.map((c: any) => c.name));

//       // Load all countries GeoJSON
//       const res = await fetch("/data/countries.geo.json");
//       const data = await res.json();

//       const fillMeshes: CountryMesh[] = [];
//       const lineGeoms: THREE.BufferGeometry[] = [];

//       const processPolygon = (polygon: number[][], isHighlighted: boolean) => {
//         // Always create border lines
//         const borderPoints = polygon.map(([lon, lat]) => {
//           const { x, y, z } = latLonToVector3(lat, lon, 2.0);
//           return new THREE.Vector3(x, y, z);
//         });
//         lineGeoms.push(new THREE.BufferGeometry().setFromPoints(borderPoints));

//         // If country is in label.json, create filled mesh
//         if (isHighlighted) {
//           const geom = fixCountryMesh(polygon, 2.02, 1); // slightly above surface
//           fillMeshes.push({ geometry: geom, color: "rgba(139, 69, 19, 1)" }); // soil-like color
//         }
//       };

//       data.features.forEach((feature: any) => {
//         const countryName = feature.properties.ADMIN || feature.properties.name;
//         const isHighlighted = highlightNames.has(countryName);
//         const type = feature.geometry.type;
//         const coords = feature.geometry.coordinates;

//         if (type === "Polygon") {
//           coords.forEach((polygon: number[][]) => processPolygon(polygon, isHighlighted));
//         } else if (type === "MultiPolygon") {
//           coords.forEach((multiPolygon: number[][][]) =>
//             multiPolygon.forEach((polygon) => processPolygon(polygon, isHighlighted))
//           );
//         }
//       });

//       setFills(fillMeshes);
//       setLines(lineGeoms);
//     }

//     loadData();
//   }, []);

//   return (
//     <>
//       {/* Filled highlighted countries */}
//       {fills.map((fill, index) => (
//         <mesh key={`fill-${index}`} geometry={fill.geometry}>
//           <meshBasicMaterial color={fill.color} side={THREE.DoubleSide} />
//         </mesh>
//       ))}

//       {/* All country border lines */}
//       {lines.map((geometry, index) => (
//         <line key={`line-${index}`} geometry={geometry}>
//           <lineBasicMaterial color="#ffffff" />
//         </line>
//       ))}
//     </>
//   );
// }




// CountryBorders.tsx (without @react-three/drei)
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
  const [lines, setLines] = useState<{ geometry: THREE.BufferGeometry; position: THREE.Vector3 }[]>([]);
  const { camera } = useThree();

  // References to meshes and lines for visibility updates
  const fillRefs = useRef<THREE.Mesh[]>([]);
  const lineRefs = useRef<THREE.Line[]>([]);

  useEffect(() => {
    fetch("/data/countries.geo.json")
      .then((res) => res.json())
      .then((data) => {
        const fillMeshes: CountryMesh[] = [];
        const lineGeoms: { geometry: THREE.BufferGeometry; position: THREE.Vector3 }[] = [];

        const processPolygon = (polygon: [number, number][]) => { // Fix type annotation
          // Border line geometry
          const borderPoints = polygon.map(([lon, lat]) => {
            const { x, y, z } = latLonToVector3(lat, lon, 2.0);
            return new THREE.Vector3(x, y, z);
          });
          const borderGeom = new THREE.BufferGeometry().setFromPoints(borderPoints);

          // Approximate centroid for visibility
          const centroid = borderPoints.reduce((sum, p) => sum.add(p.clone()), new THREE.Vector3()).divideScalar(borderPoints.length);

          lineGeoms.push({ geometry: borderGeom, position: centroid });

          // Filled mesh with resampling + triangulation
          const geom = fixCountryMesh(polygon, 2, 1);
          fillMeshes.push({ geometry: geom, position: centroid });
        };

        data.features.forEach((feature: any) => {
          const type = feature.geometry.type;
          const coords = feature.geometry.coordinates;

          if (type === "Polygon") {
            coords.forEach((polygon: [number, number][]) => processPolygon(polygon)); // Fix type assertion
          } else if (type === "MultiPolygon") {
            coords.forEach((multiPolygon: [number, number][][]) => // Fix type assertion
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
        mesh.visible = camDir.dot(countryDir) > 0.4; // visible if on the near side
      }
    });
    lineRefs.current.forEach((line, i) => {
      if (line && lines[i]) {
        const countryDir = lines[i].position.clone().normalize();
        line.visible = camDir.dot(countryDir) > 0.5;
      }
    });
  });

  return (
    <>
      {/* Filled countries */}
      {fills.map((fill, index) => (
        <mesh
          key={`fill-${index}`}
          geometry={fill.geometry}
          ref={(el) => {
            if (el) fillRefs.current[index] = el;
          }}
        >
          <meshBasicMaterial
            color="#FFA81E"
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={2}
            polygonOffsetUnits={10}
            depthTest
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Border lines using primitive */}
      {lines.map((line, index) => (
        <primitive
          key={`line-${index}`}
          object={new THREE.Line(line.geometry, new THREE.LineBasicMaterial({ color: "#ffffff" }))}
          ref={(el: THREE.Line) => {
            if (el) lineRefs.current[index] = el;
          }}
        />
      ))}
    </>
  );
}