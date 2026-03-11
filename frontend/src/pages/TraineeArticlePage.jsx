import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookOpen, ArrowLeft } from 'lucide-react';
import { trainingApi } from '../api/client';

function renderArticleContent(text) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*|#{1,6}\s[^\n]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-orange-900">{part.slice(2, -2)}</strong>;
    }
    if (part.match(/^#{1,6}\s/)) {
      const level = part.match(/^#+/)[0].length;
      const content = part.replace(/^#+\s*/, '');
      const Tag = `h${Math.min(level, 4)}`;
      return <Tag key={i} className={`font-bold text-orange-900 mt-8 mb-3 ${level === 1 ? 'text-3xl' : level === 2 ? 'text-2xl' : 'text-xl'}`}>{content}</Tag>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function TraineeArticlePage() {
  const { lessonId } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!lessonId) return;
    trainingApi.getTraineeArticle(lessonId)
      .then(({ data }) => setArticle(data))
      .catch(() => setError('Article not found'))
      .finally(() => setLoading(false));
  }, [lessonId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center">
        <div className="loading-spinner w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-orange-700 mb-4">{error || 'Article not found'}</p>
          <Link to="/training/trainee-academy" className="text-orange-600 font-semibold hover:underline">← Back to Trainee Academy</Link>
        </div>
      </div>
    );
  }

  const wordCount = article.content ? article.content.split(/\s+/).length : 0;
  const paragraphs = article.content ? article.content.split(/\n\n+/) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <header className="bg-white/80 backdrop-blur border-b border-orange-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/training/trainee-academy" className="flex items-center gap-2 text-orange-700 hover:text-orange-900 font-semibold">
            <ArrowLeft className="w-5 h-5" /> Back to Academy
          </Link>
          <span className="text-sm text-slate-600 flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> {wordCount.toLocaleString()} words
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <p className="text-sm text-orange-600 font-semibold mb-1">{article.module_title}</p>
          <h1 className="text-4xl font-bold text-orange-900">{article.title}</h1>
        </div>

        <article className="bg-white/80 backdrop-blur rounded-2xl border border-orange-200 p-8 md:p-12 shadow-sm">
          <div className="prose-article text-slate-800 leading-relaxed space-y-6">
            {paragraphs.map((para, i) => {
              if (para.match(/^#{1,6}\s/)) {
                const level = para.match(/^#+/)[0].length;
                const content = para.replace(/^#+\s*/, '');
                const Tag = `h${Math.min(level, 4)}`;
                return (
                  <Tag
                    key={i}
                    className={`font-bold text-orange-900 ${level === 1 ? 'text-2xl mt-10 mb-4' : level === 2 ? 'text-xl mt-8 mb-3' : 'text-lg mt-6 mb-2'}`}
                  >
                    {content}
                  </Tag>
                );
              }
              return (
                <p key={i} className="whitespace-pre-wrap">
                  {renderArticleContent(para)}
                </p>
              );
            })}
          </div>
        </article>

        <div className="mt-8 flex justify-between items-center">
          <Link to="/training/trainee-academy" className="flex items-center gap-2 text-orange-700 hover:text-orange-900 font-semibold">
            <ArrowLeft className="w-5 h-5" /> Back to Trainee Academy
          </Link>
          <span className="text-sm text-slate-600">{wordCount.toLocaleString()} words</span>
        </div>
      </main>
    </div>
  );
}
