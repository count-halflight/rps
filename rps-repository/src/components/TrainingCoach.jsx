import React from "react";
import { ArrowRight, GraduationCap, X } from "lucide-react";
import { TRAINING_LESSONS } from "../game/training";
export default function TrainingCoach({ training, busy, onExit }) {
  const lesson = TRAINING_LESSONS[training.step];
  return (
    <section
      className="training-coach"
      aria-label="Optional combat training"
      aria-live="polite"
    >
      <div className="training-heading">
        <GraduationCap size={22} />
        <span>
          {training.step === 4
            ? "Training complete"
            : training.step === 3
              ? "Tutorial boss"
              : `Training / lesson ${training.step + 1} of 3`}
        </span>
        <div className="training-progress" aria-hidden="true">
          {[0, 1, 2, 3].map((step) => (
            <i key={step} className={step <= training.step ? "complete" : ""} />
          ))}
        </div>
      </div>
      <h1>{lesson.title}</h1>
      <p>{training.feedback || lesson.text}</p>
      <button
        className={
          training.step === 4 ? "primary-button" : "text-button training-exit"
        }
        onClick={onExit}
        disabled={busy}
      >
        {training.step === 4 ? (
          <>
            Return to the circuit <ArrowRight size={17} />
          </>
        ) : (
          <>
            Leave training <X size={14} />
          </>
        )}
      </button>
    </section>
  );
}
