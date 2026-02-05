/**
 * OpenClaw Session Bridge v3
 * 
 * Fixed transcript parsing to match actual OpenClaw session format
 * 
 * Run: node session-bridge.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PORT = 3456;
const SESSIONS_FILE = path.join(process.env.HOME, '.openclaw/agents/main/sessions/sessions.json');
const SESSIONS_DIR = path.join(process.env.HOME, '.openclaw/agents/main/sessions');

// Parse session transcript for tool calls and user commands
async function parseSessionTranscript(sessionKey, session) {
  const sessionId = session.sessionId || session.id;
  const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.jsonl`);
  
  if (!fs.existsSync(sessionFile)) {
    console.log(`Session file not found: ${sessionFile}`);
    return { tools: [], userCommands: [] };
  }

  const tools = [];
  const userCommands = [];
  const toolStatusMap = new Map(); // Track tool status by ID
  
  try {
    const fileStream = fs.createReadStream(sessionFile);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      try {
        const msg = JSON.parse(line);
        
        // Skip non-message entries
        if (msg.type !== 'message' || !msg.message) continue;
        
        const message = msg.message;
        
        // Capture user commands (initial user messages)
        if (message.role === 'user' && message.content) {
          const content = extractTextContent(message.content);
          if (content && content.length > 10) { // Filter out short/system messages
            userCommands.push({
              timestamp: msg.timestamp || Date.now(),
              content: content.substring(0, 200), // Truncate long commands
              type: 'user_command',
              fullContent: content
            });
          }
        }
        
        // Capture tool calls from assistant messages
        if (message.role === 'assistant' && message.content && Array.isArray(message.content)) {
          message.content.forEach((item, idx) => {
            if (item.type === 'toolCall') {
              const toolId = item.id || `${sessionKey}-tool-${idx}`;
              tools.push({
                id: toolId,
                name: item.name || 'unknown',
                type: getToolType(item.name),
                arguments: item.arguments || '{}',
                status: 'running',
                timestamp: msg.timestamp || Date.now(),
                sessionKey: sessionKey
              });
              toolStatusMap.set(toolId, 'running');
            }
          });
        }
        
        // Capture tool results (mark tools as complete)
        if (message.role === 'toolResult' && message.toolCallId) {
          const tool = tools.find(t => t.id === message.toolCallId);
          if (tool) {
            tool.status = 'complete';
            tool.resultTime = msg.timestamp;
          }
          toolStatusMap.set(message.toolCallId, 'complete');
        }
      } catch (e) {
        // Skip invalid lines
      }
    }
  } catch (error) {
    console.error(`Error parsing ${sessionFile}:`, error.message);
  }

  // Update any tools that weren't marked complete
  tools.forEach(tool => {
    if (toolStatusMap.get(tool.id) === 'complete' || tool.status !== 'running') {
      tool.status = 'complete';
    }
  });

  return { tools, userCommands };
}

// Extract text content from message content array or string
function extractTextContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join(' ');
  }
  return JSON.stringify(content);
}

// Map tool names to types/icons
function getToolType(toolName) {
  if (!toolName) return 'tool';
  const name = toolName.toLowerCase();
  
  if (name.includes('web_search')) return 'search';
  if (name.includes('browser')) return 'browser';
  if (name.includes('web_fetch')) return 'fetch';
  if (name.includes('read') || name.includes('file')) return 'file';
  if (name.includes('write') || name.includes('edit')) return 'file';
  if (name.includes('exec')) return 'terminal';
  if (name.includes('image')) return 'image';
  if (name.includes('sessions')) return 'agent';
  if (name.includes('cron')) return 'schedule';
  if (name.includes('message')) return 'message';
  if (name.includes('weather')) return 'weather';
  if (name.includes('tts')) return 'audio';
  
  return 'tool';
}

// Get session status based on activity
function getSessionStatus(session) {
  if (session.abortedLastRun) return 'aborted';
  if (session.status === 'completed') return 'complete';
  
  const lastUpdate = session.updatedAt;
  if (lastUpdate) {
    const ageMs = Date.now() - lastUpdate;
    if (ageMs < 60000) return 'running'; // Active in last minute
    if (ageMs < 300000) return 'idle';   // Was active in last 5 min
  }
  
  return 'idle';
}

// Get readable name from session
function getSessionName(session, sessionKey) {
  if (session.label && session.label !== 'unnamed') return session.label;
  
  if (sessionKey?.includes(':')) {
    const parts = sessionKey.split(':');
    if (parts.length >= 3) {
      const type = parts[2];
      const shortId = parts[3]?.slice(0, 6) || '';
      const typeNames = { 'subagent': 'Sub-Agent', 'cron': 'Cron Job', 'main': 'Main' };
      return shortId ? `${typeNames[type] || type} ${shortId}` : (typeNames[type] || type);
    }
  }
  
  return session.agentId || `Session ${(session.sessionId || '').slice(0, 6)}`;
}

// Build complete graph data
async function buildGraphData() {
  if (!fs.existsSync(SESSIONS_FILE)) {
    return { nodes: [], links: [], commands: [] };
  }

  const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
  const nodes = [{ id: 'main', name: 'Cosmo', type: 'main', status: 'running' }];
  const links = [];
  const allCommands = [];

  for (const [sessionKey, session] of Object.entries(data)) {
    if (sessionKey === 'agent:main:main') continue;
    
    const status = getSessionStatus(session);
    const isActive = status === 'running';
    
    // Add sub-agent node
    nodes.push({
      id: sessionKey,
      name: getSessionName(session, sessionKey),
      type: sessionKey.includes('cron') ? 'cron' : 'sub-agent',
      status: isActive ? 'running' : status,
      updatedAt: session.updatedAt
    });

    links.push({ source: 'main', target: sessionKey, active: isActive });

    // Parse transcript for tools and commands
    const { tools, userCommands } = await parseSessionTranscript(sessionKey, session);
    
    // Add tool nodes
    tools.forEach(tool => {
      nodes.push({
        id: tool.id,
        name: tool.name,
        type: 'tool',
        toolType: tool.type,
        status: tool.status,
        parentSession: sessionKey
      });
      links.push({ source: sessionKey, target: tool.id, active: tool.status === 'running' });
    });

    // Track commands
    userCommands.forEach(cmd => {
      allCommands.push({
        ...cmd,
        sessionKey,
        sessionName: getSessionName(session, sessionKey),
        status: status === 'running' ? 'running' : 'complete'
      });
    });
  }

  // Sort commands by timestamp, newest first
  allCommands.sort((a, b) => b.timestamp - a.timestamp);

  return { nodes, links, commands: allCommands };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/api/sessions') {
    try {
      const graphData = await buildGraphData();
      res.writeHead(200);
      res.end(JSON.stringify(graphData));
    } catch (error) {
      console.error('Error building graph:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
  } else if (req.url === '/api/commands') {
    // Return command history
    try {
      const { commands } = await buildGraphData();
      res.writeHead(200);
      res.end(JSON.stringify(commands));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
  } else if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`🔌 Session Bridge v3 running on http://localhost:${PORT}`);
  console.log(`📁 Reading from: ${SESSIONS_FILE}`);
  console.log('');
  console.log('Endpoints:');
  console.log(`  GET http://localhost:${PORT}/api/sessions - Full graph data with tools`);
  console.log(`  GET http://localhost:${PORT}/api/commands - Command history`);
  console.log(`  GET http://localhost:${PORT}/health - Health check`);
});

// Watch for file changes and log
fs.watchFile(SESSIONS_FILE, { interval: 1000 }, () => {
  console.log('📄 Sessions file updated');
});