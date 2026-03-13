import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Sparkles,
  BookOpen,
  BarChart3,
  Users,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  X,
  Moon,
  Sun,
  Upload,
  MessageSquare,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  GraduationCap,
  ArrowLeft,
  Youtube,
  Link as LinkIcon,
  RotateCcw,
  Briefcase,
  GraduationCap as CapIcon,
} from 'lucide-react';
import { trainingAcademyApi, documents } from '../api/client';
import './AdminTrainingAcademyPage.css';

const DIFFICULTY_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
const STATUS_LABELS = { not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed', failed: 'Failed' };
const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe', '#e9d5ff'];

export default function AdminTrainingAcademyPage() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('academyDarkMode') === 'true');
  const [modules, setModules] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [riskAlert, setRiskAlert] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [aiInput, setAiInput] = useState({ topic: '', target_audience: 'mediators', duration_hours: 2 });
  const [aiResult, setAiResult] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [createForm, setCreateForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [studentModal, setStudentModal] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [lessonUploading, setLessonUploading] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModuleId, setEditModuleId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [quizModuleId, setQuizModuleId] = useState(null);
  const [quizForm, setQuizForm] = useState({ title: '', passing_score_pct: 70, questions: [] });
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [audienceFilter, setAudienceFilter] = useState('all'); // all, mediator, trainee
  const [mediatorEditModalOpen, setMediatorEditModalOpen] = useState(false);
  const [mediatorEditId, setMediatorEditId] = useState(null);
  const [mediatorEditForm, setMediatorEditForm] = useState(null);

  useEffect(() => {
    document.documentElement.classList.toggle('academy-dark', darkMode);
    localStorage.setItem('academyDarkMode', darkMode);
  }, [darkMode]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [modRes, mediatorRes, anaRes, riskRes, studRes] = await Promise.allSettled([
        trainingAcademyApi.listModules(includeArchived),
        trainingAcademyApi.listMediatorModules(includeArchived),
        trainingAcademyApi.getAnalytics(),
        trainingAcademyApi.getRiskAlert(),
        trainingAcademyApi.listStudents(),
      ]);
      const academyMods = modRes.status === 'fulfilled' ? modRes.value.data : [];
      const mediatorMods = mediatorRes.status === 'fulfilled' ? mediatorRes.value.data : [];
      setModules([...mediatorMods, ...academyMods]);
      setAnalytics(anaRes.status === 'fulfilled' ? anaRes.value.data : null);
      setRiskAlert(riskRes.status === 'fulfilled' ? riskRes.value.data : []);
      setStudents(studRes.status === 'fulfilled' ? studRes.value.data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [includeArchived]);

  const handleAiGenerate = async () => {
    if (!aiInput.topic?.trim()) return;
    setAiGenerating(true);
    try {
      const { data } = await trainingAcademyApi.aiGenerate(aiInput);
      setAiResult(data);
      setWizardStep(2);
      setCreateForm({
        slug: data.slug || aiInput.topic.toLowerCase().replace(/\s+/g, '-').slice(0, 50),
        title: data.title || aiInput.topic,
        description: data.description || '',
        difficulty: 'beginner',
        tags: [],
        visibility: 'public',
        target_audience: aiInput.target_audience === 'mediators' ? 'mediator' : 'trainee',
        lessons: data.lessons || [],
        quiz_questions: data.quiz_questions || [],
      });
    } catch (e) {
      alert(e.response?.data?.detail || 'AI generation failed');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleCreateModule = async () => {
    if (!createForm?.slug || !createForm?.title) return;
    setSaving(true);
    try {
      const { data: createRes } = await trainingAcademyApi.createModule({
        slug: createForm.slug,
        title: createForm.title,
        description: createForm.description,
        difficulty: createForm.difficulty,
        tags: createForm.tags,
        visibility: createForm.visibility,
        target_audience: createForm.target_audience || 'trainee',
      });
      const modId = createRes?.id;
      if (modId && createForm.lessons?.length) {
        for (let i = 0; i < createForm.lessons.length; i++) {
          const l = createForm.lessons[i];
          await trainingAcademyApi.createLesson(modId, {
            title: l.title,
            content_type: l.content_type || 'text',
            content_html: l.content_html || l.suggested_content || '',
            video_url: l.video_url || null,
            file_url: l.file_url || null,
            order_index: i,
            duration_minutes: l.duration_minutes ? parseInt(l.duration_minutes, 10) : null,
          });
        }
      }
      if (modId && createForm.quiz_questions?.length) {
        const questions = createForm.quiz_questions.map((q) => ({
          question: q.question,
          options: q.options,
          correct_idx: q.correct_idx ?? 0,
          feedback_correct: q.feedback_correct,
          feedback_incorrect: q.feedback_incorrect,
        }));
        await trainingAcademyApi.createQuiz({
          module_id: modId,
          title: `${createForm.title} - Quiz`,
          questions_json: { questions },
          passing_score_pct: 70,
        });
      }
      if (modId) {
        await trainingAcademyApi.updateModule(modId, { is_published: true });
      }
      setWizardOpen(false);
      setWizardStep(1);
      setAiResult(null);
      setCreateForm(null);
      loadData();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to create module');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveModule = async (id) => {
    if (!confirm('Archive this module? (Soft delete - preserves student history)')) return;
    try {
      await trainingAcademyApi.archiveModule(id);
      loadData();
    } catch (e) {
      alert(e.response?.data?.detail || 'Archive failed');
    }
  };

  const handleUnarchiveModule = async (id) => {
    try {
      await trainingAcademyApi.unarchiveModule(id);
      loadData();
    } catch (e) {
      alert(e.response?.data?.detail || 'Unarchive failed');
    }
  };

  const handleArchiveMediatorModule = async (id) => {
    if (!confirm('Archive this mediator module?')) return;
    try {
      await trainingAcademyApi.archiveMediatorModule(id);
      loadData();
    } catch (e) {
      alert(e.response?.data?.detail || 'Archive failed');
    }
  };

  const handleUnarchiveMediatorModule = async (id) => {
    try {
      await trainingAcademyApi.unarchiveMediatorModule(id);
      loadData();
    } catch (e) {
      alert(e.response?.data?.detail || 'Unarchive failed');
    }
  };

  const openEditMediatorModule = async (m) => {
    setMediatorEditId(m.id);
    setMediatorEditModalOpen(true);
    try {
      const { data } = await trainingAcademyApi.getMediatorModule(m.id);
      setMediatorEditForm({
        title: data.title,
        description: data.description || '',
        content_html: data.content_html || '',
        order_index: data.order_index ?? 0,
        is_published: data.is_published ?? true,
      });
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to load module');
      setMediatorEditModalOpen(false);
    }
  };

  const handleSaveMediatorModule = async () => {
    if (!mediatorEditId || !mediatorEditForm) return;
    setSaving(true);
    try {
      await trainingAcademyApi.updateMediatorModule(mediatorEditId, {
        title: mediatorEditForm.title,
        description: mediatorEditForm.description || undefined,
        content_html: mediatorEditForm.content_html || undefined,
        order_index: mediatorEditForm.order_index,
        is_published: mediatorEditForm.is_published,
      });
      setMediatorEditModalOpen(false);
      setMediatorEditId(null);
      setMediatorEditForm(null);
      loadData();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const openStudentModal = async (student) => {
    setStudentModal(student);
    setAssignModalOpen(false);
    try {
      const { data } = await trainingAcademyApi.getStudentDetail(student.id);
      setStudentDetail(data);
    } catch (e) {
      setStudentDetail(null);
    }
  };

  const openEditModule = async (m) => {
    setEditModuleId(m.id);
    setEditModalOpen(true);
    try {
      const { data } = await trainingAcademyApi.getModule(m.id);
      setEditForm({
        title: data.title,
        description: data.description || '',
        difficulty: data.difficulty || 'beginner',
        tags: data.tags || [],
        visibility: data.visibility || 'public',
        target_audience: data.target_audience || 'trainee',
        is_published: data.is_published ?? false,
        lessons: (data.lessons || []).map((l) => ({
          id: l.id,
          title: l.title,
          content_type: l.content_type || 'text',
          content_html: l.content_html || '',
          video_url: l.video_url || '',
          file_url: l.file_url || '',
          order_index: l.order_index ?? 0,
          duration_minutes: l.duration_minutes,
        })),
      });
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to load module');
      setEditModalOpen(false);
    }
  };

  const handleSaveEditModule = async () => {
    if (!editModuleId || !editForm) return;
    setSaving(true);
    try {
      await trainingAcademyApi.updateModule(editModuleId, {
        title: editForm.title,
        description: editForm.description || undefined,
        difficulty: editForm.difficulty,
        tags: editForm.tags,
        visibility: editForm.visibility,
        target_audience: editForm.target_audience,
        is_published: editForm.is_published,
      });
      for (let i = 0; i < editForm.lessons.length; i++) {
        const l = editForm.lessons[i];
        if (l.id) {
          await trainingAcademyApi.updateLesson(l.id, {
            title: l.title,
            content_type: l.content_type,
            content_html: l.content_html || undefined,
            video_url: l.video_url || undefined,
            file_url: l.file_url || undefined,
            order_index: i,
            duration_minutes: l.duration_minutes ? parseInt(l.duration_minutes, 10) : undefined,
          });
        } else {
          await trainingAcademyApi.createLesson(editModuleId, {
            title: l.title,
            content_type: l.content_type || 'text',
            content_html: l.content_html || undefined,
            video_url: l.video_url || undefined,
            file_url: l.file_url || undefined,
            order_index: i,
            duration_minutes: l.duration_minutes ? parseInt(l.duration_minutes, 10) : undefined,
          });
        }
      }
      setEditModalOpen(false);
      setEditModuleId(null);
      setEditForm(null);
      loadData();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const openQuizModal = (m) => {
    setQuizModuleId(m.id);
    setQuizForm({
      title: `${m.title} – Quiz`,
      passing_score_pct: 70,
      questions: [{ question: '', options: ['', '', '', ''], correct_idx: 0, feedback_correct: '', feedback_incorrect: '' }],
    });
    setQuizModalOpen(true);
  };

  const handleCreateQuiz = async () => {
    if (!quizModuleId || !quizForm.title?.trim()) return;
    const questions = quizForm.questions.filter((q) => q.question?.trim());
    if (questions.length === 0) {
      alert('Add at least one question');
      return;
    }
    for (const q of questions) {
      const opts = Array.isArray(q.options) ? q.options : String(q.options || '').split(/[\n,]/).map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) {
        alert(`Question "${q.question.slice(0, 30)}..." needs at least 2 options`);
        return;
      }
    }
    setSaving(true);
    try {
      const questionsJson = { questions: questions.map((q) => {
        const opts = Array.isArray(q.options) ? q.options.filter((o) => o?.trim()) : String(q.options || '').split(/[\n,]/).map((o) => o.trim()).filter(Boolean);
        return {
          question: q.question.trim(),
          options: opts.length ? opts : ['A', 'B'],
          correct_idx: Math.min(q.correct_idx || 0, (opts.length || 2) - 1),
          feedback_correct: q.feedback_correct || '',
          feedback_incorrect: q.feedback_incorrect || '',
        };
      }) };
      await trainingAcademyApi.createQuiz({
        module_id: quizModuleId,
        title: quizForm.title.trim(),
        questions_json: questionsJson,
        passing_score_pct: quizForm.passing_score_pct,
      });
      setQuizModalOpen(false);
      setQuizModuleId(null);
      loadData();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to create quiz');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignModule = async (moduleId) => {
    if (!studentModal?.id) return;
    try {
      await trainingAcademyApi.assignModule({ user_id: studentModal.id, module_id: moduleId });
      setAssignModalOpen(false);
      openStudentModal(studentModal);
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to assign');
    }
  };

  return (
    <div className={`academy-admin ${darkMode ? 'dark' : ''}`}>
      <header className="academy-header">
        <div className="academy-brand">
          <Link to="/admin" className="academy-back">
            <ArrowLeft size={18} /> Back to Admin
          </Link>
          <h1>
            <GraduationCap size={28} />
            Training Academy
          </h1>
        </div>
        <div className="academy-actions">
          <button
            className="academy-btn academy-btn-ghost"
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'Light mode' : 'Dark mode'}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="academy-btn academy-btn-primary" onClick={() => setWizardOpen(true)}>
            <Sparkles size={18} /> AI Create Module
          </button>
          <button
            className="academy-btn academy-btn-secondary"
            onClick={() => {
              setWizardOpen(true);
              setWizardStep(2);
              setAiResult(null);
              setCreateForm({
                slug: '',
                title: '',
                description: '',
                difficulty: 'beginner',
                tags: [],
                visibility: 'public',
                target_audience: 'trainee',
                lessons: [{ title: '', content_type: 'text', content_html: '', video_url: '', file_url: '', duration_minutes: '' }],
                quiz_questions: [],
              });
            }}
          >
            <Upload size={18} /> Manual Upload
          </button>
        </div>
      </header>

      {loading ? (
        <div className="academy-loading">
          <Loader2 size={32} className="spin" />
          <p>Loading academy...</p>
        </div>
      ) : (
        <>
          {/* Analytics Section */}
          <section className="academy-section academy-analytics">
            <h2>
              <BarChart3 size={22} /> Analytics Overview
            </h2>
            {analytics && (
              <div className="analytics-grid">
                <div className="kpi-card">
                  <span className="kpi-value">{analytics.total_enrolled ?? 0}</span>
                  <span className="kpi-label">Total Enrolled</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-value">{analytics.completion_rate_pct?.toFixed(1) ?? 0}%</span>
                  <span className="kpi-label">Completion Rate</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-value">{analytics.avg_quiz_score ?? 0}</span>
                  <span className="kpi-label">Avg Quiz Score</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-value">{analytics.total_training_hours ?? 0}h</span>
                  <span className="kpi-label">Training Hours</span>
                </div>
              </div>
            )}
            {analytics?.module_popularity?.length > 0 && (
              <div className="chart-card">
                <h3>Module Popularity</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={analytics.module_popularity} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--academy-border)" />
                    <XAxis dataKey="module" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="enrollments" radius={[4, 4, 0, 0]}>
                      {analytics.module_popularity.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {analytics?.completion_funnel && (() => {
              const f = analytics.completion_funnel;
              const total = (f.not_started || 0) + (f.in_progress || 0) + (f.completed || 0) || 1;
              const pct = (v) => Math.round(((v || 0) / total) * 100);
              return (
                <div className="chart-card funnel-card">
                  <h3>Completion Funnel</h3>
                  <div className="funnel-bars">
                    <div className="funnel-stage">
                      <span className="funnel-label">Started</span>
                      <div className="funnel-bar-wrap">
                        <div
                          className="funnel-bar"
                          style={{ width: `${pct((f.in_progress || 0) + (f.completed || 0))}%` }}
                        />
                      </div>
                      <span className="funnel-value">{(f.in_progress || 0) + (f.completed || 0)}</span>
                    </div>
                    <div className="funnel-stage">
                      <span className="funnel-label">In Progress</span>
                      <div className="funnel-bar-wrap">
                        <div className="funnel-bar in-progress" style={{ width: `${pct(f.in_progress)}%` }} />
                      </div>
                      <span className="funnel-value">{f.in_progress || 0}</span>
                    </div>
                    <div className="funnel-stage">
                      <span className="funnel-label">Completed</span>
                      <div className="funnel-bar-wrap">
                        <div className="funnel-bar completed" style={{ width: `${pct(f.completed)}%` }} />
                      </div>
                      <span className="funnel-value">{f.completed || 0}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
            {riskAlert?.length > 0 && (
              <div className="risk-card">
                <h3>
                  <AlertCircle size={18} /> Risk Alert
                </h3>
                <p className="risk-desc">Students with &gt;5 uncompleted tasks or stalled &gt;30 days</p>
                <ul className="risk-list">
                  {riskAlert.slice(0, 8).map((r) => (
                    <li key={r.id || r.user_id}>
                      <button className="risk-item-btn" onClick={() => openStudentModal({ ...r, id: r.id || r.user_id })}>
                        <span className="risk-name">{r.name}</span>
                        <span className="risk-meta">
                          {r.uncompleted_count} uncompleted{r.stalled && ' · Stalled'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Module Cards Grid */}
          <section className="academy-section academy-modules">
            <h2>
              <BookOpen size={22} /> Training Modules
            </h2>

            {/* Purpose/Focus Dashboard - Mediator vs Trainee */}
            <div className="audience-dashboard">
              <div
                className={`audience-box ${audienceFilter === 'mediator' ? 'active' : ''}`}
                onClick={() => setAudienceFilter(audienceFilter === 'mediator' ? 'all' : 'mediator')}
              >
                <Briefcase size={28} />
                <h3>Mediator Modules</h3>
                <p>CPD, advanced skills, professional development for practising mediators</p>
                <span className="audience-count">
                  {modules.filter((m) => (m.target_audience || 'trainee') === 'mediator').length} modules
                </span>
              </div>
              <div
                className={`audience-box ${audienceFilter === 'trainee' ? 'active' : ''}`}
                onClick={() => setAudienceFilter(audienceFilter === 'trainee' ? 'all' : 'trainee')}
              >
                <CapIcon size={28} />
                <h3>Trainee Modules</h3>
                <p>Induction, fundamentals, certification path for new trainees</p>
                <span className="audience-count">
                  {modules.filter((m) => (m.target_audience || 'trainee') === 'trainee').length} modules
                </span>
              </div>
            </div>

            <div className="module-toolbar">
              <label className="academy-checkbox">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                />
                Include archived
              </label>
              <div className="audience-tabs">
                <button
                  className={audienceFilter === 'all' ? 'active' : ''}
                  onClick={() => setAudienceFilter('all')}
                >
                  All
                </button>
                <button
                  className={audienceFilter === 'mediator' ? 'active' : ''}
                  onClick={() => setAudienceFilter('mediator')}
                >
                  Mediators
                </button>
                <button
                  className={audienceFilter === 'trainee' ? 'active' : ''}
                  onClick={() => setAudienceFilter('trainee')}
                >
                  Trainees
                </button>
              </div>
            </div>

            <div className="module-grid">
              {modules
                .filter((m) => {
                  if (audienceFilter === 'all') return true;
                  const aud = m.target_audience || 'trainee';
                  return aud === audienceFilter;
                })
                .map((m) => (
                  <div key={m.id} className={`module-card ${m.is_curated ? 'curated' : ''} ${m.archived_at ? 'archived' : ''}`}>
                    <div className="module-card-thumb">
                      {m.thumbnail_url ? (
                        <img src={m.thumbnail_url} alt="" />
                      ) : (
                        <div className="module-card-placeholder">
                          <BookOpen size={40} />
                        </div>
                      )}
                      <span className={`module-badge difficulty-${m.difficulty}`}>
                        {DIFFICULTY_LABELS[m.difficulty] || m.difficulty}
                      </span>
                      {m.archived_at && <span className="module-badge archived-badge">Archived</span>}
                    </div>
                    <div className="module-card-body">
                      <h3>{m.title}</h3>
                      <p className="module-desc">{m.description || 'No description'}</p>
                      <div className="module-meta">
                        <span>{m.lesson_count} lessons</span>
                        <span>{m.quiz_count} quizzes</span>
                        <span className="audience-tag">{(m.target_audience || 'trainee') === 'mediator' ? 'Mediator' : 'Trainee'}</span>
                        {m.is_published && <span className="badge-pub">Published</span>}
                      </div>
                    </div>
                    <div className="module-card-actions">
                      {m.source === 'mediator' && (
                        <>
                          <button className="btn-icon" title="Edit" onClick={() => openEditMediatorModule(m)}>
                            <Pencil size={16} />
                          </button>
                          {m.archived_at ? (
                            <button className="btn-icon" title="Unarchive" onClick={() => handleUnarchiveMediatorModule(m.id)}>
                              <RotateCcw size={16} />
                            </button>
                          ) : (
                            <button
                              className="btn-icon btn-danger"
                              title="Archive"
                              onClick={() => handleArchiveMediatorModule(m.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </>
                      )}
                      {!m.source && (
                        <>
                          <button className="btn-icon" title="Edit" onClick={() => openEditModule(m)}>
                            <Pencil size={16} />
                          </button>
                          <button className="btn-icon" title="Add Quiz" onClick={() => openQuizModal(m)}>
                            <FileText size={16} />
                          </button>
                          {m.archived_at ? (
                            <button className="btn-icon" title="Unarchive" onClick={() => handleUnarchiveModule(m.id)}>
                              <RotateCcw size={16} />
                            </button>
                          ) : (
                            <button
                              className="btn-icon btn-danger"
                              title="Archive"
                              onClick={() => handleArchiveModule(m.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
            </div>
            {modules.filter((m) => {
              if (audienceFilter === 'all') return true;
              const aud = m.target_audience || 'trainee';
              return aud === audienceFilter;
            }).length === 0 && (
              <p className="academy-empty">
                No modules yet. Use <strong>AI Create Module</strong> or <strong>Manual Upload</strong> to add one.
              </p>
            )}
          </section>

          {/* Students List */}
          <section className="academy-section academy-students">
            <h2>
              <Users size={22} /> Students
            </h2>
            <div className="students-table-wrap">
              <table className="students-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Progress</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.email}</td>
                      <td>
                        {s.completed_count} / {s.progress_count || 0} completed
                      </td>
                      <td>
                        <button className="academy-btn academy-btn-sm" onClick={() => openStudentModal(s)}>
                          View Progress
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {students.length === 0 && <p className="academy-empty">No trainees enrolled yet.</p>}
          </section>
        </>
      )}

      {/* AI Wizard Modal */}
      {wizardOpen && (
        <div className="academy-modal-overlay" onClick={() => !saving && setWizardOpen(false)}>
          <div className="academy-modal academy-wizard" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Sparkles size={20} /> {wizardStep === 1 ? 'AI Module Creator' : 'Review & Publish'}
              </h3>
              <button className="btn-close" onClick={() => !saving && setWizardOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {wizardStep === 1 && (
                <div className="wizard-step">
                  <p className="wizard-desc">Enter topic and preferences. AI will generate module structure and draft content.</p>
                  <label>
                    Topic <span className="required">*</span>
                    <input
                      type="text"
                      placeholder="e.g. Cross-Cultural Mediation"
                      value={aiInput.topic}
                      onChange={(e) => setAiInput({ ...aiInput, topic: e.target.value })}
                    />
                  </label>
                  <label>
                    Target Audience
                    <select
                      value={aiInput.target_audience}
                      onChange={(e) => setAiInput({ ...aiInput, target_audience: e.target.value })}
                    >
                      <option value="mediators">Mediators</option>
                      <option value="trainees">Trainees</option>
                      <option value="lawyers">Lawyers</option>
                      <option value="general">General</option>
                    </select>
                  </label>
                  <label>
                    Duration (hours)
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={aiInput.duration_hours}
                      onChange={(e) => setAiInput({ ...aiInput, duration_hours: parseFloat(e.target.value) || 2 })}
                    />
                  </label>
                  <div className="modal-actions">
                    <button className="academy-btn academy-btn-ghost" onClick={() => setWizardOpen(false)}>
                      Cancel
                    </button>
                    <button
                      className="academy-btn academy-btn-primary"
                      onClick={handleAiGenerate}
                      disabled={!aiInput.topic?.trim() || aiGenerating}
                    >
                      {aiGenerating ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
                      {aiGenerating ? ' Generating...' : ' Generate'}
                    </button>
                  </div>
                </div>
              )}
              {wizardStep === 2 && createForm && (
                <div className="wizard-step wizard-step-dynamic">
                  <p className="wizard-desc">
                    {createForm.lessons?.length ? 'Review AI output. Edit as needed, then publish.' : 'Add module details and lessons. Include YouTube links, documents, or text content.'}
                  </p>
                  <label>
                    Slug
                    <input
                      value={createForm.slug}
                      onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                      placeholder="url-friendly-id"
                    />
                  </label>
                  <label>
                    Title
                    <input
                      value={createForm.title}
                      onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                      placeholder="Module title"
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      value={createForm.description}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      rows={3}
                      placeholder="Module description"
                    />
                  </label>
                  <label>
                    Difficulty
                    <select
                      value={createForm.difficulty}
                      onChange={(e) => setCreateForm({ ...createForm, difficulty: e.target.value })}
                    >
                      {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Target Audience
                    <select
                      value={createForm.target_audience || 'trainee'}
                      onChange={(e) => setCreateForm({ ...createForm, target_audience: e.target.value })}
                    >
                      <option value="trainee">Trainees</option>
                      <option value="mediator">Mediators</option>
                    </select>
                  </label>

                  <div className="wizard-lessons-section">
                    <div className="wizard-lessons-header">
                      <strong>Lessons</strong>
                      <button
                        type="button"
                        className="academy-btn academy-btn-sm"
                        onClick={() => setCreateForm({
                          ...createForm,
                          lessons: [...(createForm.lessons || []), { title: '', content_type: 'text', content_html: '', video_url: '', file_url: '', duration_minutes: '' }],
                        })}
                      >
                        <Plus size={14} /> Add Lesson
                      </button>
                    </div>
                    {(createForm.lessons || []).map((l, i) => (
                      <div key={i} className="wizard-lesson-card">
                        <div className="wizard-lesson-header">
                          <span>Lesson {i + 1}</span>
                          <button
                            type="button"
                            className="btn-icon btn-danger"
                            onClick={() => setCreateForm({
                              ...createForm,
                              lessons: createForm.lessons.filter((_, j) => j !== i),
                            })}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <label>
                          <span>Title</span>
                          <input
                            value={l.title}
                            onChange={(e) => {
                              const lessons = [...createForm.lessons];
                              lessons[i] = { ...lessons[i], title: e.target.value };
                              setCreateForm({ ...createForm, lessons });
                            }}
                            placeholder="Lesson title"
                          />
                        </label>
                        <label>
                          <span>Content type</span>
                          <select
                            value={l.content_type || 'text'}
                            onChange={(e) => {
                              const lessons = [...createForm.lessons];
                              lessons[i] = { ...lessons[i], content_type: e.target.value };
                              setCreateForm({ ...createForm, lessons });
                            }}
                          >
                            <option value="text">Text / Article</option>
                            <option value="video">YouTube video</option>
                            <option value="file">Document (PDF, etc.)</option>
                            <option value="embed">Embed</option>
                          </select>
                        </label>
                        {(l.content_type || 'text') === 'video' && (
                          <label>
                            <span><Youtube size={14} /> YouTube URL</span>
                            <input
                              type="url"
                              value={l.video_url || ''}
                              onChange={(e) => {
                                const lessons = [...createForm.lessons];
                                lessons[i] = { ...lessons[i], video_url: e.target.value };
                                setCreateForm({ ...createForm, lessons });
                              }}
                              placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                            />
                          </label>
                        )}
                        {(l.content_type || 'text') === 'file' && (
                          <>
                            <label>
                              <span><LinkIcon size={14} /> Document URL (optional)</span>
                              <input
                                type="url"
                                value={l.file_url || ''}
                                onChange={(e) => {
                                  const lessons = [...createForm.lessons];
                                  lessons[i] = { ...lessons[i], file_url: e.target.value };
                                  setCreateForm({ ...createForm, lessons });
                                }}
                                placeholder="https://... or leave empty to upload"
                              />
                            </label>
                            <label>
                              <span>Or upload file</span>
                              <input
                                type="file"
                                accept=".pdf,.docx,.doc,.txt"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setLessonUploading(i);
                                  try {
                                    const fd = new FormData();
                                    fd.append('file', file);
                                    const { data } = await documents.upload(fd);
                                    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
                                    const url = `${apiBase}/documents/${data.id}/download`;
                                    const lessons = [...createForm.lessons];
                                    lessons[i] = { ...lessons[i], file_url: url };
                                    setCreateForm({ ...createForm, lessons });
                                  } catch (err) {
                                    alert(err.response?.data?.detail || 'Upload failed');
                                  } finally {
                                    setLessonUploading(null);
                                    e.target.value = '';
                                  }
                                }}
                                disabled={!!lessonUploading}
                              />
                              {lessonUploading === i && <span className="uploading-text">Uploading...</span>}
                            </label>
                          </>
                        )}
                        {(l.content_type || 'text') === 'text' && (
                          <label>
                            <span>Content</span>
                            <textarea
                              value={l.content_html || l.suggested_content || ''}
                              onChange={(e) => {
                                const lessons = [...createForm.lessons];
                                lessons[i] = { ...lessons[i], content_html: e.target.value };
                                setCreateForm({ ...createForm, lessons });
                              }}
                              rows={4}
                              placeholder="Lesson content (HTML or plain text)"
                            />
                          </label>
                        )}
                        {(l.content_type || 'text') === 'embed' && (
                          <label>
                            <span>Embed URL or iframe code</span>
                            <textarea
                              value={l.content_html || ''}
                              onChange={(e) => {
                                const lessons = [...createForm.lessons];
                                lessons[i] = { ...lessons[i], content_html: e.target.value };
                                setCreateForm({ ...createForm, lessons });
                              }}
                              rows={4}
                              placeholder="Paste embed URL (e.g. https://...) or full iframe HTML"
                            />
                          </label>
                        )}
                        <label>
                          <span>Duration (min)</span>
                          <input
                            type="number"
                            min={1}
                            value={l.duration_minutes || ''}
                            onChange={(e) => {
                              const lessons = [...createForm.lessons];
                              lessons[i] = { ...lessons[i], duration_minutes: e.target.value };
                              setCreateForm({ ...createForm, lessons });
                            }}
                            placeholder="e.g. 15"
                          />
                        </label>
                      </div>
                    ))}
                  </div>

                  {createForm.quiz_questions?.length > 0 && (
                    <div className="wizard-preview">
                      <strong>Quiz ({createForm.quiz_questions.length} questions)</strong>
                    </div>
                  )}
                  <div className="modal-actions">
                    <button className="academy-btn academy-btn-ghost" onClick={() => setWizardStep(1)}>
                      Back
                    </button>
                    <button
                      className="academy-btn academy-btn-primary"
                      onClick={handleCreateModule}
                      disabled={saving}
                    >
                      {saving ? <Loader2 size={18} className="spin" /> : <CheckCircle2 size={18} />}
                      {saving ? ' Creating...' : ' Publish Module'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Module Modal */}
      {editModalOpen && editForm && (
        <div className="academy-modal-overlay" onClick={() => !saving && setEditModalOpen(false)}>
          <div className="academy-modal academy-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Pencil size={20} /> Edit Module</h3>
              <button className="btn-close" onClick={() => !saving && setEditModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <label>Title<input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} /></label>
              <label>Description<textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} /></label>
              <label>Difficulty<select value={editForm.difficulty} onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value })}>{Object.entries(DIFFICULTY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label>Target Audience<select value={editForm.target_audience || 'trainee'} onChange={(e) => setEditForm({ ...editForm, target_audience: e.target.value })}><option value="trainee">Trainees</option><option value="mediator">Mediators</option></select></label>
              <label className="checkbox-label"><input type="checkbox" checked={editForm.is_published} onChange={(e) => setEditForm({ ...editForm, is_published: e.target.checked })} /> Published</label>
              <div className="wizard-lessons-section">
                <div className="wizard-lessons-header"><strong>Lessons</strong><button type="button" className="academy-btn academy-btn-sm" onClick={() => setEditForm({ ...editForm, lessons: [...(editForm.lessons || []), { id: null, title: '', content_type: 'text', content_html: '', video_url: '', file_url: '', order_index: (editForm.lessons || []).length, duration_minutes: '' }] })}><Plus size={14} /> Add Lesson</button></div>
                {(editForm.lessons || []).map((l, i) => (
                <div key={l.id || i} className="wizard-lesson-card">
                  <div className="wizard-lesson-header"><span>Lesson {i + 1}</span></div>
                  <label><span>Title</span><input value={l.title} onChange={(e) => { const lessons = [...editForm.lessons]; lessons[i] = { ...lessons[i], title: e.target.value }; setEditForm({ ...editForm, lessons }); }} /></label>
                  <label><span>Content type</span><select value={l.content_type} onChange={(e) => { const lessons = [...editForm.lessons]; lessons[i] = { ...lessons[i], content_type: e.target.value }; setEditForm({ ...editForm, lessons }); }}><option value="text">Text</option><option value="video">Video</option><option value="file">File</option><option value="embed">Embed</option></select></label>
                  {(l.content_type || 'text') === 'video' && <label><span>YouTube URL</span><input value={l.video_url || ''} onChange={(e) => { const lessons = [...editForm.lessons]; lessons[i] = { ...lessons[i], video_url: e.target.value }; setEditForm({ ...editForm, lessons }); }} /></label>}
                  {(l.content_type || 'text') === 'text' && <label><span>Content</span><textarea value={l.content_html || ''} onChange={(e) => { const lessons = [...editForm.lessons]; lessons[i] = { ...lessons[i], content_html: e.target.value }; setEditForm({ ...editForm, lessons }); }} rows={3} /></label>}
                  <label><span>Duration (min)</span><input type="number" value={l.duration_minutes || ''} onChange={(e) => { const lessons = [...editForm.lessons]; lessons[i] = { ...lessons[i], duration_minutes: e.target.value }; setEditForm({ ...editForm, lessons }); }} /></label>
                  {l.id && <button type="button" className="btn-icon btn-danger" onClick={async () => { if (!confirm('Delete this lesson?')) return; try { await trainingAcademyApi.deleteLesson(l.id); setEditForm({ ...editForm, lessons: editForm.lessons.filter((_, j) => j !== i) }); } catch (e) { alert(e.response?.data?.detail || 'Failed'); } }}><Trash2 size={14} /> Remove</button>}
                </div>
              ))}</div>
              <div className="modal-actions">
                <button className="academy-btn academy-btn-ghost" onClick={() => setEditModalOpen(false)}>Cancel</button>
                <button className="academy-btn academy-btn-primary" onClick={handleSaveEditModule} disabled={saving}>{saving ? <Loader2 size={18} className="spin" /> : null} Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Mediator Module Modal */}
      {mediatorEditModalOpen && mediatorEditForm && (
        <div className="academy-modal-overlay" onClick={() => !saving && setMediatorEditModalOpen(false)}>
          <div className="academy-modal academy-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Briefcase size={20} /> Edit Mediator Module</h3>
              <button className="btn-close" onClick={() => !saving && setMediatorEditModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <label>Title<input value={mediatorEditForm.title} onChange={(e) => setMediatorEditForm({ ...mediatorEditForm, title: e.target.value })} /></label>
              <label>Description<textarea value={mediatorEditForm.description} onChange={(e) => setMediatorEditForm({ ...mediatorEditForm, description: e.target.value })} rows={3} /></label>
              <label>Content (HTML)<textarea value={mediatorEditForm.content_html} onChange={(e) => setMediatorEditForm({ ...mediatorEditForm, content_html: e.target.value })} rows={8} placeholder="HTML content for the module" /></label>
              <label>Order index<input type="number" value={mediatorEditForm.order_index} onChange={(e) => setMediatorEditForm({ ...mediatorEditForm, order_index: parseInt(e.target.value, 10) || 0 })} /></label>
              <label className="checkbox-label"><input type="checkbox" checked={mediatorEditForm.is_published} onChange={(e) => setMediatorEditForm({ ...mediatorEditForm, is_published: e.target.checked })} /> Published</label>
              <div className="modal-actions">
                <button className="academy-btn academy-btn-ghost" onClick={() => setMediatorEditModalOpen(false)}>Cancel</button>
                <button className="academy-btn academy-btn-primary" onClick={handleSaveMediatorModule} disabled={saving}>{saving ? <Loader2 size={18} className="spin" /> : null} Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Builder Modal */}
      {quizModalOpen && quizModuleId && (
        <div className="academy-modal-overlay" onClick={() => !saving && setQuizModalOpen(false)}>
          <div className="academy-modal academy-quiz-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><FileText size={20} /> Add Quiz</h3>
              <button className="btn-close" onClick={() => !saving && setQuizModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <label>Quiz Title<input value={quizForm.title} onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })} placeholder="Module Quiz" /></label>
              <label>Passing Score (%)<input type="number" min={1} max={100} value={quizForm.passing_score_pct} onChange={(e) => setQuizForm({ ...quizForm, passing_score_pct: parseInt(e.target.value, 10) || 70 })} /></label>
              <div className="quiz-questions-section">
                <strong>Questions</strong>
                {(quizForm.questions || []).map((q, i) => (
                  <div key={i} className="quiz-question-card">
                    <div className="quiz-question-header"><span>Q{i + 1}</span><button type="button" className="btn-icon btn-danger" onClick={() => setQuizForm({ ...quizForm, questions: quizForm.questions.filter((_, j) => j !== i) })}><Trash2 size={14} /></button></div>
                    <label><input value={q.question} onChange={(e) => { const qs = [...quizForm.questions]; qs[i] = { ...qs[i], question: e.target.value }; setQuizForm({ ...quizForm, questions: qs }); }} placeholder="Question text" /></label>
                    <label>Options (comma or one per line)</label>
                    <textarea value={(q.options || []).join('\n')} onChange={(e) => { const opts = e.target.value.split(/[\n,]/).map((o) => o.trim()).filter(Boolean); const qs = [...quizForm.questions]; qs[i] = { ...qs[i], options: opts.length ? opts : [''] }; setQuizForm({ ...quizForm, questions: qs }); }} rows={3} placeholder="A, B, C, D" />
                    <label>Correct option index (0-based)<input type="number" min={0} value={q.correct_idx} onChange={(e) => { const qs = [...quizForm.questions]; qs[i] = { ...qs[i], correct_idx: parseInt(e.target.value, 10) || 0 }; setQuizForm({ ...quizForm, questions: qs }); }} /></label>
                  </div>
                ))}
                <button type="button" className="academy-btn academy-btn-sm" onClick={() => setQuizForm({ ...quizForm, questions: [...(quizForm.questions || []), { question: '', options: ['', '', '', ''], correct_idx: 0, feedback_correct: '', feedback_incorrect: '' }] })}><Plus size={14} /> Add Question</button>
              </div>
              <div className="modal-actions">
                <button className="academy-btn academy-btn-ghost" onClick={() => setQuizModalOpen(false)}>Cancel</button>
                <button className="academy-btn academy-btn-primary" onClick={handleCreateQuiz} disabled={saving}>{saving ? <Loader2 size={18} className="spin" /> : null} Create Quiz</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Progress Modal */}
      {studentModal && (
        <div className="academy-modal-overlay" onClick={() => setStudentModal(null)}>
          <div className="academy-modal academy-student-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Users size={20} /> Student Progress
              </h3>
              <button className="btn-close" onClick={() => setStudentModal(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {studentDetail ? (
                <>
                  <div className="student-profile">
                    <h4>{studentDetail.profile?.name}</h4>
                    <p>{studentDetail.profile?.email}</p>
                    <p className="student-meta">
                      Role: {studentDetail.profile?.role} · Region: {studentDetail.profile?.country} · Joined:{' '}
                      {studentDetail.profile?.join_date?.slice(0, 10)}
                    </p>
                    <div className="student-radar">
                      <span className="radar-item mastered">
                        <CheckCircle2 size={16} /> {studentDetail.skills_mastered ?? 0} mastered
                      </span>
                      <span className="radar-item pending">
                        <Clock size={16} /> {studentDetail.skills_pending ?? 0} pending
                      </span>
                    </div>
                  </div>
                  <div className="student-tasks">
                    <h4>Task List</h4>
                    <table className="task-table">
                      <thead>
                        <tr>
                          <th>Module</th>
                          <th>Status</th>
                          <th>Progress</th>
                          <th>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentDetail.task_list?.map((t) => (
                          <tr key={t.module_id}>
                            <td>{t.module_title}</td>
                            <td>
                              <span className={`status-badge status-${t.status}`}>
                                {STATUS_LABELS[t.status] || t.status}
                              </span>
                            </td>
                            <td>{t.progress_pct}%</td>
                            <td>{Math.round((t.time_spent_seconds || 0) / 60)} min</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(!studentDetail.task_list || studentDetail.task_list.length === 0) && (
                      <p className="no-tasks">No academy tasks yet.</p>
                    )}
                  </div>
                  <div className="modal-actions">
                    <a
                      href={`mailto:${studentDetail.profile?.email || ''}`}
                      className="academy-btn academy-btn-ghost"
                    >
                      <MessageSquare size={16} /> Message Student
                    </a>
                    <button
                      className="academy-btn academy-btn-primary"
                      onClick={() => setAssignModalOpen(true)}
                    >
                      Assign Remedial Module
                    </button>
                  </div>
                  {assignModalOpen && (
                    <div className="assign-module-dropdown">
                      <p className="assign-module-label">Select module to assign:</p>
                      <div className="assign-module-list">
                        {modules.filter((mo) => !studentDetail.task_list?.some((t) => t.module_id === mo.id)).map((mo) => (
                          <button
                            key={mo.id}
                            className="academy-btn academy-btn-sm"
                            onClick={() => handleAssignModule(mo.id)}
                          >
                            {mo.title}
                          </button>
                        ))}
                        {modules.filter((mo) => !studentDetail.task_list?.some((t) => t.module_id === mo.id)).length === 0 && (
                          <p className="no-modules">All modules already assigned.</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p>Loading...</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
