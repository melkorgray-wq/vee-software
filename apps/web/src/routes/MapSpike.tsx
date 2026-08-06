import { useState, type FormEvent } from 'react';
import { Background, Controls, ReactFlow, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { addEntity, createEmptyMapDocument, EPISTEMIC_STATUSES, movePlacement, PROVISIONAL_ENTITY_KINDS,
  updateEntity, updateEpistemicAnnotation, type EpistemicStatus, type MapDocument, type ProvisionalEntityKind } from '@vee/domain';
import { deriveMapNodes, KIND_LABELS, STATUS_LABELS, type MapNodeData } from '../map-adapter';
import { Link } from '../router';

const VIEW_ID = 'spike-view';
const INITIAL_DOCUMENT = createEmptyMapDocument({ mapId: 'spike-map', title: 'Untitled validation map', viewId: VIEW_ID, viewTitle: 'Working view' });
type Draft = { title: string; kind: '' | ProvisionalEntityKind; status: '' | EpistemicStatus; sourceNote: string };
const blankDraft = (): Draft => ({ title: '', kind: '', status: '', sourceNote: '' });

function Fields({ draft, setDraft }: { draft: Draft; setDraft: (draft: Draft) => void }) {
  return <>
    <label>Title<input name="title" required value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
    <label>Provisional entity kind<select name="kind" required value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as Draft['kind'] })}>
      <option value="">Choose a kind</option>{PROVISIONAL_ENTITY_KINDS.map(kind => <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>)}
    </select></label>
    <label>Epistemic status<select name="status" required value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as Draft['status'] })}>
      <option value="">Choose a status</option>{EPISTEMIC_STATUSES.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
    </select></label>
    <label>Source note <span>(optional)</span><textarea name="sourceNote" value={draft.sourceNote} onChange={e => setDraft({ ...draft, sourceNote: e.target.value })} /></label>
  </>;
}

function MapNode({ data }: { data: MapNodeData }) {
  return <div className="node-content"><strong>{data.title}</strong><span>{data.kindLabel}</span><span>{data.statusLabel}</span></div>;
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

  function select(entityId: string | null) {
    setSelectedId(entityId); setMode('idle'); setMessage('');
    const entity = entityId ? document.entities.find(({ id }) => id === entityId) : undefined;
    const annotation = entityId ? document.epistemicAnnotations.find(a => a.subjectEntityId === entityId) : undefined;
    setEditDraft(entity && annotation ? { title: entity.title, kind: entity.kind, status: annotation.status, sourceNote: annotation.sourceNote ?? '' } : null);
  }
  function submitCreate(event: FormEvent) {
    event.preventDefault();
    if (!createDraft.title.trim() || !createDraft.kind || !createDraft.status) { setMessage('Complete the title, provisional kind, and epistemic status.'); return; }
    const entityId = crypto.randomUUID();
    const next = addEntity(document, { entityId, annotationId: crypto.randomUUID(), title: createDraft.title, kind: createDraft.kind,
      status: createDraft.status, sourceNote: createDraft.sourceNote, viewId: VIEW_ID,
      x: 80 + (document.entities.length % 3) * 220, y: 80 + Math.floor(document.entities.length / 3) * 150 });
    setDocument(next); setCreateDraft(blankDraft()); setSelectedId(entityId); setMode('idle'); setMessage('Element created.');
    setEditDraft({ ...createDraft });
  }
  function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !editDraft?.title.trim() || !editDraft.kind || !editDraft.status) { setMessage('Complete all required fields.'); return; }
    const entityUpdated = updateEntity(document, { entityId: selectedId, title: editDraft.title, kind: editDraft.kind });
    setDocument(updateEpistemicAnnotation(entityUpdated, { subjectEntityId: selectedId, status: editDraft.status, sourceNote: editDraft.sourceNote }));
    setMessage('Changes applied.');
  }

  return <main className="map-page">
    <header className="map-header"><div><Link to="/">VEE Software</Link><h1>Domain and interaction spike</h1>
      <p>Not a functional Software Alpha. Data is stored only in memory and changes reset when the page reloads. Entity kinds are provisional.</p></div>
      <button className="primary" onClick={() => { setMode('create'); setCreateDraft(blankDraft()); setMessage(''); }}>Add element</button></header>
    <div className="editor-layout">
      <section className="canvas-panel" aria-label="In-memory VEE map editor">
        {document.entities.length === 0 && <div className="empty-state"><h2>Start an empty map</h2><p>Add an element to test the provisional Customer phenomenon ↔ Touchpoint ↔ Offer ↔ Product bridge.</p><button onClick={() => setMode('create')}>Add element</button></div>}
        <ReactFlow<Node<MapNodeData>> aria-label="Map canvas" nodes={nodes} edges={[]} nodeTypes={{ mapNode: MapNode }} fitView
          nodesConnectable={false} edgesFocusable={false} deleteKeyCode={null} multiSelectionKeyCode={null}
          onPaneClick={() => select(null)} onNodeClick={(_, node) => select(node.id)}
          onNodeDragStop={(_, node: Node<MapNodeData>) => setDocument(current => movePlacement(current, { entityId: node.id, viewId: VIEW_ID, x: node.position.x, y: node.position.y }))}>
          <Background color="rgba(255,255,255,.12)" /><Controls showInteractive={false} />
        </ReactFlow>
      </section>
      <aside className="inspector" aria-labelledby="inspector-title"><h2 id="inspector-title">Entity inspector</h2>
        {message && <p className="status-message" role="status">{message}</p>}
        {mode === 'create' ? <form onSubmit={submitCreate}><h3>Add an element</h3><p>Choose independently from the provisional kinds and epistemic statuses.</p><Fields draft={createDraft} setDraft={setCreateDraft} /><div className="actions"><button className="primary" type="submit">Create element</button><button type="button" onClick={() => { setMode('idle'); setCreateDraft(blankDraft()); setMessage(''); }}>Cancel</button></div></form>
          : selected && editDraft ? <form onSubmit={submitEdit}><h3>{selected.title}</h3><Fields draft={editDraft} setDraft={setEditDraft} /><button className="primary" type="submit">Apply changes</button></form>
          : <p>{document.entities.length ? 'Select an element on the map to inspect and edit it.' : 'Add an element to open its properties here.'}</p>}
      </aside>
    </div>
  </main>;
}
