import { formatDuration } from './LiveTimer.jsx';

const STAGES = [
  { key: 'metaMs', label: 'Fetch video metadata' },
  { key: 'downloadMs', label: 'Download audio (yt-dlp)' },
  { key: 'transcribeMs', label: 'Transcribe + diarize (Sarvam)' },
  { key: 'rateMs', label: 'Rate call (OpenRouter / DeepSeek)' },
];

export function formatMoney(amount, currency) {
  if (amount == null) return '—';
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '';
  const num = Number(amount);
  if (!Number.isFinite(num)) return '—';
  if (num === 0) return `${symbol}0`;
  if (currency === 'INR') return `${symbol}${num.toFixed(2)}`;
  if (num < 0.0001) return `${symbol}${num.toExponential(2)}`;
  if (num < 1) return `${symbol}${num.toFixed(6)}`;
  return `${symbol}${num.toFixed(4)}`;
}

function formatDurationHours(seconds) {
  if (!seconds || seconds <= 0) return null;
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.round(seconds / 60)} min`;
  return `${hours.toFixed(2)} hr`;
}

function formatTotal(costs) {
  const sarvam = costs?.sarvam;
  const openrouter = costs?.openrouter;
  if (sarvam == null && openrouter == null) return '—';
  const total = (sarvam ?? 0) + (openrouter ?? 0);
  return formatMoney(total, 'INR');
}

export default function TimingsPanel({ timings, costs, openRouter, video }) {
  if (!timings) return null;
  const total = Number(timings.totalMs) || 0;
  const rows = STAGES.map((s) => ({
    ...s,
    ms: Number(timings[s.key]) || 0,
  })).filter((r) => r.ms > 0);

  return (
    <div className="timings" data-testid="timings">
      <div className="timings-head">
        <h3>Performance &amp; Cost</h3>
        <div className="totals">
          <div className="total-cell">
            <div className="total-num" data-testid="total-time">{formatDuration(total)}</div>
            <div className="total-label">total time</div>
          </div>
          <div className="total-cell">
            <div className="total-num" data-testid="total-cost">{formatTotal(costs)}</div>
            <div className="total-label">est. cost</div>
          </div>
        </div>
      </div>

      <table className="timings-table">
        <thead>
          <tr>
            <th>Stage</th>
            <th className="num">Time</th>
            <th className="bar-col">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = total > 0 ? (r.ms / total) * 100 : 0;
            return (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td className="num">{formatDuration(r.ms)}</td>
                <td className="bar-col">
                  <div className="stage-bar">
                    <div className="stage-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <table className="costs-table">
        <thead>
          <tr>
            <th>Provider</th>
            <th className="num">Cost</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              Sarvam (saaras:v3)
              <div className="muted small">custom rate · ₹{costs?.sarvamRatePerHourINR ?? 45}/hr</div>
            </td>
            <td className="num" data-testid="sarvam-cost">{formatMoney(costs?.sarvam ?? null, costs?.sarvamCurrency || 'INR')}</td>
            <td className="muted">
              {costs?.sarvamLengthSeconds
                ? `Audio length: ${formatDurationHours(costs.sarvamLengthSeconds)}`
                : 'audio length unknown'}
              {video?.lengthSeconds ? ` · billed as ceiling of full video` : ''}
            </td>
          </tr>
          <tr>
            <td>
              OpenRouter{openRouter?.model ? ` · ${openRouter.model}` : ''}
            </td>
            <td className="num">{formatMoney(costs?.openrouter ?? null, 'INR')}
              {costs?.openrouterUSD != null && (
                <div className="muted small">${costs.openrouterUSD.toFixed(6)} USD @ ₹{costs?.usdToInrRate ?? 86}</div>
              )}</td>
            <td className="muted">
              {openRouter?.usage
                ? `${openRouter.usage.promptTokens ?? 0} prompt + ${openRouter.usage.completionTokens ?? 0} completion tokens`
                : 'usage not returned'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
