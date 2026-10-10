import test from 'node:test';
import assert from 'node:assert/strict';
import { environmentVariantFor } from '../src/components/environments.js';

test('six district themes recur with changing weather and traffic in later cycles',()=>{
 const themes=new Set();
 for(let level=1;level<=6;level++){
  const first=environmentVariantFor(level),next=environmentVariantFor(level+6);
  themes.add(first.theme);
  assert.equal(next.theme,first.theme);
  assert.equal(next.cycle,first.cycle+1);
  assert.notEqual(next.weather,first.weather);
  assert.notEqual(next.trafficSpeed,first.trafficSpeed);
  assert.deepEqual(environmentVariantFor(level),first);
 }
 assert.equal(themes.size,6);
 assert.equal(environmentVariantFor(10000).index,3);
});
