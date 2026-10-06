const { spawn } = require('child_process');
const http = require('http');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9223;
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
        this.events = [];
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
    console.log('Starting Edge for debugging...');
    const edge = spawn(EDGE_PATH, [
        '--headless=new',
        `--remote-debugging-port=${PORT}`,
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=C:\\Users\\mehme\\AppData\\Local\\Temp\\edge_debug_profile'
    ]);

    await sleep(2000);
    const targets = await fetchJson(`http://127.0.0.1:${PORT}/json`);
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await cdp.ready();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    console.log('Navigating to', APP_URL);
    await cdp.send('Page.navigate', { url: APP_URL });

    // Wait 5 seconds to let scripts run and splash screen fade
    console.log('Waiting 5 seconds...');
    await sleep(5000);

    console.log('--- CONSOLE LOGS ---');
    console.log(JSON.stringify(cdp.consoleLogs, null, 2));

    console.log('--- EXCEPTIONS ---');
    console.log(JSON.stringify(cdp.runtimeExceptions, null, 2));

    const checkDom = await cdp.evaluate(`(() => {
        const buttons = [
            'openCommandsModalBtn',
            'settingsDrawerBtn',
            'guideBtn',
            'leaderboardBtn',
            'luckyWheelBtn',
            'randomizeBtn',
            'clearBtn'
        ];
        const status = {};
        for (const id of buttons) {
            const el = document.getElementById(id);
            if (!el) {
                status[id] = { exists: false };
                continue;
            }
            const rect = el.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const topEl = document.elementFromPoint(cx, cy);
            status[id] = {
                exists: true,
                rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
                visible: rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none',
                topElTag: topEl ? topEl.tagName : null,
                topElId: topEl ? topEl.id : null,
                topElClass: topEl ? topEl.className : null,
                topElZIndex: topEl ? window.getComputedStyle(topEl).zIndex : null,
                topElPointerEvents: topEl ? window.getComputedStyle(topEl).pointerEvents : null,
                elZIndex: window.getComputedStyle(el).zIndex,
                elPointerEvents: window.getComputedStyle(el).pointerEvents,
                isCovered: topEl !== el && !el.contains(topEl),
                parentChain: (() => {
                    let p = el;
                    const chain = [];
                    while (p && p !== document.body) {
                        chain.push(p.tagName + (p.id ? '#' + p.id : '') + (p.className ? '.' + p.className.split(' ').join('.') : ''));
                        p = p.parentElement;
                    }
                    return chain;
                })(),
                topElOuterHTML: topEl ? topEl.outerHTML.substring(0, 150) : null
            };
        }
        return status;
    })()`);

    console.log('--- BUTTON STATUS & COVERAGE ---');
    console.log(JSON.stringify(checkDom, null, 2));

    await cdp.send('Browser.close');
    edge.kill();
}

main().catch(console.error);
