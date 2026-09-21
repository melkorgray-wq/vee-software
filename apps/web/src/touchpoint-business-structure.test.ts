import { describe, expect, it } from 'vitest';
import type { MapDocument } from '@vee/domain';
import { initialCompactOverviewExpandedGroupIds } from './compact-overview-presentation';
import { deriveTouchpointBusinessStructure, deriveTouchpointChildrenCandidates, deriveTouchpointReassignTargets } from './touchpoint-business-structure';

describe('initial compact overview presentation density', () => {
  const expandedFor = (counts: number[]) => [...initialCompactOverviewExpandedGroupIds(counts.map((count, index) => ({ id: `group-${index}`, count })))];

  it.each([
    [[], []],
    [[0], ['group-0']],
    [[1], ['group-0']],
    [[4], ['group-0']],
    [[5], []],
    [[2, 4], ['group-0', 'group-1']],
    [[3, 4], []],
    [[1, 1, 1], []],
    [[3, 3], ['group-0', 'group-1']],
  ])('chooses initial expansion for counts %j', (counts, expected) => {
    expect(expandedFor(counts)).toEqual(expected);
  });
});

function fixture(): MapDocument {
  return {
    id: 'map', title: 'Map', views: [], placements: [], epistemicAnnotations: [],
    productJobIntents: [], offerJobSelections: [], offerFinancialIntents: [], touchpointJobSelections: [], touchpointFinancialSelections: [],
    touchpointContainers: [{ id: 'web', title: 'Website' }],
    entities: [
      { id: 'p-a', kind: 'product', title: 'Growth' }, { id: 'p-b', kind: 'product', title: 'Other' },
      { id: 'o-b', kind: 'offer', title: 'Beta' }, { id: 'o-a', kind: 'offer', title: 'Alpha' },
      { id: 'parent', kind: 'touchpoint', title: 'Front Page', locatedInId: 'web' },
      { id: 'touch', kind: 'touchpoint', title: 'Pricing', locatedInId: 'web', url: 'https://example.com/pricing' },
      { id: 'child', kind: 'touchpoint', title: 'FAQ' }, { id: 'grandchild', kind: 'touchpoint', title: 'Answer' },
      { id: 'other', kind: 'touchpoint', title: 'About', locatedInId: 'web' },
    ],
    relationships: [
      { id: 'pa', kind: 'product_packaged_as_offer', productId: 'p-a', offerId: 'o-a' },
      { id: 'pb', kind: 'product_packaged_as_offer', productId: 'p-a', offerId: 'o-b' },
      { id: 'at', kind: 'offer_presented_at_touchpoint', offerId: 'o-a', touchpointId: 'touch' },
      { id: 'bt', kind: 'offer_presented_at_touchpoint', offerId: 'o-b', touchpointId: 'touch' },
      { id: 'ao', kind: 'offer_presented_at_touchpoint', offerId: 'o-a', touchpointId: 'other' },
      { id: 'bo', kind: 'offer_presented_at_touchpoint', offerId: 'o-b', touchpointId: 'other' },
      { id: 'pt', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'parent', childTouchpointId: 'touch' },
      { id: 'tc', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'touch', childTouchpointId: 'child' },
      { id: 'cg', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'child', childTouchpointId: 'grandchild' },
    ],
  };
}

describe('Touchpoint Business structure read model', () => {
  it('Touchpoint Business structure resolves Product Offer ancestry', () => {
    const result = deriveTouchpointBusinessStructure(fixture(), 'touch')!;
    expect(result.ancestryBranches[0]).toMatchObject({ product: { title: 'Growth' }, offer: { title: 'Alpha' }, touchpoint: { title: 'Pricing' } });
  });

  it('multiple Offers from one Product remain distinct ancestry branches', () => {
    expect(deriveTouchpointBusinessStructure(fixture(), 'touch')!.ancestryBranches.map(({ product, offer }) => [product.title, offer.title])).toEqual([['Growth', 'Alpha'], ['Growth', 'Beta']]);
  });

  it('Offers from different Products preserve separate ancestry', () => {
    const document = fixture();
    (document.relationships.find(relation => relation.id === 'pb') as Extract<MapDocument['relationships'][number], { kind: 'product_packaged_as_offer' }>).productId = 'p-b';
    expect(deriveTouchpointBusinessStructure(document, 'touch')!.ancestryBranches.map(branch => branch.product.title)).toEqual(['Growth', 'Other']);
  });

  it('Located in resolves independently from parent Touchpoint', () => {
    const result = deriveTouchpointBusinessStructure(fixture(), 'touch')!;
    expect([result.container?.title, result.parent?.title]).toEqual(['Website', 'Front Page']);
  });

  it('direct parent and direct children are resolved independently', () => {
    const result = deriveTouchpointBusinessStructure(fixture(), 'touch')!;
    expect(result.parent?.id).toBe('parent'); expect(result.children.map(child => child.id)).toEqual(['child']);
  });

  it('children are direct only', () => {
    expect(deriveTouchpointBusinessStructure(fixture(), 'touch')!.children.map(child => child.title)).toEqual(['FAQ']);
  });

  it('URL is part of Touchpoint Business structure', () => {
    expect(deriveTouchpointBusinessStructure(fixture(), 'touch')!.touchpoint.url).toBe('https://example.com/pricing');
  });

  it('same-Offer neighborhood excludes selected Touchpoint', () => {
    expect(deriveTouchpointBusinessStructure(fixture(), 'touch')!.otherTouchpointsByOffer[0]!.touchpoints.map(item => item.id)).toEqual(['other']);
  });

  it('same-Offer neighborhood remains grouped per Offer', () => {
    expect(deriveTouchpointBusinessStructure(fixture(), 'touch')!.otherTouchpointsByOffer.map(group => [group.offer.title, group.touchpoints[0]?.title])).toEqual([['Alpha', 'About'], ['Beta', 'About']]);
  });

  it('same-container neighborhood excludes selected Touchpoint', () => {
    expect(deriveTouchpointBusinessStructure(fixture(), 'touch')!.otherTouchpointsInContainer.map(item => item.title)).toEqual(['About', 'Front Page']);
  });

  it('same Offer and same Located in remain separate derived axes', () => {
    const result = deriveTouchpointBusinessStructure(fixture(), 'touch')!;
    expect(result.otherTouchpointsByOffer[0]!.touchpoints[0]).toBe(result.otherTouchpointsInContainer[0]);
  });

  it('stale references fail softly', () => {
    const document = fixture();
    document.touchpointContainers = []; document.relationships.push({ id: 'stale', kind: 'offer_presented_at_touchpoint', offerId: 'missing', touchpointId: 'touch' });
    const result = deriveTouchpointBusinessStructure(document, 'touch')!;
    expect(result.container).toBeUndefined(); expect(result.offers.some(offer => offer.id === 'missing')).toBe(false);
  });

  it('read model does not mutate document', () => {
    const document = fixture(); const before = structuredClone(document);
    deriveTouchpointBusinessStructure(document, 'touch'); expect(document).toEqual(before);
  });

  it('ordering is deterministic', () => {
    const document = fixture(); document.entities.push({ id: 'z', kind: 'touchpoint', title: 'About', locatedInId: 'web' });
    expect(deriveTouchpointBusinessStructure(document, 'touch')!.otherTouchpointsInContainer.map(item => item.id)).toEqual(['other', 'z', 'parent']);
  });
});

describe('Touchpoint Children candidate projection', () => {
  it('separates standalone branches and leaves and excludes parented/cycle-forming Touchpoints', () => {
    const document = fixture();
    document.entities.push({ id: 'branch', kind: 'touchpoint', title: 'Branch' }, { id: 'branch-child', kind: 'touchpoint', title: 'Branch child' }, { id: 'leaf', kind: 'touchpoint', title: 'Leaf' });
    document.relationships.push({ id: 'branch-edge', kind: 'touchpoint_contains_touchpoint', parentTouchpointId: 'branch', childTouchpointId: 'branch-child' });
    const result = deriveTouchpointChildrenCandidates(document, 'touch');
    expect(result.currentChildren.map(item => item.id)).toEqual(['child']);
    expect(result.standaloneBranches.map(item => [item.touchpoint.id, item.childCount])).toEqual([['branch', 1]]);
    expect(result.standaloneLeaves.map(item => item.touchpoint.id)).toContain('leaf');
    expect([...result.standaloneBranches, ...result.standaloneLeaves].map(item => item.touchpoint.id)).not.toContain('parent');
  });

  it('allows parented reassign targets while excluding moved descendants and current parent', () => {
    expect(deriveTouchpointReassignTargets(fixture(), ['child'], 'touch').map(item => item.id)).toEqual(['other', 'parent']);
  });
});
