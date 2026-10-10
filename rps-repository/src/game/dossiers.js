import { levelFor } from "./engine.js";
export function localDossier(seed,level){
 const enemy=levelFor(seed,level);
 return{name:enemy.name,title:enemy.rival.title,story:enemy.rival.lore,taunt:enemy.rival.taunt,pattern:enemy.pattern,source:'local'};
}
