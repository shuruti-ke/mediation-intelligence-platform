import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, BookOpen, Scale, GraduationCap, Calendar, FolderOpen } from 'lucide-react';
import { cases } from '../api/client';

export default function DashboardPage() {
  const [caseList, setCaseList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cases.list().then(({ data }) => setCaseList(data)).catch(() => setCaseList([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="dashboard">
      <header>
        <div className="dashboard-brand">
          <img src="/logo.png" alt="Mediation Intelligence Platform" className="dashboard-logo" />
          <h1>Mediation Dashboard</h1>
        </div>
        <nav>
          <Link to="/cases/new"><Plus size={16} /> New Case</Link>
          <Link to="/library"><BookOpen size={16} /> Library</Link>
          <Link to="/judiciary"><Scale size={16} /> Judiciary</Link>
          <Link to="/training"><GraduationCap size={16} /> Training</Link>
          <Link to="/calendar"><Calendar size={16} /> Calendar</Link>
        </nav>
      </header>
      <section>
        <h2 className="icon-text"><FolderOpen size={22} /> Cases</h2>
        {loading ? (
          <p>Loading...</p>
        ) : caseList.length === 0 ? (
          <p>No cases yet. <Link to="/cases/new"><Plus size={14} /> Create your first case</Link></p>
        ) : (
          <ul className="case-list">
            {caseList.map((c) => (
              <li key={c.id}>
                <Link to={`/cases/${c.id}`}>
                  <span className="case-number">{c.case_number}</span>
                  <span className="case-status">{c.status}</span>
                  <span className="case-category">{c.dispute_category || '-'}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
