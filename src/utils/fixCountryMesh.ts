import * as THREE from "three";
import { latLonToVector3 } from "./geo";

/**
 * Resample a polygon edge to better follow the sphere surface.
 * Adds intermediate points so large edges curve correctly.
 */
function resampleEdge(
  start: [number, number],
  end: [number, number],
  maxSegmentDeg = 1
): [number, number][] {
  const [lon1, lat1] = start;
  const [lon2, lat2] = end;

  const dLon = lon2 - lon1;
  const dLat = lat2 - lat1;
  const steps = Math.max(
    2,
    Math.ceil(Math.max(Math.abs(dLon), Math.abs(dLat)) / maxSegmentDeg)
  );

  const resampled: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    resampled.push([lon1 + dLon * t, lat1 + dLat * t]);
  }
  return resampled;
}

/**
 * Resample all edges of a polygon ring
 */
function resamplePolygon(
  polygon: [number, number][],
  maxSegmentDeg = 1
): [number, number][] {
  const resampled: [number, number][] = [];
  for (let i = 0; i < polygon.length - 1; i++) {
    const segment = resampleEdge(polygon[i], polygon[i + 1], maxSegmentDeg);
    // Avoid duplicating vertices at segment joins
    if (i > 0) segment.shift();
    resampled.push(...segment);
  }
  return resampled;
}

/**
 * Generate BufferGeometry for a polygon on a sphere
 */
export function fixCountryMesh(
  polygon: [number, number][],
  radius = 2.01,
  segmentDeg = 1
): THREE.BufferGeometry {
  const resampled = resamplePolygon(polygon, segmentDeg);

  // Triangulate in 2D lon-lat space (resampled for smoothness)
  const verts2D = resampled.map(([lon, lat]) => new THREE.Vector2(lon, lat));
  const triangles = THREE.ShapeUtils.triangulateShape(verts2D, []);

  const positions: number[] = [];
  triangles.forEach((tri) => {
    tri.forEach((idx) => {
      const [lon, lat] = resampled[idx];
      const position = latLonToVector3(lat, lon, radius);
      positions.push(position.x, position.y, position.z);
    });
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  return geometry;
}
