'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'upload-fix.js'), 'utf8');
const id1 = '11111111-2222-4333-8444-555555555555';
const id2 = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
function harness() {
  const calls = [];
  const elements = {};
  function el(id) {
    return elements[id] ||= {
      id, value: '', dataset: { publicKey: 'demo-public' }, disabled: false, children: [],
      classList: { toggle() {}, add() {}, remove() {} },
      style: {},
      setAttribute() {}, addEventListener(name, fn) { this[name] = fn; },
      append(...args) { this.children.push(...args); },
      prepend(...args) { this.children.unshift(...args); },
      replaceChildren(...args) { this.children = args; },
      focus() {}
    };
  }
  let uploads = 0;
  const context = vm.createContext({
    window: { SIMPLENAILS_UPLOADCARE_CDN_BASE: 'https://ucarecdn.com/', location: {} },
    auth: { currentUser: { uid:'test_user' } },
    document: { getElementById: el, createElement: () => el('generated_'+(Object.keys(elements).length+1)), querySelectorAll:()=>[] },
    URL, AbortController, File, FormData, console,
    fetch: async (url, options) => {
      calls.push({url, options});
      if (url.endsWith('/base/')) return { ok:true, json:async()=>({file:uploads++ ? id2 : id1}) };
      if (url.endsWith('/info/')) return { ok:true, json:async()=>({original_file_url:`https://ucarecdn.com/${uploads===1 ? id1 : id2}/`}) };
      throw new Error('Unexpected request');
    },
    showAlert: () => {}, showLoginRequiredPopup: () => {},
    updateAmountDisplay:()=>{}, updateProgressSteps:()=>{},
    generateProjectId:()=> 'SN-TEST-12345678',
    currentAmount: 0, currentSubmissionId: null,
    sessionStorage: {getItem:()=>null, setItem(){}, removeItem(){} },
    setTimeout:() => {},
  });
  vm.runInContext(code, context);
  return { context, calls, elements, el };
}
test('two selected files upload via supported Uploadcare API and persist separately', async () => {
  const {context,calls,el} = harness();
  await vm.runInContext('snUploadFiles',context)([
    new File(['test'], 'photo.png', {type:'image/png'}),
    new File(['hello'], 'document.jpg', {type:'image/jpeg'})
  ]);
  assert.equal(vm.runInContext('snFiles.length',context),2);
  assert.equal(calls.filter(x=>x.url.endsWith('/base/')).length,2);
  assert.equal(el('file_hidden').value,`https://ucarecdn.com/${id1}/`);
  assert.match(el('upload-status').textContent,/2 file\(s\) uploaded successfully/);
  assert.equal(vm.runInContext('validateStep("2")',context),true);
});
test('oversized file is rejected without sending network request',async()=>{
  const {context,calls,el} = harness();
  await vm.runInContext('snUploadFiles', context)([new File([new Uint8Array(11 * 1024 * 1024)], 'too-large.jpg')]);
  assert.equal(calls.length,0);
  assert.equal(vm.runInContext('snFiles.length',context),0);
  assert.match(el('upload-status').textContent,/no more than 10 MB/);
  assert.equal(vm.runInContext('validateStep("2")',context),false);
});
test('user can remove one uploaded file while retaining the other',async()=>{
  const {context,el} = harness();
  await vm.runInContext('snUploadFiles',context)([new File(['a'],'one.png'),new File(['b'],'two.png')]);
  vm.runInContext('snFiles.splice(0,1); snRenderFiles()',context);
  assert.equal(vm.runInContext('snFiles.length',context),1);
  assert.equal(el('file_hidden').value,`https://ucarecdn.com/${id2}/`);
});
test('cloud link is appended, never mistaken for an actual Uploadcare upload', async()=>{
  const {context} = harness();
  assert.equal(vm.runInContext('snAddManualLink("https://drive.google.com/file/d/example/view")',context),true);
  assert.equal(vm.runInContext('snLinks.length',context),1);
  assert.equal(vm.runInContext('snFiles.length',context),0);
  assert.equal(vm.runInContext('validateStep("2")',context),true);
});
