import { useState, useEffect } from 'react';
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

  useEffect(() => {
    knowledge.listDocuments().then(({ data }) => setDocuments(data)).catch(() => setDocuments([]));
  }, []);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
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
    <div className="library-page">
      <h1>Knowledge Base</h1>

      <section className="library-section">
        <h2>Add Document</h2>
        <form onSubmit={handleUpload}>
          <input
            type="text"
            placeholder="Title (optional)"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
          />
          <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={(e) => setUploadFile(e.target.files?.[0])} />
          <button type="submit" disabled={!uploadFile || loading}>Ingest</button>
        </form>
      </section>

      <section className="library-section">
        <h2>Search</h2>
        <form onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search knowledge base..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" disabled={loading}>Search</button>
        </form>
        {searchResults.length > 0 && (
          <ul className="search-results">
            {searchResults.map((r, i) => (
              <li key={i}>
                <strong>{r.document_title}</strong>
                <p>{r.content}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="library-section">
        <h2>Ask AI</h2>
        <form onSubmit={handleAiQuery}>
          <input
            type="text"
            placeholder="e.g. What are best practices for employment mediation?"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
          />
          <button type="submit" disabled={loading}>Query</button>
        </form>
        {aiAnswer && (
          <div className="ai-answer">
            <p>{aiAnswer.answer}</p>
            {aiAnswer.citations?.length > 0 && (
              <div className="citations">
                <strong>Sources:</strong>
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

      <section className="library-section">
        <h2>Documents ({documents.length})</h2>
        <ul className="doc-list">
          {documents.map((d) => (
            <li key={d.id}>{d.title}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
