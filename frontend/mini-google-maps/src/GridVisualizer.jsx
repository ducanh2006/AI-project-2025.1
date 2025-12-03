import { useState, useRef, useEffect, useCallback } from 'react';
import './GridVisualizer.css';
import DraggableResizablePanel from './DraggableResizablePanel';

function GridVisualizer() {
  const [gridSizeInput, setGridSizeInput] = useState(''); // Input value (có thể rỗng)
  const [gridSize, setGridSize] = useState(null); // Actual grid size (null = auto)
  const [startNode, setStartNode] = useState(null);
  const [endNode, setEndNode] = useState(null);
  const [obstacles, setObstacles] = useState(new Set());
  const [mode, setMode] = useState('start'); // 'start', 'end', 'obstacle', 'erase'
  const [algorithm, setAlgorithm] = useState('dijkstra');
  const [isRunning, setIsRunning] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(50); // ms per step
  const [visitedNodes, setVisitedNodes] = useState(new Set());
  const [path, setPath] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [stats, setStats] = useState(null);
  const [comparisonResults, setComparisonResults] = useState(null);
  const [showComparison, setShowComparison] = useState(false);

  const gridRef = useRef(null);
  const graphRef = useRef(null);
  const animationRef = useRef(null);
  const gridWrapperRef = useRef(null);
  const [calculatedGridSize, setCalculatedGridSize] = useState(25); // Grid size được tính toán tự động

  const algorithmColors = {
    dijkstra: '#007bff',
    astar: '#28a745',
    bfs: '#ffc107',
    dfs: '#dc3545'
  };

  // Tính toán grid size tự động dựa trên container
  useEffect(() => {
    const calculateAutoGridSize = () => {
      if (gridWrapperRef.current && gridSize === null) {
        const containerWidth = gridWrapperRef.current.clientWidth - 32; // Trừ padding
        const containerHeight = gridWrapperRef.current.clientHeight - 32;
        const minDimension = Math.min(containerWidth, containerHeight);
        // Tính số ô có thể fit với cell size tối thiểu 15px
        const maxCells = Math.floor(minDimension / 15);
        // Giới hạn tối đa 100x100 để tránh quá tải
        const autoSize = Math.min(maxCells, 100);
        const newSize = Math.max(10, autoSize);
        if (newSize !== calculatedGridSize) {
          setCalculatedGridSize(newSize);
        }
      }
    };

    // Tính toán ngay lập tức
    calculateAutoGridSize();
    
    // Tính toán lại khi window resize
    window.addEventListener('resize', calculateAutoGridSize);
    
    // Sử dụng ResizeObserver để theo dõi container size
    let resizeObserver = null;
    if (gridWrapperRef.current) {
      resizeObserver = new ResizeObserver(() => {
        calculateAutoGridSize();
      });
      resizeObserver.observe(gridWrapperRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', calculateAutoGridSize);
      if (resizeObserver && gridWrapperRef.current) {
        resizeObserver.unobserve(gridWrapperRef.current);
      }
    };
  }, [gridSize, calculatedGridSize]);

  // Khởi tạo đồ thị
  useEffect(() => {
    const actualSize = gridSize !== null ? gridSize : calculatedGridSize;
    if (actualSize > 0) {
      initializeGraph(actualSize);
    }
  }, [gridSize, calculatedGridSize]);

  const initializeGraph = (size) => {
    const graph = {};
    
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const nodeId = `${row}-${col}`;
        graph[nodeId] = [];
        
        // Thêm các cạnh (4 hướng + 4 đường chéo)
        const directions = [
          [-1, 0], [1, 0], [0, -1], [0, 1], // 4 hướng chính
          [-1, -1], [-1, 1], [1, -1], [1, 1] // 4 đường chéo
        ];
        
        for (const [dr, dc] of directions) {
          const newRow = row + dr;
          const newCol = col + dc;
          
          if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
            const neighborId = `${newRow}-${newCol}`;
            const weight = Math.abs(dr) + Math.abs(dc) === 2 ? 1.414 : 1; // Đường chéo có trọng số lớn hơn
            graph[nodeId].push({ node: neighborId, weight });
          }
        }
      }
    }
    
    graphRef.current = graph;
  };

  const getNodeId = (row, col) => `${row}-${col}`;

  const handleCellClick = (row, col) => {
    const actualSize = gridSize !== null ? gridSize : calculatedGridSize;
    if (row >= 0 && row < actualSize && col >= 0 && col < actualSize) {
      const nodeId = getNodeId(row, col);
      
      if (mode === 'start') {
        if (nodeId !== endNode && !obstacles.has(nodeId)) {
          setStartNode(nodeId);
        }
      } else if (mode === 'end') {
        if (nodeId !== startNode && !obstacles.has(nodeId)) {
          setEndNode(nodeId);
        }
      } else if (mode === 'obstacle') {
        if (nodeId !== startNode && nodeId !== endNode) {
          const newObstacles = new Set(obstacles);
          newObstacles.add(nodeId);
          setObstacles(newObstacles);
        }
      } else if (mode === 'erase') {
        const newObstacles = new Set(obstacles);
        newObstacles.delete(nodeId);
        setObstacles(newObstacles);
      }
    }
  };

  const handleCellMouseEnter = (row, col, e) => {
    if (e.buttons === 1) { // Mouse đang được giữ
      handleCellClick(row, col);
    }
  };

  // Thuật toán Dijkstra với animation
  const dijkstraWithAnimation = useCallback((graph, start, end, onStep) => {
    const dist = {};
    const prev = {};
    const visited = new Set();
    const pq = [[0, start]];
    const explored = [];
    
    Object.keys(graph).forEach(node => {
      dist[node] = Infinity;
      prev[node] = null;
    });
    dist[start] = 0;
    
    while (pq.length > 0) {
      pq.sort((a, b) => a[0] - b[0]);
      const [d, u] = pq.shift();
      
      if (visited.has(u)) continue;
      visited.add(u);
      explored.push(u);
      
      if (u === end) break;
      
      for (const { node: v, weight } of graph[u]) {
        if (obstacles.has(v) || visited.has(v)) continue;
        
        const alt = dist[u] + weight;
        if (alt < dist[v]) {
          dist[v] = alt;
          prev[v] = u;
          pq.push([alt, v]);
        }
      }
    }
    
    const path = reconstructPath(prev, start, end);
    
    // Animation
    let stepIndex = 0;
    const animate = () => {
      if (stepIndex < explored.length) {
        onStep(explored.slice(0, stepIndex + 1), stepIndex === explored.length - 1 ? path : []);
        stepIndex++;
        animationRef.current = setTimeout(animate, animationSpeed);
      } else {
        setIsRunning(false);
        setStats({
          nodesExplored: explored.length,
          pathLength: path.length - 1,
          executionTime: explored.length * animationSpeed
        });
      }
    };
    
    animate();
    
    return { path, explored };
  }, [obstacles, animationSpeed]);

  // Thuật toán A*
  const astarWithAnimation = useCallback((graph, start, end, nodes, onStep) => {
    const heuristic = (a, b) => {
      const [r1, c1] = a.split('-').map(Number);
      const [r2, c2] = b.split('-').map(Number);
      return Math.abs(r1 - r2) + Math.abs(c1 - c2);
    };

    const openSet = [[heuristic(start, end), start]];
    const gScore = {};
    const fScore = {};
    const cameFrom = {};
    const visited = new Set();
    const explored = [];
    
    Object.keys(graph).forEach(node => {
      gScore[node] = Infinity;
      fScore[node] = Infinity;
    });
    
    gScore[start] = 0;
    fScore[start] = heuristic(start, end);
    
    while (openSet.length > 0) {
      openSet.sort((a, b) => a[0] - b[0]);
      const [_, current] = openSet.shift();
      
      if (current === end) {
        const path = reconstructPath(cameFrom, start, end);
        
        let stepIndex = 0;
        const animate = () => {
          if (stepIndex < explored.length) {
            onStep(explored.slice(0, stepIndex + 1), stepIndex === explored.length - 1 ? path : []);
            stepIndex++;
            animationRef.current = setTimeout(animate, animationSpeed);
          } else {
            setIsRunning(false);
            setStats({
              nodesExplored: explored.length,
              pathLength: path.length - 1,
              executionTime: explored.length * animationSpeed
            });
          }
        };
        animate();
        
        return { path, explored };
      }
      
      visited.add(current);
      explored.push(current);
      
      for (const { node: neighbor, weight } of graph[current]) {
        if (obstacles.has(neighbor) || visited.has(neighbor)) continue;
        
        const tentativeG = gScore[current] + weight;
        
        if (tentativeG < gScore[neighbor]) {
          cameFrom[neighbor] = current;
          gScore[neighbor] = tentativeG;
          fScore[neighbor] = tentativeG + heuristic(neighbor, end);
          
          if (!openSet.some(([_, node]) => node === neighbor)) {
            openSet.push([fScore[neighbor], neighbor]);
          }
        }
      }
    }
    
    setIsRunning(false);
    return { path: [], explored };
  }, [obstacles, animationSpeed]);

  // Thuật toán BFS
  const bfsWithAnimation = useCallback((graph, start, end, onStep) => {
    const queue = [start];
    const visited = new Set([start]);
    const parent = { [start]: null };
    const explored = [start];
    
    while (queue.length > 0) {
      const u = queue.shift();
      
      if (u === end) {
        const path = reconstructPath(parent, start, end);
        
        let stepIndex = 0;
        const animate = () => {
          if (stepIndex < explored.length) {
            onStep(explored.slice(0, stepIndex + 1), stepIndex === explored.length - 1 ? path : []);
            stepIndex++;
            animationRef.current = setTimeout(animate, animationSpeed);
          } else {
            setIsRunning(false);
            setStats({
              nodesExplored: explored.length,
              pathLength: path.length - 1,
              executionTime: explored.length * animationSpeed
            });
          }
        };
        animate();
        
        return { path, explored };
      }
      
      for (const { node: v } of graph[u]) {
        if (obstacles.has(v) || visited.has(v)) continue;
        
        visited.add(v);
        explored.push(v);
        parent[v] = u;
        queue.push(v);
      }
    }
    
    setIsRunning(false);
    return { path: [], explored };
  }, [obstacles, animationSpeed]);

  // Thuật toán DFS
  const dfsWithAnimation = useCallback((graph, start, end, onStep) => {
    const stack = [start];
    const visited = new Set();
    const parent = { [start]: null };
    const explored = [];
    
    while (stack.length > 0) {
      const u = stack.pop();
      
      if (u === end) {
        const path = reconstructPath(parent, start, end);
        
        let stepIndex = 0;
        const animate = () => {
          if (stepIndex < explored.length) {
            onStep(explored.slice(0, stepIndex + 1), stepIndex === explored.length - 1 ? path : []);
            stepIndex++;
            animationRef.current = setTimeout(animate, animationSpeed);
          } else {
            setIsRunning(false);
            setStats({
              nodesExplored: explored.length,
              pathLength: path.length - 1,
              executionTime: explored.length * animationSpeed
            });
          }
        };
        animate();
        
        return { path, explored };
      }
      
      if (visited.has(u)) continue;
      visited.add(u);
      explored.push(u);
      
      for (const { node: v } of graph[u]) {
        if (!obstacles.has(v) && !visited.has(v)) {
          parent[v] = u;
          stack.push(v);
        }
      }
    }
    
    setIsRunning(false);
    return { path: [], explored };
  }, [obstacles, animationSpeed]);

  const reconstructPath = (prev, start, end) => {
    const path = [];
    let current = end;
    
    while (current !== null && current !== undefined) {
      path.unshift(current);
      current = prev[current];
    }
    
    if (path[0] === start) {
      return path;
    }
    return [];
  };

  const handleRunAlgorithm = () => {
    if (!startNode || !endNode || !graphRef.current || isRunning) return;
    
    setIsRunning(true);
    setVisitedNodes(new Set());
    setPath([]);
    setStats(null);
    
    const graph = graphRef.current;
    const onStep = (visited, currentPath) => {
      setVisitedNodes(new Set(visited));
      setPath(currentPath);
    };

    // Chạy thuật toán với animation
    if (algorithm === 'dijkstra') {
      dijkstraWithAnimation(graph, startNode, endNode, onStep);
    } else if (algorithm === 'astar') {
      astarWithAnimation(graph, startNode, endNode, null, onStep);
    } else if (algorithm === 'bfs') {
      bfsWithAnimation(graph, startNode, endNode, onStep);
    } else if (algorithm === 'dfs') {
      dfsWithAnimation(graph, startNode, endNode, onStep);
    }
  };

  const handleCompareAlgorithms = async () => {
    if (!startNode || !endNode || !graphRef.current || isRunning) return;
    
    setIsRunning(true);
    setShowComparison(true);
    setVisitedNodes(new Set());
    setPath([]);
    
    const graph = graphRef.current;
    const results = {};
    
    // Chạy từng thuật toán không có animation để so sánh
    const runWithoutAnimation = (algoName) => {
      const startTime = performance.now();
      let path = [];
      let nodesExplored = 0;
      
      if (algoName === 'dijkstra') {
        const dist = {};
        const prev = {};
        const visited = new Set();
        const pq = [[0, startNode]];
        const explored = new Set();
        
        Object.keys(graph).forEach(node => {
          dist[node] = Infinity;
          prev[node] = null;
        });
        dist[startNode] = 0;
        
        while (pq.length > 0) {
          pq.sort((a, b) => a[0] - b[0]);
          const [d, u] = pq.shift();
          if (visited.has(u)) continue;
          visited.add(u);
          explored.add(u);
          if (u === endNode) break;
          
          for (const { node: v, weight } of graph[u]) {
            if (obstacles.has(v) || visited.has(v)) continue;
            const alt = dist[u] + weight;
            if (alt < dist[v]) {
              dist[v] = alt;
              prev[v] = u;
              pq.push([alt, v]);
            }
          }
        }
        path = reconstructPath(prev, startNode, endNode);
        nodesExplored = explored.size;
      } else if (algoName === 'astar') {
        const heuristic = (a, b) => {
          const [r1, c1] = a.split('-').map(Number);
          const [r2, c2] = b.split('-').map(Number);
          return Math.abs(r1 - r2) + Math.abs(c1 - c2);
        };
        const openSet = [[heuristic(startNode, endNode), startNode]];
        const gScore = {};
        const fScore = {};
        const cameFrom = {};
        const visited = new Set();
        const explored = new Set();
        
        Object.keys(graph).forEach(node => {
          gScore[node] = Infinity;
          fScore[node] = Infinity;
        });
        gScore[startNode] = 0;
        fScore[startNode] = heuristic(startNode, endNode);
        
        while (openSet.length > 0) {
          openSet.sort((a, b) => a[0] - b[0]);
          const [_, current] = openSet.shift();
          if (current === endNode) {
            path = reconstructPath(cameFrom, startNode, endNode);
            break;
          }
          visited.add(current);
          explored.add(current);
          
          for (const { node: neighbor, weight } of graph[current]) {
            if (obstacles.has(neighbor) || visited.has(neighbor)) continue;
            const tentativeG = gScore[current] + weight;
            if (tentativeG < gScore[neighbor]) {
              cameFrom[neighbor] = current;
              gScore[neighbor] = tentativeG;
              fScore[neighbor] = tentativeG + heuristic(neighbor, endNode);
              if (!openSet.some(([_, node]) => node === neighbor)) {
                openSet.push([fScore[neighbor], neighbor]);
              }
            }
          }
        }
        nodesExplored = explored.size;
      } else if (algoName === 'bfs') {
        const queue = [startNode];
        const visited = new Set([startNode]);
        const parent = { [startNode]: null };
        const explored = new Set([startNode]);
        
        while (queue.length > 0) {
          const u = queue.shift();
          if (u === endNode) {
            path = reconstructPath(parent, startNode, endNode);
            break;
          }
          for (const { node: v } of graph[u]) {
            if (obstacles.has(v) || visited.has(v)) continue;
            visited.add(v);
            explored.add(v);
            parent[v] = u;
            queue.push(v);
          }
        }
        nodesExplored = explored.size;
      } else if (algoName === 'dfs') {
        const stack = [startNode];
        const visited = new Set();
        const parent = { [startNode]: null };
        const explored = new Set();
        
        while (stack.length > 0) {
          const u = stack.pop();
          if (u === endNode) {
            path = reconstructPath(parent, startNode, endNode);
            break;
          }
          if (visited.has(u)) continue;
          visited.add(u);
          explored.add(u);
          for (const { node: v } of graph[u]) {
            if (!obstacles.has(v) && !visited.has(v)) {
              parent[v] = u;
              stack.push(v);
            }
          }
        }
        nodesExplored = explored.size;
      }
      
      const endTime = performance.now();
      return {
        success: path.length > 0,
        execution_time_ms: Math.round((endTime - startTime) * 100) / 100,
        nodes_explored: nodesExplored,
        path_length: path.length > 0 ? path.length - 1 : 0,
        path_nodes_count: path.length
      };
    };
    
    ['dijkstra', 'astar', 'bfs', 'dfs'].forEach(algoName => {
      results[algoName] = runWithoutAnimation(algoName);
    });
    
    const successful = Object.entries(results).filter(([_, r]) => r.success);
    let fastest = null;
    let mostEfficient = null;
    let shortestPath = null;
    
    if (successful.length > 0) {
      fastest = successful.reduce((a, b) => 
        results[a[0]].execution_time_ms < results[b[0]].execution_time_ms ? a : b
      )[0];
      mostEfficient = successful.reduce((a, b) => 
        results[a[0]].nodes_explored < results[b[0]].nodes_explored ? a : b
      )[0];
      shortestPath = successful.reduce((a, b) => 
        results[a[0]].path_length < results[b[0]].path_length ? a : b
      )[0];
    }
    
    setComparisonResults({
      results,
      summary: {
        fastest,
        most_efficient: mostEfficient,
        shortest_path: shortestPath,
        total_algorithms_tested: 4,
        successful_algorithms: successful.length
      }
    });
    
    setIsRunning(false);
  };

  const handleReset = () => {
    if (animationRef.current) {
      clearTimeout(animationRef.current);
    }
    setStartNode(null);
    setEndNode(null);
    setObstacles(new Set());
    setVisitedNodes(new Set());
    setPath([]);
    setStats(null);
    setComparisonResults(null);
    setShowComparison(false);
    setIsRunning(false);
  };

  const handleClearObstacles = () => {
    setObstacles(new Set());
  };

  const getCellClass = (row, col) => {
    const nodeId = getNodeId(row, col);
    let classes = 'grid-cell';
    
    if (nodeId === startNode) {
      classes += ' start';
    } else if (nodeId === endNode) {
      classes += ' end';
    } else if (obstacles.has(nodeId)) {
      classes += ' obstacle';
    } else if (path.includes(nodeId)) {
      classes += ' path';
    } else if (visitedNodes.has(nodeId)) {
      classes += ' visited';
    }
    
    return classes;
  };

  return (
    <div className="grid-visualizer">
      <div className="grid-controls">
        <div className="control-group">
          <label>Kích thước lưới (để trống = tự động):</label>
          <input
            type="number"
            min="5"
            max="200"
            value={gridSizeInput}
            placeholder="Tự động"
            onChange={(e) => {
              const value = e.target.value;
              setGridSizeInput(value);
              
              if (value === '' || value === null) {
                // Không nhập gì = tự động
                setGridSize(null);
              } else {
                const numValue = parseInt(value);
                if (!isNaN(numValue) && numValue >= 5 && numValue <= 200) {
                  setGridSize(numValue);
                }
              }
              handleReset();
            }}
            disabled={isRunning}
            className="grid-size-input"
          />
          {gridSize === null && (
            <span className="auto-size-indicator">
              Tự động: {calculatedGridSize}x{calculatedGridSize}
            </span>
          )}
        </div>

        <div className="mode-buttons">
          <button
            className={mode === 'start' ? 'active' : ''}
            onClick={() => setMode('start')}
            disabled={isRunning}
          >
            Chọn Start
          </button>
          <button
            className={mode === 'end' ? 'active' : ''}
            onClick={() => setMode('end')}
            disabled={isRunning}
          >
            Chọn Goal
          </button>
          <button
            className={mode === 'obstacle' ? 'active' : ''}
            onClick={() => setMode('obstacle')}
            disabled={isRunning}
          >
            Vẽ vật cản
          </button>
          <button
            className={mode === 'erase' ? 'active' : ''}
            onClick={() => setMode('erase')}
            disabled={isRunning}
          >
            Xóa
          </button>
        </div>

        <div className="control-group">
          <label>Thuật toán:</label>
          <select 
            value={algorithm} 
            onChange={(e) => setAlgorithm(e.target.value)}
            disabled={isRunning}
          >
            <option value="dijkstra">Dijkstra</option>
            <option value="astar">A* (A-Star)</option>
            <option value="bfs">BFS</option>
            <option value="dfs">DFS</option>
          </select>
        </div>

        <div className="control-group">
          <label>Tốc độ: {animationSpeed}ms</label>
          <input
            type="range"
            min="10"
            max="200"
            value={animationSpeed}
            onChange={(e) => setAnimationSpeed(parseInt(e.target.value))}
            disabled={isRunning}
          />
        </div>

        <button
          className="btn-run"
          onClick={handleRunAlgorithm}
          disabled={!startNode || !endNode || isRunning}
        >
          {isRunning ? 'Đang chạy...' : 'Chạy thuật toán'}
        </button>

        <button
          className="btn-compare-grid"
          onClick={handleCompareAlgorithms}
          disabled={!startNode || !endNode || isRunning}
        >
          So sánh
        </button>

        <button
          className="btn-clear"
          onClick={handleClearObstacles}
          disabled={isRunning}
        >
          Xóa vật cản
        </button>

        <button
          className="btn-reset-grid"
          onClick={handleReset}
          disabled={isRunning}
        >
          Reset
        </button>
      </div>

      <div className="grid-wrapper" ref={gridWrapperRef}>
        {(() => {
          const actualSize = gridSize !== null ? gridSize : calculatedGridSize;
          return (
            <div 
              className="grid-container"
              ref={gridRef}
              style={{
                gridTemplateColumns: `repeat(${actualSize}, 1fr)`,
                gridTemplateRows: `repeat(${actualSize}, 1fr)`
              }}
            >
              {Array.from({ length: actualSize * actualSize }, (_, i) => {
                const row = Math.floor(i / actualSize);
                const col = i % actualSize;
                return (
                  <div
                    key={i}
                    className={getCellClass(row, col)}
                    onClick={() => handleCellClick(row, col)}
                    onMouseEnter={(e) => handleCellMouseEnter(row, col, e)}
                    onMouseDown={(e) => {
                      if (mode === 'obstacle' || mode === 'erase') {
                        handleCellClick(row, col);
                      }
                    }}
                  />
                );
              })}
            </div>
          );
        })()}

        {stats && (
          <div className="stats-panel">
            <h4>Thống kê</h4>
            <p>Node đã duyệt: {stats.nodesExplored}</p>
            <p>Độ dài đường đi: {stats.pathLength}</p>
            <p>Thời gian: {stats.executionTime}ms</p>
          </div>
        )}
      </div>

      {showComparison && comparisonResults && (
        <DraggableResizablePanel
          title="Kết quả so sánh"
          onClose={() => setShowComparison(false)}
        >
          {comparisonResults.summary && (
            <div className="summary-section">
              <div className="summary-item">
                <span className="summary-label">Nhanh nhất:</span>
                <span className="summary-value">{comparisonResults.summary.fastest?.toUpperCase() || 'N/A'}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Hiệu quả nhất:</span>
                <span className="summary-value">{comparisonResults.summary.most_efficient?.toUpperCase() || 'N/A'}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Đường ngắn nhất:</span>
                <span className="summary-value">{comparisonResults.summary.shortest_path?.toUpperCase() || 'N/A'}</span>
              </div>
            </div>
          )}

          <div className="comparison-table">
            <table>
              <thead>
                <tr>
                  <th>Thuật toán</th>
                  <th>Thời gian (ms)</th>
                  <th>Node đã duyệt</th>
                  <th>Độ dài</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(comparisonResults.results || {}).map(([algoName, result]) => (
                  <tr key={algoName} className={result.success ? 'success' : 'error'}>
                    <td>
                      <span 
                        className="algorithm-badge" 
                        style={{ backgroundColor: algorithmColors[algoName] || '#666' }}
                      >
                        {algoName.toUpperCase()}
                      </span>
                    </td>
                    <td>{result.success ? result.execution_time_ms : '-'}</td>
                    <td>{result.success ? result.nodes_explored : '-'}</td>
                    <td>{result.success ? result.path_length : '-'}</td>
                    <td>
                      {result.success ? (
                        <span className="status-success">Thành công</span>
                      ) : (
                        <span className="status-error">Thất bại</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DraggableResizablePanel>
      )}
    </div>
  );
}

export default GridVisualizer;

