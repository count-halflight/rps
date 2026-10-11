import {defineSequence} from '../define.js';
import {ECHO_REFLECTION_TIMES} from '../sample.js';
const reflectionContact=index=>ECHO_REFLECTION_TIMES[index]+.12*.43;
export default defineSequence({
  id:'ECHO-AF',character:'echo',weapon:'scissors',variant:2,title:'Last reflection',tier:5,duration:15000,
  hitTimes:[0,9],mainHit:9,reaction:'FREEZE',vfx:'mirror-afterlight',
  // Time stops on a wounded, grounded rival. The root lowering is a fraction
  // of the real target height; limb targets remain in the rig's authored space.
  defenderHold:{lowerByHeight:.14,pose:{
    torsoPitch:.62,torsoYaw:.12,headPitch:.18,headYaw:-.08,
    handL:[.32,1.18,.47],handR:[-.34,1.16,.45],
    footL:[.19,.11,.35],footR:[-.19,.11,-.28],footLock:[1,1],floorY:0,
    expression:'hurt',face:{hurt:.55,grit:.28,browDown:.2,blink:0},
  }},
  timeRamps:[{at:2.5,end:5.5,scale:.3},{at:5.5,end:5.84,scale:.1},{at:5.84,end:8.45,scale:3},{at:8.45,end:9,scale:.1}],
  dissolve:{style:'shatter',at:9.65,end:12.4,count:256},qteCues:[],acts:[0,2.5,5.5,9,12.5,15],
  clockPins:[2.5,5.5,8.62,8.78],reviewTimes:[0,.35,1.4,2.5,5.5,reflectionContact(2),reflectionContact(14),8.62,8.78,9,11.2,13.6],
  // Match cuts follow two opposing airborne strikes. The wider master still
  // establishes the dome and returns before the authored final reflection.
  cameraCuts:[
    {at:ECHO_REFLECTION_TIMES[2],end:ECHO_REFLECTION_TIMES[2]+.30,reflectionIndex:2,
      shot:'REFLECTION-RISE-POV',offset:[1.10,1.482,4.90],lookOffset:[-1.30,.382,.10],
      travel:[-.12,-.04,-.18],fov:40,safeWidth:1.36},
    {at:ECHO_REFLECTION_TIMES[14],end:ECHO_REFLECTION_TIMES[14]+.30,reflectionIndex:14,
      shot:'REFLECTION-CROSS-POV',offset:[-2.80,1.682,4.65],lookOffset:[-1.45,.582,-.10],
      travel:[.12,.03,-.16],fov:40,safeWidth:1.36},
  ],
  beats:[
    {t:0,pose:'AFTERLIGHT_KNEEL',root:{pos:[0,-.50,0]},camera:{shot:'TWO-SHOT',pos:[0,1.75,8.7],look:[0,1.1,0],fov:38},defender:{reaction:'FREEZE'},lights:{drain:.2,blackout:0,relight:0},sfx:[{id:'afterlight-heartbeat',at:0,end:2.5}],fx:[{id:'LIGHT_DRAIN',at:0,end:5.5,opacity:.40,anchor:'attacker'}]},
    {t:.35,pose:'AFTERLIGHT_RISE',root:{pos:[0,-.35,0]},camera:{shot:'DOLLY',pos:[-.50,1.67,5.8],look:[-1.6,1.28,0],fov:31,anchor:'attacker-eyes',anchorWeight:.12,offset:[1.65,.12,5.5]},defender:{reaction:'FREEZE'},lights:{drain:.82,blackout:.82,relight:0}},
    {t:1.4,pose:'AFTERLIGHT_EYE_LOCK',root:{pos:[0,0,0],ease:'outCubic'},camera:{shot:'CLOSE',pos:[-.05,1.72,1.20],look:[-1.6,1.58,0],fov:23,anchor:'attacker-eyes',anchorWeight:1,offset:[1.55,.14,1.2]},defender:{reaction:'FREEZE'},lights:{drain:1,blackout:1,relight:0}},
    {t:2.5,pose:'AFTERLIGHT_EYE_LOCK',root:{pos:[0,0,0]},camera:{shot:'CLOSE',pos:[-.17,1.72,1.14],look:[-1.6,1.58,0],fov:22,anchor:'attacker-eyes',anchorWeight:1,offset:[1.43,.14,1.14]},defender:{reaction:'FREEZE'},lights:{drain:1,blackout:1,relight:0},sfx:[{id:'afterlight-convergence',at:2.5,end:5.5}]},
    {t:3.1,pose:'AFTERLIGHT_STILL',root:{pos:[0,0,0]},camera:{shot:'ORBIT',pos:[-3.3,2.85,5.3],look:[-.95,1.67,0],fov:36,anchor:'attacker-eyes',anchorWeight:0,offset:[-1.7,1.27,5.3]},defender:{reaction:'FREEZE'},lights:{drain:1,blackout:1,relight:0}},
    {t:4.25,pose:'AFTERLIGHT_STILL',root:{pos:[0,0,0]},camera:{shot:'ORBIT',pos:[-.5,4.35,7.8],look:[0,1.63,0],fov:42},defender:{reaction:'FREEZE'},lights:{drain:1,blackout:1,relight:0},fx:[{id:'GLASS_SHATTER',at:4.25,end:5.5,style:'dome',count:24,opacity:.5,anchor:'target'}]},
    {t:5.5,pose:'AFTERLIGHT_STILL',root:{pos:[0,0,0]},camera:{shot:'ORBIT',pos:[3.5,3.15,9.1],look:[.35,1.45,0],fov:44},defender:{reaction:'FREEZE'},lights:{drain:1,blackout:1,relight:0},sfx:[{id:'afterlight-reflections',at:5.5,end:8.85}],fx:[{id:'AFTERIMAGE',at:5.5,end:9,count:24,opacity:.55,anchor:'target'}]},
    {t:6.35,pose:'AFTERLIGHT_STILL',root:{pos:[0,0,0]},camera:{shot:'ORBIT',pos:[2.25,2.72,8.5],look:[.5,1.48,.18],fov:44},defender:{reaction:'FREEZE'},lights:{drain:1,blackout:1,relight:0}},
    {t:7.3,pose:'AFTERLIGHT_STILL',root:{pos:[0,0,0]},camera:{shot:'ORBIT',pos:[.35,2.25,8.05],look:[.54,1.48,.1],fov:44},defender:{reaction:'FREEZE'},lights:{drain:1,blackout:1,relight:0}},
    {t:8.45,pose:'AFTERLIGHT_STILL',root:{pos:[0,0,0]},camera:{shot:'ORBIT',pos:[-1.6,2.0,8.25],look:[.45,1.5,-.1],fov:43},defender:{reaction:'FREEZE'},lights:{drain:1,blackout:1,relight:0}},
    {t:8.62,pose:'AFTERLIGHT_STILL',root:{pos:[0,0,0]},camera:{shot:'ORBIT',pos:[-1.96,1.69,8.13],look:[.27,1.50,-.05],fov:41.5},defender:{reaction:'FREEZE'},lights:{drain:1,blackout:1,relight:0}},
    {t:8.78,pose:'AFTERLIGHT_TURN',root:{pos:[0,0,0]},camera:{shot:'LOW-HERO',pos:[-2.25,1.37,8.0],look:[.10,1.51,0],fov:40},defender:{reaction:'FREEZE'},lights:{drain:1,blackout:1,relight:0},sfx:[{id:'sheath-click',at:8.78}]},
    {t:9,pose:'AFTERLIGHT_TURN',root:{pos:[0,0,0]},camera:{shot:'LOW-HERO',pos:[-2.2,1.38,8.2],look:[.2,1.47,0],fov:41},defender:{reaction:'FREEZE'},lights:{drain:1,blackout:1,relight:0},
      fx:[{id:'SLASH_LINE',at:9,end:10.5,count:24,opacity:.5,axis:'mirror-cuts',anchor:'target'},{id:'IMPACT_FRAME',at:9,end:9.15,opacity:.10,soft:true},{id:'SHOCKRING',at:9,end:12.3,size:4.5,opacity:.3,anchor:'target'},{id:'GLASS_SHATTER',at:9.65,end:12.5,count:256,opacity:.5,style:'boss-cubes',anchor:'target'}],sfx:[{id:'afterlight-bloom',at:9}]},
    {t:9.7,pose:'AFTERLIGHT_TURN',root:{pos:[0,0,0]},camera:{shot:'DOLLY',pos:[-1.65,2.35,9.35],look:[.2,1.67,0],fov:43},defender:{reaction:'FREEZE'},lights:{drain:.88,blackout:0,relight:.12}},
    {t:11.2,pose:'WIN_BACK',root:{pos:[-.10,0,-.17],yaw:-Math.PI/2},camera:{shot:'HIGH-CRANE',pos:[-1.2,3.0,11.2],look:[0,1.75,0],fov:43},defender:{reaction:'FREEZE'},lights:{drain:.40,blackout:0,relight:.62}},
    {t:12.5,pose:'WIN_BACK',root:{pos:[-.15,0,-.24],yaw:-Math.PI/2},camera:{shot:'HIGH-CRANE',pos:[-1.1,2.70,7.6],look:[-1.65,.90,-.24],fov:38},defender:{reaction:'FREEZE'},lights:{drain:0,blackout:0,relight:1},sfx:[{id:'afterlight-chord',at:12.5,end:15}]},
    {t:13.6,pose:'WIN_BACK',root:{pos:[-.15,0,-.24],yaw:-Math.PI/2},camera:{shot:'HIGH-CRANE',pos:[-.8,2.85,6.4],look:[-1.65,.85,-.24],fov:36},defender:{reaction:'FREEZE'},lights:{drain:0,blackout:0,relight:1}},
    {t:15,pose:'WIN_BACK',root:{pos:[-.15,0,-.24],yaw:-Math.PI/2},camera:{shot:'ESTABLISH',pos:[-.6,3.00,7.2],look:[-1.65,.85,-.24],fov:39},defender:{reaction:'FREEZE'},lights:{drain:0,blackout:0,relight:1}},
  ],
});
