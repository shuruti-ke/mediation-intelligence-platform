import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle, Clock, Award, Play, Menu, X, Brain, Zap, AlertCircle, Lightbulb } from 'lucide-react';

const TRAINING_MODULES = [
  {
    id: 'module-1',
    title: 'Fundamentals of Mediation',
    description: 'Understanding core mediation principles, processes, and the role of a mediator',
    duration: '2 weeks',
    lessons: 8,
    icon: '🎯',
    status: 'completed',
    lessons_data: [
      { id: 'l1-1', title: 'What is Mediation?', type: 'video', duration: '12 min' },
      { id: 'l1-2', title: 'The Role of a Mediator', type: 'video', duration: '15 min' },
      { id: 'l1-3', title: 'Mediation vs Arbitration', type: 'article', duration: '10 min' },
      { id: 'l1-4', title: 'Ethical Standards', type: 'video', duration: '18 min' },
      { id: 'l1-5', title: 'Communication Fundamentals', type: 'interactive', duration: '20 min' },
      { id: 'l1-6', title: 'Active Listening Techniques', type: 'video', duration: '16 min' },
      { id: 'l1-7', title: 'Opening Statements', type: 'interactive', duration: '15 min' },
      { id: 'l1-8', title: 'Module Review', type: 'summary', duration: '10 min' },
    ],
    moduleExam: {
      questions: [
        { id: 'q1', question: 'What is the primary role of a mediator in dispute resolution?', type: 'multiple-choice', options: [{ id: 'a', text: 'To make a binding decision for the parties' }, { id: 'b', text: 'To facilitate communication and help parties reach their own agreement' }, { id: 'c', text: 'To represent one of the parties' }, { id: 'd', text: 'To judge who is right or wrong' }], correctAnswer: 'b', explanation: 'A mediator facilitates the dispute resolution process without making binding decisions.' },
        { id: 'q2', question: 'Which of the following is a key ethical principle for mediators?', type: 'multiple-choice', options: [{ id: 'a', text: 'Impartiality and neutrality' }, { id: 'b', text: 'Confidentiality' }, { id: 'c', text: 'Competence' }, { id: 'd', text: 'All of the above' }], correctAnswer: 'd', explanation: 'All these principles are fundamental to ethical mediation practice.' },
        { id: 'q3', question: 'Active listening involves:', type: 'multiple-choice', options: [{ id: 'a', text: 'Simply hearing what the other person says' }, { id: 'b', text: 'Understanding, processing, and responding to what is said' }, { id: 'c', text: 'Planning your response while listening' }, { id: 'd', text: 'Interrupting to clarify points immediately' }], correctAnswer: 'b', explanation: 'Active listening is a comprehensive process of engagement with the speaker.' },
        { id: 'q4', question: 'What is the main difference between mediation and arbitration?', type: 'multiple-choice', options: [{ id: 'a', text: 'Mediation is faster' }, { id: 'b', text: 'In arbitration, the arbitrator makes a binding decision; in mediation, parties decide' }, { id: 'c', text: 'Arbitration is only for businesses' }, { id: 'd', text: 'There is no real difference' }], correctAnswer: 'b', explanation: 'The key distinction is that arbitrators impose decisions while mediators facilitate agreement.' },
        { id: 'q5', question: 'Which of these should be included in a mediator\'s opening statement?', type: 'multiple-choice', options: [{ id: 'a', text: 'The mediator\'s opinion on the case' }, { id: 'b', text: 'Process explanation, confidentiality rules, and the parties\' roles' }, { id: 'c', text: 'Legal advice to the parties' }, { id: 'd', text: 'Promises of guaranteed outcomes' }], correctAnswer: 'b', explanation: 'Opening statements set expectations about the mediation process.' },
      ],
    },
  },
  {
    id: 'module-2',
    title: 'Communication & Conflict Management',
    description: 'Master advanced communication techniques and strategies for managing various conflict styles',
    duration: '2 weeks',
    lessons: 8,
    icon: '💬',
    status: 'in-progress',
    lessons_data: [
      { id: 'l2-1', title: 'Conflict Styles Framework', type: 'video', duration: '14 min' },
      { id: 'l2-2', title: 'Non-Violent Communication', type: 'interactive', duration: '22 min' },
      { id: 'l2-3', title: 'De-escalation Techniques', type: 'video', duration: '16 min' },
      { id: 'l2-4', title: 'Reframing & Neutralization', type: 'interactive', duration: '18 min' },
      { id: 'l2-5', title: 'Managing Emotions', type: 'article', duration: '12 min' },
      { id: 'l2-6', title: 'Asking Powerful Questions', type: 'interactive', duration: '20 min' },
      { id: 'l2-7', title: 'Reflective Listening', type: 'video', duration: '15 min' },
      { id: 'l2-8', title: 'Module Review', type: 'summary', duration: '10 min' },
    ],
  },
  {
    id: 'module-3',
    title: "Kenya's Mediation Framework & Law",
    description: 'Comprehensive overview of Kenyan mediation laws, constitutional framework, and ADR mechanisms',
    duration: '3 weeks',
    lessons: 10,
    icon: '⚖️',
    status: 'not-started',
    lessons_data: [
      { id: 'l3-1', title: 'Constitutional Framework', type: 'video', duration: '20 min' },
      { id: 'l3-2', title: 'The Mediation Act Overview', type: 'article', duration: '15 min' },
      { id: 'l3-3', title: 'ADR Mechanisms in Kenya', type: 'interactive', duration: '18 min' },
      { id: 'l3-4', title: 'Court-Annexed Mediation', type: 'video', duration: '16 min' },
    ],
  },
  {
    id: 'module-4',
    title: 'Practical Mediation Techniques',
    description: 'Hands-on training in negotiation, problem-solving, and agreement drafting',
    duration: '3 weeks',
    lessons: 9,
    icon: '💼',
    status: 'not-started',
    lessons_data: [
      { id: 'l4-1', title: 'Interests vs Positions', type: 'video', duration: '14 min' },
      { id: 'l4-2', title: 'Principled Negotiation', type: 'interactive', duration: '25 min' },
      { id: 'l4-3', title: 'Problem-Solving Frameworks', type: 'interactive', duration: '20 min' },
    ],
  },
  {
    id: 'module-5',
    title: 'Specialized Mediation Areas',
    description: 'Training in family, commercial, community, and land dispute mediation',
    duration: '3 weeks',
    lessons: 9,
    icon: '🌍',
    status: 'not-started',
    lessons_data: [
      { id: 'l5-1', title: 'Family Dispute Mediation', type: 'video', duration: '18 min' },
      { id: 'l5-2', title: 'Commercial Mediation', type: 'interactive', duration: '20 min' },
      { id: 'l5-3', title: 'Community & Land Disputes', type: 'video', duration: '16 min' },
    ],
  },
];

const FINAL_EXAM_QUESTIONS = [
  { id: 'final-q1', question: 'In a mediation session, one party becomes angry and stops communicating. As a mediator, what is your best approach?', type: 'multiple-choice', options: [{ id: 'a', text: 'Ask them to leave the session immediately' }, { id: 'b', text: 'Continue the session with the other party' }, { id: 'c', text: 'Take a break, meet individually, and help them regain composure' }, { id: 'd', text: 'Tell them their emotions are irrelevant to the dispute' }], correctAnswer: 'c', explanation: 'Managing emotions and maintaining engagement is crucial to effective mediation.' },
  { id: 'final-q2', question: 'What is the most important characteristic of confidentiality in mediation?', type: 'multiple-choice', options: [{ id: 'a', text: 'Protecting information shared in private meetings' }, { id: 'b', text: 'Not disclosing anything discussed without written consent' }, { id: 'c', text: 'Keeping mediator notes confidential' }, { id: 'd', text: 'All of the above' }], correctAnswer: 'd', explanation: 'Comprehensive confidentiality is essential to the mediation process.' },
  { id: 'final-q3', question: 'You discover that one party is not disclosing relevant information. What should you do?', type: 'multiple-choice', options: [{ id: 'a', text: 'Continue the mediation without addressing it' }, { id: 'b', text: 'Share this with the other party' }, { id: 'c', text: 'Address it privately with the non-disclosing party' }, { id: 'd', text: 'Terminate the mediation immediately' }], correctAnswer: 'c', explanation: 'Address disclosure issues privately to maintain fairness and process integrity.' },
  { id: 'final-q4', question: 'Which principle is central to effective problem-solving in mediation?', type: 'multiple-choice', options: [{ id: 'a', text: 'Focusing on positions rather than interests' }, { id: 'b', text: 'Generating creative solutions that address underlying interests' }, { id: 'c', text: 'Letting the parties determine all outcomes' }, { id: 'd', text: 'Finding quick compromises' }], correctAnswer: 'b', explanation: 'Interest-based problem-solving leads to sustainable agreements.' },
  { id: 'final-q5', question: 'Under Kenyan law, what is the enforceability of a mediated agreement?', type: 'multiple-choice', options: [{ id: 'a', text: 'It has no legal effect' }, { id: 'b', text: 'It is binding only if parties agree to be bound' }, { id: 'c', text: 'It is always binding' }, { id: 'd', text: 'It requires court approval' }], correctAnswer: 'b', explanation: 'Mediated agreements are binding only if parties explicitly agree to be legally bound.' },
];

export default function TraineeTrainingPage() {
  const [currentModule, setCurrentModule] = useState(null);
  const [currentLesson, setCurrentLesson] = useState(null);
  const [activeTab, setActiveTab] = useState('modules');
  const [completedModules, setCompletedModules] = useState([]);
  const [moduleExams, setModuleExams] = useState({});
  const [finalExamStarted, setFinalExamStarted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [examMode, setExamMode] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examScore, setExamScore] = useState(null);

  const questions = examMode === 'module-exam' && currentModule?.moduleExam
    ? currentModule.moduleExam.questions
    : examMode === 'final-exam'
    ? FINAL_EXAM_QUESTIONS
    : [];

  const handleSelectAnswer = (optionId) => {
    if (!examSubmitted) {
      setSelectedAnswers({
        ...selectedAnswers,
        [currentQuestionIndex]: optionId,
      });
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

  const ExamInterface = () => {
    const currentQuestion = questions[currentQuestionIndex];
    const isAnswered = selectedAnswers[currentQuestionIndex] !== undefined;
    const isLastQuestion = currentQuestionIndex === questions.length - 1;

    if (examSubmitted) {
      const correct = Object.keys(selectedAnswers).filter(idx => selectedAnswers[idx] === questions[idx].correctAnswer).length;
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

          <div className="bg-white/60 backdrop-blur rounded-2xl border border-orange-200 p-8">
            <h3 className="text-2xl font-bold text-orange-900 mb-6">Answer Review</h3>
            <div className="space-y-4">
              {questions.map((q, idx) => {
                const userAnswer = selectedAnswers[idx];
                const isCorrect = userAnswer === q.correctAnswer;
                const userOption = q.options.find(o => o.id === userAnswer);
                const correctOption = q.options.find(o => o.id === q.correctAnswer);
                return (
                  <div key={q.id} className={`p-4 rounded-lg border-2 ${isCorrect ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                    <div className="flex items-start gap-3 mb-2">
                      <span className={`font-bold text-lg ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                        {isCorrect ? '✓' : '✗'} Q{idx + 1}
                      </span>
                      <div>
                        <p className="font-semibold text-gray-900 mb-2">{q.question}</p>
                        <p className={`text-sm mb-2 ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>Your answer: {userOption?.text}</p>
                        {!isCorrect && <p className="text-sm text-green-700 mb-2">Correct answer: {correctOption?.text}</p>}
                        <p className="text-sm text-slate-700 italic">{q.explanation}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={resetExam} className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-700 to-orange-600 text-white rounded-lg hover:shadow-lg font-semibold">
              Try Again
            </button>
            {examMode === 'module-exam' && passed && currentModule && (
              <button
                onClick={() => {
                  setCompletedModules([...completedModules, currentModule.id]);
                  setModuleExams({ ...moduleExams, [currentModule.id]: { score: examScore, passed: true } });
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
            {currentQuestion.options.map((option) => (
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
    const lessonsCompleted = Math.floor(module.lessons * (module.status === 'completed' ? 1 : module.status === 'in-progress' ? 0.5 : 0));
    const progress = (lessonsCompleted / module.lessons) * 100;

    return (
      <div className="bg-white/60 backdrop-blur rounded-2xl border border-orange-200 hover:border-orange-400 overflow-hidden hover:shadow-lg transition-all">
        <div className="h-24 bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-5xl">{module.icon}</div>
        <div className="p-6">
          <h3 className="text-lg font-bold text-orange-900 mb-2">{module.title}</h3>
          <p className="text-sm text-slate-700 mb-4 line-clamp-2">{module.description}</p>
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 flex items-center gap-2"><Clock className="w-4 h-4" /> {module.duration}</span>
              <span className="text-slate-600">{module.lessons} lessons</span>
            </div>
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-600">Progress</span>
                <span className="font-semibold text-orange-700">{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-orange-100 rounded-full h-2">
                <div className="bg-gradient-to-r from-orange-700 to-orange-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
          <button
            onClick={() => { setCurrentModule(module); setCurrentLesson(module.lessons_data[0]); }}
            className={`w-full py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
              module.status === 'completed' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
              module.status === 'in-progress' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' :
              'bg-gradient-to-r from-orange-700 to-orange-600 text-white hover:shadow-lg'
            }`}
          >
            {module.status === 'completed' && <CheckCircle className="w-4 h-4" />}
            {module.status === 'completed' ? 'Completed' : module.status === 'in-progress' ? 'Continue' : 'Start'}
          </button>
        </div>
      </div>
    );
  };

  const CertificateTab = () => {
    const passed = Object.values(moduleExams).every(e => e?.passed);
    return (
      <div className="max-w-2xl mx-auto">
        {passed ? (
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
  };

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
              <p className="text-slate-700">Answer all questions to proceed to the next module</p>
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
                <div className="bg-white/60 backdrop-blur rounded-2xl border border-orange-200 p-8">
                  <h1 className="text-3xl font-bold text-orange-900 mb-4">{currentModule.title}</h1>
                  <p className="text-slate-700 text-lg">{currentModule.description}</p>
                </div>
                <div className="bg-white/60 backdrop-blur rounded-2xl border border-orange-200 p-8">
                  <h2 className="text-2xl font-bold text-orange-900 mb-6">Course Content</h2>
                  <div className="space-y-3">
                    {currentModule.lessons_data.map((lesson) => (
                      <div
                        key={lesson.id}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
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
                        <span className="font-bold">{Math.floor(currentModule.lessons / 2)}/{currentModule.lessons}</span>
                      </div>
                      <div className="w-full bg-orange-500 rounded-full h-3">
                        <div className="bg-white h-3 rounded-full" style={{ width: `${(Math.floor(currentModule.lessons / 2) / currentModule.lessons) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                  {currentModule.moduleExam && (
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
                <div><p className="text-sm opacity-90">Total Modules</p><p className="text-3xl font-bold">{TRAINING_MODULES.length}</p></div>
                <div><p className="text-sm opacity-90">Completed</p><p className="text-3xl font-bold">{completedModules.length}</p></div>
                <div><p className="text-sm opacity-90">Status</p><p className="text-xl font-bold">{completedModules.length === TRAINING_MODULES.length ? 'Ready for Final' : 'In Progress'}</p></div>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-orange-900 mb-6">Modules</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {TRAINING_MODULES.map((module) => (
                  <ModuleCard key={module.id} module={module} />
                ))}
              </div>
            </div>
            {completedModules.length === TRAINING_MODULES.length && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-300 p-8 text-center">
                <Award className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-blue-900 mb-2">Ready for Final Exam?</h3>
                <p className="text-blue-800 mb-6">You've completed all modules. Take the comprehensive final exam to earn your certification.</p>
                <button
                  onClick={() => { setExamMode('final-exam'); setCurrentQuestionIndex(0); setSelectedAnswers({}); setExamSubmitted(false); }}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg font-bold"
                >
                  Take Final Exam ({FINAL_EXAM_QUESTIONS.length} Questions)
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
