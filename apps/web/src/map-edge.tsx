import { BaseEdge, useInternalNode, useStore, type EdgeProps } from '@xyflow/react';
import { circularEdgePath, stableEdgeOffset } from './map-edge-geometry';
const TARGET_MARKER_PADDING = 3;
export function MapEdge({ id, source, target, markerEnd, style }: EdgeProps) {
  const sourceNode = useInternalNode(source); const targetNode = useInternalNode(target);
  const identities = useStore(state => state.edges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target })));
  if (!sourceNode || !targetNode) return null;
  const sourceWidth = sourceNode.measured.width ?? sourceNode.width ?? 0; const sourceHeight = sourceNode.measured.height ?? sourceNode.height ?? 0; const targetWidth = targetNode.measured.width ?? targetNode.width ?? 0; const targetHeight = targetNode.measured.height ?? targetNode.height ?? 0;
  const sourceCenter = { x: sourceNode.internals.positionAbsolute.x + sourceWidth / 2, y: sourceNode.internals.positionAbsolute.y + sourceHeight / 2 }; const targetCenter = { x: targetNode.internals.positionAbsolute.x + targetWidth / 2, y: targetNode.internals.positionAbsolute.y + targetHeight / 2 };
  const { path } = circularEdgePath({ sourceCenter, targetCenter, sourceRadius: Math.min(sourceWidth, sourceHeight) / 2, targetRadius: Math.min(targetWidth, targetHeight) / 2, targetPadding: TARGET_MARKER_PADDING, offset: stableEdgeOffset({ id, source, target }, identities) });
  return <BaseEdge id={id} path={path} {...(markerEnd ? { markerEnd } : {})} {...(style ? { style } : {})} />;
}
