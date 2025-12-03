import './AlgorithmInfo.css';

function AlgorithmInfo() {
  const algorithms = [
    {
      name: 'Dijkstra',
      description: 'Thuật toán tìm đường đi ngắn nhất từ một đỉnh nguồn đến tất cả các đỉnh khác trong đồ thị có trọng số không âm.',
      complexity: 'O(V²) hoặc O(E + V log V) với priority queue',
      features: [
        'Đảm bảo tìm được đường đi ngắn nhất',
        'Hoạt động tốt với đồ thị có trọng số',
        'Sử dụng greedy approach',
        'Không sử dụng heuristic'
      ],
      useCases: [
        'Tìm đường đi ngắn nhất trong mạng lưới giao thông',
        'Routing trong mạng máy tính',
        'Khi không có thông tin về đích đến'
      ],
      color: '#007bff'
    },
    {
      name: 'A* (A-Star)',
      description: 'Thuật toán tìm đường đi ngắn nhất sử dụng heuristic để tối ưu hóa việc tìm kiếm, kết hợp giữa Dijkstra và Greedy Best-First Search.',
      complexity: 'O(b^d) trong trường hợp xấu nhất, nhưng thường nhanh hơn nhờ heuristic',
      features: [
        'Sử dụng hàm heuristic để hướng dẫn tìm kiếm',
        'Đảm bảo tìm được đường đi ngắn nhất nếu heuristic admissible',
        'Hiệu quả hơn Dijkstra trong nhiều trường hợp',
        'Công thức: f(n) = g(n) + h(n)'
      ],
      useCases: [
        'Tìm đường trong game AI',
        'Robot pathfinding',
        'GPS navigation systems',
        'Khi có thông tin về đích đến'
      ],
      color: '#28a745'
    },
    {
      name: 'BFS (Breadth-First Search)',
      description: 'Thuật toán duyệt đồ thị theo chiều rộng, tìm đường đi ngắn nhất về số lượng cạnh (không tính trọng số).',
      complexity: 'O(V + E)',
      features: [
        'Tìm đường đi ngắn nhất về số lượng cạnh',
        'Sử dụng queue (FIFO)',
        'Đảm bảo tìm được đường đi nếu tồn tại',
        'Không phù hợp với đồ thị có trọng số'
      ],
      useCases: [
        'Tìm đường đi ngắn nhất trong đồ thị không trọng số',
        'Social network analysis',
        'Web crawling',
        'Puzzle solving'
      ],
      color: '#ffc107'
    },
    {
      name: 'DFS (Depth-First Search)',
      description: 'Thuật toán duyệt đồ thị theo chiều sâu, đi sâu vào một nhánh trước khi quay lại.',
      complexity: 'O(V + E)',
      features: [
        'Sử dụng stack (LIFO) hoặc đệ quy',
        'Không đảm bảo tìm được đường đi ngắn nhất',
        'Tiết kiệm bộ nhớ hơn BFS',
        'Có thể đi vào vòng lặp vô hạn'
      ],
      useCases: [
        'Kiểm tra tính liên thông của đồ thị',
        'Topological sorting',
        'Tìm chu trình trong đồ thị',
        'Maze solving'
      ],
      color: '#dc3545'
    }
  ];

  return (
    <div className="algorithm-info-container">
      <div className="info-header">
        <h1>Thông Tin Các Thuật Toán Tìm Đường</h1>
        <p className="subtitle">Tìm hiểu về các thuật toán pathfinding được sử dụng trong ứng dụng</p>
      </div>

      <div className="algorithms-grid">
        {algorithms.map((algo, index) => (
          <div key={index} className="algorithm-card">
            <div className="card-header" style={{ background: `linear-gradient(135deg, ${algo.color} 0%, ${algo.color}dd 100%)` }}>
              <h2>{algo.name}</h2>
            </div>
            <div className="card-body">
              <div className="card-section">
                <h3>Mô tả</h3>
                <p>{algo.description}</p>
              </div>

              <div className="card-section">
                <h3>Độ phức tạp</h3>
                <div className="complexity-badge">
                  {algo.complexity}
                </div>
              </div>

              <div className="card-section">
                <h3>Đặc điểm</h3>
                <ul className="features-list">
                  {algo.features.map((feature, idx) => (
                    <li key={idx}>
                      <span className="feature-icon">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card-section">
                <h3>Ứng dụng</h3>
                <ul className="usecases-list">
                  {algo.useCases.map((useCase, idx) => (
                    <li key={idx}>
                      <span className="usecase-icon">→</span>
                      {useCase}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="comparison-section">
        <h2>So Sánh Các Thuật Toán</h2>
        <div className="comparison-table-wrapper">
          <table className="comparison-info-table">
            <thead>
              <tr>
                <th>Thuật toán</th>
                <th>Độ phức tạp</th>
                <th>Đảm bảo tối ưu</th>
                <th>Yêu cầu heuristic</th>
                <th>Phù hợp nhất cho</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="algo-name" style={{ color: algorithms[0].color }}>Dijkstra</span></td>
                <td>O(V²) hoặc O(E + V log V)</td>
                <td className="success-cell">Có</td>
                <td className="no-cell">Không</td>
                <td>Đồ thị có trọng số</td>
              </tr>
              <tr>
                <td><span className="algo-name" style={{ color: algorithms[1].color }}>A*</span></td>
                <td>O(b^d) - thường nhanh hơn</td>
                <td className="success-cell">Có (nếu heuristic admissible)</td>
                <td className="yes-cell">Có</td>
                <td>Khi có thông tin về đích</td>
              </tr>
              <tr>
                <td><span className="algo-name" style={{ color: algorithms[2].color }}>BFS</span></td>
                <td>O(V + E)</td>
                <td className="success-cell">Có (số cạnh tối thiểu)</td>
                <td className="no-cell">Không</td>
                <td>Đồ thị không trọng số</td>
              </tr>
              <tr>
                <td><span className="algo-name" style={{ color: algorithms[3].color }}>DFS</span></td>
                <td>O(V + E)</td>
                <td className="error-cell">Không</td>
                <td className="no-cell">Không</td>
                <td>Duyệt đồ thị, tìm chu trình</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="formula-section">
        <h2>Công Thức Toán Học</h2>
        <div className="formulas-grid">
          <div className="formula-card">
            <h3>Dijkstra</h3>
            <div className="formula">
              <p>dist[v] = min(dist[v], dist[u] + weight(u, v))</p>
              <p className="formula-desc">Relaxation: Cập nhật khoảng cách ngắn nhất</p>
            </div>
          </div>
          <div className="formula-card">
            <h3>A*</h3>
            <div className="formula">
              <p>f(n) = g(n) + h(n)</p>
              <p className="formula-desc">g(n): chi phí từ start đến n<br/>h(n): heuristic từ n đến goal</p>
            </div>
          </div>
          <div className="formula-card">
            <h3>BFS</h3>
            <div className="formula">
              <p>Queue: FIFO (First In First Out)</p>
              <p className="formula-desc">Duyệt theo từng tầng (level)</p>
            </div>
          </div>
          <div className="formula-card">
            <h3>DFS</h3>
            <div className="formula">
              <p>Stack: LIFO (Last In First Out)</p>
              <p className="formula-desc">Đi sâu vào một nhánh trước</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AlgorithmInfo;

