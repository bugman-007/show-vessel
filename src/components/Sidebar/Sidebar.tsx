import "./Sidebar.css";

interface Ship {
  id: string;
  lat: number;
  lon: number;
  heading: number;
  speed?: number;
}

interface Waypoint {
  latitude: number;
  longitude: number;
}

interface SidebarProps {
  ships: Ship[];
  selectedShipId: string | null;
  setSelectedShipId: (id: string) => void;
  route: Waypoint[];
}

export function Sidebar({ ships, selectedShipId, setSelectedShipId, route }: SidebarProps) {
  return (
    <div className="sidebar-main">
      <div className="sidebar-header">🚢 Ship Tracking Dashboard</div>
      <div className="sidebar-body">
        <h3>Active Ships</h3>
        <ul>
          {ships.map((ship) => (
            <li
              key={ship.id}
              style={{
                cursor: "pointer",
                fontWeight: selectedShipId === ship.id ? "bold" : "normal",
                color: selectedShipId === ship.id ? "#3498db" : "#ecf0f1",
                marginBottom: 6,
              }}
              onClick={() => setSelectedShipId(ship.id)}
            >
              {ship.id}
            </li>
          ))}
        </ul>
        {selectedShipId && (
          <>
            <h3>Route</h3>
            <ul>
              {route && route.length > 0 ? (
                route.map((wp, idx) => (
                  <li key={idx}>
                    Lat: {wp.latitude}, Lon: {wp.longitude}
                  </li>
                ))
              ) : (
                <li>No route data</li>
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
