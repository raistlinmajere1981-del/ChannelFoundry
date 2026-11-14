import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {siteSceneSource} from '../scene-workshop-site.mjs';
import {defaultLanguageSwitchLayout,validateLanguageSwitchLayout,languageSwitchStyle} from '../../../packages/effect-engine/src/model/language-switch-layout.mjs';
import {validateScenePresentation} from '../../../packages/effect-engine/src/model/scene-presentation.mjs';

test('language switch geometry and touch ranges are strict, styling never injects scripts',()=>{
 const defaults=defaultLanguageSwitchLayout();
 assert.equal(validateLanguageSwitchLayout(defaults),defaults);
 assert.equal(languageSwitchStyle(defaults)['--switch-mobile-bottom'],'28px');
 const modified=structuredClone(defaults);
 modified.mobile.hitHeight=.75;
 assert.throws(()=>validateLanguageSwitchLayout(modified),/mobile.hitHeight/);
 modified.mobile.hitHeight=1;
 modified.mobile.bottom=0;
 assert.throws(()=>validateLanguageSwitchLayout(modified),/mobile.bottom/);
 modified.mobile.bottom=28;
 modified.desktop.skew=75;
 assert.throws(()=>validateLanguageSwitchLayout(modified),/desktop.skew/);
 modified.desktop.skew=-23;
 modified.desktop.x='calc(1px * 50)';
 assert.throws(()=>validateLanguageSwitchLayout(modified),/desktop.x/);
 modified.desktop.x=22;
 modified.desktop.novelEffect=1;
 assert.throws(()=>validateLanguageSwitchLayout(modified),/kontrolleri eksik/);
});

test('Studio language switch stage updates only validated presentation in isolated site clone',async()=>{
 const real=siteSceneSource(),source=await real.snapshot();
 const root=mkdtempSync(join(tmpdir(),'studio-language-switch-'));
 try{
  for(const [file,bytes] of source.entries){
   const target=join(root,file);
   mkdirSync(dirname(target),{recursive:true});
   writeFileSync(target,bytes);
  }
  const isolated=siteSceneSource(root),before=await isolated.snapshot();
  const originalScene=readFileSync(join(root,'src/effects/birdesengor-effects.v2.json'));
  const presentation=structuredClone(before.presentation);
  presentation.controls.languageSwitch.desktop.x=24.5;
  presentation.controls.languageSwitch.desktop.plateScale=1.67;
  presentation.controls.languageSwitch.desktop.skew=-47;
  presentation.controls.languageSwitch.mobile.plateScale=1.53;
  presentation.objects.camera.roomPlacement={x:.783,y:.742,scale:1.18};
  presentation.objects['vefk-stand'].roomPlacement={x:.742,y:.525,scale:.89};
  presentation.controls.languageSwitch.mobile.bottom=39;
  presentation.controls.languageSwitch.mobile.hitWidth=1.2;
  assert.equal(validateScenePresentation(presentation),presentation);
  assert.equal(isolated.readiness(before.scene,before,presentation).ready,true);
  const prepared=await isolated.stage(before.scene,before.sourceHash,[],presentation);
  assert.equal(prepared.changed,true);
  assert.deepEqual(prepared.changedFiles,['src/scene/data/scene-presentation.v1.json']);
  assert.deepEqual(readFileSync(join(root,'src/effects/birdesengor-effects.v2.json')),originalScene);
  const after=await isolated.snapshot();
  assert.equal(after.presentation.controls.languageSwitch.desktop.x,24.5);
  assert.equal(after.presentation.controls.languageSwitch.desktop.plateScale,1.67);
  assert.equal(after.presentation.controls.languageSwitch.desktop.skew,-47);
  assert.equal(after.presentation.controls.languageSwitch.mobile.plateScale,1.53);
  assert.deepEqual(after.presentation.objects.camera.roomPlacement,{x:.783,y:.742,scale:1.18});
  assert.deepEqual(after.presentation.objects['vefk-stand'].roomPlacement,{x:.742,y:.525,scale:.89});
  assert.equal(after.presentation.controls.languageSwitch.mobile.bottom,39);
  assert.equal(after.presentation.controls.languageSwitch.mobile.hitWidth,1.2);
  await assert.rejects(()=>isolated.stage(before.scene,before.sourceHash,[],presentation),/kaynağı değişmiş/);
  const untrusted=structuredClone(presentation);
  untrusted.controls.languageSwitch.mobile.hitWidth=.5;
  assert.throws(()=>isolated.validate(before.scene,after,untrusted),/mobile.hitWidth/);
  const realAfter=await real.snapshot();
  assert.equal(realAfter.sourceHash,source.sourceHash,'real website content and layout unchanged');
 }finally{rmSync(root,{recursive:true,force:true});}
});
