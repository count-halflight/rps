import React, { Suspense, lazy, useState, useEffect, useLayoutEffect } from "react";
import { weaponFor } from "../game/engine";
import { PERKS } from "../game/perks.js";
import { fighterFor, rivalFighter } from "../game/fighters";
import WeaponIcon from "./WeaponIcon";
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
}) {
  const [ready, setReady] = useState(false),
    [revealed, setRevealed] = useState(false),
    [hands, setHands] = useState(false);
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
  const attacking =
    animation?.outcome === "loss"
      ? animation?.enemyWeapon
      : animation?.playerWeapon;
  return (
    <section
      className={`battle-stage ${busy && animation ? "is-attacking" : ""}`}
      aria-label="Combat arena"
    >
      <Suspense fallback={null}>
        <Arena
          character={run.character}
          enemyCharacter={
            run.enemy.rival.character
          }
          weapon={weapon}
          animation={animation}
          district={district}
          paused={paused || run.phase==='route' || run.phase==='room'}
          enemyLevel={run.level}
          quality={preferences.quality}
          reducedMotion={preferences.motion === "reduced"}
          frameFinish={finish}
          phase={run.phase}
          enemyAppearance={run.enemy.rival}
          bossPhase={run.enemy.boss?run.enemy.hp<=run.enemy.maxHp*.30?2:run.enemy.hp<=run.enemy.maxHp*.65?1:0:0}
          entrance={entrance}
          reveal={pending?.stage==='reveal'?pending:null}
          onReady={() => {setReady(true);onReady?.();}}
        />
      </Suspense>
      <div className="film-shade" />
      <div className="fight-hud">
        <div className="health-side">
          <div className="fighter-name">
            <b>{fighterFor(run.character).name}</b>
            <span>You</span>
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
        <div className="health-side rival">
          <div className="fighter-name">
            <b title={dossier.name}>{dossier.name.split(" ")[0]}</b>
            <span>
              {run.enemy.rival.weapon || fighterFor(run.enemy.rival.character).weapon}
            </span>
          </div>
          <div className={`life-bar ${run.enemy.boss?'boss-life':run.enemy.elite?'elite-life':''}`}>
            <i className="ghost-hp" style={{width:`${Math.max(enemyHp,ghost.enemy)/run.enemy.maxHp*100}%`}}/>
            {run.enemy.boss&&<><span className="phase-marker" style={{left:'65%'}}/><span className="phase-marker" style={{left:'30%'}}/></>}
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
        <div className="streak">
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
            className={`cinematic-overlay ${animation.finisher ? "is-finisher" : ""} ${animation.reduced ? "cinematic-reduced" : ""}`}
            style={{
              "--attack-color": animation.color,
              "--cinematic-duration": `${animation.duration}ms`,
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
            <div className="cinematic-caption">
              <span>
                {animation.outcome === "draw"
                  ? "Draw"
                  : animation.outcome === "loss"
                    ? "Rival attacks"
                    : animation.finisher
                      ? "Finish them"
                      : "Your attack"}
              </span>
              <strong>
                {animation.outcome === "draw" ? "Draw" : animation.title}
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
            </div>
            {hands &&
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
          {revealed && (
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
