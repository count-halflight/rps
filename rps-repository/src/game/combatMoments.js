import {POSE_KEYS} from './poseKeys.js';
import {echoPose,blendEchoPoses} from './sequences/echo/poses.js';
import {reactionPose} from './sequences/reactions.js';
import {clamp,mix,vector,smooth} from './sequences/math.js';
import {ANATOMICAL_HEIGHTS} from './sceneMoments.js';

// Shared combat grammar has its own IDs. These are presentation-only moments,
// independent of the canonical attack registry, combat resolution and RNG.
const definitions=[
  {id:'combat.reveal',kind:'reveal',duration:1200,contactTimes:[.27,.54,.81],revealAt:.81,resultAt:.90,
    reviewTimes:[0,.12,.27,.36,.45,.54,.65,.74,.81,.90,1.05,1.2]},
  {id:'combat.clash',kind:'clash',duration:1000,contactTimes:[.40],hitStop:70,
    reviewTimes:[0,.12,.24,.34,.40,.44,.48,.58,.70,.82,.94,1]},
  {id:'combat.brace',kind:'brace',duration:600,contactTimes:[],
    reviewTimes:[0,.06,.12,.18,.24,.30,.36,.42,.48,.52,.56,.6]},
  ...['medkit','coolant','battery','scan'].map(item=>({id:`item.${item}`,kind:'item',item,duration:1000,contactTimes:[.42],
    reviewTimes:[0,.10,.18,.25,.33,.42,.52,.63,.74,.84,.94,1]})),
  {id:'combat.defeat',kind:'defeat',duration:3000,contactTimes:[],
    reviewTimes:[0,.16,.32,.50,.72,.95,1.25,1.60,2.00,2.30,2.65,3]},
];
export const COMBAT_MOMENTS=Object.freeze(definitions.map(def=>Object.freeze({...def,origin:1.6})));
const moments=new Map(COMBAT_MOMENTS.map(def=>[def.id,def]));
const hands=['rock','paper','scissors'];
export const combatMomentById=id=>moments.get(id);

const full=(pose,extra={})=>{
  const p={...pose,...extra,face:{...pose.face,...extra.face}};
  return blendEchoPoses(p,p,0);
};
const guarded=(character,key,extra={})=>full({...echoPose('ECHO_IDLE'),...(POSE_KEYS[key]||{})},
  {grip:character==='echo'?'reverse':'forward',openHand:character==='nyx',footLock:[1,1],floorY:0,...extra});

export function kitGuard(character='echo',options={}){
  const p=character==='echo'?echoPose('ECHO_IDLE'):
    character==='cinder'?guarded(character,'boxingCoil',{handL:[.24,1.64,.35],handR:[-.27,1.61,.33],torsoPitch:.12}):
    character==='nyx'?guarded(character,'staffPoint',{handL:[.31,1.16,.22],handR:[-.17,1.47,.25],torsoYaw:-.12}):
    character==='vex'?guarded(character,'bowQuick',{handL:[.31,1.40,.50],handR:[-.20,1.44,.18],torsoYaw:.15,draw:.10}):
    guarded(character,'spearCoil',{handL:[.30,1.27,.38],handR:[-.26,1.42,.23],torsoYaw:.12});
  return full(p,{footLock:[1,1],floorY:0,reduced:!!options.reduced,...options});
}

export function kitBrace(character='echo',options={}){
  const guard=kitGuard(character,options);
  const p=character==='echo'?full(echoPose('GUARD_CROSS'),{handL:[-.07,1.68,.47],handR:[.08,1.70,.47],weaponSweep:.80,torsoPitch:.18}):
    character==='cinder'?full(guard,{handL:[.04,1.85,.45],handR:[-.06,1.84,.44],torsoPitch:.31,headPitch:.12,openHand:false}):
    character==='nyx'?full(guard,{handL:[.32,1.28,.25],handR:[-.04,1.70,.58],openHand:true,torsoPitch:.12,weaponPitch:-.15}):
    character==='vex'?full(guard,{handL:[.07,1.56,.60],handR:[-.13,1.47,.20],headPitch:.20,torsoPitch:.56,torsoYaw:.25,draw:0}):
    full(guard,{handL:[.22,1.17,.40],handR:[.10,1.72,.49],torsoPitch:.24,weaponPitch:.06,headPitch:.08});
  return full(p,{expression:'grit',face:{browDown:.45,grit:.45},footLock:[1,1],floorY:0,
    ...(['vex','kuro'].includes(character)?{freeHand:'R'}:{}),reduced:!!options.reduced});
}

function physicalOptions(options){
  const playerCharacter=options.playerCharacter||options.character||'echo',enemyCharacter=options.enemyCharacter||'cinder';
  return{playerCharacter,enemyCharacter,playerHeight:options.playerHeight||ANATOMICAL_HEIGHTS[playerCharacter]||1.72,
    enemyHeight:options.enemyHeight||ANATOMICAL_HEIGHTS[options.bossId||enemyCharacter]||1.90};
}
function staged(character,height,side,pose,pos=[0,0,0],yaw=0){
  const sign=side==='player'?-1:1;
  return{character,height,pose:full(pose,{x:pos[0],y:pos[1],z:pos[2],yaw}),
    root:{pos:[sign*(1.6-pos[0]),pos[1],pos[2]],yaw:-sign*Math.PI/2+yaw*sign}};
}
function anchor(actor,fraction=.62,forward=0){
  const sign=actor.root.pos[0]<0?-1:1;
  return[actor.root.pos[0]-sign*forward,actor.root.pos[1]+actor.height*fraction,actor.root.pos[2]];
}
const fx=(id,at,end,time,extra={})=>time>=at&&time<end?{id,at,end,phase:clamp((time-at)/(end-at)),age:time-at,
  opacity:.30,count:1,soft:true,...extra}:null;
const sound=(id,at,end,extra={})=>({id,at,end,...extra});

function revealPose(character,height,time,hand,options){
  const guard=kitGuard(character,options),reduced=!!options.reduced;
  // Three physical downbeats. The first two remain a closed fist; the selected
  // sign opens only on the third, so a pending choice never leaks early.
  const beat=.27,cycle=clamp(time/beat,0,3),phase=cycle%1;
  const throwing=time<.81,arc=throwing?Math.sin(Math.PI*phase):0;
  const coil=smooth(0,.10,time)*(1-smooth(.80,.96,time));
  const signProgress=smooth(.765,.81,time),reaction=smooth(.90,1.08,time);
  const handY=throwing?1.22+arc*(reduced?.19:.34):1.40;
  return full(guard,{handR:[-.18,handY,.52+signProgress*.09],handL:[.31,1.13,.30],
    torsoPitch:.21*coil,torsoYaw:-.16*coil,headPitch:-.02+arc*.025,
    handSign:time<.765?'rock':hand,rpsHand:'R',handSignProgress:time<.765?1:signProgress,
    expression:'calm',face:{blink:0,browDown:.18,smirk:options.winner?.12*reaction:.02},
    bladeState:character==='echo'?'sheathed':guard.bladeState,drawProgress:character==='echo'?0:guard.drawProgress,
    footLock:[1,1],floorY:0});
}

function pairedReveal(time,options,metrics){
  const playerHand=hands.includes(options.playerHand)?options.playerHand:'rock',enemyHand=hands.includes(options.enemyHand)?options.enemyHand:'scissors';
  const outcome=['win','loss','draw'].includes(options.outcome)?options.outcome:'win';
  const {playerCharacter,enemyCharacter,playerHeight,enemyHeight}=metrics;
  const playerWinner=outcome==='win',enemyWinner=outcome==='loss',result=smooth(.90,1.06,time);
  const recoil=outcome==='draw'?.07*Math.sin(Math.PI*smooth(.90,1.2,time)):.10*result;
  const player=staged(playerCharacter,playerHeight,'player',revealPose(playerCharacter,playerHeight,time,playerHand,{...options,winner:playerWinner}),
    [playerWinner?0:-recoil,-playerHeight*.045*smooth(0,.10,time)*(1-smooth(.81,1.1,time)),0],playerWinner?-.06*result:.10*result);
  const enemy=staged(enemyCharacter,enemyHeight,'enemy',revealPose(enemyCharacter,enemyHeight,time,enemyHand,{...options,winner:enemyWinner}),
    [enemyWinner?0:-recoil,-enemyHeight*.045*smooth(0,.10,time)*(1-smooth(.81,1.1,time)),0],enemyWinner?-.06*result:.10*result);
  if(time>=.90&&outcome!=='draw'){
    const loser=playerWinner?enemy:player,reaction=reactionPose('FLINCH',time-.90,.25);
    loser.pose=full(loser.pose,{torsoPitch:loser.pose.torsoPitch+reaction.torsoPitch,expression:'hurt',face:{hurt:.12*result,grit:.08*result}});
  }
  const ringPulses=[.27,.54,.81].map(at=>Math.max(0,1-Math.abs(time-at)/.10));
  const reveal={playerHand:time>=.81?playerHand:null,enemyHand:time>=.81?enemyHand:null,
    throwIndex:Math.min(3,Math.floor(time/.27)+1),throwing:time<.81,ringPulses,resultVisible:time>=.90,
    outcome:time>=.90?outcome:null,winner:time>=.90?(playerWinner?'player':enemyWinner?'enemy':null):null};
  const effects=[fx('TRINITY_RINGS',0,1.2,time,{ringPulses,worldPoint:[0,(playerHeight+enemyHeight)*.34,0]})];
  for(const [side,hand,actor,winner]of [['player',playerHand,player,playerWinner],['enemy',enemyHand,enemy,enemyWinner]]){
    effects.push(fx('HAND_TOTEM',.765,1.2,time,{side,hand,worldPoint:anchor(actor,.65,.50),
      approach:smooth(.765,.90,time),ignite:winner?result:0,crack:outcome!=='draw'&&!winner?result:0,bounce:outcome==='draw'?recoil/.07:0}));
  }
  effects.push(fx('SHOCKRING',.90,1.12,time,{size:.5,worldPoint:[0,(playerHeight+enemyHeight)*.34,0]}));
  const average=(playerHeight+enemyHeight)*.5,push=smooth(0,.13,time),punch=options.reduced?0:result;
  const winnerX=playerWinner?-1.25:enemyWinner?1.25:0;
  return{player,enemy,reveal,fx:effects.filter(Boolean),impact:Math.max(...ringPulses)*.35,
    camera:[winnerX*punch*.50,average*1.18,6.40*(1-.05*push)-punch*.34],target:[winnerX*punch*.40,average*.64,0],fov:38-punch*2,
    cameraShot:punch>.3?'WINNER-PUNCH':'TWO-SHOT',sfx:[...([.27,.54,.81].map((at,i)=>sound('reveal-thud',at,at+.09,{pulseIndex:i}))),sound('totem-contact',.90,1.03,{outcome})]};
}

function pairedClash(time,options,metrics){
  const {playerCharacter,enemyCharacter,playerHeight,enemyHeight}=metrics,hit=.40,holdEnd=.47;
  // The clash gets one full second, while its actual impact hold stays 70 ms.
  // Recovery compensates for that hold and reaches its final pose at 1 s.
  const physical=time>=hit&&time<holdEnd?hit:time>holdEnd?hit+(time-holdEnd)*(.60/.53):time;
  const approach=smooth(0,hit,physical),skid=smooth(hit,.94,physical),load=approach*(1-skid);
  const root=.82*approach-1.00*skid;
  const player=staged(playerCharacter,playerHeight,'player',blendEchoPoses(kitGuard(playerCharacter,options),kitBrace(playerCharacter,options),load),
    [root,-playerHeight*.04*load,0],-.08*load);
  const enemy=staged(enemyCharacter,enemyHeight,'enemy',blendEchoPoses(kitGuard(enemyCharacter,options),kitBrace(enemyCharacter,options),load),
    [root,-enemyHeight*.04*load,0],-.08*load);
  const average=(playerHeight+enemyHeight)*.5,impact=time>=hit?1-smooth(hit+.045,hit+.16,time):0;
  return{player,enemy,physicalSeconds:physical,hitStopped:time>=hit&&time<holdEnd,
    timeScale:time>=hit&&time<holdEnd?0:time>holdEnd?.60/.53:1,
    fx:[fx('SPARKS',hit,.62,time,{count:18,opacity:.42,worldPoint:[0,average*.67,0]}),
      fx('SHOCKRING',hit,.76,time,{size:.8,opacity:.26,worldPoint:[0,average*.67,0]}),
      fx('DUST_RING',.50,.96,time,{count:2,size:.7,worldPoints:[anchor(player,0),anchor(enemy,0)]})].filter(Boolean),
    camera:[0,average*1.11,6.35],target:[0,average*.61,0],fov:38+impact*3,cameraShot:'WEAPON-CLASH',impact,
    sfx:[sound('weapon-clash',hit,.56),sound('double-skid',.50,.96)]};
}

function itemUse(item,time,options,metrics){
  const side=options.actorSide==='enemy'?'enemy':'player',character=side==='player'?metrics.playerCharacter:metrics.enemyCharacter;
  const use=smooth(.04,.26,time)*(1-smooth(.67,1,time)),guard=kitGuard(character,options);
  const freeGuard=full(guard,{freeHand:'R'});
  const action=item==='medkit'?full(freeGuard,{handL:[.37,1.39,.36],handR:[.11,1.42,.32],headPitch:.13,openHand:false}):
    item==='coolant'?full(freeGuard,{handL:[.44,1.26,.24],handR:[-.44,1.28,.24],torsoPitch:.18,headPitch:-.04,openHand:true}):
    item==='battery'?full(freeGuard,{handL:[.36,1.26,.26],handR:[.05,1.45,.31],headPitch:.08,openHand:false}):
    full(freeGuard,{handR:[-.03,1.61,.65],headPitch:-.04,openHand:true});
  const player=staged(metrics.playerCharacter,metrics.playerHeight,'player',side==='player'?blendEchoPoses(guard,action,use):kitGuard(metrics.playerCharacter,options));
  const enemy=staged(metrics.enemyCharacter,metrics.enemyHeight,'enemy',side==='enemy'?blendEchoPoses(guard,action,use):kitGuard(metrics.enemyCharacter,options));
  const actor=side==='player'?player:enemy,target=side==='player'?enemy:player,point=anchor(actor,.58),targetPoint=anchor(target,.55);
  const effects=item==='medkit'?[fx('INJECTOR',.18,.63,time,{side,worldPoint:anchor(actor,.66,.23)}),fx('SHOCKRING',.42,.96,time,{side,color:'#65d69b',axis:'body-rise',rise:actor.height*.95,worldPoint:[point[0],.12,point[2]],size:.55,opacity:.28})]:
    item==='coolant'?[fx('WIND_RIBBON',.28,.98,time,{side,color:'#72c4d6',style:'vent-steam',count:8,worldPoint:point}),fx('FROST_CREEP',.42,.96,time,{side,worldPoint:point,opacity:.25})]:
    item==='battery'?[fx('LIGHT_DRAIN',.24,.90,time,{side,axis:'charge-cell',worldPoint:point,opacity:.24}),fx('CHARGE_CELL',.42,.96,time,{side,worldPoint:anchor(actor,.68,.20),fill:smooth(.42,.88,time)})]:
    [fx('SCAN_LINE',.22,.90,time,{side:side==='player'?'enemy':'player',worldPoint:[targetPoint[0],target.height*(1-smooth(.22,.90,time)),targetPoint[2]],width:.9,color:'#83d9d1'}),
      fx('HAND_GLYPH',.72,1,time,{side:side==='player'?'enemy':'player',hand:options.scannedHand||null,worldPoint:anchor(target,.64,.25),print:smooth(.72,.90,time)})];
  return{player,enemy,fx:effects.filter(Boolean),item:{id:item,side,applied:time>=.42,commitReady:time>=1},
    camera:[side==='player'?-.85:.85,actor.height*1.09,5.95],target:[actor.root.pos[0]*.65,actor.height*.64,0],fov:38,cameraShot:'ITEM-USE',impact:0,
    sfx:[sound(item==='medkit'?'injector-pulse':item==='coolant'?'coolant-hiss':item==='battery'?'battery-fill':'scan-sweep',.42,.94)]};
}

function brace(time,options,metrics){
  const side=options.actorSide==='enemy'?'enemy':'player',weight=smooth(0,.16,time)*(1-smooth(.42,.6,time));
  const playerPose=side==='player'?blendEchoPoses(kitGuard(metrics.playerCharacter,options),kitBrace(metrics.playerCharacter,options),weight):kitGuard(metrics.playerCharacter,options);
  const enemyPose=side==='enemy'?blendEchoPoses(kitGuard(metrics.enemyCharacter,options),kitBrace(metrics.enemyCharacter,options),weight):kitGuard(metrics.enemyCharacter,options);
  const player=staged(metrics.playerCharacter,metrics.playerHeight,'player',playerPose,[0,side==='player'?-metrics.playerHeight*.07*weight:0,0]);
  const enemy=staged(metrics.enemyCharacter,metrics.enemyHeight,'enemy',enemyPose,[0,side==='enemy'?-metrics.enemyHeight*.07*weight:0,0]);
  const actor=side==='player'?player:enemy,prism=actor.character==='nyx';
  return{player,enemy,fx:prism?[fx('PRISM_BEAM',.12,.48,time,{side,style:'barrier',axis:'guard',worldPoint:anchor(actor,.65,.38),count:3,opacity:.22})].filter(Boolean):[],
    camera:[side==='player'?-.80:.80,actor.height*1.06,6.0],target:[actor.root.pos[0]*.48,actor.height*.63,0],fov:38,cameraShot:'KIT-BRACE',impact:0,
    sfx:[sound('guard-set',.16,.24,{character:actor.character})]};
}

function defeat(time,options,metrics){
  const side=options.defeatedSide==='enemy'?'enemy':'player',height=side==='player'?metrics.playerHeight:metrics.enemyHeight;
  const sink=smooth(.08,.78,time),fade=smooth(2.30,3,time),hurt=reactionPose('KNEEL',.35*sink);
  const character=side==='player'?metrics.playerCharacter:metrics.enemyCharacter;
  const defeated=full(kitGuard(character,options),{...hurt,
    handL:[.25,1.00,.40],handR:[-.25,1.03,.37],footL:[.18,.11,.45],footR:[-.17,.11,-.38],
    footLock:[1,1],floorY:0,bladeState:character==='echo'?'sheathed':'drawn',drawProgress:character==='echo'?0:1,
    expression:'hurt',face:{hurt:.5,grit:.08,browDown:.12,blink:.45*sink},opacity:1});
  const player=staged(metrics.playerCharacter,metrics.playerHeight,'player',side==='player'?defeated:kitGuard(metrics.playerCharacter,options),
    [0,side==='player'?-height*.34*sink:0,0]);
  const enemy=staged(metrics.enemyCharacter,metrics.enemyHeight,'enemy',side==='enemy'?defeated:kitGuard(metrics.enemyCharacter,options),
    [0,side==='enemy'?-height*.34*sink:0,0]);
  const loser=side==='player'?player:enemy,winner=side==='player'?enemy:player,cut=smooth(.08,1.25,time);
  const practicalExtinction=[.18,.50,.92,1.25].map(at=>smooth(at,at+.16,time));
  return{player,enemy,fx:[],fade,lights:{drain:cut,blackout:cut,relight:0,key:1-fade,
      practicalExtinction,silhouetteSide:side==='player'?'enemy':'player',silhouetteStrength:1.05*(1-fade)},
    camera:[loser.root.pos[0]*.42,height*.78,6.30],target:[loser.root.pos[0]*.48,height*.48-height*.14*sink,0],
    fov:38,cameraShot:'LIGHT-OUT',impact:0,defeat:{side,kneeling:sink,held:time>=.78,silhouetteWorldPoint:anchor(winner,.66)},
    sfx:[sound('last-exhale',.12,.78),...[.18,.50,.92,1.25].map((at,i)=>sound('street-light-out',at,at+.08,{fixtureGroup:i})),sound('defeat-low-tone',1.25,2.65)]};
}

export function combatMomentPresentation(id,options={}){
  const definition=combatMomentById(id);if(!definition)throw new Error(`Unknown combat moment: ${id}`);
  const sample=evaluateCombatMoment(id,0,options);
  return{momentId:id,kind:definition.kind,duration:definition.duration,bodyDuration:definition.duration,origin:1.6,
    character:options.playerCharacter||options.character||'echo',sfx:sample.sfx,
    impactAt:(definition.resultAt??definition.contactTimes.at(-1)??0)/(definition.duration/1000),
    contactTimes:definition.contactTimes,revealAt:definition.revealAt,resultAt:definition.resultAt,commitAt:definition.duration/1000,...options};
}
export function evaluateCombatMoment(id,elapsedSeconds,options={}){
  const definition=combatMomentById(id);if(!definition)throw new Error(`Unknown combat moment: ${id}`);
  const duration=definition.duration/1000,time=clamp(elapsedSeconds,0,duration),metrics=physicalOptions(options);
  const moment=definition.kind==='reveal'?pairedReveal(time,options,metrics):definition.kind==='clash'?pairedClash(time,options,metrics):
    definition.kind==='brace'?brace(time,options,metrics):definition.kind==='item'?itemUse(definition.item,time,options,metrics):defeat(time,options,metrics);
  if(options.mirrored){
    for(const side of ['player','enemy']){moment[side].root.pos[0]*=-1;moment[side].root.yaw*=-1;}
    moment.camera[0]*=-1;moment.target[0]*=-1;
    for(const effect of moment.fx){if(effect.worldPoint)effect.worldPoint[0]*=-1;for(const point of effect.worldPoints||[])point[0]*=-1;}
    if(moment.defeat)moment.defeat.silhouetteWorldPoint[0]*=-1;
  }
  if(options.reduced){const average=(metrics.playerHeight+metrics.enemyHeight)*.5;
    moment.camera=[0,average*1.17,6.8];moment.target=[0,average*.60,0];moment.fov=40;moment.cameraShot='TWO-SHOT';}
  const contacts=definition.contactTimes,contactIndex=contacts.reduce((last,at,i)=>time+1e-9>=at?i:last,-1);
  return{momentId:id,kind:definition.kind,origin:1.6,time,unscaledSeconds:elapsedSeconds,
    physicalSeconds:moment.physicalSeconds??time,hitStopped:moment.hitStopped||false,timeScale:moment.timeScale??(moment.hitStopped?0:1),
    progress:time/duration,duration:definition.duration,finished:time>=duration,
    bars:0,roll:0,shake:options.reduced?0:definition.kind==='clash'?moment.impact*.12:0,flash:0,
    fade:0,lights:{drain:0,blackout:0,relight:0},contactIndex,contactAt:contactIndex<0?null:contacts[contactIndex]/duration,
    ...moment};
}
export function combatMomentContactSheetTimes(id,count=12){
  const definition=combatMomentById(id);if(!definition)throw new Error(`Unknown combat moment: ${id}`);
  if(count===12)return[...definition.reviewTimes];
  if(count<=1)return[0];
  return Array.from({length:count},(_,i)=>definition.duration*i/(1000*(count-1)));
}
