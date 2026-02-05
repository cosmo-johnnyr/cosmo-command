# 🌌 COSMO COMMAND

A high-fidelity, interactive React-based web app that visualizes agentic workflows in real-time using D3.js force-directed graphs.

![Cyber-Industrial Visualization](https://img.shields.io/badge/Theme-Cyber--Industrial-black?style=flat-square&color=000000&labelColor=00ffff)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)
![D3.js](https://img.shields.io/badge/D3.js-7-F9A03C?style=flat-square&logo=d3.js&logoColor=white)

## ✨ Features

- **Dark-mode Cyber-Industrial Theme** — Deep charcoal/black with neon cyan & amber accents
- **Real-time D3.js Force Graph** — Draggable nodes with smooth physics simulation
- **Live Gateway Integration** — Polls gateway API every 3 seconds for live agent data
- **Dynamic Node Spawning** — Tool calls appear/disappear in real-time without refresh
- **Pulsing Animations** — Active nodes glow with CSS keyframe animations
- **Data Flow Particles** — Marching ants & flowing particle effects on active links
- **Framer Motion UI** — Smooth panel transitions and micro-interactions

## 🎨 Visual Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚡ COSMO COMMAND                          [ONLINE]  ⚙️  📋     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────┐         ┌──────────┐                              │
│   │  AGENTS │   ● ●   │  TOOLS   │      ┌───────────────────┐  │
│   │    3    │         │    1     │      │   SYSTEM LOGS     │  │
│   └─────────┘         └──────────┘      │ 12:26:45 ● Synced │  │
│                                         │ 12:26:42 ● Spawn  │  │
│              ╭───────╮                  │ 12:26:39 ● Ready  │  │
│             ╱  MAIN   ╲                 └───────────────────┘  │
│            │   🤖      │                                       │
│             ╲    ●   ╱                                         │
│              ╰──┬─┬──╯                                         │
│                 │ │                                            │
│         ┌───────┘ └───────┐                                    │
│         ▼                 ▼                                    │
│    ┌─────────┐       ┌─────────┐                               │
│    │ Agent-1 │       │ Agent-2 │                               │
│    │   💡    │       │   🔧    │                               │
│    └────┬────┘       └─────────┘                               │
│         │                                                      │
│         ▼                                                      │
│    ┌─────────┐                                                 │
│    │  Tool   │                                                 │
│    │   ⚙️    │                                                 │
│    └─────────┘                                                 │
│                                                                 │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ Grid Background ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm start
```

The app will open at `http://localhost:3000`

## 🔌 Gateway Integration

To connect to a live OpenClaw gateway, update the fetch URL in `App.js`:

```javascript
const response = await fetch('http://YOUR_GATEWAY:PORT/api/sessions');
```

The app expects JSON in this format:
```json
{
  "nodes": [
    { "id": "main", "name": "Cosmo", "type": "main", "status": "running" },
    { "id": "agent-1", "name": "Researcher", "type": "sub-agent", "status": "idle" }
  ],
  "links": [
    { "source": "main", "target": "agent-1", "active": true }
  ]
}
```

## 🎛️ Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `POLL_INTERVAL` | 3000ms | Gateway polling frequency |
| `forceManyBody` | -300 | Repulsion between nodes |
| `forceLink` | 100 | Link distance |

## 🧪 Demo Mode

If the gateway is unavailable, the app automatically switches to **Demo Mode** with simulated dynamic data:
- Random tool call spawning
- Status changes
- Particle effects

## 📁 Project Structure

```
cosmo-command/
├── public/
│   └── index.html          # HTML entry
├── src/
│   ├── App.js              # Main component + gateway polling
│   ├── App.css             # Cyber-industrial theme
│   ├── GraphComponent.js   # D3.js force graph
│   └── index.js            # React entry
└── package.json
```

## 🎯 Key Technical Decisions

1. **D3 + React Integration** — D3 handles the SVG/physics, React manages state
2. **Ref-based Node Management** — Prevents unnecessary re-renders during simulation
3. **Cleanup on Unmount** — Simulation properly stopped to prevent memory leaks
4. **Immutable Data Merging** — New nodes get random positions; existing nodes keep theirs
5. **CSS Keyframes for Pulse** — GPU-accelerated animations, no JS overhead

## 🛡️ Optimizations

- ✓ Simulation only restarts with `alpha(0.3)` on data updates
- ✓ Nodes maintain positions between polls (no jumping)
- ✓ Particles cleaned up before creating new ones
- ✓ Logs limited to 50 entries (circular buffer)
- ✓ Transitions use `d3.easeLinear` for consistent performance

## 🎨 Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--cyan` | `#00ffff` | Running state, primary accent |
| `--amber` | `#f59e0b` | Idle state, secondary accent |
| `--bg-primary` | `#0a0a0a` | Main background |
| `--bg-secondary` | `#111111` | Panels, headers |

---

*Built with ⚡ by Cosmo*