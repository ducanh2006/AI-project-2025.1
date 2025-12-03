import { useState, useRef, useEffect } from 'react';
import './DraggableResizablePanel.css';

function DraggableResizablePanel({ children, onClose, title }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 850, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  const panelRef = useRef(null);

  // Tính toán vị trí ban đầu ở giữa màn hình
  useEffect(() => {
    const centerX = (window.innerWidth - size.width) / 2;
    const centerY = (window.innerHeight - size.height) / 2;
    setPosition({ x: Math.max(0, centerX), y: Math.max(0, centerY) });
  }, []);

  // Đảm bảo panel không ra ngoài viewport khi window resize
  useEffect(() => {
    const handleResize = () => {
      const maxX = window.innerWidth - size.width;
      const maxY = window.innerHeight - size.height;
      
      setPosition(prev => ({
        x: Math.max(0, Math.min(prev.x, maxX)),
        y: Math.max(0, Math.min(prev.y, maxY))
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [size]);

  const handleMouseDown = (e) => {
    const dragHandle = e.target.closest('.drag-handle');
    if (dragHandle && !e.target.closest('.btn-close')) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleResizeMouseDown = (e) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        
        // Giới hạn trong viewport
        const maxX = window.innerWidth - size.width;
        const maxY = window.innerHeight - size.height;
        
        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        const newWidth = Math.max(400, Math.min(resizeStart.width + deltaX, window.innerWidth - position.x));
        const newHeight = Math.max(300, Math.min(resizeStart.height + deltaY, window.innerHeight - position.y));
        
        setSize({
          width: newWidth,
          height: newHeight
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, resizeStart, position, size]);

  return (
    <div
      ref={panelRef}
      className="draggable-resizable-panel"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="drag-handle comparison-header">
        <h3>{title}</h3>
        <button className="btn-close" onClick={onClose}>X</button>
      </div>
      <div className="panel-content">
        {children}
      </div>
      <div 
        className="resize-handle"
        onMouseDown={handleResizeMouseDown}
      >
        <div className="resize-icon">↘</div>
      </div>
    </div>
  );
}

export default DraggableResizablePanel;

