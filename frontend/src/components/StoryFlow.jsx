import React, { useState, useEffect, useRef } from 'react';
import { Search, RefreshCw, BookOpen, Share2, HelpCircle, LayoutGrid, ZoomIn, ZoomOut } from 'lucide-react';

export default function StoryFlow({ storyUuid, backendUrl, onReadChapter }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // State for all nodes and connections
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [chaptersList, setChaptersList] = useState([]); // List of { chapterNum, title, summary }
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
  // Ref for the canvas wrapper to calculate scroll bounds
  const canvasContainerRef = useRef(null);
  
  const [zoom, setZoom] = useState(1.0);

  // Setup Wheel Event Listener for Ctrl + Mouse Wheel Zoom (non-passive listener)
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const handleWheelEvent = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY;
        setZoom(prev => {
          const factor = delta < 0 ? 0.05 : -0.05;
          const newZoom = prev + factor;
          return Math.max(0.3, Math.min(2.0, Math.round(newZoom * 100) / 100));
        });
      }
    };

    container.addEventListener('wheel', handleWheelEvent, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheelEvent);
    };
  }, [loading, nodes]);

  // Fetch all nodes
  const fetchAllNodes = async () => {
    if (!storyUuid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/api/stories/${storyUuid}/all-nodes`);
      if (!res.ok) {
        throw new Error('Không thể tải sơ đồ nodes câu chuyện');
      }
      const data = await res.json();
      
      // Process raw data
      // data is in format: { "1": { nodes: [], connections: [], chapter_title: "", chapter_summary: "" } }
      const sortedChapterKeys = Object.keys(data)
        .map(Number)
        .sort((a, b) => a - b);
      
      const processedNodes = [];
      const processedConnections = [];
      const tempChaptersList = [];
      
      sortedChapterKeys.forEach((chapNum, laneIdx) => {
        const chapData = data[String(chapNum)];
        
        // Add to chapters metadata list
        tempChaptersList.push({
          chapter: chapNum,
          title: chapData.chapter_title || `Chương ${chapNum}`,
          summary: chapData.chapter_summary || '',
          laneIdx: laneIdx
        });
        
        // Process nodes for this chapter
        const chapterNodes = chapData.nodes || [];
        chapterNodes.forEach(node => {
          // Calculate node coordinates. 
          // Offset X coordinates by +220px to avoid overlapping with the left chapter lane cards
          // Shift Y coordinate by laneIdx * 400px to lay them out in swimlanes
          const initialX = typeof node.x === 'number' ? node.x + 220 : 350;
          const initialY = typeof node.y === 'number' ? node.y + (laneIdx * 400) : 150 + (laneIdx * 400);
          
          processedNodes.push({
            id: `${chapNum}_${node.id}`, // Unique compound ID
            originalId: node.id,
            chapter: chapNum,
            title: node.title || 'Không tiêu đề',
            description: node.description || 'Không mô tả',
            content: node.content || '',
            characters: node.characters || [],
            locations: node.locations || [],
            weapons: node.weapons || [],
            techniques: node.techniques || [],
            links: node.links || [],
            x: initialX,
            y: initialY,
            width: node.width || 280, // Default resizable width
            height: node.height || 200, // Default resizable height
            laneIdx: laneIdx
          });
        });
        
        // Process connections (within the same chapter)
        const chapterConnections = chapData.connections || [];
        chapterConnections.forEach(conn => {
          processedConnections.push({
            id: `intra_${chapNum}_${conn.from}_${conn.to}`,
            from: `${chapNum}_${conn.from}`,
            to: `${chapNum}_${conn.to}`,
            type: 'intra',
            chapter: chapNum
          });
        });
      });
      
      // Process inter-chapter links after all unique nodes are mapped
      processedNodes.forEach(node => {
        if (node.links && node.links.length > 0) {
          node.links.forEach(link => {
            const targetChap = link.chapter;
            const targetNodeIds = link.nodes || [];
            
            targetNodeIds.forEach(targetId => {
              const fromUniqueId = `${targetChap}_${targetId}`;
              // Verify if target node exists in our processed nodes
              const exists = processedNodes.some(n => n.id === fromUniqueId);
              if (exists) {
                processedConnections.push({
                  id: `inter_${fromUniqueId}_to_${node.id}`,
                  from: fromUniqueId,
                  to: node.id,
                  type: 'inter'
                });
              }
            });
          });
        }
      });
      
      setNodes(processedNodes);
      setConnections(processedConnections);
      setChaptersList(tempChaptersList);
      
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllNodes();
  }, [storyUuid]);

  // --- Drag and Drop Logic ---
  const handleNodeMouseDown = (e, nodeId) => {
    if (e.button !== 0) return; // Left click only
    
    // Do not trigger drag if clicking scrollbars, buttons or scrollable text areas
    if (e.target.closest('button') || e.target.closest('.node-content-body')) {
      return;
    }
    
    e.preventDefault();
    const nodeIndex = nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) return;

    const node = nodes[nodeIndex];
    const startX = e.clientX / zoom - node.x;
    const startY = e.clientY / zoom - node.y;

    const handleMouseMove = (moveEvent) => {
      const newX = Math.max(10, Math.min(2200, moveEvent.clientX / zoom - startX));
      const newY = Math.max(10, Math.min(5000, moveEvent.clientY / zoom - startY));

      setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, x: newX, y: newY } : n));
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // --- Handle Resize Completion ---
  const handleNodeMouseUp = (e, nodeId) => {
    const element = e.currentTarget;
    const newWidth = element.offsetWidth;
    const newHeight = element.offsetHeight;
    
    setNodes(prev => {
      const node = prev.find(n => n.id === nodeId);
      if (node && (node.width !== newWidth || node.height !== newHeight)) {
        return prev.map(n => n.id === nodeId ? { ...n, width: newWidth, height: newHeight } : n);
      }
      return prev;
    });
  };

  // --- Auto Arrange Layout Algorithm (Kahn's Topological Sort) ---
  const handleAutoArrange = () => {
    setNodes(prevNodes => {
      // Group nodes by chapter
      const chaptersMap = {};
      prevNodes.forEach(node => {
        if (!chaptersMap[node.chapter]) {
          chaptersMap[node.chapter] = [];
        }
        chaptersMap[node.chapter].push(node);
      });

      const newNodes = [...prevNodes];

      // For each chapter, sort its nodes and assign new coordinates
      Object.keys(chaptersMap).forEach(chapStr => {
        const chapNum = Number(chapStr);
        const chapNodes = chaptersMap[chapStr];
        if (chapNodes.length === 0) return;

        // Find connections inside this chapter
        const chapConns = connections.filter(
          c => c.chapter === chapNum && c.type === 'intra'
        );

        // Build adjacency list & count in-degrees
        const adj = {};
        const inDegree = {};
        chapNodes.forEach(n => {
          adj[n.id] = [];
          inDegree[n.id] = 0;
        });

        chapConns.forEach(c => {
          if (adj[c.from] && adj[c.to] !== undefined) {
            adj[c.from].push(c.to);
            inDegree[c.to] = (inDegree[c.to] || 0) + 1;
          }
        });

        // Topological sort starting from nodes with 0 in-degree
        const queue = chapNodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
        
        // Fallback if there is a cycle or no starting nodes: sort by current x
        if (queue.length === 0) {
          [...chapNodes].sort((a, b) => a.x - b.x).forEach(n => queue.push(n.id));
        }

        const orderedIds = [];
        const visited = new Set();

        while (queue.length > 0) {
          const currId = queue.shift();
          if (visited.has(currId)) continue;
          visited.add(currId);
          orderedIds.push(currId);

          const neighbors = adj[currId] || [];
          neighbors.forEach(neighId => {
            inDegree[neighId]--;
            if (inDegree[neighId] === 0) {
              queue.push(neighId);
            }
          });
        }

        // Add any remaining nodes (safeguard for cycle components)
        chapNodes.forEach(n => {
          if (!visited.has(n.id)) {
            orderedIds.push(n.id);
          }
        });

        // Assign clean coordinates
        orderedIds.forEach((nodeId, idx) => {
          const nodeIdx = newNodes.findIndex(n => n.id === nodeId);
          if (nodeIdx !== -1) {
            const laneIdx = newNodes[nodeIdx].laneIdx;
            // X: offset by +320px to clear left lane card, spaced by 340px
            newNodes[nodeIdx].x = 320 + idx * 340;
            // Y: centered and slightly staggered vertically to avoid straight overlaps
            newNodes[nodeIdx].y = laneIdx * 400 + 100 + (idx % 2) * 50;
          }
        });
      });

      return newNodes;
    });
  };

  // Render SVG connection lines
  const renderConnectionLines = () => {
    return connections.map((conn) => {
      const fromNode = nodes.find(n => n.id === conn.from);
      const toNode = nodes.find(n => n.id === conn.to);
      if (!fromNode || !toNode) return null;

      // Use node centers based on dynamic widths and heights
      const w1 = fromNode.width || 280;
      const h1 = fromNode.height || 200;
      const w2 = toNode.width || 280;
      const h2 = toNode.height || 200;

      const x1 = fromNode.x + w1 / 2;
      const y1 = fromNode.y + h1 / 2;
      const x2 = toNode.x + w2 / 2;
      const y2 = toNode.y + h2 / 2;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let targetX = x2;
      let targetY = y2;

      if (dist > 0) {
        // Stop line exactly at the boundary of target node card
        // We estimate the border offset based on target node dimensions
        const borderOffset = Math.max(w2 / 2, h2 / 2) + 10;
        const ratio = Math.max(0, (dist - borderOffset) / dist);
        targetX = x1 + dx * ratio;
        targetY = y1 + dy * ratio;
      }

      const isIntra = conn.type === 'intra';
      const strokeColor = isIntra ? 'var(--color-cyan)' : '#a855f7';
      const markerEndId = isIntra ? 'url(#arrow-cyan)' : 'url(#arrow-purple)';
      const strokeDash = isIntra ? '4 2' : 'none';
      const strokeWidth = isIntra ? '2.5' : '2';

      return (
        <g key={conn.id}>
          <line
            x1={x1}
            y1={y1}
            x2={targetX}
            y2={targetY}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
            markerEnd={markerEndId}
            strokeDasharray={strokeDash}
            opacity={
              searchTerm
                ? isNodeActive(fromNode) && isNodeActive(toNode)
                  ? 0.95
                  : 0.15
                : 0.75
            }
          />
        </g>
      );
    });
  };

  // Helper to check if node matches search query
  const isNodeActive = (node) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      node.title.toLowerCase().includes(term) ||
      node.description.toLowerCase().includes(term) ||
      node.content.toLowerCase().includes(term)
    );
  };

  const canvasHeight = Math.max(800, chaptersList.length * 400 + 100);

  return (
    <div className="story-flow-view fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Scoped CSS styling matching app theme */}
      <style>{`
        .flow-control-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 18px;
          border-radius: 10px;
          margin-bottom: 16px;
          gap: 12px;
        }
        .flow-search-container {
          position: relative;
          display: flex;
          align-items: center;
          width: 320px;
        }
        .flow-search-input {
          width: 100%;
          padding: 8px 12px 8px 36px;
          border-radius: 6px;
          border: 1px solid var(--border-glass);
          background: rgba(10, 14, 23, 0.6);
          color: var(--text-primary);
          font-size: 13px;
          outline: none;
          transition: border-color var(--transition-fast);
        }
        .flow-search-input:focus {
          border-color: var(--color-cyan);
        }
        .flow-search-icon {
          position: absolute;
          left: 10px;
          color: var(--text-muted);
        }
        .flow-legend {
          display: flex;
          gap: 16px;
          font-size: 12px;
          align-items: center;
        }
        .flow-legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-secondary);
        }
        .flow-legend-line {
          width: 20px;
          height: 0;
          border-top-width: 2.5px;
        }
        
        .flow-canvas-container {
          position: relative;
          width: 100%;
          flex: 1;
          background-color: #080a0f;
          border: 1px solid var(--border-glass);
          border-radius: 12px;
          overflow: auto;
          box-shadow: inset 0 0 24px rgba(0, 0, 0, 0.6);
        }
        .flow-canvas-wrapper {
          position: relative;
          width: 2400px;
          background-image: 
            radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px);
          background-size: 20px 20px;
          background-color: transparent;
        }
        .flow-lane-boundary {
          position: absolute;
          left: 0;
          width: 100%;
          height: 1px;
          border-top: 1px dashed rgba(255, 255, 255, 0.04);
          pointer-events: none;
        }
        .flow-lane-card {
          position: absolute;
          width: 260px;
          height: 360px;
          padding: 16px;
          border-radius: 10px;
          background: rgba(18, 22, 33, 0.8);
          border: 1px solid var(--border-glass);
          backdrop-filter: blur(8px);
          z-index: 5;
          display: flex;
          flex-direction: column;
          box-shadow: 4px 0 16px rgba(0, 0, 0, 0.3);
        }
        .flow-lane-card-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-cyan);
          margin-bottom: 4px;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .flow-lane-card-chapter {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .flow-lane-card-summary {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.5;
          flex: 1;
          overflow-y: auto;
          margin-bottom: 12px;
          padding-right: 4px;
          white-space: pre-wrap;
          border-top: 1px solid rgba(255, 255, 255, 0.03);
          padding-top: 8px;
        }
        .flow-lane-card-btn {
          width: 100%;
          padding: 8px;
          background: var(--bg-glass-light);
          border: 1px solid var(--border-glass);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: var(--transition-fast);
        }
        .flow-lane-card-btn:hover {
          background: rgba(6, 182, 212, 0.1);
          border-color: var(--color-cyan);
          color: var(--color-cyan);
        }

        .flow-node-card {
          position: absolute;
          border-radius: 10px;
          border: 1px solid var(--border-glass);
          background: rgba(14, 18, 28, 0.85);
          backdrop-filter: blur(10px);
          z-index: 10;
          cursor: grab;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
          user-select: none;
          display: flex;
          flex-direction: column;
          padding: 12px;
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
          resize: both;
          overflow: auto;
        }
        .flow-node-card:active {
          cursor: grabbing;
        }
        .flow-node-card:hover {
          border-color: rgba(6, 182, 212, 0.4);
          box-shadow: 0 0 15px rgba(6, 182, 212, 0.15);
        }
        .flow-node-card.active-match {
          border-color: var(--color-cyan);
          box-shadow: 0 0 15px var(--color-cyan-glow);
        }
        .flow-node-title {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--text-primary);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 6px;
          margin-bottom: 8px;
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .node-content-body {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-right: 4px;
        }
        .node-desc-section {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.5;
          font-style: italic;
        }
        .node-text-section {
          font-size: 12px;
          color: var(--text-primary);
          line-height: 1.5;
          background: rgba(255, 255, 255, 0.015);
          border: 1px dashed rgba(255, 255, 255, 0.03);
          border-radius: 6px;
          padding: 8px;
          margin-top: 4px;
          white-space: pre-wrap;
        }
        .node-empty-text {
          font-size: 11px;
          color: var(--text-muted);
          font-style: italic;
        }
        .flow-canvas-svg {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 4;
        }
      `}</style>

      {/* Control bar */}
      <div className="flow-control-bar glass">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Share2 className="icon-sm text-cyan" />
          <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Sơ Đồ Kết Nối Cốt Truyện Toàn Cảnh</h3>
        </div>
        
        {/* Connection legend */}
        <div className="flow-legend">
          <div className="flow-legend-item">
            <div className="flow-legend-line" style={{ borderTopStyle: 'dashed', borderTopColor: 'var(--color-cyan)' }}></div>
            <span>Tiến trình trong chương</span>
          </div>
          <div className="flow-legend-item">
            <div className="flow-legend-line" style={{ borderTopStyle: 'solid', borderTopColor: '#a855f7' }}></div>
            <span>Liên kết xuyên chương</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Zoom controls */}
          <div className="flow-zoom-controls" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.02)', padding: '2px 6px', borderRadius: '6px', border: '1px solid var(--border-glass)' }}>
            <button 
              type="button"
              className="btn-icon" 
              style={{ width: '24px', height: '24px' }} 
              onClick={() => setZoom(prev => Math.max(0.3, Math.round((prev - 0.1) * 10) / 10))}
              title="Thu nhỏ (Ctrl + Cuộn chuột xuống)"
            >
              <ZoomOut className="icon-xs" />
            </button>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: '38px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }} onClick={() => setZoom(1.0)} title="Đặt lại 100%">
              {Math.round(zoom * 100)}%
            </span>
            <button 
              type="button"
              className="btn-icon" 
              style={{ width: '24px', height: '24px' }} 
              onClick={() => setZoom(prev => Math.min(2.0, Math.round((prev + 0.1) * 10) / 10))}
              title="Phóng to (Ctrl + Cuộn chuột lên)"
            >
              <ZoomIn className="icon-xs" />
            </button>
          </div>
          {/* Search bar */}
          <div className="flow-search-container">
            <Search className="flow-search-icon icon-xs" />
            <input
              type="text"
              className="flow-search-input"
              placeholder="Tìm sự kiện, nhân vật, nội dung..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {/* Auto arrange button */}
          <button
            onClick={handleAutoArrange}
            className="btn-primary-sm"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)',
              color: '#fff',
              border: 'none'
            }}
          >
            <LayoutGrid className="icon-xs" />
            Sắp xếp tự động
          </button>
          {/* Reload button */}
          <button
            onClick={fetchAllNodes}
            className="btn-secondary-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            disabled={loading}
          >
            <RefreshCw className={`icon-xs ${loading ? 'spin' : ''}`} />
            Tải lại
          </button>
        </div>
      </div>

      {loading && nodes.length === 0 ? (
        <div className="center-content flex-1">
          <RefreshCw className="icon-lg text-muted spin margin-bottom-sm" />
          <p className="text-secondary">Đang tải và xây dựng sơ đồ cốt truyện...</p>
        </div>
      ) : error ? (
        <div className="center-content flex-1 text-center">
          <HelpCircle className="icon-lg text-red margin-bottom-sm" />
          <h4 className="text-red">Không thể tải sơ đồ</h4>
          <p className="text-secondary padding-xs">{error}</p>
          <button onClick={fetchAllNodes} className="btn-primary margin-top-md">
            Thử lại
          </button>
        </div>
      ) : chaptersList.length === 0 ? (
        <div className="center-content flex-1 text-center glass-light" style={{ padding: '40px', borderRadius: '12px' }}>
          <Share2 className="icon-lg text-muted margin-bottom-sm" />
          <h3>Chưa có sơ đồ sự kiện</h3>
          <p className="text-muted padding-xs" style={{ maxWidth: '480px', margin: '0 auto' }}>
            Tác phẩm chưa có chương nào được thiết lập kịch bản bằng sơ đồ sự kiện (node).
            Vui lòng qua tab <strong>"Sáng Tác Chương Mới"</strong> và chọn thiết lập sự kiện để tạo dữ liệu cốt truyện.
          </p>
        </div>
      ) : (
        /* The main scrollable canvas workspace */
        <div className="flow-canvas-container" ref={canvasContainerRef}>
          <div 
            className="flow-canvas-scroll-extender" 
            style={{ 
              width: `${2400 * zoom}px`, 
              height: `${canvasHeight * zoom}px`,
              position: 'relative'
            }}
          >
            <div 
              className="flow-canvas-wrapper" 
              style={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                width: '2400px',
                height: `${canvasHeight}px`,
                transform: `scale(${zoom})`,
                transformOrigin: '0 0'
              }}
            >
            
            {/* SVG Layer for Drawing Lines */}
            <svg className="flow-canvas-svg">
              <defs>
                <marker
                  id="arrow-cyan"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--color-cyan)" />
                </marker>
                <marker
                  id="arrow-purple"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#a855f7" />
                </marker>
              </defs>
              {renderConnectionLines()}
            </svg>

            {/* Chapters / Lanes Render */}
            {chaptersList.map((chap) => {
              const boundaryY = chap.laneIdx * 400;
              return (
                <React.Fragment key={chap.chapter}>
                  {/* Horizontal dotted line boundary */}
                  {chap.laneIdx > 0 && (
                    <div 
                      className="flow-lane-boundary" 
                      style={{ top: `${boundaryY}px` }} 
                    />
                  )}
                  
                  {/* Left Lane Card */}
                  <div
                    className="flow-lane-card"
                    style={{
                      left: '15px',
                      top: `${boundaryY + 20}px`
                    }}
                  >
                    <div className="flow-lane-card-chapter">Chương {chap.chapter}</div>
                    <div className="flow-lane-card-title" title={chap.title}>{chap.title}</div>
                    <div className="flow-lane-card-summary">
                      {chap.summary || 'Không có tóm tắt chương.'}
                    </div>
                    <button
                      type="button"
                      className="flow-lane-card-btn"
                      onClick={() => onReadChapter(chap.chapter)}
                    >
                      <BookOpen className="icon-xs" />
                      <span>Đọc chương này</span>
                    </button>
                  </div>
                </React.Fragment>
              );
            })}

            {/* Nodes Render */}
            {nodes.map((n) => {
              const isActive = isNodeActive(n);
              const hasSearch = !!searchTerm;
              
              // Calculate opacity and scaling if searching
              let opacity = 1.0;
              if (hasSearch) {
                opacity = isActive ? 1.0 : 0.25;
              }
              
              return (
                <div
                  key={n.id}
                  className={`flow-node-card ${hasSearch && isActive ? 'active-match' : ''}`}
                  style={{
                    left: `${n.x}px`,
                    top: `${n.y}px`,
                    width: `${n.width}px`,
                    height: `${n.height}px`,
                    opacity: opacity,
                    transition: 'opacity 0.2s ease, border-color var(--transition-fast)',
                  }}
                  onMouseDown={(e) => handleNodeMouseDown(e, n.id)}
                  onMouseUp={(e) => handleNodeMouseUp(e, n.id)}
                >
                  <div className="flow-node-title" title={n.title}>
                    {n.title}
                  </div>
                  
                  <div className="node-content-body">
                    {/* Event script/description */}
                    <div className="node-desc-section">
                      <strong>Kịch bản:</strong> {n.description}
                    </div>
                    
                    {/* Actual written novel text in this node */}
                    <div style={{ marginTop: 'auto' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Văn bản:</span>
                      {n.content ? (
                        <div className="node-text-section">
                          {n.content}
                        </div>
                      ) : (
                        <div className="node-empty-text">
                          Chưa có văn bản thực tế (AI chưa sinh hoặc chưa cập nhật).
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

          </div>
        </div>
      </div>
      )}
    </div>
  );
}
