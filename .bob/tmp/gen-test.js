const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const values = {};
for (const m of html.matchAll(/<input id="(\w+)" value="([^"]*)"/g)) values[m[1]] = m[2].replace(/&lt;/g, '<').replace(/&gt;/g, '>');
for (const m of html.matchAll(/<textarea id="(\w+)"[^>]*>([\s\S]*?)<\/textarea>/g)) values[m[1]] = m[2];
// decodeEntities
for (const k in values) values[k] = values[k].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const mk = () => ({ classList: { toggle() {} }, style: {}, addEventListener() {}, textContent: '', disabled: false });
const els = {};
const listeners = {};
const document = {
  querySelectorAll: s => s === '.wizard-step' ? [{ classList: { toggle() {} }, querySelectorAll: () => [] }] : [],
  getElementById: id => (els[id] ??= Object.assign(mk(), { value: values[id] ?? '' })),
  createElement: () => ({ click() {}, remove() {} }),
  body: { appendChild() {} }
};
const window = {};
const ctx = { window, document, atob: s => Buffer.from(s, 'base64').toString('binary'), URL: { createObjectURL: () => '', revokeObjectURL() {} }, setTimeout, clearTimeout, setImmediate, clearImmediate, console, Buffer, TextEncoder, TextDecoder, Uint8Array, Blob };
vm.createContext(ctx);
ctx.self = ctx; ctx.globalThis = ctx;
vm.runInContext(fs.readFileSync(path.join(root, 'assets/docx.umd.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/logo.js'), 'utf8'), ctx);
window.docx = ctx.docx; window.SYNAPXE_LOGO = window.SYNAPXE_LOGO || ctx.window.SYNAPXE_LOGO;
const d = ctx.docx;
d.Packer.toBlob = async doc => { const buf = await d.Packer.toBuffer(doc); fs.writeFileSync(path.join(root, '.bob/tmp/test-output.docx'), buf); return new Blob([buf]); };
els.wizardForm = Object.assign(mk(), { addEventListener: (e, f) => (listeners[e] = f) });
els.status = mk();
vm.runInContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), ctx);
listeners.submit({ preventDefault() {} });
setTimeout(() => console.log('status:', els.status.className, '|', els.status.textContent), 1500);



