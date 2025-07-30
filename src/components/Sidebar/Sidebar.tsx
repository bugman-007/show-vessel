import "./Sidebar.css";

interface Ship {
  id: string;
  lat: number;
  lon: number;
  heading: number;
  speed?: number;
  timestamp?: number;
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
  connectionStatus: "connecting" | "connected" | "error";
  lastUpdateTime: Date | null;
  isOnline: boolean;
}

export function Sidebar({
  ships,
  selectedShipId,
  setSelectedShipId,
  route,
  connectionStatus,
  lastUpdateTime,
  isOnline,
}: SidebarProps) {
  const getShipStatus = (ship: Ship) => {
    const speed = ship.speed || 0;
    if (speed === 0)
      return { status: "Anchored", color: "#95a5a6", icon: "⚓" };
    if (speed < 5) return { status: "Slow", color: "#f39c12", icon: "🐌" };
    if (speed < 15) return { status: "Cruising", color: "#3498db", icon: "🚢" };
    return { status: "Fast", color: "#e74c3c", icon: "⚡" };
  };

  const getTimeSinceUpdate = (timestamp?: number) => {
    if (!timestamp) return "Unknown";
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div className="sidebar-main">
      <div className="sidebar-header">
        🚢 Ship Tracking Dashboard
        <div
          style={{
            fontSize: "12px",
            marginTop: "5px",
            color:
              connectionStatus === "connected"
                ? "#2ecc71"
                : connectionStatus === "connecting"
                ? "#f39c12"
                : "#e74c3c",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "5px",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor:
                connectionStatus === "connected"
                  ? "#2ecc71"
                  : connectionStatus === "connecting"
                  ? "#f39c12"
                  : "#e74c3c",
              animation:
                connectionStatus === "connecting"
                  ? "pulse 1.5s infinite"
                  : "none",
            }}
          />
          {connectionStatus === "connected"
            ? `Live (${ships.length} ships)`
            : connectionStatus === "connecting"
            ? "Connecting..."
            : "Connection Error"}
        </div>
      </div>

      <div className="sidebar-body">
        {/* System Status Panel */}
        <div
          style={{
            background: "rgba(52, 73, 94, 0.8)",
            border: `1px solid ${isOnline ? "#2ecc71" : "#e74c3c"}`,
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "20px",
            fontSize: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "5px",
            }}
          >
            <span>Network:</span>
            <span style={{ color: isOnline ? "#2ecc71" : "#e74c3c" }}>
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
          {lastUpdateTime && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "5px",
              }}
            >
              <span>Last Update:</span>
              <span>{lastUpdateTime.toLocaleTimeString()}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Active Ships:</span>
            <span style={{ fontWeight: "bold", color: "#3498db" }}>
              {ships.length}
            </span>
          </div>
        </div>

        <h3>Fleet Overview</h3>

        {ships.length === 0 ? (
          <div
            style={{
              padding: "20px",
              textAlign: "center",
              color: "#95a5a6",
              fontStyle: "italic",
              background: "rgba(52, 73, 94, 0.5)",
              borderRadius: "8px",
              border: "1px dashed #7f8c8d",
            }}
          >
            {connectionStatus === "connecting"
              ? "🔄 Loading ships..."
              : connectionStatus === "error"
              ? "❌ No connection"
              : "🚢 No ships available"}
          </div>
        ) : (
          <div style={{ maxHeight: "350px", overflowY: "auto" }}>
            {ships.map((ship) => {
              const shipStatus = getShipStatus(ship);
              const isSelected = selectedShipId === ship.id;

              return (
                <div
                  key={ship.id}
                  style={{
                    cursor: "pointer",
                    background: isSelected
                      ? "rgba(52, 152, 219, 0.3)"
                      : "rgba(52, 73, 94, 0.3)",
                    border: isSelected
                      ? "2px solid #3498db"
                      : "1px solid rgba(127, 140, 141, 0.3)",
                    borderRadius: "8px",
                    padding: "10px",
                    marginBottom: "8px",
                    transition: "all 0.3s ease",
                    boxShadow: isSelected 
                      ? "0 4px 12px rgba(52, 152, 219, 0.3)"
                      : "none",
                  }}
                  onClick={() => setSelectedShipId(ship.id)}
                  onMouseOver={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLDivElement).style.background =
                        "rgba(255, 255, 255, 0.1)";
                      (e.currentTarget as HTMLDivElement).style.transform = "translateX(4px)";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLDivElement).style.background =
                        "rgba(52, 73, 94, 0.3)";
                      (e.currentTarget as HTMLDivElement).style.transform = "translateX(0)";
                    }
                  }}
                >
                  {/* Ship Header */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: isSelected ? "bold" : "600",
                        color: isSelected ? "#3498db" : "#ecf0f1",
                        fontSize: "15px",
                      }}
                    >
                      {ship.id}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        background: isSelected ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.2)",
                        padding: "2px 8px",
                        borderRadius: "12px",
                      }}
                    >
                      <span style={{ fontSize: "14px" }}>{shipStatus.icon}</span>
                      <span style={{ color: shipStatus.color, fontWeight: "600" }}>
                        {shipStatus.status}
                      </span>
                    </div>
                  </div>

                  {/* Ship Details */}
                  <div style={{ fontSize: "11px", color: "#bdc3c7" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "8px",
                        marginBottom: "4px",
                      }}
                    >
                      <span>⚡ {ship.speed || 0} kts</span>
                      <span>🧭 {ship.heading}°</span>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "8px",
                        fontSize: "10px",
                        color: "#95a5a6",
                      }}
                    >
                      <span>📍 {ship.lat.toFixed(2)}°, {ship.lon.toFixed(2)}°</span>
                      <span>🕒 {getTimeSinceUpdate(ship.timestamp)}</span>
                    </div>
                  </div>

                  {/* Selection Indicator */}
                  {isSelected && (
                    <div
                      style={{
                        marginTop: "8px",
                        padding: "4px 8px",
                        background: "rgba(52, 152, 219, 0.2)",
                        borderRadius: "4px",
                        fontSize: "10px",
                        color: "#3498db",
                        fontWeight: "600",
                        textAlign: "center",
                      }}
                    >
                      🎯 SELECTED - Click "Inspect Vessel" to view details
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Route Information */}
        {selectedShipId && (
          <>
            <h3 style={{ marginTop: "25px" }}>
              📍 Route Information
              {route.length > 0 && (
                <span
                  style={{
                    fontSize: "12px",
                    color: "#95a5a6",
                    fontWeight: "normal",
                    marginLeft: "8px",
                  }}
                >
                  ({route.length} waypoints)
                </span>
              )}
            </h3>

            <div
              style={{
                background: "rgba(52, 73, 94, 0.8)",
                border: "1px solid #34495e",
                borderRadius: "8px",
                padding: "12px",
                maxHeight: "200px",
                overflowY: "auto",
              }}
            >
              {route && route.length > 0 ? (
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#95a5a6",
                      marginBottom: "8px",
                      paddingBottom: "5px",
                      borderBottom: "1px solid #34495e",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>🗺️ Planned Route:</span>
                    <span style={{ color: "#3498db" }}>
                      {route.length} stops
                    </span>
                  </div>
                  {route.map((wp, idx) => (
                    <div
                      key={idx}
                      style={{
                        fontSize: "11px",
                        color: "#bdc3c7",
                        marginBottom: "6px",
                        padding: "6px 8px",
                        background: idx === 0 
                          ? "rgba(46, 204, 113, 0.1)" // Green for first waypoint
                          : idx === route.length - 1
                          ? "rgba(231, 76, 60, 0.1)" // Red for last waypoint
                          : "rgba(0, 0, 0, 0.2)",
                        border: idx === 0 
                          ? "1px solid rgba(46, 204, 113, 0.3)"
                          : idx === route.length - 1
                          ? "1px solid rgba(231, 76, 60, 0.3)"
                          : "1px solid rgba(127, 140, 141, 0.2)",
                        borderRadius: "4px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "4px" 
                      }}>
                        {idx === 0 ? "🟢" : idx === route.length - 1 ? "🔴" : "🔵"} 
                        Waypoint {idx + 1}
                      </span>
                      <span style={{ 
                        color: "#95a5a6", 
                        fontFamily: "monospace",
                        fontSize: "10px",
                      }}>
                        {wp.latitude.toFixed(3)}°, {wp.longitude.toFixed(3)}°
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    color: "#95a5a6",
                    fontStyle: "italic",
                    fontSize: "12px",
                    padding: "20px",
                  }}
                >
                  📭 No route data available
                  <div style={{ fontSize: "10px", marginTop: "4px", opacity: 0.7 }}>
                    Route information will appear when available
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}