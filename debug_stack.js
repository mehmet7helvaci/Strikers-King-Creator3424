const { spawn } = require('child_process');
const http = require('http');

const PORT = 9225;
const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--window-size=1920,1080',
    '--user-data-dir=C:\\Users\\mehme\\AppData\\Local\\Temp\\edge_point_check'
]);

setTimeout(async () => {
    try {
        const raw = await new Promise((res, rej) => {
            http.get('http://127.0.0.1:' + PORT + '/json', r => {
                let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
            }).on('error', rej);
        });
        const page = raw[0];
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        ws.onopen = async () => {
            let id = 1;
            const send = (m, p) => new Promise(r => {
                const curId = id++;
                const h = (ev) => {
                    const msg = JSON.parse(ev.data);
                    if (msg.id === curId) { ws.removeEventListener('message', h); r(msg.result); }
                };
                ws.addEventListener('message', h);
                ws.send(JSON.stringify({ id: curId, method: m, params: p }));
            });
            await send('Page.navigate', { url: 'http://localhost:18888' });
            await new Promise(r => setTimeout(r, 4000));
            
            const btnIds = ['luckyWheelBtn', 'randomizeBtn', 'clearBtn', 'openCommandsModalBtn', 'settingsDrawerBtn', 'guideBtn', 'leaderboardBtn'];
            const res = {};
            for (const bId of btnIds) {
                const evalRes = await send('Runtime.evaluate', {
                    expression: `(() => {
                        const btn = document.getElementById('${bId}');
                        if (!btn) return { exists: false };
                        const rect = btn.getBoundingClientRect();
                        const cx = rect.left + rect.width / 2;
                        const cy = rect.top + rect.height / 2;
                        const stack = document.elementsFromPoint(cx, cy).map(e => e.tagName + (e.id ? '#' + e.id : '') + (e.className ? '.' + String(e.className).replace(/\\s+/g, '.') : ''));
                        return {
                            rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
                            cx, cy,
                            stack,
                            pointerEvents: window.getComputedStyle(btn).pointerEvents,
                            opacity: window.getComputedStyle(btn).opacity,
                            display: window.getComputedStyle(btn).display,
                            visibility: window.getComputedStyle(btn).visibility
                        };
                    })()`,
                    returnByValue: true
                });
                res[bId] = evalRes.result ? evalRes.result.value : null;
            }
            console.log('RESULTS AT 1920x1080:');
            console.log(JSON.stringify(res, null, 2));

            ws.close();
            edge.kill();
        };
    } catch(e) {
        console.error(e);
        edge.kill();
    }
}, 2000);
