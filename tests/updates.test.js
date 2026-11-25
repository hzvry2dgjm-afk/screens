const test=require('node:test');
const assert=require('node:assert/strict');
const {newer,selectRelease,check,RELEASES}=require('../updates');
const tag='v0.9.2',name='Screens-0.9.2-arm64.dmg',url=`${RELEASES}/download/${tag}/${name}`;
const release={tag_name:tag,assets:[{name,browser_download_url:url}],body:'Fixes'};
test('numeric versions and stable only',()=>{assert(newer('v0.10.0','0.9.9'));assert(!newer('0.9.1','0.9.1'));assert(!newer('v1.0.0-beta','0.9.1'));assert(!newer('0.9.0','0.9.1'));});
test('only compatible official installer',()=>{assert.equal(selectRelease(release,'0.9.1','arm64').url,url);assert.equal(selectRelease(release,'0.9.1','x64'),null);assert.equal(selectRelease({...release,prerelease:true},'0.9.1','arm64'),null);assert.equal(selectRelease({...release,draft:true},'0.9.1','arm64'),null);assert.equal(selectRelease({...release,assets:[{name,browser_download_url:'https://evil.example/file'}]},'0.9.1','arm64'),null);});
test('network handling',async()=>{assert.equal(await check('0.9.1','arm64',async()=>({status:404})),null);await assert.rejects(check('0.9.1','arm64',async()=>({status:403,ok:false})));assert.equal((await check('0.9.1','arm64',async()=>({ok:true,json:async()=>release}))).version,'0.9.2');});
