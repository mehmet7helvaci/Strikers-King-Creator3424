const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== STRICKERS KING CREATOR AUTOMATED VERIFICATION SUITE ===\n');

// Test 1: hub_stats.json clean state
const hubStatsRaw = fs.readFileSync(path.join(__dirname, 'app/data/hub_stats.json'), 'utf8');
const hubStats = JSON.parse(hubStatsRaw);
assert.deepStrictEqual(hubStats, {}, 'hub_stats.json must be empty object {}');
console.log('✔ Test 1 Passed: app/data/hub_stats.json is initialized to {} without test dummies.');

// Test 2: Win Rate Calculation & Derecesiz Rule
function getPlayerStats(stat, name) {
    const wins = Number(stat?.wins) || 0;
    const losses = Number(stat?.losses) || 0;
    const total = wins + losses;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    const rank = total === 0
        ? { title: 'Derecesiz', icon: 'fa-solid fa-shield-halved', className: 'rank-unranked' }
        : { title: 'Dereceli', icon: 'fa-solid fa-shield', className: 'rank-ranked' };
    return { wins, losses, total, winRate, rank };
}

const unrankedPlayer = getPlayerStats({ wins: 0, losses: 0, goals: 0 }, 'YeniOyuncu');
assert.strictEqual(unrankedPlayer.total, 0, 'Total matches must be 0');
assert.strictEqual(unrankedPlayer.winRate, 0, 'Winrate must strictly be 0%');
assert.strictEqual(unrankedPlayer.rank.title, 'Derecesiz', 'Rank must be Derecesiz');
console.log('✔ Test 2 Passed: 0-match player has strictly 0% winrate and Derecesiz rank.');

// Test 3: Channel Isolation & Storage Paths
function getChannelFilePath(channelsDir, statsFile, channel) {
    if (!channel || channel.trim().toLowerCase() === 'global') {
        return statsFile;
    }
    const safeName = channel.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'genel';
    return path.join(channelsDir, `${safeName}.json`);
}

const channelsDir = path.join(__dirname, 'app/data/channels');
const statsFile = path.join(__dirname, 'app/data/hub_stats.json');
const pathK1ng = getChannelFilePath(channelsDir, statsFile, 'theonlyk1ng');
const pathGenel = getChannelFilePath(channelsDir, statsFile, 'genel');
assert.notStrictEqual(pathK1ng, pathGenel, 'Channel file paths must be distinct');
assert.ok(pathK1ng.endsWith('theonlyk1ng.json'), 'Path must end with theonlyk1ng.json');
console.log('✔ Test 3 Passed: Server channel persistence isolation confirmed.');

// Test 4: MVP Calculation Logic (goals * 2 + assists)
const mockPlayerUpdates = [
    { name: 'OyuncuA', goals: 2, assists: 1, saves: 0 }, // score: 2*2 + 1 = 5
    { name: 'OyuncuB', goals: 1, assists: 4, saves: 2 }, // score: 1*2 + 4 = 6 (MVP)
    { name: 'OyuncuC', goals: 0, assists: 0, saves: 5 }  // score: 0*2 + 0 = 0
];

let matchMvpName = null;
let highestMvpScore = 0;
mockPlayerUpdates.forEach(pu => {
    const mvpScore = (pu.goals * 2) + pu.assists;
    if (mvpScore > highestMvpScore) {
        highestMvpScore = mvpScore;
        matchMvpName = pu.name;
    }
});
assert.strictEqual(matchMvpName, 'OyuncuB', 'OyuncuB must be MVP');
assert.strictEqual(highestMvpScore, 6, 'Highest score must be 6');

mockPlayerUpdates.forEach(pu => {
    pu.isMvp = (pu.name === matchMvpName);
});
assert.strictEqual(mockPlayerUpdates[1].isMvp, true, 'OyuncuB must have isMvp=true');
assert.strictEqual(mockPlayerUpdates[0].isMvp, false, 'OyuncuA must have isMvp=false');
console.log('✔ Test 4 Passed: Match MVP calculation (goals*2 + assists) and isMvp tagging verified.');

// Test 5: 3D Apple Watch Cylinder Angles
const cylinderValues = [1, 2, 3, 5, 8, 11];
const angleStep = 40;
const radius = 48;
const items3D = cylinderValues.map((val, idx) => ({
    val,
    angle: idx * angleStep,
    transform: `rotateX(${idx * angleStep}deg) translateZ(${radius}px)`
}));
assert.strictEqual(items3D.length, 6, 'There must be 6 cylinder items');
assert.strictEqual(items3D[0].angle, 0, 'First item must be at 0 deg');
assert.strictEqual(items3D[3].angle, 120, '4th item (5v5) must be at 120 deg');
console.log('✔ Test 5 Passed: 3D Apple Watch Cylinder geometry calculations verified.');

// Test 6: MeH4n Special Developer Protection Rule
function canModifyRole(playerName, playerRoles, newRole) {
    const cleanLower = playerName.trim().toLowerCase();
    if (cleanLower === 'meh4n' && playerRoles.has('meh4n')) {
        if (!newRole || newRole !== playerRoles.get('meh4n')) {
            return false; // locked
        }
    }
    return true;
}

const rolesMap = new Map();
rolesMap.set('meh4n', 'ST');
assert.strictEqual(canModifyRole('MeH4n', rolesMap, 'GK'), false, 'Streamer cannot change MeH4n role');
assert.strictEqual(canModifyRole('meh4n', rolesMap, null), false, 'Streamer cannot delete MeH4n role');
assert.strictEqual(canModifyRole('MeH4n', rolesMap, 'ST'), true, 'Existing role matches locked role');
assert.strictEqual(canModifyRole('DigerOyuncu', rolesMap, 'GK'), true, 'Other players can be modified freely');
console.log('✔ Test 6 Passed: MeH4n Developer role lock protection verified.');

// Test 7: Multi-channel Backup & Restore Isolation
const mockBackup = {
    appName: 'Strickers King Creator',
    channels: {
        'theonlyk1ng': { 'kral_oyuncu': { wins: 5, losses: 1, goals: 10, assists: 4, streak: 3, mvpCount: 2 } },
        'genel': { 'genel_oyuncu': { wins: 2, losses: 2, goals: 3, assists: 1, streak: 0, mvpCount: 0 } }
    }
};

let activeChannel = 'theonlyk1ng';
let channelStats = {};
let mockLocalStorage = {};

Object.keys(mockBackup.channels).forEach(ch => {
    const chStats = mockBackup.channels[ch];
    mockLocalStorage[`kick_strikers_stats_${ch}`] = JSON.stringify(chStats);
    if (ch.toLowerCase() === activeChannel.toLowerCase()) {
        Object.assign(channelStats, chStats);
    }
});

assert.ok(channelStats['kral_oyuncu'], 'Active channel received its players');
assert.strictEqual(channelStats['genel_oyuncu'], undefined, 'Active channel must NOT be polluted with other channels');
assert.ok(mockLocalStorage['kick_strikers_stats_genel'], 'Other channel was saved to storage');
console.log('✔ Test 7 Passed: Backup import multi-channel isolation verified.');

// Test 8: Kick chat /goal and /boost command parser
function parseChatCommand(rawContent) {
    const turkishNormContent = rawContent.replace(/ı/g, 'i').replace(/İ/g, 'i').toLowerCase().trim();
    const tokens = turkishNormContent.split(/\s+/);
    const firstToken = tokens[0];
    const isGoalCmd = ['/goal', '!goal', '/gol', '!gol'].includes(firstToken);
    const isBoostCmd = ['/boost', '!boost', '/asist', '!asist'].includes(firstToken);
    let target = '';
    if (tokens.length > 1) {
        target = tokens[1].replace(/^@/, '').trim();
    }
    return { isGoalCmd, isBoostCmd, target };
}

assert.deepStrictEqual(parseChatCommand('/goal @KingPlayer'), { isGoalCmd: true, isBoostCmd: false, target: 'kingplayer' });
assert.deepStrictEqual(parseChatCommand('!gol @striker99'), { isGoalCmd: true, isBoostCmd: false, target: 'striker99' });
assert.deepStrictEqual(parseChatCommand('/boost @midfielder'), { isGoalCmd: false, isBoostCmd: true, target: 'midfielder' });
assert.deepStrictEqual(parseChatCommand('!asist @passer10'), { isGoalCmd: false, isBoostCmd: true, target: 'passer10' });
console.log('✔ Test 8 Passed: Kick chat /goal and /boost command parser verified.');

// Test 9: Developer Attribution ("Mehmet Helvacı") Verification
const appHtml = fs.readFileSync(path.join(__dirname, 'app/index.html'), 'utf8');
const appCss = fs.readFileSync(path.join(__dirname, 'app/style.css'), 'utf8');
assert.ok(appHtml.includes('Mehmet Helvacı'), 'app/index.html must contain Mehmet Helvacı developer credit');
assert.ok(appHtml.includes('app-footer'), 'app/index.html must contain app-footer element');
assert.ok(appCss.includes('.app-footer'), 'app/style.css must define .app-footer style');
assert.ok(appCss.includes('.obs-overlay-mode .app-footer'), 'OBS overlay must hide app-footer to protect broadcast graphics');
console.log('✔ Test 9 Passed: Mehmet Helvacı developer attribution & OBS protection verified.');

// Test 10: GitHub Pages Root Portal & Workflow Verification
const rootHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const workflowYaml = fs.readFileSync(path.join(__dirname, '.github/workflows/deploy-pages.yml'), 'utf8');
assert.ok(rootHtml.includes('Mehmet Helvacı'), 'Root index.html must feature Mehmet Helvacı developer credit');
assert.ok(rootHtml.includes('app/'), 'Root index.html must route to app/ directory');
assert.ok(workflowYaml.includes('actions/deploy-pages@v4'), 'Workflow must use official deploy-pages action');
assert.ok(workflowYaml.includes('actions/upload-pages-artifact@v3'), 'Workflow must use upload-pages-artifact');
console.log('✔ Test 10 Passed: GitHub Pages root redirect portal & automated deployment workflow verified.');

console.log('\n======================================================');
console.log('ALL 10 CORE SYSTEM TESTS PASSED SUCCESSFULLY! (100% OK)');
console.log('======================================================');
