import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cases } from '../api/client';

export default function NewCasePage() {
  const [disputeCategory, setDisputeCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await cases.create({ dispute_category: disputeCategory || null });
      navigate(`/cases/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create case');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="new-case">
      <header>
        <button onClick={() => navigate('/dashboard')}>← Back</button>
        <h1>New Case</h1>
      </header>
      <form onSubmit={handleSubmit}>
        {error && <div className="error">{error}</div>}
        <label>
          Dispute category
          <input
            type="text"
            placeholder="e.g. Employment, Commercial, Family"
            value={disputeCategory}
            onChange={(e) => setDisputeCategory(e.target.value)}
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Case'}
        </button>
      </form>
    </div>
  );
}
