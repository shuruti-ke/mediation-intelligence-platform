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

  useEffect(() => {
    document.documentElement.classList.toggle('academy-dark', darkMode);
    localStorage.setItem('academyDarkMode', darkMode);
  }, [darkMode]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [modRes, anaRes, riskRes, studRes] = await Promise.allSettled([
        trainingAcademyApi.listModules(),
        trainingAcademyApi.getAnalytics(),
        trainingAcademyApi.getRiskAlert(),
        trainingAcademyApi.listStudents(),
      ]);
      setModules(modRes.status === 'fulfilled' ? modRes.value.data : []);
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
  }, []);

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

  const openStudentModal = async (student) => {
    setStudentModal(student);
    try {
      const { data } = await trainingAcademyApi.getStudentDetail(student.id);
      setStudentDetail(data);
    } catch (e) {
      setStudentDetail(null);
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
            <div className="module-grid">
              {modules.map((m) => (
                <div key={m.id} className="module-card">
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
                  </div>
                  <div className="module-card-body">
                    <h3>{m.title}</h3>
                    <p className="module-desc">{m.description || 'No description'}</p>
                    <div className="module-meta">
                      <span>{m.lesson_count} lessons</span>
                      <span>{m.quiz_count} quizzes</span>
                      {m.is_published && <span className="badge-pub">Published</span>}
                    </div>
                  </div>
                  <div className="module-card-actions">
                    <button className="btn-icon" title="Edit (coming soon)">
                      <Pencil size={16} />
                    </button>
                    <button
                      className="btn-icon btn-danger"
                      title="Archive"
                      onClick={() => handleArchiveModule(m.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {modules.length === 0 && (
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
                    <button className="academy-btn academy-btn-ghost">Message Student</button>
                    <button className="academy-btn academy-btn-primary">Assign Remedial Module</button>
                  </div>
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
