export default function HistoryList({ items, onSelect }) {
  if (!items?.length) return null;
  return (
    <section className="card" data-testid="history">
      <h3>Previous evaluations</h3>
      <ul className="history-list">
        {items.map((item) => (
          <li key={item.id}>
            <button onClick={() => onSelect(item)} className="history-row">
              <div className="history-title">{item.video?.title || item.url}</div>
              <div className="history-meta">
                <span className={`badge badge-${item.status}`}>{item.status}</span>
                {item.rating?.overallScore != null && (
                  <span className="badge">Score {item.rating.overallScore}</span>
                )}
                <time>{new Date(item.createdAt).toLocaleString()}</time>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
