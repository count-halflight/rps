import React, { useEffect, useRef } from "react";
import {
  Cpu,
  Zap,
  Shield,
  Heart,
  Snowflake,
  BatteryCharging,
  X,
} from "lucide-react";
export const pad = (number) => String(number).padStart(3, "0");
export const IconFor = ({ id, size = 21 }) => {
  const Icon =
    {
      power: Zap,
      armor: Shield,
      heart: Heart,
      coolant: Snowflake,
      battery: BatteryCharging,
    }[id] || Cpu;
  return <Icon size={size} />;
};
export function Meter({ value, max, label, enemy = false }) {
  return (
    <div className={`integrity ${enemy ? "enemy-integrity" : ""}`}>
      <div className="meter-caption">
        <span>{label}</span>
        <span>
          <b>{value}</b>
          <i> / {max}</i>
        </span>
      </div>
      <div className="meter-track">
        <div style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}
export function Modal({ title, eyebrow, children, onClose, className = "" }) {
  const panel = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const node = panel.current;
    const background = [...document.querySelectorAll(".site-header, main")];
    const inertStates = background.map((element) => element.inert);
    background.forEach((element) => {
      element.inert = true;
    });
    const originalOverflow = document.body.style.overflow;
    const originalPadding = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    const first = panel.current?.querySelector("button");
    first?.focus();
    const trap = (e) => {
      if (e.key !== "Tab") return;
      const elements = [
        ...panel.current.querySelectorAll(
          'button:not(:disabled),a[href],input,[tabindex="0"]',
        ),
      ];
      if (!elements.length) return;
      const index = elements.indexOf(document.activeElement);
      if (e.shiftKey && index <= 0) {
        e.preventDefault();
        elements.at(-1).focus();
      }
      if (!e.shiftKey && index === elements.length - 1) {
        e.preventDefault();
        elements[0].focus();
      }
    };
    node?.addEventListener("keydown", trap);
    return () => {
      node?.removeEventListener("keydown", trap);
      background.forEach((element, index) => {
        element.inert = inertStates[index];
      });
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPadding;
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-shade">
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${className}`}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
          {onClose && (
            <button
              className="icon-button"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <X size={22} />
            </button>
          )}
        </div>
        {children}
      </section>
    </div>
  );
}
