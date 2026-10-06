const { spawn } = require('child_process');
const http = require('http');

const PORT = 9228;
const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=C:\\Users\\mehme\\AppData\\Local\\Temp\\edge_css_debug'
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
                    if (msg.id === curId) { ws.removeEventListener('message', h); r(msg); }
                };
                ws.addEventListener('message', h);
                ws.send(JSON.stringify({ id: curId, method: m, params: p }));
            });

            await send('Page.enable');
            await send('DOM.enable');
            await send('CSS.enable');
            await send('Page.navigate', { url: 'http://localhost:18888' });
            await new Promise(r => setTimeout(r, 4500));

            // Click settings drawer button
            await send('Runtime.evaluate', { expression: `document.getElementById('settingsDrawerBtn').click()` });
            await new Promise(r => setTimeout(r, 500));

            // Inspect settingsDrawer node styles
            const doc = await send('DOM.getDocument', {});
            const drawerNode = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#settingsDrawer' });
            const matchedDrawer = await send('CSS.getMatchedStylesForNode', { nodeId: drawerNode.result.nodeId });

            console.log('--- MATCHED RULES FOR #settingsDrawer ---');
            for (const rule of matchedDrawer.result.matchedCSSRules) {
                const sel = rule.rule.selectorList.text;
                const decls = rule.rule.style.cssProperties
                    .filter(p => ['visibility', 'display', 'pointer-events', 'transform', 'opacity', 'z-index'].includes(p.name))
                    .map(p => `${p.name}: ${p.value} ${p.important ? '!important' : ''}`);
                if (decls.length > 0) {
                    console.log(`[${sel}] -> ${decls.join('; ')}`);
                }
            }

            // Click commands button
            await send('Runtime.evaluate', { expression: `document.getElementById('openCommandsModalBtn').click()` });
            await new Promise(r => setTimeout(r, 500));

            const modalNode = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#commandsModal' });
            const matchedModal = await send('CSS.getMatchedStylesForNode', { nodeId: modalNode.result.nodeId });

            console.log('\n--- MATCHED RULES FOR #commandsModal ---');
            for (const rule of matchedModal.result.matchedCSSRules) {
                const sel = rule.rule.selectorList.text;
                const decls = rule.rule.style.cssProperties
                    .filter(p => ['visibility', 'display', 'pointer-events', 'transform', 'opacity', 'z-index'].includes(p.name))
                    .map(p => `${p.name}: ${p.value} ${p.important ? '!important' : ''}`);
                if (decls.length > 0) {
                    console.log(`[${sel}] -> ${decls.join('; ')}`);
                }
            }

            const cardNode = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#commandsModal .modal-card' });
            const matchedCard = await send('CSS.getMatchedStylesForNode', { nodeId: cardNode.result.nodeId });

            console.log('\n--- MATCHED RULES FOR #commandsModal .modal-card ---');
            for (const rule of matchedCard.result.matchedCSSRules) {
                const sel = rule.rule.selectorList.text;
                const decls = rule.rule.style.cssProperties
                    .filter(p => ['visibility', 'display', 'pointer-events', 'transform', 'opacity', 'z-index'].includes(p.name))
                    .map(p => `${p.name}: ${p.value} ${p.important ? '!important' : ''}`);
                if (decls.length > 0) {
                    console.log(`[${sel}] -> ${decls.join('; ')}`);
                }
            }

            // Take a screenshot to see what's actually visible on screen!
            const shot = await send('Page.captureScreenshot', { format: 'png' });
            require('fs').writeFileSync('debug_screenshot.png', Buffer.from(shot.result.data, 'base64'));
            console.log('\nScreenshot saved to debug_screenshot.png');

            ws.close();
            edge.kill();
        };
    } catch(e) {
        console.error(e);
        edge.kill();
    }
}, 2500);
