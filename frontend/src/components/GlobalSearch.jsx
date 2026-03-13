import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, FileText, ChevronRight } from 'lucide-react';
import { searchApi } from '../api/client';

const RECENT_KEY = 'search_recent';
const MAX_RECENT = 5;

const ROLE_LABELS = {
  client_individual: 'Individual',
  client_corporate: 'Corporate',
  mediator: 'Mediator',
  trainee: 'Trainee',
};

const STATUS_DOT = {
  active: 'status-dot-active',
  inactive: 'status-dot-inactive',
  pending: 'status-dot-pending',
};

function getInitials(name) {
  if (!name || typeof name !== 'string') return '?';
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function getRecentSearches() {
  try {
    const s = localStorage.getItem(RECENT_KEY);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

function addRecentSearch(q) {
  const qq = (q || '').trim();
  if (!qq) return;
  let recent = getRecentSearches().filter((r) => r !== qq);
  recent.unshift(qq);
  recent = recent.slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

export default function GlobalSearch({ className = '', compact = false }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ users: [], cases: [] });
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [recent, setRecent] = useState(getRecentSearches);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const flatItems = [
    ...results.users.map((u) => ({ ...u, type: 'user' })),
    ...results.cases.map((c) => ({ ...c, type: 'case' })),
  ];

  const search = useCallback(async (q) => {
    const qq = (q || '').trim();
    if (qq.length < 2) {
      setResults({ users: [], cases: [] });
      return;
    }
    setLoading(true);
    try {
      const { data } = await searchApi.unified({ q: qq, limit: 15 });
      setResults({ users: data.users || [], cases: data.cases || [] });
      setFocusedIndex(-1);
      addRecentSearch(qq);
      setRecent(getRecentSearches());
    } catch {
      setResults({ users: [], cases: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && inputRef.current && !inputRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'Escape') return;
      setOpen(true);
    }
    if (e.key === 'Escape') {
      setOpen(false);
      setFocusedIndex(-1);
      inputRef.current?.blur();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => (i < flatItems.length - 1 ? i + 1 : i));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => (i > 0 ? i - 1 : -1));
      return;
    }
    if (e.key === 'Enter' && focusedIndex >= 0 && flatItems[focusedIndex]) {
      e.preventDefault();
      const item = flatItems[focusedIndex];
      if (item.type === 'user') navigate(`/users/${item.id}`);
      else navigate(`/cases/${item.id}`);
      setOpen(false);
      setQuery('');
    }
  };

  const handleSelect = (item) => {
    if (item.type === 'user') navigate(`/users/${item.id}`);
    else navigate(`/cases/${item.id}`);
    setOpen(false);
    setQuery('');
  };

  const hasResults = results.users.length > 0 || results.cases.length > 0;
  const showDropdown = open && (query.trim().length >= 2 || recent.length > 0);

  return (
    <div className={`global-search-wrap ${className}`} ref={dropdownRef}>
      <div className="global-search-input-wrap">
        <Search size={18} className="global-search-icon" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search by User ID, Name, Email, Case..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="global-search-input"
          aria-label="Search"
        />
        {loading && <span className="global-search-loading">...</span>}
      </div>
      {showDropdown && (
        <div className="global-search-dropdown">
          {query.trim().length < 2 ? (
            <div className="global-search-recent">
              <h4>Recent searches</h4>
              {recent.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="global-search-recent-item"
                  onClick={() => { setQuery(r); inputRef.current?.focus(); }}
                >
                  <Search size={14} />
                  {r}
                </button>
              ))}
            </div>
          ) : (
            <>
              {!hasResults && !loading && (
                <p className="global-search-empty">No results for &quot;{query}&quot;</p>
              )}
              {results.users.length > 0 && (
                <div className="global-search-group">
                  <h4><User size={14} /> Users</h4>
                  {results.users.map((u, i) => (
                    <button
                      key={`u-${u.id}`}
                      type="button"
                      className={`global-search-card ${focusedIndex === i ? 'focused' : ''}`}
                      onClick={() => handleSelect({ ...u, type: 'user' })}
                    >
                      <span className="global-search-avatar">{getInitials(u.display_name)}</span>
                      <div className="global-search-card-body">
                        <span className="global-search-name">{u.display_name || u.email}</span>
                        <span className="global-search-id">{u.user_id || u.email}</span>
                        <div className="global-search-meta">
                          <span className={`badge badge-${u.role === 'client_individual' || u.role === 'client_corporate' ? 'teal' : 'indigo'}`}>
                            {ROLE_LABELS[u.role] || u.role}
                          </span>
                          <span className={`status-dot ${STATUS_DOT[u.status] || STATUS_DOT.active}`} title={u.status} />
                        </div>
                      </div>
                      <ChevronRight size={16} className="global-search-arrow" />
                    </button>
                  ))}
                </div>
              )}
              {results.cases.length > 0 && (
                <div className="global-search-group">
                  <h4><FileText size={14} /> Cases</h4>
                  {results.cases.map((c, i) => (
                    <button
                      key={`c-${c.id}`}
                      type="button"
                      className={`global-search-card ${focusedIndex === results.users.length + i ? 'focused' : ''}`}
                      onClick={() => handleSelect({ ...c, type: 'case' })}
                    >
                      <span className="global-search-avatar global-search-avatar-case"><FileText size={16} /></span>
                      <div className="global-search-card-body">
                        <span className="global-search-name">{c.title || c.case_number}</span>
                        <span className="global-search-id">{c.case_number}{c.internal_reference ? ` • ${c.internal_reference}` : ''}</span>
                        <div className="global-search-meta">
                          <span className="badge badge-pending">{c.status}</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="global-search-arrow" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
