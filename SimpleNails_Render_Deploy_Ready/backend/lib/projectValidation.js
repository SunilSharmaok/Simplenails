'use strict';
const PACKAGE_PRICES = Object.freeze({
  'Basic - Light edits': 100,
  'Full - Advanced edits': 1000,
  'Custom - specified what customer need': 2000
}); // Amounts in paise: ₹1, ₹10, ₹20.
const SERVICES = new Set([
  'Ghibli Art', 'Photo Editing', 'PDF Editing', 'Cropping & Resizing',
  'Background Removal', 'AI Photo Editing', 'Logo Designing',
  'Youtube Thumbnail', 'Youtube Banner', 'Video Thumbnail',
  'Instagram Photo', 'Poster Designing', 'Creative Design', 'Other'
]);
const UPLOAD_HOSTS = ['ucarecdn.com'];
const PRIVATE_HOST = /(^localhost$|\.localhost$|\.local$|\.internal$|^127\.|^10\.|^192\.168\.|^169\.254\.|^0\.|^\[?::1\]?$|^\[?fc[0-9a-f]{2}:|^\[?fd[0-9a-f]{2}:)/i;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeHttps(value) {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !url.hostname || PRIVATE_HOST.test(url.hostname) ||
        /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) ||
        url.hostname.includes('..') || url.hash) return null;
    return url.href;
  } catch { return null; }
}
function text(value, label, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new Error(`${label} is required (maximum ${max} characters).`);
  }
  return value.trim();
}
function validateProject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid project details.');
  const projectId = text(body.projectId, 'Project ID', 60);
  if (!/^SN-[A-Z0-9-]{8,56}$/.test(projectId)) throw new Error('Invalid project ID.');
  const name = text(body.name, 'Full name', 120);
  const email = text(body.email, 'Email', 254).toLowerCase();
  const mobile = text(body.mobile, 'Mobile', 20);
  const service = text(body.service, 'Service', 80);
  const editingPreferences = text(body.editingPreferences, 'Editing level', 100);
  const message = text(body.message, 'Instructions', 5000);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (!/^\d{10}$/.test(mobile)) throw new Error('Enter a valid 10-digit mobile number.');
  if (!SERVICES.has(service)) throw new Error('Select a valid service.');
  if (!Object.hasOwn(PACKAGE_PRICES, editingPreferences)) throw new Error('Select a valid editing package.');
  if (body.termsAccepted !== true) throw new Error('Accept the terms before making a payment.');
  const rawFiles = body.files === undefined ? [] : body.files;
  const rawLinks = body.links === undefined ? [] : body.links;
  if (!Array.isArray(rawFiles) || !Array.isArray(rawLinks) || rawFiles.length > 15 || rawLinks.length > 15 || rawFiles.length + rawLinks.length > 20 || !rawFiles.length && !rawLinks.length) {
    throw new Error('Add 1–20 attachments (up to 15 files and 15 links).');
  }
  const files = rawFiles.map((file, index) => {
    if (!file || typeof file !== 'object' || Array.isArray(file)) throw new Error(`Invalid file ${index + 1}.`);
    const url = safeHttps(file.url);
    if (!url) throw new Error(`Invalid upload URL for file ${index + 1}.`);
    const parsed = new URL(url);
    // Do not trust arbitrary URLs or a supplied "uploaded" flag as proof of an Uploadcare upload.
    if (!(UPLOAD_HOSTS.includes(parsed.hostname) || /^[a-z0-9-]+\.ucarecd\.net$/.test(parsed.hostname)) || !ID.test(parsed.pathname.split('/')[1] || '')) throw new Error('Uploaded files must have a valid Uploadcare file URL.');
    const name = text(file.name, 'File name', 200);
    const size = Number(file.size || 0);
    if (!Number.isSafeInteger(size) || size < 0 || size > 10 * 1024 * 1024) throw new Error('Each file must be 10 MB or less.');
    return { url, name, size };
  });
  const links = rawLinks.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`Invalid link ${index + 1}.`);
    const url = safeHttps(entry.url);
    if (!url) throw new Error(`Link ${index + 1} must be a public HTTPS URL.`);
    const label = typeof entry.label === 'string' && entry.label.trim() ? text(entry.label, 'Link title', 120) : new URL(url).hostname;
    return { url, label };
  });
  const all = [...files.map(f => f.url), ...links.map(l => l.url)];
  if (new Set(all).size !== all.length) throw new Error('Remove duplicate files or links.');
  return { projectId, name, email, mobile, service, editingPreferences, message,
    files, links, nda: body.nda === true, termsAccepted: true };
}
module.exports = { PACKAGE_PRICES, validateProject, safeHttps };
