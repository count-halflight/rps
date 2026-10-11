import React, { useEffect, useRef, useState } from 'react';
import {
  audioSnapshot,
  cancelSequenceAudio,
  configureAudio,
  playChoreography,
  playSceneMomentAudio,
  playCombatMomentAudio,
  setAmbience,
  setBattleAudio,
  unlockAudio,
} from '../game/audio.js';

let previewSerial = 0;

/** A trusted-click audio transport. The parent owns the visual Lab clock. */
export default function LabAudioControls({ animation, level = 1, onPlay, onStop, disabled = false, cancelToken = 0 }) {
  const [phase, setPhase] = useState('idle');
  const [music, setMusic] = useState(false);
  const [message, setMessage] = useState('');
  const owner = useRef(null);
  const endTimer = useRef(null);
  const request = useRef(0);
  const musicOwned = useRef(false);
  const mounted = useRef(false);
  const callbacks = useRef({ onPlay, onStop });
  callbacks.current = { onPlay, onStop };

  const floor = Math.max(1, Number.isFinite(level) ? level : Number(level?.level) || 1);
  // A parent's clock updates must not stop a clip. Only its source changes do.
  const source = JSON.stringify([
    animation?.momentId || animation?.sequenceId || animation?.id, animation?.duration,
    animation?.bodyDuration, animation?.tier, animation?.outcome,
    animation?.reduced, animation?.short, animation?.braced, animation?.side,
    animation?.mirrored, animation?.bossId, animation?.phase, animation?.sfx,
    animation?.playerCharacter, animation?.enemyCharacter, animation?.actorSide,
    animation?.defeatedSide, animation?.playerHand, animation?.enemyHand,
  ]);

  const release = () => {
    request.current += 1;
    clearTimeout(endTimer.current);
    endTimer.current = null;
    const id = owner.current;
    owner.current = null;
    if (id !== null) cancelSequenceAudio(id);
    if (musicOwned.current) setAmbience(false);
    musicOwned.current = false;
    return id !== null;
  };

  useEffect(() => {
    mounted.current = true;
    setPhase('idle');
    setMessage('');
    return () => {
      mounted.current = false;
      release();
    };
  }, [source, floor, cancelToken]);

  const stop = () => {
    release();
    setPhase('idle');
    setMessage('');
    callbacks.current.onStop?.();
  };

  const play = async () => {
    release();
    const token = request.current;
    setPhase('unlocking');
    setMessage('');
    configureAudio(60, true);
    // resume() is invoked during the button's trusted event, never on mount.
    try { await unlockAudio(); } catch {}
    if (!mounted.current || request.current !== token) return;
    if (audioSnapshot().state !== 'running') {
      setPhase('idle');
      setMessage('Audio is unavailable. You can still use the visual preview.');
      return;
    }

    const preview = {
      ...animation,
      id: `lab-audio-${++previewSerial}`,
      startedAt: performance.now(),
    };
    owner.current = preview.id;
    setBattleAudio(1, 1);
    // Establish the score before scheduling the cinematic's duck and silence.
    setAmbience(music, floor);
    musicOwned.current = music;
    callbacks.current.onPlay?.(preview);
    if (/^(combat|item)\./.test(preview.momentId || '')) playCombatMomentAudio(preview.momentId, { ...preview, sound: true });
    else if (preview.momentId) playSceneMomentAudio(preview.momentId, { ...preview, sound: true });
    else playChoreography(preview, true);
    if (audioSnapshot().sequenceId !== preview.id) {
      stop();
      setMessage('Audio could not start. You can still use the visual preview.');
      return;
    }
    setPhase('playing');
    endTimer.current = setTimeout(() => {
      if (!mounted.current || owner.current !== preview.id) return;
      stop();
    }, Math.max(0, preview.duration) + 40);
  };

  const busy = phase === 'playing' || phase === 'unlocking';
  return (
    <fieldset className="lab-audio-controls" style={{ display: 'grid', gap: 8 }}>
      <legend>Attack sound</legend>
      <button type="button" onClick={play}
        disabled={disabled || !animation || !Number.isFinite(animation.duration) || phase === 'unlocking'}
        style={{ minHeight: 48 }}>
        {phase === 'unlocking' ? 'Opening audio…' : phase === 'playing' ? 'Replay with audio' : 'Audio preview'}
      </button>
      <button type="button" onClick={stop} disabled={!busy} style={{ minHeight: 48 }}>
        Stop audio
      </button>
      <label>
        <input type="checkbox" checked={music} disabled={busy}
          onChange={event => setMusic(event.target.checked)} />
        District music
      </label>
      {message && <small role="status">{message}</small>}
    </fieldset>
  );
}
