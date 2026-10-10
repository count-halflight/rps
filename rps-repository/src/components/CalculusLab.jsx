import React, { useState } from "react";
import { ChevronDown, Sigma } from "lucide-react";
import {
  pulseRate,
  pulseIntegral,
  riemannSum,
  resourceProjection,
  resourceRates,
} from "../game/calculus";

export function IntegralGraph({ damage = 23, slices = 24, cinematic = false }) {
  const points = Array.from(
    { length: 65 },
    (_, i) =>
      `${15 + (i / 64) * 270},${108 - (pulseRate(damage, i / 64) / Math.max(damage * 1.5, 1)) * 87}`,
  ).join(" ");
  return (
    <svg
      viewBox="0 0 300 135"
      className={`integral-graph ${cinematic ? "integral-cinematic" : ""}`}
      role="img"
      aria-label={`Area under an impact rate curve. Its exact integral is ${damage}.`}
    >
      <path d="M15 13V108H288" className="graph-axis" />
      {Array.from({ length: slices }, (_, i) => {
        const height =
          (pulseRate(damage, (i + 0.5) / slices) / Math.max(damage * 1.5, 1)) *
          87;
        return (
          <rect
            key={i}
            x={15 + (i * 270) / slices}
            y={108 - height}
            width={270 / slices - 0.7}
            height={height}
            style={{ "--slice-delay": `${i * 24}ms` }}
            className="integral-slice"
          />
        );
      })}
      <polyline points={points} fill="none" className="graph-curve" />
      <text x="16" y="128">
        0
      </text>
      <text x="278" y="128">
        1
      </text>
      <text x="111" y="128">
        Pulse time t
      </text>
      <text x="19" y="14">
        Impact rate f(t)
      </text>
    </svg>
  );
}

export default function CalculusLab({ run, stance }) {
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState("rates"),
    [slices, setSlices] = useState(8);
  const rates = resourceRates(run, stance),
    next = resourceProjection(run, stance),
    damage = run.result?.damage || 23;
  const signed = (value) => `${value > 0 ? "+" : ""}${value}`;
  const crossing =
    rates.heat > 0 && run.heat < 75 ? (75 - run.heat) / rates.heat : null;
  return (
    <div className={`calculus-lab ${open ? "lab-open" : ""}`}>
      <button
        className="lab-toggle"
        aria-expanded={open}
        aria-controls="calculus-panel"
        onClick={() => setOpen(!open)}
      >
        <Sigma size={16} />
        <span>
          Signal lab <small>Learn the mathematics of your frame</small>
        </span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div id="calculus-panel" className="lab-panel">
          <div className="lab-tabs" aria-label="Calculus concept">
            {[
              ["rates", "Derivatives"],
              ["area", "Integrals"],
              ["limit", "Limits"],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "rates" && (
            <div className="lab-lesson">
              <div>
                <h3>A derivative is a rate.</h3>
                <p>
                  With {stance}, heat changes by {signed(rates.heat)} per
                  exchange. The slope predicts where your frame goes next.
                  Cooling and augments change that slope.
                </p>
                <code>H(t) = H₀ + rt · H′(t) = {rates.heat}</code>
                <small>
                  Between the 0 and 100 caps. One exchange is one unit of t.
                </small>
              </div>
              <svg
                viewBox="0 0 260 135"
                className="rate-graph"
                role="img"
                aria-label={`Heat goes from ${run.heat} to ${next.heat} over the next exchange.`}
              >
                <path d="M22 12V111H245" className="graph-axis" />
                <path d="M22 40H245" className="graph-limit" />
                <text x="27" y="34">
                  75 · overdrive limit
                </text>
                <polyline
                  points={Array.from(
                    { length: 25 },
                    (_, i) =>
                      `${22 + (i / 24) * 220},${111 - resourceProjection(run, stance, i / 24).heat * 0.94}`,
                  ).join(" ")}
                  className="graph-heat"
                  fill="none"
                />
                <circle cx="22" cy={111 - run.heat * 0.94} r="4" />
                <circle cx="242" cy={111 - next.heat * 0.94} r="4" />
                <text x="20" y="130">
                  Now: {run.heat}
                </text>
                <text x="177" y="130">
                  Next: {next.heat}
                </text>
              </svg>
            </div>
          )}
          {tab === "area" && (
            <div className="lab-lesson">
              <div>
                <h3>An integral collects change.</h3>
                <p>
                  Veil makes this visible. Thin slices of an impact-rate curve
                  build the pulse’s total effect. More slices give a closer
                  approximation.
                </p>
                <code>∫₀¹ 6D·t(1−t) dt = D</code>
                <small>
                  {run.result ? "Last attack" : "Example pulse"}: D = {damage}.
                  Exact area {pulseIntegral(damage)}. Slice estimate{" "}
                  {riemannSum(damage, slices).toFixed(2)}.
                </small>
                <div className="slice-controls">
                  {[8, 24, 64].map((n) => (
                    <button
                      key={n}
                      aria-pressed={slices === n}
                      onClick={() => setSlices(n)}
                    >
                      {n} slices
                    </button>
                  ))}
                </div>
              </div>
              <IntegralGraph damage={damage} slices={slices} />
            </div>
          )}
          {tab === "limit" && (
            <div className="lab-lesson lab-limit">
              <div>
                <h3>Approach the boundary.</h3>
                <p>
                  Limits describe what a function approaches. As t approaches{" "}
                  {crossing !== null ? crossing.toFixed(2) : "a boundary"}, heat
                  can approach 75. At 75, the frame’s rules change: overdrive
                  locks and damage drops.
                </p>
                <code>
                  {crossing !== null
                    ? `lim H(t) = 75 as t → ${crossing.toFixed(2)}`
                    : "H(t) is capped between 0 and 100"}
                </code>
                <small>
                  {next.heat >= 75
                    ? "This exchange ends overheated. Guard or coolant can improve the next turn."
                    : rates.heat <= 0
                      ? "This protocol holds or lowers heat. You are moving away from the ceiling."
                      : `This exchange ends at ${next.heat} heat, below the ceiling.`}
                </small>
              </div>
              <div className="lab-projection">
                <span>After this exchange</span>
                <b>
                  {next.heat}
                  <small> heat</small>
                </b>
                <strong>
                  {next.charge}
                  <small> charge</small>
                </strong>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
