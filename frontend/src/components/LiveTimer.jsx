import { useEffect, useState } from 'react';

export default function LiveTimer({ active }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) { setElapsed(0); return; }
    const start = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - start), 100);
    return () => clearInterval(t);
  }, [active]);

  if (!active) return null;
  return <span className="elapsed" data-testid="elapsed">{formatDuration(elapsed)}</span>;
}

export function formatDuration(ms) {
  if (!ms || ms < 0) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem.toString().padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  const mrem = m % 60;
  return `${h}h ${mrem.toString().padStart(2, '0')}m`;
}

export function formatCost(usd) {
  if (usd == null) return '—';
  if (usd === 0) return '$0.00';
  if (usd < 0.0001) return `$${usd.toExponential(2)}`;
  if (usd < 1) return `$${usd.toFixed(6)}`;
  return `$${usd.toFixed(4)}`;
}
