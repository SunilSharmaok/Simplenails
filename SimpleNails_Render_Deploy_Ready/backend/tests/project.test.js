const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { validateProject, safeHttps, PACKAGE_PRICES } = require('../lib/projectValidation');
const { projectConfirmation, contactReceipt } = require('../services/emailService');
const base = () => ({
  projectId: 'SN-TESTPROJECT-12345678', name: 'Jane <Smith>', email: 'Jane@Example.com', mobile: '9876543210',
  service: 'Photo Editing', editingPreferences: 'Full - Advanced edits', message: 'Please crop.',
  files: [{ url: 'https://ucarecdn.com/11111111-2222-4333-8444-555555555555/', name: 'photo.jpg', size: 500 }],
  links: [{ url: 'https://drive.google.com/file/d/test/view', label: 'Reference' }], nda: true, termsAccepted: true
});

test('three-step draft: keeps multiple uploads and links, NDA, correct price', () => {
  const result = validateProject(base());
  assert.equal(result.files.length, 1); assert.equal(result.links.length, 1);
  assert.equal(result.email, 'jane@example.com'); assert.equal(result.nda, true);
  assert.equal(PACKAGE_PRICES[result.editingPreferences], 1000);
});
test('requires valid package and explicit agreement, rejects tampering', () => {
  const body = base(); body.editingPreferences = 'Basic - Light edits + free';
  assert.throws(() => validateProject(body), /valid editing package/);
  body.editingPreferences = 'Basic - Light edits'; body.termsAccepted = false;
  assert.throws(() => validateProject(body), /Accept the terms/);
});
test('link safety: rejects dangerous protocols, credentials, local hosts and duplicate links', () => {
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://localhost/private', 'https://192.168.1.3', 'https://a:b@example.com', 'https://example.com:8080']) {
    assert.equal(safeHttps(url), null, url);
  }
  const body = base(); body.links.push({ ...body.links[0] });
  assert.throws(() => validateProject(body), /duplicate/);
});
test('rejects upload from arbitrary host and oversize uploads', () => {
  const body = base(); body.files[0].url = 'https://example.com/pic.png';
  assert.throws(() => validateProject(body), /Uploadcare/);
  body.files[0].url = base().files[0].url;
  body.files[0].size = 10*1024*1024+1;
  assert.throws(() => validateProject(body), /10 MB/);
});
test('email markup is escaped, full confirmation includes amount and ID', () => {
  const html = projectConfirmation(validateProject(base()), 'pay_example', 1000);
  assert.ok(html.includes('₹10.00')); assert.ok(html.includes('SN-TESTPROJECT-12345678'));
  assert.ok(!html.includes('<Smith>')); assert.ok(html.includes('Jane')); 
  assert.ok(contactReceipt({ name: '<img src=x onerror=alert(1)>', subject: '<script>1</script>' }).includes('&lt;script&gt;'));
});
test('server payment signature cannot be forged', () => {
  const Module = require('module'), original = Module._load;
  try {
    Module._load = function(id, parent, isMain) {
      if (id === 'razorpay') return class Razorpay {};
      if (id === '../config/firebase') return { db: {}, admin: {} };
      return original.apply(this, arguments);
    };
    process.env.RAZORPAY_KEY_SECRET = 'test-key-for-test-only';
    const { validSignature } = require('../controllers/submissionController');
    const orderId = 'order_example', paymentId = 'pay_example';
    const signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(orderId + '|' + paymentId).digest('hex');
    assert.equal(validSignature(orderId, paymentId, signature), true);
    assert.equal(validSignature(orderId, paymentId, '0'.repeat(64)), false);
    assert.equal(validSignature(orderId, paymentId, 'not-hex'), false);
  } finally { Module._load = original; }
});
