import {defineSequence} from '../define.js';
export default defineSequence({
  id:'ECHO-S0',character:'echo',weapon:'scissors',variant:0,title:'Quick draw',tier:1,duration:1500,
  hitTimes:[.65],mainHit:.65,reaction:'STAGGER',vfx:'draw-line',timeRamps:[],
  reviewTimes:[0,.17,.38,.416,.432,.49,.58,.65,.72,.92,1.12,1.5],
  qteCues:[{id:'draw',key:'3',at:.10,end:.35,label:'Draw on the beat'}],
  beats:[
    {t:0,pose:'SHEATH_GUARD',root:{pos:[0,0,0]},camera:{shot:'ESTABLISH',pos:[0,2.9,9.8],look:[0,1.45,0],fov:38}},
    {t:.17,pose:'EYES_LOCK',root:{pos:[-.04,0,-.03]},camera:{shot:'DOLLY',pos:[-.36,2.5,9.3],look:[-.12,1.48,0],fov:38},sfx:[{id:'breath',at:.17}]},
    {t:.38,pose:'DRAW_COIL',root:{pos:[-.16,-.22,-.10],ease:'inCubic'},camera:{shot:'SNAP-ZOOM',pos:[-.68,1.61,7.15],look:[-.35,1.30,-.03],fov:31}},
    // 16 ms actual draw: the cut itself is deliberately invisible until .65.
    {t:.416,pose:'DRAW_COIL',root:{pos:[1.74,-.20,-.16],ease:'inQuint'},camera:{shot:'SNAP-ZOOM',pos:[-.30,1.62,6.95],look:[.66,1.31,0],fov:31},sfx:[{id:'draw',at:.416}]},
    {t:.432,pose:'DRAW_FLASH',root:{pos:[3.93,.03,-.16],ease:'outQuint'},camera:{shot:'SNAP-ZOOM',pos:[.34,1.95,7.0],look:[1.02,1.42,0],fov:33},fx:[{id:'TRAIL_RIBBON',at:.416,end:.47,opacity:.34,anchor:'weapon'}]},
    {t:.49,pose:'RESHEATH',root:{pos:[4.20,0,-.18]},camera:{shot:'TWO-SHOT',pos:[.76,2.04,7.1],look:[1.3,1.47,0],fov:35}},
    {t:.58,pose:'SHEATH_CLICK',root:{pos:[4.24,0,-.18]},camera:{shot:'TWO-SHOT',pos:[.91,2.05,7.18],look:[1.55,1.46,0],fov:35},sfx:[{id:'sheath-click',at:.58}]},
    {t:.65,pose:'SHEATH_CLICK',root:{pos:[4.24,0,-.18]},camera:{shot:'TWO-SHOT',pos:[.95,2.08,7.35],look:[1.6,1.47,0],fov:35},
      defender:{reaction:'STAGGER'},fx:[{id:'SLASH_LINE',at:.65,end:.98,opacity:.48,anchor:'target',axis:'horizontal',delayed:true},{id:'SPARKS',at:.65,end:.84,opacity:.50,anchor:'target',count:12},{id:'SHOCKRING',at:.65,end:.91,opacity:.30,anchor:'target',size:.8}],sfx:[{id:'light-cut',at:.65}]},
    {t:.85,pose:'SHEATH_GUARD',root:{pos:[3.90,0,-.77]},camera:{shot:'DOLLY',pos:[.72,2.37,8.4],look:[1.18,1.35,-.1],fov:37}},
    {t:1.12,pose:'SHEATH_GUARD',root:{pos:[2.01,0,-1.08]},camera:{shot:'DOLLY',pos:[.32,2.66,9.3],look:[.32,1.4,-.12],fov:38}},
    {t:1.5,pose:'SHEATH_GUARD',root:{pos:[0,0,0],ease:'outCubic'},camera:{shot:'ESTABLISH',pos:[0,2.9,9.8],look:[0,1.45,0],fov:38}},
  ],
});
