const test=require('node:test');const assert=require('node:assert/strict');
const {normalizeConfig,resolveAssignments}=require('../display-config');
const d=(id,name)=>({id,name,width:1920,height:1080});
test('restores exact assignments independent of display order',()=>{const a=d('1','Operator'),b=d('2','Stage'),c=d('3','Congregation');assert.deepEqual(resolveAssignments(normalizeConfig({assignments:{operator:a,stage:b,congregation:c}}),[c,a,b]),{operator:'1',stage:'2',congregation:'3'});});
test('recovers uniquely named display with changed ID; leaves missing output unassigned',()=>{const a=d('1','Operator'),b=d('2','Stage');assert.deepEqual(resolveAssignments(normalizeConfig({assignments:{operator:a,stage:b,congregation:d('3','Projector')}}),[a,d('9','Stage')]),{operator:'1',stage:'9'});});
test('ambiguous identical displays do not get guessed',()=>{const c=normalizeConfig({assignments:{stage:d('2','TV')}});assert.deepEqual(resolveAssignments(c,[d('8','TV'),d('9','TV')]),{});});
test('clock defaults and bounds are valid',()=>{assert.equal(normalizeConfig().clock.enabled,true);assert.equal(normalizeConfig({clock:{size:999,format:'24',enabled:false}}).clock.size,6);assert.equal(normalizeConfig({clock:{enabled:false}}).clock.enabled,false);});
test('does not take a display reserved by another saved role',()=>{const c=normalizeConfig({assignments:{stage:d('2','TV'),congregation:d('3','TV')}});assert.deepEqual(resolveAssignments(c,[d('3','TV')]),{congregation:'3'});});
