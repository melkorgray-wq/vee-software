import { useState, type FormEvent } from 'react';
import { Background, Controls, ReactFlow, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { addEntity, createEmptyMapDocument, movePlacement, updateEntity, type MapDocument, type ProvisionalEntityKind } from '@vee/domain';
import { deriveMapNodes, KIND_LABELS, type MapNodeData } from '../map-adapter';
import { Link } from '../router';

const VIEW_ID = 'spike-view';
const INITIAL_DOCUMENT = createEmptyMapDocument({ mapId: 'spike-map', title: 'Untitled validation map', viewId: VIEW_ID, viewTitle: 'Working view' });
type Side = 'business' | 'client';
type Draft = { title: string; side: '' | Side; kind: '' | ProvisionalEntityKind; linkedProductId: string; linkedOfferIds: string[]; locatedIn: string };
const blankDraft = (): Draft => ({ title: '', side: '', kind: '', linkedProductId: '', linkedOfferIds: [], locatedIn: '' });

function DependencyFields({ draft, setDraft, document }: { draft: Draft; setDraft: (draft: Draft) => void; document: MapDocument }) {
  const products = document.entities.filter(entity => entity.kind === 'product');
  const offers = document.entities.filter(entity => entity.kind === 'offer');
  if (draft.kind === 'offer') return products.length ? <label>Linked Product<select required value={draft.linkedProductId} onChange={e => setDraft({ ...draft, linkedProductId: e.target.value })}>
    <option value="">Choose a Product</option>{products.map(product => <option key={product.id} value={product.id}>{product.title}</option>)}</select></label>
    : <p className="dependency-message">Create a Product before adding an Offer.</p>;
  if (draft.kind === 'touchpoint') return <>
    {offers.length ? <fieldset><legend>Linked Offers <span>(choose one or more)</span></legend>{offers.map(offer => <label className="checkbox" key={offer.id}>
      <input type="checkbox" checked={draft.linkedOfferIds.includes(offer.id)} onChange={e => setDraft({ ...draft, linkedOfferIds: e.target.checked ? [...draft.linkedOfferIds, offer.id] : draft.linkedOfferIds.filter(id => id !== offer.id) })} />{offer.title}</label>)}</fieldset>
      : <p className="dependency-message">Create an Offer before adding a Touchpoint.</p>}
    <label>Located in<input required value={draft.locatedIn} onChange={e => setDraft({ ...draft, locatedIn: e.target.value })} /></label>
  </>;
  return null;
}

function MapNode({ data }: { data: MapNodeData }) {
  return <div className="node-content"><strong>{data.title}</strong><span>{data.kindLabel}</span></div>;
}

export function MapSpike() {
  const [document, setDocument] = useState<MapDocument>(INITIAL_DOCUMENT);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'idle' | 'create'>('idle');
  const [createDraft, setCreateDraft] = useState<Draft>(blankDraft);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState('');
  const nodes = deriveMapNodes(document, VIEW_ID, selectedId).map(node => ({ ...node, type: 'mapNode' }));
  const selected = selectedId ? document.entities.find(({ id }) => id === selectedId) : undefined;

  function draftFor(entityId: string): Draft | null {
    const entity = document.entities.find(({ id }) => id === entityId); if (!entity) return null;
    const side: Side = entity.kind === 'customer_phenomenon' ? 'client' : 'business';
    const productRelationship = document.relationships.find(r => r.kind === 'product_packaged_as_offer' && r.offerId === entity.id);
    const linkedProductId = entity.kind === 'offer' && productRelationship?.kind === 'product_packaged_as_offer' ? productRelationship.productId : '';
    const linkedOfferIds = entity.kind === 'touchpoint' ? document.relationships.filter(r => r.kind === 'offer_presented_at_touchpoint' && r.touchpointId === entity.id).map(r => r.offerId) : [];
    return { title: entity.title, side, kind: entity.kind, linkedProductId, linkedOfferIds, locatedIn: entity.kind === 'touchpoint' ? entity.locatedIn : '' };
  }
  function select(entityId: string | null) {
    setSelectedId(entityId); setMode('idle'); setMessage(''); setEditDraft(entityId ? draftFor(entityId) : null);
  }
  function submitCreate(event: FormEvent) {
    event.preventDefault();
    if (!createDraft.side || !createDraft.kind || !createDraft.title.trim()) { setMessage('Choose a side and type, then enter a title.'); return; }
    const entityId = crypto.randomUUID();
    const common = { entityId, title: createDraft.title, viewId: VIEW_ID, x: 80 + (document.entities.length % 3) * 220, y: 80 + Math.floor(document.entities.length / 3) * 150 };
    try {
      const next = createDraft.kind === 'offer'
        ? addEntity(document, { ...common, kind: 'offer', linkedProductId: createDraft.linkedProductId, relationshipId: crypto.randomUUID() })
        : createDraft.kind === 'touchpoint'
          ? addEntity(document, { ...common, kind: 'touchpoint', locatedIn: createDraft.locatedIn, linkedOfferIds: createDraft.linkedOfferIds, relationshipIds: createDraft.linkedOfferIds.map(() => crypto.randomUUID()) })
          : addEntity(document, { ...common, kind: createDraft.kind });
      setDocument(next); setCreateDraft(blankDraft()); setSelectedId(entityId); setMode('idle'); setMessage('Element created.');
      const created = next.entities.find(entity => entity.id === entityId)!;
      setEditDraft({ title: created.title, side: createDraft.side, kind: created.kind, linkedProductId: createDraft.linkedProductId, linkedOfferIds: createDraft.linkedOfferIds, locatedIn: createDraft.locatedIn });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Element could not be created.'); }
  }
  function submitEdit(event: FormEvent) {
    event.preventDefault(); if (!selectedId || !editDraft) return;
    try {
      const existingIds = document.relationships.filter(r => r.kind === 'offer_presented_at_touchpoint' && r.touchpointId === selectedId).map(r => r.id);
      const relationshipIds = editDraft.linkedOfferIds.map((_, index) => existingIds[index] ?? crypto.randomUUID());
      setDocument(updateEntity(document, { entityId: selectedId, title: editDraft.title, locatedIn: editDraft.locatedIn,
        linkedProductId: editDraft.linkedProductId, linkedOfferIds: editDraft.linkedOfferIds, relationshipIds }));
      setMessage('Changes applied.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Changes could not be applied.'); }
  }
  const unavailable = (createDraft.kind === 'offer' && !document.entities.some(e => e.kind === 'product')) || (createDraft.kind === 'touchpoint' && !document.entities.some(e => e.kind === 'offer'));

  return <main className="map-page">
    <header className="map-header"><div><Link to="/">VEE Software</Link><h1>Domain and interaction spike</h1><p>Not a functional Software Alpha. Data is stored only in memory and changes reset when the page reloads. Entity kinds are provisional.</p></div>
      <button className="primary" onClick={() => { setMode('create'); setCreateDraft(blankDraft()); setMessage(''); }}>Add element</button></header>
    <div className="editor-layout">
      <section className="canvas-panel" aria-label="In-memory VEE map editor">
        {document.entities.length === 0 && <div className="empty-state"><h2>Start an empty map</h2><p>Begin by adding a business-side or client-side element.</p><button onClick={() => setMode('create')}>Add element</button></div>}
        <ReactFlow<Node<MapNodeData>> aria-label="Map canvas" nodes={nodes} edges={[]} nodeTypes={{ mapNode: MapNode }} fitView nodesConnectable={false} edgesFocusable={false} deleteKeyCode={null} multiSelectionKeyCode={null}
          onPaneClick={() => select(null)} onNodeClick={(_, node) => select(node.id)} onNodeDragStop={(_, node: Node<MapNodeData>) => setDocument(current => movePlacement(current, { entityId: node.id, viewId: VIEW_ID, x: node.position.x, y: node.position.y }))}>
          <Background color="rgba(255,255,255,.12)" /><Controls showInteractive={false} />
        </ReactFlow>
      </section>
      <aside className="inspector" aria-labelledby="inspector-title"><h2 id="inspector-title">Entity inspector</h2>{message && <p className="status-message" role="status">{message}</p>}
        {mode === 'create' ? <form onSubmit={submitCreate}><h3>Add an element</h3>
          <fieldset><legend>Choose a side</legend><div className="choice-row"><button type="button" aria-pressed={createDraft.side === 'business'} onClick={() => setCreateDraft({ ...blankDraft(), side: 'business' })}>Business side</button><button type="button" aria-pressed={createDraft.side === 'client'} onClick={() => setCreateDraft({ ...blankDraft(), side: 'client', kind: 'customer_phenomenon' })}>Client side</button></div></fieldset>
          {createDraft.side === 'business' && <fieldset><legend>Business element type</legend><div className="choice-row">{(['product', 'offer', 'touchpoint'] as const).map(kind => <button type="button" key={kind} aria-pressed={createDraft.kind === kind} onClick={() => setCreateDraft({ ...createDraft, kind, linkedProductId: '', linkedOfferIds: [], locatedIn: '' })}>{KIND_LABELS[kind]}</button>)}</div></fieldset>}
          {createDraft.side === 'client' && <p><strong>Customer phenomenon</strong> is the only currently available client-side type. Client-side typing will be expanded later.</p>}
          {createDraft.kind && <><label>Title<input required value={createDraft.title} onChange={e => setCreateDraft({ ...createDraft, title: e.target.value })} /></label><DependencyFields draft={createDraft} setDraft={setCreateDraft} document={document} /></>}
          <div className="actions"><button className="primary" type="submit" disabled={!createDraft.kind || unavailable}>Create element</button><button type="button" onClick={() => { setMode('idle'); setCreateDraft(blankDraft()); setMessage(''); }}>Cancel</button></div></form>
          : selected && editDraft ? <form onSubmit={submitEdit}><h3>{selected.title}</h3><p>{editDraft.side === 'business' ? 'Business side' : 'Client side'} · {KIND_LABELS[selected.kind]} <span className="immutable-note">(type and side cannot be changed)</span></p>
            <label>Title<input required value={editDraft.title} onChange={e => setEditDraft({ ...editDraft, title: e.target.value })} /></label><DependencyFields draft={editDraft} setDraft={setEditDraft} document={document} /><button className="primary" type="submit">Apply changes</button></form>
          : <p>{document.entities.length ? 'Select an element on the map to inspect and edit it.' : 'Add an element to open its properties here.'}</p>}
      </aside>
    </div>
  </main>;
}
