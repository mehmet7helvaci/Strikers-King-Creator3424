const { spawn } = require('child_process');
const http = require('http');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9226;
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

    async clickAt(x, y) {
        await this.send('Input.dispatchMouseEvent', {
            type: 'mousePressed',
            x: Math.round(x),
            y: Math.round(y),
            button: 'left',
            clickCount: 1
        });
        await sleep(50);
        await this.send('Input.dispatchMouseEvent', {
            type: 'mouseReleased',
            x: Math.round(x),
            y: Math.round(y),
            button: 'left',
            clickCount: 1
        });
    }
}

async function main() {
    console.log('--- Launching Edge with CDP ---');
    const edge = spawn(EDGE_PATH, [
        '--headless=new',
        `--remote-debugging-port=${PORT}`,
        '--window-size=1920,1080',
        '--user-data-dir=C:\\Users\\mehme\\AppData\\Local\\Temp\\edge_inspector_prof'
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
        if (!targets) throw new Error('Could not connect to Edge DevTools');

        const pageTarget = targets.find(t => t.type === 'page') || targets[0];
        const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
        await cdp.ready();
        await cdp.send('Page.enable');
        await cdp.send('Runtime.enable');

        console.log('Navigating to', APP_URL);
        await cdp.send('Page.navigate', { url: APP_URL });
        await sleep(4000); // Wait for splash to fade

        // Check console logs
        console.log('\n--- CONSOLE LOGS & ERRORS SO FAR ---');
        console.log('Logs count:', cdp.consoleLogs.length);
        console.log('Exceptions count:', cdp.runtimeExceptions.length);
        if (cdp.runtimeExceptions.length > 0) {
            console.log(JSON.stringify(cdp.runtimeExceptions, null, 2));
        }

        // Test list of elements and their click stacks
        const testButtons = [
            { id: 'openCommandsModalBtn', targetModal: 'commandsModal', name: 'Komutlar Butonu' },
            { id: 'settingsDrawerBtn', targetModal: 'settingsDrawer', name: 'Ayarlar Butonu' },
            { id: 'guideBtn', targetModal: 'comprehensiveGuideModal', name: 'Rehber Butonu' },
            { id: 'leaderboardBtn', targetModal: 'leaderboardModal', name: 'Sıralama Butonu' },
            { id: 'obsOverlayBtn', targetModal: 'obsLinkModal', name: 'OBS Butonu' },
            { id: 'luckyWheelBtn', targetModal: 'wheelModal', name: 'Çarkıfelek Butonu' },
            { id: 'randomizeBtn', targetModal: 'randomizeAssistModal', name: 'Dağıtıcı Butonu' },
            { id: 'clearBtn', targetModal: 'clearConfirmModal', name: 'İzleyicileri Sıfırla' },
            { id: 'commandActiveBadge', targetModal: 'commandsModal', name: 'Komut Aktif Rozeti' },
            { id: 'poolCommandTag', targetModal: 'commandsModal', name: 'Havuz !turnuvagiriş Rozeti' },
            { id: 'poolCaptainCommandTag', targetModal: 'commandsModal', name: 'Havuz !kaptan Rozeti' },
            { id: 'poolPickCommandTag', targetModal: 'commandsModal', name: 'Havuz !sec Rozeti' }
        ];

        console.log('\n--- TESTING EACH BUTTON VIA REAL CDP MOUSE CLICKS ---');
        for (const item of testButtons) {
            const info = await cdp.evaluate(`(() => {
                const el = document.getElementById('${item.id}');
                if (!el) return { exists: false };
                const rect = el.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const stack = document.elementsFromPoint(cx, cy).map(e => e.tagName + (e.id ? '#' + e.id : '') + (e.className ? '.' + String(e.className).replace(/\\s+/g, '.') : ''));
                const top = document.elementFromPoint(cx, cy);
                return {
                    exists: true,
                    rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
                    cx, cy,
                    topTag: top ? top.tagName + (top.id ? '#' + top.id : '') : null,
                    stack: stack.slice(0, 5),
                    pointerEvents: window.getComputedStyle(el).pointerEvents,
                    display: window.getComputedStyle(el).display,
                    visibility: window.getComputedStyle(el).visibility,
                    opacity: window.getComputedStyle(el).opacity
                };
            })()`);

            console.log(`\nButton: [${item.name}] (#${item.id})`);
            console.log('Position & Stack:', JSON.stringify(info));

            if (!info || !info.exists) {
                console.log(`❌ Element #${item.id} DOES NOT EXIST in DOM!`);
                continue;
            }

            // Click via CDP mouse click at cx, cy
            console.log(`Clicking at (${info.cx}, ${info.cy})...`);
            await cdp.clickAt(info.cx, info.cy);
            await sleep(500);

            // Check target modal state
            const modalState = await cdp.evaluate(`(() => {
                const m = document.getElementById('${item.targetModal}');
                if (!m) return { exists: false };
                const cs = window.getComputedStyle(m);
                return {
                    exists: true,
                    display: cs.display,
                    visibility: cs.visibility,
                    opacity: cs.opacity,
                    classList: Array.from(m.classList),
                    hasHidden: m.classList.contains('hidden'),
                    isOpen: m.classList.contains('open') || (!m.classList.contains('hidden') && cs.display !== 'none')
                };
            })()`);
            console.log(`Modal #${item.targetModal} state after click:`, JSON.stringify(modalState));

            // Close modal/drawer if opened so next test is clean
            await cdp.evaluate(`(() => {
                // Try closing any open modal
                const modals = document.querySelectorAll('.modal-overlay, .settings-drawer');
                modals.forEach(m => {
                    m.classList.add('hidden');
                    m.classList.remove('open');
                    m.style.display = 'none';
                });
                const overlay = document.getElementById('drawerOverlay');
                if (overlay) {
                    overlay.classList.add('hidden');
                    overlay.classList.remove('open');
                    overlay.style.display = 'none';
                }
            })()`);
            await sleep(300);
        }

    } finally {
        await cdp.send('Browser.close').catch(() => {});
        edge.kill();
    }
}

main().catch(console.error);
