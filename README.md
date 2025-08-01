# 🚢 3D Vessel Tracking Dashboard

A sophisticated real-time ship tracking application built with React, TypeScript, and Three.js, featuring an interactive 3D globe and immersive vessel inspection capabilities.

![Ship Tracking Dashboard](https://img.shields.io/badge/Status-Production%20Ready-green)
![React](https://img.shields.io/badge/React-19.1.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue)
![Three.js](https://img.shields.io/badge/Three.js-0.178.0-orange)

## ✨ Features

### 🌍 Interactive 3D Globe
- **Real Earth Visualization**: Accurate country borders and geographical labels
- **Dynamic Ship Tracking**: Live vessel positions with real-time updates
- **Smooth Navigation**: Orbital camera controls with intelligent constraints
- **Star Field Background**: Immersive space environment

### 🚢 Advanced Ship Management
- **Live Ship Data**: Real-time vessel tracking with API integration
- **Route Visualization**: Curved ship routes with waypoint display
- **Ship Selection**: Interactive markers with hover effects and selection states
- **Detailed Information**: Speed, heading, coordinates, and status tracking

### 🔍 Sky-to-Sea Inspection Mode
- **Dual-Scene Architecture**: Separate dedicated ocean environment for vessel inspection
- **Realistic Ocean**: Animated waves with multiple frequencies and fog effects
- **Ship Animation**: Realistic sailing motion with bobbing, pitching, and rolling
- **Professional Camera**: Smooth transitions and restricted controls for optimal viewing
- **3D Ship Models**: Support for GLB/GLTF models with intelligent fallback system

### 📱 Responsive Design
- **Mobile Optimized**: Responsive sidebar with intelligent height management
- **Professional UI**: Clean interface with status indicators and connection monitoring
- **Real-time Updates**: Live data refresh with connection status display

## 🚀 Tech Stack

### Frontend Framework
- **React 19** with TypeScript for type-safe development
- **Vite** for fast development and optimized builds
- **Tailwind CSS** for responsive styling

### 3D Graphics & Animation
- **Three.js** for 3D rendering and WebGL graphics
- **React Three Fiber** for declarative 3D scene management
- **React Three Drei** for enhanced 3D components and utilities
- **React Spring** for smooth 3D animations and transitions

### Development Tools
- **ESLint** with TypeScript configuration
- **React Hooks** and **React Refresh** for fast development
- **PostCSS** and **Autoprefixer** for CSS processing

## 📦 Installation

```bash
# Clone the repository
git clone <repository-url>
cd ship-tracker

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🛠️ Development

### Project Structure
```
src/
├── components/
│   ├── CountryBorders.tsx    # Globe country rendering
│   ├── CountryLabels.tsx     # Geographic labels
│   ├── ShipMarkers.tsx       # 3D ship markers
│   ├── ShipRoutes.tsx        # Route visualization
│   ├── ShipInspectionScene.tsx # Immersive ship inspection
│   └── Sidebar/              # UI sidebar components
├── utils/
│   ├── geo.ts               # Geospatial calculations
│   └── fixCountryMesh.ts    # Geographic mesh processing
├── data/                    # Static data and mock data
└── App.tsx                  # Main application component
```

### Key Technologies

#### Geospatial Mathematics
- **Coordinate Transformation**: Latitude/longitude to 3D vector conversion
- **Spherical Projection**: Country borders mapped to globe surface
- **Route Calculation**: Curved path generation using Catmull-Rom splines

#### 3D Rendering Pipeline
- **Performance Optimization**: Visibility culling and efficient geometry caching
- **Advanced Materials**: PBR materials with metalness and roughness
- **Shadow Mapping**: Real-time shadow casting and receiving
- **Post-processing**: Tone mapping and color space management

#### Animation System
- **Ocean Simulation**: Multi-frequency wave animation
- **Ship Motion**: Realistic maritime movement (bobbing, pitching, rolling)
- **Camera Transitions**: Smooth interpolated movements between scenes
- **Interactive Controls**: Orbital camera with intelligent constraints

## 🌐 API Integration

### Ship Data Endpoint
```typescript
// Expected API response format
interface Ship {
  id: string;
  lat: number;
  lon: number;
  heading: number;
  speed?: number;
  timestamp?: number;
}

// Routes endpoint
interface Waypoint {
  latitude: number;
  longitude: number;
}
```

### Configuration
The application expects ship data from:
- **Ships API**: `/api/ships` - Returns array of ship objects
- **Routes API**: `/api/ships/routes/{shipId}` - Returns route waypoints
- **Auto-refresh**: 5-second intervals for live tracking

## 🎨 3D Assets

### Ship Models
- **GLB Support**: Place ship models in `/public/assets/ship.glb`
- **Auto-scaling**: Models automatically scaled for optimal viewing
- **Material Enhancement**: PBR materials with improved lighting
- **Fallback System**: Graceful degradation if models unavailable

### Geographic Data
- **Country Borders**: `/public/data/countries.geo.json`
- **Labels**: `/public/data/label.json`
- **Custom Processing**: Edge resampling and triangulation for smooth borders

## 🔧 Configuration

### Camera Controls
```typescript
// Globe view constraints
minDistance: 2.1,
maxDistance: 5.5,
minAzimuthAngle: Math.PI * 0.65,
maxAzimuthAngle: Math.PI * 1,
minPolarAngle: (2 * Math.PI) / 7,
maxPolarAngle: Math.PI / 2

// Inspection mode constraints
minDistance: 3,
maxDistance: 12,
minPolarAngle: Math.PI / 4,
maxPolarAngle: Math.PI / 2.2
```

### Performance Settings
- **Ocean Detail**: 256x256 vertices for wave animation
- **Shadow Quality**: 2048x2048 shadow maps
- **Render Distance**: Fog at 20-80 units for infinite ocean effect

## 🚀 Features in Detail

### Real-time Tracking
- **Live Updates**: Ship positions updated every 5 seconds
- **Connection Monitoring**: Visual indicators for API connectivity
- **Error Handling**: Graceful fallback for network issues
- **Offline Support**: Cached data display when connection unavailable

### Vessel Inspection
- **Immersive Experience**: Dedicated ocean scene for detailed ship viewing
- **Realistic Environment**: Animated ocean, dynamic lighting, atmospheric effects
- **Professional Controls**: Restricted camera movement for optimal inspection angles
- **Maritime Animation**: Realistic ship motion with sailing physics

### User Experience
- **Intuitive Interface**: Click-to-select ship markers with visual feedback
- **Detailed Information**: Comprehensive vessel data in organized panels
- **Smooth Transitions**: Professional animations between view modes
- **Keyboard Shortcuts**: ESC to exit inspection mode, intuitive navigation

## 📈 Performance

### Optimization Features
- **Visibility Culling**: Objects rendered only when in view
- **Efficient Geometry**: Optimized meshes with proper LOD
- **Memory Management**: Automatic resource disposal and cleanup
- **Frame Rate Monitoring**: Performance tracking in development mode

### Browser Compatibility
- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **WebGL 2.0**: Advanced graphics features with fallback support
- **Mobile Responsive**: Touch controls and responsive layouts

## 🤝 Contributing

### Development Setup
1. Ensure Node.js 18+ is installed
2. Clone repository and install dependencies
3. Start development server with `npm run dev`
4. Access application at `http://localhost:5173`

### Code Standards
- **TypeScript**: Strict type checking enabled
- **ESLint**: Configured for React and TypeScript best practices
- **Component Architecture**: Modular, reusable component design
- **Performance**: Efficient rendering and memory management

## 📄 License

This project is developed for maritime tracking applications with focus on performance, usability, and professional presentation.

---

**Built with ❤️ for professional maritime operations**

*Real-time ship tracking • 3D visualization • Immersive inspection*