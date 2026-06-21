import { formatDuration } from './LiveTimer.jsx';

function totalCost(costs) {
  const s = costs?.sarvam, o = costs?.openrouter;
  if (s == null && o == null) return null;
  return (s ?? 0) + (o ?? 0);
}

function totalTimeMs(timings) {
  return Number(timings?.totalMs) || 0;
}

export default function HistoryList({ items, onSelect }) {
  if (!items?.length) return null;
  return (
    <section data-testid="history">
      <h3 className="section-title">Previous evaluations</h3>
      <ul className="history-list">
        {items.map((item) => {
          const cost = totalCost(item.costs);
          const time = totalTimeMs(item.timings);
          return (
            <li key={item.id}>
              <button onClick={() => onSelect(item)} className="history-row">
                <div className="history-top">
                  <div className="history-title">{item.video?.title || item.originalName || 'Evaluation'}</div>
                  {item.rating?.overallScore != null && (
                    <div className="history-score">{item.rating.overallScore}</div>
                  )}
                </div>
                <div className="history-meta">
                  <span className={`badge badge-${item.status}`}>{item.status}</span>
                  {item.cached && <span className="badge badge-cached-sm">Cached</span>}
                  {cost != null && <span className="history-stat">&rsaquo; ₹{cost.toFixed(2)}</span>}
                  {time > 0 && <span className="history-stat">&rsaquo; {formatDuration(time)}</span>}
                  <span className="history-date">{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}