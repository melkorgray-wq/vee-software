import { Background, ReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Link } from '../router';

const nodes: Node[] = [
  { id: 'fixture-a', position: { x: 0, y: 0 }, data: { label: 'Renderer fixture A' } },
  { id: 'fixture-b', position: { x: 260, y: 120 }, data: { label: 'Renderer fixture B' } },
];
const edges: Edge[] = [{ id: 'fixture-edge', source: 'fixture-a', target: 'fixture-b' }];

export function RendererSpike() {
  return (
    <main>
      <p className="eyebrow">Technical architecture spike</p>
      <h1>Read-only renderer check</h1>
      <p>This neutral fixture validates rendering only; it is not domain data.</p>
      <div className="renderer" aria-label="Read-only renderer fixture">
        <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false}
          elementsSelectable={false} nodesFocusable={false} edgesFocusable={false}>
          <Background />
        </ReactFlow>
      </div>
      <Link to="/">Return home</Link>
    </main>
  );
}
