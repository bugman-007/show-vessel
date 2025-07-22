import * as THREE from "three";
import { useMemo, useState } from "react";
import { useSpring, animated } from "@react-spring/three";
import { Html } from "@react-three/drei";
import { latLonToVector3 } from "../utils/geo";
import { useMockShips } from "../data/ships";
import { ShipRoutes } from "./ShipRoutes";
import { mockRoute } from "../data/mockRoutes";

export function ShipMarkers() {
  const ships = useMockShips();
  const radius = 2.05;

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedShip, setSelectedShip] = useState<null | {
    id: string;
    position: THREE.Vector3;
  }>(null);

  const shipMeshes = useMemo(
    () =>
      ships.map((ship) => {
        const pos = latLonToVector3(ship.lat, ship.lon, radius);
        const up = new THREE.Vector3(0, -1, 0);
        const dir = pos.clone().normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, dir);
        return {
          id: ship.id,
          position: pos,
          quaternion,
          heading: ship.heading,
        };
      }),
    [ships]
  );

  return (
    <>
      {shipMeshes.map((ship) => {
        const { scale } = useSpring({
          scale: hoveredId === ship.id ? 1.5 : 1,
          config: { tension: 300, friction: 15 },
        });

        return (
          <animated.mesh
            key={ship.id}
            position={[ship.position.x, ship.position.y, ship.position.z]}
            quaternion={ship.quaternion}
            scale={scale}
            onPointerOver={() => setHoveredId(ship.id)}
            onPointerOut={() => setHoveredId(null)}
            onClick={() =>
              setSelectedShip({ id: ship.id, position: ship.position })
            }
          >
            <coneGeometry args={[0.02, 0.07, 8]} />
            <meshPhongMaterial color="#ff0000" />
          </animated.mesh>
        );
      })}
      {selectedShip && (
        <Html
          position={[
            selectedShip.position.x - 0.6,
            selectedShip.position.y + 0.6,
            selectedShip.position.z,
          ]}
          center
        >
          <div
            style={{
              opacity: "0.7",
              background: "white",
              padding: "8px",
              borderRadius: "4px",
              boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
              width: "300px",
            }}
          >
            <img
              src="/assets/ship.jfif"
              alt="Ship"
              style={{ width: "100%", borderRadius: "4px" }}
            />
            <h3 style={{ margin: "8px 0" }}>{selectedShip.id}</h3>
            <hr />
            <br />
            <p>Speed: 20 knots</p>
            <p>Heading: 135°</p>
            <p>Route: Dubai → Mumbai → Singapore</p>
            <br />
            <p>We can add more informations here</p>
            <button
              onClick={() => setSelectedShip(null)}
              style={{
                marginTop: "8px",
                background: "#ff5555",
                color: "white",
                padding: "4px 8px",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </Html>
      )}
      {selectedShip && <ShipRoutes waypoints={mockRoute} />}
    </>
  );
}
