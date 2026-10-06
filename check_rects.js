const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const PORT = 9230;
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
        '--user-data-dir=C:\\Users\\mehme\\AppData\\Local\\Temp\\edge_inspect_rects_9230'
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
        if (!targets) throw new Error('Edge DevTools not available');

        const pageTarget = targets.find(t => t.type === 'page') || targets[0];
        const cdp = new Cdp(pageTarget.webSocketDebuggerUrl);
        await cdp.ready();
        await cdp.send('Page.enable');
        await cdp.send('Runtime.enable');

        await cdp.send('Page.navigate', { url: APP_URL });
        console.log('Navigated, waiting 4.5s for splash screen to dismiss...');
        await sleep(4500);

        // 1. Click openCommandsModalBtn
        console.log('--- Clicking openCommandsModalBtn ---');
        await cdp.eval(`document.getElementById('openCommandsModalBtn').click()`);
        await sleep(600);

        const checkCommands = await cdp.eval(`(() => {
            const m = document.getElementById('commandsModal');
            const c = m ? m.querySelector('.commands-modal-card') : null;
            return {
                mRect: m ? { top: m.getBoundingClientRect().top, left: m.getBoundingClientRect().left, width: m.getBoundingClientRect().width, height: m.getBoundingClientRect().height } : null,
                mStyle: m ? { display: window.getComputedStyle(m).display, opacity: window.getComputedStyle(m).opacity, vis: window.getComputedStyle(m).visibility, zIndex: window.getComputedStyle(m).zIndex } : null,
                cRect: c ? { top: c.getBoundingClientRect().top, left: c.getBoundingClientRect().left, width: c.getBoundingClientRect().width, height: c.getBoundingClientRect().height } : null,
                cStyle: c ? { display: window.getComputedStyle(c).display, opacity: window.getComputedStyle(c).opacity, vis: window.getComputedStyle(c).visibility } : null
            };
        })()`);
        console.log('COMMANDS MODAL RECT & STYLE:', JSON.stringify(checkCommands, null, 2));

        const shotCmd = await cdp.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('screenshot_commands.png', Buffer.from(shotCmd.data, 'base64'));
        console.log('Saved screenshot_commands.png');

        // Close modal
        await cdp.eval(`window.closeCommandsModal()`);
        await sleep(400);

        // 2. Click settingsDrawerBtn
        console.log('--- Clicking settingsDrawerBtn ---');
        await cdp.eval(`document.getElementById('settingsDrawerBtn').click()`);
        await sleep(600);

        const checkDrawer = await cdp.eval(`(() => {
            const d = document.getElementById('settingsDrawer');
            const o = document.getElementById('drawerOverlay');
            return {
                dRect: d ? { top: d.getBoundingClientRect().top, left: d.getBoundingClientRect().left, width: d.getBoundingClientRect().width, height: d.getBoundingClientRect().height } : null,
                dStyle: d ? { display: window.getComputedStyle(d).display, opacity: window.getComputedStyle(d).opacity, vis: window.getComputedStyle(d).visibility, transform: window.getComputedStyle(d).transform, classes: d.className, zIndex: window.getComputedStyle(d).zIndex } : null,
                oRect: o ? { top: o.getBoundingClientRect().top, left: o.getBoundingClientRect().left, width: o.getBoundingClientRect().width, height: o.getBoundingClientRect().height } : null,
                oStyle: o ? { display: window.getComputedStyle(o).display, opacity: window.getComputedStyle(o).opacity, vis: window.getComputedStyle(o).visibility, classes: o.className, zIndex: window.getComputedStyle(o).zIndex } : null
            };
        })()`);
        console.log('SETTINGS DRAWER RECT & STYLE:', JSON.stringify(checkDrawer, null, 2));

        const shotDrawer = await cdp.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('screenshot_drawer.png', Buffer.from(shotDrawer.data, 'base64'));
        console.log('Saved screenshot_drawer.png');

        await cdp.send('Browser.close').catch(() => {});
    } finally {
        edge.kill();
    }
}

run().catch(console.error);
