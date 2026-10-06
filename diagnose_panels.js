const { spawn } = require('child_process');
const http = require('http');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9227;
const APP_URL = 'http://localhost:18888';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

class CdpClient {
    constructor(wsUrl) {
        this.ws = new WebSocket(wsUrl);
        this.id = 1;
        this.callbacks = new Map();
        this.consoleLogs = [];
        this.runtimeExceptions = [];

        this.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.method === 'Runtime.consoleAPICalled') {
                this.consoleLogs.push({
                    type: msg.params.type,
                    args: msg.params.args.map(a => a.value || a.description || JSON.stringify(a))
                });
            } else if (msg.method === 'Runtime.exceptionThrown') {
                this.runtimeExceptions.push(msg.params.exceptionDetails);
            }

            if (msg.id && this.callbacks.has(msg.id)) {
                const { resolve, reject } = this.callbacks.get(msg.id);
                this.callbacks.delete(msg.id);
                if (msg.error) reject(msg.error);
                else resolve(msg.result);
            }
        };
    }

    ready() {
        return new Promise((resolve) => {
            if (this.ws.readyState === WebSocket.OPEN) return resolve();
            this.ws.onopen = () => resolve();
        });
    }

    send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = this.id++;
            this.callbacks.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    async evaluate(expression) {
        const res = await this.send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true
        });
        if (res.exceptionDetails) {
            throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
        }
        return res.result ? res.result.value : undefined;
    }
}

async function main() {
    const edge = spawn(EDGE_PATH, [
        '--headless=new',
        `--remote-debugging-port=${PORT}`,
        '--window-size=1920,1080',
        '--user-data-dir=C:\\Users\\mehme\\AppData\\Local\\Temp\\edge_diagnose_prof'
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
        const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
        await cdp.ready();
        await cdp.send('Page.enable');
        await cdp.send('Runtime.enable');

        await cdp.send('Page.navigate', { url: APP_URL });
        console.log('Page navigated, waiting 4.5 seconds for all animations to settle...');
        await sleep(4500);

        // Check 1: Splash screen state
        const splashState = await cdp.evaluate(`(() => {
            const sp = document.getElementById('splashScreen');
            if (!sp) return { exists: false };
            const cs = window.getComputedStyle(sp);
            return {
                display: cs.display,
                visibility: cs.visibility,
                opacity: cs.opacity,
                pointerEvents: cs.pointerEvents,
                zIndex: cs.zIndex,
                classList: Array.from(sp.classList)
            };
        })()`);
        console.log('1. Splash screen state:', JSON.stringify(splashState, null, 2));

        // Check 2: What is elementFromPoint for Komutlar button and Ayarlar button?
        const checkPoints = await cdp.evaluate(`(() => {
            const results = {};
            const btns = ['openCommandsModalBtn', 'settingsDrawerBtn', 'guideBtn', 'leaderboardBtn'];
            for (const id of btns) {
                const el = document.getElementById(id);
                if (!el) { results[id] = { exists: false }; continue; }
                const rect = el.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const top = document.elementFromPoint(cx, cy);
                const all = document.elementsFromPoint(cx, cy).map(e => e.tagName + (e.id ? '#' + e.id : '') + (e.className ? '.' + String(e.className).replace(/\\s+/g, '.') : ''));
                results[id] = {
                    rect,
                    cx, cy,
                    topElement: top ? top.tagName + (top.id ? '#' + top.id : '') + (top.className ? '.' + top.className : '') : null,
                    isCovered: top !== el && !el.contains(top),
                    allStack: all.slice(0, 6)
                };
            }
            return results;
        })()`);
        console.log('2. Button points and coverage:', JSON.stringify(checkPoints, null, 2));

        // Check 3: Directly call openCommandsModal() and inspect commandsModal
        console.log('\n3. Testing openCommandsModal()...');
        const cmdModalTest = await cdp.evaluate(`(async () => {
            const btn = document.getElementById('openCommandsModalBtn');
            // Try clicking the button via .click()
            btn.click();
            await new Promise(r => setTimeout(r, 200));
            const modal = document.getElementById('commandsModal');
            const cs = modal ? window.getComputedStyle(modal) : null;
            const card = modal ? modal.querySelector('.modal-card') : null;
            const cardCs = card ? window.getComputedStyle(card) : null;
            return {
                modalFound: !!modal,
                display: cs ? cs.display : null,
                visibility: cs ? cs.visibility : null,
                opacity: cs ? cs.opacity : null,
                zIndex: cs ? cs.zIndex : null,
                pointerEvents: cs ? cs.pointerEvents : null,
                classList: modal ? Array.from(modal.classList) : [],
                cardDisplay: cardCs ? cardCs.display : null,
                cardVisibility: cardCs ? cardCs.visibility : null,
                cardOpacity: cardCs ? cardCs.opacity : null,
                cardZIndex: cardCs ? cardCs.zIndex : null,
                cardRect: card ? card.getBoundingClientRect() : null
            };
        })()`);
        console.log('Commands modal state after btn.click():', JSON.stringify(cmdModalTest, null, 2));

        // Check 4: Directly call openSettingsDrawer() and inspect settingsDrawer
        console.log('\n4. Testing openSettingsDrawer()...');
        const drawerTest = await cdp.evaluate(`(async () => {
            const btn = document.getElementById('settingsDrawerBtn');
            btn.click();
            await new Promise(r => setTimeout(r, 200));
            const drawer = document.getElementById('settingsDrawer');
            const overlay = document.getElementById('drawerOverlay');
            const cs = drawer ? window.getComputedStyle(drawer) : null;
            const oCs = overlay ? window.getComputedStyle(overlay) : null;
            return {
                drawerFound: !!drawer,
                display: cs ? cs.display : null,
                visibility: cs ? cs.visibility : null,
                opacity: cs ? cs.opacity : null,
                transform: cs ? cs.transform : null,
                zIndex: cs ? cs.zIndex : null,
                pointerEvents: cs ? cs.pointerEvents : null,
                classList: drawer ? Array.from(drawer.classList) : [],
                rect: drawer ? drawer.getBoundingClientRect() : null,
                overlayDisplay: oCs ? oCs.display : null,
                overlayVisibility: oCs ? oCs.visibility : null,
                overlayZIndex: oCs ? oCs.zIndex : null,
                overlayClassList: overlay ? Array.from(overlay.classList) : []
            };
        })()`);
        console.log('Settings drawer state after btn.click():', JSON.stringify(drawerTest, null, 2));

        // Check 5: Look for any matched CSS rules that set visibility: hidden or display: none
        const cssRulesCheck = await cdp.evaluate(`(() => {
            const drawer = document.getElementById('settingsDrawer');
            if (!drawer) return 'no drawer';
            // Check inline style vs computed
            return {
                inlineStyle: drawer.getAttribute('style'),
                computedVisibility: window.getComputedStyle(drawer).visibility,
                computedDisplay: window.getComputedStyle(drawer).display,
                computedOpacity: window.getComputedStyle(drawer).opacity
            };
        })()`);
        console.log('CSS rules check for drawer:', JSON.stringify(cssRulesCheck, null, 2));

        console.log('\nConsole logs:', JSON.stringify(cdp.consoleLogs, null, 2));
        console.log('Runtime exceptions:', JSON.stringify(cdp.runtimeExceptions, null, 2));

    } finally {
        await edge.kill();
    }
}

main().catch(console.error);
