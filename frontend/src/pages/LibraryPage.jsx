import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Upload, FileText, Sparkles, Building2, User, Lock, Share2, Trash2, Download, X, ThumbsUp, ThumbsDown } from 'lucide-react';
import { knowledge } from '../api/client';

export default function LibraryPage() {
  const [aiQuery, setAiQuery] = useState('');
  const [aiAnswer, setAiAnswer] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [docScope, setDocScope] = useState('all'); // all | org | personal
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadVisibility, setUploadVisibility] = useState('private'); // private | public
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('documents');
  const [viewDoc, setViewDoc] = useState(null);
  const [viewDocContent, setViewDocContent] = useState(null);
  const [feedbackSent, setFeedbackSent] = useState(false);

  const refreshDocs = () => {
    knowledge.listDocuments(docScope).then(({ data }) => setDocuments(data)).catch(() => setDocuments([]));
  };

  useEffect(() => {
    knowledge.listDocuments(docScope).then(({ data }) => setDocuments(data)).catch(() => setDocuments([]));
  }, [docScope]);

  const handleAiQuery = async (e) => {
    e?.preventDefault();
    if (!aiQuery.trim()) return;
    setLoading(true);
    setAiAnswer(null);
    setFeedbackSent(false);
    setActiveTab('ai');
    try {
      const { data } = await knowledge.query(aiQuery, docScope);
      setAiAnswer({
        answer: data.answer,
        citations: data.citations || [],
        suggested_resources: data.suggested_resources || [],
        context_relevance: data.context_relevance,
        answer_relevance: data.answer_relevance,
        source: data.source,
      });
    } catch (err) {
      setAiAnswer({ answer: 'Error querying knowledge base.', citations: [], suggested_resources: [] });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e?.preventDefault();
    if (!uploadFile) return;
    setLoading(true);
    try {
      await knowledge.ingest(uploadFile, uploadTitle || undefined, uploadVisibility);
      setUploadFile(null);
      setUploadTitle('');
      refreshDocs();
    } catch (err) {
      alert(err.response?.data?.detail || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (d) => {
    if (d.is_org) return;
    if (!confirm(`Delete "${d.title}"?`)) return;
    try {
      await knowledge.deleteDocument(d.id);
      refreshDocs();
    } catch (err) {
      alert(err.response?.data?.detail || 'Delete failed');
    }
  };

  const handleViewDoc = async (d) => {
    setViewDoc(d);
    setViewDocContent(null);
    try {
      const { data } = await knowledge.getDocumentContent(d.id);
      setViewDocContent(data);
    } catch (err) {
      setViewDocContent({ error: err.response?.data?.detail || 'Failed to load' });
    }
  };

  const handleFeedback = async (rating) => {
    if (!aiAnswer || feedbackSent) return;
    try {
      await knowledge.feedback({
        query: aiQuery,
        answer: aiAnswer.answer,
        source: aiAnswer.source,
        context_relevance: aiAnswer.context_relevance,
        answer_relevance: aiAnswer.answer_relevance,
        rating,
      });
      setFeedbackSent(true);
    } catch (err) {
      // silent fail
    }
  };

  const handleDownloadDoc = async (d, e) => {
    e?.stopPropagation();
    try {
      const { data } = await knowledge.downloadDocument(d.id);
      const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = d.original_filename || `${(d.title || 'document').replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.detail || 'Download failed');
    }
  };

  return (
    <div className="library-page-modern">
      <header className="library-header">
        <Link to="/dashboard" className="back-link"><ArrowLeft size={16} /> Dashboard</Link>
        <div className="library-hero">
          <span className="library-badge"><BookOpen size={14} /> Knowledge Base</span>
          <h1>Your Mediation Library</h1>
          <p>Organization knowledge base + your personal documents. Upload with private or share to org.</p>
        </div>
      </header>

      <div className="library-upload-card">
        <div className="upload-icon"><Upload size={32} /></div>
        <h3>Add to My Knowledge Base</h3>
        <p>Upload to your personal library. Choose whether to share with the organization.</p>
        <form onSubmit={handleUpload} className="upload-form">
          <input
            type="text"
            placeholder="Title (optional)"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            className="upload-title-input"
          />
          <div className="visibility-toggle">
            <label className={uploadVisibility === 'private' ? 'active' : ''}>
              <input type="radio" name="visibility" value="private" checked={uploadVisibility === 'private'} onChange={() => setUploadVisibility('private')} />
              <Lock size={14} /> Private (only me)
            </label>
            <label className={uploadVisibility === 'public' ? 'active' : ''}>
              <input type="radio" name="visibility" value="public" checked={uploadVisibility === 'public'} onChange={() => setUploadVisibility('public')} />
              <Share2 size={14} /> Share with organization
            </label>
          </div>
          <div className="upload-row">
            <input
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              onChange={(e) => setUploadFile(e.target.files?.[0])}
              className="upload-file"
            />
            <button type="submit" disabled={!uploadFile || loading} className="upload-btn">
              {loading ? 'Ingesting…' : 'Ingest'}
            </button>
          </div>
        </form>
      </div>

      <div className="library-quick-search">
        <form onSubmit={handleAiQuery} className="library-ai-inline library-ai-single">
          <Sparkles size={20} />
          <input
            type="text"
            placeholder="Ask AI: e.g. employment disputes, best practices for family mediation, Kenya Law..."
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            className="ai-inline-input"
          />
          <button type="submit" disabled={loading}>{loading ? 'Thinking…' : 'Ask'}</button>
        </form>
      </div>

      <div className="library-tabs">
        <button className={activeTab === 'documents' ? 'active' : ''} onClick={() => setActiveTab('documents')}>
          <FileText size={16} /> Documents ({documents.length})
        </button>
        <button className={activeTab === 'ai' ? 'active' : ''} onClick={() => setActiveTab('ai')}>
          <Sparkles size={16} /> AI Answers
        </button>
      </div>

      {activeTab === 'documents' && (
        <section className="library-section">
          <div className="doc-scope-tabs">
            <button className={docScope === 'all' ? 'active' : ''} onClick={() => setDocScope('all')}><FileText size={14} /> All</button>
            <button className={docScope === 'org' ? 'active' : ''} onClick={() => setDocScope('org')}><Building2 size={14} /> Organization</button>
            <button className={docScope === 'personal' ? 'active' : ''} onClick={() => setDocScope('personal')}><User size={14} /> My Documents</button>
          </div>
          {documents.length === 0 ? (
            <div className="library-empty">
              <span className="empty-icon">📄</span>
              <p>{docScope === 'org' ? 'No organization documents.' : docScope === 'personal' ? 'No personal documents yet. Upload above.' : 'No documents yet.'}</p>
            </div>
          ) : (
            <ul className="doc-grid">
              {documents.map((d) => (
                <li key={d.id} className="doc-card doc-card-clickable" onClick={() => handleViewDoc(d)}>
                  <span className="doc-icon"><FileText size={20} /></span>
                  <span className="doc-title">{d.title}</span>
                  <span className={`doc-visibility-badge ${d.is_org ? 'org' : d.visibility}`}>
                    {d.is_org ? 'Org' : d.visibility === 'public' ? 'Shared' : 'Private'}
                  </span>
                  <div className="doc-card-actions">
                    <button className="doc-action-btn" onClick={(e) => handleDownloadDoc(d, e)} title="Download"><Download size={16} /></button>
                    {!d.is_org && (
                      <button className="doc-action-btn doc-delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(d); }} title="Delete"><Trash2 size={16} /></button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === 'ai' && (
        <section className="library-section">
          <div className="doc-scope-tabs">
            <button className={docScope === 'all' ? 'active' : ''} onClick={() => setDocScope('all')}><FileText size={14} /> All</button>
            <button className={docScope === 'org' ? 'active' : ''} onClick={() => setDocScope('org')}><Building2 size={14} /> Organization</button>
            <button className={docScope === 'personal' ? 'active' : ''} onClick={() => setDocScope('personal')}><User size={14} /> My Documents</button>
          </div>
          <form onSubmit={handleAiQuery} className="ai-form">
            <input
              type="text"
              placeholder="e.g. What are best practices for employment mediation?"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              className="ai-input"
            />
            <button type="submit" disabled={loading} className="ai-btn">
              <Sparkles size={16} /> {loading ? 'Thinking…' : 'Ask'}
            </button>
          </form>
          {aiAnswer && (
            <div className="ai-answer-card">
              <div className="ai-answer-header">
                <span className="ai-badge">✨ AI Answer</span>
                {(aiAnswer.context_relevance != null || aiAnswer.answer_relevance != null) && (
                  <span className="ai-relevance-badge" title="Context relevance / Answer relevance">
                    {aiAnswer.context_relevance != null && `Context: ${aiAnswer.context_relevance}%`}
                    {aiAnswer.context_relevance != null && aiAnswer.answer_relevance != null && ' · '}
                    {aiAnswer.answer_relevance != null && `Answer: ${aiAnswer.answer_relevance}%`}
                  </span>
                )}
                {aiAnswer.source && (
                  <span className={`ai-source-badge ${aiAnswer.source}`}>{aiAnswer.source === 'web_search' ? 'Web search' : 'Knowledge base'}</span>
                )}
              </div>
              <div className="ai-answer-text" style={{ whiteSpace: 'pre-wrap' }}>{aiAnswer.answer}</div>
              <div className="ai-feedback-row">
                <span className="feedback-label">Was this helpful?</span>
                <button
                  type="button"
                  className={`feedback-btn ${feedbackSent ? 'disabled' : ''}`}
                  onClick={() => handleFeedback(1)}
                  disabled={feedbackSent}
                  title="Yes, helpful"
                >
                  <ThumbsUp size={16} />
                </button>
                <button
                  type="button"
                  className={`feedback-btn ${feedbackSent ? 'disabled' : ''}`}
                  onClick={() => handleFeedback(-1)}
                  disabled={feedbackSent}
                  title="No, not helpful"
                >
                  <ThumbsDown size={16} />
                </button>
                {feedbackSent && <span className="feedback-thanks">Thanks for your feedback</span>}
              </div>
              {aiAnswer.citations?.length > 0 && (
                <div className="citations-modern">
                  <strong>From your knowledge base</strong>
                  <ul>
                    {aiAnswer.citations.map((c, i) => (
                      <li key={i}>{c.document_title}</li>
                    ))}
                  </ul>
                </div>
              )}
              {aiAnswer.suggested_resources?.length > 0 && (
                <div className="suggested-resources">
                  <strong>📥 Add to your knowledge base</strong>
                  <p className="suggested-desc">Download these PDFs and documents, then upload above.</p>
                  <ul className="suggested-links">
                    {aiAnswer.suggested_resources.map((r, i) => (
                      <li key={i}>
                        <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a>
                        {r.type && <span className="resource-type">{r.type}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {viewDoc && (
        <div className="modal-overlay" onClick={() => { setViewDoc(null); setViewDocContent(null); }}>
          <div className="modal-card modal-doc-view" onClick={(e) => e.stopPropagation()}>
            <div className="modal-doc-header">
              <h3>{viewDoc.title}</h3>
              <button type="button" className="btn-close" onClick={() => { setViewDoc(null); setViewDocContent(null); }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-doc-body">
              {viewDocContent === null ? (
                <p>Loading...</p>
              ) : viewDocContent.error ? (
                <p className="doc-error">{viewDocContent.error}</p>
              ) : (
                <pre className="doc-content">{viewDocContent.content_text || '(No content)'}</pre>
              )}
            </div>
            <div className="modal-doc-actions">
              {viewDocContent && !viewDocContent.error && (
                <button className="primary" onClick={() => handleDownloadDoc(viewDoc)}>
                  <Download size={16} /> Download
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
