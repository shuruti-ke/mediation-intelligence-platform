import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookOpen, ArrowLeft } from 'lucide-react';
import { trainingApi } from '../api/client';
import '../styles/TraineeAcademy.css';

function renderArticleContent(text) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*|#{1,6}\s[^\n]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="trainee-article-strong">{part.slice(2, -2)}</strong>;
    }
    if (part.match(/^#{1,6}\s/)) {
      const level = part.match(/^#+/)[0].length;
      const content = part.replace(/^#+\s*/, '');
      const Tag = `h${Math.min(level, 4)}`;
      return <Tag key={i} className={`trainee-article-heading trainee-article-h${level}`}>{content}</Tag>;
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
      <div className="trainee-article-page">
        <div className="trainee-article-loading">
          <div className="trainee-loading-spinner" />
          <p>Loading article...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="trainee-article-page">
        <div className="trainee-article-error">
          <p>{error || 'Article not found'}</p>
          <Link to="/training/trainee-academy" className="trainee-sidebar-back">← Back to Trainee Academy</Link>
        </div>
      </div>
    );
  }

  const wordCount = article.content ? article.content.split(/\s+/).length : 0;
  const paragraphs = article.content ? article.content.split(/\n\n+/) : [];

  return (
    <div className="trainee-article-page">
      <header className="trainee-article-header">
        <div className="trainee-article-header-inner">
          <Link to="/training/trainee-academy" className="trainee-article-back">
            <ArrowLeft size={20} /> Back to Academy
          </Link>
          <span className="trainee-article-wordcount">
            <BookOpen size={18} /> {wordCount.toLocaleString()} words
          </span>
        </div>
      </header>

      <main className="trainee-article-main">
        <div className="trainee-article-meta">
          <p className="trainee-article-module">{article.module_title}</p>
          <h1 className="trainee-article-title">{article.title}</h1>
        </div>

        <article className="trainee-article-card">
          <div className="trainee-article-prose">
            {paragraphs.map((para, i) => {
              if (para.match(/^#{1,6}\s/)) {
                const level = para.match(/^#+/)[0].length;
                const content = para.replace(/^#+\s*/, '');
                const Tag = `h${Math.min(level, 4)}`;
                return (
                  <Tag key={i} className={`trainee-article-heading trainee-article-h${level}`}>
                    {content}
                  </Tag>
                );
              }
              return (
                <p key={i} className="trainee-article-para">
                  {renderArticleContent(para)}
                </p>
              );
            })}
          </div>
        </article>

        <div className="trainee-article-footer">
          <Link to="/training/trainee-academy" className="trainee-article-back">
            <ArrowLeft size={20} /> Back to Trainee Academy
          </Link>
          <span className="trainee-article-wordcount">{wordCount.toLocaleString()} words</span>
        </div>
      </main>
    </div>
  );
}
