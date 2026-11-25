const REPO = 'hzvry2dgjm-afk/screens';
const RELEASES = `https://github.com/${REPO}/releases`;
function version(value) {
  const m = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value || '');
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}
function newer(a,b) {
  const x=version(a), y=version(b); if(!x||!y)return false;
  for(let i=0;i<3;i++) if(x[i]!==y[i])return x[i]>y[i];
  return false;
}
function selectRelease(data,current,arch) {
  if(!data || data.draft || data.prerelease || !newer(data.tag_name,current))return null;
  const tag=data.tag_name;
  const name=`Screens-${tag.replace(/^v/,'')}-${arch}.dmg`;
  const url=`${RELEASES}/download/${tag}/${name}`;
  if(!Array.isArray(data.assets)||!data.assets.some(a=>a.name===name&&a.browser_download_url===url))return null;
  return { version:tag.replace(/^v/,''), notes:String(data.body||'').slice(0,4000), url, page:`${RELEASES}/tag/${tag}` };
}
async function check(current,arch,fetcher=fetch) {
  const response=await fetcher(`https://api.github.com/repos/${REPO}/releases/latest`,{headers:{Accept:'application/vnd.github+json','User-Agent':'Screens'},signal:AbortSignal.timeout(10000),redirect:'error'});
  if(response.status===404)return null;
  if(!response.ok)throw Error(`Update service returned ${response.status}`);
  return selectRelease(await response.json(),current,arch);
}
module.exports={RELEASES,version,newer,selectRelease,check};
