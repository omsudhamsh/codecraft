import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileJson,
  FilePlus2,
  FileText,
  FolderOpen,
  Folder,
  GitBranch,
  RotateCcw,
  Trash2,
} from 'lucide-react';

import Button from '../ui/Button.jsx';
import Modal from '../ui/Modal.jsx';
import { useStudio } from '../../context/StudioContext.jsx';

/** Build a directory tree from a flat path map. */
function buildTree(paths) {
  const root = { name: '', path: '', dirs: new Map(), files: [] };
  for (const path of paths) {
    const parts = path.split('/');
    let node = root;
    parts.forEach((segment, index) => {
      const isFile = index === parts.length - 1;
      const nodePath = parts.slice(0, index + 1).join('/');
      if (isFile) {
        node.files.push({ name: segment, path: nodePath });
      } else {
        if (!node.dirs.has(segment)) {
          node.dirs.set(segment, { name: segment, path: nodePath, dirs: new Map(), files: [] });
        }
        node = node.dirs.get(segment);
      }
    });
  }
  return root;
}

function iconFor(name) {
  if (name.endsWith('.json')) return FileJson;
  if (name.endsWith('.md')) return FileText;
  return FileCode2;
}

export default function FileExplorer({ mode, readOnly = false }) {
  const { sessions, modes, actions } = useStudio();
  const session = sessions[mode];
  const repoName = modes[mode]?.repoName ?? '';
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [creating, setCreating] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [newBody, setNewBody] = useState('// new module\n');

  const tree = useMemo(() => buildTree(Object.keys(session.files).sort()), [session.files]);

  const toggle = (path) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleCreate = () => {
    const clean = newPath.trim().replace(/^\/+/, '');
    if (!clean) return;
    actions.createFile(mode, clean, newBody);
    actions.openFile(mode, clean);
    setCreating(false);
    setNewPath('');
    setNewBody('// new module\n');
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        <FolderOpen size={13} className="text-ink-faint" />
        <span className="truncate font-mono text-[11.5px] text-ink-dim">{repoName}</span>
        {!readOnly && (
          <Button
            size="xs"
            variant="subtle"
            className="ml-auto"
            onClick={() => setCreating(true)}
            title="Create a new file"
          >
            <FilePlus2 size={12} />
            New
          </Button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto py-1.5 scroll-thin">
        <TreeNode
          node={tree}
          depth={0}
          session={session}
          mode={mode}
          collapsed={collapsed}
          toggle={toggle}
          readOnly={readOnly}
        />
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t border-line px-3 py-1.5 text-[10.5px] text-ink-faint">
        <GitBranch size={11} />
        <span className="truncate">
          {Object.values(session.dirty).filter(Boolean).length} modified · {Object.keys(session.files).length} files
        </span>
      </footer>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Create file"
        subtitle="New modules are part of the deliverable — the feature round expects you to add files."
        icon={FilePlus2}
        footer={
          <>
            <Button size="sm" onClick={() => setCreating(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={handleCreate} disabled={!newPath.trim()}>
              Create
            </Button>
          </>
        }
      >
        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-ink-faint">
          Path
        </label>
        <input
          value={newPath}
          onChange={(e) => setNewPath(e.target.value)}
          placeholder="server/middleware/authorize.js"
          className="w-full rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-[12px] text-ink outline-none placeholder:text-ink-faint/60 focus:border-sky-500/60"
        />

        <label className="mb-1.5 mt-4 block text-[11px] font-medium uppercase tracking-wider text-ink-faint">
          Contents
        </label>
        <textarea
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          rows={8}
          className="w-full resize-y rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-[12px] leading-relaxed text-ink outline-none focus:border-sky-500/60 scroll-thin"
        />
      </Modal>
    </div>
  );
}

function TreeNode({ node, depth, session, mode, collapsed, toggle, readOnly }) {
  const { actions } = useStudio();
  const pad = { paddingLeft: `${depth * 12 + 8}px` };
  const dirs = [...node.dirs.values()];
  const files = node.files ?? [];

  return (
    <>
      {dirs.map((dir) => {
        const isCollapsed = collapsed.has(dir.path);
        return (
          <div key={dir.path}>
            <button
              type="button"
              onClick={() => toggle(dir.path)}
              style={pad}
              className="flex w-full items-center gap-1.5 py-[3px] pr-2 text-left text-[12px] text-ink-dim transition-colors hover:bg-surface-2"
            >
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              {isCollapsed ? <Folder size={12} className="text-ink-faint" /> : <FolderOpen size={12} className="text-sky-500/70" />}
              <span className="truncate">{dir.name}</span>
            </button>
            {!isCollapsed && (
              <TreeNode
                node={dir}
                depth={depth + 1}
                session={session}
                mode={mode}
                collapsed={collapsed}
                toggle={toggle}
                readOnly={readOnly}
              />
            )}
          </div>
        );
      })}

      {files.map((file) => {
        const active = session.activeFile === file.path;
        const dirty = Boolean(session.dirty[file.path]);
        const Icon = iconFor(file.name);
        const isNew = session.baselineFiles[file.path] === undefined;

        return (
          <div
            key={file.path}
            className={`group flex items-center pr-1 transition-colors ${
              active ? 'bg-sky-500/10 text-ink' : 'text-ink-dim hover:bg-surface-2'
            }`}
            style={pad}
          >
            <button
              type="button"
              onClick={() => actions.openFile(mode, file.path)}
              className="flex min-w-0 flex-1 items-center gap-1.5 py-[3px] text-left text-[12px]"
              title={file.path}
            >
              <Icon size={12} className={active ? 'text-sky-400' : 'text-ink-faint'} />
              <span className={`truncate ${active ? 'font-medium' : ''}`}>{file.name}</span>
              {isNew && (
                <span className="rounded bg-violet-500/20 px-1 text-[9px] font-semibold uppercase text-violet-300">
                  new
                </span>
              )}
              {dirty && !isNew && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="modified" />}
            </button>

            {dirty && !readOnly && (
              <span className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  title="Revert to the original file"
                  onClick={() => actions.revertFile(mode, file.path)}
                  className="rounded p-1 text-ink-faint hover:bg-surface-3 hover:text-ink-dim"
                >
                  <RotateCcw size={11} />
                </button>
                {isNew && (
                  <button
                    type="button"
                    title="Delete file"
                    onClick={() => {
                      actions.deleteFile(mode, file.path);
                      if (session.activeFile === file.path) actions.openFile(mode, Object.keys(session.files)[0]);
                    }}
                    className="rounded p-1 text-ink-faint hover:bg-rose-500/15 hover:text-rose-300"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}
