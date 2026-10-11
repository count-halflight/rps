import React, { Suspense, lazy, useState, useEffect, useLayoutEffect, useRef } from "react";
import { weaponFor } from "../game/engine";
import { PERKS } from "../game/perks.js";
import { fighterFor } from "../game/fighters";
import { rivalProfile, visualPhaseFor } from "../game/rivalProfile.js";
import { signatureWarning as bossSignatureWarning } from "../game/rivals.js";
import { sequenceById, evaluateSequence } from "../game/sequences/index.js";
import WeaponIcon from "./WeaponIcon";
import WeaponMark from "./WeaponMark";
import KitPortrait from "./KitPortrait";
import RivalWeaponMark from "./RivalWeaponMark";
import FinaleSkip from "./FinaleSkip";
import { IntegralGraph } from "./CalculusLab";
const Arena = lazy(() => import("./Arena"));
export default function BattleStage({
  run,
  weapon,
  animation,
  pending,
  busy,
  paused,
  dossier,
  preferences,
  finish,
  entrance,
  onReady,
  onLoading,
  onSkipAnimation,
  finaleSeen = false,
  presentationRival,
  brokenPlates = 0,
  heat = run.heat,
  signatureWarning = bossSignatureWarning(run),
  scan = Boolean(run.scanned),
  lastHand = run.history?.find(exchange => exchange.playerWeapon)?.playerWeapon ?? null,
}) {
  const [ready, setReady] = useState(false),
    [revealed, setRevealed] = useState(false),
    [hands, setHands] = useState(false);
  const liveAnimation = useRef(animation), counter = useRef(null), counterValue = useRef(null), blackDip = useRef(null), softImpact = useRef(null);
  liveAnimation.current = animation;
  useLayoutEffect(() => {
    if (!busy || !animation || !sequenceById(animation.sequenceId)) return;
    let request;
    const initial = performance.now(), start = animation.startedAt ?? initial;
    let elapsed = Math.max(0, initial - start);
    const draw = now => {
      if (!paused) elapsed = Math.max(0, now - start);
      const frame = evaluateSequence(animation.sequenceId, elapsed / 1000, liveAnimation.current);
      if (counter.current) {
        counter.current.hidden = !(frame.counter > 0) || frame.hideHud === true;
        if (counterValue.current) counterValue.current.textContent = String(frame.counter);
      }
      const impactFrame = frame.fx.find(effect => effect.id === 'IMPACT_FRAME');
      const impactDip = impactFrame ? Math.sin(Math.PI * Math.max(0, Math.min(1, impactFrame.phase))) * Math.min(.1, impactFrame.opacity ?? .08) : 0;
      if (blackDip.current) blackDip.current.style.opacity = String(Math.max(impactDip, Math.min(.96, frame.finale?.blackout || 0)));
      if (softImpact.current) softImpact.current.style.opacity = String(Math.min(preferences.reduceFlashes === false ? .09 : .035, (frame.finale?.desaturate || 0) * .09));
      request = requestAnimationFrame(draw);
    };
    draw(initial);
    return () => {
      cancelAnimationFrame(request);
      if (counter.current) counter.current.hidden = true;
      if (blackDip.current) blackDip.current.style.opacity = '0';
      if (softImpact.current) softImpact.current.style.opacity = '0';
    };
  }, [animation?.id, busy, paused, preferences.reduceFlashes]);
  useLayoutEffect(() => {
    setRevealed(false);
    setHands(false);
    if (!busy || !animation) return;
    const elapsed=Math.max(0,performance.now()-(animation.startedAt??performance.now()));
    const one = setTimeout(
        () => setHands(true),
        Math.max(0,animation.duration * animation.revealAt-elapsed),
      ),
      two = setTimeout(
        () => setRevealed(true),
        Math.max(0,animation.duration * animation.impactAt-elapsed),
      );
    return () => {
      clearTimeout(one);
      clearTimeout(two);
    };
  }, [animation?.id, busy]);
  const playerHp=busy&&revealed?Math.min(run.maxHp,Math.max(0,run.hp-(animation?.incoming||0)+(animation?.healing||0))):run.hp;
  const enemyHp=busy&&revealed?Math.min(run.enemy.maxHp,Math.max(0,run.enemy.hp-(animation?.damage||0)+(animation?.enemyHealing||0))):run.enemy.hp;
  const [ghost,setGhost]=useState({hp:run.hp,enemy:run.enemy.hp});
  useEffect(()=>{const t=setTimeout(()=>setGhost({hp:playerHp,enemy:enemyHp}),650);return()=>clearTimeout(t);},[playerHp,enemyHp,run.level]);
  const district = run.enemy.district;
  const player = fighterFor(run.character);
  const rival = presentationRival || rivalProfile(run.seed, run.level, run.enemy, run.character);
  const finale = Boolean(animation?.finale || animation?.tier === 5 || animation?.tier === 'T5');
  const letterbox = finale || Number(animation?.tier) >= 3 || ['T3', 'T4', 'T5'].includes(animation?.tier);
  const attacking =
    animation?.outcome === "loss"
      ? animation?.enemyWeapon
      : animation?.playerWeapon;
  const counterLabel = ({echo:'cuts',cinder:'strikes',nyx:'contacts',vex:'arrows',kuro:'cuts'})[animation?.character || (animation?.outcome === 'loss' ? rival.character : run.character)] || 'contacts';
  const momentCaption=animation?.kind==='item' ? ({medkit:'Healing',coolant:'Cooling',battery:'Recharging',scan:'Reading hand'})[animation.item]
    : animation?.kind==='defeat'?'Defeat':animation?.kind==='clash'?'Weapons clash':animation?.kind==='brace'?'Brace':null;
  return (
    <section
      className={`battle-stage ${busy && animation ? "is-attacking" : ""} ${busy && finale ? 'is-finale' : ''} ${preferences.reduceFlashes ? 'reduce-flashes' : ''}`}
      aria-label="Combat arena"
      style={{ '--player-color': player.color, '--rival-color': rival.color }}
    >
      <Suspense fallback={null}>
        <Arena
          character={run.character}
          enemyCharacter={rival.character}
          weapon={weapon}
          animation={animation}
          district={district}
          paused={paused || run.phase==='route' || run.phase==='room'}
          enemyLevel={run.level}
          quality={preferences.quality}
          reducedMotion={preferences.motion === "reduced"}
          reduceFlashes={preferences.reduceFlashes}
          playerHpRatio={playerHp / run.maxHp}
          enemyHpRatio={enemyHp / run.enemy.maxHp}
          frameFinish={finish}
          phase={run.phase}
          enemyAppearance={{...rival, kit: rival.wardrobe ?? rival.kit}}
          bossPhase={visualPhaseFor({...run.enemy, hp: enemyHp})}
          brokenPlates={busy && revealed && animation?.breaksPlate ? animation.brokenPlates : brokenPlates}
          heat={heat}
          signatureWarning={signatureWarning}
          scan={scan}
          lastHand={lastHand}
          entrance={entrance}
          reveal={pending?.stage==='reveal'?pending:null}
          onReady={() => {setReady(true);onReady?.();}}
          onLoading={() => {setReady(false);onLoading?.();}}
        />
      </Suspense>
      <div className="film-shade" />
      {busy && animation && sequenceById(animation.sequenceId) && <>
        <div ref={blackDip} className="sequence-black-dip" aria-hidden="true" />
        <div ref={softImpact} className="sequence-soft-impact" aria-hidden="true" />
        <div ref={counter} className="sequence-counter" hidden aria-hidden="true">
          <strong ref={counterValue}>0</strong><span>{counterLabel}</span>
        </div>
      </>}
      <div className={`fight-hud ${run.enemy.boss ? 'boss-hud' : ''}`}>
        <div className={`health-side ${playerHp / run.maxHp < .3 ? 'low-health' : ''}`}>
          <KitPortrait character={run.character} color={player.color} />
          <div className="fighter-name">
            <b>{player.name}</b>
            <span><WeaponMark style={player.style} size={15} />You</span>
          </div>
          <div className="life-bar">
            <i className="ghost-hp" style={{width:`${Math.max(playerHp,ghost.hp)/run.maxHp*100}%`}}/>
            <i style={{ width: `${(playerHp / run.maxHp) * 100}%` }} />
          </div>
          <small>
            {playerHp} / {run.maxHp}
          </small>
        </div>
        <div className="round-mark">
          <span>{run.enemy.boss ? "Boss" : run.enemy.elite ? "Elite" : "Floor"}</span>
          <b>{String(run.level).padStart(2, "0")}</b>
          <small>{(run.fightTurn??run.turn) + 1}</small>
        </div>
        <div className={`health-side rival ${enemyHp / run.enemy.maxHp < .3 ? 'low-health' : ''}`}>
          <KitPortrait character={rival.character} color={rival.color} bossId={rival.bossId} />
          <div className="fighter-name">
            <b title={`${rival.name} · ${rival.title}`}>{rival.name}</b>
            <span><RivalWeaponMark profile={rival} size={15} />{rival.weapon}</span>
          </div>
          <div className={`life-bar ${run.enemy.boss?'boss-life':run.enemy.elite?'elite-life':''}`}>
            <i className="ghost-hp" style={{width:`${Math.max(enemyHp,ghost.enemy)/run.enemy.maxHp*100}%`}}/>
            {run.enemy.boss&&<><span className="phase-marker" style={{left:'66%'}}/><span className="phase-marker" style={{left:'33%'}}/></>}
            {run.enemy.elite&&<span className="phase-marker" style={{left:'50%'}}/>}
            <i
              style={{ width: `${(enemyHp / run.enemy.maxHp) * 100}%` }}
            />
          </div>
          <small>
            {enemyHp} / {run.enemy.maxHp}
          </small>
        </div>
      </div>
      <div className="stage-location">
        <span>{district.zone}</span>
        <b>{district.name}</b>
        <small>
          {district.modifier}
          {district.reverse ? " · reversed cycle" : ""}
        </small>
      </div>
      {run.combo >= 2 && !busy && (
        <div className="streak" key={run.combo}>
          <b>{run.combo}</b>
          <span>hit streak</span>
        </div>
      )}
      {Object.keys(run.perks||{}).length>0&&<div className="perk-loadout" aria-label="Equipped perks">{Object.entries(run.perks).slice(0,6).map(([id,count])=><span key={id} title={PERKS.find(p=>p.id===id)?.detail}>{PERKS.find(p=>p.id===id)?.name}{count>1?` ×${count}`:''}</span>)}{Object.keys(run.perks).length>6&&<span>+{Object.keys(run.perks).length-6} perks</span>}</div>}
      {!ready && <div className="scene-loading">Opening the ring…</div>}
      {pending?.stage === "reveal" && (
        <div
          className={`hand-reveal rps-reveal ${pending.revealed ? "shown" : ""}`}
          aria-label={
            pending.revealed
              ? `${pending.playerWeapon} versus ${pending.enemyWeapon}`
              : "Hands unrevealed"
          }
        >
          <div>
            <WeaponIcon type={pending.playerWeapon} size={60} />
            <span>{weaponFor(pending.playerWeapon).type}</span>
          </div>
          <b>
            {pending.revealed
              ? pending.outcome === "draw"
                ? "="
                : pending.outcome === "win"
                  ? ">"
                  : "<"
              : "?"}
          </b>
          <div>
            {pending.revealed ? (
              <WeaponIcon type={pending.enemyWeapon} size={60} />
            ) : (
              <span className="unknown-hand">?</span>
            )}
            <span>
              {pending.revealed ? weaponFor(pending.enemyWeapon).type : "Ready"}
            </span>
          </div>
          <p>
            {pending.revealed
              ? pending.outcome === "win"
                ? "Your attack"
                : pending.outcome === "loss"
                  ? "Rival attacks"
                  : "Draw"
              : "Rock, paper, scissors"}
          </p>
        </div>
      )}
      {busy && animation && (
        <>
          <div
            className={`cinematic-overlay ${animation.finisher ? "is-finisher" : ""} ${animation.reduced ? "cinematic-reduced" : ""} ${letterbox ? 'cinematic-wide' : ''} ${finale ? 'afterlight-finale' : ''}`}
            style={{
              "--attack-color": animation.color,
              "--cinematic-duration": `${animation.duration}ms`,
              "--cinematic-play-state": paused ? 'paused' : 'running',
            }}
            data-reveal={
              revealed
                ? animation.finalHit
                  ? "confirmed"
                  : "denied"
                : "pending"
            }
          >
            <div className="cinematic-bar cinematic-bar-top" />
            <div className="cinematic-bar cinematic-bar-bottom" />
            {finale ? <div className="afterlight-titlecard" aria-label={`Afterlight Finale: ${animation.title}`}>
              <span>{player.name} · Afterlight Finale</span>
              <strong>{animation.title}</strong>
              <i aria-hidden="true" />
            </div> : <div className="cinematic-caption">
              <span>
                {momentCaption || (animation.outcome === "draw"
                  ? "Draw"
                  : animation.outcome === "loss"
                    ? "Rival attacks"
                    : animation.finisher
                      ? "Finish them"
                      : "Your attack")}
              </span>
              <strong>
                {animation.kind==='item'||animation.kind==='defeat'||animation.kind==='clash'||animation.kind==='brace'
                  ? animation.title : animation.outcome === "draw" ? "Draw" : animation.title}
              </strong>
              {animation.finisher && (
                <small>
                  {!revealed
                    ? "Wait for it…"
                    : animation.finalHit
                      ? "Knockout"
                      : animation.outcome === "loss"
                        ? "Knocked out"
                        : "Still standing"}
                </small>
              )}
            </div>}
            {!finale && hands &&
              attacking === "paper" && animation.style === "mage" &&
              animation.outcome !== "draw" && (
                <div className="cinematic-integral">
                  <IntegralGraph
                    damage={
                      revealed
                        ? animation.outcome === "loss"
                          ? animation.incoming
                          : animation.damage
                        : animation.potentialDamage
                    }
                    slices={24}
                    cinematic={!animation.reduced}
                    concealValue={!revealed}
                  />
                  <span>
                    ∫₀¹ f(t)dt{" "}
                    {revealed
                      ? `= ${animation.outcome === "loss" ? animation.incoming : animation.damage}`
                      : ""}
                  </span>
                </div>
              )}
          </div>
          {finale && <FinaleSkip animation={animation} paused={paused} seen={finaleSeen} onSkip={onSkipAnimation} />}
          {revealed && !finale && (
            <div
              className={`damage-feedback feedback-${animation.outcome}`}
              aria-live="polite"
            >
              {animation.damage > 0 && (
                <span className="damage-enemy">
                  {animation.damage}
                  <small>hit</small>
                </span>
              )}
              {animation.incoming > 0 && (
                <span className="damage-player">
                  {animation.incoming}
                  <small>damage</small>
                </span>
              )}
              {animation.healing > 0 && <span className="damage-enemy">+{animation.healing}<small>health</small></span>}
              {animation.outcome === "draw" && (
                <span className="draw-feedback">Again</span>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
