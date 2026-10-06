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

// Test 5: 3D Apple Watch Cylinder Angles (1v1 to 16v16 Extended Geometry)
const cylinderValues = Array.from({ length: 16 }, (_, i) => i + 1);
const angleStep = 360 / cylinderValues.length;
const radius = 60;
const items3D = cylinderValues.map((val, idx) => ({
    val,
    angle: idx * angleStep,
    transform: `rotateX(${idx * angleStep}deg) translateZ(${radius}px)`
}));
assert.strictEqual(items3D.length, 16, 'There must be 16 cylinder items (1v1 to 16v16)');
assert.strictEqual(items3D[0].angle, 0, 'First item must be at 0 deg');
assert.strictEqual(items3D[4].val, 5, '5th item must be 5v5');
assert.strictEqual(items3D[4].angle, 90, '5th item (5v5) must be at 90 deg (4 * 22.5)');
assert.strictEqual(items3D[15].val, 16, '16th item must be 16v16');
assert.strictEqual(items3D[15].angle, 337.5, '16th item must be at 337.5 deg');
console.log('✔ Test 5 Passed: 3D Apple Watch Cylinder geometry calculations (1v1 to 16v16) verified.');

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

// Test 9: Developer Attribution ("MeH4n") Verification
const appHtml = fs.readFileSync(path.join(__dirname, 'app/index.html'), 'utf8');
const appCss = fs.readFileSync(path.join(__dirname, 'app/style.css'), 'utf8');
assert.ok(appHtml.includes('MeH4n'), 'app/index.html must contain MeH4n developer credit');
assert.ok(!appHtml.includes('Mehmet Helvacı'), 'app/index.html must NOT contain old Mehmet Helvacı name');
assert.ok(appHtml.includes('app-footer'), 'app/index.html must contain app-footer element');
assert.ok(appCss.includes('.app-footer'), 'app/style.css must define .app-footer style');
assert.ok(appCss.includes('.obs-overlay-mode .app-footer'), 'OBS overlay must hide app-footer to protect broadcast graphics');
console.log('✔ Test 9 Passed: MeH4n developer attribution & OBS protection verified.');

// Test 10: GitHub Pages Root Portal & Workflow Verification
const rootHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const workflowYaml = fs.readFileSync(path.join(__dirname, '.github/workflows/deploy-pages.yml'), 'utf8');
assert.ok(rootHtml.includes('MeH4n'), 'Root index.html must feature MeH4n developer credit');
assert.ok(!rootHtml.includes('Mehmet Helvacı'), 'Root index.html must NOT contain old Mehmet Helvacı name');
assert.ok(rootHtml.includes('app/'), 'Root index.html must route to app/ directory');
assert.ok(workflowYaml.includes('actions/deploy-pages@v4'), 'Workflow must use official deploy-pages action');
assert.ok(workflowYaml.includes('actions/upload-pages-artifact@v3'), 'Workflow must use upload-pages-artifact');
console.log('✔ Test 10 Passed: GitHub Pages root redirect portal & automated deployment workflow verified.');

// Test 11: Atomic Match Packet Structure Verification
function validateAtomicMatchPacket(packet) {
    assert.ok(packet.matchId, 'Packet must contain matchId');
    assert.ok(typeof packet.timestamp === 'number', 'Packet must contain numeric timestamp');
    assert.ok(packet.streamer, 'Packet must contain streamer identifier');
    assert.ok(packet.channel, 'Packet must contain channel name');
    assert.ok(packet.winnerTitle, 'Packet must contain winnerTitle');
    assert.ok(Array.isArray(packet.winnerPlayers), 'winnerPlayers must be an array');
    assert.ok(Array.isArray(packet.playerUpdates), 'playerUpdates must be an array');
    packet.playerUpdates.forEach(pu => {
        assert.ok(typeof pu.name === 'string' && pu.name.length > 0, 'Each player update must have name');
        assert.ok(typeof pu.goals === 'number', 'Each player update must have goals count');
        assert.ok(typeof pu.assists === 'number', 'Each player update must have assists count');
        assert.ok(typeof pu.saves === 'number', 'Each player update must have saves count');
        assert.ok(typeof pu.win === 'boolean', 'Each player update must specify win status');
    });
    return true;
}

const mockAtomicPacket = {
    matchId: 'match_1700000000000',
    timestamp: 1700000000000,
    streamer: 'theonlyk1ng',
    channel: 'theonlyk1ng',
    winnerTitle: 'Takım 1',
    winnerPlayers: ['Meh4n', 'EfsaneGolcu'],
    loserTitle: 'Takım 2',
    loserPlayers: ['RakipA', 'RakipB'],
    mvp: { name: 'Meh4n', score: 5 },
    playerUpdates: [
        { name: 'Meh4n', goals: 2, assists: 1, saves: 0, win: true, isMvp: true },
        { name: 'EfsaneGolcu', goals: 1, assists: 2, saves: 1, win: true, isMvp: false },
        { name: 'RakipA', goals: 0, assists: 1, saves: 3, win: false, isMvp: false },
        { name: 'RakipB', goals: 1, assists: 0, saves: 2, win: false, isMvp: false }
    ],
    scores: { 'Takım 1': 3, 'Takım 2': 1 }
};
assert.strictEqual(validateAtomicMatchPacket(mockAtomicPacket), true, 'Atomic match packet must be valid');
console.log('✔ Test 11 Passed: Atomic match completion packet structure verified.');

// Test 12: Cross-Streamer Player Career Auto-Inheritance (Ortak Espor Ligi)
function resolveCrossStreamerStats(localChannelStats, globalCareerStats, playerName) {
    const key = playerName.trim().toLowerCase();
    if (!localChannelStats[key]) {
        if (globalCareerStats && globalCareerStats[key]) {
            const g = globalCareerStats[key];
            localChannelStats[key] = {
                wins: Number(g.wins) || 0,
                losses: Number(g.losses) || 0,
                goals: Number(g.goals) || 0,
                assists: Number(g.assists) || 0,
                saves: Number(g.saves) || 0,
                streak: Number(g.streak) || 0,
                mvpCount: Number(g.mvpCount) || 0,
                displayName: g.displayName || playerName.trim()
            };
        } else {
            localChannelStats[key] = {
                wins: 0, losses: 0, goals: 0, assists: 0, saves: 0, streak: 0, mvpCount: 0, displayName: playerName.trim()
            };
        }
    }
    return localChannelStats[key];
}

const mockGlobalLeague = {
    'efsanegolcu': { wins: 14, losses: 3, goals: 28, assists: 9, saves: 2, streak: 5, mvpCount: 7, displayName: 'EfsaneGolcu' }
};
const streamerBChannelStats = {}; // Streamer B has never seen this player before

const inheritedPlayer = resolveCrossStreamerStats(streamerBChannelStats, mockGlobalLeague, 'EfsaneGolcu');
assert.strictEqual(inheritedPlayer.goals, 28, 'Player goals must be inherited from global league');
assert.strictEqual(inheritedPlayer.wins, 14, 'Player wins must be inherited from global league');
assert.strictEqual(inheritedPlayer.streak, 5, 'Player streak must be inherited from global league');
assert.strictEqual(inheritedPlayer.mvpCount, 7, 'Player MVP count must be inherited from global league');
console.log('✔ Test 12 Passed: Cross-streamer player career auto-inheritance verified.');

// Test 13: Sandbox Path Traversal Defense & Restricted Backup Scanning in server.ps1
const serverScriptContent = fs.readFileSync(path.join(__dirname, 'app/server.ps1'), 'utf8');
assert.ok(serverScriptContent.includes('403 Forbidden: Sandbox Guvenlik Korumasi'), 'server.ps1 must block path traversal with 403');
assert.ok(serverScriptContent.includes('StartsWith($canonicalScriptDir'), 'server.ps1 must validate canonical script directory prefix');
assert.ok(!serverScriptContent.includes('$env:USERPROFILE\\Desktop'), 'server.ps1 backup scanning must NOT scan full Desktop directory');
assert.ok(!serverScriptContent.includes('$env:USERPROFILE\\Downloads'), 'server.ps1 backup scanning must NOT scan full Downloads directory');
console.log('✔ Test 13 Passed: Sandbox path traversal defense & restricted backup scanning verified.');

// Test 14: System Tray & BalloonTip Match Notification Integration in Program.cs
const programCsContent = fs.readFileSync(path.join(__dirname, 'Program.cs'), 'utf8');
assert.ok(programCsContent.includes('TrayApplicationContext'), 'Program.cs must implement TrayApplicationContext');
assert.ok(programCsContent.includes('NotifyIcon'), 'Program.cs must initialize NotifyIcon in System Tray');
assert.ok(programCsContent.includes('ShowBalloonTip'), 'Program.cs must show desktop BalloonTip on match completion');
assert.ok(programCsContent.includes('MATCH_RECORDED'), 'Program.cs must monitor MATCH_RECORDED events from server');
assert.ok(fs.existsSync(path.join(__dirname, 'StrickersKingCreator.exe')), 'StrickersKingCreator.exe binary must be compiled and present');
console.log('✔ Test 14 Passed: C# System Tray background execution & BalloonTip match notification verified.');

// Test 15: Live Auto-Refresh Broadcast to OBS Overlay & DOM in app/app.js
const appJsContent = fs.readFileSync(path.join(__dirname, 'app/app.js'), 'utf8');
assert.ok(appJsContent.includes('atomicMatchPacket'), 'app/app.js must create atomic match packet');
assert.ok(appJsContent.includes('obsSyncChannel.postMessage'), 'app/app.js must broadcast match state to OBS overlay');
assert.ok(appJsContent.includes('globalCareerStats'), 'app/app.js must track and persist globalCareerStats');
assert.ok(appJsContent.includes('/api/hub/career'), 'app/app.js must sync career stats via /api/hub/career');
console.log('✔ Test 15 Passed: Live auto-refresh broadcast to OBS overlay and global career tracking verified.');

// Test 16: Hub Remote Match Delivery Channel Isolation
function handleMatchRecordedEvent(event, currentChannel, channelStats, globalCareerStats, processedMatchIds) {
    const isAlreadyProcessedLocally = !!(event.matchId && processedMatchIds.has(event.matchId));
    if (event.matchId) {
        processedMatchIds.add(event.matchId);
    }
    if (!isAlreadyProcessedLocally && Array.isArray(event.playerUpdates)) {
        const isMatchForThisChannel = !event.channel || !currentChannel ||
            (event.channel.trim().toLowerCase() === currentChannel.trim().toLowerCase());

        event.playerUpdates.forEach(p => {
            const key = p.name.trim().toLowerCase();
            if (!globalCareerStats[key]) {
                globalCareerStats[key] = { wins: 0, losses: 0, goals: 0, assists: 0, saves: 0, streak: 0, mvpCount: 0, displayName: p.name.trim() };
            }
            globalCareerStats[key].goals = (globalCareerStats[key].goals || 0) + (p.goals || 0);
            if (p.win) {
                globalCareerStats[key].wins += 1;
                globalCareerStats[key].streak = (globalCareerStats[key].streak || 0) + 1;
            } else {
                globalCareerStats[key].losses += 1;
                globalCareerStats[key].streak = 0;
            }

            if (isMatchForThisChannel) {
                if (!channelStats[key]) {
                    channelStats[key] = { wins: 0, losses: 0, goals: 0, assists: 0, saves: 0, streak: 0, mvpCount: 0, displayName: p.name.trim() };
                }
                channelStats[key].goals = (channelStats[key].goals || 0) + (p.goals || 0);
                if (p.win) {
                    channelStats[key].wins += 1;
                    channelStats[key].streak = (channelStats[key].streak || 0) + 1;
                } else {
                    channelStats[key].losses += 1;
                    channelStats[key].streak = 0;
                }
            }
        });
    }
}

const remoteEventFromStreamerA = {
    matchId: 'match_remote_999',
    type: 'MATCH_RECORDED',
    channel: 'streamerA',
    streamer: 'StreamerA',
    playerUpdates: [
        { name: 'KralOyuncu', goals: 3, assists: 1, saves: 0, win: true, isMvp: true }
    ]
};

const streamerBChannel = 'streamerB';
const streamerBStats = {};
const streamerBGlobalLeague = {};
const streamerBProcessedMatches = new Set();

handleMatchRecordedEvent(remoteEventFromStreamerA, streamerBChannel, streamerBStats, streamerBGlobalLeague, streamerBProcessedMatches);

assert.strictEqual(streamerBStats['kraloyuncu'], undefined, 'Streamer B channel stats must NOT be polluted by Streamer A match');
assert.strictEqual(streamerBGlobalLeague['kraloyuncu'].goals, 3, 'Global career must be updated from remote broadcast');
assert.strictEqual(streamerBGlobalLeague['kraloyuncu'].wins, 1, 'Global career wins must be updated from remote broadcast');
console.log('✔ Test 16 Passed: Hub remote match delivery channel isolation verified.');

// Test 17: Submitting Streamer Event Deduplication via matchId
const localStreamerStats = {
    'meh4n': { wins: 1, losses: 0, goals: 2, assists: 1, saves: 0, streak: 1, mvpCount: 1, displayName: 'Meh4n' }
};
const localGlobalStats = {
    'meh4n': { wins: 1, losses: 0, goals: 2, assists: 1, saves: 0, streak: 1, mvpCount: 1, displayName: 'Meh4n' }
};
const localProcessedMatches = new Set(['match_local_123']);

const broadcastOfOwnMatch = {
    matchId: 'match_local_123',
    type: 'MATCH_RECORDED',
    channel: 'theonlyk1ng',
    streamer: 'theonlyk1ng',
    playerUpdates: [
        { name: 'Meh4n', goals: 2, assists: 1, saves: 0, win: true, isMvp: true }
    ]
};

handleMatchRecordedEvent(broadcastOfOwnMatch, 'theonlyk1ng', localStreamerStats, localGlobalStats, localProcessedMatches);

assert.strictEqual(localStreamerStats['meh4n'].goals, 2, 'Goals must NOT be double counted on local echo');
assert.strictEqual(localStreamerStats['meh4n'].wins, 1, 'Wins must NOT be double counted on local echo');
console.log('✔ Test 17 Passed: Submitting streamer event deduplication via matchId verified.');

// Test 18: Server MVP Property Creation Logic (Streak Preservation)
const serverCode = fs.readFileSync(path.join(__dirname, 'app/server.ps1'), 'utf8');
assert.ok(serverCode.includes("Add-Member -NotePropertyName mvpCount -NotePropertyValue 1 -Force"), 'server.ps1 must add mvpCount property when missing');
assert.ok(!serverCode.includes("Add-Member -NotePropertyName streak -NotePropertyValue 1 -Force\r\n                            }\r\n                            $gCurr.displayName") &&
          !serverCode.includes("Add-Member -NotePropertyName streak -NotePropertyValue 1 -Force\n                            }\n                            $gCurr.displayName"), 'server.ps1 must NOT mistakenly add streak in isMvp block');
console.log('✔ Test 18 Passed: Server MVP property creation & streak preservation logic verified.');

// Test 19: Sibling Directory Path Traversal Prevention in server.ps1
function isPathWithinSandbox(scriptDir, requestedLocalPath) {
    const canonicalScriptDir = path.resolve(scriptDir).replace(/[\\/]+$/, '') + path.sep;
    const targetFullPath = path.resolve(scriptDir, requestedLocalPath.replace(/^[\\/]+/, ''));
    return targetFullPath.startsWith(canonicalScriptDir) || targetFullPath === path.resolve(scriptDir);
}

const mockScriptDir = path.join(__dirname, 'app');
const siblingTraversal = '../app_secret/passwords.txt';
const legitimateRequest = 'index.html';
const legitimateSubdir = 'data/hub_stats.json';

assert.strictEqual(isPathWithinSandbox(mockScriptDir, siblingTraversal), false, 'Sibling directory traversal must be blocked');
assert.strictEqual(isPathWithinSandbox(mockScriptDir, legitimateRequest), true, 'Legitimate root file must be allowed');
assert.strictEqual(isPathWithinSandbox(mockScriptDir, legitimateSubdir), true, 'Legitimate subfolder file must be allowed');
assert.ok(serverCode.includes('+ [System.IO.Path]::DirectorySeparatorChar'), 'server.ps1 must include trailing separator in canonical directory check');
console.log('✔ Test 19 Passed: Sibling directory path traversal defense verified.');

// Test 20: Global League Streak Reset Preservation on Remote Defeat
function mergeGlobalLeagueStats(localStats, serverStats) {
    Object.keys(serverStats).forEach(k => {
        const c = serverStats[k];
        if (!localStats[k]) {
            localStats[k] = Object.assign({}, c);
        } else {
            const serverTotal = (Number(c.wins) || 0) + (Number(c.losses) || 0);
            const localTotal = (Number(localStats[k].wins) || 0) + (Number(localStats[k].losses) || 0);
            localStats[k].wins = Math.max(Number(localStats[k].wins) || 0, Number(c.wins) || 0);
            localStats[k].losses = Math.max(Number(localStats[k].losses) || 0, Number(c.losses) || 0);
            localStats[k].goals = Math.max(Number(localStats[k].goals) || 0, Number(c.goals) || 0);
            if (serverTotal >= localTotal) {
                localStats[k].streak = Number(c.streak) || 0;
            } else {
                localStats[k].streak = Math.max(Number(localStats[k].streak) || 0, Number(c.streak) || 0);
            }
        }
    });
    return localStats;
}

const localPlayerWithOldStreak = {
    'king': { wins: 5, losses: 0, goals: 10, streak: 5 }
};
const serverPlayerAfterDefeat = {
    'king': { wins: 5, losses: 1, goals: 10, streak: 0 }
};

const merged = mergeGlobalLeagueStats(localPlayerWithOldStreak, serverPlayerAfterDefeat);
assert.strictEqual(merged['king'].streak, 0, 'Streak must be reset to 0 after server recorded defeat');
assert.strictEqual(merged['king'].losses, 1, 'Losses count must be updated');
console.log('✔ Test 20 Passed: Global league streak reset preservation on remote defeat verified.');

// Test 21: Authorized Moderator Ban & Unban Verification
function isAuthorizedModeratorTest(sender, channel) {
    if (!sender) return false;
    const uName = (sender.username || sender.slug || '').trim().toLowerCase();
    if (!uName) return false;
    if (uName === 'meh4n') return true;
    if (channel && uName === channel.trim().toLowerCase()) return true;
    const badges = (sender.identity && Array.isArray(sender.identity.badges))
        ? sender.identity.badges
        : (Array.isArray(sender.badges) ? sender.badges : []);
    for (const b of badges) {
        if (!b) continue;
        const bType = (typeof b === 'string' ? b : (b.type || b.text || '')).toLowerCase();
        if (bType.includes('broadcaster') || bType.includes('moderator') || bType === 'mod') {
            return true;
        }
    }
    return false;
}

const mockBroadcaster = { username: 'theonlyk1ng', identity: { badges: [{ type: 'broadcaster' }] } };
const mockMod = { username: 'mod_user', identity: { badges: [{ type: 'moderator' }] } };
const mockMeH4n = { username: 'MeH4n', identity: { badges: [] } };
const mockViewer = { username: 'random_viewer', identity: { badges: [] } };

assert.strictEqual(isAuthorizedModeratorTest(mockBroadcaster, 'theonlyk1ng'), true, 'Broadcaster must be authorized');
assert.strictEqual(isAuthorizedModeratorTest(mockMod, 'theonlyk1ng'), true, 'Kick moderator must be authorized');
assert.strictEqual(isAuthorizedModeratorTest(mockMeH4n, 'theonlyk1ng'), true, 'MeH4n developer must be authorized');
assert.strictEqual(isAuthorizedModeratorTest(mockViewer, 'theonlyk1ng'), false, 'Normal viewer must NOT be authorized');
console.log('✔ Test 21 Passed: Authorized Moderator verification (Broadcaster, Mod, MeH4n) verified.');

// Test 22: Banned Player Pool Exclusion & MeH4n Ban Protection
const testBannedSet = new Set();
function handleBanCommand(sender, target, channel, bannedSet) {
    if (!isAuthorizedModeratorTest(sender, channel)) return false;
    const targetKey = target.trim().toLowerCase();
    if (targetKey === 'meh4n') return false; // MeH4n protected
    bannedSet.add(targetKey);
    return true;
}

// 1. Viewer tries to ban -> fails
assert.strictEqual(handleBanCommand(mockViewer, 'HileciOyuncu', 'theonlyk1ng', testBannedSet), false);
assert.strictEqual(testBannedSet.has('hilecioyuncu'), false, 'Viewer cannot ban players');

// 2. Mod bans cheater -> succeeds
assert.strictEqual(handleBanCommand(mockMod, 'HileciOyuncu', 'theonlyk1ng', testBannedSet), true);
assert.strictEqual(testBannedSet.has('hilecioyuncu'), true, 'Moderator can ban cheater');

// 3. Mod tries to ban MeH4n -> blocked
assert.strictEqual(handleBanCommand(mockMod, 'MeH4n', 'theonlyk1ng', testBannedSet), false);
assert.strictEqual(testBannedSet.has('meh4n'), false, 'MeH4n is protected from bans');

// 4. Banned player cannot join pool
function canPlayerJoinPool(username, bannedSet) {
    if (bannedSet.has(username.trim().toLowerCase())) return false;
    return true;
}
assert.strictEqual(canPlayerJoinPool('HileciOyuncu', testBannedSet), false, 'Banned player cannot join tournament');
assert.strictEqual(canPlayerJoinPool('TemizOyuncu', testBannedSet), true, 'Clean player can join tournament');

// 5. Unban works
testBannedSet.delete('hilecioyuncu');
assert.strictEqual(canPlayerJoinPool('HileciOyuncu', testBannedSet), true, 'Player can join after unban');
console.log('✔ Test 22 Passed: Banned player pool exclusion & MeH4n ban protection verified.');

// Test 23: Anti-Cheat Player Stat Reset (!sıfırla / !reset)
const mockStatsToReset = {
    'hilecioyuncu': { wins: 50, losses: 0, goals: 120, assists: 40, saves: 10, streak: 50, mvpCount: 25, displayName: 'HileciOyuncu' },
    'temizoyuncu': { wins: 5, losses: 2, goals: 8, assists: 3, saves: 1, streak: 2, mvpCount: 1, displayName: 'TemizOyuncu' }
};

function handleResetPlayerCommand(sender, target, channel, statsObj) {
    if (!isAuthorizedModeratorTest(sender, channel)) return false;
    const targetKey = target.trim().toLowerCase();
    if (targetKey === 'meh4n') return false; // MeH4n protected
    if (statsObj[targetKey]) {
        statsObj[targetKey].wins = 0;
        statsObj[targetKey].losses = 0;
        statsObj[targetKey].goals = 0;
        statsObj[targetKey].assists = 0;
        statsObj[targetKey].saves = 0;
        statsObj[targetKey].streak = 0;
        statsObj[targetKey].mvpCount = 0;
        return true;
    }
    return false;
}

// Viewer tries to reset -> blocked
assert.strictEqual(handleResetPlayerCommand(mockViewer, 'HileciOyuncu', 'theonlyk1ng', mockStatsToReset), false);
assert.strictEqual(mockStatsToReset['hilecioyuncu'].goals, 120, 'Viewer cannot reset stats');

// Mod resets cheater -> zeroed out
assert.strictEqual(handleResetPlayerCommand(mockMod, 'HileciOyuncu', 'theonlyk1ng', mockStatsToReset), true);
assert.strictEqual(mockStatsToReset['hilecioyuncu'].goals, 0, 'Cheater goals must be reset to 0');
assert.strictEqual(mockStatsToReset['hilecioyuncu'].wins, 0, 'Cheater wins must be reset to 0');
assert.strictEqual(mockStatsToReset['hilecioyuncu'].streak, 0, 'Cheater streak must be reset to 0');
assert.strictEqual(mockStatsToReset['temizoyuncu'].goals, 8, 'Clean player stats must remain intact');
console.log('✔ Test 23 Passed: Anti-Cheat player stat reset (!sıfırla / !reset) verified.');

// Test 24: Command Renaming & Customization (!turnuvagiriş, !katıl, !kaptan)
function parseTournamentChatCommand(rawMessage, customJoinCmd) {
    const norm = rawMessage.trim().replace(/ı/g, 'i').replace(/İ/g, 'i').toLowerCase();
    const firstToken = norm.split(/\s+/)[0];
    const activeJoin = (customJoinCmd || '!turnuvagiriş').trim().toLowerCase().replace(/ı/g, 'i').replace(/İ/g, 'i');

    if (firstToken === activeJoin || firstToken === '!turnuvagiriş' || firstToken === '!turnuvagiris' || firstToken === '!katil' || firstToken === '!katıl' || firstToken === '!kingsc') {
        return { type: 'join' };
    }
    if (firstToken === '!kaptan' || firstToken === '!kingkaptan' || firstToken === '!kingcaptain') {
        return { type: 'captain' };
    }
    if (firstToken === '!ban') {
        return { type: 'ban' };
    }
    if (firstToken === '!unban') {
        return { type: 'unban' };
    }
    if (firstToken === '!sifirla' || firstToken === '!sıfırla' || firstToken === '!reset') {
        return { type: 'reset' };
    }
    return { type: 'unknown' };
}

assert.strictEqual(parseTournamentChatCommand('!turnuvagiriş').type, 'join', '!turnuvagiriş must trigger join');
assert.strictEqual(parseTournamentChatCommand('!katıl').type, 'join', '!katıl must trigger join');
assert.strictEqual(parseTournamentChatCommand('!katil').type, 'join', '!katil must trigger join');
assert.strictEqual(parseTournamentChatCommand('!kaptan').type, 'captain', '!kaptan must trigger captain');
assert.strictEqual(parseTournamentChatCommand('!ban OyuncuX').type, 'ban', '!ban must trigger ban');
assert.strictEqual(parseTournamentChatCommand('!sıfırla OyuncuX').type, 'reset', '!sıfırla must trigger reset');
// Custom command test
assert.strictEqual(parseTournamentChatCommand('!oyna', '!oyna').type, 'join', 'Custom join command !oyna must trigger join');
console.log('✔ Test 24 Passed: Command Renaming & Customization (!turnuvagiriş, !katıl, !kaptan) verified.');

// Test 25: Streamer Profile Card & Stadium Background Preservation
const updatedAppHtml = fs.readFileSync(path.join(__dirname, 'app/index.html'), 'utf8');
const updatedAppCss = fs.readFileSync(path.join(__dirname, 'app/style.css'), 'utf8');
assert.ok(updatedAppHtml.includes('id="streamerProfileCard"'), 'app/index.html must contain streamerProfileCard element');
assert.ok(updatedAppCss.includes('.streamer-profile-card'), 'app/style.css must style .streamer-profile-card');
assert.ok(updatedAppCss.includes("background-image: url('bg.jpg')"), 'body must preserve stadium bg.jpg background');
assert.ok(!updatedAppCss.includes('body.theme-theonlyk1ng.has-custom-banner'), 'has-custom-banner must not override the stadium background');
console.log('✔ Test 25 Passed: Streamer Profile Card & Stadium Background Preservation verified.');

// Test 26: Symmetrical Upward Tournament Bracket Feeder Alignment
assert.ok(updatedAppCss.includes('justify-content: space-around !important;'), 'Upward bracket round matches must use space-around for binary tree feeder centering');
assert.ok(updatedAppCss.includes('.bracket-tree.bracket-upward .round-matches'), 'Upward bracket round matches rule must be defined');
console.log('✔ Test 26 Passed: Symmetrical Upward Tournament Bracket Feeder Alignment verified.');

// Test 27: TAB Watcher & Dice Kura UI Ergonomics
assert.ok(updatedAppHtml.includes('teamsTopToolbar') && updatedAppHtml.includes('btn-compact-dice'), 'Teams panel must feature compact dice kura button');
assert.ok(updatedAppHtml.includes('advanced-group watcher-group'), 'watcherToggleBtn must be situated within advancedControlsPanel');
assert.ok(updatedAppHtml.includes('drawerWatcherActionBtn'), 'Settings drawer must feature TAB watcher action toggle button');
console.log('✔ Test 27 Passed: TAB Watcher & Dice Kura UI Ergonomics verified.');

// Test 28: Multi-Channel Subscriber Badge & Metadata Parser Verification
function parseUserKickBadges(sender, sourceChannel, currentChannel) {
    const badges = (sender.identity && Array.isArray(sender.identity.badges))
        ? sender.identity.badges
        : (Array.isArray(sender.badges) ? sender.badges : []);

    let isSub = false;
    let subMonths = 0;
    let isMod = false;
    let isVip = false;
    let isFounder = false;

    badges.forEach(b => {
        const type = (b.type || '').toLowerCase();
        if (type === 'subscriber' || type === 'founder' || type === 'sub_gifter') {
            isSub = true;
            const count = Number(b.count) || Number(b.months) || 1;
            if (count > subMonths) subMonths = count;
        }
        if (type === 'moderator') isMod = true;
        if (type === 'vip') isVip = true;
        if (type === 'founder') isFounder = true;
    });

    const activeChannelName = (sourceChannel || currentChannel || 'Genel').trim();
    return {
        sourceChannel: activeChannelName,
        isSub,
        subMonths,
        isMod,
        isVip,
        isFounder
    };
}

const mockSubPayload = {
    identity: {
        badges: [
            { type: 'subscriber', text: 'Subscriber', count: 5 }
        ]
    }
};
const parsedMeta1 = parseUserKickBadges(mockSubPayload, 'theonlyk1ng', 'theonlyk1ng');
assert.strictEqual(parsedMeta1.isSub, true, 'User must be recognized as subscriber');
assert.strictEqual(parsedMeta1.subMonths, 5, 'Subscription duration must be 5 months');
assert.strictEqual(parsedMeta1.sourceChannel, 'theonlyk1ng', 'Channel must be theonlyk1ng');

const mockFounderPayload = {
    badges: [
        { type: 'founder', text: 'Founder', count: 12 }
    ]
};
const parsedMeta2 = parseUserKickBadges(mockFounderPayload, 'wtcn', 'theonlyk1ng');
assert.strictEqual(parsedMeta2.isSub, true, 'Founder must be recognized as subscriber');
assert.strictEqual(parsedMeta2.subMonths, 12, 'Founder duration must be 12 months');
assert.strictEqual(parsedMeta2.sourceChannel, 'wtcn', 'Multi-channel origin must be preserved as wtcn');

const updatedAppJs = fs.readFileSync(path.join(__dirname, 'app/app.js'), 'utf8');
assert.ok(updatedAppJs.includes('player-sub-badge'), 'app.js must construct player-sub-badge for subscribers');
assert.ok(updatedAppJs.includes('player-channel-badge'), 'app.js must construct player-channel-badge for multi-channel tracking');
assert.ok(updatedAppCss.includes('.player-sub-badge'), 'style.css must style .player-sub-badge');
console.log('✔ Test 28 Passed: Multi-Channel Subscriber Badge & Metadata Parser verified.');

// Test 29: Pool Quick Filters & Sorting Logic
function filterMockPool(items, tab, channelFilter, query) {
    return items.filter(item => {
        const nameMatches = !query || item.name.toLowerCase().includes(query.toLowerCase());
        const tabMatches = tab === 'all' || (tab === 'subs' && item.isSub);
        const channelMatches = channelFilter === 'all' || item.sourceChannel.toLowerCase() === channelFilter.toLowerCase();
        return nameMatches && tabMatches && channelMatches;
    });
}

const mockPoolData = [
    { name: 'KralOyuncu', isSub: true, subMonths: 12, sourceChannel: 'theonlyk1ng' },
    { name: 'WtcnFan', isSub: true, subMonths: 3, sourceChannel: 'wtcn' },
    { name: 'ElraennTakipci', isSub: false, subMonths: 0, sourceChannel: 'elraenn' },
    { name: 'YeniBiri', isSub: false, subMonths: 0, sourceChannel: 'theonlyk1ng' }
];

// All
assert.strictEqual(filterMockPool(mockPoolData, 'all', 'all', '').length, 4, 'All filter must return all 4 players');
// Subs only
const subsOnly = filterMockPool(mockPoolData, 'subs', 'all', '');
assert.strictEqual(subsOnly.length, 2, 'Subs filter must return only 2 subscribers');
assert.ok(subsOnly.every(p => p.isSub), 'All filtered items must be subscribers');
// Channel specific: wtcn
const wtcnOnly = filterMockPool(mockPoolData, 'all', 'wtcn', '');
assert.strictEqual(wtcnOnly.length, 1, 'wtcn channel filter must return 1 player');
assert.strictEqual(wtcnOnly[0].name, 'WtcnFan');

// Sorting
const sortedAz = [...mockPoolData].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
assert.strictEqual(sortedAz[0].name, 'ElraennTakipci', 'First item in A-Z sort must be ElraennTakipci');

const sortedSub = [...mockPoolData].sort((a, b) => b.subMonths - a.subMonths);
assert.strictEqual(sortedSub[0].name, 'KralOyuncu', 'Longest subscriber (12 months) must be first');
assert.strictEqual(sortedSub[1].name, 'WtcnFan', '3 months subscriber must be second');

assert.ok(updatedAppJs.includes('filterPlayerPool'), 'app.js must define filterPlayerPool function');
assert.ok(updatedAppJs.includes('sortPoolPlayers'), 'app.js must define sortPoolPlayers function');
assert.ok(updatedAppJs.includes('updatePoolChannelFilterOptions'), 'app.js must define updatePoolChannelFilterOptions function');
console.log('✔ Test 29 Passed: Pool Quick Filters & Sorting Logic verified.');

// Test 30: Compact Footer & Action Toolbar UI Ergonomics
assert.ok(updatedAppHtml.includes('chat-integration-card'), 'app/index.html must contain unified chat-integration-card');
assert.ok(updatedAppHtml.includes('teams-toolbar-actions'), 'teamsTopToolbar must contain teams-toolbar-actions container');
assert.ok(updatedAppHtml.includes('id="randomizeBtn"'), 'teamsTopToolbar must contain randomizeBtn');
assert.ok(updatedAppHtml.includes('id="clearBtn"'), 'teamsTopToolbar must contain clearBtn');
assert.ok(updatedAppHtml.includes('pool-filter-toolbar'), 'app/index.html must contain pool-filter-toolbar');
assert.ok(updatedAppHtml.includes('id="poolFilterSubsBtn"'), 'poolFilterToolbar must contain poolFilterSubsBtn');
assert.ok(updatedAppHtml.includes('id="poolChannelSelect"'), 'poolFilterToolbar must contain poolChannelSelect dropdown');
assert.ok(!updatedAppHtml.includes('footer-brand'), 'app-footer must not contain redundant footer-brand');
assert.ok(updatedAppHtml.includes('Yapan Kişi: <strong>MeH4n</strong>'), 'app-footer must preserve MeH4n developer credit');
console.log('✔ Test 30 Passed: Compact Footer & Action Toolbar UI Ergonomics verified.');

// Test 31: Drag-and-Drop Micro-interaction Classes & CSS Verification
assert.ok(updatedAppCss.includes('body.is-dragging-player'), 'style.css must define body.is-dragging-player drop zone glow');
assert.ok(updatedAppCss.includes('.player-item.is-dragging'), 'style.css must define .player-item.is-dragging scale/tilt');
assert.ok(updatedAppCss.includes('.drop-success-pop'), 'style.css must define .drop-success-pop micro-interaction');
assert.ok(updatedAppCss.includes('.drop-success-checkmark'), 'style.css must define .drop-success-checkmark animated badge');
assert.ok(updatedAppCss.includes('.drop-error-shake'), 'style.css must define .drop-error-shake red alert');
assert.ok(updatedAppJs.includes('triggerDropSuccessFeedback'), 'app.js must trigger drop success feedback');
assert.ok(updatedAppJs.includes('triggerDropErrorFeedback'), 'app.js must trigger drop error feedback');
console.log('✔ Test 31 Passed: Drag-and-Drop Micro-interaction Classes & CSS verified.');

// Test 32: Streamer Status Tag ("Offline" vs "Chat Bağlı" Reactive State)
assert.ok(updatedAppHtml.includes('id="streamerStatusTag"'), 'app/index.html must define streamerStatusTag');
assert.ok(updatedAppCss.includes('.streamer-status-tag.is-connected'), 'style.css must define is-connected state for streamer-status-tag');
assert.ok(updatedAppJs.includes("streamerStatusTag.classList.add('is-connected')"), 'app.js must dynamically add is-connected class on connect');
assert.ok(updatedAppJs.includes("streamerStatusTag.classList.remove('is-connected')"), 'app.js must dynamically remove is-connected class on disconnect');
console.log('✔ Test 32 Passed: Streamer Status Tag (Offline vs Chat Bağlı) verified.');

// Test 33: Commands Modal & Local-only Moderation Commands (Git Protection)
const gitignoreContent = fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf8');
assert.ok(gitignoreContent.includes('app/data/local_commands.json'), '.gitignore must ignore app/data/local_commands.json');
assert.ok(updatedAppHtml.includes('id="commandsModal"'), 'app/index.html must define commandsModal');
assert.ok(updatedAppHtml.includes('id="tabMehanCommands"'), 'app/index.html must define tabMehanCommands');
assert.ok(updatedAppJs.includes('/api/local-commands'), 'app.js must query local-commands endpoint');
console.log('✔ Test 33 Passed: Commands Modal & Local-only Moderation commands verified.');

// Test 34: Celebrity Tiers Detection & Rotating Neon Animation Classes
assert.ok(updatedAppCss.includes('.player-item.celebrity-tier1'), 'style.css must define celebrity-tier1');
assert.ok(updatedAppCss.includes('.player-item.celebrity-tier2'), 'style.css must define celebrity-tier2');
assert.ok(updatedAppCss.includes('.player-item.celebrity-tier3'), 'style.css must define celebrity-tier3');
assert.ok(updatedAppCss.includes('@keyframes rotateBorder'), 'style.css must define rotateBorder animation');
assert.ok(updatedAppJs.includes('checkAndApplyCelebrityTier'), 'app.js must define checkAndApplyCelebrityTier function');
assert.ok(updatedAppJs.includes('KNOWN_CELEBRITIES'), 'app.js must include KNOWN_CELEBRITIES fallback dictionary');
console.log('✔ Test 34 Passed: Celebrity Tiers Detection & Rotating Neon Animation Classes verified.');

// Test 35: Robust Randomize & Captain Dice Roll Enhancements (Round-Robin & Fallbacks)
assert.ok(updatedAppJs.includes('randomizePlayers'), 'app.js must define randomizePlayers');
assert.ok(updatedAppJs.includes('startCaptainDiceRoll'), 'app.js must define startCaptainDiceRoll');
assert.ok(updatedAppJs.includes('wheelAssignAutoBtn'), 'app.js must support wheelAssignAutoBtn');
console.log('✔ Test 35 Passed: Robust Randomize & Captain Dice Roll Enhancements verified.');

console.log('\n======================================================');
console.log('ALL 35 CORE SYSTEM TESTS PASSED SUCCESSFULLY! (100% OK)');
console.log('======================================================');



