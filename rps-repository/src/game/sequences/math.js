export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const mix = (a, b, t) => a + (b - a) * t;
export const vector = (a, b, t) => a.map((n, i) => mix(n, b[i] ?? n, t));
export const smooth = (a, b, value) => { const t = clamp((value - a) / Math.max(1e-8, b - a)); return t * t * (3 - 2 * t); };
export function easing(t, kind = 'smooth') {
  t = clamp(t);
  if (kind === 'hold') return 0;
  if (kind === 'inCubic') return t ** 3;
  if (kind === 'outCubic') return 1 - (1 - t) ** 3;
  if (kind === 'inQuint') return t ** 5;
  if (kind === 'outQuint') return 1 - (1 - t) ** 5;
  if (kind === 'sine') return (1 - Math.cos(Math.PI * t)) * .5;
  return t * t * (3 - 2 * t);
}
export function quaternion(x = 0, y = 0, z = 0) {
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  return [s1*c2*c3+c1*s2*s3,c1*s2*c3-s1*c2*s3,c1*c2*s3+s1*s2*c3,c1*c2*c3-s1*s2*s3];
}
export function slerp(a, b, t) {
  let dot = a.reduce((s, n, i) => s + n * b[i], 0), q = b;
  if (dot < 0) { dot = -dot; q = b.map(n => -n); }
  let result;
  if (dot > .9995) result = vector(a, q, t);
  else {
    const angle = Math.acos(clamp(dot, -1, 1)), denominator = Math.sin(angle);
    const l = Math.sin((1-t)*angle)/denominator, r = Math.sin(t*angle)/denominator;
    result = a.map((n, i) => n*l + q[i]*r);
  }
  const length = Math.hypot(...result) || 1;
  return result.map(n => n/length);
}
export function blendValue(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return mix(a,b,t);
  if (Array.isArray(a) && Array.isArray(b)) return vector(a,b,t);
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const result = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) result[key] = blendValue(a[key] ?? b[key], b[key] ?? a[key], t);
    return result;
  }
  return t < .5 ? (a ?? b) : (b ?? a);
}
export function segment(points, time) {
  if (time <= points[0].t) return {a:points[0],b:points[0],alpha:0};
  if (time >= points.at(-1).t) return {a:points.at(-1),b:points.at(-1),alpha:0};
  let index = 0;
  while (index < points.length-2 && time >= points[index+1].t) index++;
  const a = points[index], b = points[index+1];
  return {a,b,alpha:easing((time-a.t)/(b.t-a.t), b.ease || b.root?.ease || 'smooth')};
}
