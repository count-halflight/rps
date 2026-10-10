const rows=[
 ['keen-edge','Keen edge','Attacks deal 2 extra base damage.',{damage:2}],
 ['brace-lining','Brace lining','Bracing prevents 2 more damage.',{guardArmor:2}],
 ['heat-sink','Heat sink','Clear 3 extra heat each turn.',{cooling:3}],
 ['spare-cell','Spare cell','Build 3 extra charge each turn.',{charge:3}],
 ['deep-pockets','Deep pockets','Earn 15% more victory credits.',{bounty:.15}],
 ['first-spark','First spark','Deal 6 extra damage on the opening turn.',{openingDamage:6}],
 ['closing-edge','Closing edge','Deal 5 extra damage below 30% rival health.',{closingDamage:5}],
 ['warm-current','Warm current','Build 5 extra charge above 50 heat.',{warmCharge:5}],
 ['cold-steel','Cold steel','Deal 3 extra damage below 25 heat.',{coldDamage:3}],
 ['clear-lens','Clear lens','Scans cost 5 less charge.',{scanDiscount:5}],
 ['measured-hit','Measured hit','A scanned attack deals 6 extra base damage.',{scanDamage:6}],
 ['hard-shell','Hard shell','Prevent 1 damage from every hit.',{armor:1}],
 ['air-gap','Air gap','Heavy attacks generate 4 less heat.',{heavyCooling:4}],
 ['fresh-wrap','Fresh wrap','Medkits restore 8 extra health.',{medkit:8}],
 ['field-stitch','Field stitch','Every third used medkit is preserved.',{medkitSave:1}],
 ['quick-contact','Quick contact','Quick attacks build 3 extra charge.',{quickCharge:3}],
 ['safe-current','Safe current','Safe attacks build 4 extra charge.',{guardCharge:4}],
 ['chain-link','Chain link','Each hit streak step adds 1 more damage.',{comboDamage:1}],
 ['clean-vent','Clean vent','Winning hits clear 2 extra heat.',{winCooling:2}],
 ['comeback','Comeback','Deal 6 extra damage below 40% health.',{lowDamage:6}],
 ['patient-cell','Patient cell','Draws build 4 extra charge.',{drawCharge:4}],
 ['patchwork','Patchwork','Draws restore 3 health.',{drawHeal:3}],
 ['counter-coil','Counter coil','Losing an exchange builds 4 charge.',{lossCharge:4}],
 ['steady-guard','Steady guard','Bracing prevents 8% more incoming damage.',{guardReduction:.08}],
 ['red-vent','Red vent','Clear 4 extra heat above 70 heat.',{hotCooling:4}],
 ['giant-slayer','Giant slayer','Deal 3 extra damage to bosses.',{bossDamage:3}],
 ['hazard-pay','Hazard pay','Elite victories award 20% more credits.',{eliteBounty:.2}],
 ['coolant-bank','Coolant bank','Coolant clears 10 extra heat.',{coolantItem:10}],
 ['battery-bank','Battery bank','Batteries restore 10 extra charge.',{batteryItem:10}],
 ['scan-memory','Scan memory','A scan refunds 5 charge after an attack.',{scanRefund:5}],
 ['route-forager','Route forager','Rest rooms grant an extra supply.',{restSupply:1}],
 ['slip-step','Slip step','Brace on every fourth exchange to avoid the hit.',{dodge:1}],
 ['rail-pass','Rail pass','Morrow’s reward: prevent 2 incoming damage.',{armor:2},1],
 ['furnace-heart','Furnace heart','Varda’s reward: clear 10 extra heat.',{cooling:10},1],
 ['prism-memory','Prism memory','Irid’s reward: scanned attacks refund 10 charge.',{scanRefund:10},1],
 ['night-dividend','Night dividend','Vesra’s reward: earn 5 extra credits on winning actions.',{winCredits:5},1],
 ['root-pulse','Root pulse','Senn’s reward: winning hits restore 5 health.',{winHeal:5},1],
 ['tide-compass','Tide compass','Orven’s reward: increase tell reliability by 15 points.',{tellBoost:15},1],
];
export const PERKS=rows.map(([id,name,detail,effects,cap=3])=>({id,name,detail,effects,cap,kind:cap===1?'Boss reward':'Perk',icon:'power'}));
export const perkFor=id=>PERKS.find(p=>p.id===id);
export function perkTotals(run){
 const out={};for(const [id,stack]of Object.entries(run.perks||{})){
  const p=perkFor(id);if(!p)continue;
  for(const [key,value]of Object.entries(p.effects))out[key]=(out[key]||0)+value*Math.min(p.cap,stack);
 }return out;
}
export function addPerk(run,id){const p=perkFor(id);if(!p)return run;return{...run,perks:{...(run.perks||{}),[id]:Math.min(p.cap,(run.perks?.[id]||0)+1)}};}
