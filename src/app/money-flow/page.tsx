'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import AppShell from '../components/AppShell';
import { sankey, sankeyLinkHorizontal, sankeyCenter } from 'd3-sankey';

const fmt = (v: number) => `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function SankeyDiagram({ data, width, height }: { data: any; width: number; height: number }) {
  const sankeyGenerator = useMemo(() => {
    return (sankey as any)()
      .nodeId((d: any) => d.id)
      .nodeWidth(20)
      .nodePadding(40)
      .nodeAlign(sankeyCenter)
      .extent([[20, 20], [width - 20, height - 20]]);
  }, [width, height]);

  const { nodes, links } = useMemo(() => {
    try {
      if (!data || !data.nodes || !data.links || data.nodes.length === 0) {
        return { nodes: [], links: [] };
      }
      return sankeyGenerator({
        nodes: data.nodes.map((d: any) => ({ ...d })),
        links: data.links.map((d: any) => ({ ...d }))
      });
    } catch (e) {
      console.error(e);
      return { nodes: [], links: [] };
    }
  }, [data, sankeyGenerator]);

  if (nodes.length === 0) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No data to display diagram.</div>;
  }

  // Get color based on group
  const getColor = (group: string) => {
    switch(group) {
      case 'source': return '#3b82f6';
      case 'gateway': return '#8b5cf6';
      case 'settlement': return '#10b981';
      case 'destination': return '#06b6d4';
      case 'deduction': return '#f59e0b';
      case 'exception': return '#ef4444';
      default: return '#64748b';
    }
  };

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <g>
        {links.map((link: any, i: number) => (
          <path
            key={`link-${i}`}
            d={sankeyLinkHorizontal()(link) || ''}
            style={{
              fill: 'none',
              stroke: typeof link.source === 'object' ? getColor(link.source.group) : '#aaa',
              strokeOpacity: 0.3,
              strokeWidth: Math.max(1, link.width || 0),
              transition: 'all 0.3s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.strokeOpacity = '0.6'; }}
            onMouseOut={(e) => { e.currentTarget.style.strokeOpacity = '0.3'; }}
          >
            <title>{`${typeof link.source === 'object' ? link.source.id : link.source} → ${typeof link.target === 'object' ? link.target.id : link.target}\n${fmt(link.value)}`}</title>
          </path>
        ))}
      </g>
      <g>
        {nodes.map((node: any, i: number) => (
          <g key={`node-${i}`} transform={`translate(${node.x0},${node.y0})`}>
            <rect
              height={(node.y1 || 0) - (node.y0 || 0)}
              width={sankeyGenerator.nodeWidth()}
              fill={getColor(node.group)}
              style={{ stroke: '#fff', strokeWidth: 1, rx: 4, ry: 4 }}
            >
              <title>{`${node.id}\n${fmt(node.value || 0)}`}</title>
            </rect>
            <text
              x={node.x0 && node.x0 < width / 2 ? sankeyGenerator.nodeWidth() + 8 : -8}
              y={((node.y1 || 0) - (node.y0 || 0)) / 2}
              dy="0.35em"
              textAnchor={node.x0 && node.x0 < width / 2 ? 'start' : 'end'}
              fill="#fff"
              style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)', pointerEvents: 'none' }}
            >
              {node.id}
            </text>
            <text
              x={node.x0 && node.x0 < width / 2 ? sankeyGenerator.nodeWidth() + 8 : -8}
              y={((node.y1 || 0) - (node.y0 || 0)) / 2 + 16}
              textAnchor={node.x0 && node.x0 < width / 2 ? 'start' : 'end'}
              fill="var(--text-muted)"
              style={{ fontSize: 11, fontFamily: 'var(--font-mono)', pointerEvents: 'none' }}
            >
              {fmt(node.value || 0)}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

function MoneyFlowContent() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/money-flow');
      const json = await res.json();
      setData(json);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="card" style={{ height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-muted)' }}>Loading flow data...</div>
      </div>
    );
  }

  return (
    <>
      <div className="section-header">
        <div>
          <h2 className="section-title">Money Flow Diagram</h2>
          <div className="section-subtitle">Visualizing funds from source to settlement</div>
        </div>
      </div>
      
      <div className="card" style={{ padding: '32px', minHeight: '600px', overflowX: 'auto' }}>
        <div style={{ minWidth: '800px', width: '100%', height: '500px' }}>
          {data ? <SankeyDiagram data={data} width={1000} height={500} /> : <div>Error loading data.</div>}
        </div>
      </div>
    </>
  );
}

export default function MoneyFlowPage() {
  return (
    <AppShell currentPath="/money-flow" title="Money Flow">
      <MoneyFlowContent />
    </AppShell>
  );
}
