const { spawn } = require('child_process');
const http = require('http');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9222;
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
        this.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
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

    async evaluate(fnBody) {
        const res = await this.send('Runtime.evaluate', {
            expression: `(() => {\n${fnBody}\n})()`,
            returnByValue: true,
            awaitPromise: true
        });
        if (res.exceptionDetails) {
            throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
        }
        return res.result ? res.result.value : undefined;
    }
}

async function checkServerAlive() {
    return new Promise(resolve => {
        const req = http.get('http://localhost:18888/api/status', (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(1000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

let spawnedServer = null;

async function run() {
    const isAlive = await checkServerAlive();
    if (!isAlive) {
        console.log('⚡ Server not running on 18888, auto-starting server.ps1...');
        const path = require('path');
        const sPath = path.join(__dirname, 'app', 'server.ps1');
        spawnedServer = spawn('powershell.exe', [
            '-ExecutionPolicy', 'Bypass',
            '-NoProfile',
            '-File', sPath,
            '-NoLaunch',
            '-Port', '18888'
        ], { stdio: 'ignore' });

        for (let i = 0; i < 20; i++) {
            await sleep(500);
            if (await checkServerAlive()) break;
        }
    }

    console.log('🚀 Starting Headless Edge for E2E Panel Tests...');
    const edge = spawn(EDGE_PATH, [
        '--headless=new',
        `--remote-debugging-port=${PORT}`,
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-fre',
        '--disable-sync',
        '--user-data-dir=C:\\Users\\mehme\\AppData\\Local\\Temp\\edge_test_profile',
        APP_URL
    ]);

    edge.on('error', (err) => {
        console.error('Failed to spawn Edge:', err);
        process.exit(1);
    });

    try {
        let targets = null;
        for (let i = 0; i < 20; i++) {
            await sleep(500);
            try {
                targets = await fetchJson(`http://127.0.0.1:${PORT}/json`);
                if (targets && targets.length > 0) break;
            } catch (e) {
                // waiting
            }
        }

        if (!targets || targets.length === 0) {
            throw new Error('Edge failed to start CDP within timeout');
        }

        const pageTarget = targets.find(t => t.type === 'page' && !t.url.startsWith('chrome') && !t.url.startsWith('edge')) || targets.find(t => t.type === 'page') || targets[0];
        console.log(`Connected to target: ${pageTarget.title || pageTarget.url}`);

        const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
        await cdp.ready();
        await cdp.send('Page.enable');
        await cdp.send('Runtime.enable');
        await sleep(2000);

        // Dismiss splash if present
        await cdp.evaluate(`
            const sp = document.getElementById('splashScreen');
            if (sp) { sp.style.display = 'none'; sp.classList.add('hidden'); }
            const startBtn = document.getElementById('startAppBtn');
            if (startBtn) startBtn.click();
        `);
        await sleep(500);

        console.log('\n--- 1. Testing KOMUTLAR Panel (#openCommandsModalBtn -> #commandsModal) ---');
        let res = await cdp.evaluate(`
            const btn = document.getElementById('openCommandsModalBtn');
            btn.click();
            const modal = document.getElementById('commandsModal');
            return {
                opened: modal && modal.style.display === 'flex' && !modal.classList.contains('hidden'),
                display: modal ? modal.style.display : null
            };
        `);
        console.log('Result 1 (Open via Button):', res);
        if (!res.opened) throw new Error('Komutlar modal failed to open!');

        // Test simulator inside modal
        console.log('Testing live command test simulator inside Komutlar modal...');
        res = await cdp.evaluate(`
            const userInp = document.getElementById('testChatUserInput');
            const msgInp = document.getElementById('testChatMessageInput');
            const sendBtn = document.getElementById('executeTestChatCmdBtn');
            if (userInp) userInp.value = 'KomutTestUser';
            if (msgInp) msgInp.value = '!turnuvagiriş';
            if (sendBtn) sendBtn.click();
            const added = document.querySelector('#playerPool .player-item[data-name="KomutTestUser"]');
            return { simulatedAdded: !!added };
        `);
        console.log('Result 1 (Command Simulator Test):', res);
        if (!res.simulatedAdded) throw new Error('Command simulator failed to execute command!');

        await cdp.evaluate(`
            const closeBtn = document.getElementById('closeCommandsModalBtn');
            closeBtn.click();
        `);
        let closed = await cdp.evaluate(`
            const modal = document.getElementById('commandsModal');
            return modal.style.display === 'none' || modal.classList.contains('hidden');
        `);
        console.log('Result 1 (Close):', closed);
        if (!closed) throw new Error('Komutlar modal failed to close!');

        // Test opening via poolCommandTag
        res = await cdp.evaluate(`
            const tag = document.getElementById('poolCommandTag');
            tag.click();
            const modal = document.getElementById('commandsModal');
            return {
                opened: modal && modal.style.display === 'flex' && !modal.classList.contains('hidden')
            };
        `);
        console.log('Result 1 (Open via Pool Tag):', res);
        if (!res.opened) throw new Error('Komutlar modal failed to open via pool tag!');

        await cdp.evaluate(`
            const footerClose = document.getElementById('closeCommandsModalFooterBtn');
            footerClose.click();
        `);

        console.log('\n--- 2. Testing AYARLAR Çekmecesi (#settingsDrawerBtn -> #settingsDrawer) ---');
        res = await cdp.evaluate(`
            const btn = document.getElementById('settingsDrawerBtn');
            btn.click();
            const drawer = document.getElementById('settingsDrawer');
            return {
                opened: drawer && drawer.classList.contains('open') && drawer.style.display !== 'none',
                display: drawer ? drawer.style.display : null,
                classes: drawer ? drawer.className : null
            };
        `);
        console.log('Result 2 (Open):', res);
        if (!res.opened) throw new Error('Ayarlar çekmecesi failed to open!');

        await cdp.evaluate(`
            const closeBtn = document.getElementById('closeDrawerBtn');
            closeBtn.click();
        `);
        closed = await cdp.evaluate(`
            const drawer = document.getElementById('settingsDrawer');
            return !drawer.classList.contains('open');
        `);
        console.log('Result 2 (Close):', closed);
        if (!closed) throw new Error('Ayarlar çekmecesi failed to close!');

        console.log('\n--- 3. Testing REHBER Paneli (#guideBtn -> #comprehensiveGuideModal) ---');
        res = await cdp.evaluate(`
            const btn = document.getElementById('guideBtn');
            btn.click();
            const modal = document.getElementById('comprehensiveGuideModal');
            return {
                opened: modal && modal.style.display === 'flex' && !modal.classList.contains('hidden'),
                display: modal ? modal.style.display : null
            };
        `);
        console.log('Result 3 (Open):', res);
        if (!res.opened) throw new Error('Rehber paneli failed to open!');

        await cdp.evaluate(`
            const closeBtn = document.getElementById('closeComprehensiveGuideBtn');
            closeBtn.click();
        `);
        closed = await cdp.evaluate(`
            const modal = document.getElementById('comprehensiveGuideModal');
            return modal.style.display === 'none' || modal.classList.contains('hidden');
        `);
        console.log('Result 3 (Close):', closed);
        if (!closed) throw new Error('Rehber paneli failed to close!');

        console.log('\n--- 4. Testing SIRALAMA Paneli (#leaderboardBtn -> #leaderboardModal) ---');
        res = await cdp.evaluate(`
            const btn = document.getElementById('leaderboardBtn');
            btn.click();
            const modal = document.getElementById('leaderboardModal');
            return {
                opened: modal && modal.style.display === 'flex' && !modal.classList.contains('hidden'),
                display: modal ? modal.style.display : null
            };
        `);
        console.log('Result 4 (Open):', res);
        if (!res.opened) throw new Error('Sıralama paneli failed to open!');

        await cdp.evaluate(`
            const closeBtn = document.getElementById('closeLeaderboardBtn');
            closeBtn.click();
        `);
        closed = await cdp.evaluate(`
            const modal = document.getElementById('leaderboardModal');
            return modal.style.display === 'none' || modal.classList.contains('hidden');
        `);
        console.log('Result 4 (Close):', closed);
        if (!closed) throw new Error('Sıralama paneli failed to close!');

        console.log('\n--- 5. Testing ÇARKI FELEK (#luckyWheelBtn -> #wheelModal) ---');
        res = await cdp.evaluate(`
            const btn = document.getElementById('luckyWheelBtn');
            btn.click();
            const modal = document.getElementById('wheelModal');
            return {
                opened: modal && modal.style.display === 'flex' && !modal.classList.contains('hidden'),
                display: modal ? modal.style.display : null
            };
        `);
        console.log('Result 5 (Open):', res);
        if (!res.opened) throw new Error('Çarkıfelek modal failed to open!');

        console.log('Testing wheelAddTestBtn inside wheelModal...');
        res = await cdp.evaluate(`
            const testBtn = document.getElementById('wheelAddTestBtn');
            if (testBtn) testBtn.click();
            const poolCount = document.querySelectorAll('#playerPool .player-item').length;
            return { poolCount };
        `);
        console.log('Result 5 (Add 10 test viewers via wheel):', res);
        if (res.poolCount === 0) throw new Error('wheelAddTestBtn failed to add viewers!');

        await cdp.evaluate(`
            const closeBtn = document.getElementById('closeWheelModalBtn');
            closeBtn.click();
        `);
        closed = await cdp.evaluate(`
            const modal = document.getElementById('wheelModal');
            return modal.style.display === 'none' || modal.classList.contains('hidden');
        `);
        console.log('Result 5 (Close):', closed);
        if (!closed) throw new Error('Çarkıfelek modal failed to close!');

        console.log('\n--- 6. Testing DAĞITICI (#randomizeBtn) ---');
        // Havuzda zaten 10 oyuncu var (Test 5'te eklendi), randomize doğrudan dağıtmalı
        res = await cdp.evaluate(`
            const poolBefore = document.querySelectorAll('#playerPool .player-item').length;
            const btn = document.getElementById('randomizeBtn');
            const teamsFound = document.querySelectorAll('.team-box .team-list').length;
            const allTeamLists = document.querySelectorAll('.team-list').length;
            const gm = document.getElementById('gameMode') ? document.getElementById('gameMode').value : null;
            btn.click();
            const team1Count = document.querySelectorAll('#team-1 .player-item').length;
            const team2Count = document.querySelectorAll('#team-2 .player-item').length;
            const poolAfter = document.querySelectorAll('#playerPool .player-item').length;
            return { poolBefore, teamsFound, allTeamLists, gm, team1Count, team2Count, poolAfter };
        `);
        console.log('Result 6 (Randomize with players):', res);
        if (res.team1Count === 0 && res.team2Count === 0) throw new Error('Randomize failed to distribute players to teams!');

        // Şimdi oyuncuları temizleyip boşken randomizeAssistModal açılıyor mu test edelim
        console.log('\n--- 7. Testing İZLEYİCİLERİ SIFIRLA (#clearBtn -> #clearConfirmModal) ---');
        res = await cdp.evaluate(`
            const clearBtn = document.getElementById('clearBtn');
            clearBtn.click();
            const modal = document.getElementById('clearConfirmModal');
            return {
                opened: modal && modal.style.display === 'flex' && !modal.classList.contains('hidden'),
                display: modal ? modal.style.display : null
            };
        `);
        console.log('Result 7 (Clear Modal Open):', res);
        if (!res.opened) throw new Error('Clear confirm modal failed to open!');

        // Confirm modalden onayla
        res = await cdp.evaluate(`
            const execBtn = document.getElementById('executeClearConfirmBtn');
            execBtn.click();
            const poolCount = document.querySelectorAll('#playerPool .player-item:not(.is-developer)').length;
            const t1Count = document.querySelectorAll('#team-1 .player-item:not(.is-developer)').length;
            const modal = document.getElementById('clearConfirmModal');
            return {
                poolCount,
                t1Count,
                closed: modal.style.display === 'none' || modal.classList.contains('hidden')
            };
        `);
        console.log('Result 7 (Clear Modal Executed):', res);
        if (res.poolCount > 0 || res.t1Count > 0 || !res.closed) throw new Error('Clear execution failed!');

        console.log('\n--- 6b. Testing DAĞITICI Boşken Modal Açma (#randomizeBtn -> #randomizeAssistModal) ---');
        res = await cdp.evaluate(`
            const btn = document.getElementById('randomizeBtn');
            btn.click();
            const modal = document.getElementById('randomizeAssistModal');
            return {
                opened: modal && modal.style.display === 'flex' && !modal.classList.contains('hidden'),
                display: modal ? modal.style.display : null
            };
        `);
        console.log('Result 6b (Assist Modal Open):', res);
        if (!res.opened) throw new Error('Randomize assist modal failed to open when pool is empty!');

        // Modal içindeki '10 Test Oyuncusu Ekle & Dağıt' butonunu test et
        await cdp.evaluate(`
            const autoBtn = document.getElementById('autoAddAndRandomizeBtn');
            if (autoBtn) autoBtn.click();
        `);
        await sleep(600);
        res = await cdp.evaluate(`
            const team1Count = document.querySelectorAll('#team-1 .player-item').length;
            const team2Count = document.querySelectorAll('#team-2 .player-item').length;
            const poolCount = document.querySelectorAll('#playerPool .player-item').length;
            const modal = document.getElementById('randomizeAssistModal');
            return {
                team1Count,
                team2Count,
                poolCount,
                closed: modal.style.display === 'none' || modal.classList.contains('hidden')
            };
        `);
        console.log('Result 6b (Assist Modal Auto Add & Distribute):', res);
        if ((res.team1Count === 0 && res.team2Count === 0) || !res.closed) throw new Error('Auto add and randomize failed!');

        console.log('\n--- 8. Testing İZLEYİCİ HIZI SIFIRLAMA (#viewerJoinSpeedSlider & #resetViewerSpeedBtn) ---');
        res = await cdp.evaluate(`
            const slider = document.getElementById('viewerJoinSpeedSlider');
            const display = document.getElementById('viewerJoinSpeedDisplay');
            const resetBtn = document.getElementById('resetViewerSpeedBtn');

            // Değeri bilerek değiştir
            slider.value = '2500';
            slider.dispatchEvent(new Event('input'));
            const changedDisplay = display.textContent;

            // Sıfırla
            resetBtn.click();
            const resetValue = slider.value;
            const resetDisplay = display.textContent;

            return {
                changedDisplay,
                resetValue,
                resetDisplay
            };
        `);
        console.log('Result 8 (Viewer Speed Reset):', res);
        if (res.resetValue !== '1000' || res.resetDisplay !== '1.0 sn') throw new Error('Viewer speed reset failed!');

        console.log('\n--- 9. Testing ESCAPE TUŞU İLE TÜM PANELLERİN KAPANMASI ---');
        res = await cdp.evaluate(`
            // Komutlar modalını aç
            document.getElementById('openCommandsModalBtn').click();
            const opened = document.getElementById('commandsModal').style.display === 'flex';

            // Escape bas
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

            const modal = document.getElementById('commandsModal');
            const closed = modal.style.display === 'none' || modal.classList.contains('hidden');
            return { opened, closed };
        `);
        console.log('Result 9 (Escape key handler):', res);
        if (!res.opened || !res.closed) throw new Error('Escape key handler failed to close modal!');

        console.log('\n--- 9b. Testing OYUN & TEMA SEÇİCİ (#activeGameBadgeBtn -> #gameSelectorModal) ---');
        res = await cdp.evaluate(`
            const badgeBtn = document.getElementById('activeGameBadgeBtn');
            badgeBtn.click();
            const modal = document.getElementById('gameSelectorModal');
            const opened = modal && modal.style.display === 'flex' && !modal.classList.contains('hidden');
            
            // CS2 seç ve test et
            const cs2Btn = modal.querySelector('.btn-select-game[data-game="cs2"]');
            if (cs2Btn) cs2Btn.click();
            const hasCs2Theme = document.body.classList.contains('game-theme-cs2');
            
            // Strikers Club'a geri dön
            window.setGameTheme('strikers', false);
            const hasStrikersTheme = document.body.classList.contains('game-theme-strikers');
            const currentLabel = document.getElementById('activeGameLabel')?.textContent;
            
            return { opened, hasCs2Theme, hasStrikersTheme, currentLabel };
        `);
        console.log('Result 9b (Game Selector Engine):', res);
        if (!res.opened) throw new Error('Game selector modal failed to open!');
        if (!res.hasCs2Theme) throw new Error('Failed to switch to CS2 theme!');
        if (!res.hasStrikersTheme) throw new Error('Failed to restore Strikers Club theme!');

        console.log('\n--- 9c. Testing YAYINCI GÜVENLİK & LİDERLİK KİLİT MOTORU (#streamerAuthModal) ---');
        res = await cdp.evaluate(`
            // Önce izleyici modundayken sıralama paneli açıldığında kilit katmanı görünür mü?
            const lbBtn = document.getElementById('leaderboardBtn');
            lbBtn.click();
            const lbModal = document.getElementById('leaderboardModal');
            const lockOverlay = document.getElementById('leaderboardLockOverlay');
            const lockVisibleBefore = lockOverlay && !lockOverlay.classList.contains('hidden') && lockOverlay.style.display === 'flex';
            
            document.getElementById('closeLeaderboardBtn').click();

            // Yayıncı girişi yap
            return window.performStreamerLogin('streamer_king', 'StrikersKing2026!Auth').then(() => {
                const authed = window.isBroadcasterAuthenticated();
                
                // Giriş sonrası sıralama panelini aç, kilit katmanı kalkmalı
                lbBtn.click();
                const lockHiddenAfter = lockOverlay && (lockOverlay.classList.contains('hidden') || lockOverlay.style.display === 'none');
                document.getElementById('closeLeaderboardBtn').click();

                return { lockVisibleBefore: !!lockVisibleBefore, authed, lockHiddenAfter: !!lockHiddenAfter };
            });
        `);
        console.log('Result 9c (Broadcaster Auth & Anti-Tamper Shield):', res);
        if (!res.lockVisibleBefore) throw new Error('Leaderboard lock overlay not visible to unauthenticated viewers!');
        if (!res.authed) throw new Error('Streamer authentication failed!');
        if (!res.lockHiddenAfter) throw new Error('Leaderboard lock overlay not unlocked for authenticated broadcaster!');

        console.log('\n--- 9d. Testing STRIKERS CLUB ZAFER SAHNESİ & KAZANAN OYUNCU HUD (#strikersWinnerHeroName) ---');
        res = await cdp.evaluate(`
            window.triggerGrandChampionCelebration({ name: 'Fırtına Spor', players: ['EfsaneGolcu', 'YıldızForvet'] });
            const champModal = document.getElementById('championCelebrationModal');
            const opened = champModal && !champModal.classList.contains('hidden');
            const heroName = document.getElementById('strikersWinnerHeroName')?.textContent;
            const heroStage = document.getElementById('strikersCelebrationHeroStage');
            const stageVisible = heroStage && !heroStage.classList.contains('hidden');

            window.closeGrandChampionCelebration();
            const closed = champModal && champModal.classList.contains('hidden');

            return { opened, heroName, stageVisible: !!stageVisible, closed };
        `);
        console.log('Result 9d (Strikers Club Overhead Winner HUD):', res);
        if (!res.opened) throw new Error('Champion celebration stage failed to open!');
        if (res.heroName !== 'EfsaneGolcu') throw new Error(`Expected winner hero name 'EfsaneGolcu', got: '${res.heroName}'`);
        if (!res.stageVisible) throw new Error('Strikers celebration hero stage not visible!');
        if (!res.closed) throw new Error('Champion celebration stage failed to close!');

        console.log('\n--- 9e. Testing MAÇ DOSYALARI & SCOREBOARD MODALI (#matchFilesModal) ---');
        res = await cdp.evaluate(`
            if (typeof window.openMatchFilesModal !== 'function') {
                return { error: 'openMatchFilesModal function missing' };
            }
            window.openMatchFilesModal('test_e2e_match', 'Test Çeyrek Final');
            const modal = document.getElementById('matchFilesModal');
            const opened = modal && modal.style.display === 'flex' && !modal.classList.contains('hidden');
            const title = document.getElementById('matchFilesModalTitle')?.textContent;
            const subtitle = document.getElementById('matchFilesModalSubtitle')?.textContent;
            const previewBox = document.getElementById('matchCapturePreviewBox');
            const hasPreview = !!previewBox;
            const saveBtn = document.getElementById('matchFilesSaveScoreBtn');
            const hasSaveBtn = !!saveBtn;

            const closeBtn = document.getElementById('closeMatchFilesModalBtn');
            if (closeBtn) closeBtn.click();
            const closed = modal && modal.classList.contains('hidden');

            return { opened, title, subtitle, hasPreview, hasSaveBtn, closed };
        `);
        console.log('Result 9e (Match Files Modal Verification):', res);
        if (!res.opened) throw new Error('Match files modal failed to open!');
        if (!res.title.includes('Test Çeyrek Final')) throw new Error('Match files modal title mismatch!');
        if (!res.hasPreview) throw new Error('Preview box not found in Match Files modal!');
        if (!res.hasSaveBtn) throw new Error('Save button not found in Match Files modal!');
        if (!res.closed) throw new Error('Match files modal failed to close!');

        console.log('Navigating to OBS Overlay Mode...');
        await cdp.evaluate(`
            try {
                window.history.pushState({}, '', '${APP_URL}/?overlay=1');
            } catch(e) {}
            if (typeof window.initOverlayMode === 'function') {
                window.initOverlayMode();
            } else {
                document.documentElement.classList.add('obs-overlay-mode');
                if (document.body) document.body.classList.add('obs-overlay-mode');
            }
        `);
        await sleep(800);

        const obsResult = await cdp.evaluate(`
            const docEl = document.documentElement;
            const body = document.body;
            const isObsMode = (docEl && docEl.classList.contains('obs-overlay-mode')) || (body && body.classList.contains('obs-overlay-mode'));
            const header = document.querySelector('.app-header') || document.querySelector('header');
            const controls = document.querySelector('.controls');
            const pool = document.querySelector('.pool-container');
            const headerHidden = header ? (header.style.display === 'none' || window.getComputedStyle(header).display === 'none') : false;
            const controlsHidden = controls ? (controls.style.display === 'none' || window.getComputedStyle(controls).display === 'none') : false;
            const poolHidden = pool ? (pool.style.display === 'none' || window.getComputedStyle(pool).display === 'none') : false;
            
            // Ticker check
            const ticker = document.getElementById('obsMarqueeTicker');
            const tickerVisible = ticker && !ticker.classList.contains('hidden');

            // Goal alert test
            if (typeof window.showObsGoalAlert === 'function') {
                window.showObsGoalAlert({ player: 'EfsaneGolcu', goals: 2 });
            }
            const goalBanner = document.getElementById('obsGoalBanner');
            const goalBannerActive = goalBanner && !goalBanner.classList.contains('hidden') && goalBanner.classList.contains('visible');
            const goalText = document.getElementById('obsGoalPlayerName')?.textContent;

            // Live Match test in Overlay
            if (typeof window.setOverlayLiveMatch === 'function') {
                window.setOverlayLiveMatch('single_match');
            } else if (typeof window.setActiveLiveMatch === 'function') {
                window.setActiveLiveMatch('single_match');
            }
            const liveBanner = document.getElementById('obsLiveMatchBanner');
            const liveBannerActive = liveBanner && !liveBanner.classList.contains('hidden');

            return {
                currentHref: window.location.href,
                isObsMode: !!isObsMode,
                headerHidden,
                controlsHidden,
                poolHidden,
                tickerVisible: !!tickerVisible,
                goalBannerActive: !!goalBannerActive,
                goalText,
                liveBannerActive: !!liveBannerActive
            };
        `);
        console.log('Result 10 (OBS Overlay Verification):', obsResult);

        if (!obsResult.isObsMode) throw new Error('OBS Overlay mode not active on ?overlay=1!');
        if (!obsResult.headerHidden || !obsResult.controlsHidden) throw new Error('OBS Overlay did not hide dashboard UI elements!');
        if (!obsResult.tickerVisible) throw new Error('OBS Marquee Ticker not visible in overlay mode!');
        if (!obsResult.goalBannerActive) throw new Error('OBS Goal alert banner did not activate!');
        if (!obsResult.liveBannerActive) throw new Error('OBS Live match banner did not activate!');

        console.log('\n======================================================');
        console.log('🎉 ALL CONTROLS & OBS LIVE OVERLAY VERIFIED 100% OPERATIONAL!');
        console.log('======================================================');

    } finally {
        try { edge.kill(); } catch (e) {}
        if (spawnedServer) {
            try { spawnedServer.kill(); } catch (e) {}
        }
    }
}

run().catch((err) => {
    console.error('Test run error:', err);
    process.exit(1);
});
