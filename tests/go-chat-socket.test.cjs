const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function setup(t){
 const sockets=[],timers=new Set(),intervals=new Set(),exports={};let token='first-token';
 class WS{
  static OPEN=1;static CONNECTING=0;
  constructor(url){this.url=String(url);this.readyState=0;this.sent=[];sockets.push(this)}
  send(raw){this.sent.push(JSON.parse(raw))}
  open(){this.readyState=1;this.onopen?.()}
  receive(event,payload,id){this.onmessage?.({data:JSON.stringify({event,payload,id})})}
  close(){this.readyState=3;this.onclose?.()}
 }
 const code=ts.transpileModule(fs.readFileSync(path.resolve('lib/go-chat-socket.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,WebSocket:WS,URL,Error,Map,Set,JSON,crypto,process:{env:{NEXT_PUBLIC_API_URL:'/api/v1'}},window:{location:{href:'http://student.school.localhost:8091/student/courses'}},setTimeout:(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);fn()},ms);timers.add(id);return id},clearTimeout:id=>{clearTimeout(id);timers.delete(id)},setInterval:(fn,ms)=>{const id=setInterval(fn,ms);intervals.add(id);return id},clearInterval:id=>{clearInterval(id);intervals.delete(id)}});
 const client=exports.createGoChatSocket(callback=>callback({token}));t.after(()=>{client.disconnect();for(const id of timers)clearTimeout(id);for(const id of intervals)clearInterval(id)});
 return {client,sockets,setToken:v=>token=v};
}
test('Go chat authenticates in first frame and waits for server connect',t=>{
 const {client,sockets}=setup(t);let count=0;client.on('connect',()=>count++).connect();const ws=sockets[0];assert.equal(ws.url,'ws://student.school.localhost:8091/api/v1/class-chat/ws');assert(!ws.url.includes('token'));ws.open();assert.deepEqual(ws.sent[0],{event:'auth',token:'first-token'});assert.equal(client.connected,false);ws.receive('connect',{ok:true});assert.equal(client.connected,true);assert.equal(count,1);
});
test('Go chat ACK correlates requests and forwards live messages',async t=>{
 const {client,sockets}=setup(t);client.connect();const ws=sockets[0];ws.open();ws.receive('connect',{ok:true});let result,live;client.on('class:message',value=>live=value);client.volatile.timeout(100).emit('class:join',{classId:'class'},(error,value)=>{assert.equal(error,null);result=value});const frame=ws.sent[1];assert.equal(frame.event,'class:join');ws.receive('ack',{ok:true},'unrelated');assert.equal(result,undefined);ws.receive('ack',{ok:true},frame.id);assert.equal(result.ok,true);ws.receive('class:message',{id:'message'});assert.equal(live.id,'message');
});
test('Go chat disconnect fails pending ACK and token rotation authenticates new connection',t=>{
 const {client,sockets,setToken}=setup(t);client.connect();let ws=sockets[0];ws.open();ws.receive('connect',{ok:true});let error;client.emit('class:message',{},cause=>error=cause);client.disconnect();assert(error);assert.equal(client.connected,false);setToken('rotated');client.connect();ws=sockets[1];ws.open();assert.equal(ws.sent[0].token,'rotated');
});
test('Go chat loses connection then reconnects without buffered duplicate sends',async t=>{
 const {client,sockets,setToken}=setup(t);client.connect();const ws=sockets[0];ws.open();ws.receive('connect',{ok:true});setToken('new');ws.close();await new Promise(resolve=>setTimeout(resolve,550));assert.equal(sockets.length,2);sockets[1].open();assert.equal(sockets[1].sent.length,1);assert.equal(sockets[1].sent[0].token,'new');
});
test('Go chat preserves structured auth errors and bounded acknowledgement timeout',async t=>{
 const {client,sockets}=setup(t);let code;client.on('connect_error',e=>code=e.data.code).connect();const ws=sockets[0];ws.open();ws.receive('connect_error',{code:'AUTH_REQUIRED',message:'Refresh'});assert.equal(code,'AUTH_REQUIRED');ws.receive('connect',{ok:true});const error=await new Promise(resolve=>client.timeout(5).emit('class:join',{},e=>resolve(e)));assert(error);
});
