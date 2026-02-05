import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { Cpu, Activity, Settings, Search, Globe, FileText, Terminal, Image, Mic, Calendar, MessageSquare } from 'lucide-react';
import { renderToString } from 'react-dom/server';

const DEFAULT_TOOL_ICONS = {
  search: Search,
  browser: Globe,
  file: FileText,
  terminal: Terminal,
  image: Image,
  audio: Mic,
  agent: Cpu,
  schedule: Calendar,
  message: MessageSquare,
  tool: Settings
};

const GraphComponent = ({ data, toolIcons = DEFAULT_TOOL_ICONS }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const simulationRef = useRef(null);
  const nodeMapRef = useRef(new Map()); // Persist node positions
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Get icon for node
  const getNodeIcon = (node) => {
    let IconComponent;
    
    if (node.type === 'main') {
      IconComponent = Cpu;
    } else if (node.type === 'sub-agent' || node.type === 'cron') {
      IconComponent = Activity;
    } else if (node.type === 'tool') {
      IconComponent = toolIcons[node.toolType] || toolIcons.tool || Settings;
    } else {
      IconComponent = Settings;
    }
    
    const color = node.status === 'running' ? '#00ffff' : '#f59e0b';
    const size = node.type === 'main' ? 24 : node.type === 'sub-agent' ? 20 : 16;
    
    const svgString = renderToString(<IconComponent size={size} color={color} />);
    return `data:image/svg+xml;base64,${btoa(svgString)}`;
  };

  // Get node size
  const getNodeRadius = (node) => {
    if (node.type === 'main') return 40;
    if (node.type === 'sub-agent' || node.type === 'cron') return 30;
    return 20;
  };

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Update graph - use D3 update pattern to preserve positions
  const updateGraph = useCallback(() => {
    if (!svgRef.current || dimensions.width === 0) return;

    const svg = d3.select(svgRef.current);
    const width = dimensions.width;
    const height = dimensions.height;

    svg.attr('width', width).attr('height', height);

    // Get or create groups
    let linkGroup = svg.select('.links');
    let nodeGroup = svg.select('.nodes');
    let particleGroup = svg.select('.particles');
    
    if (linkGroup.empty()) {
      linkGroup = svg.append('g').attr('class', 'links');
      particleGroup = svg.append('g').attr('class', 'particles');
      nodeGroup = svg.append('g').attr('class', 'nodes');
    }

    // Prepare nodes with preserved positions
    const nodes = data.nodes.map(node => {
      const existing = nodeMapRef.current.get(node.id);
      if (existing) {
        // Preserve position, update other properties
        return { ...existing, ...node };
      }
      // New node - initialize at center
      return {
        ...node,
        x: width / 2 + (Math.random() - 0.5) * 100,
        y: height / 2 + (Math.random() - 0.5) * 100
      };
    });

    // Update node map
    nodeMapRef.current.clear();
    nodes.forEach(n => nodeMapRef.current.set(n.id, n));

    // Prepare links
    const links = data.links.map(l => ({
      source: typeof l.source === 'string' ? l.source : l.source.id,
      target: typeof l.target === 'string' ? l.target : l.target.id,
      active: l.active
    }));

    // Update simulation
    if (!simulationRef.current) {
      simulationRef.current = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(d => {
          if (d.source?.type === 'sub-agent' && d.target?.type === 'tool') return 60;
          return 120;
        }))
        .force('charge', d3.forceManyBody().strength(d => {
          if (d.type === 'tool') return -100;
          return -400;
        }))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(d => getNodeRadius(d) + 10));
    } else {
      simulationRef.current.nodes(nodes);
      simulationRef.current.force('link').links(links);
      simulationRef.current.alpha(0.3).restart();
    }

    // LINKS - D3 update pattern
    const linkSelection = linkGroup
      .selectAll('line')
      .data(links, d => `${d.source.id || d.source}-${d.target.id || d.target}`);

    linkSelection.exit().remove();

    linkSelection.enter()
      .append('line')
      .attr('stroke', d => d.active ? '#00ffff' : '#333')
      .attr('stroke-width', d => d.active ? 2 : 1)
      .attr('stroke-opacity', d => d.active ? 0.8 : 0.3)
      .merge(linkSelection)
      .attr('stroke', d => d.active ? '#00ffff' : '#333')
      .attr('stroke-width', d => d.active ? 2 : 1)
      .attr('stroke-opacity', d => d.active ? 0.8 : 0.3);

    // NODES - D3 update pattern
    const nodeSelection = nodeGroup
      .selectAll('g.node')
      .data(nodes, d => d.id);

    // Exit
    nodeSelection.exit()
      .transition().duration(300)
      .attr('opacity', 0)
      .remove();

    // Enter
    const nodeEnter = nodeSelection.enter()
      .append('g')
      .attr('class', d => `node ${d.status === 'running' ? 'pulsing' : ''}`)
      .attr('opacity', 0)
      .call(d3.drag()
        .on('start', (e, d) => {
          if (!e.active) simulationRef.current.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end', (e, d) => {
          if (!e.active) simulationRef.current.alphaTarget(0);
          d.fx = null; d.fy = null;
        }));

    // Add glow ring
    nodeEnter.append('circle')
      .attr('class', 'glow-ring');

    // Add main circle
    nodeEnter.append('circle')
      .attr('class', 'main-circle');

    // Add icon
    nodeEnter.append('image')
      .attr('class', 'node-icon');

    // Add label
    nodeEnter.append('text')
      .attr('class', 'node-label');

    // Enter + Update
    const nodeMerge = nodeEnter.merge(nodeSelection);
    
    nodeMerge
      .transition().duration(300)
      .attr('opacity', 1)
      .attr('class', d => `node ${d.status === 'running' ? 'pulsing' : ''}`);

    // Update glow ring - ALL nodes get subtle ring, running ones pulse
    nodeMerge.select('.glow-ring')
      .attr('r', d => getNodeRadius(d) + (d.status === 'running' ? 10 : 6))
      .attr('fill', 'none')
      .attr('stroke', d => {
        if (d.status === 'running') return '#00ffff';
        if (d.type === 'tool') return '#00ffff'; // Tools always cyan border
        return 'transparent';
      })
      .attr('stroke-width', d => d.status === 'running' ? 3 : 1)
      .attr('opacity', d => d.status === 'running' ? 0.8 : 0.3)
      .attr('class', d => `glow-ring ${d.status === 'running' ? 'pulse-animation' : ''}`);

    // Update main circle
    nodeMerge.select('.main-circle')
      .attr('r', d => getNodeRadius(d))
      .attr('fill', d => d.type === 'tool' ? '#0f0f0f' : '#1a1a1a')
      .attr('stroke', d => {
        if (d.status === 'running') return '#00ffff';
        if (d.status === 'complete') return '#22c55e';
        return '#f59e0b';
      })
      .attr('stroke-width', d => d.type === 'tool' ? 1 : 2);

    // Update icon
    const iconSize = d => d.type === 'main' ? 24 : d.type === 'sub-agent' ? 20 : 14;
    nodeMerge.select('.node-icon')
      .attr('xlink:href', d => getNodeIcon(d))
      .attr('x', d => -iconSize(d) / 2)
      .attr('y', d => -iconSize(d) / 2)
      .attr('width', d => iconSize(d))
      .attr('height', d => iconSize(d));

    // Update label
    nodeMerge.select('.node-label')
      .text(d => d.name)
      .attr('dy', d => getNodeRadius(d) + 20)
      .attr('text-anchor', 'middle')
      .attr('fill', d => d.type === 'tool' ? '#666' : '#888')
      .attr('font-size', d => d.type === 'tool' ? '9px' : '11px')
      .attr('font-family', 'monospace');

    // Simulation tick
    simulationRef.current.on('tick', () => {
      // Keep in bounds
      nodes.forEach(d => {
        const r = getNodeRadius(d);
        d.x = Math.max(r, Math.min(width - r, d.x));
        d.y = Math.max(r, Math.min(height - r, d.y));
      });

      linkGroup.selectAll('line')
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      nodeMerge.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Particles on active links
    particleGroup.selectAll('*').remove();
    const activeLinks = links.filter(l => l.active);
    activeLinks.forEach((link, i) => {
      const particle = particleGroup
        .append('circle')
        .attr('r', 3)
        .attr('fill', '#00ffff')
        .attr('filter', 'drop-shadow(0 0 4px #00ffff)');

      const animate = () => {
        if (!link.source?.x) return;
        particle
          .attr('cx', link.source.x)
          .attr('cy', link.source.y)
          .attr('opacity', 0)
          .transition()
          .duration(1000)
          .ease(d3.easeLinear)
          .attr('opacity', 1)
          .attrTween('transform', () => t => {
            const x = link.source.x + (link.target.x - link.source.x) * t;
            const y = link.source.y + (link.target.y - link.source.y) * t;
            return `translate(${x - link.source.x},${y - link.source.y})`;
          })
          .on('end', animate);
      };
      setTimeout(animate, i * 200);
    });

  }, [data, dimensions, toolIcons]);

  useEffect(() => {
    updateGraph();
  }, [updateGraph]);

  useEffect(() => () => simulationRef.current?.stop(), []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
};

export default GraphComponent;