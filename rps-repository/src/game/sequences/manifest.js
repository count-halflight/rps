import {FIGHTERS} from '../fighters.js';
export const HANDS=Object.freeze({rock:'R',paper:'P',scissors:'S'});
export const FINAL_TITLES=Object.freeze({
  echo:['Blade breaker','Mirror blades','Thousand cuts'],
  cinder:['Crater','Discharge','Furnace fall'],
  nyx:['Shatter','Integral collapse','Singularity'],
  vex:['Meteor rain','Sky pin','Starfall'],
  kuro:['Storm hammer','Tempest','Heaven’s gate'],
});
export const AFTERLIGHT_TITLES=Object.freeze({echo:'Last reflection',cinder:'Ashen sunrise',nyx:'Event horizon',vex:'The long way round',kuro:'Late thunder'});
// The manifest is a list of required IDs, not a claim that unauthored clips
// exist. The Lab offers only the IMPLEMENTED_SEQUENCES definitions.
export const SEQUENCE_MANIFEST=Object.freeze(FIGHTERS.flatMap(f=>[
  ...Object.entries(HANDS).flatMap(([weapon,hand],h)=>[
    ...f.moves[weapon].map((title,variant)=>({id:`${f.id.toUpperCase()}-${hand}${variant}`,character:f.id,weapon,variant,tier:variant+1,title,finisher:false,finale:false})),
    {id:`${f.id.toUpperCase()}-${hand}F`,character:f.id,weapon,variant:2,tier:4,title:FINAL_TITLES[f.id][h],finisher:true,finale:false},
  ]),
  {id:`${f.id.toUpperCase()}-AF`,character:f.id,weapon:'scissors',variant:2,tier:5,title:AFTERLIGHT_TITLES[f.id],finisher:true,finale:true},
]));
export function canonicalSequenceId(character,weapon,variant=0,finisher=false,finale=false){
  return `${character.toUpperCase()}-${finale?'AF':HANDS[weapon]+(finisher?'F':Math.abs(variant)%3)}`;
}
