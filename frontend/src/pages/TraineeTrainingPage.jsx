import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle, Clock, Award, Play, Menu, X, Brain, Zap, AlertCircle, Lightbulb } from 'lucide-react';
import { trainingApi } from '../api/client';

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
        <div className="max-w-2xl mx-auto space-y-8">
          <div className={`rounded-2xl border-2 p-8 text-center ${passed ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300' : 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-300'}`}>
            <h2 className={`text-3xl font-bold mb-4 ${passed ? 'text-green-900' : 'text-orange-900'}`}>
              {passed ? 'Congratulations!' : 'Keep Trying!'}
            </h2>
            <p className={`text-lg mb-2 ${passed ? 'text-green-700' : 'text-orange-700'}`}>Your Score: {examScore}%</p>
            <p className={`text-base ${passed ? 'text-green-700' : 'text-orange-700'}`}>{correct} out of {questions.length} correct</p>
            {!passed && <p className="text-sm mt-4 text-orange-600">Pass score is 70%. Review the material and try again.</p>}
          </div>

          <div className="flex gap-4">
            <button onClick={resetExam} className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-700 to-orange-600 text-white rounded-lg hover:shadow-lg font-semibold">
              Try Again
            </button>
            {examMode === 'module-exam' && passed && currentModule && (
              <button
                onClick={() => {
                  resetExam();
                  setCurrentModule(null);
                }}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:shadow-lg font-semibold"
              >
                Continue to Next Module
              </button>
            )}
            {examMode === 'final-exam' && (
              <button
                onClick={() => {
                  resetExam();
                  setActiveTab('certificate');
                }}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:shadow-lg font-semibold"
              >
                View Certificate
              </button>
            )}
          </div>
        </div>
      );
    }

    if (!currentQuestion) return null;

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white/60 backdrop-blur rounded-xl border border-orange-200 p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-orange-900">Question {currentQuestionIndex + 1} of {questions.length}</span>
            <span className="text-sm text-slate-600">{Math.round((currentQuestionIndex / questions.length) * 100)}% Complete</span>
          </div>
          <div className="w-full bg-orange-100 rounded-full h-3">
            <div className="bg-gradient-to-r from-orange-700 to-orange-600 h-3 rounded-full transition-all" style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }} />
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur rounded-2xl border border-orange-200 p-8">
          <h2 className="text-xl font-bold text-orange-900 mb-6">{currentQuestion.question}</h2>
          <div className="space-y-3 mb-8">
            {(currentQuestion.options || []).map((option) => (
              <button
                key={option.id}
                onClick={() => handleSelectAnswer(option.id)}
                disabled={examSubmitted}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all font-semibold ${
                  selectedAnswers[currentQuestionIndex] === option.id
                    ? 'bg-orange-100 border-orange-400 text-orange-900'
                    : 'bg-white border-orange-100 text-gray-900 hover:border-orange-300'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full border-2 border-inherit flex items-center justify-center">
                    {selectedAnswers[currentQuestionIndex] === option.id && '✓'}
                  </span>
                  {option.text}
                </span>
              </button>
            ))}
          </div>

          <div className="flex gap-4">
            <button onClick={handlePreviousQuestion} disabled={currentQuestionIndex === 0} className="px-6 py-2 bg-slate-200 text-gray-900 rounded-lg hover:bg-slate-300 disabled:opacity-50 font-semibold">
              ← Previous
            </button>
            {!isLastQuestion ? (
              <button onClick={handleNextQuestion} disabled={!isAnswered} className="flex-1 px-6 py-2 bg-orange-100 text-orange-900 rounded-lg hover:bg-orange-200 disabled:opacity-50 font-semibold flex items-center justify-center gap-2">
                Next →
              </button>
            ) : (
              <button onClick={handleSubmitExam} disabled={!isAnswered} className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg hover:shadow-lg disabled:opacity-50 font-semibold">
                Submit Exam
              </button>
            )}
          </div>
          {!isAnswered && (
            <p className="text-sm text-orange-700 mt-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Please select an answer to continue
            </p>
          )}
        </div>

        <div className="bg-white/60 backdrop-blur rounded-xl border border-orange-200 p-4">
          <p className="text-sm font-semibold text-orange-900 mb-3">Question Progress</p>
          <div className="flex flex-wrap gap-2">
            {questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentQuestionIndex(idx)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                  selectedAnswers[idx] !== undefined ? 'bg-green-500 text-white' : 'bg-orange-200 text-orange-900'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const ModuleCard = ({ module }) => {
    const status = getModuleStatus(module);
    const progressPct = getModuleProgress(module);

    return (
      <div className="bg-white/60 backdrop-blur rounded-2xl border border-orange-200 hover:border-orange-400 overflow-hidden hover:shadow-lg transition-all">
        <div className="h-24 bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-5xl">{module.icon}</div>
        <div className="p-6">
          <h3 className="text-lg font-bold text-orange-900 mb-2">{module.title}</h3>
          <p className="text-sm text-slate-700 mb-4 line-clamp-2">{module.description}</p>
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 flex items-center gap-2"><Clock className="w-4 h-4" /> {module.duration}</span>
              <span className="text-slate-600">{(module.lessons_data || []).length} lessons</span>
            </div>
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-600">Progress</span>
                <span className="font-semibold text-orange-700">{progressPct}%</span>
              </div>
              <div className="w-full bg-orange-100 rounded-full h-2">
                <div className="bg-gradient-to-r from-orange-700 to-orange-600 h-2 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>
          <button
            onClick={() => { setCurrentModule(module); setCurrentLesson((module.lessons_data || [])[0]); }}
            className={`w-full py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
              status === 'completed' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
              status === 'in-progress' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' :
              'bg-gradient-to-r from-orange-700 to-orange-600 text-white hover:shadow-lg'
            }`}
          >
            {status === 'completed' && <CheckCircle className="w-4 h-4" />}
            {status === 'completed' ? 'Completed' : status === 'in-progress' ? 'Continue' : 'Start'}
          </button>
        </div>
      </div>
    );
  };

  const LessonContent = ({ lesson, module }) => {
    const done = isLessonComplete(module.id, lesson.id);

    return (
      <div className="space-y-6">
        <div className="bg-white/60 backdrop-blur rounded-2xl border border-orange-200 p-8">
          <h2 className="text-2xl font-bold text-orange-900 mb-2">{lesson.title}</h2>
          <p className="text-sm text-slate-600 mb-4">{lesson.type} • {lesson.duration}</p>

          {lesson.video_id && (
            <div className="mb-6">
              <div className="aspect-video rounded-xl overflow-hidden bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${lesson.video_id}`}
                  title={lesson.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
              <p className="text-sm text-slate-700 mt-2">{lesson.content}</p>
            </div>
          )}

          {lesson.type === 'article' && lesson.content && (
            <div className="prose prose-orange max-w-none">
              <div className="whitespace-pre-wrap text-slate-700">{lesson.content}</div>
            </div>
          )}

          {lesson.type === 'summary' && lesson.content && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-slate-700">{lesson.content}</p>
            </div>
          )}

          <button
            onClick={() => markLessonComplete(module.id, lesson.id)}
            disabled={done}
            className={`mt-6 px-6 py-2 rounded-lg font-semibold ${done ? 'bg-green-100 text-green-700' : 'bg-orange-600 text-white hover:bg-orange-700'}`}
          >
            {done ? '✓ Completed' : 'Mark as complete'}
          </button>
        </div>
      </div>
    );
  };

  const CertificateTab = () => (
    <div className="max-w-2xl mx-auto">
      {finalPassed ? (
        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl border-4 border-yellow-400 p-12 shadow-2xl">
          <div className="text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h1 className="text-4xl font-bold text-yellow-900 mb-2">Certificate of Completion</h1>
            <p className="text-xl text-yellow-800 mb-8">Mediation Intelligence Platform – Trainee Mediator Certification</p>
            <div className="bg-white/50 rounded-xl p-8 mb-8">
              <p className="text-gray-700 mb-4">This is to certify that</p>
              <p className="text-2xl font-bold text-gray-900 mb-4">Trainee Mediator</p>
              <p className="text-gray-700 mb-6">has successfully completed the comprehensive training program in mediation</p>
              <div className="grid md:grid-cols-3 gap-4 my-8 pt-8 border-t-2 border-yellow-300">
                <div><p className="text-xs text-gray-600">Date</p><p className="font-bold text-gray-900">{new Date().toLocaleDateString()}</p></div>
                <div><p className="text-xs text-gray-600">Status</p><p className="font-bold text-green-700">CERTIFIED</p></div>
              </div>
            </div>
            <button className="px-8 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-bold">Download Certificate</button>
          </div>
        </div>
      ) : (
        <div className="bg-white/60 backdrop-blur rounded-2xl border border-orange-200 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-orange-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-orange-900 mb-2">Certification In Progress</h2>
          <p className="text-orange-700">Complete all modules and pass the final exam to earn your certificate.</p>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p>Loading Trainee Academy...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <header className="bg-white/80 backdrop-blur border-b border-orange-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-700 to-orange-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">📚</div>
            <div>
              <h1 className="font-bold text-orange-900">Trainee Academy</h1>
              <p className="text-xs text-slate-600">Mediator Certification Program</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <button onClick={() => { setActiveTab('modules'); setCurrentModule(null); setExamMode(null); }} className={`font-semibold transition-colors ${activeTab === 'modules' ? 'text-orange-700' : 'text-slate-700 hover:text-orange-700'}`}>Modules</button>
            <button onClick={() => setActiveTab('certificate')} className={`font-semibold transition-colors ${activeTab === 'certificate' ? 'text-orange-700' : 'text-slate-700 hover:text-orange-700'}`}>Certificate</button>
            <Link to="/training" className="px-6 py-2 bg-gradient-to-r from-orange-700 to-orange-600 text-white rounded-lg hover:shadow-lg font-semibold">← Back to Training</Link>
          </nav>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-orange-700">
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-orange-200 p-4 space-y-2">
            <button onClick={() => { setActiveTab('modules'); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-2 text-orange-700 font-semibold hover:bg-orange-50 rounded">Modules</button>
            <button onClick={() => { setActiveTab('certificate'); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-2 text-slate-700 font-semibold hover:bg-orange-50 rounded">Certificate</button>
            <Link to="/training" className="block px-4 py-2 text-orange-700 font-semibold hover:bg-orange-50 rounded">← Back to Training</Link>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {examMode === 'module-exam' ? (
          <div>
            <button onClick={resetExam} className="flex items-center gap-2 text-orange-700 hover:text-orange-900 font-semibold mb-6">← Back to Module</button>
            <div className="bg-white/60 backdrop-blur rounded-2xl border border-orange-200 p-8 mb-8">
              <div className="flex items-center gap-3 mb-2">
                <Brain className="w-6 h-6 text-orange-700" />
                <h2 className="text-2xl font-bold text-orange-900">{currentModule?.title} – Module Exam</h2>
              </div>
              <p className="text-slate-700">Answer all questions to proceed. Pass score: 70%</p>
            </div>
            <ExamInterface />
          </div>
        ) : examMode === 'final-exam' ? (
          <div>
            <button onClick={resetExam} className="flex items-center gap-2 text-orange-700 hover:text-orange-900 font-semibold mb-6">← Back to Modules</button>
            <div className="bg-white/60 backdrop-blur rounded-2xl border border-orange-200 p-8 mb-8">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="w-6 h-6 text-blue-600" />
                <h2 className="text-2xl font-bold text-orange-900">Final Certification Exam</h2>
              </div>
              <p className="text-slate-700">Pass with 70% or higher to earn your Trainee Mediator Certification</p>
            </div>
            <ExamInterface />
          </div>
        ) : currentModule ? (
          <div className="space-y-6">
            <button onClick={() => setCurrentModule(null)} className="flex items-center gap-2 text-orange-700 hover:text-orange-900 font-semibold">← Back to Modules</button>
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                {currentLesson ? (
                  <LessonContent lesson={currentLesson} module={currentModule} />
                ) : (
                  <div className="bg-white/60 backdrop-blur rounded-2xl border border-orange-200 p-8">
                    <h1 className="text-3xl font-bold text-orange-900 mb-4">{currentModule.title}</h1>
                    <p className="text-slate-700 text-lg">{currentModule.description}</p>
                    <p className="text-sm text-slate-600 mt-4">Select a lesson from the list.</p>
                  </div>
                )}

                <div className="bg-white/60 backdrop-blur rounded-2xl border border-orange-200 p-8">
                  <h2 className="text-2xl font-bold text-orange-900 mb-6">Course Content</h2>
                  <div className="space-y-3">
                    {(currentModule.lessons_data || []).map((lesson) => (
                      <div
                        key={lesson.id}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          isLessonComplete(currentModule.id, lesson.id) ? 'bg-green-50 border-green-300' :
                          currentLesson?.id === lesson.id ? 'bg-orange-50 border-orange-400' : 'bg-white border-orange-100 hover:border-orange-300'
                        }`}
                        onClick={() => setCurrentLesson(lesson)}
                      >
                        <div className="flex items-center gap-4">
                          {lesson.type === 'video' ? <Play className="w-5 h-5 text-orange-700" /> : lesson.type === 'interactive' ? <Lightbulb className="w-5 h-5 text-blue-600" /> : <BookOpen className="w-5 h-5 text-amber-700" />}
                          <div>
                            <p className="font-semibold text-gray-900">{lesson.title}</p>
                            <p className="text-sm text-slate-600">{lesson.type} • {lesson.duration}</p>
                          </div>
                          {isLessonComplete(currentModule.id, lesson.id) && <CheckCircle className="w-5 h-5 text-green-600 ml-auto" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-orange-700 to-orange-600 rounded-2xl p-8 text-white">
                  <h3 className="text-2xl font-bold mb-6">Module Progress</h3>
                  <div className="space-y-4 mb-6">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span>Lessons Completed</span>
                        <span className="font-bold">{(progress[currentModule.id]?.lessons || []).length}/{(currentModule.lessons_data || []).length}</span>
                      </div>
                      <div className="w-full bg-orange-500 rounded-full h-3">
                        <div className="bg-white h-3 rounded-full" style={{ width: `${getModuleProgress(currentModule)}%` }} />
                      </div>
                    </div>
                  </div>
                  {currentModule.module_exam && (
                    <button
                      onClick={() => { setExamMode('module-exam'); setCurrentQuestionIndex(0); setSelectedAnswers({}); setExamSubmitted(false); }}
                      className="w-full bg-white text-orange-700 font-bold py-3 rounded-lg hover:bg-orange-50 transition-all"
                    >
                      Take Module Exam
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'modules' ? (
          <div className="space-y-8">
            <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-2xl p-8 text-white">
              <h2 className="text-2xl font-bold mb-6">Your Training Progress</h2>
              <div className="grid md:grid-cols-4 gap-6">
                <div><p className="text-sm opacity-90">Total Modules</p><p className="text-3xl font-bold">{modules.length}</p></div>
                <div><p className="text-sm opacity-90">Completed</p><p className="text-3xl font-bold">{completedModules.length}</p></div>
                <div><p className="text-sm opacity-90">Status</p><p className="text-xl font-bold">{completedModules.length === modules.length ? 'Ready for Final' : 'In Progress'}</p></div>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-orange-900 mb-6">Modules</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {modules.map((module) => (
                  <ModuleCard key={module.id} module={module} />
                ))}
              </div>
            </div>
            {completedModules.length === modules.length && modules.length > 0 && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-300 p-8 text-center">
                <Award className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-blue-900 mb-2">Ready for Final Exam?</h3>
                <p className="text-blue-800 mb-6">You've completed all modules. Take the comprehensive final exam to earn your certification.</p>
                <button
                  onClick={() => { setExamMode('final-exam'); setCurrentQuestionIndex(0); setSelectedAnswers({}); setExamSubmitted(false); }}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg font-bold"
                >
                  Take Final Exam ({finalQuestions.length} Questions)
                </button>
              </div>
            )}
          </div>
        ) : (
          <CertificateTab />
        )}
      </main>

      <footer className="border-t border-orange-200 bg-white/50 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-slate-600">
          <p>&copy; {new Date().getFullYear()} Mediation Intelligence Platform. Training the next generation of mediators.</p>
        </div>
      </footer>
    </div>
  );
}
