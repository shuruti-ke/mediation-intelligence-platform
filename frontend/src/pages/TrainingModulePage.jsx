import { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { trainingApi } from '../api/client';
import { FALLBACK_CONFIGS } from '../data/moduleConfigs';

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
        const cfg = data.interactive_config || (data.slug && FALLBACK_CONFIGS[data.slug]);
        if (cfg?.steps?.length) {
          setCurrentStep(cfg.steps[0]);
        } else {
          setCurrentStep(null);
        }
      })
      .catch(() => setModule(null))
      .finally(() => setLoading(false));
  }, [id]);

  const interactiveConfig = useMemo(() => {
    return module?.interactive_config || (module?.slug && FALLBACK_CONFIGS[module.slug]) || null;
  }, [module?.interactive_config, module?.slug]);

  const stepsMap = useMemo(() => {
    if (!interactiveConfig?.steps) return {};
    return Object.fromEntries(interactiveConfig.steps.map(s => [s.id, s]));
  }, [interactiveConfig]);

  const handleChoice = async (choiceIdx) => {
    if (!interactiveConfig || submitting) return;
    const choice = currentStep?.choices?.[choiceIdx];
    if (!choice) return;
    setSubmitting(true);
    setFeedback(choice.feedback ?? null);
    const nextStep = stepsMap[choice.next];
    if (interactiveConfig === module?.interactive_config) {
      try {
        const { data } = await trainingApi.respondToStep(id, { step_id: currentStep.id, choice_idx: choiceIdx });
        setProgress(data.progress_pct ?? progress);
        setCompleted(data.completed ?? false);
        setCurrentStep(data.next_step ?? nextStep ?? null);
      } catch (err) {
        console.error(err);
        setCurrentStep(nextStep ?? null);
      }
    } else {
      setCurrentStep(nextStep ?? null);
      if (!nextStep?.next && !nextStep?.choices?.length) {
        setCompleted(true);
        setProgress(100);
      }
    }
    setSubmitting(false);
  };

  const handleAdvance = async () => {
    if (!interactiveConfig || submitting || !currentStep?.next) return;
    setSubmitting(true);
    setFeedback(null);
    const nextStep = stepsMap[currentStep.next];
    if (interactiveConfig === module?.interactive_config) {
      try {
        const { data } = await trainingApi.respondToStep(id, { step_id: currentStep.id, text: 'continue' });
        setProgress(data.progress_pct ?? progress);
        setCompleted(data.completed ?? false);
        setCurrentStep(data.next_step ?? nextStep ?? null);
      } catch (err) {
        console.error(err);
        setCurrentStep(nextStep ?? null);
      }
    } else {
      setCurrentStep(nextStep ?? null);
      if (!nextStep?.next && !nextStep?.choices?.length) {
        setCompleted(true);
        setProgress(100);
      }
    }
    setSubmitting(false);
  };

  const handleComplete = async () => {
    try {
      await trainingApi.updateProgress(id, { progress_pct: 100, completed: true });
    } catch (err) {
      console.error(err);
    }
    setProgress(100);
    setCompleted(true);
  };

  const reflectPrompt = module ? MODULE_REFLECT_PROMPTS[module.slug] : null;
  const isInteractive = interactiveConfig && currentStep;

  if (loading || !module) {
    return (
      <div className="training-module-page training-module-page-modern">
        <div className="module-loading">
          <div className="loading-spinner" />
          <p>Loading module...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="training-module-page training-module-page-modern">
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
