import React, { useEffect, useRef, useState } from 'react';
import { SkipForward } from 'lucide-react';
import { finaleSkipReady, finaleHoldProgress } from './finaleSkipClock.js';

export default function FinaleSkip({ animation, paused, seen = false, onSkip }) {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const hold = useRef(null), completed = useRef(false), skip = useRef(onSkip);
  skip.current = onSkip;
  useEffect(() => {
    completed.current = false;
    hold.current = null;
    setProgress(0);
  }, [animation.id]);
  useEffect(() => {
    let frame;
    const tick = now => {
      const allowed = finaleSkipReady(now - animation.startedAt, paused);
      setReady(allowed);
      if (!allowed) hold.current = null;
      const next = allowed ? finaleHoldProgress(now, hold.current) : 0;
      setProgress(next);
      if (next === 1 && !completed.current) {
        completed.current = true;
        hold.current = null;
        skip.current?.();
      }
      if (!completed.current) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); hold.current = null; };
  }, [animation.id, animation.startedAt, paused]);
  const start = () => {
    if (ready && !completed.current && hold.current === null) hold.current = performance.now();
  };
  const cancel = () => { hold.current = null; setProgress(0); };
  const release = () => {
    if (ready && !paused && !completed.current && finaleHoldProgress(performance.now(), hold.current) === 1) {
      completed.current = true;
      skip.current?.();
    }
    cancel();
  };
  return <button className={`finale-skip ${seen ? 'show-hint' : ''} ${progress > 0 ? 'holding' : ''}`}
    type="button" disabled={!ready} aria-label="Hold for two seconds to skip finale"
    aria-describedby={seen ? 'finale-skip-hint' : undefined}
    style={{ '--hold-progress': progress }}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      start();
    }} onPointerUp={release} onPointerCancel={cancel} onLostPointerCapture={cancel}
    onKeyDown={event => { if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); start(); } }}
    onKeyUp={event => { if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); release(); } }}
    onBlur={cancel}>
    <svg className="skip-progress" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" /></svg>
    <SkipForward size={18} aria-hidden="true" />
    {seen && <span id="finale-skip-hint">Hold to skip</span>}
  </button>;
}
