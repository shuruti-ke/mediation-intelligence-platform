import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Scale, Search } from 'lucide-react';
import { judiciary } from '../api/client';

export default function JudiciaryPage() {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('KE');
  const [results, setResults] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [availableSources, setAvailableSources] = useState([]);

  useEffect(() => {
    judiciary.sources().then(({ data }) => setAvailableSources(data.sources || [])).catch(() => setAvailableSources([]));
  }, []);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setResults([]);
    try {
      const { data } = await judiciary.search(query, region);
      setResults(data.results || []);
      setSources(data.sources || []);
    } catch (err) {
      setResults([{ title: 'Error', snippet: err.response?.data?.detail || 'Search failed', source: 'error' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="judiciary-page">
      <Link to="/dashboard" className="back-link"><ArrowLeft size={16} /> Dashboard</Link>
      <h1 className="icon-text"><Scale size={28} /> Judiciary Case Search</h1>
      <p className="subtitle">Search publicly available judiciary and case law databases</p>

      <section>
        <form onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="e.g. employment dispute Nairobi"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="KE">Kenya</option>
            <option value="ZA">South Africa</option>
            <option value="NG">Nigeria</option>
          </select>
          <button type="submit" disabled={loading}>
            <Search size={16} /> {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </section>

      {sources.length > 0 && (
        <p className="sources-note">Sources: {sources.join(', ')}</p>
      )}

      {availableSources.length > 0 && (
        <p className="config-note">Configured: {availableSources.join(', ')}</p>
      )}

      {results.length > 0 && (
        <ul className="judiciary-results">
          {results.map((r, i) => (
            <li key={i}>
              <strong>{r.title}</strong>
              {r.source && <span className="source-badge">{r.source}</span>}
              {r.court && <span>Court: {r.court}</span>}
              {r.date && <span>{r.date}</span>}
              <p>{r.snippet}</p>
              {r.url && (
                <a href={r.url} target="_blank" rel="noreferrer">View</a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
