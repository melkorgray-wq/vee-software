export interface Point { x: number; y: number }
export interface EdgeIdentity { id: string; source: string; target: string }
const EPSILON = 1e-6;
const CURVE_OFFSET = 28;
function directionBetween(source: Point, target: Point): Point { const dx = target.x - source.x; const dy = target.y - source.y; const length = Math.hypot(dx, dy); return length > EPSILON ? { x: dx / length, y: dy / length } : { x: 1, y: 0 }; }
export function circleEdgePoints(sourceCenter: Point, targetCenter: Point, sourceRadius: number, targetRadius: number, targetPadding = 0) { const direction = directionBetween(sourceCenter, targetCenter); return { source: { x: sourceCenter.x + direction.x * sourceRadius, y: sourceCenter.y + direction.y * sourceRadius }, target: { x: targetCenter.x - direction.x * (targetRadius + targetPadding), y: targetCenter.y - direction.y * (targetRadius + targetPadding) } }; }
export function stableEdgeOffset(edge: EdgeIdentity, edges: readonly EdgeIdentity[]): number {
  const same = edges.filter(candidate => candidate.source === edge.source && candidate.target === edge.target).sort((a, b) => a.id.localeCompare(b.id));
  const reverse = edges.filter(candidate => candidate.source === edge.target && candidate.target === edge.source);
  const index = same.findIndex(candidate => candidate.id === edge.id);
  if (reverse.length) return CURVE_OFFSET + index * CURVE_OFFSET;
  if (same.length > 1) return (index - (same.length - 1) / 2) * CURVE_OFFSET;
  return 0;
}
export function circularEdgePath(input: { sourceCenter: Point; targetCenter: Point; sourceRadius: number; targetRadius: number; targetPadding?: number; offset?: number }): { source: Point; target: Point; control?: Point; path: string } {
  const points = circleEdgePoints(input.sourceCenter, input.targetCenter, input.sourceRadius, input.targetRadius, input.targetPadding); const offset = input.offset ?? 0;
  if (Math.abs(offset) < EPSILON) return { ...points, path: `M ${points.source.x} ${points.source.y} L ${points.target.x} ${points.target.y}` };
  const direction = directionBetween(input.sourceCenter, input.targetCenter); const control = { x: (points.source.x + points.target.x) / 2 - direction.y * offset, y: (points.source.y + points.target.y) / 2 + direction.x * offset };
  return { ...points, control, path: `M ${points.source.x} ${points.source.y} Q ${control.x} ${control.y} ${points.target.x} ${points.target.y}` };
}
