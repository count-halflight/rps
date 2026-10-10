import React, { Suspense, lazy } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { FIGHTERS, fighterFor } from "../game/fighters";
import { DISTRICTS } from "../game/engine";
const Arena = lazy(() => import("./Arena"));
export default function CharacterSelect({
  selected,
  setSelected,
  preferences,
  onStart,
  onBack,
}) {
  const f = fighterFor(selected);
  return (
    <section
      className="character-select"
      aria-label="Choose a fighter"
      style={{ "--fighter-color": f.color }}
    >
      <header>
        <button onClick={onBack}>
          <ArrowLeft size={19} /> Back
        </button>
        <h1>Choose your fighter</h1>
        <span>New run</span>
      </header>
      <div className="selection-preview">
        <Suspense
          fallback={<div className="scene-loading">Loading fighters…</div>}
        >
          <Arena
            character={selected}
            previewSingle
            weapon="rock"
            district={DISTRICTS[0]}
            paused={false}
            enemyLevel={1}
            quality={preferences.quality}
            reducedMotion={preferences.motion === "reduced"}
          />
        </Suspense>
      </div>
      <div className="fighter-details">
        <span className="selection-number">
          0{FIGHTERS.findIndex((c) => c.id === selected) + 1}
        </span>
        <h2>{f.name}</h2>
        <h3>{f.weapon}</h3>
        <p>{f.description}</p>
        <dl>
          <div>
            <dt>Health</dt>
            <dd>{f.hp}</dd>
          </div>
          <div>
            <dt>Starting charge</dt>
            <dd>{f.charge}</dd>
          </div>
        </dl>
        <div className="selection-moves">
          {Object.entries(f.moves).map(([hand, moves]) => (
            <div key={hand}>
              <span>{hand}</span>
              <b>{moves[0]}</b>
            </div>
          ))}
        </div>
        <button className="fighter-confirm primary-button" onClick={onStart}>
          Play as {f.name}
          <ArrowRight size={21} />
        </button>
      </div>
      <div className="fighter-roster">
        {FIGHTERS.map((c, i) => (
          <button
            key={c.id}
            className={`fighter-choice ${selected === c.id ? "chosen" : ""}`}
            style={{ "--fighter-color": c.color }}
            aria-pressed={selected === c.id}
            onClick={() => setSelected(c.id)}
          >
            <small>0{i + 1}</small>
            <b>{c.name}</b>
            <span>{c.weapon}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
