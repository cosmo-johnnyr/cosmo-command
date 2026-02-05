import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

const PASSWORD = 'cosmocommand1';
const AUTH_KEY = 'cosmo_auth';
const API_URL = 'https://geology-jose-joined-magazine.trycloudflare.com';
const POLL_INTERVAL = 5000; // Poll every 5 seconds

// Mock data for demo/fallback mode
const generateMockData = () => {
  const now = Date.now();
  return {
    nodes: [
      { id: 'main', name: 'Cosmo', type: 'main', status: 'running' },
      { id: 'agent-1', name: 'Research Agent', type: 'sub-agent', status: 'running', parentSession: 'main' },
      { id: 'agent-2', name: 'Code Agent', type: 'sub-agent', status: 'running', parentSession: 'main' },
    ],
    links: [
      { source: 'main', target: 'agent-1', active: true },
      { source: 'main', target: 'agent-2', active: true },
    ],
    commands: [
      { id: 1, content: 'Demo mode - connect to real-time API', sessionKey: 'agent-1', sessionName: 'System', status: 'running', timestamp: now },
    ]
  };
};

// Password Gate Component
const PasswordGate = ({ onAuth }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === PASSWORD) {
      localStorage.setItem(AUTH_KEY, 'true');
      onAuth(true);
    } else {
      setError('Incorrect password');
    }
  };

  return (
    <div className="password-gate">
      <div className="password-container">
        <div className="password-logo">⚡</div>
        <h1 className="password-title">COSMO COMMAND</h1>
        <p className="password-subtitle">Mobile Access Portal</p>
        
        <form onSubmit={handleSubmit} className="password-form">
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            placeholder="Enter access code"
            className="password-input"
            autoFocus
          />
          {error && <div className="password-error">{error}</div>}
          <button type="submit" className="password-submit">
            ACCESS SYSTEM
          </button>
        </form>
      </div>
    </div>
  );
};

// Simple Graph Visualization
const SimpleGraph = ({ data }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    
    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    if (!data.nodes || data.nodes.length === 0) return;
    
    // Position nodes in a circle
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;
    
    const nodePositions = {};
    data.nodes.forEach((node, i) => {
      if (node.type === 'main') {
        nodePositions[node.id] = { x: centerX, y: centerY };
      } else {
        const angle = (i / (data.nodes.length - 1)) * Math.PI * 2 - Math.PI / 2;
        nodePositions[node.id] = {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius
        };
      }
    });
    
    // Draw links
    data.links.forEach(link => {
      const source = nodePositions[link.source];
      const target = nodePositions[link.target];
      if (source && target) {
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = link.active ? 'rgba(0, 255, 255, 0.6)' : 'rgba(245, 158, 11, 0.3)';
        ctx.lineWidth = link.active ? 2 : 1;
        ctx.stroke();
      }
    });
    
    // Draw nodes
    data.nodes.forEach(node => {
      const pos = nodePositions[node.id];
      if (!pos) return;
      
      const isRunning = node.status === 'running';
      const size = node.type === 'main' ? 25 : 15;
      
      // Glow
      if (isRunning) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size + 8, 0, Math.PI * 2);
        ctx.fillStyle = node.type === 'main' ? 'rgba(0, 255, 255, 0.2)' : 'rgba(245, 158, 11, 0.2)';
        ctx.fill();
      }
      
      // Node circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      ctx.fillStyle = '#161616';
      ctx.fill();
      ctx.strokeStyle = isRunning ? '#00ffff' : '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Label
      ctx.fillStyle = '#fff';
      ctx.font = '11px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.fillText(node.name, pos.x, pos.y + size + 18);
    });
    
  }, [data]);
  
  return <canvas ref={canvasRef} className="graph-canvas" />;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [graphData, setGraphData] = useState(generateMockData());
  const [logs, setLogs] = useState([{ id: 1, time: new Date().toLocaleTimeString(), message: 'System initialized - Connecting to API...', type: 'info' }]);
  const [activeAgents, setActiveAgents] = useState(0);
  const [activeTools, setActiveTools] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Check auth on mount
  useEffect(() => {
    const auth = localStorage.getItem(AUTH_KEY);
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch real data from API
  const fetchData = useCallback(async () => {
    if (isDemoMode) return;
    
    try {
      const response = await fetch(`${API_URL}/api/sessions`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      setGraphData(data);
      setIsConnected(true);
      
      // Count active agents and tools
      const agents = data.nodes?.filter(n => n.type === 'sub-agent' || n.type === 'cron').length || 0;
      const tools = data.nodes?.filter(n => n.type === 'tool' && n.status === 'running').length || 0;
      setActiveAgents(agents);
      setActiveTools(tools);
      
      const now = new Date();
      setLogs(prev => [{
        id: Date.now(),
        time: now.toLocaleTimeString(),
        message: `Live: ${agents} agents, ${tools} tools`,
        type: 'info'
      }, ...prev].slice(0, 20));
      
    } catch (error) {
      console.error('API fetch failed:', error);
      setIsConnected(false);
      
      const now = new Date();
      setLogs(prev => [{
        id: Date.now(),
        time: now.toLocaleTimeString(),
        message: 'API unreachable - demo mode',
        type: 'error'
      }, ...prev].slice(0, 20));
      
      // Fall back to demo mode
      if (!isDemoMode) {
        setIsDemoMode(true);
        setGraphData(generateMockData());
      }
    }
  }, [isDemoMode]);

  // Poll for real-time updates
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <PasswordGate onAuth={setIsAuthenticated} />;
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <span className="logo-icon">⚡</span>
          <h1 className="title">COSMO COMMAND</h1>
          <span className={`status-badge ${isConnected ? 'online' : 'offline'}`}>
            {isConnected ? 'LIVE' : (isDemoMode ? 'DEMO' : 'OFFLINE')}
          </span>
        </div>
        <div className="header-right">
          <button className="icon-btn" onClick={() => setShowPanel(!showPanel)}>
            {showPanel ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Graph */}
        <div className="graph-container">
          <SimpleGraph data={graphData} />
          
          {/* Stats */}
          <div className="stats-overlay">
            <div className="stat-item">
              <span className="stat-label">AGENTS</span>
              <span className="stat-value cyan">{activeAgents}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">TOOLS</span>
              <span className="stat-value amber">{activeTools}</span>
            </div>
          </div>
        </div>

        {/* Side Panel */}
        {showPanel && (
          <div className="side-panel">
            <div className="panel-section">
              <div className="panel-header">
                <span>COMMANDS</span>
              </div>
              <div className="commands-container">
                {graphData.commands.map(cmd => (
                  <div key={cmd.id} className="command-item">
                    <div className="command-text">{cmd.content}</div>
                    <div className="command-meta">
                      <span className="command-agent">{cmd.sessionName}</span>
                      <span className={`command-status ${cmd.status}`}>
                        {cmd.status === 'running' ? '●' : '✓'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel-section logs-section">
              <div className="panel-header">
                <span>LOGS</span>
              </div>
              <div className="logs-container">
                {logs.map(log => (
                  <div key={log.id} className="log-entry">
                    <span className="log-time">{log.time}</span>
                    <span className={`log-type ${log.type}`}>●</span>
                    <span className="log-message">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel-footer">
              <button className="logout-btn" onClick={handleLogout}>
                LOGOUT
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
