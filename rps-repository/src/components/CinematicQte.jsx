import React, { useEffect, useState } from 'react';
import { activeQte } from '../game/qte.js';
import './cinematicQte.css';

export default function CinematicQte({ animation, onPress }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!animation?.qte?.length) return;
    let frame;
    const tick = () => {
      setElapsed(Math.max(0, performance.now() - animation.startedAt));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [animation?.id]);
  if (!animation?.qte?.length) return null;
  const cue = activeQte(animation.qte, elapsed);
  const feedback = animation.qte.find(entry => entry.status !== 'pending' && elapsed >= entry.resolvedAt && elapsed - entry.resolvedAt < 650);
  if (!cue && !feedback) return null;
  const remaining = cue ? Math.max(0, (cue.closesAt - elapsed) / (cue.closesAt - cue.opensAt)) : 0;
  return (
    <div className={`cinematic-qte ${cue ? 'qte-live' : feedback.status === 'hit' ? 'qte-hit' : 'qte-missed'}`} role="status" aria-live="polite">
      {cue ? <>
        <span className="qte-action">{cue.label}</span>
        <button className="qte-target" onPointerDown={event => {event.preventDefault(); onPress(cue.key);}}
          onClick={event => {if (event.detail === 0) onPress(cue.key);}}
          aria-label={`Quick time event: press ${cue.key} to ${cue.label.toLowerCase()}`} style={{'--qte-remaining':remaining}}>
          <svg viewBox="0 0 100 100" aria-hidden="true"><circle className="qte-ring-track" cx="50" cy="50" r="45"/><circle className="qte-ring-time" cx="50" cy="50" r="45" pathLength="1"/></svg>
          <b>{cue.key}</b>
        </button>
        <small>Press {cue.key} or tap</small>
      </> : <>
        <strong>{feedback.status === 'hit' ? 'Perfect' : 'Missed'}</strong>
        <small>{feedback.status === 'hit' ? '+3 charge' : 'Keep fighting'}</small>
      </>}
    </div>
  );
}
