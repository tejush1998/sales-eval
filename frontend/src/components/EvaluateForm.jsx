import { useState } from 'react';

export default function EvaluateForm({ onSubmit, loading, status, sampleUrl, elapsed }) {
  const [url, setUrl] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!url.trim()) return;
    onSubmit(url.trim());
  }

  return (
    <section className="card" data-testid="evaluate-form">
      <form onSubmit={handleSubmit}>
        <label htmlFor="yt-url">YouTube URL</label>
        <div className="row">
          <input
            id="yt-url"
            data-testid="yt-url-input"
            type="url"
            placeholder="https://www.youtube.com/watch?v=…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            required
          />
          <button
            type="submit"
            className="primary"
            disabled={loading || !url.trim()}
            data-testid="submit-btn"
          >
            {loading ? 'Evaluating…' : 'Evaluate'}
          </button>
        </div>
        <div className="sample">
          <button
            type="button"
            className="link"
            onClick={() => setUrl(sampleUrl)}
            disabled={loading}
          >
            Use sample URL
          </button>
        </div>
        {loading && status && (
          <div className="status" data-testid="status">
            <span className="spinner" aria-hidden="true" /> {status} {elapsed}
          </div>
        )}
      </form>
    </section>
  );
}
