from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict
import math
import heapq
import requests

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
# 2. Xây đồ thị từ dữ liệu OSM
# ================================
def build_graph(osm_data: dict):
    nodes = {}
    graph = {}

    # Thu thập tất cả node
    for element in osm_data["elements"]:
        if element["type"] == "node":
            node_id = element["id"]
            nodes[node_id] = (element["lat"], element["lon"])
            graph[node_id] = []

    # Xây cạnh từ way
    for element in osm_data["elements"]:
        if element["type"] == "way" and "nodes" in element:
            way_nodes = element["nodes"]
            for i in range(len(way_nodes) - 1):
                u = way_nodes[i]
                v = way_nodes[i + 1]
                if u in graph and v in graph:
                    # Tính khoảng cách Euclid (xấp xỉ)
                    lat1, lon1 = nodes[u]
                    lat2, lon2 = nodes[v]
                    dist = math.hypot(lat2 - lat1, lon2 - lon1) * 111000  # ~ mét

                    # Đồ thị vô hướng
                    graph[u].append((v, dist))
                    graph[v].append((u, dist))

    return graph, nodes

# ================================
# 3. Các thuật toán tìm đường
# ================================
def dijkstra(graph, nodes, start_node, end_node):
    dist = {node: float('inf') for node in graph}
    prev = {node: None for node in graph}
    dist[start_node] = 0
    pq = [(0, start_node)]

    while pq:
        d, u = heapq.heappop(pq)
        if u == end_node:
            break
        if d > dist[u]:
            continue
        for v, w in graph[u]:
            alt = dist[u] + w
            if alt < dist[v]:
                dist[v] = alt
                prev[v] = u
                heapq.heappush(pq, (alt, v))

    return reconstruct_path(prev, start_node, end_node)

def astar(graph, nodes, start_node, end_node):
    def heuristic(a, b):
        lat1, lon1 = nodes[a]
        lat2, lon2 = nodes[b]
        return math.hypot(lat2 - lat1, lon2 - lon1)

    open_set = [(0, start_node)]
    g_score = {node: float('inf') for node in graph}
    g_score[start_node] = 0
    f_score = {node: float('inf') for node in graph}
    f_score[start_node] = heuristic(start_node, end_node)
    came_from = {}

    while open_set:
        _, current = heapq.heappop(open_set)
        if current == end_node:
            return reconstruct_path(came_from, start_node, end_node)
        for neighbor, weight in graph[current]:
            tentative_g = g_score[current] + weight
            if tentative_g < g_score[neighbor]:
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                f_score[neighbor] = tentative_g + heuristic(neighbor, end_node)
                heapq.heappush(open_set, (f_score[neighbor], neighbor))
    return []

def bfs(graph, nodes, start_node, end_node):
    from collections import deque
    queue = deque([start_node])
    visited = {start_node}
    parent = {start_node: None}
    while queue:
        u = queue.popleft()
        if u == end_node:
            return reconstruct_path(parent, start_node, end_node)
        for v, _ in graph[u]:
            if v not in visited:
                visited.add(v)
                parent[v] = u
                queue.append(v)
    return []

def dfs(graph, nodes, start_node, end_node):
    stack = [start_node]
    visited = set()
    parent = {start_node: None}
    while stack:
        u = stack.pop()
        if u == end_node:
            return reconstruct_path(parent, start_node, end_node)
        if u in visited:
            continue
        visited.add(u)
        for v, _ in graph[u]:
            if v not in visited:
                parent[v] = u
                stack.append(v)
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

# ================================
# 4. Tìm node gần nhất với tọa độ
# ================================
def find_nearest_node(nodes: Dict[int, tuple], lat: float, lng: float) -> int:
    best_id = None
    best_dist = float('inf')
    for node_id, (nlat, nlng) in nodes.items():
        dist = math.hypot(nlat - lat, nlng - lng)
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