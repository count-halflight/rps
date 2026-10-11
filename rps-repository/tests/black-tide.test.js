import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBlackTide, BLACK_TIDE_LAYOUTS, BLACK_TIDE_STAGE } from '../src/components/environments/blackTide.js';
import { environmentLightState } from '../src/components/environmentLighting.js';

test('Black Tide has three physically distinct, bounded-cost stages with visible water below the lane',()=>{
  const scene=new THREE.Scene(),world=createBlackTide(scene),counts=[];
  try{
    assert.equal(BLACK_TIDE_STAGE.width,16);assert.equal(BLACK_TIDE_STAGE.depth,10);assert.ok(world.water.position.y<-.5);
    for(let layout=0;layout<3;layout++){
      world.update(12,{layout,cycle:4},environmentLightState(),{low:true});const light=world.snapshot();
      assert.equal(light.layout,BLACK_TIDE_LAYOUTS[layout]);assert.equal(light.planarReflection,false);assert.ok(light.geometryDraws<=50);assert.equal(light.parallaxLayers,3);
      counts.push(light.triangles);
      const visible=world.root.children.filter(o=>BLACK_TIDE_LAYOUTS.some(name=>o.name===`Black Tide ${name}`)&&o.visible);assert.equal(visible.length,1);
      world.update(12,{layout,cycle:4},environmentLightState(),{low:false});assert.equal(world.snapshot().planarReflection,true);
      assert.equal(world.snapshot().triangles,light.triangles,'Light preserves stage/props, rather than hiding the art');
    }
    assert.equal(new Set(counts).size,3);
  }finally{world.dispose();}
  assert.equal(scene.children.length,0);
});

test('moving harbour landmarks and geometry remain finite through cuts, drains, tide and recovery',()=>{
  const scene=new THREE.Scene(),world=createBlackTide(scene);
  try{
    const ids=world.landmarks().map(l=>l.id);assert.ok(ids.includes('ferry'));assert.ok(ids.includes('crane-hoist'));
    for(const layout of [0,1,2])for(const time of [0,2,11,51])for(const progress of [0,.3,1]){
      const cinematic={slice:progress,lightDrain:progress,ripple:progress,focus:[-2,4,-1]};
      world.update(time,{layout,cycle:10},environmentLightState({cinematic}),{cinematic,low:true});scene.updateMatrixWorld(true);
      world.root.traverse(o=>{
        assert.ok(o.matrixWorld.elements.every(Number.isFinite),`${o.name} world matrix`);
        if(o.geometry?.attributes.position)assert.ok(o.geometry.attributes.position.array.every(Number.isFinite),`${o.name} geometry`);
      });
      assert.ok(world.landmarks().every(l=>l.position.every(Number.isFinite)));
    }
    assert.ok(world.root.getObjectsByProperty('name','Opposite skyline cut').some(o=>o.visible));
    world.resetCinematicState();world.update(51,{layout:0,cycle:10},environmentLightState(),{low:true});
    assert.ok(world.root.getObjectsByProperty('name','Opposite skyline cut').every(o=>!o.visible));
    assert.equal(world.root.getObjectByName('Practical light draining').visible,false);
    const hoist=world.landmarks().find(l=>l.id==='crane-hoist');assert.ok(hoist.position[1]>3,'cargo has clearance above normal fighters');assert.ok(hoist.position[1]<6,'the lowered hoist stays inside the ordinary camera composition');
  }finally{world.dispose();}
});

test('hiding or disposing the harbour leaves no live light or lingering mirror target',()=>{
  const scene=new THREE.Scene(),world=createBlackTide(scene);
  world.update(4,{layout:0,cycle:0},environmentLightState(),{low:true});world.setVisible(false);
  assert.equal(world.root.visible,false);world.root.traverse(o=>{if(o.isLight)assert.equal(o.visible,false);});
  world.setVisible(true);assert.equal(world.root.visible,true);world.root.traverse(o=>{if(o.isLight)assert.equal(o.visible,true);});
  let disposed=false;world.water.getRenderTarget().addEventListener('dispose',()=>disposed=true);world.dispose();assert.equal(disposed,true);assert.equal(scene.children.length,0);
});

test('reflection update is bounded, restores renderer state and can be disabled immediately',()=>{
  const scene=new THREE.Scene(),world=createBlackTide(scene),camera=new THREE.PerspectiveCamera(45,1,.1,90);
  camera.position.set(0,4,12);camera.lookAt(0,1,0);camera.updateMatrixWorld();let renders=0,target=null;
  const renderer={xr:{enabled:true},shadowMap:{autoUpdate:true},autoClear:true,getRenderTarget:()=>target,setRenderTarget:value=>{target=value;},state:{buffers:{depth:{setMask(){}}}},render(){renders++;}};
  try{
    world.update(12,{layout:0,cycle:0},environmentLightState(),{low:false});scene.updateMatrixWorld(true);
    assert.equal(world.updateReflection(renderer,scene,camera),true);assert.equal(renders,1);
    world.water.onBeforeRender(renderer,scene,camera);assert.equal(renders,1,'manual and automatic update share one throttle');
    assert.equal(target,null);assert.equal(renderer.xr.enabled,true);assert.equal(renderer.shadowMap.autoUpdate,true);assert.equal(world.water.visible,true);
    world.update(12.1,{layout:0,cycle:0},environmentLightState(),{low:false});scene.updateMatrixWorld(true);
    assert.equal(world.updateReflection(renderer,scene,camera),true);assert.equal(renders,2);
    world.setReflectionBudget(false);assert.equal(world.updateReflection(renderer,scene,camera),false);assert.equal(world.snapshot().planarReflection,false);
  }finally{world.dispose();}
});

test('pier surface gives pooled water different physical roughness from worn lanes and dirty shore edges',()=>{
  const world=createBlackTide(new THREE.Scene());
  try{
    let material;world.root.traverse(o=>{if(o.material?.customProgramCacheKey?.()==='black-tide-pier-surface-v1')material=o.material;});
    assert.ok(material,'floor reuses the stone batch with its own surface projection');
    const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);
    const image=shader.uniforms.pierControl.value.image;
    const roughness=(x,z)=>image.data[(Math.floor((z/10+.5)*image.height)*image.width+Math.floor((x/16+.5)*image.width))*4]/255;
    assert.ok(roughness(.15,2.3)<.3,'the authored front depression holds a glossy pool');
    assert.ok(roughness(-3.6,-.5)>.45,'stone outside that pool remains rough');
    assert.ok(roughness(7.5,0)>.6,'shore dirt remains coarse rather than becoming a glossy border');
    assert.equal(shader.uniforms.pierColour.value.image.width,1024);
    assert.match(shader.fragmentShader,/roughnessFactor=pierDetails.r/);assert.match(shader.fragmentShader,/normal=perturbNormalArb\(-vViewPosition,nonPerturbedNormal/);
    world.update(2,{layout:0,cycle:0},environmentLightState({rivalHpRatio:.7}),{low:true});
    assert.equal(shader.uniforms.pierCandleLife.value.y,0,'the middle candle reflection disappears with its failed practical bank');
    assert.ok(shader.uniforms.pierCandleLife.value.x>0);
    world.update(3,{layout:0,cycle:0},environmentLightState({rivalHpRatio:0,defeatElapsed:.2}),{low:true});
    assert.equal(shader.uniforms.pierLightLife.value.x,0,'pooled water cannot emit beacon glints during blackout');
    assert.equal(shader.uniforms.pierCandleLife.value.lengthSq(),0,'all reflected candles go dark during blackout');
  }finally{world.dispose();}
});
