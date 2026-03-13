import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Scale, Search } from 'lucide-react';
import { judiciary } from '../api/client';

export default function JudiciaryPage() {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('KE');
  const [mode, setMode] = useState('live');
  const [results, setResults] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [availableSources, setAvailableSources] = useState([]);
  const [degradedMode, setDegradedMode] = useState(false);
  const [degradedReason, setDegradedReason] = useState('');

  useEffect(() => {
    judiciary.sources().then(({ data }) => setAvailableSources(data.sources || [])).catch(() => setAvailableSources([]));
  }, []);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setResults([]);
    setDegradedMode(false);
    setDegradedReason('');
    try {
      const { data } = await judiciary.search(query, region, mode);
      setResults(data.results || []);
      setSources(data.sources || []);
      setDegradedMode(Boolean(data.degraded_mode));
      setDegradedReason(data.degraded_reason || '');
    } catch (err) {
      setResults([{ title: 'Error', snippet: err.response?.data?.detail || 'Search failed', source: 'error' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="judiciary-page-modern">
      <div className="judiciary-main">
        <header className="judiciary-header">
          <Link to="/dashboard" className="back-link"><ArrowLeft size={16} /> Dashboard</Link>
          <div className="judiciary-hero">
            <span className="judiciary-badge"><Scale size={14} /> Judiciary</span>
            <h1>Judiciary Case Search</h1>
            <p>Search publicly available judiciary and case law databases</p>
          </div>
        </header>

        <div className="judiciary-search-card">
          <form onSubmit={handleSearch} className="judiciary-search-form">
            <input
              type="text"
              placeholder="e.g. employment dispute Nairobi"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="judiciary-search-input"
            />
            <div className="judiciary-search-row">
              <select value={region} onChange={(e) => setRegion(e.target.value)} className="judiciary-region-select">
                <option value="AF">Africa (all)</option>
                <option value="KE">Kenya</option>
                <option value="ZA">South Africa</option>
                <option value="NG">Nigeria</option>
              </select>
              <select value={mode} onChange={(e) => setMode(e.target.value)} className="judiciary-region-select">
                <option value="live">Live mode</option>
                <option value="fast">Fast mode</option>
              </select>
              <button type="submit" disabled={loading} className="judiciary-search-btn">
                <Search size={16} /> {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>
        </div>

        {degradedMode && (
          <p className="judiciary-config-note">
            Degraded mode: {degradedReason || 'Live primary legal sources are unavailable, showing fallback/local results.'}
          </p>
        )}

        {sources.length > 0 && (
          <p className="judiciary-sources-note">Sources: {sources.join(', ')}</p>
        )}

        {availableSources.length > 0 && (
          <p className="judiciary-config-note">Configured: {availableSources.join(', ')}</p>
        )}

        {results.length > 0 && (
          <ul className="judiciary-results">
            {results.map((r, i) => (
              <li key={i}>
                <strong>{r.title}</strong>
                {r.source && <span className="source-badge">{r.source}</span>}
                {r.source_type && <span>Type: {r.source_type}</span>}
                {r.court && <span>Court: {r.court}</span>}
                {r.date && <span>{r.date}</span>}
                {typeof r.confidence === 'number' && <span>Confidence: {Math.round(r.confidence * 100)}%</span>}
                {r.fetched_at && <span>Updated: {new Date(r.fetched_at).toLocaleString()}</span>}
                <p>{r.snippet}</p>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer">View</a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
