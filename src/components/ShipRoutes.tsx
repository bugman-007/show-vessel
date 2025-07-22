import { useMemo } from "react";
import * as THREE from "three";
import { latLonToVector3 } from "../utils/geo";

interface Waypoint {
  latitude: number;
  longitude: number;
}

interface ShipRoutesProps {
  waypoints: Waypoint[];
}

export function ShipRoutes({ waypoints }: ShipRoutesProps) {
  const radius = 2.05;

  //   useEffect(() => {
  //     fetch(`/api/routes/${shipId}`)
  //       .then((res) => res.json())
  //       .then((data) => {
  //         const vectors = data.waypoints.map((wp: any) => {
  //           const pos = latLonToVector3(wp.latitude, wp.longitude, radius);
  //           return pos;
  //         });
  //         setPoints(vectors);
  //       });
  //   }, [shipId]);

  const routeGeometry = useMemo(() => {
    if (waypoints.length < 2) return null;
    const points = waypoints.map((wp) =>
      latLonToVector3(wp.latitude, wp.longitude, radius)
    );
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.BufferGeometry().setFromPoints(curve.getPoints(200));
  }, [waypoints, radius]);

  if (!routeGeometry) return null;

  return (
    <line geometry={routeGeometry}>
      <lineBasicMaterial color="#ff0000" linewidth={3} />
    </line>
  );
}
