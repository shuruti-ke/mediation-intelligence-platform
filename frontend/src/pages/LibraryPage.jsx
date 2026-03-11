import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { knowledge } from '../api/client';

export default function LibraryPage() {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [aiQuery, setAiQuery] = useState('');
  const [aiAnswer, setAiAnswer] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('documents'); // documents | search | ai

  useEffect(() => {
    knowledge.listDocuments().then(({ data }) => setDocuments(data)).catch(() => setDocuments([]));
  }, []);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setActiveTab('search');
    try {
      const { data } = await knowledge.search(query);
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
      const { data } = await knowledge.query(aiQuery);
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
      await knowledge.ingest(uploadFile, uploadTitle || undefined);
      setUploadFile(null);
      setUploadTitle('');
      knowledge.listDocuments().then(({ data }) => setDocuments(data));
    } catch (err) {
      alert(err.response?.data?.detail || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="library-page-modern">
      <header className="library-header">
        <Link to="/dashboard" className="back-link">← Dashboard</Link>
        <div className="library-hero">
          <span className="library-badge">📚 Knowledge Base</span>
          <h1>Your Mediation Library</h1>
          <p>Upload documents, search, and ask AI-powered questions.</p>
        </div>
      </header>

      <div className="library-upload-card">
        <div className="upload-icon">📤</div>
        <h3>Add Document</h3>
        <p>PDF, DOCX, or TXT. Files are automatically indexed for search.</p>
        <form onSubmit={handleUpload} className="upload-form">
          <input
            type="text"
            placeholder="Title (optional)"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            className="upload-title-input"
          />
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
          {documents.length === 0 ? (
            <div className="library-empty">
              <span className="empty-icon">📄</span>
              <p>No documents yet. Upload your first document above.</p>
            </div>
          ) : (
            <ul className="doc-grid">
              {documents.map((d) => (
                <li key={d.id} className="doc-card">
                  <span className="doc-icon">📑</span>
                  <span className="doc-title">{d.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === 'search' && (
        <section className="library-section">
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
