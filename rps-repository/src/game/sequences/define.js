export const TIERS=Object.freeze({
  1:{min:1300,max:1700,hitStop:70,shake:.25,reducedMax:1700},
  2:{min:1700,max:2200,hitStop:90,shake:.18,reducedMax:1700},
  3:{min:3500,max:4500,hitStop:150,shake:.55,reducedMax:1700},
  4:{min:6000,max:7500,hitStop:220,shake:.80,reducedMax:3000},
  5:{min:14000,max:16000,hitStop:300,shake:1,reducedMax:5000},
});
export function defineSequence(data) {
  const tier=TIERS[data.tier];
  if(!tier||data.duration<tier.min||data.duration>tier.max)throw new Error(`Invalid tier duration for ${data.id}`);
  if(data.beats.length<4||data.beats[0].t!==0||data.beats.at(-1).t!==data.duration/1000)throw new Error(`Incomplete authored timeline for ${data.id}`);
  for(let i=1;i<data.beats.length;i++)if(data.beats[i].t<=data.beats[i-1].t)throw new Error(`Unordered beats for ${data.id}`);
  return Object.freeze({...data,hitStop:tier.hitStop,shake:tier.shake,origin:1.6,
    beats:data.beats.map(beat=>({
      weaponPath:{type:'blade',width:.025},fx:[],sfx:[],timeScale:1,shake:0,flash:0,bars:data.tier>=3?1:0,lights:{drain:0,blackout:0,relight:0},
      ...beat,root:{pos:[0,0,0],yaw:0,ease:'smooth',...beat.root},
    })),
  });
}
