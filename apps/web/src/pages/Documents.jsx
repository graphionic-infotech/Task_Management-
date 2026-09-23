import { useState, useEffect, useRef } from 'react';
import { api, downloadFile } from '../lib/api.js';
import { fmtDateTime } from '../lib/time.js';

const CATEGORIES = [
  'All',
  'SOP & Guidelines',
  'Project Specs',
  'Meeting Notes',
  'Invoices & Finance',
  'Templates',
  'Policies',
  'General'
];

function renderFormattedText(text) {
  if (!text) return null;
  const parts = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={key++} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(<code key={key++} style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: 4, fontSize: '0.9em', border: '1px solid var(--border)' }}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length ? parts : text;
}

function renderSimpleMarkdown(md = '') {
  if (!md) return null;
  const lines = md.split('\n');
  let inCodeBlock = false;
  let codeBuffer = [];

  return (
    <div className="doc-markdown-content" style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
      {lines.map((line, idx) => {
        if (line.startsWith('```')) {
          if (inCodeBlock) {
            inCodeBlock = false;
            const content = codeBuffer.join('\n');
            codeBuffer = [];
            return (
              <pre key={idx} style={{ background: '#0f172a', color: '#f8fafc', padding: '12px 16px', borderRadius: 8, overflowX: 'auto', fontSize: 13, fontFamily: 'var(--font-mono)', margin: '12px 0' }}>
                <code>{content}</code>
              </pre>
            );
          } else {
            inCodeBlock = true;
            return null;
          }
        }
        if (inCodeBlock) {
          codeBuffer.push(line);
          return null;
        }

        if (line.startsWith('# ')) return <h1 key={idx} style={{ fontSize: 22, fontWeight: 800, margin: '20px 0 10px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>{renderFormattedText(line.slice(2))}</h1>;
        if (line.startsWith('## ')) return <h2 key={idx} style={{ fontSize: 18, fontWeight: 700, margin: '18px 0 8px', color: 'var(--text-primary)' }}>{renderFormattedText(line.slice(3))}</h2>;
        if (line.startsWith('### ')) return <h3 key={idx} style={{ fontSize: 15, fontWeight: 700, margin: '14px 0 6px', color: 'var(--text-primary)' }}>{renderFormattedText(line.slice(4))}</h3>;
        if (line.startsWith('> ')) {
          return (
            <blockquote key={idx} style={{ margin: '10px 0', padding: '8px 14px', borderLeft: '4px solid var(--primary)', background: 'var(--primary-soft)', borderRadius: '0 8px 8px 0', color: 'var(--primary-hover)', fontSize: 13.5 }}>
              {renderFormattedText(line.slice(2))}
            </blockquote>
          );
        }
        if (line.startsWith('---') || line.startsWith('***')) {
          return <hr key={idx} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />;
        }
        if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
              <input type="checkbox" checked readOnly style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
              <span style={{ textDecoration: 'line-through', color: 'var(--text-faint)' }}>{renderFormattedText(line.slice(6))}</span>
            </div>
          );
        }
        if (line.startsWith('- [ ] ')) {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
              <input type="checkbox" readOnly style={{ width: 16, height: 16 }} />
              <span style={{ color: 'var(--text-primary)' }}>{renderFormattedText(line.slice(6))}</span>
            </div>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <li key={idx} style={{ marginLeft: 20, marginBottom: 4 }}>{renderFormattedText(line.slice(2))}</li>;
        }
        if (line.trim() === '') return <div key={idx} style={{ height: 8 }} />;
        return <p key={idx} style={{ margin: '6px 0' }}>{renderFormattedText(line)}</p>;
      })}
    </div>
  );
}

function getFileIcon(mime = '', filename = '') {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return '🖼️';
  if (mime === 'application/pdf' || ext === 'pdf') return '📕';
  if (['doc', 'docx'].includes(ext) || mime.includes('word')) return '📘';
  if (['xls', 'xlsx', 'csv'].includes(ext) || mime.includes('sheet') || mime.includes('excel')) return '📗';
  if (['ppt', 'pptx'].includes(ext) || mime.includes('presentation')) return '📙';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦';
  if (['txt', 'md'].includes(ext)) return '📄';
  return '📎';
}

export default function Documents({ onOpenTask }) {
  const [docs, setDocs] = useState([]);
  const [stats, setStats] = useState({ total: 0, notes: 0, files: 0, categories: 0 });
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [viewDoc, setViewDoc] = useState(null);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [tasksList, setTasksList] = useState([]);

  // Drag & Drop / Direct Add state
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const [isBarDragOver, setIsBarDragOver] = useState(false);
  const [droppedFile, setDroppedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef(null);

  // Quick Purpose Form state for dropped/selected files
  const [purposeForm, setPurposeForm] = useState({
    title: '',
    targetType: 'general', // 'general' or 'task'
    task_id: '',
    category: 'General',
    description: ''
  });

  // Write Document state
  const [writeForm, setWriteForm] = useState({
    title: '',
    category: 'SOP & Guidelines',
    targetType: 'general',
    task_id: '',
    description: '',
    content: ''
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const loadDocs = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (category !== 'All') q.set('category', category);
      if (search.trim()) q.set('search', search.trim());
      const res = await api('/api/documents?' + q.toString());
      setDocs(res.rows || []);
      if (res.stats) setStats(res.stats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, [category]);

  useEffect(() => {
    const t = setTimeout(loadDocs, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    api('/api/tasks?view=open')
      .then(rows => setTasksList(rows || []))
      .catch(() => {});
  }, []);

  // Global window drag and drop listener
  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer?.types?.includes('Files')) {
        setIsWindowDragging(true);
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        setIsWindowDragging(false);
        dragCounter = 0;
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
    };

    const handleDrop = (e) => {
      e.preventDefault();
      dragCounter = 0;
      setIsWindowDragging(false);
      setIsBarDragOver(false);
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleFileSelect(files[0]);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  const handleFileSelect = (file) => {
    if (!file) return;
    setDroppedFile(file);
    setErr('');

    // Default category guessing from name or extension
    const name = file.name || '';
    const ext = (name.split('.').pop() || '').toLowerCase();
    let detectedCategory = 'General';
    if (/invoice|bill|receipt|payment|gst/i.test(name)) detectedCategory = 'Invoices & Finance';
    else if (/sop|guide|manual|standard|procedure/i.test(name)) detectedCategory = 'SOP & Guidelines';
    else if (/spec|requirement|architecture|layout/i.test(name)) detectedCategory = 'Project Specs';
    else if (/meeting|notes|minutes|mom/i.test(name)) detectedCategory = 'Meeting Notes';
    else if (/template|agreement|contract|nda/i.test(name)) detectedCategory = 'Templates';
    else if (/policy|rules|terms/i.test(name)) detectedCategory = 'Policies';

    setPurposeForm({
      title: name.replace(/\.[^/.]+$/, ''), // strip extension for title
      targetType: 'general',
      task_id: '',
      category: detectedCategory,
      description: ''
    });

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl('');
    }
  };

  const handleUploadDroppedFile = async (e) => {
    e?.preventDefault();
    if (!droppedFile) return;
    setSaving(true);
    setErr('');

    try {
      const fd = new FormData();
      fd.append('file', droppedFile);
      fd.append('title', purposeForm.title.trim() || droppedFile.name);
      fd.append('category', purposeForm.category);
      if (purposeForm.description) fd.append('description', purposeForm.description);
      if (purposeForm.targetType === 'task' && purposeForm.task_id) {
        fd.append('task_id', purposeForm.task_id);
      }

      const token = localStorage.getItem('gt_token') || '';
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: 'Bearer ' + token },
        body: fd
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Upload failed');
      }

      setDroppedFile(null);
      setPreviewUrl('');
      loadDocs();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateWrittenDoc = async (e) => {
    e.preventDefault();
    if (!writeForm.title.trim()) {
      setErr('Title is required');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await api('/api/documents', {
        method: 'POST',
        body: {
          title: writeForm.title,
          category: writeForm.category,
          description: writeForm.description,
          content: writeForm.content,
          task_id: writeForm.targetType === 'task' ? writeForm.task_id : undefined
        }
      });
      setShowWriteModal(false);
      setWriteForm({
        title: '',
        category: 'SOP & Guidelines',
        targetType: 'general',
        task_id: '',
        description: '',
        content: ''
      });
      loadDocs();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!confirm(`Delete document "${title}"?`)) return;
    try {
      await api('/api/documents/' + id, { method: 'DELETE' });
      if (viewDoc?.id === id) setViewDoc(null);
      loadDocs();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div>
      {/* Hidden file input for direct file upload click */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="*"
        onChange={e => {
          if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
          e.target.value = '';
        }}
      />

      {/* Window Drag Overlay */}
      {isWindowDragging && (
        <div className="doc-drop-overlay">
          <div className="doc-drop-overlay-box">
            <div style={{ fontSize: 56, marginBottom: 12 }}>📥</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 800, color: '#0f766e' }}>
              Drop files anywhere to add to Documents
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: '#047857' }}>
              Accepts PDF, images, office documents, spreadsheets, zip archives, and all file formats.
            </p>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">📁 Documents Hub</h1>
          <p className="page-sub">
            Drag & drop files or write SOPs, specs, meeting notes, agreements & invoices.
          </p>
        </div>
        <div className="page-actions">
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-subtle)', padding: 4, borderRadius: 999, border: '1px solid var(--border)' }}>
              <button className={viewMode === 'grid' ? 'btn small primary' : 'btn small ghost'} style={{ borderRadius: 999 }} onClick={() => setViewMode('grid')}>▦ Grid</button>
              <button className={viewMode === 'list' ? 'btn small primary' : 'btn small ghost'} style={{ borderRadius: 999 }} onClick={() => setViewMode('list')}>☰ List</button>
            </div>
            <button className="btn ghost" onClick={() => fileInputRef.current?.click()} style={{ borderColor: 'var(--primary)', color: 'var(--primary)', fontWeight: 650 }}>
              📎 Direct Upload
            </button>
            <button className="btn primary" onClick={() => { setShowWriteModal(true); setErr(''); }}>
              ✍️ Write Document
            </button>
          </div>
        </div>
      </div>

      {/* Direct Drag & Drop Bar */}
      <div
        className={`doc-quick-drop-bar ${isBarDragOver ? 'dragover' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsBarDragOver(true); }}
        onDragLeave={e => { e.preventDefault(); setIsBarDragOver(false); }}
        onDrop={e => {
          e.preventDefault();
          setIsBarDragOver(false);
          if (e.dataTransfer?.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
        }}
      >
        <div className="doc-quick-drop-content">
          <div className="doc-quick-drop-icon">📥</div>
          <div>
            <div className="doc-quick-drop-title">
              <span>Direct Drag & Drop Any Document Here</span>
              <span className="pill green" style={{ fontSize: 11, padding: '2px 8px' }}>All Files Accepted</span>
            </div>
            <div className="doc-quick-drop-subtitle">
              PDF, Images (PNG, JPG, WEBP, SVG), Word, Excel, PowerPoint, ZIP, CAD, TXT — or click anywhere to browse
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn small primary"
            onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
            style={{ padding: '8px 16px', fontWeight: 650, whiteSpace: 'nowrap' }}
          >
            + Choose File
          </button>
        </div>
      </div>

      {/* Top Stats Cards */}
      <div className="docs-stat-grid">
        <div className="stat">
          <div className="stat-top">
            <div>
              <div className="n">{stats.total}</div>
              <div className="t">Total Documents</div>
            </div>
            <div className="stat-icon teal">📁</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-top">
            <div>
              <div className="n">{stats.notes}</div>
              <div className="t">Written Docs & SOPs</div>
            </div>
            <div className="stat-icon purple">📝</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-top">
            <div>
              <div className="n">{stats.files}</div>
              <div className="t">Uploaded Files</div>
            </div>
            <div className="stat-icon blue">📎</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-top">
            <div>
              <div className="n">{stats.categories}</div>
              <div className="t">Categories</div>
            </div>
            <div className="stat-icon amber">🏷</div>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="tabs" role="tablist">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            role="tab"
            aria-selected={category === cat}
            className={category === cat ? 'active' : ''}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="toolbar-card" style={{ marginBottom: 14 }}>
        <div className="searchbox" style={{ maxWidth: 360, flex: 1 }}>
          <span className="sic" aria-hidden>⌕</span>
          <input
            className="inp"
            placeholder="Search documents by title, description or content…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Showing <b>{docs.length}</b> {docs.length === 1 ? 'document' : 'documents'}
        </div>
      </div>

      {/* Main Content: Grid or List */}
      {loading ? (
        <div className="doc-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="card" style={{ padding: 20 }}>
              <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10, marginBottom: 14 }} />
              <div className="skeleton" style={{ width: '75%', height: 16, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: '50%', height: 12, marginBottom: 16 }} />
              <div className="skeleton" style={{ width: '100%', height: 36 }} />
            </div>
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="empty" style={{ padding: '60px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
          <div className="empty-icon">📁</div>
          <div className="empty-title">No documents found</div>
          <div className="empty-desc">
            {search ? `No documents matching "${search}".` : 'Drag & drop any file above or write a new document.'}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
            <button className="btn primary small" onClick={() => fileInputRef.current?.click()}>
              📎 Upload File
            </button>
            <button className="btn small" onClick={() => setShowWriteModal(true)}>
              ✍️ Write Document
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="doc-grid">
          {docs.map(d => {
            const isFile = !!d.filename;
            const icon = isFile ? getFileIcon(d.mime, d.filename) : '📄';
            return (
              <div key={d.id} className="doc-card" onClick={() => setViewDoc(d)}>
                <div>
                  <div className="doc-card-head">
                    <div className={`doc-icon ${isFile ? 'file' : ''}`}>
                      {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="doc-card-title">{d.title}</div>
                      <span className="doc-badge">{d.category}</span>
                    </div>
                  </div>

                  <p className="doc-desc">
                    {d.description || (d.content ? d.content.slice(0, 120).replace(/[#*`-]/g, '') : 'No description provided.')}
                  </p>

                  {d.task_title ? (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#f0fdfa',
                        padding: '4px 8px',
                        borderRadius: 6,
                        fontSize: 11.5,
                        color: 'var(--primary)',
                        marginBottom: 10,
                        border: '1px solid #ccfbf1'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onOpenTask) onOpenTask(d.task_id);
                      }}
                    >
                      <span>☑ Task:</span>
                      <b style={{ textDecoration: 'underline' }}>{d.task_title}</b>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'var(--bg-subtle)',
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        color: 'var(--text-faint)',
                        marginBottom: 10
                      }}
                    >
                      <span>🏢 General Team Document</span>
                    </div>
                  )}
                </div>

                <div className="doc-footer" onClick={e => e.stopPropagation()}>
                  <div>
                    <span>{d.creator_first}</span> · <span title={fmtDateTime(d.updated_at)}>{new Date(d.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn small ghost" title="View document" onClick={() => setViewDoc(d)}>
                      👁 View
                    </button>
                    <button
                      type="button"
                      className="btn small ghost"
                      title="Download"
                      onClick={(e) => {
                        e.stopPropagation();
                        const safeName = d.filename || (d.title.endsWith('.pdf') ? d.title : `${d.title}.pdf`);
                        downloadFile(`/api/documents/${d.id}/download`, safeName);
                      }}
                    >
                      ⬇
                    </button>
                    <button className="btn small danger ghost" title="Delete" onClick={(e) => { e.stopPropagation(); handleDelete(d.id, d.title); }}>
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Document</th>
                <th style={{ width: 150 }}>Category</th>
                <th style={{ width: 140 }}>Type</th>
                <th style={{ width: 190 }}>Assigned To / For</th>
                <th style={{ width: 140 }}>Author</th>
                <th style={{ width: 120 }}>Updated</th>
                <th style={{ width: 120, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map(d => {
                const icon = d.filename ? getFileIcon(d.mime, d.filename) : '📄';
                return (
                  <tr key={d.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20 }}>{icon}</span>
                        <div>
                          <span className="tasklink" onClick={() => setViewDoc(d)} style={{ fontWeight: 650 }}>
                            {d.title}
                          </span>
                          {d.description && <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{d.description.slice(0, 60)}</div>}
                        </div>
                      </div>
                    </td>
                    <td><span className="doc-badge">{d.category}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {d.filename ? `${(d.filename.split('.').pop() || 'FILE').toUpperCase()} (${Math.round((d.size_bytes || 0) / 1024)} KB)` : 'Written Note'}
                    </td>
                    <td>
                      {d.task_title ? (
                        <span
                          className="tasklink"
                          style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => onOpenTask && onOpenTask(d.task_id)}
                        >
                          ☑ {d.task_title}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>🏢 General Team</span>
                      )}
                    </td>
                    <td>{d.creator_first} {d.creator_last}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                      {new Date(d.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                        <button className="btn small ghost" onClick={() => setViewDoc(d)}>View</button>
                        <button
                          type="button"
                          className="btn small ghost"
                          title="Download"
                          onClick={() => {
                            const safeName = d.filename || (d.title.endsWith('.pdf') ? d.title : `${d.title}.pdf`);
                            downloadFile(`/api/documents/${d.id}/download`, safeName);
                          }}
                        >
                          ⬇
                        </button>
                        <button className="btn small danger ghost" onClick={() => handleDelete(d.id, d.title)}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* QUICK PURPOSE MODAL (When file is dropped or picked) */}
      {droppedFile && (
        <div className="doc-modal-overlay" onClick={() => { setDroppedFile(null); setPreviewUrl(''); }}>
          <div className="doc-modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="doc-modal-head">
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📥</span> Upload Document
              </h3>
              <button className="btn small ghost" onClick={() => { setDroppedFile(null); setPreviewUrl(''); }}>✕</button>
            </div>

            <div className="doc-modal-body">
              {/* File details banner */}
              <div className="doc-file-preview-card">
                <span style={{ fontSize: 32 }}>{getFileIcon(droppedFile.type, droppedFile.name)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, wordBreak: 'break-word' }}>{droppedFile.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {Math.round(droppedFile.size / 1024)} KB · {droppedFile.type || 'Standard File'}
                  </div>
                </div>
                {previewUrl && (
                  <img src={previewUrl} alt="preview" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} />
                )}
              </div>

              {err && (
                <div className="error-card" style={{ marginBottom: 14 }}>
                  <span>⚠</span>
                  <span style={{ flex: 1 }}>{err}</span>
                  <button className="btn small ghost" onClick={() => setErr('')}>Dismiss</button>
                </div>
              )}

              <form onSubmit={handleUploadDroppedFile}>
                <div className="field">
                  <label className="lbl">Document Title</label>
                  <input
                    className="inp"
                    value={purposeForm.title}
                    onChange={e => setPurposeForm({ ...purposeForm, title: e.target.value })}
                    placeholder="Enter document title…"
                    required
                  />
                </div>

                {/* What is this document for? */}
                <div className="field" style={{ marginTop: 14 }}>
                  <label className="lbl" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    🎯 What is this document for?
                  </label>
                  <div className="purpose-toggle-group">
                    <button
                      type="button"
                      className={`purpose-toggle-btn ${purposeForm.targetType === 'general' ? 'active' : ''}`}
                      onClick={() => setPurposeForm({ ...purposeForm, targetType: 'general', task_id: '' })}
                    >
                      <span style={{ fontSize: 20 }}>🏢</span>
                      <div>
                        <div>General Team Document</div>
                        <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-faint)' }}>Available to entire office</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`purpose-toggle-btn ${purposeForm.targetType === 'task' ? 'active' : ''}`}
                      onClick={() => setPurposeForm({ ...purposeForm, targetType: 'task' })}
                    >
                      <span style={{ fontSize: 20 }}>☑️</span>
                      <div>
                        <div>For a Specific Task</div>
                        <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-faint)' }}>Linked to task checklist</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* If task selected: choose task */}
                {purposeForm.targetType === 'task' && (
                  <div className="field" style={{ marginTop: 10, background: '#f0fdfa', border: '1px solid #ccfbf1', padding: 12, borderRadius: 10 }}>
                    <label className="lbl">Select Associated Task *</label>
                    <select
                      className="sel"
                      value={purposeForm.task_id}
                      onChange={e => setPurposeForm({ ...purposeForm, task_id: e.target.value })}
                      required
                    >
                      <option value="">-- Select Task --</option>
                      {tasksList.map(t => (
                        <option key={t.id} value={t.id}>{t.title} ({t.priority})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Category Selector Pills */}
                <div className="field" style={{ marginTop: 14 }}>
                  <label className="lbl">Select Category / Purpose</label>
                  <div className="purpose-pills">
                    {CATEGORIES.filter(c => c !== 'All').map(c => (
                      <button
                        key={c}
                        type="button"
                        className={`purpose-pill ${purposeForm.category === c ? 'active' : ''}`}
                        onClick={() => setPurposeForm({ ...purposeForm, category: c })}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field" style={{ marginTop: 14 }}>
                  <label className="lbl">Short Note / Description (Optional)</label>
                  <input
                    className="inp"
                    placeholder="e.g. Quotation revision 2 received from vendor"
                    value={purposeForm.description}
                    onChange={e => setPurposeForm({ ...purposeForm, description: e.target.value })}
                  />
                </div>

                <div className="mrow" style={{ marginTop: 20 }}>
                  <button type="button" className="btn" onClick={() => { setDroppedFile(null); setPreviewUrl(''); }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn primary" disabled={saving}>
                    {saving ? 'Uploading…' : '✓ Upload & Save Document'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* VIEW DOCUMENT MODAL */}
      {viewDoc && (
        <div className="doc-modal-overlay" onClick={() => setViewDoc(null)}>
          <div className="doc-modal" onClick={e => e.stopPropagation()}>
            <div className="doc-modal-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>{viewDoc.filename ? getFileIcon(viewDoc.mime, viewDoc.filename) : '📄'}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{viewDoc.title}</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                    <span className="doc-badge" style={{ padding: '1px 6px', fontSize: 10 }}>{viewDoc.category}</span>
                    <span>Created by {viewDoc.creator_first}</span>
                    <span>· {fmtDateTime(viewDoc.updated_at)}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn small primary"
                  onClick={() => {
                    const safeName = viewDoc.filename || (viewDoc.title.endsWith('.pdf') ? viewDoc.title : `${viewDoc.title}.pdf`);
                    downloadFile(`/api/documents/${viewDoc.id}/download`, safeName);
                  }}
                >
                  ⬇ Download
                </button>
                <button className="btn small ghost" onClick={() => setViewDoc(null)}>
                  ✕ Close
                </button>
              </div>
            </div>

            <div className="doc-modal-body">
              {viewDoc.description && (
                <div style={{ background: 'var(--bg-subtle)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, marginBottom: 16, color: 'var(--text-secondary)' }}>
                  <b>Description:</b> {viewDoc.description}
                </div>
              )}

              {viewDoc.task_title ? (
                <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', padding: '8px 12px', borderRadius: 8, fontSize: 12.5, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📌 Linked to Task:</span>
                  <b className="tasklink" onClick={() => { setViewDoc(null); onOpenTask && onOpenTask(viewDoc.task_id); }}>
                    {viewDoc.task_title}
                  </b>
                </div>
              ) : (
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: 8, fontSize: 12, marginBottom: 16, color: 'var(--text-muted)' }}>
                  🏢 General Team Document
                </div>
              )}

              {viewDoc.filename ? (
                <div>
                  {/* If image: render preview directly */}
                  {viewDoc.mime?.startsWith('image/') ? (
                    <div style={{ textAlign: 'center', marginBottom: 16 }}>
                      <img
                        src={`/api/documents/${viewDoc.id}/file`}
                        alt={viewDoc.title}
                        className="doc-preview-img"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  ) : null}

                  {/* If PDF: embed interactive preview */}
                  {(viewDoc.mime === 'application/pdf' || viewDoc.filename?.toLowerCase().endsWith('.pdf')) && (
                    <div style={{ marginBottom: 16 }}>
                      <iframe
                        src={`/api/documents/${viewDoc.id}/file`}
                        title={viewDoc.title}
                        style={{ width: '100%', height: '540px', border: '1px solid var(--border)', borderRadius: 10, background: '#fff' }}
                      />
                    </div>
                  )}

                  <div style={{ textAlign: 'center', padding: '24px 20px', background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 44, marginBottom: 8 }}>{getFileIcon(viewDoc.mime, viewDoc.filename)}</div>
                    <h4 style={{ margin: '0 0 4px', fontSize: 16 }}>{viewDoc.filename}</h4>
                    <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                      File size: {Math.round((viewDoc.size_bytes || 0) / 1024)} KB · Format: {viewDoc.mime || 'Binary'}
                    </p>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => {
                          const safeName = viewDoc.filename || (viewDoc.title.endsWith('.pdf') ? viewDoc.title : `${viewDoc.title}.pdf`);
                          downloadFile(`/api/documents/${viewDoc.id}/download`, safeName);
                        }}
                      >
                        ⬇ Download File
                      </button>
                      {viewDoc.mime?.startsWith('image/') || viewDoc.mime === 'application/pdf' ? (
                        <a className="btn" href={`/api/documents/${viewDoc.id}/file`} target="_blank" rel="noreferrer">
                          🔗 Open in New Window
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {renderSimpleMarkdown(viewDoc.content)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WRITE DOCUMENT / SOP MODAL */}
      {showWriteModal && (
        <div className="overlay" onMouseDown={e => e.target === e.currentTarget && setShowWriteModal(false)}>
          <div className="modal" style={{ maxWidth: 680 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>✍️</span> Write Document / SOP
              </h3>
              <button className="btn ghost small" onClick={() => setShowWriteModal(false)}>✕</button>
            </div>

            {err && (
              <div className="error-card" style={{ marginBottom: 14 }}>
                <span>⚠</span>
                <span style={{ flex: 1 }}>{err}</span>
                <button className="btn small ghost" onClick={() => setErr('')}>Dismiss</button>
              </div>
            )}

            <form onSubmit={handleCreateWrittenDoc}>
              <div className="field">
                <label className="lbl">Document Title *</label>
                <input
                  className="inp"
                  placeholder="e.g. Standard Operating Procedure — Client Handoff"
                  value={writeForm.title}
                  onChange={e => setWriteForm({ ...writeForm, title: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              {/* What is this document for? */}
              <div className="field" style={{ marginTop: 12 }}>
                <label className="lbl">What is this document for?</label>
                <div className="purpose-toggle-group">
                  <button
                    type="button"
                    className={`purpose-toggle-btn ${writeForm.targetType === 'general' ? 'active' : ''}`}
                    onClick={() => setWriteForm({ ...writeForm, targetType: 'general', task_id: '' })}
                  >
                    <span>🏢</span> General Team Document
                  </button>
                  <button
                    type="button"
                    className={`purpose-toggle-btn ${writeForm.targetType === 'task' ? 'active' : ''}`}
                    onClick={() => setWriteForm({ ...writeForm, targetType: 'task' })}
                  >
                    <span>☑️</span> For a Specific Task
                  </button>
                </div>
              </div>

              {writeForm.targetType === 'task' && (
                <div className="field" style={{ marginTop: 10, background: '#f0fdfa', border: '1px solid #ccfbf1', padding: 12, borderRadius: 10 }}>
                  <label className="lbl">Select Associated Task *</label>
                  <select
                    className="sel"
                    value={writeForm.task_id}
                    onChange={e => setWriteForm({ ...writeForm, task_id: e.target.value })}
                    required
                  >
                    <option value="">-- Select Task --</option>
                    {tasksList.map(t => (
                      <option key={t.id} value={t.id}>{t.title} ({t.priority})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="field" style={{ marginTop: 12 }}>
                <label className="lbl">Category</label>
                <select
                  className="sel"
                  value={writeForm.category}
                  onChange={e => setWriteForm({ ...writeForm, category: e.target.value })}
                >
                  {CATEGORIES.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="lbl">Short Summary / Description</label>
                <input
                  className="inp"
                  placeholder="Brief summary of what this document contains…"
                  value={writeForm.description}
                  onChange={e => setWriteForm({ ...writeForm, description: e.target.value })}
                />
              </div>

              <div className="field">
                <label className="lbl">Document Content (Markdown supported)</label>
                <textarea
                  className="ta"
                  style={{ minHeight: 180, fontFamily: 'var(--font-mono)', fontSize: 13 }}
                  placeholder="# Document Header&#10;&#10;Write guidelines, checklist items (- [ ] Step), or notes here..."
                  value={writeForm.content}
                  onChange={e => setWriteForm({ ...writeForm, content: e.target.value })}
                />
                <div className="field-help">Supports # Headings, - Bullet points, - [ ] Checklists.</div>
              </div>

              <div className="mrow" style={{ marginTop: 18 }}>
                <button type="button" className="btn" onClick={() => setShowWriteModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={saving}>
                  {saving ? 'Saving…' : '✓ Save Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
