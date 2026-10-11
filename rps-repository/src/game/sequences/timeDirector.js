import {clamp} from './math.js';
// Authored beats/contact times use unscaled seconds. Physical motion is sampled
// from this clock, with each contact as a pin: a slow ramp cannot move a damage
// deadline. Integration is piecewise analytic, so scrubbing never depends on dt.
function weight(sequence,start,end,stoppedUntil) {
  const ranges=sequence.timeRamps||[],cuts=new Set([start,end,Math.max(start,Math.min(end,stoppedUntil))]);
  for(const r of ranges)for(const t of [r.at,r.end])if(t>start&&t<end)cuts.add(t);
  const ordered=[...cuts].sort((a,b)=>a-b);
  let total=0;
  for(let i=0;i<ordered.length-1;i++){
    const a=ordered[i],b=ordered[i+1],middle=(a+b)*.5;
    const rate=middle<stoppedUntil?0:(ranges.find(r=>middle>=r.at&&middle<r.end)?.scale??1);
    total+=(b-a)*rate;
  }
  return total;
}
export function physicalClock(sequence,seconds,options={}) {
  const end=sequence.duration/1000,time=clamp(seconds,0,end);
  const pins=[...new Set([0,...sequence.hitTimes.filter(t=>t>=0&&t<end),...(sequence.clockPins||[]),end])].sort((a,b)=>a-b);
  let index=0;while(index<pins.length-2&&time>=pins[index+1])index++;
  const start=pins[index],finish=pins[index+1];
  const contact=sequence.hitTimes.some(t=>Math.abs(t-start)<1e-8);
  const stopSeconds=contact?(options.reduced?Math.min(sequence.hitStop/1000,.08):sequence.hitStop/1000):0;
  // A short presentation retains a real hold instead of shrinking it to one
  // frame; its corresponding position in the original timeline is stretched.
  const stoppedUntil=Math.min(finish,start+stopSeconds/(options.durationScale||1));
  const total=weight(sequence,start,finish,stoppedUntil);
  const elapsed=weight(sequence,start,time,stoppedUntil);
  const physical=start+(finish-start)*(total>0?elapsed/total:0);
  const rate=time<stoppedUntil?0:(sequence.timeRamps?.find(r=>time>=r.at&&time<r.end)?.scale??1);
  return {physicalSeconds:physical,unscaledSeconds:time,timeScale:rate,hitStopped:contact&&time<stoppedUntil&&time>=start,stopUntil:stoppedUntil};
}
