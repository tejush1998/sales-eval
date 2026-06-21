import TimingsPanel from './TimingsPanel.jsx';

export default function ResultsView({ result }) {
  const { video, transcription, rating, timings, costs, openRouter, cached } = result;

  return (
    <section className="card" data-testid="results">
      <div className="results-header">
        <div>
          <h2 data-testid="video-title">{video?.title || 'Evaluation Result'}</h2>
          {video?.author && <p className="muted">by {video.author}</p>}
          {video?.thumbnail && <img className="thumb" src={video.thumbnail} alt="" />}
          {cached && <span className="badge badge-cached">Cached transcription</span>}
        </div>
        {rating && (
          <div className="score" data-testid="overall-score">
            <div className="score-num">{rating.overallScore ?? '—'}</div>
            <div className="score-label">Overall / 100</div>
          </div>
        )}
      </div>

      {rating?.summary && <p className="summary">{rating.summary}</p>}

      {timings && <TimingsPanel timings={timings} costs={costs} openRouter={openRouter} />}

      {rating?.criteria?.length > 0 && (
        <div className="criteria" data-testid="criteria">
          <h3>Criteria</h3>
          <ul>
            {rating.criteria.map((c, i) => (
              <li key={i}>
                <div className="criteria-head">
                  <span className="criteria-name">{c.name}</span>
                  <span className="criteria-score">{c.score}/{c.max}</span>
                </div>
                <div className="bar"><div className="bar-fill" style={{ width: `${(c.score / c.max) * 100}%` }} /></div>
                {c.reasoning && <p className="reasoning">{c.reasoning}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {Array.isArray(rating?.strengths) && rating.strengths.length > 0 && (
        <div className="bullets">
          <h3>Strengths</h3>
          <ul>{rating.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}

      {Array.isArray(rating?.improvements) && rating.improvements.length > 0 && (
        <div className="bullets">
          <h3>Areas to Improve</h3>
          <ul>{rating.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}

      {transcription?.turns?.length > 0 && (
        <details className="transcript">
          <summary>Show transcript ({transcription.turns.length} turns)</summary>
          <div className="turns" data-testid="turns">
            {transcription.turns.map((t, i) => (
              <div key={i} className={`turn speaker-${t.speaker}`}>
                <span className="speaker-badge">Speaker {t.speaker}</span>
                <p>{t.text}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
