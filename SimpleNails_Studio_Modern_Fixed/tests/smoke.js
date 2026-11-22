/* Offline smoke checks. Run: node tests/smoke.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const path = require('node:path');
const root = path.join(__dirname, '..');
function loadJs(relative, modules, additions={}) {
  const code=fs.readFileSync(path.join(root,relative),'utf8');
  const context={module:{exports:{}},require:(name)=>{if(name in modules)return modules[name];throw new Error(`Missing mock: ${name}`);}, process:{env:{}},console,Buffer,URL,fetch:additions.fetch,...additions};
  vm.runInNewContext(code,context,{filename:relative});
  return {exports:context.module.exports,context};
}
function response() {const out={statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(data){this.body=data;return this;}};return out;}
async function main(){
  for(const page of ['index.html','project.html','contact.html','submissions.html']){
    const html=fs.readFileSync(path.join(root,'frontend',page),'utf8');
    assert.match(html, /modern\.css/);assert.match(html,/js\/modern\.js/);assert.match(html,/id="main-content"/);
    assert.match(html,/class="theme-switch"/);assert.match(html,/SimpleNails/);
    for(const [,relative] of html.matchAll(/(?:href|src)="((?:js\/|assets\/)[^"?#]+)"/g))assert.ok(fs.existsSync(path.join(root,'frontend',relative)),`${page}: ${relative}`);
  }
  const home=fs.readFileSync(path.join(root,'frontend/index.html'),'utf8');
  assert.match(home,/id="compare-range"/); assert.match(home,/id="estimate-plan"/); assert.match(home,/id="services"/);
  const api=fs.readFileSync(path.join(root,'backend/controllers/paymentController.js'),'utf8');
  assert.match(api,/return 100;/);assert.match(api,/return 1000;/);assert.match(api,/return 2000;/);
  // Email failures are non-fatal; DB writes should still return success.
  let stored=false;
  const contact=loadJs('backend/controllers/contactController.js',{
    '../config/firebase':{db:{collection:()=>({add:async()=>{stored=true;}})},admin:{firestore:{FieldValue:{serverTimestamp:()=>Date.now()}}}},
    '../services/emailService':{sendBrevoEmail:async()=>({sent:false})}
  }).exports;
  const result=response();await contact.createContact({body:{name:'Test User',email:'test@example.com',subject:'Hello',message:'Test message'}},result);
  assert.equal(result.statusCode,201);assert.equal(result.body.success,true);assert.equal(result.body.emailSent,false);assert.equal(stored,true);
  // A duplicate checkout POST for an already-saved payment must recover without recharging.
  const orderId='order_test',paymentId='pay_test',secret='test-secret';
  const signature=crypto.createHmac('sha256',secret).update(`${orderId}|${paymentId}`).digest('hex');
  const submissions=loadJs('backend/controllers/submissionController.js',{
    crypto,
    '../config/firebase':{db:{collection:(name)=>({doc:()=>({get:async()=>({exists:true,data:()=>({uid:'user-1',projectId:'PRJ-1',status:'submitted',paymentId,submissionId:'SUBMISSION-1'})})})})},admin:{}},
    '../services/emailService':{sendBrevoEmail:async()=>({sent:false})},
    razorpay:class Razorpay {}
  },{process:{env:{RAZORPAY_KEY_SECRET:secret}},Buffer,URL}).exports;
  const response2=response();
  await submissions.create({user:{uid:'user-1'},body:{projectId:'PRJ-1',name:'Test User',email:'test@example.com',mobile:'9876543210',service:'Photo Editing',editingPreferences:'Basic - Light edits',message:'Small edit',fileUrl:'https://ucarecdn.com/example/photo.jpg',payment:{razorpay_order_id:orderId,razorpay_payment_id:paymentId,razorpay_signature:signature}}},response2);
  assert.equal(response2.statusCode,200);assert.equal(response2.body.success,true);assert.equal(response2.body.recovered,true);
  // Rejected email-provider fetches are handled without propagating an API exception.
  const email=loadJs('backend/services/emailService.js',{}, {process:{env:{BREVO_API_KEY:'fake-test-key',BREVO_SENDER_EMAIL:'sender@example.com'}},fetch:async()=>{throw new Error('offline')}}).exports;
  const delivery=await email.sendBrevoEmail({to:'recipient@example.com',subject:'Test',htmlContent:'Hi'});
  assert.equal(delivery.sent,false);
  console.log('PASS: four pages have assets, navigation and new UI hooks');
  console.log('PASS: checkout package amounts match ₹1 / ₹10 / ₹20');
  console.log('PASS: contact form save survives missing email notification');
  console.log('PASS: repeat paid project saves recover idempotently');
  console.log('PASS: email provider network failures do not throw');
}
main().catch(error=>{console.error('FAIL',error);process.exitCode=1;});
