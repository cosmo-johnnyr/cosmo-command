#!/usr/bin/env node
/**
 * Cosmo Command Session API Server
 * 
 * Reads OpenClaw session data and exposes it via HTTP for the Cosmo Command web app.
 * Serves on localhost:3458, exposed via Cloudflare Tunnel for GitHub Pages access.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PORT = 3458;
const SESSIONS_DIR = '/Users/cosmo/.openclaw/agents/main/sessions';
const SESSIONS_FILE = path.join(SESSIONS_DIR, 'sessions.json');

// GitHub Pages domain for CORS
const ALLOWED_ORIGINS = [
  'https://cosmo-command.github.io',
  'https://cosmo-command.github.io',
  'http://localhost:3000',
  'http://localhost:3456',
  'https://*.trycloudflare.com'
];

// Simple CORS check - allows GitHub Pages and local dev
function isAllowedOrigin(origin) {
  if (!origin) return true; // Allow requests with no origin (curl, etc.)
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.match(/\.trycloudflare\.com$/)) return true;
  return false;
}

// Parse JSONL file to extract tool calls and messages
async function parseTranscript(sessionId) {
  const transcriptPath = path.join(SESSIONS_DIR, `${sessionId}.jsonl`);
  
  if (!fs.existsSync(transcriptPath)) {
    return { tools: [], messages: [], error: 'Transcript not found' };
  }

  const tools = [];
  const messages = [];
  const toolStatus = new Map(); // Track tool call -> result mapping

  try {
    const fileStream = fs.createReadStream(transcriptPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      
      try {
        const entry = JSON.parse(line);
        
        if (entry.type === 'message') {
          const msg = entry.message;
          
          // Check for tool calls in assistant messages
          if (msg.role === 'assistant' && msg.content) {
            for (const content of msg.content) {
              if (content.type === 'toolCall') {
                const toolId = content.id || `tool-${entry.id}`;
                toolStatus.set(toolId, {
                  id: toolId,
                  name: content.name,
                  arguments: content.arguments,
                  status: 'running',
                  timestamp: entry.timestamp,
                  entryId: entry.id
                });
                tools.push({
                  id: toolId,
                  name: content.name,
                  type: getToolType(content.name),
                  status: 'running',
                  timestamp: entry.timestamp,
                  arguments: content.arguments
                });
              }
            }
          }
          
          // Check for tool results
          if (msg.role === 'toolResult' && msg.toolCallId) {
            const tool = toolStatus.get(msg.toolCallId);
            if (tool) {
              tool.status = msg.isError ? 'error' : 'complete';
              // Update the tools array
              const idx = tools.findIndex(t => t.id === msg.toolCallId);
              if (idx !== -1) {
                tools[idx].status = tool.status;
                tools[idx].result = msg.content;
              }
            }
          }
          
          // Capture user commands
          if (msg.role === 'user' && msg.content) {
            const text = extractText(msg.content);
            if (text && !text.includes('[message_id:')) {
              messages.push({
                id: entry.id,
                role: 'user',
                content: text.slice(0, 200),
                timestamp: entry.timestamp
              });
            }
          }
        }
      } catch (e) {
        // Skip malformed lines
      }
    }

    return { tools, messages };
  } catch (err) {
    return { tools: [], messages: [], error: err.message };
  }
}

function getToolType(toolName) {
  const toolTypes = {
    'web_search': 'search',
    'browser': 'browser',
    'exec': 'terminal',
    'read': 'file',
    'write': 'file',
    'edit': 'file',
    'process': 'terminal',
    'message': 'message',
    'image': 'vision',
    'web_fetch': 'browser',
    'tts': 'audio',
    'canvas': 'canvas',
    'nodes': 'nodes',
    'cron': 'cron'
  };
  return toolTypes[toolName] || 'tool';
}

function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(c => c.text || '').join(' ');
  }
  return '';
}

// Build graph data from sessions
async function buildGraphData() {
  if (!fs.existsSync(SESSIONS_FILE)) {
    return { error: 'Sessions file not found', nodes: [], links: [], commands: [] };
  }

  try {
    const sessionsData = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    const nodes = [];
    const links = [];
    const commands = [];
    
    // Add main node
    nodes.push({
      id: 'main',
      name: 'Cosmo',
      type: 'main',
      status: 'running'
    });

    for (const [sessionKey, sessionInfo] of Object.entries(sessionsData)) {
      const sessionId = sessionInfo.sessionId;
      const isSubAgent = sessionKey.includes('subagent');
      const isCron = sessionKey.includes('cron');
      
      // Skip if no sessionId
      if (!sessionId) continue;
      
      // Create node for this session
      const nodeId = sessionId.slice(0, 8);
      let nodeType = 'session';
      let nodeName = sessionInfo.label || sessionKey.split(':').pop().slice(0, 8);
      
      if (sessionKey === 'agent:main:main') {
        nodeName = 'Main Agent';
      } else if (isSubAgent) {
        nodeType = 'sub-agent';
        nodeName = sessionInfo.label || `Agent ${nodeId}`;
      } else if (isCron) {
        nodeType = 'cron';
        nodeName = 'Cron Job';
      }
      
      // Check if session is active (updated in last 5 minutes)
      const isActive = Date.now() - sessionInfo.updatedAt < 5 * 60 * 1000;
      
      nodes.push({
        id: nodeId,
        name: nodeName,
        type: nodeType,
        status: isActive ? 'running' : 'idle',
        sessionKey,
        channel: sessionInfo.channel,
        model: sessionInfo.model
      });
      
      // Link to parent
      if (sessionInfo.spawnedBy) {
        const parentId = sessionInfo.spawnedBy.includes('main:main') 
          ? 'main' 
          : sessionsData[sessionInfo.spawnedBy]?.sessionId?.slice(0, 8);
        if (parentId) {
          links.push({
            source: parentId,
            target: nodeId,
            active: isActive
          });
        }
      } else if (sessionKey !== 'agent:main:main') {
        links.push({
          source: 'main',
          target: nodeId,
          active: isActive
        });
      }
      
      // Parse transcript for tools and commands
      const transcript = await parseTranscript(sessionId);
      
      // Add tool nodes
      const recentTools = transcript.tools.slice(-8); // Limit to 8 most recent
      recentTools.forEach((tool, idx) => {
        const toolNodeId = `${nodeId}-tool-${idx}`;
        nodes.push({
          id: toolNodeId,
          name: tool.name,
          type: 'tool',
          toolType: tool.type,
          status: tool.status,
          parentSession: nodeId
        });
        links.push({
          source: nodeId,
          target: toolNodeId,
          active: tool.status === 'running'
        });
      });
      
      // Add recent commands
      transcript.messages.slice(-5).reverse().forEach((msg, idx) => {
        commands.push({
          id: `${nodeId}-cmd-${idx}`,
          content: msg.content,
          sessionKey,
          sessionName: nodeName,
          status: 'complete',
          timestamp: new Date(msg.timestamp).getTime()
        });
      });
    }
    
    return { nodes, links, commands };
  } catch (err) {
    console.error('Error building graph:', err);
    return { error: err.message, nodes: [], links: [], commands: [] };
  }
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  
  // CORS headers
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', time: Date.now() }));
    return;
  }

  // Main API endpoint
  if (req.url === '/api/sessions' || req.url === '/') {
    const data = await buildGraphData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`🌌 Cosmo Command Session API running on http://localhost:${PORT}`);
  console.log(`📊 Sessions directory: ${SESSIONS_DIR}`);
  console.log(`🔒 CORS restricted to GitHub Pages and Cloudflare Tunnel domains`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.close(() => process.exit(0));
});
