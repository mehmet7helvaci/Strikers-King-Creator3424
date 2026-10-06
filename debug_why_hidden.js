const { spawn } = require('child_process');
const http = require('http');

const PORT = 9231;
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
        '--user-data-dir=C:\\Users\\mehme\\AppData\\Local\\Temp\\edge_debug_why_hidden'
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
        console.log('Navigated, waiting 4.5s...');
        await sleep(4500);

        const debugResult = await cdp.eval(`(() => {
            // Dismiss splash if still there
            const sp = document.getElementById('splashScreen');
            if (sp) { sp.classList.add('hidden'); sp.style.display = 'none'; sp.style.pointerEvents = 'none'; }

            // 1. Check Drawer BEFORE opening
            const d = document.getElementById('settingsDrawer');
            const o = document.getElementById('drawerOverlay');

            const beforeDrawer = {
                classes: d ? d.className : null,
                styleAttr: d ? d.getAttribute('style') : null,
                display: d ? window.getComputedStyle(d).display : null,
                visibility: d ? window.getComputedStyle(d).visibility : null,
                pointerEvents: d ? window.getComputedStyle(d).pointerEvents : null,
                opacity: d ? window.getComputedStyle(d).opacity : null,
                transform: d ? window.getComputedStyle(d).transform : null
            };

            // Call openSettingsDrawer
            if (window.openSettingsDrawer) window.openSettingsDrawer('music');

            const afterDrawer = {
                classes: d ? d.className : null,
                styleAttr: d ? d.getAttribute('style') : null,
                display: d ? window.getComputedStyle(d).display : null,
                visibility: d ? window.getComputedStyle(d).visibility : null,
                pointerEvents: d ? window.getComputedStyle(d).pointerEvents : null,
                opacity: d ? window.getComputedStyle(d).opacity : null,
                transform: d ? window.getComputedStyle(d).transform : null,
                rect: d ? d.getBoundingClientRect() : null
            };

            const afterOverlay = {
                classes: o ? o.className : null,
                styleAttr: o ? o.getAttribute('style') : null,
                display: o ? window.getComputedStyle(o).display : null,
                visibility: o ? window.getComputedStyle(o).visibility : null,
                pointerEvents: o ? window.getComputedStyle(o).pointerEvents : null,
                opacity: o ? window.getComputedStyle(o).opacity : null,
                rect: o ? o.getBoundingClientRect() : null
            };

            // Find all matching CSS rules in document.styleSheets for #settingsDrawer and .settings-drawer
            const matchedDrawerRules = [];
            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules) {
                        if (rule.selectorText && (rule.selectorText.includes('settings-drawer') || rule.selectorText.includes('drawer-overlay'))) {
                            matchedDrawerRules.push({
                                selector: rule.selectorText,
                                cssText: rule.cssText
                            });
                        }
                    }
                } catch(e) {}
            }

            // 2. Commands Modal
            const cm = document.getElementById('commandsModal');
            const card = cm ? cm.querySelector('.commands-modal-card') : null;

            const beforeCommands = {
                classes: cm ? cm.className : null,
                styleAttr: cm ? cm.getAttribute('style') : null,
                display: cm ? window.getComputedStyle(cm).display : null,
                visibility: cm ? window.getComputedStyle(cm).visibility : null,
                opacity: cm ? window.getComputedStyle(cm).opacity : null,
                cardOpacity: card ? window.getComputedStyle(card).opacity : null
            };

            if (window.openCommandsModal) window.openCommandsModal();

            const afterCommands = {
                classes: cm ? cm.className : null,
                styleAttr: cm ? cm.getAttribute('style') : null,
                display: cm ? window.getComputedStyle(cm).display : null,
                visibility: cm ? window.getComputedStyle(cm).visibility : null,
                opacity: cm ? window.getComputedStyle(cm).opacity : null,
                pointerEvents: cm ? window.getComputedStyle(cm).pointerEvents : null,
                zIndex: cm ? window.getComputedStyle(cm).zIndex : null,
                rect: cm ? cm.getBoundingClientRect() : null,
                cardOpacity: card ? window.getComputedStyle(card).opacity : null,
                cardDisplay: card ? window.getComputedStyle(card).display : null,
                cardVisibility: card ? window.getComputedStyle(card).visibility : null,
                cardTransform: card ? window.getComputedStyle(card).transform : null,
                cardRect: card ? card.getBoundingClientRect() : null
            };

            return {
                beforeDrawer,
                afterDrawer,
                afterOverlay,
                matchedDrawerRules,
                beforeCommands,
                afterCommands
            };
        })()`);

        console.log('RESULTS:');
        console.log(JSON.stringify(debugResult, null, 2));

        await cdp.send('Browser.close').catch(() => {});
    } finally {
        edge.kill();
    }
}

run().catch(console.error);
