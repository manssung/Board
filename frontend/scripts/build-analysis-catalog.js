const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const { TextDecoder } = require('util');
const root = path.resolve(__dirname, '..');
const brokerSource = fs.readFileSync(path.join(root, 'src/data/brokerMap.js'), 'utf8').replace('export default brokerMap;', 'module.exports = brokerMap;');
const brokerContext = { module: { exports: {} } };
vm.runInNewContext(brokerSource, brokerContext);
const brokerMap = brokerContext.module.exports;
const window = new JSDOM('').window;
const context = {
  brokerMap, DOMParser: window.DOMParser, TextDecoder, AbortController, Map, Promise, setTimeout, clearTimeout,
  process: { env: { PUBLIC_URL: '' } }, console: { ...console, warn: () => {} },
  fetch: async (url) => {
    const buffer = fs.readFileSync(path.join(root, 'public', url));
    return { ok: true, arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) };
  },
};
const source = fs.readFileSync(path.join(root, 'src/util/brokerConditions.js'), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
vm.createContext(context);
vm.runInContext(source, context);
(async () => {
  const catalog = {};
  for (const broker of Object.keys(brokerMap)) catalog[broker] = await context.loadBrokerConditions(broker);
  const directory = path.join(root, 'lib/generated');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'brokerConditions.json'), JSON.stringify(catalog));
  console.log(`Server analysis catalog: ${Object.keys(catalog).length} brokers`);
  window.close();
})().catch((error) => { console.error(error.message); process.exitCode = 1; window.close(); });
