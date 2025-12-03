import { useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

// --- Fix lỗi hiển thị icon mặc định của Leaflet trong Vite ---
import iconMarker from 'leaflet/dist/images/marker-icon.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetina,
  iconUrl: iconMarker,
  shadowUrl: iconShadow,
});
// -------------------------------------------------------------

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
}

function App() {
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [path, setPath] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // State mới cho chức năng tìm kiếm
  const [searchQuery, setSearchQuery] = useState('');

  // State mới để lưu thuật toán được chọn (mặc định là Dijkstra)
  const [algorithm, setAlgorithm] = useState('dijkstra');
  
  const mapRef = useRef(null);

  const handleMapClick = (latlng) => {
    if (!startPoint) {
      setStartPoint(latlng);
    } else if (!endPoint) {
      setEndPoint(latlng);
    } else {
      console.log("Đã chọn đủ điểm start và end. Vui lòng Reset để chọn lại.");
    }
  };

  // Hàm xử lý tìm kiếm địa điểm qua API Nominatim
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      // Gọi API Nominatim của OpenStreetMap
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const newCenter = [parseFloat(lat), parseFloat(lon)];
        
        // Di chuyển bản đồ đến vị trí tìm được
        if (mapRef.current) {
          mapRef.current.setView(newCenter, 16);
          // Hoặc dùng flyTo cho mượt: mapRef.current.flyTo(newCenter, 16);
        }
      } else {
        alert('Không tìm thấy địa điểm này!');
      }
    } catch (error) {
      console.error("Lỗi tìm kiếm:", error);
      alert("Lỗi khi kết nối đến dịch vụ tìm kiếm.");
    } finally {
      setLoading(false);
    }
  };

  const handleFindRoute = async () => {
    if (!startPoint || !endPoint || !mapRef.current) return;

    setLoading(true);

    const bounds = mapRef.current.getBounds();
    const bbox = {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest()
    };

    try {
      const response = await fetch('http://localhost:3000/api/find-path', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start: startPoint,
          end: endPoint,
          bbox: bbox,
          algorithm: algorithm // Gửi thêm loại thuật toán lên backend
        }),
      });

      if (!response.ok) {
        throw new Error('Không thể tìm thấy đường đi');
      }

      const data = await response.json();
      
      if (data && data.path) {
        setPath(data.path);
      }
    } catch (error) {
      console.error("Lỗi:", error);
      alert("Có lỗi xảy ra khi tìm đường!");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStartPoint(null);
    setEndPoint(null);
    setPath([]);
  };

  return (
    <>
      <div className="controls">
        {/* Khu vực tìm kiếm */}
        <div style={{ display: 'flex', gap: '5px' }}>
          <input 
            type="text" 
            placeholder="Tìm địa điểm..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={{ padding: '0.6rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button onClick={handleSearch} disabled={loading} style={{ background: '#007bff', color: 'white' }}>
            🔍
          </button>
        </div>

        {/* Dropdown chọn thuật toán */}
        <select 
          className="algorithm-select"
          value={algorithm} 
          onChange={(e) => setAlgorithm(e.target.value)}
          disabled={loading}
        >
          <option value="dijkstra">Dijkstra</option>
          <option value="astar">A* (A-Star)</option>
          <option value="bfs">BFS (Breadth-First Search)</option>
          <option value="dfs">DFS (Depth-First Search)</option>
        </select>

        <button 
          className="btn-start" 
          onClick={handleFindRoute}
          disabled={!startPoint || !endPoint || loading}
        >
          {loading ? 'Đang tìm...' : 'Start'}
        </button>
        
        <button className="btn-reset" onClick={handleReset} disabled={loading}>
          Reset
        </button>

        <div className="status-text">
          {!startPoint && "👉 Chọn điểm Start"}
          {startPoint && !endPoint && "👉 Chọn điểm End"}
          {startPoint && endPoint && !path.length && `✅ Sẵn sàng chạy ${algorithm.toUpperCase()}`}
        </div>
      </div>

      <MapContainer 
        center={[21.000061, 105.845361]} 
        zoom={16} 
        className="map-container"
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <ClickHandler onMapClick={handleMapClick} />

        {startPoint && (
          <Marker position={startPoint}>
            <Popup>Start</Popup>
          </Marker>
        )}

        {endPoint && (
          <Marker position={endPoint}>
            <Popup>End</Popup>
          </Marker>
        )}

        {path.length > 0 && (
          <Polyline 
            positions={path} 
            color="blue" 
            weight={5} 
            opacity={0.7} 
          />
        )}
      </MapContainer>
    </>
  );
}

export default App;