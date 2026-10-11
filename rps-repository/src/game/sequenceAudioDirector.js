import { ECHO_REFLECTION_TIMES } from './sequences/index.js';
import { sceneMomentById, sceneMomentPresentation } from './sceneMoments.js';
import { combatMomentById, combatMomentPresentation } from './combatMoments.js';
import { FIGHTERS } from './fighters.js';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Native preview capture exposed an overly quiet synthesis mix. Voice levels
// stay conservative; each cancellable bus now lifts them before the limiter.
export const CINEMATIC_MIX = Object.freeze({ attackGain: 2.6, finaleGain: 3.2, momentGain: 2.4 });

// Original finale tonal centers. The major seventh is reserved for the
// epilogue so the release feels different from the preceding minor score.
export const FINALE_AUDIO_PALETTES = Object.freeze({
  echo: Object.freeze({ root: 220, color: 'glass', chord: [0, 4, 7, 11], pan: -.4 }),
  cinder: Object.freeze({ root: 110, color: 'ember', chord: [0, 4, 7, 11], pan: .25 }),
  nyx: Object.freeze({ root: 196, color: 'prism', chord: [0, 4, 7, 11], pan: 0 }),
  vex: Object.freeze({ root: 247, color: 'bow', chord: [0, 4, 7, 11], pan: .4 }),
  kuro: Object.freeze({ root: 146.832, color: 'storm', chord: [0, 4, 7, 11], pan: -.25 }),
});

export function cinematicTier(animation = {}) {
  return animation.tier || (animation.finale ? 5 : animation.finisher ? 4 : animation.variant === 2 ? 3 : animation.variant === 1 ? 2 : 1);
}

export function reflectionCueTimes(event) {
  if (Array.isArray(event.times)) return event.times.filter(Number.isFinite);
  const start = Number.isFinite(event.at) ? event.at : 5.5;
  const span = Math.min(3.12, Math.max(.12, (event.end ?? 8.85) - start - .12));
  // The renderer and audio share actual contacts rather than two approximated
  // loops. Explicit data supplied times[] still takes priority.
  if (start === 5.5 && span === 3.12) return [...ECHO_REFLECTION_TIMES];
  return ECHO_REFLECTION_TIMES.map(time => start + (time - 5.5) * span / 3.12);
}

/** Ancillary entrances and boss changes retain their own authored cue sheet. */
export function sceneMomentAudioPresentation(momentId, options = {}) {
  if (combatMomentById(momentId)) return combatMomentAudioPresentation(momentId, options);
  const definition = sceneMomentById(momentId);
  if (!definition) throw new Error(`Unknown scene moment: ${momentId}`);
  return {
    ...sceneMomentPresentation(momentId, options),
    momentId,
    sequenceId: momentId,
    bodyDuration: definition.duration,
    style: FIGHTERS.find(fighter => fighter.id === definition.character)?.style || 'glaive',
    tier: 1,
    finisher: false,
    finale: false,
    sfx: definition.beats.flatMap(beat => beat.sfx || []),
  };
}

export function combatMomentAudioPresentation(momentId, options = {}) {
  const definition = combatMomentById(momentId);
  if (!definition) throw new Error(`Unknown combat moment: ${momentId}`);
  const presentation = combatMomentPresentation(momentId, options);
  const enemy = options.actorSide === 'enemy' || options.defeatedSide === 'enemy';
  // Existing presentations can carry character:'echo' from an earlier default.
  // Explicit physical actor IDs take precedence over that stale convenience key.
  const character = enemy ? options.enemyCharacter || 'cinder' : options.playerCharacter || options.character || 'echo';
  return {
    ...presentation,
    momentId,
    sequenceId: momentId,
    character,
    bodyDuration: definition.duration,
    style: FIGHTERS.find(fighter => fighter.id === character)?.style || 'blades',
    tier: 1,
    finisher: false,
    finale: false,
  };
}

export function sequenceAudioPlan(animation = {}) {
  if (animation.momentId) animation = sceneMomentAudioPresentation(animation.momentId, animation);
  const duration = Math.max(.05, (Number.isFinite(animation.duration) ? animation.duration : 1500) / 1000);
  const body = Math.max(.05, (Number.isFinite(animation.bodyDuration) ? animation.bodyDuration : animation.duration || 1500) / 1000);
  const scale = duration / body, tier = cinematicTier(animation);
  const impact = duration * clamp(animation.impactAt ?? .64, 0, 1);
  const cues = (animation.sfx || []).filter(event => typeof event.id === 'string' && Number.isFinite(event.at) && event.at >= 0 && event.at <= body)
    .map((event, index) => ({
      ...event, index, at: event.at * scale,
      end: Number.isFinite(event.end) ? clamp(event.end * scale, event.at * scale, duration) : undefined,
      authoredAt: event.at, scale,
      times: event.id === 'afterlight-reflections' ? reflectionCueTimes(event).map(time => time * scale) : event.times?.map(time => time * scale),
    }));
  const silence = cues.find(cue => cue.id === 'silence');
  return {
    duration, bodyDuration: body, scale, tier, impact, cues,
    gain: animation.momentId ? CINEMATIC_MIX.momentGain : tier === 5 ? CINEMATIC_MIX.finaleGain : CINEMATIC_MIX.attackGain,
    authored: Array.isArray(animation.sfx) && animation.sfx.length > 0,
    duck: animation.kind === 'defeat' ? .32 : tier === 5 ? .0001 : tier >= 3 ? Math.pow(10, -7.5 / 20) : 1,
    silence: tier === 4 ? {
      at: silence?.at ?? Math.max(0, impact - .5),
      end: silence?.end ?? impact,
    } : null,
    palette: FINALE_AUDIO_PALETTES[animation.character] || FINALE_AUDIO_PALETTES.echo,
  };
}
