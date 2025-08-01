import * as THREE from "three";
import earcut from "earcut";

/**
 * Convert lat/lon to 3D position on sphere
 */
function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/**
 * Spherical linear interpolation between two points on a sphere
 */
// function slerpOnSphere(
//   p1: THREE.Vector3,
//   p2: THREE.Vector3,
//   t: number,
//   radius: number
// ): THREE.Vector3 {
//   // Normalize to unit sphere
//   const v1 = p1.clone().normalize();
//   const v2 = p2.clone().normalize();
  
//   // Calculate angle between vectors
//   const dot = v1.dot(v2);
//   const theta = Math.acos(Math.max(-1, Math.min(1, dot)));
  
//   if (theta < 0.001) {
//     // Points are very close, use linear interpolation
//     return p1.clone().lerp(p2, t).normalize().multiplyScalar(radius);
//   }
  
//   // Spherical interpolation
//   const sinTheta = Math.sin(theta);
//   const a = Math.sin((1 - t) * theta) / sinTheta;
//   const b = Math.sin(t * theta) / sinTheta;
  
//   return v1.clone().multiplyScalar(a)
//     .add(v2.clone().multiplyScalar(b))
//     .normalize()
//     .multiplyScalar(radius);
// }

/**
 * Create a tessellated triangle on a sphere
 */
function tessellateSphericalTriangle(
  v1: THREE.Vector3,
  v2: THREE.Vector3,
  v3: THREE.Vector3,
  radius: number,
  subdivisions: number
): number[] {
  const positions: number[] = [];
  
  // Create tessellation grid
  // const n = subdivisions + 1;
  const vertices: THREE.Vector3[][] = [];
  
  // Generate vertices using barycentric coordinates
  for (let i = 0; i <= subdivisions; i++) {
    vertices[i] = [];
    const u = i / subdivisions;
    
    for (let j = 0; j <= subdivisions - i; j++) {
      const v = j / subdivisions;
      const w = 1 - u - v;
      
      // First interpolate in 2D barycentric space
      const p = new THREE.Vector3()
        .addScaledVector(v1, w)
        .addScaledVector(v2, u)
        .addScaledVector(v3, v);
      
      // Then project onto sphere for perfect curvature
      p.normalize().multiplyScalar(radius);
      
      vertices[i][j] = p;
    }
  }
  
  // Generate triangles from the grid
  for (let i = 0; i < subdivisions; i++) {
    for (let j = 0; j < subdivisions - i; j++) {
      // Lower triangle
      const a = vertices[i][j];
      const b = vertices[i + 1][j];
      const c = vertices[i][j + 1];
      
      positions.push(a.x, a.y, a.z);
      positions.push(b.x, b.y, b.z);
      positions.push(c.x, c.y, c.z);
      
      // Upper triangle (if not on edge)
      if (j < subdivisions - i - 1) {
        const d = vertices[i + 1][j];
        const e = vertices[i + 1][j + 1];
        const f = vertices[i][j + 1];
        
        positions.push(d.x, d.y, d.z);
        positions.push(e.x, e.y, e.z);
        positions.push(f.x, f.y, f.z);
      }
    }
  }
  
  return positions;
}

/**
 * Calculate optimal subdivision level based on triangle size
 */
function calculateSubdivisionLevel(
  v1: THREE.Vector3,
  v2: THREE.Vector3,
  v3: THREE.Vector3
): number {
  // Calculate the maximum edge length
  const edge1 = v1.distanceTo(v2);
  const edge2 = v2.distanceTo(v3);
  const edge3 = v3.distanceTo(v1);
  const maxEdge = Math.max(edge1, edge2, edge3);
  
  // More subdivisions for larger triangles
  if (maxEdge > 0.5) return 8;  // Very large triangles (like in Russia)
  if (maxEdge > 0.3) return 6;
  if (maxEdge > 0.2) return 4;
  if (maxEdge > 0.1) return 3;
  if (maxEdge > 0.05) return 2;
  return 1;
}

/**
 * Generate BufferGeometry for a polygon on a sphere with perfect curvature
 */
export function fixCountryMesh(
  polygon: [number, number][],
  radius = 2.002,
  minSubdivisions = 2
): THREE.BufferGeometry {
  // Ensure polygon is closed
  if (polygon.length > 0 && 
      (polygon[0][0] !== polygon[polygon.length - 1][0] || 
       polygon[0][1] !== polygon[polygon.length - 1][1])) {
    polygon = [...polygon, polygon[0]];
  }
  
  // Prepare data for earcut
  const vertices: number[] = [];
  // const indices: number[] = [];
  
  // Flatten coordinates for earcut
  polygon.forEach(([lon, lat]) => {
    vertices.push(lon, lat);
  });
  
  // Triangulate using earcut
  const triangleIndices = earcut(vertices);
  
  // Convert triangulated 2D mesh to 3D spherical mesh
  const positions: number[] = [];
  
  for (let i = 0; i < triangleIndices.length; i += 3) {
    // Get triangle vertices
    const idx1 = triangleIndices[i];
    const idx2 = triangleIndices[i + 1];
    const idx3 = triangleIndices[i + 2];
    
    const lon1 = vertices[idx1 * 2];
    const lat1 = vertices[idx1 * 2 + 1];
    const lon2 = vertices[idx2 * 2];
    const lat2 = vertices[idx2 * 2 + 1];
    const lon3 = vertices[idx3 * 2];
    const lat3 = vertices[idx3 * 2 + 1];
    
    // Convert to 3D positions
    const v1 = latLonToVector3(lat1, lon1, radius);
    const v2 = latLonToVector3(lat2, lon2, radius);
    const v3 = latLonToVector3(lat3, lon3, radius);
    
    // Calculate appropriate subdivision level
    const subdivisions = Math.max(
      minSubdivisions,
      calculateSubdivisionLevel(v1, v2, v3)
    );
    
    // Tessellate the triangle on the sphere
    const tessellatedPositions = tessellateSphericalTriangle(
      v1, v2, v3, radius, subdivisions
    );
    
    positions.push(...tessellatedPositions);
  }
  
  // Create geometry
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  
  // Compute normals for proper shading
  geometry.computeVertexNormals();
  
  // Optimize
  geometry.computeBoundingSphere();
  
  return geometry;
}