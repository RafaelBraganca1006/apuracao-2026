// Ferramenta de desenvolvimento: captura screenshot do site via DevTools, esperando o mapa terminar de carregar.
// uso: node shot.js <url> <saida.png> [largura] [altura]   (env: NOWAIT=1 (páginas sem mapa), FORMAT=jpeg, EVAL="js a executar antes da captura", AFTER=ms, EXTRA=ms, PROF=dir do perfil)
const { spawn } = require('child_process'), fs = require('fs');
const [url, out, w = 1440, h = 900] = process.argv.slice(2);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--remote-debugging-port=9333', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--hide-scrollbars', `--window-size=${w},${h}`, `--user-data-dir=${process.env.PROF || '/private/tmp/shotprof'}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i++) { try { const j = await (await fetch('http://127.0.0.1:9333/json')).json(); wsUrl = j.find((x) => x.type === 'page')?.webSocketDebuggerUrl; } catch (e) { /* ainda subindo */ } await sleep(250); }
  const sock = new WebSocket(wsUrl); await new Promise((r) => (sock.onopen = r));
  let id = 0; const pend = {};
  const logs = [];
  sock.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; }
    else if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEÇÃO: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) logs.push(m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; sock.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 700 });
  await send('Page.navigate', { url });
  const t0 = Date.now();
  while (!process.env.NOWAIT && Date.now() - t0 < 120000) { if (await ev("document.body && document.body.classList.contains('ready') && window.trackerMap && window.trackerMap.loaded()")) break; await sleep(500); }
  await sleep(+(process.env.EXTRA || 3500));
  if (process.env.EVAL) { await ev(process.env.EVAL); await sleep(+(process.env.AFTER || 2500)); }
  const shot = await send('Page.captureScreenshot', process.env.FORMAT === 'jpeg' ? { format: 'jpeg', quality: 86 } : { format: 'png' });
  fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  if (logs.length) console.log('--- console ---\n' + [...new Set(logs)].join('\n'));
  chrome.kill(); process.exit(0);
})().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
