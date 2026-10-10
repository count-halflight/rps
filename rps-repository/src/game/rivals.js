import { fighterFor } from './fighters.js';
const types={
 aggressor:{name:'Aggressor',reliability:72,weights:[6,2,2],idle:'forward',detail:'Favours rock. Presses after every exchange.'},
 patient:{name:'Counter-puncher',reliability:84,weights:[2,5,3],idle:'guard',detail:'Looks for repeats, then counters your last hand.'},
 mimic:{name:'Mimic',reliability:78,weights:[3,3,4],idle:'watch',detail:'Often copies the hand you just used.'},
 bluffer:{name:'Bluffer',reliability:38,weights:[3,5,2],idle:'taunt',detail:'The tell lies often. A scan gives certainty.'},
 gambler:{name:'Gambler',reliability:58,weights:[4,2,4],idle:'loose',detail:'Changes tempo and takes uneven risks.'},
 methodical:{name:'Cyclist',reliability:91,weights:[3,3,3],idle:'still',detail:'Moves through the hands in order.'},
};
export const PERSONALITIES=types;
const rows=[
 ['tern','Tern Vale',0,'echo','aggressor','#ccb857','cape','mask','rain','The tracks are mine.','A courier keeping the last train running.'],
 ['iona','Iona Switch',0,'kuro','patient','#6978b9','coat','plates','officer','Try the same hand again.','A switch operator fighting to reopen the line.'],
 ['pel','Pel Rusk',0,'cinder','bluffer','#b56e47','vest','visor','weld','You believed that?','A repairer who bets with borrowed tools.'],
 ['sev','Sev Halden',0,'vex','methodical','#46968b','hood','antenna','signal','Count the lights.','A night guard who counts each passing carriage.'],
 ['bryn','Bryn Ash',1,'cinder','aggressor','#d77836','apron','plates','forge','Keep your feet under you.','A furnace worker buying back the crew’s shop.'],
 ['nera','Nera Flint',1,'nyx','gambler','#846273','veil','rings','brass','Let’s see where this lands.','A glass worker who fights by the glow of the kiln.'],
 ['corin','Corin Weld',1,'kuro','patient','#5f6871','coat','plates','heavy','I can wait.','A foundry bodyguard carrying the shift’s last wages.'],
 ['dey','Dey Ember',1,'echo','mimic','#bf775c','vest','paint','copper','I saw that one.','A striker who learns by watching the crew.'],
 ['elian','Elian Fold',2,'nyx','mimic','#d0c9b4','hood','collar','prism','Your hand has an echo.','A surveyor mapping rooms that change their angle.'],
 ['orra','Orra Glass',2,'vex','bluffer','#8b61bb','coat','visor','mirror','Look again.','A vault runner carrying a cracked mirror.'],
 ['tess','Tess Refract',2,'echo','methodical','#ad88ae','cape','plates','crystal','Three angles. One answer.','A prism cutter who measures before moving.'],
 ['varo','Varo Null',2,'kuro','patient','#525784','coat','rings','halo','Finish your thought.','A keeper of the vault’s locked lower chamber.'],
 ['lio','Lio Thread',3,'vex','gambler','#c44c53','vest','scarf','thread','I like these odds.','A tailor who never wagers the same way twice.'],
 ['mara','Mara Quill',3,'echo','bluffer','#b46891','hood','paint','rose','Was that a tell?','A market messenger with a talent for misdirection.'],
 ['osen','Osen Bell',3,'cinder','aggressor','#d3ad56','vest','collar','lantern','Hear that? My turn.','A lantern maker defending the night stalls.'],
 ['yara','Yara Moss',3,'nyx','mimic','#5b9279','cape','rings','beads','I’ve heard that rhythm.','A musician saving the market’s old concert room.'],
 ['aven','Aven Reed',4,'kuro','methodical','#7e9b64','cape','antenna','crown','Breathe. Count.','A gardener tending the city’s last living uplink.'],
 ['edda','Edda Coil',4,'nyx','patient','#588cba','cape','collar','cable','Your pulse moved first.','A cable tender listening to the roots underfoot.'],
 ['sol','Sol Fen',4,'vex','mimic','#8cbd84','hood','paint','leaf','I can do that too.','A seed runner copying the city’s quickest couriers.'],
 ['piri','Piri Root',4,'cinder','gambler','#8c9760','vest','plates','root','Let it grow wild.','A root keeper who prefers an uncertain route.'],
 ['rell','Rell Brine',5,'cinder','aggressor','#587b96','coat','collar','dive','Plant your feet.','A diver fighting to recover the crew’s lost boat.'],
 ['sera','Sera Wake',5,'vex','patient','#bcc9cf','hood','scarf','rope','The tide turns.','A harbour pilot watching the current before moving.'],
 ['thane','Thane Keel',5,'kuro','methodical','#426b81','coat','plates','anchor','Hold your line.','A dock foreman who refuses to abandon the pier.'],
 ['olli','Olli Drift',5,'echo','bluffer','#6c92c0','cape','mask','storm','That was the other hand.','A salvage runner who hides every wager behind a grin.'],
];
export const RIVALS=rows.map(([id,name,district,character,personality,color,layer,detail,theme,taunt,lore])=>({id,name,district,character,personality,color,kit:{layer,detail,theme},taunt,lore,title:types[personality].name,weapon:fighterFor(character).weapon}));
const bossRows=[
 ['morrow','Morrow','Rail keeper','cinder','plating','#abb882','rail','The last train passes through me.','He guards the line that kept the district alive.','Rail hammer','rail-pass'],
 ['varda','Varda','Kiln widow','cinder','thermal','#ed8f53','kiln','The fire still knows my name.','She keeps the forgotten furnaces burning.','Furnace dive','furnace-heart'],
 ['irid','Irid','Prism cartographer','kuro','mirror','#ba9de3','prism','I have drawn your next step.','His maps show a room from every possible angle.','Refraction cut','prism-memory'],
 ['vesra','Vesra','Lantern sovereign','nyx','siphon','#e7a1b1','lantern','Every light here owes me a night.','She keeps the market lit with debts and stolen charge.','Lantern snare','night-dividend'],
 ['senn','Senn','Antenna regent','kuro','redline','#b2d79a','root','Listen to the ground.','The uplink garden answers his second heartbeat.','Root launch','root-pulse'],
 ['orven','Orven','Tide captain','cinder','blackout','#8ebee2','tide','You cannot read a wave.','He searches the black water for the crew he lost.','Anchor fall','tide-compass'],
];
export const BOSSES=bossRows.map(([id,name,title,character,ability,color,model,taunt,lore,signature,reward],district)=>({id,name,title,character,ability,color,model,district,taunt,lore,signature,reward,weapon:['Rail hammer','Furnace wraps','Prism glaive','Lantern staff','Root glaive','Tide anchor'][district],scale:[1.7,1.65,1.65,1.6,1.85,1.8][district],personality:['patient','aggressor','mimic','bluffer','gambler','methodical'][district],phases:[{at:1,name:'Measured',detail:'Watch the signature warning.'},{at:.65,name:['Last train','Open furnace','Reversed orbit','Lights out','Root surge','High tide'][district],detail:['Safe attacks meet stronger armour.','The furnace adds heat every turn.','The rival counters your last hand.','Stolen hits restore health.','The second pulse increases damage.','The forecast becomes less reliable.'][district]},{at:.30,name:'Last stand',detail:'Signature warnings arrive more often.'}]}));
export const MINIBOSSES=['Halvek','Enna','Isren','Ouma','Cale','Dres'].map((name,district)=>({id:`elite-${district}`,name,title:['Switch guard','Furnace hand','Glass marshal','Night broker','Root keeper','Flood runner'][district],district,character:['kuro','cinder','nyx','echo','kuro','vex'][district],personality:['patient','aggressor','mimic','bluffer','methodical','gambler'][district],color:BOSSES[district].color,kit:{layer:['coat','apron','cape','veil','cape','hood'][district],detail:['plates','plates','rings','mask','antenna','collar'][district],theme:'elite'},taunt:['The crossing is closed.','You’re on my shift.','I keep the angles.','Pay before you pass.','The roots run deep.','Watch the water.'][district],lore:'The district’s gatekeeper has a second health segment.',ability:BOSSES[district].ability,scale:1.25}));
function number(seed){let x=seed>>>0;x=Math.imul(x^(x>>>16),0x45d9f3b);return((x^(x>>>16))>>>0)/2**32;}
export function encounterFor(seed,level,route='normal'){
 const district=(level-1)%6;
 const boss=level%5===0,elite=!boss&&(level%5===3||route==='elite');
 const pool=RIVALS.filter(r=>r.district===district);
 const rival=boss?BOSSES[district]:elite?MINIBOSSES[district]:pool[(Math.floor(number(seed+district*937)*4)+Math.floor((level-1)/6))%4];
 return {...rival,boss,elite,weapon:rival.weapon||fighterFor(rival.character).weapon,personalityInfo:types[rival.personality],lookSeed:(seed+level*283)>>>0};
}
export function phaseFor(enemy){return enemy.boss?enemy.hp<=enemy.maxHp*.30?2:enemy.hp<=enemy.maxHp*.65?1:0:0;}
export function signatureWarning(run){const t=run.fightTurn??run.turn;return run.enemy.boss&&t>0&&t%([4,3,2][phaseFor(run.enemy)])===0;}
