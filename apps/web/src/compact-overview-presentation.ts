/** Chooses the initial disclosure density for compact, grouped overview panels. */
export function initialCompactOverviewExpandedGroupIds(
  groups: readonly { id: string; count: number }[],
): Set<string> {
  if (groups.length === 1 && groups[0]!.count <= 4) return new Set([groups[0]!.id]);
  if (groups.length === 2 && groups.every((group) => group.count <= 4) && groups[0]!.count + groups[1]!.count <= 6) {
    return new Set(groups.map((group) => group.id));
  }
  return new Set();
}
