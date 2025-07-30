// Enhanced Sidebar.tsx with movement status and connection info
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
  connectionStatus: 'connecting' | 'connected' | 'error';
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
  isOnline
}: SidebarProps) {
  
  // Calculate ship movement status based on speed
  const getShipStatus = (ship: Ship) => {
    const speed = ship.speed || 0;
    if (speed === 0) return { status: 'Anchored', color: '#95a5a6', icon: '⚓' };
    if (speed < 5) return { status: 'Slow', color: '#f39c12', icon: '🐌' };
    if (speed < 15) return { status: 'Cruising', color: '#3498db', icon: '🚢' };
    return { status: 'Fast', color: '#e74c3c', icon: '⚡' };
  };

  // Format timestamp for display
  // const formatTime = (timestamp?: number) => {
  //   if (!timestamp) return 'Unknown';
  //   return new Date(timestamp).toLocaleTimeString();
  // };

  // Calculate time since last update
  const getTimeSinceUpdate = (timestamp?: number) => {
    if (!timestamp) return 'Unknown';
    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div className="sidebar-main">
      <div className="sidebar-header">
        🚢 Ship Tracking Dashboard
        <div style={{ 
          fontSize: '12px', 
          marginTop: '5px',
          color: connectionStatus === 'connected' ? '#2ecc71' : '#e74c3c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: connectionStatus === 'connected' ? '#2ecc71' : '#e74c3c',
            animation: connectionStatus === 'connecting' ? 'pulse 1.5s infinite' : 'none',
          }} />
          {connectionStatus === 'connected' ? `Live (${ships.length} ships)` : 
           connectionStatus === 'connecting' ? 'Connecting...' : 'Connection Error'}
        </div>
      </div>
      
      <div className="sidebar-body">
        {/* Connection Status Panel */}
        <div style={{
          background: 'rgba(52, 73, 94, 0.8)',
          border: `1px solid ${isOnline ? '#2ecc71' : '#e74c3c'}`,
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '20px',
          fontSize: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span>Status:</span>
            <span style={{ color: isOnline ? '#2ecc71' : '#e74c3c' }}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          {lastUpdateTime && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>Last Update:</span>
              <span>{lastUpdateTime.toLocaleTimeString()}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Active Ships:</span>
            <span>{ships.length}</span>
          </div>
        </div>

        <h3>Active Ships</h3>
        
        {ships.length === 0 ? (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: '#95a5a6',
            fontStyle: 'italic'
          }}>
            {connectionStatus === 'connecting' ? 'Loading ships...' : 'No ships available'}
          </div>
        ) : (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {ships.map((ship) => {
              const shipStatus = getShipStatus(ship);
              const isSelected = selectedShipId === ship.id;
              
              return (
                <div
                  key={ship.id}
                  style={{
                    cursor: "pointer",
                    background: isSelected ? 'rgba(52, 152, 219, 0.2)' : 'transparent',
                    border: isSelected ? '1px solid #3498db' : '1px solid transparent',
                    borderRadius: '6px',
                    padding: '8px',
                    marginBottom: '8px',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => setSelectedShipId(ship.id)}
                  onMouseOver={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(255, 255, 255, 0.05)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                    }
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <span style={{
                      fontWeight: isSelected ? 'bold' : 'normal',
                      color: isSelected ? '#3498db' : '#ecf0f1',
                      fontSize: '14px'
                    }}>
                      {ship.id}
                    </span>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px'
                    }}>
                      <span>{shipStatus.icon}</span>
                      <span style={{ color: shipStatus.color }}>
                        {shipStatus.status}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ fontSize: '11px', color: '#bdc3c7' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Speed: {ship.speed || 0} kts</span>
                      <span>Heading: {ship.heading}°</span>
                    </div>
                    <div style={{ 
                      marginTop: '2px',
                      color: '#95a5a6',
                      fontSize: '10px'
                    }}>
                      Updated: {getTimeSinceUpdate(ship.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {selectedShipId && (
          <>
            <h3 style={{ marginTop: '25px' }}>
              Route Information
              {route.length > 0 && (
                <span style={{ 
                  fontSize: '12px', 
                  color: '#95a5a6',
                  fontWeight: 'normal',
                  marginLeft: '8px'
                }}>
                  ({route.length} waypoints)
                </span>
              )}
            </h3>
            
            <div style={{
              background: 'rgba(52, 73, 94, 0.8)',
              border: '1px solid #34495e',
              borderRadius: '8px',
              padding: '12px',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {route && route.length > 0 ? (
                <div>
                  <div style={{
                    fontSize: '11px',
                    color: '#95a5a6',
                    marginBottom: '8px',
                    paddingBottom: '5px',
                    borderBottom: '1px solid #34495e'
                  }}>
                    Planned Route:
                  </div>
                  {route.map((wp, idx) => (
                    <div 
                      key={idx}
                      style={{
                        fontSize: '11px',
                        color: '#bdc3c7',
                        marginBottom: '4px',
                        padding: '4px 6px',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '4px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>Waypoint {idx + 1}</span>
                      <span style={{ color: '#95a5a6' }}>
                        {wp.latitude.toFixed(3)}°, {wp.longitude.toFixed(3)}°
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  color: '#95a5a6',
                  fontStyle: 'italic',
                  fontSize: '12px'
                }}>
                  No route data available
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}