#!/usr/bin/env node
// Restricted public-data runner. No upstream code or third-party modules execute.
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { openSync, readSync, closeSync, fstatSync, constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve as resolvePath } from 'node:path';

const MAX = 1_048_576;
export function publicAddress(address) {
  if (isIP(address) === 4) {
    const [a,b] = address.split('.').map(Number);
    return !(a===0 || a===10 || a===127 || a>=224 || (a===169&&b===254) ||
      (a===172&&b>=16&&b<=31) || (a===192&&(b===168||b===0||b===2||(b===88&&address.split('.')[2]==='99'))) ||
      (a===100&&b>=64&&b<=127) || (a===198&&(b===18||b===19||b===51)) || (a===203&&b===0));
  }
  // Deliberately conservative: support public IPv4 only in this first version.
  return false;
}
export function validateURL(raw) {
  if (typeof raw !== 'string' || raw.length > 4096) throw Error('Invalid URL');
  const u = new URL(raw);
  if(raw!==u.href)throw Error('URL must already be canonical; no normalization allowed');
  if (u.protocol !== 'https:' || u.username || u.password || u.hash || (u.port && u.port!=='443'))
    throw Error('HTTPS on port 443 only; credentials and fragments are forbidden');
  if (u.hostname.endsWith('.')) throw Error('Trailing-dot hostname forbidden');
  if (isIP(u.hostname) || !u.hostname.includes('.') || /(^|\.)(localhost|local|internal|test|invalid)$/i.test(u.hostname))
    throw Error('Public DNS hostname required');
  if (/%(?:00|0a|0d)/i.test(u.href)) throw Error('Control characters forbidden');
  if ([...u.searchParams.keys()].some(k=>/token|secret|password|session|auth|api.?key|cookie/i.test(k)))
    throw Error('Credential-like query parameter forbidden');
  return u;
}
export function prepare(spec, policy, network=false) {
  if (!network) throw Error('Offline by default: explicit network opt-in required');
  if (!spec || typeof spec!=='object' || Object.keys(spec).some(k=>!['url','method'].includes(k)))
    throw Error('Only a literal URL and GET/HEAD method are supported');
  const method = (spec.method || 'GET').toUpperCase();
  if (!['GET','HEAD'].includes(method)) throw Error('Writes disabled, including mislabeled POST reads');
  const url = validateURL(spec.url);
  if (!policy || !Array.isArray(policy.allowed) || policy.allowed.length>100 ||
      !policy.allowed.some(p=>p && p.method===method && p.url===url.href))
    throw Error('Exact URL and method must be independently reviewed and listed in policy.allowed');
  return {url,method};
}
export async function resolvePublic(hostname, resolver=lookup) {
  let timer;
  const addresses=await Promise.race([resolver(hostname,{all:true,verbatim:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('DNS deadline exceeded')),5_000)})]).finally(()=>clearTimeout(timer));
  if (!addresses.length || addresses.some(a=>!publicAddress(a.address))) throw Error('Non-public or unsupported DNS result');
  return addresses[0];
}
export function receive(res, resolve, reject, max=MAX) {
  const fail=e=>{res.destroy();reject(e)};
  if (res.statusCode>=300 && res.statusCode<400) return fail(Error('Redirects disabled, including same-origin redirects'));
  if (res.headers['content-encoding'] && res.headers['content-encoding']!=='identity') return fail(Error('Compressed response refused'));
  if (Number(res.headers['content-length'] || 0)>max) return fail(Error('Response exceeds byte limit'));
  let size=0,failed=false;const chunks=[];
  res.on('data',c=>{if(failed)return;size+=c.length;if(size>max){failed=true;return fail(Error('Response exceeds byte limit'))}chunks.push(c)});
  res.on('error',reject);
  res.on('aborted',()=>reject(Error('Response aborted')));
  res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')}));
}
export async function run(spec,policy,{network=false,resolver=lookup,transport=https.request}={}) {
  const {url,method}=prepare(spec,policy,network);
  const pin=await resolvePublic(url.hostname,resolver);
  return await new Promise((resolve,reject)=>{
    const req=transport(url,{method,headers:{accept:'application/json,text/plain','accept-encoding':'identity'},
      // The address checked above is the address used by TLS. Hostname verification remains on.
      lookup:(_host,opts,cb)=>opts.all?cb(null,[pin]):cb(null,pin.address,pin.family),agent:false,rejectUnauthorized:true},res=>receive(res,resolve,reject));
    const timer=setTimeout(()=>req.destroy(Error('Total request deadline exceeded')),10_000);
    req.on('error',reject);req.on('close',()=>clearTimeout(timer));req.end();
  });
}
function jsonFile(path) {
  if (!path) throw Error('Missing JSON file');
  const fd=openSync(path,constants.O_RDONLY|constants.O_NONBLOCK|constants.O_NOFOLLOW);const b=Buffer.alloc(65_537);let n=0;
  try {if(!fstatSync(fd).isFile())throw Error('Regular JSON file required');while(n<b.length){const k=readSync(fd,b,n,b.length-n,null);if(!k)break;n+=k}}finally{closeSync(fd)}
  if(n>65_536)throw Error('JSON file exceeds 64 KiB');
  return JSON.parse(b.subarray(0,n).toString('utf8'));
}
export async function main(args) {
  if (args[0]==='--help' || args.length===0) {
    console.log('Restricted public-data runner. Usage: api-anything spec.json policy.json --network\nNo login, credentials, browser, writes, healing or redirects. Review GET semantics before allowing.');return;
  }
  if(args.length!==3 || args[2]!=='--network') throw Error('Usage: api-anything spec.json policy.json --network');
  const result=await run(jsonFile(args[0]),jsonFile(args[1]),{network:true});
  console.log(JSON.stringify(result));
}
if(process.argv[1] && fileURLToPath(import.meta.url)===resolvePath(process.argv[1])) {
  main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1});
}
