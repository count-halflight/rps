import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { FIGHTERS } from '../game/fighters.js';
import { DISTRICTS, WEAPONS, levelFor } from '../game/engine.js';
import { IMPLEMENTED_SEQUENCES, presentationForSequenceId, sequenceContactSheetTimes } from '../game/sequences/index.js';
import { SCENE_MOMENTS, evaluateSceneMoment, sceneMomentById, sceneMomentPresentation, sceneMomentContactSheetTimes } from '../game/sceneMoments.js';
import { COMBAT_MOMENTS, combatMomentById, combatMomentPresentation, combatMomentContactSheetTimes, evaluateCombatMoment } from '../game/combatMoments.js';
import { advanceLabClock } from '../game/labClock.js';
import { cancelChoreography, setAmbience } from '../game/audio.js';
import LabAudioControls from './LabAudioControls.jsx';
import './cinematicLab.css';

const Arena = lazy(() => import('./Arena.jsx'));
const combatTitles={
  'combat.reveal':'Hand reveal','combat.clash':'Weapon clash','combat.brace':'Brace','combat.defeat':'Light out',
  'item.medkit':'Medkit','item.coolant':'Coolant','item.battery':'Battery','item.scan':'Scan',
};

export default function CinematicLab() {
  const [id, setId] = useState(() => IMPLEMENTED_SEQUENCES[0].id);
  const [momentId, setMomentId] = useState('');
  const [combatCharacter, setCombatCharacter] = useState('echo');
  const [playerHand, setPlayerHand] = useState('rock');
  const [enemyHand, setEnemyHand] = useState('scissors');
  const [districtIndex, setDistrictIndex] = useState(5);
  const [rival, setRival] = useState('kuro');
  const [role, setRole] = useState('player');
  const [boss, setBoss] = useState(true);
  const [quality, setQuality] = useState('medium');
  const [reduced, setReduced] = useState(false);
  const [flashes, setFlashes] = useState(true);
  const [short, setShort] = useState(false);
  const [overlays, setOverlays] = useState({ bones: false, ik: false, camera: false });
  const [ready, setReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState('');
  const [clock, setClock] = useState({ time: 0, playing: false, loop: false, rate: 1 });
  const [stats, setStats] = useState({});
  const [audioCancelToken, setAudioCancelToken] = useState(0);
  const stage = useRef(null);
  const stopAudio = () => { cancelChoreography(); setAmbience(false); setAudioCancelToken(token => token + 1); };
  const combatDefinition=combatMomentById(momentId),sceneDefinition=sceneMomentById(momentId);
  const isCombat=!!combatDefinition;
  const revealOutcome=playerHand===enemyHand?'draw':WEAPONS.find(hand=>hand.id===playerHand).beats===enemyHand?'win':'loss';
  const combatOptions=useMemo(()=>({
    reduced,short,reduceFlashes:flashes,playerCharacter:combatCharacter,enemyCharacter:rival,
    playerHand,enemyHand,scannedHand:enemyHand,outcome:revealOutcome,
    mirrored:role==='rival',actorSide:role==='rival'?'enemy':'player',defeatedSide:role==='rival'?'enemy':'player',
    braced:role==='brace',bossId:boss?'bulwark':undefined,
  }),[reduced,short,flashes,combatCharacter,rival,playerHand,enemyHand,revealOutcome,role,boss]);
  const presentation = useMemo(() => isCombat ? combatMomentPresentation(momentId,combatOptions) : momentId ? sceneMomentPresentation(momentId, {
    reduced, short, reduceFlashes: flashes,
  }) : presentationForSequenceId(id, {
    reduced, short, reduceFlashes: flashes, outcome: role === 'rival' ? 'loss' : 'win', braced: role === 'brace', finalHit: true,
  }), [id, momentId, reduced, short, flashes, role,isCombat,combatOptions]);
  const duration = presentation.duration / 1000;
  const momentDefinition = combatDefinition||sceneDefinition;
  const definition = momentDefinition || IMPLEMENTED_SEQUENCES.find(s => s.id === id);
  const clipId = momentId || id;
  const character = isCombat ? combatCharacter : momentId ? 'echo' : presentation.character;
  const opponent = isCombat ? rival : momentId ? momentDefinition.character : role === 'rival' ? character : rival;
  const playingBoss = sceneDefinition ? !!sceneDefinition.bossId : boss;
  const district = DISTRICTS[districtIndex];
  const animation = useMemo(() => ({
    ...presentation, id: 'lab-' + clipId + '-' + role, outcome: isCombat ? revealOutcome : role === 'rival' ? 'loss' : 'win',
    playerWeapon: isCombat ? playerHand : presentation.weapon, enemyWeapon: isCombat ? enemyHand : presentation.weapon,
    finalHit: !isCombat && (presentation.finisher || presentation.finale),
    braced: role === 'brace', qteSuccess: 1, damage: 0, incoming: 0,
  }), [presentation, clipId, role,isCombat,revealOutcome,playerHand,enemyHand]);
  const entrance = useMemo(() => sceneDefinition ? {
    ...presentation, sequenceId: momentId, id: 'lab-' + momentId,
    phase: momentDefinition.phase || 0,
  } : null, [presentation, momentId, momentDefinition,sceneDefinition]);
  const stagingFrame = isCombat ? evaluateCombatMoment(momentId,clock.time,combatOptions) : momentId ? evaluateSceneMoment(momentId, clock.time, { reduced, short }) : null;
  const appearance = useMemo(() => playingBoss ? {
    id: 'bulwark', boss: true, bossId: 'bulwark', model: 'bulwark', name: 'BULWARK', color: '#b6bfc4',
    scale: 1.7, phase: 0, height: 2.2, weapon: 'Tower-shield hammer', kit: { layer: 'coat', detail: 'plates', theme: 'siege' },
  } : { ...levelFor(37, districtIndex + 1).rival, character: opponent, id: 'lab-rival-' + opponent }, [playingBoss, opponent, districtIndex]);

  useEffect(() => {
    let frame, previous = performance.now();
    const tick = now => {
      const delta = (now - previous) / 1000; previous = now;
      setClock(c => advanceLabClock(c, delta, duration));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration]);
  useEffect(() => { setClock(c => ({ ...c, time: 0, playing: false })); }, [id, momentId, reduced, short, role,combatCharacter,playerHand,enemyHand]);
  useEffect(() => {
    const timer = setInterval(() => {
      const d = stage.current?.querySelector('.three-arena')?.dataset;
      if (d) setStats({ shot: d.shot, fps: d.fps, calls: d.drawCalls, triangles: d.triangles, tier: d.renderQuality });
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const exportSheet = async () => {
    if (!ready || exporting) return;
    const arena = stage.current?.querySelector('.three-arena');
    const controller = arena?.__lab;
    if (!controller) { setStatus('WebGL is required to export rendered frames.'); return; }
    if (arena.dataset.frameAsset !== 'loaded' || arena.dataset.reflectionAsset !== 'loaded') {
      setReady(false); setStatus('Wait for the selected visual assets before exporting.'); return;
    }
    stopAudio(); setExporting(true); setClock(c => ({ ...c, playing: false })); setStatus('Rendering 12 frames');
    const canvas = document.createElement('canvas'); canvas.width = 3200; canvas.height = 1920;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#080e12'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const times = isCombat ? combatMomentContactSheetTimes(momentId,12) : momentId ? sceneMomentContactSheetTimes(momentId, 12, presentation) : sequenceContactSheetTimes(id, 12, presentation);
    const measurements = [];
    try {
      for (let i = 0; i < times.length; i++) {
        controller.renderAt(times[i]);
        measurements.push({time:times[i],drawCalls:Number(arena.dataset.drawCalls),triangles:Number(arena.dataset.triangles),shot:arena.dataset.shot,quality:arena.dataset.renderQuality});
        const img = new Image(); img.src = controller.capture(); await img.decode();
        const x = (i % 4) * 800, y = Math.floor(i / 4) * 640;
        const sourceAspect = img.width / img.height;
        const height = Math.min(570, 800 / sourceAspect), width = height * sourceAspect;
        ctx.drawImage(img, x + (800 - width) / 2, y, width, height);
        ctx.fillStyle = '#b9cfdb'; ctx.font = '22px "Barlow Condensed", sans-serif';
        ctx.fillText(clipId + '  ' + times[i].toFixed(2) + ' s', x + 20, y + 610);
        setStatus('Rendering frame ' + (i + 1) + '/12');
      }
      const a = document.createElement('a'); a.download = clipId + '-contact-sheet.png'; a.href = canvas.toDataURL('image/png'); a.click();
      arena.dataset.exportMeasurements=JSON.stringify(measurements);
      const peak=Math.max(...measurements.map(frame=>frame.drawCalls));
      setStatus('12-frame PNG exported · peak '+peak+' draw calls');
    } catch (error) { setStatus('Export failed: ' + error.message); }
    finally { controller.clearOverride(); setExporting(false); }
  };

  return <main className="cinematic-lab" aria-label="Cinematic Lab">
    <header className="lab-top"><a href="#/" onClick={() => { if (location.search.includes('lab=1')) location.href = location.pathname; }}>Return to game</a><h1>Cinematic Lab</h1><span>{IMPLEMENTED_SEQUENCES.length} attacks · {SCENE_MOMENTS.length+COMBAT_MOMENTS.length} staging clips</span></header>
    <div className="lab-layout">
      <aside className="lab-controls">
        <label>Sequence<select value={id} onChange={e => setId(e.target.value)}>{IMPLEMENTED_SEQUENCES.map(s => <option key={s.id} value={s.id}>{s.id} · {s.title}</option>)}</select></label>
        <label>Staging<select data-lab="staging" value={momentId} onChange={e => setMomentId(e.target.value)}><option value="">Attack sequence</option><optgroup label="Entrances and boss phases">{SCENE_MOMENTS.map(s => <option key={s.id} value={s.id}>{s.id} · {s.title}</option>)}</optgroup><optgroup label="Shared combat">{COMBAT_MOMENTS.map(s=><option key={s.id} value={s.id}>{s.id} · {combatTitles[s.id]}</option>)}</optgroup></select></label>
        {isCombat&&<label>Fighter kit<select data-lab="combat-character" value={combatCharacter} onChange={e=>setCombatCharacter(e.target.value)}>{FIGHTERS.map(f=><option key={f.id} value={f.id}>{f.name} · {f.weapon}</option>)}</select></label>}
        {isCombat&&combatDefinition.kind==='reveal'&&<>
          <label>Your hand<select data-lab="player-hand" value={playerHand} onChange={e=>setPlayerHand(e.target.value)}>{WEAPONS.map(hand=><option key={hand.id} value={hand.id}>{hand.name}</option>)}</select></label>
          <label>Rival hand<select data-lab="enemy-hand" value={enemyHand} onChange={e=>setEnemyHand(e.target.value)}>{WEAPONS.map(hand=><option key={hand.id} value={hand.id}>{hand.name}</option>)}</select></label>
          <small>{revealOutcome==='win'?'Player wins':revealOutcome==='loss'?'Rival wins':'Draw'}</small>
        </>}
        <label>Arena<select value={districtIndex} onChange={e => setDistrictIndex(Number(e.target.value))}>{DISTRICTS.map((d, i) => <option value={i} key={d.id || i}>{d.name}</option>)}</select></label>
        <label>Rival kit<select value={rival} onChange={e => setRival(e.target.value)}>{FIGHTERS.map(f => <option key={f.id} value={f.id}>{f.name} · {f.weapon}</option>)}</select></label>
        <label>Version<select value={role} onChange={e => setRole(e.target.value)}><option value="player">Player</option><option value="rival">Mirrored rival</option><option value="brace">Braced defender</option></select></label>
        <label>Graphics<select value={quality} onChange={e => setQuality(e.target.value)}><option value="high">High</option><option value="medium">Medium</option><option value="low">Light</option></select></label>
        <label><input type="checkbox" checked={boss} onChange={e => setBoss(e.target.checked)} /> Bulwark opponent</label>
        <label><input type="checkbox" checked={reduced} onChange={e => setReduced(e.target.checked)} /> Reduced motion</label>
        <label><input type="checkbox" checked={flashes} onChange={e => setFlashes(e.target.checked)} /> Reduce flashes</label>
        <label><input type="checkbox" checked={short} onChange={e => setShort(e.target.checked)} /> Short playback</label>
        <fieldset><legend>Overlays</legend>{Object.keys(overlays).map(key => <label key={key}><input type="checkbox" checked={overlays[key]} onChange={e => setOverlays(o => ({ ...o, [key]: e.target.checked }))} /> {key === 'ik' ? 'Grip / foot targets' : key === 'camera' ? 'Camera path' : 'Bones'}</label>)}</fieldset>
        <LabAudioControls animation={animation} level={districtIndex+1} disabled={!ready || exporting} cancelToken={audioCancelToken} onPlay={() => setClock(c=>({...c,time:0,playing:true,rate:1,loop:false}))} onStop={() => setClock(c=>({...c,playing:false}))}/>
        <button data-action="export-sheet" onClick={exportSheet} disabled={!ready || exporting}>{exporting ? 'Rendering…' : 'Export 12-frame PNG'}</button>
        <p role="status">{status}</p>
      </aside>
      <section className="lab-screen">
        <div className="lab-viewport" ref={stage}>
          <Suspense fallback={<p>Loading the arena</p>}><Arena
            character={!momentId && role === 'rival' ? rival : character} enemyCharacter={opponent}
            weapon={isCombat ? playerHand : presentation.weapon} animation={sceneDefinition ? null : animation} entrance={entrance} district={district} enemyLevel={districtIndex + 1}
            quality={quality} reducedMotion={reduced} reduceFlashes={flashes} enemyAppearance={appearance}
            phase="ready" labTime={clock.time} labOverlays={{...overlays,clip:sceneDefinition?entrance:animation}} enemyHpRatio={presentation.finale && clock.time >= 9 ? 0 : 1}
            onReady={result => {setReady(result?.visuals !== false);setStatus(current => result?.visuals === false ? 'Visual assets failed to load. Retry visuals or choose another graphics setting.' : current.startsWith('Visual assets failed') ? '' : current);}}
            onLoading={() => {setReady(false);stopAudio();setClock(c=>({...c,playing:false}));}}
          /></Suspense>
          {(presentation.tier >= 3 || stagingFrame?.bars) && <div className="lab-letterbox" aria-hidden="true" />}
          {stagingFrame?.card?.opacity > 0 && <div className="lab-staging-card" style={{opacity:stagingFrame.card.opacity}}><h2>{stagingFrame.card.title}</h2>{stagingFrame.card.subtitle && <span>{stagingFrame.card.subtitle}</span>}{stagingFrame.taunt?.text&&<p>{stagingFrame.taunt.text}</p>}</div>}
          <div className="lab-shot-label">{clipId} · {momentId ? 'Staging' : 'T' + presentation.tier} · {stats.shot || 'Establish'}</div>
        </div>
        <div className="lab-transport">
          <button aria-label={clock.playing ? 'Pause sequence' : 'Play sequence'} disabled={!ready || exporting} onClick={() => {stopAudio();setClock(c => ({ ...c, playing: !c.playing, time: c.time >= duration ? 0 : c.time }));}}>{clock.playing ? 'Pause' : 'Play'}</button>
          <button onClick={() => {stopAudio();setClock(c => ({ ...c, time: 0, playing: false }));}}>Reset</button>
          <label><input type="checkbox" checked={clock.loop} onChange={e => setClock(c => ({ ...c, loop: e.target.checked }))} /> Loop</label>
          <label>Speed<select value={clock.rate} onChange={e => setClock(c => ({ ...c, rate: Number(e.target.value) }))}>{[.1, .25, .5, 1, 2].map(rate => <option key={rate} value={rate}>{rate}×</option>)}</select></label>
          <output>{clock.time.toFixed(2)} / {duration.toFixed(2)} s</output>
        </div>
        <label className="lab-scrub">Timeline<input aria-label="Scrub sequence" type="range" min="0" max={duration} step=".001" value={clock.time} disabled={exporting} onChange={e => {stopAudio();setClock(c => ({ ...c, time: Number(e.target.value), playing: false }));}} /></label>
        <div className="lab-measurements"><span>{stats.calls || '—'} draw calls</span><span>{stats.triangles || '—'} triangles</span><span>{stats.fps || '—'} fps</span><span>{stats.tier || quality}</span><span>{definition?.hitTimes?.length ?? definition?.contactTimes?.length ?? presentation.contacts?.length ?? 0} contacts</span></div>
      </section>
    </div>
  </main>;
}
