import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { trainingApi } from '../api/client';

export default function TrainingModulePage() {
  const { id } = useParams();
  const [module, setModule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!id) return;
    trainingApi.getModule(id)
      .then(({ data }) => {
        setModule(data);
        setProgress(data.progress_pct ?? 0);
        setCompleted(data.completed ?? false);
      })
      .catch(() => setModule(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleComplete = async () => {
    try {
      await trainingApi.updateProgress(id, { progress_pct: 100, completed: true });
      setProgress(100);
      setCompleted(true);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !module) return <p>Loading...</p>;

  return (
    <div className="training-module-page">
      <header>
        <Link to="/training">← Back to Training</Link>
        <h1>{module.title}</h1>
      </header>
      <section className="module-content">
        <div className="content-html" dangerouslySetInnerHTML={{ __html: module.content_html || '' }} />
        <div className="module-actions">
          <p>Progress: {progress}%</p>
          {!completed && (
            <button onClick={handleComplete} className="primary">
              Mark as Complete
            </button>
          )}
          {completed && <span className="badge completed">Completed</span>}
        </div>
      </section>
    </div>
  );
}
