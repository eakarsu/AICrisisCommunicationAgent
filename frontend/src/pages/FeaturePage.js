import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Plus, Edit3, Trash2, X, Sparkles, Loader2, AlertTriangle, CheckCircle,
} from 'lucide-react';

function formatDate(val) {
  if (!val) return '-';
  try {
    return new Date(val).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return val; }
}

function formatCellValue(val, col) {
  if (val === null || val === undefined) return '-';
  if (col.boolean) return val ? 'Yes' : 'No';
  if (col.date) return formatDate(val);
  if (col.badge) return val;
  if (typeof val === 'string' && val.length > 80) return val.substring(0, 80) + '...';
  return String(val);
}

function AIOutputDisplay({ content }) {
  if (!content) return null;
  const text = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content);

  // Parse markdown-like content into sections
  const sections = [];
  const lines = text.split('\n');
  let currentSection = { title: '', content: [] };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
      if (currentSection.title || currentSection.content.length > 0) {
        sections.push({ ...currentSection });
      }
      currentSection = { title: trimmed.replace(/^#+\s*/, ''), content: [] };
    } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      if (currentSection.title || currentSection.content.length > 0) {
        sections.push({ ...currentSection });
      }
      currentSection = { title: trimmed.replace(/\*\*/g, ''), content: [] };
    } else if (trimmed.startsWith('# ')) {
      if (currentSection.title || currentSection.content.length > 0) {
        sections.push({ ...currentSection });
      }
      currentSection = { title: trimmed.replace(/^#\s*/, ''), content: [] };
    } else {
      currentSection.content.push(line);
    }
  });
  if (currentSection.title || currentSection.content.length > 0) {
    sections.push(currentSection);
  }

  if (sections.length <= 1 && !sections[0]?.title) {
    return (
      <div className="ai-output">
        <div className="ai-output-inner">
          <div className="ai-output-header">
            <span className="ai-output-badge"><Sparkles size={12} /> AI Generated</span>
            <span className="ai-output-title">Analysis Result</span>
          </div>
          <div className="ai-output-section">
            {text.split('\n').map((line, i) => {
              const t = line.trim();
              if (!t) return <br key={i} />;
              if (t.startsWith('- ') || t.startsWith('• ') || t.startsWith('* ')) {
                return <ul key={i}><li>{renderInline(t.replace(/^[-•*]\s*/, ''))}</li></ul>;
              }
              if (/^\d+[\.\)]\s/.test(t)) {
                return <ul key={i}><li>{renderInline(t.replace(/^\d+[\.\)]\s*/, ''))}</li></ul>;
              }
              if (t.startsWith('>')) {
                return <blockquote key={i}>{renderInline(t.replace(/^>\s*/, ''))}</blockquote>;
              }
              return <p key={i}>{renderInline(t)}</p>;
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-output">
      <div className="ai-output-inner">
        <div className="ai-output-header">
          <span className="ai-output-badge"><Sparkles size={12} /> AI Generated</span>
          <span className="ai-output-title">Analysis Result</span>
        </div>
        {sections.map((section, si) => (
          <div key={si} className="ai-output-section">
            {section.title && <h3>{section.title}</h3>}
            {section.content.map((line, li) => {
              const t = line.trim();
              if (!t) return <br key={li} />;
              if (t.startsWith('- ') || t.startsWith('• ') || t.startsWith('* ')) {
                return <ul key={li}><li>{renderInline(t.replace(/^[-•*]\s*/, ''))}</li></ul>;
              }
              if (/^\d+[\.\)]\s/.test(t)) {
                return <ul key={li}><li>{renderInline(t.replace(/^\d+[\.\)]\s*/, ''))}</li></ul>;
              }
              if (t.startsWith('>')) {
                return <blockquote key={li}>{renderInline(t.replace(/^>\s*/, ''))}</blockquote>;
              }
              return <p key={li}>{renderInline(t)}</p>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderInline(text) {
  // Handle bold **text** and *italic*
  const parts = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch) {
      const idx = remaining.indexOf(boldMatch[0]);
      if (idx > 0) parts.push(<span key={key++}>{remaining.substring(0, idx)}</span>);
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.substring(idx + boldMatch[0].length);
    } else {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
  }
  return parts;
}

// Toast notification
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast toast-${type}`}>
      {type === 'success' && <CheckCircle size={18} style={{ color: 'var(--success)' }} />}
      {type === 'error' && <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />}
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={onClose}><X size={14} /></button>
    </div>
  );
}

export default function FeaturePage({ config }) {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // list | detail | create | edit
  const [formData, setFormData] = useState({});
  const [aiFormData, setAiFormData] = useState({});
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [saving, setSaving] = useState(false);

  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await config.apiGetAll();
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Fetch error:', err);
      addToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    fetchItems();
    setView('list');
    setSelectedItem(null);
    setAiResult(null);
    setAiFormData({});
  }, [fetchItems]);

  const handleRowClick = async (item) => {
    try {
      const res = await config.apiGetOne(item.id);
      setSelectedItem(res.data);
      setView('detail');
    } catch {
      setSelectedItem(item);
      setView('detail');
    }
  };

  const handleCreate = () => {
    const initial = {};
    config.fields.forEach((f) => {
      initial[f.key] = f.type === 'checkbox' ? false : '';
    });
    setFormData(initial);
    setView('create');
  };

  const handleEdit = () => {
    const data = {};
    config.fields.forEach((f) => {
      let val = selectedItem[f.key];
      if (f.type === 'datetime-local' && val) {
        val = new Date(val).toISOString().slice(0, 16);
      }
      data[f.key] = val ?? '';
    });
    setFormData(data);
    setView('edit');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (view === 'create') {
        await config.apiCreate(formData);
        addToast('Created successfully');
      } else {
        await config.apiUpdate(selectedItem.id, formData);
        addToast('Updated successfully');
      }
      await fetchItems();
      setView('list');
      setSelectedItem(null);
    } catch (err) {
      addToast(err.response?.data?.error || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await config.apiDelete(selectedItem.id);
      addToast('Deleted successfully');
      setShowDeleteConfirm(false);
      await fetchItems();
      setView('list');
      setSelectedItem(null);
    } catch (err) {
      addToast('Delete failed', 'error');
    }
  };

  const handleAIGenerate = async () => {
    if (!config.aiGenerate) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await config.aiGenerate(aiFormData);
      setAiResult(res.data);
      addToast('AI generation complete');
    } catch (err) {
      addToast(err.response?.data?.error || 'AI generation failed', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const handleBack = () => {
    setView('list');
    setSelectedItem(null);
  };

  // --- RENDER ---

  // List View
  if (view === 'list') {
    return (
      <div className="feature-page">
        <div className="toast-container">
          {toasts.map((t) => (
            <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
          ))}
        </div>

        <div className="feature-header">
          <div className="feature-header-left">
            <h1>{config.title}</h1>
            {config.isAI && <span className="ai-output-badge" style={{ fontSize: '10px' }}><Sparkles size={10} /> AI-Powered</span>}
          </div>
          <div className="feature-header-actions">
            <button className="btn btn-primary" onClick={handleCreate}>
              <Plus size={16} /> New {config.title.replace(/s$/, '').replace(/ses$/, 's').replace(/ies$/, 'y')}
            </button>
          </div>
        </div>

        {/* AI Generate Panel */}
        {config.aiGenerate && (
          <div className="ai-generate-panel">
            <div className="ai-generate-header">
              <Sparkles size={20} style={{ color: 'var(--accent-primary)' }} />
              <h3>{config.aiLabel || 'AI Generate'}</h3>
            </div>
            {config.aiFields.map((field) => (
              <div className="form-group" key={field.key}>
                <label className="form-label">
                  {field.label}
                  {field.required && <span className="required">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    className="form-textarea"
                    value={aiFormData[field.key] || ''}
                    onChange={(e) => setAiFormData({ ...aiFormData, [field.key]: e.target.value })}
                    placeholder={`Enter ${field.label.toLowerCase()}...`}
                    rows={3}
                  />
                ) : field.type === 'select' ? (
                  <select
                    className="form-select"
                    value={aiFormData[field.key] || ''}
                    onChange={(e) => setAiFormData({ ...aiFormData, [field.key]: e.target.value })}
                  >
                    <option value="">Select {field.label}...</option>
                    {field.options.map((o) => (
                      <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    className="form-input"
                    value={aiFormData[field.key] || ''}
                    onChange={(e) => setAiFormData({ ...aiFormData, [field.key]: e.target.value })}
                    placeholder={`Enter ${field.label.toLowerCase()}...`}
                  />
                )}
              </div>
            ))}
            <div className="ai-generate-actions">
              <button
                className="btn btn-ai"
                onClick={handleAIGenerate}
                disabled={aiLoading}
              >
                {aiLoading ? <><Loader2 size={16} className="spinning" /> Generating...</> : <><Sparkles size={16} /> {config.aiLabel || 'Generate with AI'}</>}
              </button>
            </div>
            {aiResult && (
              <AIOutputDisplay
                content={
                  aiResult.generated_content ||
                  (config.aiResponseField && aiResult[config.aiResponseField]) ||
                  aiResult.ai_analysis || aiResult.ai_response || aiResult.analysis ||
                  aiResult.content || aiResult.message || aiResult.points || aiResult
                }
              />
            )}
          </div>
        )}

        {/* Data Table */}
        <div className="data-table-container">
          {loading ? (
            <div className="loading-container">
              <div className="spinner spinner-large" />
              <p>Loading {config.title.toLowerCase()}...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="data-table-empty">
              <AlertTriangle size={40} />
              <p>No {config.title.toLowerCase()} found</p>
              <span>Click "New" to create one</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  {config.columns.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} onClick={() => handleRowClick(item)}>
                    {config.columns.map((col) => (
                      <td key={col.key}>
                        {col.badge ? (
                          <span className={`badge badge-${(item[col.key] || 'default').toLowerCase().replace(/\s/g, '_')}`}>
                            {item[col.key] || '-'}
                          </span>
                        ) : col.boolean ? (
                          item[col.key] ? (
                            <span className="badge badge-approved">Yes</span>
                          ) : (
                            <span className="badge badge-default">No</span>
                          )
                        ) : (
                          formatCellValue(item[col.key], col)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // Detail View
  if (view === 'detail' && selectedItem) {
    return (
      <div className="feature-page">
        <div className="toast-container">
          {toasts.map((t) => (
            <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
          ))}
        </div>

        <div className="detail-panel">
          <button className="detail-back" onClick={handleBack}>
            <ArrowLeft size={16} /> Back to {config.title}
          </button>

          <div className="detail-header">
            <h1 className="detail-title">
              {selectedItem.title || selectedItem.name || selectedItem.scenario_name || selectedItem.topic || selectedItem.event_title || `${config.title} #${selectedItem.id}`}
            </h1>
            <div className="detail-actions">
              <button className="btn btn-secondary" onClick={handleEdit}>
                <Edit3 size={16} /> Edit
              </button>
              <button className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </div>

          <div className="detail-grid">
            {config.fields.map((field) => {
              const val = selectedItem[field.key];
              const isLong = field.type === 'textarea' || (typeof val === 'string' && val.length > 100);
              return (
                <div key={field.key} className={`detail-field ${isLong ? 'full-width' : ''}`}>
                  <div className="detail-field-label">{field.label}</div>
                  <div className="detail-field-value">
                    {field.type === 'checkbox' ? (val ? 'Yes' : 'No') :
                     field.type === 'datetime-local' && val ? formatDate(val) :
                     val || '-'}
                  </div>
                </div>
              );
            })}
            {selectedItem.created_at && (
              <div className="detail-field">
                <div className="detail-field-label">Created At</div>
                <div className="detail-field-value">{formatDate(selectedItem.created_at)}</div>
              </div>
            )}
          </div>

          {/* AI analysis display for AI-powered features */}
          {config.isAI && (selectedItem.ai_analysis || selectedItem.content || selectedItem.points) && (
            <AIOutputDisplay content={selectedItem.ai_analysis || selectedItem.content || selectedItem.points} />
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
              <div className="modal-body">
                <div className="confirm-dialog">
                  <div className="confirm-dialog-icon">
                    <Trash2 size={24} />
                  </div>
                  <h3>Delete Item</h3>
                  <p>Are you sure you want to delete this item? This action cannot be undone.</p>
                  <div className="confirm-dialog-actions">
                    <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                    <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Create / Edit View (Modal-style form)
  if (view === 'create' || view === 'edit') {
    return (
      <div className="feature-page">
        <div className="toast-container">
          {toasts.map((t) => (
            <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
          ))}
        </div>

        <div className="modal-overlay" onClick={handleBack}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {view === 'create' ? `New ${config.title.replace(/s$/, '')}` : 'Edit Item'}
              </h2>
              <button className="modal-close" onClick={handleBack}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {config.fields.map((field) => (
                <div className="form-group" key={field.key}>
                  <label className="form-label">
                    {field.label}
                    {field.required && <span className="required">*</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      className="form-textarea"
                      value={formData[field.key] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      className="form-select"
                      value={formData[field.key] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    >
                      <option value="">Select {field.label}...</option>
                      {field.options.map((o) => (
                        <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1).replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!formData[field.key]}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.checked })}
                      />
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{field.label}</span>
                    </label>
                  ) : (
                    <input
                      type={field.type}
                      className="form-input"
                      value={formData[field.key] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleBack}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 size={16} className="spinning" /> Saving...</> : view === 'create' ? 'Create' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
