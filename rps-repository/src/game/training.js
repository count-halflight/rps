import { newRun, levelFor } from "./engine.js";

export const TRAINING_LESSONS = [
  {
    title: "Break the blades.",
    text: "The trainer broadcasts Razor with certainty. Choose Seismic, then Engage. Rock counters scissors.",
    weapon: "rock",
    signal: 2,
  },
  {
    title: "Turn force into silence.",
    text: "The signal is Seismic now. Choose Veil, then Engage. Paper counters rock.",
    weapon: "paper",
    signal: 0,
  },
  {
    title: "Spend the charge.",
    text: "Choose Razor to counter Veil. Open Tactics on a phone, select Overdrive, then Engage. It doubles damage for 40 charge.",
    weapon: "scissors",
    signal: 1,
    stance: "overdrive",
  },
  {
    title: "Meet Cinder, your first apex.",
    text: "Read each confirmed signal and choose its counter. Cinder adds heat every exchange. Guard builds charge and stays cooler. Defeat it to finish training.",
  },
  {
    title: "Your instincts are online.",
    text: "You read the cycle, released overdrive, and defeated an apex. Real circuits introduce uncertain forecasts, shifting districts, and salvage. Your main run is ready.",
  },
];

function drill(run, step) {
  return {
    ...run,
    phase: "ready",
    hp: 100,
    maxHp: 100,
    heat: 0,
    charge: step === 2 ? 80 : Math.max(20, run.charge),
    scanUsed: false,
    scanned: null,
    result: null,
    history: [],
    enemy: {
      ...levelFor(0, 1),
      name: "Signal trainer",
      maxHp: 200,
      hp: 200,
      signal: TRAINING_LESSONS[step].signal,
      confidence: 100,
      damage: 6,
    },
  };
}
function tutorialBoss(run) {
  return {
    ...run,
    level: 5,
    phase: "ready",
    hp: 100,
    maxHp: 100,
    charge: 60,
    heat: 0,
    scanUsed: false,
    scanned: null,
    result: null,
    history: [],
    enemy: {
      ...levelFor(0, 5),
      name: "Cinder",
      maxHp: 90,
      hp: 90,
      signal: 2,
      confidence: 100,
      damage: 12,
      pattern: "methodical",
    },
  };
}
export function startTraining() {
  return { step: 0, feedback: "", run: drill(newRun(0), 0) };
}
export function progressTraining(training, next) {
  const { step } = training;
  if (step < 3) {
    const lesson = TRAINING_LESSONS[step];
    const passed =
      next.result?.outcome === "win" &&
      next.result.playerWeapon === lesson.weapon &&
      (!lesson.stance || next.result.stance === lesson.stance);
    if (!passed)
      return {
        step,
        feedback:
          step === 2
            ? "Arm Overdrive before committing the Razor strike. Your charge is replenished."
            : "Follow the confirmed signal. The trainer has reset for another try.",
        run: drill(next, step),
      };
    return {
      step: step + 1,
      feedback: "",
      run: step === 2 ? tutorialBoss(next) : drill(next, step + 1),
    };
  }
  if (next.phase === "upgrade")
    return {
      step: 4,
      feedback: "",
      run: { ...next, phase: "training-complete" },
    };
  if (next.phase === "defeat")
    return {
      step: 3,
      feedback:
        "Cinder found an opening. The training frame is restored. Counter the confirmed signal and try again.",
      run: tutorialBoss(next),
    };
  return {
    step: 3,
    feedback: "",
    run: { ...next, enemy: { ...next.enemy, confidence: 100 } },
  };
}

export function trainingDossier(step) {
  return step < 3
    ? {
        name: "Signal trainer",
        title: "Academy relay",
        taunt: "No static here. Learn the shape of a counter.",
        story:
          "An old academy frame with its combat governor engaged. Its signals are exact, its damage is limited, and every drill can be repeated.",
      }
    : {
        name: "Cinder",
        title: "The academy’s last lesson",
        taunt: "Three instincts. Let’s see which one survives the heat.",
        story:
          "A retired foundry sentinel rebuilt to train new pilots. Its thermal core adds heat to every exchange. Confirmed forecasts let you practice reading the cycle before the city starts lying.",
      };
}
