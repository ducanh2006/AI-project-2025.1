from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Tuple, Optional
import math
import heapq
import requests
import time

app = FastAPI(title="OSM Shortest Path API")

# Cho phép CORS để frontend React gọi được
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Trong production, thay bằng URL frontend cụ thể
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================================
# Mô hình dữ liệu request
# ================================
class Point(BaseModel):
    lat: float
    lng: float

class BBox(BaseModel):
    north: float
    south: float
    east: float
    west: float

class PathRequest(BaseModel):
    start: Point
    end: Point
    bbox: BBox
    algorithm: str = "dijkstra"

# ================================
# 0. Hàm tính khoảng cách Haversine (chính xác)
# ================================
def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Tính khoảng cách thực tế giữa 2 điểm trên Trái Đất bằng công thức Haversine.
    Trả về khoảng cách tính bằng mét.
    """
    R = 6371000  # Bán kính Trái Đất (mét)
    
    # Chuyển đổi độ sang radian
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    # Công thức Haversine
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

# ================================
# 1. Gọi Overpass API để lấy dữ liệu OSM
# ================================
def fetch_osm_data(bbox: BBox) -> dict:
    overpass_url = "http://overpass-api.de/api/interpreter"
    overpass_query = f"""
    [out:json][timeout:25];
    (
      way["highway"]({bbox.south},{bbox.west},{bbox.north},{bbox.east});
      node(w);
    );
    out body;
    """
    response = requests.post(overpass_url, data=overpass_query, timeout=30)
    response.raise_for_status()
    return response.json()

# ================================
# 2. Xây đồ thị từ dữ liệu OSM (Cải thiện)
# ================================
def build_graph(osm_data: dict):
    """
    Xây dựng đồ thị từ dữ liệu OSM với các cải thiện:
    - Sử dụng Haversine để tính khoảng cách chính xác
    - Tránh duplicate edges bằng cách sử dụng set
    - Xử lý tốt hơn các node thiếu
    """
    nodes = {}
    graph = {}
    # Sử dụng set để tránh duplicate edges
    edges_set = set()

    # Bước 1: Thu thập tất cả node từ elements
    for element in osm_data["elements"]:
        if element["type"] == "node":
            node_id = element["id"]
            nodes[node_id] = (element["lat"], element["lon"])
            graph[node_id] = []

    # Bước 2: Thu thập node IDs từ ways để đảm bảo không bỏ sót
    # (Overpass API thường trả về đầy đủ, nhưng để an toàn)
    way_node_ids = set()
    for element in osm_data["elements"]:
        if element["type"] == "way" and "nodes" in element:
            way_node_ids.update(element["nodes"])

    # Bước 3: Xây cạnh từ way
    for element in osm_data["elements"]:
        if element["type"] == "way" and "nodes" in element:
            way_nodes = element["nodes"]
            
            # Kiểm tra way có ít nhất 2 nodes
            if len(way_nodes) < 2:
                continue
            
            # Tạo các cạnh từ các node liên tiếp trong way
            for i in range(len(way_nodes) - 1):
                u = way_nodes[i]
                v = way_nodes[i + 1]
                
                # Chỉ thêm cạnh nếu cả 2 node đều có trong nodes dictionary
                if u in nodes and v in nodes:
                    # Sử dụng tuple có thứ tự để tránh duplicate (đồ thị vô hướng)
                    edge_key = (min(u, v), max(u, v))
                    
                    # Chỉ thêm cạnh nếu chưa tồn tại
                    if edge_key not in edges_set:
                        edges_set.add(edge_key)
                        
                        # Tính khoảng cách bằng Haversine (chính xác)
                        lat1, lon1 = nodes[u]
                        lat2, lon2 = nodes[v]
                        dist = haversine_distance(lat1, lon1, lat2, lon2)
                        
                        # Đồ thị vô hướng: thêm cạnh cho cả 2 chiều
                        graph[u].append((v, dist))
                        graph[v].append((u, dist))

    return graph, nodes

# ================================
# 3. Các thuật toán tìm đường (có thống kê)
# ================================
def dijkstra(graph, nodes, start_node, end_node, return_stats=False):
    """
    Thuật toán Dijkstra với khả năng trả về thống kê.
    Returns: (path, stats) nếu return_stats=True, else chỉ path
    """
    dist = {node: float('inf') for node in graph}
    prev = {node: None for node in graph}
    dist[start_node] = 0
    pq = [(0, start_node)]
    nodes_explored = 0

    while pq:
        d, u = heapq.heappop(pq)
        if u == end_node:
            break
        if d > dist[u]:
            continue
        nodes_explored += 1
        for v, w in graph[u]:
            alt = dist[u] + w
            if alt < dist[v]:
                dist[v] = alt
                prev[v] = u
                heapq.heappush(pq, (alt, v))

    path = reconstruct_path(prev, start_node, end_node)
    if return_stats:
        return path, {"nodes_explored": nodes_explored}
    return path

def astar(graph, nodes, start_node, end_node, return_stats=False):
    """
    Thuật toán A* với khả năng trả về thống kê.
    Returns: (path, stats) nếu return_stats=True, else chỉ path
    """
    def heuristic(a, b):
        """Heuristic cho A* sử dụng Haversine để ước lượng khoảng cách"""
        lat1, lon1 = nodes[a]
        lat2, lon2 = nodes[b]
        return haversine_distance(lat1, lon1, lat2, lon2)

    open_set = [(0, start_node)]
    g_score = {node: float('inf') for node in graph}
    g_score[start_node] = 0
    f_score = {node: float('inf') for node in graph}
    f_score[start_node] = heuristic(start_node, end_node)
    came_from = {}
    nodes_explored = 0

    while open_set:
        _, current = heapq.heappop(open_set)
        if current == end_node:
            path = reconstruct_path(came_from, start_node, end_node)
            if return_stats:
                return path, {"nodes_explored": nodes_explored}
            return path
        nodes_explored += 1
        for neighbor, weight in graph[current]:
            tentative_g = g_score[current] + weight
            if tentative_g < g_score[neighbor]:
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                f_score[neighbor] = tentative_g + heuristic(neighbor, end_node)
                heapq.heappush(open_set, (f_score[neighbor], neighbor))
    
    if return_stats:
        return [], {"nodes_explored": nodes_explored}
    return []

def bfs(graph, nodes, start_node, end_node, return_stats=False):
    """
    Thuật toán BFS với khả năng trả về thống kê.
    Returns: (path, stats) nếu return_stats=True, else chỉ path
    """
    from collections import deque
    queue = deque([start_node])
    visited = {start_node}
    parent = {start_node: None}
    nodes_explored = 0
    
    while queue:
        u = queue.popleft()
        nodes_explored += 1
        if u == end_node:
            path = reconstruct_path(parent, start_node, end_node)
            if return_stats:
                return path, {"nodes_explored": nodes_explored}
            return path
        for v, _ in graph[u]:
            if v not in visited:
                visited.add(v)
                parent[v] = u
                queue.append(v)
    
    if return_stats:
        return [], {"nodes_explored": nodes_explored}
    return []

def dfs(graph, nodes, start_node, end_node, return_stats=False):
    """
    Thuật toán DFS với khả năng trả về thống kê.
    Returns: (path, stats) nếu return_stats=True, else chỉ path
    """
    stack = [start_node]
    visited = set()
    parent = {start_node: None}
    nodes_explored = 0
    
    while stack:
        u = stack.pop()
        if u == end_node:
            path = reconstruct_path(parent, start_node, end_node)
            if return_stats:
                return path, {"nodes_explored": nodes_explored}
            return path
        if u in visited:
            continue
        visited.add(u)
        nodes_explored += 1
        for v, _ in graph[u]:
            if v not in visited:
                parent[v] = u
                stack.append(v)
    
    if return_stats:
        return [], {"nodes_explored": nodes_explored}
    return []

def reconstruct_path(prev, start, end):
    path = []
    current = end
    while current is not None:
        path.append(current)
        current = prev.get(current)
    path.reverse()
    if path[0] == start:
        return path
    return []

def calculate_path_distance(path: List[int], nodes: Dict[int, tuple]) -> float:
    """
    Tính tổng độ dài đường đi (mét) từ danh sách các node.
    """
    if len(path) < 2:
        return 0.0
    
    total_distance = 0.0
    for i in range(len(path) - 1):
        node1 = path[i]
        node2 = path[i + 1]
        lat1, lon1 = nodes[node1]
        lat2, lon2 = nodes[node2]
        total_distance += haversine_distance(lat1, lon1, lat2, lon2)
    
    return total_distance

# ================================
# 4. Tìm node gần nhất với tọa độ (Cải thiện)
# ================================
def find_nearest_node(nodes: Dict[int, tuple], lat: float, lng: float) -> int:
    """
    Tìm node gần nhất với tọa độ cho trước.
    Sử dụng Haversine để tính khoảng cách chính xác.
    """
    best_id = None
    best_dist = float('inf')
    for node_id, (nlat, nlng) in nodes.items():
        dist = haversine_distance(lat, lng, nlat, nlng)
        if dist < best_dist:
            best_dist = dist
            best_id = node_id
    return best_id

# ================================
# 5. Endpoint chính
# ================================
@app.post("/api/find-path")
async def find_path(request: PathRequest):
    try:
        # 1. Lấy dữ liệu OSM trong bbox
        osm_data = fetch_osm_data(request.bbox)

        # 2. Xây đồ thị
        graph, nodes = build_graph(osm_data)
        if not nodes:
            raise HTTPException(status_code=400, detail="Không có dữ liệu đường trong vùng này")

        # 3. Tìm node gần điểm start/end
        start_node = find_nearest_node(nodes, request.start.lat, request.start.lng)
        end_node = find_nearest_node(nodes, request.end.lat, request.end.lng)

        if start_node is None or end_node is None:
            raise HTTPException(status_code=400, detail="Không tìm được điểm trên đường đi")

        # 4. Chọn thuật toán
        algo_map = {
            "dijkstra": dijkstra,
            "astar": astar,
            "bfs": bfs,
            "dfs": dfs
        }

        algo_func = algo_map.get(request.algorithm, dijkstra)
        node_path = algo_func(graph, nodes, start_node, end_node)

        if not node_path:
            raise HTTPException(status_code=404, detail="Không tìm được đường đi")

        # 5. Chuyển node → tọa độ [lat, lng]
        path_coords = [[nodes[node_id][0], nodes[node_id][1]] for node_id in node_path]

        return {"path": path_coords}

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Lỗi Overpass API: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi máy chủ: {str(e)}")

# ================================
# 6. Endpoint so sánh các thuật toán
# ================================
@app.post("/api/compare-algorithms")
async def compare_algorithms(request: PathRequest):
    """
    So sánh tất cả các thuật toán tìm đường:
    - Thời gian thực thi
    - Số node đã duyệt
    - Độ dài đường đi
    - Đường đi (path)
    """
    try:
        # 1. Lấy dữ liệu OSM trong bbox
        osm_data = fetch_osm_data(request.bbox)

        # 2. Xây đồ thị
        graph, nodes = build_graph(osm_data)
        if not nodes:
            raise HTTPException(status_code=400, detail="Không có dữ liệu đường trong vùng này")

        # 3. Tìm node gần điểm start/end
        start_node = find_nearest_node(nodes, request.start.lat, request.start.lng)
        end_node = find_nearest_node(nodes, request.end.lat, request.end.lng)

        if start_node is None or end_node is None:
            raise HTTPException(status_code=400, detail="Không tìm được điểm trên đường đi")

        # 4. Định nghĩa các thuật toán cần so sánh
        algorithms = {
            "dijkstra": dijkstra,
            "astar": astar,
            "bfs": bfs,
            "dfs": dfs
        }

        results = {}
        
        # 5. Chạy từng thuật toán và thu thập thống kê
        for algo_name, algo_func in algorithms.items():
            try:
                # Đo thời gian thực thi
                start_time = time.perf_counter()
                node_path, stats = algo_func(graph, nodes, start_node, end_node, return_stats=True)
                execution_time = time.perf_counter() - start_time
                
                if node_path:
                    # Chuyển node → tọa độ [lat, lng]
                    path_coords = [[nodes[node_id][0], nodes[node_id][1]] for node_id in node_path]
                    # Tính độ dài đường đi
                    path_distance = calculate_path_distance(node_path, nodes)
                    
                    results[algo_name] = {
                        "success": True,
                        "execution_time_ms": round(execution_time * 1000, 2),
                        "nodes_explored": stats["nodes_explored"],
                        "path_length_m": round(path_distance, 2),
                        "path_length_km": round(path_distance / 1000, 3),
                        "path_nodes_count": len(node_path),
                        "path": path_coords
                    }
                else:
                    results[algo_name] = {
                        "success": False,
                        "execution_time_ms": round(execution_time * 1000, 2),
                        "nodes_explored": stats["nodes_explored"],
                        "error": "Không tìm được đường đi"
                    }
            except Exception as e:
                results[algo_name] = {
                    "success": False,
                    "error": str(e)
                }

        # 6. Tìm thuật toán tốt nhất
        successful_results = {k: v for k, v in results.items() if v.get("success", False)}
        
        if successful_results:
            # Thuật toán nhanh nhất
            fastest = min(successful_results.items(), key=lambda x: x[1]["execution_time_ms"])
            # Thuật toán duyệt ít node nhất
            most_efficient = min(successful_results.items(), key=lambda x: x[1]["nodes_explored"])
            # Thuật toán tìm đường ngắn nhất (nếu có)
            shortest_path = min(successful_results.items(), key=lambda x: x[1]["path_length_m"])
            
            summary = {
                "fastest": fastest[0],
                "most_efficient": most_efficient[0],
                "shortest_path": shortest_path[0],
                "total_algorithms_tested": len(algorithms),
                "successful_algorithms": len(successful_results)
            }
        else:
            summary = {
                "total_algorithms_tested": len(algorithms),
                "successful_algorithms": 0,
                "error": "Không có thuật toán nào tìm được đường đi"
            }

        return {
            "results": results,
            "summary": summary,
            "start_node": [nodes[start_node][0], nodes[start_node][1]],
            "end_node": [nodes[end_node][0], nodes[end_node][1]]
        }

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Lỗi Overpass API: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi máy chủ: {str(e)}")