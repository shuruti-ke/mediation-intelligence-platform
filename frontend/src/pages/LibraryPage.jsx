import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { knowledge } from '../api/client';

export default function LibraryPage() {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [aiQuery, setAiQuery] = useState('');
  const [aiAnswer, setAiAnswer] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [docScope, setDocScope] = useState('all'); // all | org | personal
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadVisibility, setUploadVisibility] = useState('private'); // private | public
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('documents');

  const refreshDocs = () => {
    knowledge.listDocuments(docScope).then(({ data }) => setDocuments(data)).catch(() => setDocuments([]));
  };

  useEffect(() => {
    knowledge.listDocuments(docScope).then(({ data }) => setDocuments(data)).catch(() => setDocuments([]));
  }, [docScope]);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setActiveTab('search');
    try {
      const { data } = await knowledge.search(query, docScope);
      setSearchResults(data.results || []);
    } catch (err) {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAiQuery = async (e) => {
    e?.preventDefault();
    if (!aiQuery.trim()) return;
    setLoading(true);
    setAiAnswer(null);
    setActiveTab('ai');
    try {
      const { data } = await knowledge.query(aiQuery, docScope);
      setAiAnswer({ answer: data.answer, citations: data.citations || [] });
    } catch (err) {
      setAiAnswer({ answer: 'Error querying knowledge base.', citations: [] });
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

  return (
    <div className="library-page-modern">
      <header className="library-header">
        <Link to="/dashboard" className="back-link">← Dashboard</Link>
        <div className="library-hero">
          <span className="library-badge">📚 Knowledge Base</span>
          <h1>Your Mediation Library</h1>
          <p>Organization knowledge base + your personal documents. Upload with private or share to org.</p>
        </div>
      </header>

      <div className="library-upload-card">
        <div className="upload-icon">📤</div>
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
              Private (only me)
            </label>
            <label className={uploadVisibility === 'public' ? 'active' : ''}>
              <input type="radio" name="visibility" value="public" checked={uploadVisibility === 'public'} onChange={() => setUploadVisibility('public')} />
              Share with organization
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

      <div className="library-tabs">
        <button className={activeTab === 'documents' ? 'active' : ''} onClick={() => setActiveTab('documents')}>
          Documents ({documents.length})
        </button>
        <button className={activeTab === 'search' ? 'active' : ''} onClick={() => setActiveTab('search')}>
          Search
        </button>
        <button className={activeTab === 'ai' ? 'active' : ''} onClick={() => setActiveTab('ai')}>
          Ask AI
        </button>
      </div>

      {activeTab === 'documents' && (
        <section className="library-section">
          <div className="doc-scope-tabs">
            <button className={docScope === 'all' ? 'active' : ''} onClick={() => setDocScope('all')}>All</button>
            <button className={docScope === 'org' ? 'active' : ''} onClick={() => setDocScope('org')}>Organization</button>
            <button className={docScope === 'personal' ? 'active' : ''} onClick={() => setDocScope('personal')}>My Documents</button>
          </div>
          {documents.length === 0 ? (
            <div className="library-empty">
              <span className="empty-icon">📄</span>
              <p>{docScope === 'org' ? 'No organization documents.' : docScope === 'personal' ? 'No personal documents yet. Upload above.' : 'No documents yet.'}</p>
            </div>
          ) : (
            <ul className="doc-grid">
              {documents.map((d) => (
                <li key={d.id} className="doc-card">
                  <span className="doc-icon">📑</span>
                  <span className="doc-title">{d.title}</span>
                  <span className={`doc-visibility-badge ${d.is_org ? 'org' : d.visibility}`}>
                    {d.is_org ? 'Org' : d.visibility === 'public' ? 'Shared' : 'Private'}
                  </span>
                  {!d.is_org && (
                    <button className="doc-delete-btn" onClick={() => handleDelete(d)} title="Delete">×</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === 'search' && (
        <section className="library-section">
          <div className="doc-scope-tabs">
            <button className={docScope === 'all' ? 'active' : ''} onClick={() => setDocScope('all')}>All</button>
            <button className={docScope === 'org' ? 'active' : ''} onClick={() => setDocScope('org')}>Organization</button>
            <button className={docScope === 'personal' ? 'active' : ''} onClick={() => setDocScope('personal')}>My Documents</button>
          </div>
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              placeholder="Search knowledge base..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search-input"
            />
            <button type="submit" disabled={loading} className="search-btn">
              {loading ? '…' : 'Search'}
            </button>
          </form>
          {searchResults.length > 0 && (
            <ul className="search-results-modern">
              {searchResults.map((r, i) => (
                <li key={i} className="search-result-card">
                  <strong>{r.document_title}</strong>
                  {r.is_org && <span className="result-badge">Org</span>}
                  <p>{r.content}</p>
                </li>
              ))}
            </ul>
          )}
          {activeTab === 'search' && searchResults.length === 0 && query && !loading && (
            <p className="no-results">No results found.</p>
          )}
        </section>
      )}

      {activeTab === 'ai' && (
        <section className="library-section">
          <div className="doc-scope-tabs">
            <button className={docScope === 'all' ? 'active' : ''} onClick={() => setDocScope('all')}>All</button>
            <button className={docScope === 'org' ? 'active' : ''} onClick={() => setDocScope('org')}>Organization</button>
            <button className={docScope === 'personal' ? 'active' : ''} onClick={() => setDocScope('personal')}>My Documents</button>
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
              {loading ? 'Thinking…' : 'Ask'}
            </button>
          </form>
          {aiAnswer && (
            <div className="ai-answer-card">
              <span className="ai-badge">✨ AI Answer</span>
              <p className="ai-answer-text">{aiAnswer.answer}</p>
              {aiAnswer.citations?.length > 0 && (
                <div className="citations-modern">
                  <strong>Sources</strong>
                  <ul>
                    {aiAnswer.citations.map((c, i) => (
                      <li key={i}>{c.document_title}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
