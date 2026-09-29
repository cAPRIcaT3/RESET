import test from 'node:test';
import assert from 'node:assert/strict';
import { atmosphereLightingLayers, skyOccurrence } from '../src/scene/atmosphere.ts';

test('rare skies are deterministic per visit, independent, and occasional',()=>{
  let red=0, violet=0, both=0;
  for(let i=0;i<1000;i++) {
    const seed=`visit-${i}`, choice=skyOccurrence(seed);
    assert.deepEqual(choice,skyOccurrence(seed));
    red+=Number(choice.sunrise==='red');violet+=Number(choice.violetDawn);both+=Number(choice.sunrise==='red'&&choice.violetDawn);
  }
  assert.ok(red>180 && red<310);
  assert.ok(violet>210 && violet<350);
  assert.ok(both>25 && both<120);
});

test('every sky occurrence blends native lighting continuously over the full day',()=>{
  for(const seed of ['visit-0','visit-1','visit-2','visit-3','visit-4','visit-5','visit-6','visit-7']) {
    const choice=skyOccurrence(seed);
    for(const weather of ['rain','clear'] as const) for(let h=0;h<=24;h+=.05) {
      const layers=atmosphereLightingLayers(h,weather,seed,'native');
      assert.equal(layers.length,choice.violetDawn?5:4);
      assert.ok(Math.abs(layers.reduce((v,l)=>v+l.weight,0)-1)<1e-10);
      layers.forEach((layer,i)=>{
        const effective=layer.opacity*layers.slice(i+1).reduce((v,l)=>v*(1-l.opacity),1);
        assert.ok(Math.abs(effective-layer.weight)<1e-10);
      });
      if(h>=8&&h<=17) assert.equal(layers.find(l=>l.look==='day')!.weight,1);
    }
    for(const h of [0,5,5.65,6.45,8,17,18.35,21,24]) {
      const left=atmosphereLightingLayers(h-.00001,'clear',seed,'native');
      const right=atmosphereLightingLayers(h+.00001,'clear',seed,'native');
      left.forEach((l,i)=>assert.ok(Math.abs(l.weight-right[i]!.weight)<.0001));
    }
    const sunrise=atmosphereLightingLayers(6.45,'clear',seed,'native');
    assert.ok(Math.abs(sunrise.find(l=>l.look===choice.sunrise)!.weight-1)<1e-12);
    assert.ok(sunrise.every(l=>!l.nativeClip.endsWith(choice.sunrise==='red'?'-sunrise':'-red')));
    assert.deepEqual(atmosphereLightingLayers(0,'rain',seed,'native'),atmosphereLightingLayers(24,'rain',seed,'native'));
  }
});
