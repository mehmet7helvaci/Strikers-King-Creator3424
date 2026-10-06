const { spawn } = require('child_process');
const http = require('http');

const PORT = 9232;
const APP_URL = 'http://localhost:18888';

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

class Cdp {
    constructor(wsUrl) {
        this.ws = new WebSocket(wsUrl);
        this.id = 1;
        this.callbacks = new Map();
        this.ws.onmessage = (e) => {
            const msg = JSON.parse(e.data);
            if (msg.id && this.callbacks.has(msg.id)) {
                const { resolve, reject } = this.callbacks.get(msg.id);
                this.callbacks.delete(msg.id);
                if (msg.error) reject(msg.error);
                else resolve(msg.result);
            }
        };
    }
    ready() {
        return new Promise(res => {
            if (this.ws.readyState === WebSocket.OPEN) return res();
            this.ws.onopen = () => res();
        });
    }
    send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = this.id++;
            this.callbacks.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }
    async eval(expr) {
        const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
        return r.result ? r.result.value : undefined;
    }
}

async function run() {
    const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
        '--headless=new',
        `--remote-debugging-port=${PORT}`,
        '--window-size=1920,1080',
        '--user-data-dir=C:\\Users\\mehme\\AppData\\Local\\Temp\\edge_find_exact_css'
    ]);

    try {
        let targets = null;
        for (let i = 0; i < 20; i++) {
            await sleep(300);
            try {
                targets = await fetchJson(`http://127.0.0.1:${PORT}/json`);
                if (targets && targets.length > 0) break;
            } catch (e) {}
        }
        const pageTarget = targets.find(t => t.type === 'page') || targets[0];
        const cdp = new Cdp(pageTarget.webSocketDebuggerUrl);
        await cdp.ready();
        await cdp.send('Page.enable');
        await cdp.send('DOM.enable');
        await cdp.send('CSS.enable');

        await cdp.send('Page.navigate', { url: APP_URL });
        await sleep(4000);

        // Open settings drawer
        await cdp.eval(`window.openSettingsDrawer()`);
        await sleep(300);

        // Open commands modal
        await cdp.eval(`window.openCommandsModal()`);
        await sleep(300);

        // Check using JS: parent chain visibility for drawer
        const drawerAnalysis = await cdp.eval(`(() => {
            const d = document.getElementById('settingsDrawer');
            const chain = [];
            let curr = d;
            while (curr) {
                const cs = window.getComputedStyle(curr);
                chain.push({
                    tag: curr.tagName,
                    id: curr.id,
                    className: curr.className,
                    visibility: cs.visibility,
                    display: cs.display,
                    pointerEvents: cs.pointerEvents,
                    opacity: cs.opacity
                });
                curr = curr.parentElement;
            }
            return chain;
        })()`);
        console.log('DRAWER PARENT CHAIN:');
        console.log(JSON.stringify(drawerAnalysis, null, 2));

        // Check commands modal card
        const cardAnalysis = await cdp.eval(`(() => {
            const m = document.getElementById('commandsModal');
            const card = m.querySelector('.commands-modal-card');
            const cs = window.getComputedStyle(card);
            const mCs = window.getComputedStyle(m);
            return {
                modal: {
                    visibility: mCs.visibility,
                    display: mCs.display,
                    opacity: mCs.opacity
                },
                card: {
                    visibility: cs.visibility,
                    display: cs.display,
                    opacity: cs.opacity,
                    animationName: cs.animationName,
                    animationDuration: cs.animationDuration,
                    animationPlayState: cs.animationPlayState,
                    animationFillMode: cs.animationFillMode
                }
            };
        })()`);
        console.log('\nCOMMANDS MODAL ANALYSIS:');
        console.log(JSON.stringify(cardAnalysis, null, 2));

        await cdp.send('Browser.close').catch(() => {});
    } finally {
        edge.kill();
    }
}

run().catch(console.error);
