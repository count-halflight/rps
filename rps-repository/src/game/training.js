import { newRun, levelFor } from "./engine.js";

export const TRAINING_LESSONS = [
  {
    title: "Win a hand.",
    text: "The trainer will play scissors. Tap Rock, then choose the first attack.",
    weapon: "rock",
    signal: 2,
  },
  {
    title: "Try paper.",
    text: "The trainer will play rock. Tap Paper, then choose an attack. Items also use your winning turn.",
    weapon: "paper",
    signal: 0,
  },
  {
    title: "Try a heavy attack.",
    text: "The trainer will play paper. Tap Scissors, then choose the third attack. It costs 40 charge and deals double damage.",
    weapon: "scissors",
    signal: 1,
    stance: "overdrive",
  },
  {
    title: "Beat the trainer.",
    text: "Cinder always shows his next hand. Win an opening, then choose an attack. Heavy attacks add heat. Use a coolant item to cool down.",
  },
  {
    title: "Training complete",
    text: "You’re ready. In a real fight, the rival’s tell can be wrong. You can leave training at any time.",
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
      next.result.damage > 0 &&
      next.result.playerWeapon === lesson.weapon &&
      (!lesson.stance || next.result.stance === lesson.stance);
    if (!passed)
      return {
        step,
        feedback:
          step === 2
            ? "Choose the third attack after winning. Your charge has been restored."
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
        "Cinder found an opening. Your health is restored. Counter the confirmed signal and try again.",
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
        taunt: "I’ll show you my next hand.",
        story:
          "An academy instructor who calls each hand before attacking. The forecasts are exact and every drill can be repeated.",
      }
    : {
        name: "Cinder",
        title: "The academy’s last lesson",
        taunt: "One last fight. Ready?",
        story:
          "A retired foundry champion who trains newcomers. Heated reflex implants add heat to every exchange. Confirmed forecasts let you practice reading the cycle before the city starts lying.",
      };
}
