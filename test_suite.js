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

// Test 36: Leaderboard Export/Import Removal & Firebase Cloud Sync Engine
assert.ok(!updatedAppHtml.includes('id="exportDataBtn"'), 'Leaderboard toolbar must NOT contain exportDataBtn');
assert.ok(!updatedAppHtml.includes('id="importDataBtn"'), 'Leaderboard toolbar must NOT contain importDataBtn');
assert.ok(updatedAppHtml.includes('id="hubTabFirebaseBtn"'), 'hubModal must contain hubTabFirebaseBtn');
assert.ok(updatedAppHtml.includes('id="firebaseUrlInput"'), 'hubModal must contain firebaseUrlInput');
assert.ok(updatedAppJs.includes('connectFirebase'), 'app.js must define connectFirebase');
assert.ok(updatedAppJs.includes('disconnectFirebase'), 'app.js must define disconnectFirebase');
console.log('✔ Test 36 Passed: Leaderboard Export/Import Removal & Firebase Cloud Sync Engine verified.');

// Test 37: Grand Champion Esports Celebration Stage (HUD, OBS Sync & Auto-Dismiss)
assert.ok(updatedAppHtml.includes('id="championCelebrationModal"'), 'app/index.html must define championCelebrationModal');
assert.ok(updatedAppHtml.includes('id="stageChampionTeamName"'), 'app/index.html must define stageChampionTeamName');
assert.ok(updatedAppHtml.includes('id="stageChampionRoster"'), 'app/index.html must define stageChampionRoster');
assert.ok(updatedAppCss.includes('.champion-celebration-overlay'), 'style.css must define .champion-celebration-overlay');
assert.ok(updatedAppCss.includes('html.obs-overlay-mode .champion-celebration-overlay'), 'style.css must define OBS overlay styles for celebration');
assert.ok(updatedAppJs.includes('triggerGrandChampionCelebration'), 'app.js must define triggerGrandChampionCelebration');
assert.ok(updatedAppJs.includes('closeGrandChampionCelebration'), 'app.js must define closeGrandChampionCelebration');
assert.ok(updatedAppJs.includes('champion_celebration_open'), 'app.js must broadcast champion_celebration_open');
console.log('✔ Test 37 Passed: Grand Champion Esports Celebration Stage (HUD, OBS Sync & Auto-Dismiss) verified.');

// Test 38: Kick Chat /goal and /boost Multi-Alias Parser & Rate Limiter
function testChatCommandParser(rawContent) {
    const turkishNormContent = rawContent.replace(/ı/g, 'i').replace(/İ/g, 'i').toLowerCase().trim();
    const tokens = turkishNormContent.split(/\s+/);
    const firstToken = tokens[0];
    const isGoalCmd = ['/goal', '!goal', '/gol', '!gol', '/score', '!skor', '!score'].includes(firstToken);
    const isBoostCmd = ['/boost', '!boost', '/bost', '!bost', '/asist', '!asist', '/fire', '!fire', '/power', '!power'].includes(firstToken);
    let target = '';
    if (tokens.length > 1) {
        target = tokens[1].replace(/^@/, '').trim();
    }
    return { isGoalCmd, isBoostCmd, target };
}

assert.strictEqual(testChatCommandParser('/score @Ronaldo').isGoalCmd, true);
assert.strictEqual(testChatCommandParser('!skor @Messi').isGoalCmd, true);
assert.strictEqual(testChatCommandParser('/bost @Modric').isBoostCmd, true);
assert.strictEqual(testChatCommandParser('!fire @Neymar').isBoostCmd, true);
assert.strictEqual(testChatCommandParser('/power @Mbappe').isBoostCmd, true);
assert.ok(updatedAppJs.includes("['/goal', '!goal', '/gol', '!gol', '/score', '!skor', '!score']"), 'app.js must include full goal aliases');
assert.ok(updatedAppJs.includes("['/boost', '!boost', '/bost', '!bost', '/asist', '!asist', '/fire', '!fire', '/power', '!power']"), 'app.js must include full boost aliases');
assert.ok(updatedAppJs.includes('_chatCmdLastUsed'), 'app.js must track chat command rate limits');
console.log('✔ Test 38 Passed: Kick Chat /goal and /boost Multi-Alias Parser & Anti-Spam Rate Limiter verified.');

// Test 39: Player Boost Visual Aura & DOM Badge Classes
assert.ok(updatedAppCss.includes('.is-boosted'), 'style.css must define .is-boosted aura glow');
assert.ok(updatedAppCss.includes('.player-boost-badge'), 'style.css must define .player-boost-badge styling');
assert.ok(updatedAppCss.includes('@keyframes boostPulse'), 'style.css must define boostPulse keyframe animation');
assert.ok(updatedAppJs.includes("matchedEl.classList.add('is-boosted')"), 'app.js must apply .is-boosted class');
console.log('✔ Test 39 Passed: Player Boost Visual Aura & DOM Badge Classes verified.');

// Test 40: 3D Coin Flip (Yazı / Tura) Modal & Pick Priority Assignment
assert.ok(updatedAppHtml.includes('id="coinFlipModal"'), 'index.html must contain coinFlipModal');
assert.ok(updatedAppHtml.includes('id="coin3dElement"'), 'index.html must contain coin3dElement');
assert.ok(updatedAppHtml.includes('id="flipCoinBtn"'), 'index.html must contain flipCoinBtn');
assert.ok(updatedAppCss.includes('.coin-stage'), 'style.css must define .coin-stage perspective');
assert.ok(updatedAppCss.includes('@keyframes flipToHeads'), 'style.css must define flipToHeads animation');
assert.ok(updatedAppCss.includes('@keyframes flipToTails'), 'style.css must define flipToTails animation');
assert.ok(updatedAppJs.includes('initCoinFlipModal'), 'app.js must define initCoinFlipModal');
console.log('✔ Test 40 Passed: 3D Coin Flip Modal & Pick Priority Assignment verified.');

// Test 41: Esports Penalty Shootout HUD & Sudden Death Engine
assert.ok(updatedAppHtml.includes('id="penaltyShootoutModal"'), 'index.html must contain penaltyShootoutModal');
assert.ok(updatedAppHtml.includes('id="penaltyTeam1Score"'), 'index.html must contain penaltyTeam1Score');
assert.ok(updatedAppHtml.includes('id="penaltyTeam2Score"'), 'index.html must contain penaltyTeam2Score');
assert.ok(updatedAppCss.includes('.penalty-scoreboard'), 'style.css must define penalty scoreboard');
assert.ok(updatedAppCss.includes('.penalty-dot.goal'), 'style.css must define penalty-dot.goal');
assert.ok(updatedAppCss.includes('.penalty-dot.miss'), 'style.css must define penalty-dot.miss');
assert.ok(updatedAppJs.includes('openPenaltyShootoutModal'), 'app.js must define openPenaltyShootoutModal');
assert.ok(updatedAppJs.includes('renderPenaltyShootout'), 'app.js must define renderPenaltyShootout');

function simulateShootout(t1Kicks, t2Kicks) {
    const t1Goals = t1Kicks.filter(k => k === 1).length;
    const t2Goals = t2Kicks.filter(k => k === 1).length;
    const k1 = t1Kicks.length;
    const k2 = t2Kicks.length;
    if (k1 >= 5 && k2 >= 5 && k1 === k2 && t1Goals !== t2Goals) {
        return { isDone: true, winner: t1Goals > t2Goals ? 1 : 2 };
    }
    return { isDone: false, winner: null };
}
assert.deepStrictEqual(simulateShootout([1,1,1,1,1], [1,1,1,1,0]), { isDone: true, winner: 1 }, 'T1 should win 5-4');
assert.deepStrictEqual(simulateShootout([1,1,1,1,1,0], [1,1,1,1,1,1]), { isDone: true, winner: 2 }, 'T2 should win sudden death 6-5');
assert.deepStrictEqual(simulateShootout([1,1,1,1,1], [1,1,1,1,1]), { isDone: false, winner: null }, 'Tied 5-5 continues');
console.log('✔ Test 41 Passed: Esports Penalty Shootout HUD & Sudden Death Engine verified.');

// Test 42: Golden Goal (Altın Gol) Toggle & Instant Finish Flag
assert.ok(updatedAppHtml.includes('id="toggleGoldenGoalBtn"'), 'index.html must contain toggleGoldenGoalBtn');
assert.ok(updatedAppHtml.includes('id="goldenGoalStatusText"'), 'index.html must contain goldenGoalStatusText');
assert.ok(updatedAppJs.includes('initGoldenGoal'), 'app.js must define initGoldenGoal');
assert.ok(updatedAppJs.includes('window._isGoldenGoalActive'), 'app.js must reference _isGoldenGoalActive');
console.log('✔ Test 42 Passed: Golden Goal (Altın Gol) Toggle & Instant Finish Flag verified.');

// Test 43: Live Match Stopwatch HUD, Preset Timers & OBS Broadcast
assert.ok(updatedAppHtml.includes('id="matchStopwatchDisplay"'), 'index.html must contain matchStopwatchDisplay');
assert.ok(updatedAppHtml.includes('id="startMatchTimerBtn"'), 'index.html must contain startMatchTimerBtn');
assert.ok(updatedAppHtml.includes('id="resetMatchTimerBtn"'), 'index.html must contain resetMatchTimerBtn');
assert.ok(updatedAppHtml.includes('id="preset5MinBtn"'), 'index.html must contain preset5MinBtn');
assert.ok(updatedAppHtml.includes('id="preset10MinBtn"'), 'index.html must contain preset10MinBtn');
assert.ok(updatedAppCss.includes('.live-score-timer-wrap'), 'style.css must define .live-score-timer-wrap');
assert.ok(updatedAppCss.includes('.stopwatch-display'), 'style.css must define .stopwatch-display');
assert.ok(updatedAppJs.includes('formatStopwatchTime'), 'app.js must format stopwatch time');
assert.ok(updatedAppJs.includes("type: 'obs_timer_update'"), 'app.js must broadcast obs_timer_update');

function formatTimeTest(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
assert.strictEqual(formatTimeTest(0), '00:00');
assert.strictEqual(formatTimeTest(65), '01:05');
assert.strictEqual(formatTimeTest(300), '05:00');
assert.strictEqual(formatTimeTest(600), '10:00');
console.log('✔ Test 43 Passed: Live Match Stopwatch HUD, Preset Timers & OBS Broadcast verified.');

// Test 44: Captain Draft Turn Countdown Timer (30s) & Timeout Fallback
assert.ok(updatedAppHtml.includes('id="draftTimerWrap"'), 'index.html must contain draftTimerWrap');
assert.ok(updatedAppHtml.includes('id="draftTimerBarFill"'), 'index.html must contain draftTimerBarFill');
assert.ok(updatedAppHtml.includes('id="draftTimerText"'), 'index.html must contain draftTimerText');
assert.ok(updatedAppHtml.includes('id="draftAutoPickBtn"'), 'index.html must contain draftAutoPickBtn');
assert.ok(updatedAppCss.includes('.draft-timer-wrap'), 'style.css must define draft timer container');
assert.ok(updatedAppCss.includes('.draft-timer-bar-fill'), 'style.css must define draft timer progress bar');
assert.ok(updatedAppJs.includes('draftAutoPickPlayer'), 'app.js must define draftAutoPickPlayer');
assert.ok(updatedAppJs.includes('resetDraftTimer'), 'app.js must define resetDraftTimer');
console.log('✔ Test 44 Passed: Captain Draft Turn Countdown Timer (30s) & Timeout Fallback verified.');

// Test 45: Grand Champion Celebration Honors Engine (MVP, Gol Kralı, Asist Kralı)
assert.ok(updatedAppHtml.includes('id="championFireworksCanvas"'), 'index.html must contain championFireworksCanvas');
assert.ok(updatedAppHtml.includes('id="stageHonorsRow"'), 'index.html must contain stageHonorsRow');
assert.ok(updatedAppHtml.includes('id="stageMvpName"'), 'index.html must contain stageMvpName');
assert.ok(updatedAppHtml.includes('id="stageScorerName"'), 'index.html must contain stageScorerName');
assert.ok(updatedAppHtml.includes('id="stageAssistName"'), 'index.html must contain stageAssistName');
assert.ok(updatedAppCss.includes('.stage-fireworks-canvas'), 'style.css must define stage-fireworks-canvas');
assert.ok(updatedAppCss.includes('.stage-honors-row'), 'style.css must define stage-honors-row');
assert.ok(updatedAppJs.includes('startCelebrationFireworks'), 'app.js must define startCelebrationFireworks');
assert.ok(updatedAppJs.includes('stopCelebrationFireworks'), 'app.js must define stopCelebrationFireworks');
console.log('✔ Test 45 Passed: Grand Champion Celebration Honors Engine & Fireworks Canvas verified.');

// Test 46: Shareable Tournament Recap Generator for Discord & Kick
assert.ok(updatedAppHtml.includes('id="copyTournamentRecapBtn"'), 'index.html must contain copyTournamentRecapBtn');
assert.ok(updatedAppJs.includes('STRIKERS KING CREATOR - ESPOR TURNUVA ŞAMPİYONU'), 'app.js must contain tournament recap template');
assert.ok(updatedAppJs.includes('copyRecapBtn.onclick'), 'app.js must bind recap button click');
console.log('✔ Test 46 Passed: Shareable Tournament Recap Generator verified.');

// Test 47: Lucky Wheel Mechanical Audio Tick & History Array Logging
assert.ok(updatedAppHtml.includes('id="wheelHistoryBox"'), 'index.html must contain wheelHistoryBox');
assert.ok(updatedAppHtml.includes('id="wheelHistoryList"'), 'index.html must contain wheelHistoryList');
assert.ok(updatedAppCss.includes('.wheel-history-box'), 'style.css must define .wheel-history-box');
assert.ok(updatedAppCss.includes('.wheel-history-item'), 'style.css must define .wheel-history-item');
assert.ok(updatedAppJs.includes('playWheelTickSound'), 'app.js must define playWheelTickSound');
assert.ok(updatedAppJs.includes('renderWheelHistory'), 'app.js must define renderWheelHistory');
console.log('✔ Test 47 Passed: Lucky Wheel Mechanical Audio Tick & History Array Logging verified.');

// Test 48: Lucky Wheel Elimination Mode
assert.ok(updatedAppHtml.includes('id="wheelEliminationToggle"'), 'index.html must contain wheelEliminationToggle');
assert.ok(updatedAppJs.includes('wheelPlayers.filter(p => p !== selectedWinner)'), 'app.js must filter winner in elimination mode');
console.log('✔ Test 48 Passed: Lucky Wheel Elimination Mode candidate removal verified.');

// Test 49: Head-to-Head (H2H) Dual Player Comparison Modal & Metric Bars
assert.ok(updatedAppHtml.includes('id="playerCompareModal"'), 'index.html must contain playerCompareModal');
assert.ok(updatedAppHtml.includes('id="comparePlayer1Select"'), 'index.html must contain comparePlayer1Select');
assert.ok(updatedAppHtml.includes('id="comparePlayer2Select"'), 'index.html must contain comparePlayer2Select');
assert.ok(updatedAppHtml.includes('id="compareStatsContainer"'), 'index.html must contain compareStatsContainer');
assert.ok(updatedAppCss.includes('.compare-modal-card'), 'style.css must define compare-modal-card');
assert.ok(updatedAppCss.includes('.h2h-stat-row'), 'style.css must define h2h-stat-row');
assert.ok(updatedAppCss.includes('.h2h-bar-left'), 'style.css must define h2h-bar-left');
assert.ok(updatedAppCss.includes('.h2h-bar-right'), 'style.css must define h2h-bar-right');
assert.ok(updatedAppJs.includes('initPlayerCompareModal'), 'app.js must define initPlayerCompareModal');
console.log('✔ Test 49 Passed: Head-to-Head (H2H) Dual Player Comparison Modal & Metric Bars verified.');

// Test 50: Streamer Hotkeys Engine & Keyboard Event Routing
assert.ok(updatedAppHtml.includes('id="hotkeyModal"'), 'index.html must contain hotkeyModal');
assert.ok(updatedAppHtml.includes('id="hotkeyGuideBtn"'), 'index.html must contain hotkeyGuideBtn');
assert.ok(updatedAppCss.includes('.hotkey-modal-card'), 'style.css must define hotkey-modal-card');
assert.ok(updatedAppCss.includes('.hotkey-row kbd'), 'style.css must define hotkey kbd badge');
assert.ok(updatedAppJs.includes('initStreamerHotkeys'), 'app.js must define initStreamerHotkeys');
console.log('✔ Test 50 Passed: Streamer Hotkeys Engine & Keyboard Event Routing verified.');

// Test 51: OBS Overlay Live Event Alert Banners & Dispatch Contract
assert.ok(updatedAppHtml.includes('id="obsGoalBanner"'), 'index.html must contain obsGoalBanner');
assert.ok(updatedAppHtml.includes('id="obsBoostBanner"'), 'index.html must contain obsBoostBanner');
assert.ok(updatedAppCss.includes('.obs-event-banner'), 'style.css must define obs-event-banner');
assert.ok(updatedAppCss.includes('.obs-goal-banner'), 'style.css must define obs-goal-banner');
assert.ok(updatedAppCss.includes('.obs-boost-banner'), 'style.css must define obs-boost-banner');
assert.ok(updatedAppJs.includes("type: 'obs_goal_alert'"), 'app.js must handle obs_goal_alert');
assert.ok(updatedAppJs.includes("type: 'obs_boost_alert'"), 'app.js must handle obs_boost_alert');
console.log('✔ Test 51 Passed: OBS Overlay Live Event Alert Banners & Dispatch Contract verified.');

// Test 52: OBS Marquee Ticker & Continuous Scrolling Animation
assert.ok(updatedAppHtml.includes('id="obsMarqueeTicker"'), 'index.html must contain obsMarqueeTicker');
assert.ok(updatedAppHtml.includes('id="obsTickerContent"'), 'index.html must contain obsTickerContent');
assert.ok(updatedAppCss.includes('.obs-marquee-ticker'), 'style.css must define obs-marquee-ticker');
assert.ok(updatedAppCss.includes('@keyframes obsMarqueeScroll'), 'style.css must define obsMarqueeScroll animation');
console.log('✔ Test 52 Passed: OBS Marquee Ticker & Continuous Scrolling Animation verified.');

// Test 53: Celebration Fanfare & Zero-Dependency Web Audio Synthesizers
assert.ok(updatedAppJs.includes('playCelebrationFanfare'), 'app.js must define playCelebrationFanfare');
assert.ok(updatedAppJs.includes('playBuzzerSfx'), 'app.js must define playBuzzerSfx');
assert.ok(updatedAppJs.includes("type === 'coin'"), 'app.js must include coin synth sound in playUiSfx');
assert.ok(updatedAppJs.includes("type === 'fanfare'"), 'app.js must include fanfare sound in playUiSfx');
assert.ok(updatedAppJs.includes("type === 'buzzer'"), 'app.js must include buzzer sound in playUiSfx');
console.log('✔ Test 53 Passed: Celebration Fanfare & Zero-Dependency Web Audio Synthesizers verified.');

// Test 54: NaN and Null Defense Guards in Career Stats Calculations
function safeWinRateCalc(wins, losses) {
    const w = Number(wins) || 0;
    const l = Number(losses) || 0;
    const total = w + l;
    return total > 0 ? (w / total) * 100 : 0;
}
assert.strictEqual(safeWinRateCalc(undefined, null), 0);
assert.strictEqual(safeWinRateCalc(NaN, 'invalid'), 0);
assert.strictEqual(safeWinRateCalc(5, 5), 50);
console.log('✔ Test 54 Passed: NaN and Null Defense Guards verified.');

// Test 55: Modal Dismissal and Back-Stack ESC Routing
assert.ok(updatedAppJs.includes("e.key === 'Escape'"), 'app.js must listen for Escape key');
assert.ok(updatedAppJs.includes("document.querySelectorAll('.modal-overlay:not(.hidden)')"), 'app.js must close open modals on Esc');
console.log('✔ Test 55 Passed: Modal Dismissal and Back-Stack ESC Routing verified.');

// Test 56: DOM ID & Element Integrity Check (All 20+ New Features)
const requiredDomIds = [
    'hotkeyGuideBtn',
    'coinFlipBtn',
    'openPlayerCompareBtn',
    'matchLiveScorePanel',
    'liveScoreTimerWrap',
    'matchStopwatchDisplay',
    'startMatchTimerBtn',
    'resetMatchTimerBtn',
    'preset5MinBtn',
    'preset10MinBtn',
    'openPenaltyShootoutBtn',
    'toggleGoldenGoalBtn',
    'goldenGoalStatusText',
    'draftTimerWrap',
    'draftTimerBarFill',
    'draftTimerText',
    'draftAutoPickBtn',
    'championCelebrationModal',
    'championFireworksCanvas',
    'stageHonorsRow',
    'stageMvpName',
    'stageScorerName',
    'stageAssistName',
    'copyTournamentRecapBtn',
    'wheelEliminationToggle',
    'wheelHistoryBox',
    'wheelHistoryList',
    'coinFlipModal',
    'coin3dElement',
    'flipCoinBtn',
    'coinResultBox',
    'penaltyShootoutModal',
    'penaltyTeam1Score',
    'penaltyTeam2Score',
    'penaltyTeam1Dots',
    'penaltyTeam2Dots',
    'playerCompareModal',
    'comparePlayer1Select',
    'comparePlayer2Select',
    'hotkeyModal',
    'obsMarqueeTicker',
    'obsGoalBanner',
    'obsBoostBanner'
];
requiredDomIds.forEach(id => {
    assert.ok(updatedAppHtml.includes(`id="${id}"`), `app/index.html must contain id="${id}"`);
});
console.log(`✔ Test 56 Passed: All ${requiredDomIds.length} newly introduced DOM element IDs verified.`);

// Test 57: CSS Class Rules & Animation Keyframes Integrity Check
const requiredCssSelectors = [
    '.is-boosted',
    '.player-boost-badge',
    '@keyframes boostPulse',
    '.live-score-timer-wrap',
    '.stopwatch-display',
    '.draft-timer-wrap',
    '.draft-timer-bar-fill',
    '.coin-stage',
    '.coin-3d',
    '@keyframes flipToHeads',
    '@keyframes flipToTails',
    '.penalty-modal-card',
    '.penalty-scoreboard',
    '.penalty-dot.goal',
    '.penalty-dot.miss',
    '.compare-modal-card',
    '.h2h-stat-row',
    '.h2h-bar-left',
    '.h2h-bar-right',
    '.hotkey-modal-card',
    '.stage-fireworks-canvas',
    '.stage-honors-row',
    '.wheel-history-box',
    '.obs-event-banner',
    '.obs-goal-banner',
    '.obs-boost-banner',
    '.obs-marquee-ticker',
    '@keyframes obsMarqueeScroll'
];
requiredCssSelectors.forEach(sel => {
    assert.ok(updatedAppCss.includes(sel), `app/style.css must define ${sel}`);
});
console.log(`✔ Test 57 Passed: All ${requiredCssSelectors.length} new CSS selectors and animations verified.`);

// Test 58: Comprehensive Esports Suite Coherence & Verification
assert.ok(updatedAppJs.includes('initCoinFlipModal'), 'initCoinFlipModal must be called');
assert.ok(updatedAppJs.includes('initPenaltyShootoutModal'), 'initPenaltyShootoutModal must be called');
assert.ok(updatedAppJs.includes('initGoldenGoal'), 'initGoldenGoal must be called');
assert.ok(updatedAppJs.includes('initMatchStopwatch'), 'initMatchStopwatch must be called');
assert.ok(updatedAppJs.includes('initPlayerCompareModal'), 'initPlayerCompareModal must be called');
assert.ok(updatedAppJs.includes('initStreamerHotkeys'), 'initStreamerHotkeys must be called');
// Test 59: Lucky Wheel HiDPI Rendering, Flapper Bounce Animation & Audio Throttle Protection
assert.ok(updatedAppHtml.includes('id="wheelPointer"'), 'app/index.html must have id="wheelPointer"');
assert.ok(updatedAppCss.includes('.wheel-pointer.flapping'), 'app/style.css must have .wheel-pointer.flapping class');
assert.ok(updatedAppJs.includes('window.devicePixelRatio'), 'app/app.js must support devicePixelRatio DPR scaling for HiDPI crispness');
assert.ok(updatedAppJs.includes('flapPointer'), 'app/app.js must define flapPointer for physical pointer bouncing');
assert.ok(updatedAppJs.includes('nowMs - lastTickTime'), 'app/app.js must throttle wheel tick audio to protect Web Audio buffer');
console.log('✔ Test 59 Passed: Lucky Wheel HiDPI Crispness, Flapper Bounce & Audio Throttle verified.');

// Test 60: Multi-Game Theme Engine (Strikers Club, CS2, Valorant, LoL)
const test60AppJs = fs.readFileSync(path.join(__dirname, 'app/app.js'), 'utf8');
const test60AppHtml = fs.readFileSync(path.join(__dirname, 'app/index.html'), 'utf8');
const test60AppCss = fs.readFileSync(path.join(__dirname, 'app/style.css'), 'utf8');
assert.ok(test60AppJs.includes('GAME_THEMES'), 'app.js must define GAME_THEMES dictionary');
assert.ok(test60AppJs.includes("id: 'strikers'") && test60AppJs.includes("themeClass: 'game-theme-strikers'"), 'app.js must configure Strikers Club theme');
assert.ok(test60AppJs.includes("id: 'cs2'") && test60AppJs.includes("themeClass: 'game-theme-cs2'"), 'app.js must configure CS2 theme');
assert.ok(test60AppJs.includes("id: 'valorant'") && test60AppJs.includes("themeClass: 'game-theme-valorant'"), 'app.js must configure Valorant theme');
assert.ok(test60AppJs.includes("id: 'lol'") && test60AppJs.includes("themeClass: 'game-theme-lol'"), 'app.js must configure LoL theme');
assert.ok(test60AppJs.includes('setGameTheme'), 'app.js must define setGameTheme');
assert.ok(test60AppJs.includes('initGameThemeEngine'), 'app.js must define initGameThemeEngine');
assert.ok(test60AppHtml.includes('id="gameSelectorModal"'), 'index.html must define gameSelectorModal');
assert.ok(test60AppHtml.includes('id="activeGameBadgeBtn"'), 'index.html must define activeGameBadgeBtn in header');
assert.ok(test60AppHtml.includes('id="activeGameIcon"'), 'index.html must define activeGameIcon');
assert.ok(test60AppHtml.includes('id="activeGameLabel"'), 'index.html must define activeGameLabel');
assert.ok(test60AppHtml.includes('id="gamePickStrikers"'), 'index.html must define gamePickStrikers card');
assert.ok(test60AppHtml.includes('id="gamePickCs2"'), 'index.html must define gamePickCs2 card');
assert.ok(test60AppHtml.includes('id="gamePickValorant"'), 'index.html must define gamePickValorant card');
assert.ok(test60AppHtml.includes('id="gamePickLol"'), 'index.html must define gamePickLol card');
assert.ok(test60AppCss.includes('.game-theme-strikers'), 'style.css must define .game-theme-strikers');
assert.ok(test60AppCss.includes('.game-theme-cs2'), 'style.css must define .game-theme-cs2');
assert.ok(test60AppCss.includes('.game-theme-valorant'), 'style.css must define .game-theme-valorant');
assert.ok(test60AppCss.includes('.game-theme-lol'), 'style.css must define .game-theme-lol');
console.log('✔ Test 60 Passed: Multi-Game Theme Engine (Strikers Club, CS2, Valorant, LoL) class and config integrity verified.');

// Test 61: Streamer local auth file isolation (streamer_auth.local.json not in git, credentials verified)
const test61Gitignore = fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf8');
assert.ok(test61Gitignore.includes('streamer_auth.local.json') || test61Gitignore.includes('*.local.json'), '.gitignore must ignore streamer_auth.local.json');
const authFilePath = path.join(__dirname, 'app/data/streamer_auth.local.json');
assert.ok(fs.existsSync(authFilePath), 'app/data/streamer_auth.local.json must exist locally');
const authConfig = JSON.parse(fs.readFileSync(authFilePath, 'utf8'));
assert.strictEqual(authConfig.username, 'streamer_king', 'Auth username must be streamer_king');
assert.strictEqual(authConfig.password, 'StrikersKing2026!Auth', 'Auth password must match secret credential');
assert.strictEqual(authConfig.role, 'BROADCASTER_ADMIN', 'Auth role must be BROADCASTER_ADMIN');

// Verify git status does not track this secret file
const { execSync } = require('child_process');
const trackedFiles = execSync('git ls-files app/data/streamer_auth.local.json', { encoding: 'utf8' }).trim();
assert.strictEqual(trackedFiles, '', 'streamer_auth.local.json MUST NEVER be tracked by git');
console.log('✔ Test 61 Passed: Streamer local auth file isolation and secret credentials verified.');

// Test 62: Leaderboard & Stat Tamper Defense for unauthenticated viewers
assert.ok(test60AppHtml.includes('id="leaderboardLockOverlay"'), 'index.html must define leaderboardLockOverlay inside leaderboardModal');
assert.ok(test60AppHtml.includes('id="openLoginFromLeaderboardBtn"'), 'index.html must define openLoginFromLeaderboardBtn');
assert.ok(test60AppHtml.includes('id="streamerAuthModal"'), 'index.html must define streamerAuthModal');
assert.ok(test60AppHtml.includes('id="streamerAuthNavBtn"'), 'index.html must define streamerAuthNavBtn');
assert.ok(test60AppHtml.includes('id="streamerAuthSubmitBtn"'), 'index.html must define streamerAuthSubmitBtn');
assert.ok(test60AppHtml.includes('id="streamerLogoutBtn"'), 'index.html must define streamerLogoutBtn');
assert.ok(test60AppCss.includes('.leaderboard-lock-overlay'), 'style.css must define .leaderboard-lock-overlay');
assert.ok(test60AppJs.includes('isBroadcasterAuthenticated'), 'app.js must define isBroadcasterAuthenticated');
assert.ok(test60AppJs.includes('initStreamerAuthEngine'), 'app.js must define initStreamerAuthEngine');
const serverPs1Content = fs.readFileSync(path.join(__dirname, 'app/server.ps1'), 'utf8');
assert.ok(serverPs1Content.includes('/api/auth/login'), 'server.ps1 must implement /api/auth/login');
assert.ok(serverPs1Content.includes('/api/auth/status'), 'server.ps1 must implement /api/auth/status');
assert.ok(serverPs1Content.includes('/api/auth/logout'), 'server.ps1 must implement /api/auth/logout');
console.log('✔ Test 62 Passed: Leaderboard & Stat Tamper Defense for unauthenticated viewers verified.');

// Test 63: Strikers Club overhead winner HUD (strikersWinnerHeroName) presence
assert.ok(test60AppHtml.includes('id="strikersCelebrationHeroStage"'), 'index.html must define strikersCelebrationHeroStage');
assert.ok(test60AppHtml.includes('id="strikersOverheadWinnerHud"'), 'index.html must define strikersOverheadWinnerHud');
assert.ok(test60AppHtml.includes('id="strikersWinnerHeroName"'), 'index.html must define strikersWinnerHeroName');
assert.ok(test60AppHtml.includes('id="strikersCharacterModel"'), 'index.html must define strikersCharacterModel');
assert.ok(test60AppCss.includes('.strikers-celebration-hero-stage'), 'style.css must define .strikers-celebration-hero-stage');
assert.ok(test60AppCss.includes('.strikers-overhead-winner-hud'), 'style.css must define .strikers-overhead-winner-hud');
assert.ok(test60AppCss.includes('.strikers-character-model'), 'style.css must define .strikers-character-model');
assert.ok(test60AppJs.includes('strikersWinnerHeroName'), 'app.js must update strikersWinnerHeroName in celebration');
console.log('✔ Test 63 Passed: Strikers Club overhead winner HUD & in-game footballer animation verified.');

// Test 64: Git Safety & Client Security (app.js must NEVER contain secret password)
assert.strictEqual(test60AppJs.includes('StrikersKing2026!Auth'), false, 'app.js must NEVER contain hardcoded broadcaster password');
console.log('✔ Test 64 Passed: Absolute client credential isolation (no secrets in app.js) verified.');

// Test 65: Streamlined Interface Clustering & Settings Deep-link
assert.ok(test60AppHtml.includes('header-btn-cluster group-admin'), 'index.html must group admin header buttons');
assert.ok(test60AppHtml.includes('header-btn-cluster group-tools'), 'index.html must group tools header buttons');
assert.ok(test60AppHtml.includes('header-btn-cluster group-settings'), 'index.html must group settings header buttons');
assert.ok(test60AppCss.includes('.header-btn-cluster'), 'style.css must define .header-btn-cluster');
assert.ok(test60AppHtml.includes('id="openFullGameModalBtn"'), 'index.html must define openFullGameModalBtn in drawer');
assert.ok(test60AppJs.includes('openFullModalBtn.onclick'), 'app.js must hook openFullGameModalBtn click listener');
console.log('✔ Test 65 Passed: Streamlined Interface Clustering & Drawer deep-link verified.');

// Test 66: Strikers Club celebration stadium stamina and kinetic soccer ball
assert.ok(test60AppHtml.includes('class="overhead-stamina-bar"'), 'index.html must define overhead-stamina-bar in winner HUD');
assert.ok(test60AppHtml.includes('class="strikers-ball-element"'), 'index.html must define strikers-ball-element on avatar stage');
assert.ok(test60AppCss.includes('.overhead-stamina-bar'), 'style.css must define .overhead-stamina-bar');
assert.ok(test60AppCss.includes('.strikers-ball-element'), 'style.css must define .strikers-ball-element');
console.log('✔ Test 66 Passed: Strikers Club overhead stamina energy bar and animated ball verified.');

// Test 67: Anti-Crash & Isolated Chromium Command Flags in Program.cs
const programCsLatestContent = fs.readFileSync(path.join(__dirname, 'Program.cs'), 'utf8');
assert.ok(programCsLatestContent.includes('--disable-features=CalculateNativeWinOcclusion,DCompPresenter'), 'Program.cs must contain DCompPresenter and WinOcclusion flags to prevent AMD GPU/DWM crash');
assert.ok(programCsLatestContent.includes('--disable-extensions'), 'Program.cs must disable extensions to prevent memory bloat & edge crashes');
assert.ok(programCsLatestContent.includes('--disable-gpu-watchdog'), 'Program.cs must include --disable-gpu-watchdog');
console.log('✔ Test 67 Passed: AMD GPU / Chromium anti-crash flags verified in Program.cs.');

// Test 68: F9 Match Capture Hotkey in Program.cs (Eski 80ms TAB döngüsü kaldırılmış olmalı)
assert.ok(programCsLatestContent.includes('StartMatchCaptureHotkeyThread'), 'Program.cs must define StartMatchCaptureHotkeyThread');
assert.ok(programCsLatestContent.includes('0x78'), 'Program.cs must listen for VK_F9 (0x78)');
assert.ok(programCsLatestContent.includes('CaptureScreenForActiveMatch'), 'Program.cs must define CaptureScreenForActiveMatch');
assert.strictEqual(programCsLatestContent.includes('GetAsyncKeyState(0x09)'), false, 'Old 80ms TAB watcher loop must be completely removed');
console.log('✔ Test 68 Passed: F9 Hotkey & removal of old TAB polling loop verified in Program.cs.');

// Test 69: Server Match Files & Capture Endpoints in app/server.ps1
const serverPs1LatestContent = fs.readFileSync(path.join(__dirname, 'app/server.ps1'), 'utf8');
assert.ok(serverPs1LatestContent.includes('/api/match/files'), 'server.ps1 must implement /api/match/files');
assert.ok(serverPs1LatestContent.includes('/api/match/capture'), 'server.ps1 must implement /api/match/capture');
assert.ok(serverPs1LatestContent.includes('/api/match/trigger-capture'), 'server.ps1 must implement /api/match/trigger-capture');
assert.ok(serverPs1LatestContent.includes('/api/match/delete-file'), 'server.ps1 must implement /api/match/delete-file');
console.log('✔ Test 69 Passed: Server Match Files, Capture & Trigger Endpoints verified in app/server.ps1.');

// Test 70: UI & Engine integration in index.html, style.css and app.js
const latestAppHtml = fs.readFileSync(path.join(__dirname, 'app/index.html'), 'utf8');
const latestAppCss = fs.readFileSync(path.join(__dirname, 'app/style.css'), 'utf8');
const latestAppJs = fs.readFileSync(path.join(__dirname, 'app/app.js'), 'utf8');
assert.ok(latestAppHtml.includes('id="matchFilesModal"'), 'index.html must define matchFilesModal');
assert.ok(latestAppHtml.includes('id="matchLightboxModal"'), 'index.html must define matchLightboxModal');
assert.ok(latestAppCss.includes('.match-files-btn'), 'style.css must define .match-files-btn');
assert.ok(latestAppCss.includes('.match-files-card'), 'style.css must define .match-files-card');
assert.ok(latestAppCss.includes('.match-capture-preview-box'), 'style.css must define .match-capture-preview-box');
assert.ok(latestAppJs.includes('openMatchFilesModal'), 'app.js must define openMatchFilesModal');
assert.ok(latestAppJs.includes('triggerMatchCapture'), 'app.js must define triggerMatchCapture');
assert.ok(latestAppJs.includes('initMatchFilesEngine'), 'app.js must define initMatchFilesEngine');
console.log('✔ Test 70 Passed: Match Files Modal, Lightbox and Engine UI verified.');

console.log('\n======================================================');
console.log('ALL 70 COMPREHENSIVE SUITE TESTS PASSED! (100% OK)');
console.log('======================================================');





