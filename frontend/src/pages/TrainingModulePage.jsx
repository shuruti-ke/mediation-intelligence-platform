import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { trainingApi } from '../api/client';

const MODULE_REFLECT_PROMPTS = {
  orientation: 'How might the platform\'s structure support—or limit—your ability to remain neutral in a case?',
  ethics: 'When have you faced a situation where confidentiality and transparency seemed to conflict? How did you navigate it?',
  online_mediation_intro: 'What unique challenges does online mediation pose for reading non-verbal cues? How might you compensate?',
};

export default function TrainingModulePage() {
  const { id } = useParams();
  const [module, setModule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    trainingApi.getModule(id)
      .then(({ data }) => {
        setModule(data);
        setProgress(data.progress_pct ?? 0);
        setCompleted(data.completed ?? false);
        const cfg = data.interactive_config;
        if (cfg?.steps?.length) {
          setCurrentStep(cfg.steps[0]);
        } else {
          setCurrentStep(null);
        }
      })
      .catch(() => setModule(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleChoice = async (choiceIdx) => {
    if (!module?.interactive_config || submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const { data } = await trainingApi.respondToStep(id, { step_id: currentStep.id, choice_idx: choiceIdx });
      setProgress(data.progress_pct ?? progress);
      setCompleted(data.completed ?? false);
      if (data.feedback) setFeedback(data.feedback);
      if (data.next_step) {
        setCurrentStep(data.next_step);
      } else if (data.completed || !data.next_step_id) {
        setCurrentStep(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdvance = async () => {
    if (!module?.interactive_config || submitting || !currentStep?.next) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const { data } = await trainingApi.respondToStep(id, { step_id: currentStep.id, text: 'continue' });
      setProgress(data.progress_pct ?? progress);
      setCompleted(data.completed ?? false);
      setCurrentStep(data.next_step ?? module.interactive_config.steps.find(s => s.id === currentStep.next) ?? null);
    } catch (err) {
      console.error(err);
      setCurrentStep(module.interactive_config.steps.find(s => s.id === currentStep.next) ?? null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async () => {
    try {
      await trainingApi.updateProgress(id, { progress_pct: 100, completed: true });
      setProgress(100);
      setCompleted(true);
    } catch (err) {
      console.error(err);
    }
  };

  const reflectPrompt = module ? MODULE_REFLECT_PROMPTS[module.slug] : null;
  const isInteractive = module?.interactive_config && currentStep;

  if (loading || !module) {
    return (
      <div className="training-module-page">
        <div className="module-loading">
          <div className="loading-spinner" />
          <p>Loading module...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="training-module-page">
      <header>
        <Link to="/training">← Back to Training</Link>
        <h1>{module.title}</h1>
      </header>

      <div className="module-progress-bar">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="progress-label">{progress}% complete</span>
      </div>

      <section className="module-content">
        {isInteractive ? (
          <div className="interactive-step">
            {currentStep.type === 'content' && (
              <div className="step-content" dangerouslySetInnerHTML={{ __html: currentStep.content || '' }} />
            )}
            {currentStep.type === 'scenario' && (
              <>
                <div className="step-scenario">
                  <p className="scenario-text">{currentStep.scenario}</p>
                  <p className="scenario-question">{currentStep.question}</p>
                </div>
                <div className="step-choices">
                  {currentStep.choices?.map((c, i) => (
                    <button
                      key={i}
                      className="choice-btn"
                      onClick={() => handleChoice(i)}
                      disabled={submitting}
                    >
                      {c.text}
                    </button>
                  ))}
                </div>
              </>
            )}
            {feedback && (
              <div className="step-feedback">
                <span className="feedback-badge">✓ Feedback</span>
                <p>{feedback}</p>
              </div>
            )}
            {currentStep.type === 'content' && currentStep.next && !completed && (
              <button
                className="primary next-btn"
                onClick={handleAdvance}
                disabled={submitting}
              >
                {submitting ? '...' : 'Continue →'}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="content-html" dangerouslySetInnerHTML={{ __html: module.content_html || '' }} />

            {reflectPrompt && (
              <div className="module-reflect">
                <span className="reflect-badge">💭 Reflect</span>
                <h4>Apply to your practice</h4>
                <p>{reflectPrompt}</p>
              </div>
            )}
          </>
        )}

        {!isInteractive && (
          <div className="module-actions">
            {!completed && (
              <button onClick={handleComplete} className="primary">
                Mark as Complete
              </button>
            )}
            {completed && <span className="badge completed">✓ Completed</span>}
          </div>
        )}

        {isInteractive && completed && (
          <div className="module-actions">
            <span className="badge completed">✓ Completed</span>
          </div>
        )}

        {isInteractive && !completed && !currentStep?.next && !currentStep?.choices?.length && (
          <div className="module-actions">
            <button onClick={handleComplete} className="primary">
              Mark as Complete
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
