import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle, Clock, Award, Play, Menu, X, Brain, Zap, AlertCircle, Lightbulb, ExternalLink, GraduationCap, Sparkles } from 'lucide-react';
import { trainingApi, api } from '../api/client';
import '../styles/TraineeAcademy.css';

export default function TraineeTrainingPage() {
  const [modules, setModules] = useState([]);
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentModule, setCurrentModule] = useState(null);
  const [currentLesson, setCurrentLesson] = useState(null);
  const [activeTab, setActiveTab] = useState('modules');
  const [finalQuestions, setFinalQuestions] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [examMode, setExamMode] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examScore, setExamScore] = useState(null);

  useEffect(() => {
    Promise.all([
      trainingApi.getTraineeModules().then(({ data }) => setModules(data || [])),
      trainingApi.getTraineeProgress().then(({ data }) => setProgress(data?.progress || {})),
      trainingApi.getTraineeFinalExam().then(({ data }) => setFinalQuestions(data || [])),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const completedModules = Object.entries(progress).filter(([, p]) => p?.exam_passed).map(([id]) => id);
  const finalPassed = Object.values(progress).some((p) => p?.final_passed);
  const questions = examMode === 'module-exam' && currentModule?.module_exam
    ? (currentModule.module_exam.questions || []).map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options || [],
        correctAnswer: q.correct,
      }))
    : examMode === 'final-exam'
    ? (finalQuestions || []).map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options || [],
        correctAnswer: q.correct,
      }))
    : [];

  const markLessonComplete = async (moduleId, lessonId) => {
    const modProg = progress[moduleId] || {};
    const lessons = modProg.lessons || [];
    if (lessons.includes(lessonId)) return;
    try {
      const { data } = await trainingApi.updateTraineeProgress({ module_id: moduleId, lesson_id: lessonId });
      setProgress({ ...progress, [moduleId]: data?.progress?.[moduleId] || { ...modProg, lessons: [...lessons, lessonId] } });
    } catch (e) {
      console.error(e);
    }
  };

  const saveExamResult = async (moduleId, passed, score) => {
    try {
      const { data } = await trainingApi.updateTraineeProgress({
        module_id: moduleId,
        exam_passed: passed,
        exam_score: score,
      });
      setProgress(data?.progress || progress);
    } catch (e) {
      console.error(e);
    }
  };

  const saveFinalResult = async (passed) => {
    try {
      if (modules.length > 0) {
        await trainingApi.updateTraineeProgress({
          module_id: modules[0].id,
          final_passed: passed,
        });
      }
      const { data } = await trainingApi.getTraineeProgress();
      setProgress(data?.progress || {});
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectAnswer = (optionId) => {
    if (!examSubmitted) {
      setSelectedAnswers({ ...selectedAnswers, [currentQuestionIndex]: optionId });
    }
  };

  const handleSubmitExam = () => {
    let correct = 0;
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctAnswer) correct++;
    });
    const score = Math.round((correct / questions.length) * 100);
    setExamScore(score);
    setExamSubmitted(true);
    if (examMode === 'module-exam' && currentModule) {
      const passed = score >= 70;
      saveExamResult(currentModule.id, passed, score);
    }
    if (examMode === 'final-exam') {
      saveFinalResult(score >= 70);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(currentQuestionIndex + 1);
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) setCurrentQuestionIndex(currentQuestionIndex - 1);
  };

  const resetExam = () => {
    setExamSubmitted(false);
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);
    setExamMode(null);
    setExamScore(null);
  };

  const getModuleStatus = (mod) => {
    const p = progress[mod.id] || {};
    if (p.exam_passed) return 'completed';
    const lessons = (p.lessons || []).length;
    const total = (mod.lessons_data || []).length;
    if (lessons > 0 || total === 0) return 'in-progress';
    return 'not-started';
  };

  const getModuleProgress = (mod) => {
    const p = progress[mod.id] || {};
    const lessons = (p.lessons || []).length;
    const total = (mod.lessons_data || []).length;
    return total ? Math.round((lessons / total) * 100) : 0;
  };

  const isLessonComplete = (modId, lessonId) => (progress[modId]?.lessons || []).includes(lessonId);

  const ExamInterface = () => {
    const currentQuestion = questions[currentQuestionIndex];
    const isAnswered = selectedAnswers[currentQuestionIndex] !== undefined;
    const isLastQuestion = currentQuestionIndex === questions.length - 1;

    if (examSubmitted) {
      const correct = Object.keys(selectedAnswers).filter((idx) => selectedAnswers[idx] === questions[idx]?.correctAnswer).length;
      const passed = examScore >= 70;

      return (
        <div className="trainee-exam-result">
          <div className={`trainee-exam-result-card ${passed ? 'passed' : 'failed'}`}>
            <h2>{passed ? 'Congratulations!' : 'Keep Trying!'}</h2>
            <p className="score">Your Score: {examScore}%</p>
            <p>{correct} out of {questions.length} correct</p>
            {!passed && <p className="hint">Pass score is 70%. Review the material and try again.</p>}
          </div>
          <div className="trainee-exam-actions">
            <button onClick={resetExam} className="btn-trainee btn-secondary">Try Again</button>
            {examMode === 'module-exam' && passed && currentModule && (
              <button onClick={() => { resetExam(); setCurrentModule(null); }} className="btn-trainee btn-primary">
                Continue to Next Module
              </button>
            )}
            {examMode === 'final-exam' && (
              <button onClick={() => { resetExam(); setActiveTab('certificate'); }} className="btn-trainee btn-primary">
                View Certificate
              </button>
            )}
          </div>
        </div>
      );
    }

    if (!currentQuestion) return null;

    return (
      <div className="trainee-exam-interface">
        <div className="trainee-exam-progress-bar">
          <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
          <span>{Math.round((currentQuestionIndex / questions.length) * 100)}% Complete</span>
        </div>
        <div className="trainee-exam-question-card">
          <h2>{currentQuestion.question}</h2>
          <div className="trainee-exam-options">
            {(currentQuestion.options || []).map((option) => (
              <button
                key={option.id}
                onClick={() => handleSelectAnswer(option.id)}
                disabled={examSubmitted}
                className={`trainee-exam-option ${selectedAnswers[currentQuestionIndex] === option.id ? 'selected' : ''}`}
              >
                <span className="option-marker">{selectedAnswers[currentQuestionIndex] === option.id && '✓'}</span>
                {option.text}
              </button>
            ))}
          </div>
          <div className="trainee-exam-nav">
            <button onClick={handlePreviousQuestion} disabled={currentQuestionIndex === 0} className="btn-trainee btn-secondary">← Previous</button>
            {!isLastQuestion ? (
              <button onClick={handleNextQuestion} disabled={!isAnswered} className="btn-trainee btn-primary">Next →</button>
            ) : (
              <button onClick={handleSubmitExam} disabled={!isAnswered} className="btn-trainee btn-submit">Submit Exam</button>
            )}
          </div>
          {!isAnswered && <p className="trainee-exam-hint"><AlertCircle size={14} /> Please select an answer to continue</p>}
        </div>
        <div className="trainee-exam-question-dots">
          {questions.map((_, idx) => (
            <button key={idx} onClick={() => setCurrentQuestionIndex(idx)} className={`dot ${selectedAnswers[idx] !== undefined ? 'answered' : ''}`}>
              {idx + 1}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const ModuleCard = ({ module }) => {
    const status = getModuleStatus(module);
    const progressPct = getModuleProgress(module);

    return (
      <div className="trainee-module-card">
        <div className="trainee-module-icon">{module.icon || '📚'}</div>
        <div className="trainee-module-body">
          <div className="trainee-module-badges">
            {module.is_ai_module && <span className="badge-ai"><Sparkles size={12} /> AI</span>}
          </div>
          <h3>{module.title}</h3>
          <p className="trainee-module-desc">{module.description}</p>
          <div className="trainee-module-meta">
            <span><Clock size={14} /> {module.duration}</span>
            <span>{(module.lessons_data || []).length} lessons</span>
          </div>
          <div className="trainee-module-progress">
            <span>Progress</span>
            <span>{progressPct}%</span>
          </div>
          <div className="trainee-progress-bar"><div className="trainee-progress-fill" style={{ width: `${progressPct}%` }} /></div>
          <button
            onClick={() => { setCurrentModule(module); setCurrentLesson((module.lessons_data || [])[0]); }}
            className={`btn-trainee btn-module ${status}`}
          >
            {status === 'completed' && <CheckCircle size={16} />}
            {status === 'completed' ? 'Completed' : status === 'in-progress' ? 'Continue' : 'Start'}
          </button>
        </div>
      </div>
    );
  };

  const renderArticleContent = (text) => {
    if (!text) return null;
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="trainee-strong">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const LessonContent = ({ lesson, module }) => {
    const done = isLessonComplete(module.id, lesson.id);
    const isArticle = lesson.type === 'article';
    const isSummary = lesson.type === 'summary';
    const isFile = lesson.type === 'file';
    const isEmbed = lesson.type === 'embed';

    return (
      <div className="trainee-lesson-content">
        <div className="trainee-lesson-card">
          <h2>{lesson.title}</h2>
          <p className="trainee-lesson-meta">{lesson.type} • {lesson.duration}</p>
          {isEmbed && lesson.content_html && (() => {
            const raw = lesson.content_html.trim();
            const isSafeUrl = /^https?:\/\/\S+$/.test(raw);
            const html = isSafeUrl
              ? `<iframe src="${raw.replace(/"/g, '&quot;')}" title="${(lesson.title || '').replace(/"/g, '&quot;')}" allowfullscreen></iframe>`
              : lesson.content_html;
            return <div className="trainee-lesson-embed" dangerouslySetInnerHTML={{ __html: html }} />;
          })()}
          {lesson.video_id && (
            <div className="trainee-lesson-video">
              <iframe
                src={`https://www.youtube.com/embed/${lesson.video_id}`}
                title={lesson.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              {lesson.content && <p>{lesson.content}</p>}
            </div>
          )}
          {isArticle && lesson.content && (
            <div className="trainee-lesson-article">
              <article>
                <p className="trainee-summary-label">Summary</p>
                <div className="trainee-article-body">
                  {lesson.content.split(/\n\n+/).map((para, i) => (
                    <p key={i}>{renderArticleContent(para)}</p>
                  ))}
                </div>
              </article>
              <a href={`/training/trainee-academy/article/${lesson.id}`} target="_blank" rel="noopener noreferrer" className="btn-trainee btn-primary">
                <ExternalLink size={16} /> Read full article (opens in new page)
              </a>
            </div>
          )}
          {isSummary && lesson.content && (
            <div className="trainee-lesson-summary">{lesson.content}</div>
          )}
          {isFile && lesson.file_url && (
            <div className="trainee-lesson-file">
              <p>Download the attached document.</p>
              <button
                className="btn-trainee btn-primary"
                onClick={async () => {
                  const match = lesson.file_url.match(/\/documents\/([a-f0-9-]+)\/download/);
                  if (match) {
                    try {
                      const { data } = await api.get(`/documents/${match[1]}/download`, { responseType: 'blob' });
                      const url = URL.createObjectURL(data);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'document';
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (e) {
                      window.open(lesson.file_url, '_blank');
                    }
                  } else {
                    window.open(lesson.file_url, '_blank');
                  }
                }}
              >
                <ExternalLink size={16} /> Download Document
              </button>
            </div>
          )}
          <button onClick={() => markLessonComplete(module.id, lesson.id)} disabled={done} className={`btn-trainee ${done ? 'btn-completed' : 'btn-primary'}`}>
            {done ? '✓ Completed' : 'Mark as complete'}
          </button>
        </div>
      </div>
    );
  };

  const CertificateTab = () => (
    <div className="trainee-certificate-wrap">
      {finalPassed ? (
        <div className="trainee-certificate-card">
          <div className="cert-icon">🏆</div>
          <h1>Certificate of Completion</h1>
          <p className="cert-subtitle">Mediation Intelligence Platform – Trainee Mediator Certification</p>
          <div className="cert-body">
            <p>This is to certify that</p>
            <p className="cert-name">Trainee Mediator</p>
            <p>has successfully completed the comprehensive training program in mediation</p>
            <div className="cert-meta">
              <div><p className="label">Date</p><p>{new Date().toLocaleDateString()}</p></div>
              <div><p className="label">Status</p><p className="status-cert">CERTIFIED</p></div>
            </div>
          </div>
          <button className="btn-trainee btn-primary">Download Certificate</button>
        </div>
      ) : (
        <div className="trainee-certificate-pending">
          <AlertCircle size={48} />
          <h2>Certification In Progress</h2>
          <p>Complete all modules and pass the final exam to earn your certificate.</p>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="trainee-academy-page trainee-loading">
        <div className="trainee-loading-spinner" />
        <p>Loading Trainee Academy...</p>
      </div>
    );
  }

  return (
    <div className="trainee-academy-page">
      <div className="trainee-academy-split">
        <aside className="trainee-sidebar">
          <div className="trainee-sidebar-card">
            <div className="trainee-sidebar-brand">
              <div className="trainee-logo"><GraduationCap size={28} /></div>
              <div>
                <h1>Trainee Academy</h1>
                <p>Mediator Certification Program</p>
              </div>
            </div>
            <nav className="trainee-sidebar-nav">
              <button className={activeTab === 'modules' ? 'active' : ''} onClick={() => { setActiveTab('modules'); setCurrentModule(null); setExamMode(null); }}>
                <BookOpen size={16} /> Modules
              </button>
              <button className={activeTab === 'certificate' ? 'active' : ''} onClick={() => setActiveTab('certificate')}>
                <Award size={16} /> Certificate
              </button>
            </nav>
            <div className="trainee-sidebar-progress">
              <h4>Your Progress</h4>
              <div className="trainee-progress-stats">
                <div><span className="val">{modules.length}</span><span className="lbl">Total</span></div>
                <div><span className="val">{completedModules.length}</span><span className="lbl">Completed</span></div>
                <div><span className="val">{completedModules.length === modules.length ? 'Ready' : 'In Progress'}</span><span className="lbl">Status</span></div>
              </div>
            </div>
            <div className="trainee-sidebar-modules">
              <h4>Modules</h4>
              <ul>
                {modules.map((mod) => (
                  <li key={mod.id}>
                    <button
                      className={`${currentModule?.id === mod.id ? 'active' : ''} ${getModuleStatus(mod)}`}
                      onClick={() => { setCurrentModule(mod); setCurrentLesson((mod.lessons_data || [])[0]); setActiveTab('modules'); }}
                    >
                      <span className="mod-icon">{mod.icon || '📚'}</span>
                      <span className="mod-title">{mod.title}</span>
                      {mod.is_ai_module && <Sparkles size={12} className="ai-badge" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <Link to="/login" onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); }} className="trainee-sidebar-back">
              Sign out
            </Link>
          </div>
        </aside>
        <main className="trainee-main">
          {examMode === 'module-exam' ? (
            <div className="trainee-main-content">
              <button onClick={resetExam} className="trainee-back-link">← Back to Module</button>
              <div className="trainee-section-card">
                <Brain size={24} />
                <h2>{currentModule?.title} – Module Exam</h2>
                <p>Answer all questions to proceed. Pass score: 70%</p>
              </div>
              <ExamInterface />
            </div>
          ) : examMode === 'final-exam' ? (
            <div className="trainee-main-content">
              <button onClick={resetExam} className="trainee-back-link">← Back to Modules</button>
              <div className="trainee-section-card">
                <Zap size={24} />
                <h2>Final Certification Exam</h2>
                <p>Pass with 70% or higher to earn your Trainee Mediator Certification</p>
              </div>
              <ExamInterface />
            </div>
          ) : currentModule ? (
            <div className="trainee-main-content">
              <button onClick={() => setCurrentModule(null)} className="trainee-back-link">← Back to Modules</button>
              <div className="trainee-module-layout">
                <div className="trainee-module-main">
                  {currentLesson ? (
                    <LessonContent lesson={currentLesson} module={currentModule} />
                  ) : (
                    <div className="trainee-lesson-card">
                      <h1>{currentModule.title}</h1>
                      <p>{currentModule.description}</p>
                      <p className="hint">Select a lesson from the list.</p>
                    </div>
                  )}
                  <div className="trainee-lesson-list-card">
                    <h2>Course Content</h2>
                    <div className="trainee-lesson-list">
                      {(currentModule.lessons_data || []).map((lesson) => (
                        <div
                          key={lesson.id}
                          className={`trainee-lesson-item ${isLessonComplete(currentModule.id, lesson.id) ? 'completed' : ''} ${currentLesson?.id === lesson.id ? 'active' : ''}`}
                          onClick={() => setCurrentLesson(lesson)}
                        >
                          {lesson.type === 'video' ? <Play size={18} /> : lesson.type === 'interactive' ? <Lightbulb size={18} /> : <BookOpen size={18} />}
                          <div>
                            <p>{lesson.title}</p>
                            <span>{lesson.type} • {lesson.duration}</span>
                          </div>
                          {isLessonComplete(currentModule.id, lesson.id) && <CheckCircle size={18} />}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="trainee-module-side">
                  <div className="trainee-progress-card">
                    <h3>Module Progress</h3>
                    <div className="trainee-progress-detail">
                      <span>Lessons Completed</span>
                      <span>{(progress[currentModule.id]?.lessons || []).length}/{(currentModule.lessons_data || []).length}</span>
                    </div>
                    <div className="trainee-progress-bar"><div className="trainee-progress-fill" style={{ width: `${getModuleProgress(currentModule)}%` }} /></div>
                    {currentModule.module_exam && (
                      <button
                        onClick={() => { setExamMode('module-exam'); setCurrentQuestionIndex(0); setSelectedAnswers({}); setExamSubmitted(false); }}
                        className="btn-trainee btn-primary"
                      >
                        Take Module Exam
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'modules' ? (
            <div className="trainee-main-content">
              <div className="trainee-progress-banner">
                <h2>Your Training Progress</h2>
                <div className="trainee-progress-grid">
                  <div><p>Total Modules</p><span>{modules.length}</span></div>
                  <div><p>Completed</p><span>{completedModules.length}</span></div>
                  <div><p>Status</p><span>{completedModules.length === modules.length ? 'Ready for Final' : 'In Progress'}</span></div>
                </div>
              </div>
              <div className="trainee-modules-section">
                <h3>Modules</h3>
                <div className="trainee-modules-grid">
                  {modules.map((module) => (
                    <ModuleCard key={module.id} module={module} />
                  ))}
                </div>
              </div>
              {completedModules.length === modules.length && modules.length > 0 && (
                <div className="trainee-final-exam-cta">
                  <Award size={48} />
                  <h3>Ready for Final Exam?</h3>
                  <p>You've completed all modules. Take the comprehensive final exam to earn your certification.</p>
                  <button
                    onClick={() => { setExamMode('final-exam'); setCurrentQuestionIndex(0); setSelectedAnswers({}); setExamSubmitted(false); }}
                    className="btn-trainee btn-primary"
                  >
                    Take Final Exam ({finalQuestions.length} Questions)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="trainee-main-content">
              <CertificateTab />
            </div>
          )}
        </main>
      </div>
      <footer className="trainee-footer">
        <p>© {new Date().getFullYear()} Mediation Intelligence Platform. Training the next generation of mediators.</p>
      </footer>
    </div>
  );
}
