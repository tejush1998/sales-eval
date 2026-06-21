import { useEffect, useState } from 'react';
import EvaluateForm from './components/EvaluateForm.jsx';
import ResultsView from './components/ResultsView.jsx';
import HistoryList from './components/HistoryList.jsx';
import LoginForm from './components/LoginForm.jsx';
import LiveTimer from './components/LiveTimer.jsx';

const SAMPLE_URL = 'https://www.youtube.com/watch?v=eoTPt3XNHmk&pp=ygUbc2FsZXMgY2FsbCBleGFtcGxlIGluIGhpbmRp';

export default function App() {
  const [authenticated, setAuthenticated] = useState(null); // null = checking
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/check');
        setAuthenticated(res.ok);
        if (res.ok) refreshHistory();
      } catch {
        setAuthenticated(false);
      }
    })();
  }, []);

  async function refreshHistory() {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setHistory(data.evaluations || []);
    } catch (e) {
      console.error('history load failed', e);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthenticated(false);
    setCurrent(null);
    setHistory([]);
  }

  useEffect(() => {
    if (!current) return;
    const el = document.querySelector('[data-testid="results"]')?.closest('section') || document.querySelector('[data-testid="results"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [current]);

  async function handleEvaluate(input) {
    setLoading(true);
    setError(null);
    setCurrent(null);
    setStatus('Starting…');
    try {
      const isUpload = input instanceof FormData;
      const progressTimers = isUpload ? [
        setTimeout(() => setStatus('Transcribing & diarizing…'), 2_000),
        setTimeout(() => setStatus('Rating the call…'), 20_000),
      ] : [
        setTimeout(() => setStatus('Downloading audio from YouTube…'), 400),
        setTimeout(() => setStatus('Transcribing & diarizing…'), 8_000),
        setTimeout(() => setStatus('Rating the call…'), 25_000),
      ];

      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: isUpload ? {} : { 'Content-Type': 'application/json' },
        body: isUpload ? input : JSON.stringify({ url: input }),
      });
      progressTimers.forEach(clearTimeout);

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
      setCurrent(data);
      setStatus('');
      refreshHistory();
    } catch (e) {
      setError(e.message);
      setStatus('');
    } finally {
      setLoading(false);
    }
  }

  if (authenticated === null) {
    return <div className="app"><div className="login-wrapper"><p className="muted">Checking…</p></div></div>;
  }

  if (!authenticated) {
    return <LoginForm onLogin={() => { setAuthenticated(true); refreshHistory(); }} />;
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-top">
          <h1>Sales Call Evaluator</h1>
          <button type="button" className="link logout-btn" onClick={handleLogout}>Logout</button>
        </div>
        <p>Upload a sales call recording or paste a YouTube link. We'll transcribe it (Hindi → English, diarized) and rate it.</p>
      </header>

      <main>
        <EvaluateForm
          onSubmit={handleEvaluate}
          loading={loading}
          status={status}
          sampleUrl={SAMPLE_URL}
          elapsed={<LiveTimer active={loading} />}
        />

        {error && (
          <div className="card error" role="alert">
            <strong>Error:</strong> {error}
          </div>
        )}

        {current && <ResultsView result={current} onClose={() => setCurrent(null)} />}

        <HistoryList
          items={history}
          onSelect={(item) => setCurrent(item)}
        />
      </main>

      <footer>
        <small>Backend: Express · Sarvam (saaras:v3) · OpenRouter (DeepSeek) · File-based DB</small>
      </footer>
    </div>
  );
}
