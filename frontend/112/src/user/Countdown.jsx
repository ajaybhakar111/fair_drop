import React, { useEffect, useState } from "react";

const pad = (value) => String(value).padStart(2, "0");

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  }

  if (hours > 0) {
    return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  }

  if (minutes > 0) {
    return `${pad(minutes)}m ${pad(seconds)}s`;
  }

  return `${pad(seconds)}s`;
}

export default function Countdown({ to, label }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(to) - Date.now()));

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, new Date(to) - Date.now()));

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [to]);

  return (
    <div className="countdown" aria-live="polite">
      <span className="countdown-label">{label}</span>
      <strong className="countdown-value">{formatRemaining(remaining)}</strong>
    </div>
  );
}
