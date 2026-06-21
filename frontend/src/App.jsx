import { useEffect, useState } from 'react';
import EvaluateForm from './components/EvaluateForm.jsx';
import ResultsView from './components/ResultsView.jsx';
import HistoryList from './components/HistoryList.jsx';
import LiveTimer from './components/LiveTimer.jsx';

const SAMPLE_URL = 'https://www.youtube.com/watch?v=eoTPt3XNHmk&pp=ygUbc2FsZXMgY2FsbCBleGFtcGxlIGluIGhpbmRp';

export default function App() {
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');

  async function refreshHistory() {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setHistory(data.evaluations || []);
    } catch (e) {
      console.error('history load failed', e);
    }
  }

  useEffect(() => { refreshHistory(); }, []);

  async function handleEvaluate(url) {
    setLoading(true);
    setError(null);
    setCurrent(null);
    setStatus('Starting…');
    try {
      const progressTimers = [
        setTimeout(() => setStatus('Downloading audio from YouTube…'), 400),
        setTimeout(() => setStatus('Transcribing & diarizing (Sarvam)…'), 8_000),
        setTimeout(() => setStatus('Rating the call (OpenRouter)…'), 25_000),
      ];

      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
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

  return (
    <div className="app">
      <header className="hero">
        <h1>Sales Call Evaluator</h1>
        <p>Paste a YouTube sales call link. We'll transcribe it (Hindi → English, diarized) and rate it.</p>
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

        {current && <ResultsView result={current} />}

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
