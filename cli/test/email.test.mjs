import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

async function harness(t, response = 'success') {
  const dir = mkdtempSync(join(tmpdir(), 'easykol-email-'))
  const requests = []
  const server = createServer(async (req, res) => {
    let raw = ''
    for await (const chunk of req) raw += chunk
    requests.push({ method:req.method, path:req.url, body:raw ? JSON.parse(raw) : undefined, email:req.headers['ek-api-email'] })
    if (response === 'disconnect') return req.socket.destroy()
    res.setHeader('content-type','application/json')
    if (response === 'error') { res.statusCode=503; return res.end('{"message":"unavailable"}') }
    res.end(JSON.stringify({ statusCode:200, error:null, message:'Success', data:{ id:'record-1', submissionState:'ACCEPTED' } }))
  })
  await new Promise((resolve) => server.listen(0,'127.0.0.1',resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  writeFileSync(join(dir,'config.json'), JSON.stringify({ apiKey:'test-only',email:'actor@example.com',apiBase:base }))
  const bodyPath=join(dir,'body.json')
  writeFileSync(bodyPath, JSON.stringify({ email:'recipient@example.com',subject:'Hello',content:'Hi' }))
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); rmSync(dir,{recursive:true,force:true}) })
  const run = (args, stdin) => new Promise((resolve) => {
    const child=spawn(process.execPath,['dist/index.js',...args],{env:{...process.env,EASYKOL_CONFIG_DIR:dir,EASYKOL_API_BASE:base},stdio:['pipe','pipe','pipe']})
    let out='',err=''
    child.stdout.on('data',(v)=>out+=v); child.stderr.on('data',(v)=>err+=v)
    child.stdin.end(stdin)
    child.on('close',(code)=>resolve({code,json:out.trim()?JSON.parse(out):null,err}))
  })
  return {run,requests,bodyPath}
}

test('template writes preserve JSON, auth identity and encoded template ID',async(t)=>{
  const h=await harness(t)
  const body={name:'Collaboration',content:'Hello {{nickname}}\nHi',cc:['team@example.com']}
  const r=await h.run(['email-template-update','--id','tpl/a','--shared','--body-file','-'],JSON.stringify(body))
  assert.equal(r.code,0)
  assert.deepEqual(h.requests,[{method:'PATCH',path:'/external/v1/email/enterprise/templates/tpl%2Fa',body,email:'actor@example.com'}])
})
test('actual send requires explicit flag and makes no request when absent',async(t)=>{
  const h=await harness(t)
  const r=await h.run(['email-send','--body-file',h.bodyPath])
  assert.equal(r.code,6); assert.equal(h.requests.length,0)
})
test('send confirms one delivery and returns its result',async(t)=>{
  const h=await harness(t)
  const r=await h.run(['email-send','--body-file',h.bodyPath,'--confirm-send'])
  assert.equal(r.code,0); assert.equal(r.json.data.id,'record-1')
  assert.equal(h.requests.length,1)
  assert.equal(h.requests[0].body.confirmSend,true)
})
for (const response of ['error','disconnect']) test(`uncertain send (${response}) is never retried`,async(t)=>{
  const h=await harness(t,response)
  const r=await h.run(['email-send','--body-file',h.bodyPath,'--confirm-send'])
  assert.equal(r.code,5); assert.equal(h.requests.length,1)
  assert.match(JSON.stringify(r.json),/do not resend automatically/)
})
test('scheduled change flag is required and allows an authorized clear',async(t)=>{
  const h=await harness(t)
  const args=['email-followups-set','--id','template','--body-file','-']
  assert.equal((await h.run(args,'{"followupEmails":[]}')).code,6)
  assert.equal(h.requests.length,0)
  assert.equal((await h.run([...args,'--confirm-scheduled-changes'],'{"followupEmails":[]}')).code,0)
  assert.deepEqual(h.requests[0].body,{followupEmails:[],confirmScheduledChanges:true})
})
test('result queries and sender configuration use email endpoints',async(t)=>{
  const h=await harness(t)
  for (const args of [
    ['email-record','--id','record-1'],
    ['email-records','--page','2','--page-size','5','--to','a@example.com'],
    ['email-sender-default','--id','sender-1'],
    ['email-sender-limit','--id','sender-1','--body-file','-'],
  ]) assert.equal((await h.run(args,'{"autoEmailDailyLimit":0}')).code,0)
  assert.match(h.requests[1].path,/page=2&pageSize=5&to=a%40example.com/)
  assert.equal(h.requests[2].path,'/external/v1/email/senders/sender-1/default')
  assert.equal(h.requests[3].body.autoEmailDailyLimit,0)
})
test('invalid body causes no network request',async(t)=>{
  const h=await harness(t)
  for(const input of ['[]','null','{bad']) assert.equal((await h.run(['email-template-create','--body-file','-'],input)).code,6)
  assert.equal(h.requests.length,0)
})
