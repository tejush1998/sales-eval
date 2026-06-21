import { useState, useRef } from 'react';

export default function EvaluateForm({ onSubmit, loading, status, sampleUrl, elapsed }) {
  const [mode, setMode] = useState('upload');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  const inputRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (mode === 'upload') {
      if (!file) return;
      const fd = new FormData();
      fd.append('audio', file);
      onSubmit(fd);
    } else {
      if (!url.trim()) return;
      onSubmit(url.trim());
    }
  }

  const canSubmit = mode === 'upload' ? !!file : !!url.trim();

  return (
    <section className="card" data-testid="evaluate-form">
      <form onSubmit={handleSubmit}>
        <div className="mode-toggle">
          <button type="button" className={`mode-btn ${mode === 'upload' ? 'active' : ''}`} onClick={() => setMode('upload')} disabled={loading}>
            Upload audio
          </button>
          <button type="button" className={`mode-btn ${mode === 'youtube' ? 'active' : ''}`} onClick={() => setMode('youtube')} disabled={loading}>
            YouTube URL
          </button>
        </div>

        {mode === 'upload' ? (
          <div className="upload-area" onClick={() => inputRef.current?.click()}>
            <input
              ref={inputRef}
              type="file"
              accept="audio/*"
              onChange={(e) => setFile(e.target.files[0])}
              hidden
              disabled={loading}
            />
            {file ? (
              <div className="file-selected">
                <span className="file-icon">&#x1F4E4;</span>
                <span className="file-name">{file.name}</span>
                <span className="file-size">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                <button type="button" className="link" onClick={(e) => { e.stopPropagation(); setFile(null); }}>Remove</button>
              </div>
            ) : (
              <div className="upload-placeholder">
                <span className="upload-icon">&#x1F50A;</span>
                <span>Drop an audio file or click to browse</span>
                <span className="muted small">Supports MP3, WAV, M4A &mdash; max 100 MB</span>
              </div>
            )}
          </div>
        ) : (
          <>
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
            </div>
            <div className="sample">
              <button type="button" className="link" onClick={() => setUrl(sampleUrl)} disabled={loading}>
                Use sample URL
              </button>
            </div>
          </>
        )}

        <button type="submit" className="primary submit-btn" disabled={loading || !canSubmit} data-testid="submit-btn">
          {loading ? 'Evaluating…' : 'Evaluate'}
        </button>

        {loading && status && (
          <div className="status" data-testid="status">
            <span className="spinner" aria-hidden="true" /> {status} {elapsed}
          </div>
        )}
      </form>
    </section>
  );
}