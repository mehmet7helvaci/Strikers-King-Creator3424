document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // Web Audio API - Audio Engine (Music, SFX & Settings Manager)
    // =========================================================================
    let audioCtx = null;

    let musicEnabled = localStorage.getItem('audio_music_enabled') !== 'false';
    let musicVolume = parseFloat(localStorage.getItem('audio_music_volume') || '40') / 100;
    let sfxEnabled = localStorage.getItem('audio_sfx_enabled') !== 'false';
    let sfxVolume = parseFloat(localStorage.getItem('audio_sfx_volume') || '70') / 100;

    let bgMusicGainNode = null;
    let bgMusicOscTimer = null;
    let bgMusicActive = false;

    function getAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    // 1. Background Music Synthesizer (Stadyum Synth Theme)
    function playBackgroundMusic() {
        if (!musicEnabled || bgMusicActive) return;
        const ctx = getAudioContext();
        if (!ctx) return;

        try {
            bgMusicActive = true;
            if (bgMusicGainNode) {
                try { bgMusicGainNode.disconnect(); } catch (e) {}
            }

            bgMusicGainNode = ctx.createGain();
            // Müzik ses miktarı 2 katına çıkarıldı (0.12 -> 0.24)
            bgMusicGainNode.gain.setValueAtTime(musicVolume * 0.24, ctx.currentTime);
            bgMusicGainNode.connect(ctx.destination);

            const bpm = 118;
            const stepTime = (60 / bpm) / 4; // 16th note
            let currentStep = 0;
            const chordNotes = [130.81, 164.81, 196.00, 261.63, 293.66, 329.63];

            bgMusicOscTimer = setInterval(() => {
                if (!musicEnabled || !bgMusicActive) return;
                const now = ctx.currentTime;

                // Bass pulse on quarter notes
                if (currentStep % 4 === 0) {
                    const bassOsc = ctx.createOscillator();
                    const bassGain = ctx.createGain();
                    bassOsc.type = 'triangle';
                    bassOsc.frequency.setValueAtTime(65.41, now);
                    bassOsc.frequency.exponentialRampToValueAtTime(32.7, now + 0.16);

                    bassGain.gain.setValueAtTime(0.20, now);
                    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

                    bassOsc.connect(bassGain);
                    bassGain.connect(bgMusicGainNode);
                    bassOsc.start(now);
                    bassOsc.stop(now + 0.20);
                }

                // Synth Arp Note on 16th steps
                const noteIndex = (currentStep * 3 + Math.floor(currentStep / 4)) % chordNotes.length;
                const noteFreq = chordNotes[noteIndex] * (currentStep % 8 === 0 ? 2 : 1);

                const arpOsc = ctx.createOscillator();
                const arpGain = ctx.createGain();
                arpOsc.type = 'sine';
                arpOsc.frequency.setValueAtTime(noteFreq, now);

                arpGain.gain.setValueAtTime(0.06, now);
                arpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

                arpOsc.connect(arpGain);
                arpGain.connect(bgMusicGainNode);
                arpOsc.start(now);
                arpOsc.stop(now + 0.13);

                // Her 64 adımda bir (16 ölçü) arka planda düşük desibelde hafif seyirci coşkusu
                if (currentStep % 64 === 0) {
                    playCrowdCheerSfx('ambient');
                }

                currentStep = (currentStep + 1) % 64;
            }, stepTime * 1000);

        } catch (e) {
            console.warn('BG Music error:', e);
        }
    }

    function stopBackgroundMusic() {
        bgMusicActive = false;
        if (bgMusicOscTimer) {
            clearInterval(bgMusicOscTimer);
            bgMusicOscTimer = null;
        }
        if (bgMusicGainNode) {
            try { bgMusicGainNode.disconnect(); } catch (e) {}
            bgMusicGainNode = null;
        }
    }

    function updateMusicVolume() {
        if (bgMusicGainNode && audioCtx) {
            // Müzik ses miktarı 2 katına çıkarıldı (0.12 -> 0.24)
            const vol = musicEnabled ? (musicVolume * 0.24) : 0;
            bgMusicGainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
        }
    }

    // Düşük Desibel Seyirci Çığlık / Coşku Sentezleyicisi (Crowd Cheer SFX)
    function playCrowdCheerSfx(intensity = 'low') {
        if (!sfxEnabled && intensity !== 'ambient') return;
        const ctx = getAudioContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const duration = intensity === 'high' ? 2.5 : (intensity === 'ambient' ? 3.0 : 1.8);
            const bufferSize = ctx.sampleRate * duration;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);

            // Pink noise filtering for crowd ambience
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                data[i] *= 0.11;
                b6 = white * 0.115926;
            }

            const noiseSrc = ctx.createBufferSource();
            noiseSrc.buffer = buffer;

            // Bandpass filter to simulate crowd vocal range
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1100, now);
            filter.Q.setValueAtTime(1.2, now);

            const gainNode = ctx.createGain();
            let targetVol = 0.04;
            if (intensity === 'high') targetVol = 0.10;
            else if (intensity === 'ambient') targetVol = 0.025; // Düşük desibel arka plan

            const finalVol = targetVol * sfxVolume;

            gainNode.gain.setValueAtTime(0.001, now);
            gainNode.gain.linearRampToValueAtTime(finalVol, now + 0.4);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

            noiseSrc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(ctx.destination);

            noiseSrc.start(now);
            noiseSrc.stop(now + duration + 0.05);
        } catch (e) {
            console.warn('Crowd cheer error:', e);
        }
    }

    // 2. UI Sound Effects Synthesizer
    function playUiSfx(type) {
        if (!sfxEnabled) return;
        const ctx = getAudioContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const sfxGainNode = ctx.createGain();
            sfxGainNode.gain.setValueAtTime(sfxVolume * 0.25, now);
            sfxGainNode.connect(ctx.destination);

            if (type === 'click') {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(750, now);
                osc.frequency.exponentialRampToValueAtTime(380, now + 0.05);

                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

                osc.connect(gain);
                gain.connect(sfxGainNode);
                osc.start(now);
                osc.stop(now + 0.06);
            } else if (type === 'join') {
                [523.25, 659.25, 783.99].forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.05);
                    gain.gain.setValueAtTime(0.2, now + idx * 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.15);
                    osc.connect(gain);
                    gain.connect(sfxGainNode);
                    osc.start(now + idx * 0.05);
                    osc.stop(now + idx * 0.05 + 0.16);
                });
            } else if (type === 'shuffle') {
                const osc = ctx.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.linearRampToValueAtTime(1100, now + 0.15);
                osc.frequency.linearRampToValueAtTime(280, now + 0.25);

                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1400, now);

                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(sfxGainNode);
                osc.start(now);
                osc.stop(now + 0.26);

                // Shuffle sırasında hafif seyirci coşkusu
                playCrowdCheerSfx('low');
            } else if (type === 'win') {
                [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.08);
                    gain.gain.setValueAtTime(0.3, now + idx * 0.08);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);
                    osc.connect(gain);
                    gain.connect(sfxGainNode);
                    osc.start(now + idx * 0.08);
                    osc.stop(now + idx * 0.08 + 0.42);
                });

                // Galibiyet anında coşkulu seyirci tezahüratı
                playCrowdCheerSfx('high');
            }
        } catch (e) {
            console.warn('UI SFX error:', e);
        }
    }

    // 3. Demirin Betona Çarpma Sesi (Iron on Concrete Impact Sound)
    function playIronOnConcreteSound(level = 'normal') {
        if (!sfxEnabled) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;

            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const now = ctx.currentTime;
            const isFinal = level === 'final' || level === 'climax';

            const masterGain = ctx.createGain();
            const baseGain = isFinal ? 0.50 : 0.32;
            masterGain.gain.setValueAtTime(baseGain * sfxVolume, now);
            masterGain.connect(ctx.destination);

            // A) Concrete Sub-Thud (Low Frequency Mass Impact 45Hz - 180Hz)
            const subOsc = ctx.createOscillator();
            subOsc.type = 'triangle';
            subOsc.frequency.setValueAtTime(isFinal ? 180 : 140, now);
            subOsc.frequency.exponentialRampToValueAtTime(38, now + 0.12);

            const subGain = ctx.createGain();
            subGain.gain.setValueAtTime(0.001, now);
            subGain.gain.linearRampToValueAtTime(0.85, now + 0.003);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

            subOsc.connect(subGain);
            subGain.connect(masterGain);

            // B) Concrete Crushing Noise Burst (Filtered Noise to simulate stone/concrete smash)
            const bufSize = Math.floor(ctx.sampleRate * 0.15);
            const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const data = noiseBuf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) {
                data[i] = (Math.random() * 2 - 1);
            }
            const noiseSrc = ctx.createBufferSource();
            noiseSrc.buffer = noiseBuf;

            const noiseFilter = ctx.createBiquadFilter();
            noiseFilter.type = 'lowpass';
            noiseFilter.frequency.setValueAtTime(750, now);

            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.6, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            noiseSrc.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(masterGain);

            // C) Sharp Metallic Ringing (Iron Beam strike resonance)
            const metalOsc1 = ctx.createOscillator();
            const metalOsc2 = ctx.createOscillator();
            metalOsc1.type = 'sine';
            metalOsc2.type = 'sine';

            const metalFreq1 = isFinal ? 1420 : 1180;
            const metalFreq2 = isFinal ? 2350 : 1850;

            metalOsc1.frequency.setValueAtTime(metalFreq1, now);
            metalOsc1.frequency.exponentialRampToValueAtTime(metalFreq1 * 0.8, now + 0.25);

            metalOsc2.frequency.setValueAtTime(metalFreq2, now);
            metalOsc2.frequency.exponentialRampToValueAtTime(metalFreq2 * 0.85, now + 0.18);

            const metalGain = ctx.createGain();
            metalGain.gain.setValueAtTime(0.001, now);
            metalGain.gain.linearRampToValueAtTime(0.35, now + 0.002);
            metalGain.gain.exponentialRampToValueAtTime(0.0001, now + (isFinal ? 0.35 : 0.22));

            metalOsc1.connect(metalGain);
            metalOsc2.connect(metalGain);
            metalGain.connect(masterGain);

            subOsc.start(now);
            noiseSrc.start(now);
            metalOsc1.start(now);
            metalOsc2.start(now);

            subOsc.stop(now + 0.15);
            noiseSrc.stop(now + 0.15);
            metalOsc1.stop(now + 0.38);
            metalOsc2.stop(now + 0.38);
        } catch (e) {
            console.warn('Iron on concrete sound error:', e);
        }
    }

    const playDeepIronStrikeSound = playIronOnConcreteSound;

    // Splash Screen & Auto Audio Unlock
    const splashScreen = document.getElementById('splashScreen');
    if (splashScreen) {
        setTimeout(() => playIronOnConcreteSound('normal'), 150);
        setTimeout(() => playIronOnConcreteSound('normal'), 380);
        setTimeout(() => playIronOnConcreteSound('final'),  620);
        setTimeout(() => playIronOnConcreteSound('light'),  950);

        const dismissSplash = () => {
            splashScreen.classList.add('hidden');
            playBackgroundMusic();
        };
        const splashTimer = setTimeout(dismissSplash, 3200);
        splashScreen.addEventListener('click', () => {
            getAudioContext();
            clearTimeout(splashTimer);
            dismissSplash();
        });

        window.addEventListener('click', () => {
            getAudioContext();
            playBackgroundMusic();
        }, { once: true });
        window.addEventListener('keydown', () => {
            getAudioContext();
            playBackgroundMusic();
        }, { once: true });
    }

    // DOM Elements
    const gameModeSelect = document.getElementById('gameMode');
    const teamSizeSelect = document.getElementById('teamSize');
    const teamsContainer = document.getElementById('teamsContainer');
    const playerPool = document.getElementById('playerPool');
    const poolCount = document.getElementById('poolCount');
    const manualNameInput = document.getElementById('manualName');
    const addManualBtn = document.getElementById('addManualBtn');
    const randomizeBtn = document.getElementById('randomizeBtn');
    const clearBtn = document.getElementById('clearBtn');
    const channelNameInput = document.getElementById('channelName');
    const connectBtn = document.getElementById('connectBtn');
    const connectionStatus = document.getElementById('connectionStatus');

    // Sıralama Paneli & Maç Sonuç DOM Elemanları
    const leaderboardBtn = document.getElementById('leaderboardBtn');
    const leaderboardModal = document.getElementById('leaderboardModal');
    const closeLeaderboardBtn = document.getElementById('closeLeaderboardBtn');
    const closeLeaderboardFooterBtn = document.getElementById('closeLeaderboardFooterBtn');
    const currentChannelNameDisplay = document.getElementById('currentChannelNameDisplay');
    const leaderboardSearch = document.getElementById('leaderboardSearch');
    const leaderboardSort = document.getElementById('leaderboardSort');
    const leaderboardTbody = document.getElementById('leaderboardTbody');
    const leaderboardEmpty = document.getElementById('leaderboardEmpty');
    const resetChannelStatsBtn = document.getElementById('resetChannelStatsBtn');

    const matchModal = document.getElementById('matchModal');
    const matchWinnerName = document.getElementById('matchWinnerName');
    const matchWinnerPlayers = document.getElementById('matchWinnerPlayers');
    const loserSelectGroup = document.getElementById('loserSelectGroup');
    const matchLoserSelect = document.getElementById('matchLoserSelect');
    const confirmMatchBtn = document.getElementById('confirmMatchBtn');
    const cancelMatchBtn = document.getElementById('cancelMatchBtn');
    const closeMatchModalBtn = document.getElementById('closeMatchModalBtn');

    // Kick Bağlantı & Yardım Modal DOM Elemanları
    const kickModal = document.getElementById('kickModal');
    const closeKickModalBtn = document.getElementById('closeKickModalBtn');
    const closeKickModalFooterBtn = document.getElementById('closeKickModalFooterBtn');
    const manualChatroomIdInput = document.getElementById('manualChatroomIdInput');
    const saveChatroomIdBtn = document.getElementById('saveChatroomIdBtn');
    const findChatroomIdLink = document.getElementById('findChatroomIdLink');
    const kickHelpBtn = document.getElementById('kickHelpBtn');

    // Ses Ayarları DOM Elemanları
    const audioSettingsBtn = document.getElementById('audioSettingsBtn');
    const audioModal = document.getElementById('audioModal');
    const closeAudioModalBtn = document.getElementById('closeAudioModalBtn');
    const closeAudioModalFooterBtn = document.getElementById('closeAudioModalFooterBtn');
    const musicToggle = document.getElementById('musicToggle');
    const musicVolumeSlider = document.getElementById('musicVolumeSlider');
    const musicVolumeValue = document.getElementById('musicVolumeValue');
    const sfxToggle = document.getElementById('sfxToggle');
    const sfxVolumeSlider = document.getElementById('sfxVolumeSlider');
    const sfxVolumeValue = document.getElementById('sfxVolumeValue');
    const testAudioBtn = document.getElementById('testAudioBtn');

    // Katılım Komutu & Turnuva DOM Elemanları
    const joinCommandInput = document.getElementById('joinCommandInput');
    const commandActiveBadge = document.getElementById('commandActiveBadge');
    const poolCommandDisplay = document.getElementById('poolCommandDisplay');
    const resetTournamentBtn = document.getElementById('resetTournamentBtn');

    // State
    let players = [];
    let sortableInstances = [];
    let pusher = null;
    let chatChannel = null;
    let currentChannel = 'genel';
    let channelStats = {};
    let pendingMatch = null;
    let currentJoinCommand = localStorage.getItem('kick_strikers_join_cmd') || '!kingsc';
    let tournamentMatches = null;

    // Initialize
    initChannelStorage();
    initJoinCommand();
    initTeams();
    initPoolSortable();

    // Event Listeners
    gameModeSelect.addEventListener('change', () => {
        playUiSfx('click');
        initTeams();
    });
    teamSizeSelect.addEventListener('change', () => {
        playUiSfx('click');
        updateTeamLimits();
        updateTournamentHeaderBadge();
    });
    
    addManualBtn.addEventListener('click', () => {
        playUiSfx('click');
        addManualPlayer();
    });
    manualNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            playUiSfx('click');
            addManualPlayer();
        }
    });

    randomizeBtn.addEventListener('click', () => {
        playUiSfx('shuffle');
        randomizePlayers();
    });
    clearBtn.addEventListener('click', () => {
        playUiSfx('click');
        clearAllPlayers();
    });
    connectBtn.addEventListener('click', () => {
        playUiSfx('click');
        connectToKick();
    });

    // Audio Modal Handlers
    function openAudioModal() {
        if (!audioModal) return;
        musicToggle.checked = musicEnabled;
        musicVolumeSlider.value = Math.round(musicVolume * 100);
        musicVolumeValue.textContent = `${musicVolumeSlider.value}%`;

        sfxToggle.checked = sfxEnabled;
        sfxVolumeSlider.value = Math.round(sfxVolume * 100);
        sfxVolumeValue.textContent = `${sfxVolumeSlider.value}%`;

        audioModal.classList.remove('hidden');
        playUiSfx('click');
    }

    function closeAudioModal() {
        if (!audioModal) return;
        audioModal.classList.add('hidden');
        playUiSfx('click');
    }

    if (audioSettingsBtn) audioSettingsBtn.addEventListener('click', openAudioModal);
    if (closeAudioModalBtn) closeAudioModalBtn.addEventListener('click', closeAudioModal);
    if (closeAudioModalFooterBtn) closeAudioModalFooterBtn.addEventListener('click', closeAudioModal);

    if (audioModal) {
        audioModal.addEventListener('click', (e) => {
            if (e.target === audioModal) closeAudioModal();
        });
    }

    if (musicToggle) {
        musicToggle.addEventListener('change', () => {
            musicEnabled = musicToggle.checked;
            localStorage.setItem('audio_music_enabled', musicEnabled);
            if (musicEnabled) {
                playBackgroundMusic();
            } else {
                stopBackgroundMusic();
            }
            playUiSfx('click');
        });
    }

    if (musicVolumeSlider) {
        musicVolumeSlider.addEventListener('input', () => {
            musicVolume = parseFloat(musicVolumeSlider.value) / 100;
            musicVolumeValue.textContent = `${musicVolumeSlider.value}%`;
            localStorage.setItem('audio_music_volume', musicVolumeSlider.value);
            updateMusicVolume();
        });
    }

    if (sfxToggle) {
        sfxToggle.addEventListener('change', () => {
            sfxEnabled = sfxToggle.checked;
            localStorage.setItem('audio_sfx_enabled', sfxEnabled);
            if (sfxEnabled) playUiSfx('click');
        });
    }

    if (sfxVolumeSlider) {
        sfxVolumeSlider.addEventListener('input', () => {
            sfxVolume = parseFloat(sfxVolumeSlider.value) / 100;
            sfxVolumeValue.textContent = `${sfxVolumeSlider.value}%`;
            localStorage.setItem('audio_sfx_volume', sfxVolumeSlider.value);
        });
    }

    if (testAudioBtn) {
        testAudioBtn.addEventListener('click', () => {
            playUiSfx('click');
            setTimeout(() => playIronOnConcreteSound('normal'), 120);
            setTimeout(() => playCrowdCheerSfx('low'), 350);
        });
    }

    if (resetTournamentBtn) {
        resetTournamentBtn.addEventListener('click', resetTournamentBracket);
    }

    if (channelNameInput) {
        channelNameInput.addEventListener('change', () => {
            if (channelNameInput.value.trim()) {
                switchChannel(channelNameInput.value.trim());
            }
        });
    }

    if (leaderboardBtn) leaderboardBtn.addEventListener('click', openLeaderboard);
    if (closeLeaderboardBtn) closeLeaderboardBtn.addEventListener('click', closeLeaderboard);
    if (closeLeaderboardFooterBtn) closeLeaderboardFooterBtn.addEventListener('click', closeLeaderboard);
    if (leaderboardSearch) leaderboardSearch.addEventListener('input', renderLeaderboard);
    if (leaderboardSort) leaderboardSort.addEventListener('change', renderLeaderboard);

    if (resetChannelStatsBtn) {
        resetChannelStatsBtn.addEventListener('click', () => {
            if (confirm(`'${currentChannel.toUpperCase()}' kanalına ait tüm oyuncu galibiyet, mağlubiyet ve Win Rate istatistiklerini sıfırlamak istediğinize emin misiniz? Bu işlem geri alınamaz!`)) {
                channelStats = {};
                saveChannelStats();
                refreshAllPlayerElements();
                renderLeaderboard();
                showToast(`${currentChannel.toUpperCase()} verileri sıfırlandı.`);
            }
        });
    }

    if (leaderboardModal) {
        leaderboardModal.addEventListener('click', (e) => {
            if (e.target === leaderboardModal) closeLeaderboard();
        });
    }

    if (matchModal) {
        matchModal.addEventListener('click', (e) => {
            if (e.target === matchModal) matchModal.classList.add('hidden');
        });
    }

    if (cancelMatchBtn) cancelMatchBtn.addEventListener('click', () => matchModal.classList.add('hidden'));
    if (closeMatchModalBtn) closeMatchModalBtn.addEventListener('click', () => matchModal.classList.add('hidden'));
    if (confirmMatchBtn) confirmMatchBtn.addEventListener('click', confirmMatchResult);

    // Kick Modal Listeners
    if (kickHelpBtn) kickHelpBtn.addEventListener('click', () => openKickModal(channelNameInput ? channelNameInput.value.trim() : ''));
    if (closeKickModalBtn) closeKickModalBtn.addEventListener('click', closeKickModal);
    if (closeKickModalFooterBtn) closeKickModalFooterBtn.addEventListener('click', closeKickModal);
    if (kickModal) {
        kickModal.addEventListener('click', (e) => {
            if (e.target === kickModal) closeKickModal();
        });
    }
    if (saveChatroomIdBtn) saveChatroomIdBtn.addEventListener('click', handleManualChatroomIdSave);
    if (manualChatroomIdInput) {
        manualChatroomIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleManualChatroomIdSave();
        });
    }

    // =========================================================================
    // Katılım Komutu Yönetimi
    // =========================================================================
    function initJoinCommand() {
        if (joinCommandInput) {
            joinCommandInput.value = currentJoinCommand;
            joinCommandInput.addEventListener('input', () => {
                const val = joinCommandInput.value.trim();
                if (val) {
                    currentJoinCommand = val;
                    localStorage.setItem('kick_strikers_join_cmd', currentJoinCommand);
                    if (poolCommandDisplay) poolCommandDisplay.textContent = currentJoinCommand;
                }
            });
        }
        if (poolCommandDisplay) {
            poolCommandDisplay.textContent = currentJoinCommand;
        }
    }

    // =========================================================================
    // Takımlar & Turnuva Ağacı Başlatma Mantığı
    // =========================================================================
    function initTeams() {
        teamsContainer.innerHTML = '';
        sortableInstances.forEach(instance => {
            try { instance.destroy(); } catch (e) {}
        });
        sortableInstances = [];

        const mode = gameModeSelect.value;
        teamsContainer.className = `teams-container mode-${mode}`;

        if (mode === 'single') {
            if (resetTournamentBtn) resetTournamentBtn.classList.add('hidden');
            initSingleMode();
        } else {
            if (resetTournamentBtn) resetTournamentBtn.classList.remove('hidden');
            initTournamentMode();
        }
        updatePoolCount();
    }

    function initSingleMode() {
        for (let i = 1; i <= 2; i++) {
            const teamBox = document.createElement('div');
            teamBox.className = 'team-box';
            
            const teamHeader = document.createElement('div');
            teamHeader.className = 'team-header';
            
            const teamInput = document.createElement('input');
            teamInput.type = 'text';
            teamInput.value = `Takım ${i}`;
            
            const winBtn = document.createElement('button');
            winBtn.className = 'team-win-btn';
            winBtn.innerHTML = '<i class="fa-solid fa-trophy"></i> Kazandı';
            winBtn.title = 'Bu takımı maçın galibi yap (+1W)';

            const teamCount = document.createElement('span');
            teamCount.className = 'team-count badge';
            teamCount.textContent = '0';

            teamHeader.appendChild(teamInput);
            teamHeader.appendChild(winBtn);
            teamHeader.appendChild(teamCount);

            const teamList = document.createElement('ul');
            teamList.className = 'team-list sortable-list';
            teamList.id = `team-${i}`;

            winBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleTeamWinClick(i, teamInput.value, teamList);
            });

            teamBox.appendChild(teamHeader);
            teamBox.appendChild(teamList);
            teamsContainer.appendChild(teamBox);

            const sortable = new Sortable(teamList, {
                group: 'shared',
                animation: 150,
                ghostClass: 'sortable-ghost',
                onAdd: (evt) => handleSortableChange(evt, teamList, teamCount, teamBox),
                onRemove: (evt) => handleSortableChange(evt, teamList, teamCount, teamBox)
            });
            sortableInstances.push(sortable);
        }
    }

    // =========================================================================
    // Çift Taraflı Son 16 Turnuva Ağacı Modülü
    // =========================================================================
    function getInitialTournamentMatches() {
        return {
            // SOL KANAT - SON 16
            'm_r16_1': {
                id: 'm_r16_1', round: 'r16', matchNum: 1, name: 'Maç 1', wing: 'left',
                nextMatchId: 'm_qf_1', nextSlot: 'teamA',
                teamA: { teamNum: 1, name: 'Takım 1', players: [] },
                teamB: { teamNum: 2, name: 'Takım 2', players: [] },
                winner: null
            },
            'm_r16_2': {
                id: 'm_r16_2', round: 'r16', matchNum: 2, name: 'Maç 2', wing: 'left',
                nextMatchId: 'm_qf_1', nextSlot: 'teamB',
                teamA: { teamNum: 3, name: 'Takım 3', players: [] },
                teamB: { teamNum: 4, name: 'Takım 4', players: [] },
                winner: null
            },
            'm_r16_3': {
                id: 'm_r16_3', round: 'r16', matchNum: 3, name: 'Maç 3', wing: 'left',
                nextMatchId: 'm_qf_2', nextSlot: 'teamA',
                teamA: { teamNum: 5, name: 'Takım 5', players: [] },
                teamB: { teamNum: 6, name: 'Takım 6', players: [] },
                winner: null
            },
            'm_r16_4': {
                id: 'm_r16_4', round: 'r16', matchNum: 4, name: 'Maç 4', wing: 'left',
                nextMatchId: 'm_qf_2', nextSlot: 'teamB',
                teamA: { teamNum: 7, name: 'Takım 7', players: [] },
                teamB: { teamNum: 8, name: 'Takım 8', players: [] },
                winner: null
            },
            // SAĞ KANAT - SON 16
            'm_r16_5': {
                id: 'm_r16_5', round: 'r16', matchNum: 5, name: 'Maç 5', wing: 'right',
                nextMatchId: 'm_qf_3', nextSlot: 'teamA',
                teamA: { teamNum: 9, name: 'Takım 9', players: [] },
                teamB: { teamNum: 10, name: 'Takım 10', players: [] },
                winner: null
            },
            'm_r16_6': {
                id: 'm_r16_6', round: 'r16', matchNum: 6, name: 'Maç 6', wing: 'right',
                nextMatchId: 'm_qf_3', nextSlot: 'teamB',
                teamA: { teamNum: 11, name: 'Takım 11', players: [] },
                teamB: { teamNum: 12, name: 'Takım 12', players: [] },
                winner: null
            },
            'm_r16_7': {
                id: 'm_r16_7', round: 'r16', matchNum: 7, name: 'Maç 7', wing: 'right',
                nextMatchId: 'm_qf_4', nextSlot: 'teamA',
                teamA: { teamNum: 13, name: 'Takım 13', players: [] },
                teamB: { teamNum: 14, name: 'Takım 14', players: [] },
                winner: null
            },
            'm_r16_8': {
                id: 'm_r16_8', round: 'r16', matchNum: 8, name: 'Maç 8', wing: 'right',
                nextMatchId: 'm_qf_4', nextSlot: 'teamB',
                teamA: { teamNum: 15, name: 'Takım 15', players: [] },
                teamB: { teamNum: 16, name: 'Takım 16', players: [] },
                winner: null
            },

            // SOL KANAT - ÇEYREK FİNAL
            'm_qf_1': {
                id: 'm_qf_1', round: 'qf', matchNum: 1, name: 'ÇF 1', wing: 'left',
                nextMatchId: 'm_sf_1', nextSlot: 'teamA',
                sourceA: 'Maç 1 Galibi', sourceB: 'Maç 2 Galibi',
                teamA: null, teamB: null, winner: null
            },
            'm_qf_2': {
                id: 'm_qf_2', round: 'qf', matchNum: 2, name: 'ÇF 2', wing: 'left',
                nextMatchId: 'm_sf_1', nextSlot: 'teamB',
                sourceA: 'Maç 3 Galibi', sourceB: 'Maç 4 Galibi',
                teamA: null, teamB: null, winner: null
            },

            // SAĞ KANAT - ÇEYREK FİNAL
            'm_qf_3': {
                id: 'm_qf_3', round: 'qf', matchNum: 3, name: 'ÇF 3', wing: 'right',
                nextMatchId: 'm_sf_2', nextSlot: 'teamA',
                sourceA: 'Maç 5 Galibi', sourceB: 'Maç 6 Galibi',
                teamA: null, teamB: null, winner: null
            },
            'm_qf_4': {
                id: 'm_qf_4', round: 'qf', matchNum: 4, name: 'ÇF 4', wing: 'right',
                nextMatchId: 'm_sf_2', nextSlot: 'teamB',
                sourceA: 'Maç 7 Galibi', sourceB: 'Maç 8 Galibi',
                teamA: null, teamB: null, winner: null
            },

            // YARI FİNALLER
            'm_sf_1': {
                id: 'm_sf_1', round: 'sf', matchNum: 1, name: 'YF 1', wing: 'left',
                nextMatchId: 'm_final', nextSlot: 'teamA',
                sourceA: 'ÇF 1 Galibi', sourceB: 'ÇF 2 Galibi',
                teamA: null, teamB: null, winner: null
            },
            'm_sf_2': {
                id: 'm_sf_2', round: 'sf', matchNum: 2, name: 'YF 2', wing: 'right',
                nextMatchId: 'm_final', nextSlot: 'teamB',
                sourceA: 'ÇF 3 Galibi', sourceB: 'ÇF 4 Galibi',
                teamA: null, teamB: null, winner: null
            },

            // BÜYÜK FİNAL
            'm_final': {
                id: 'm_final', round: 'final', matchNum: 1, name: 'BÜYÜK FİNAL', wing: 'center',
                nextMatchId: null, nextSlot: null,
                sourceA: 'YF 1 Galibi', sourceB: 'YF 2 Galibi',
                teamA: null, teamB: null, winner: null
            }
        };
    }

    function updateTournamentHeaderBadge() {
        const badge = document.getElementById('tournamentTitleBadge');
        if (!badge) return;
        const sizeVal = teamSizeSelect ? teamSizeSelect.value : '5';
        badge.innerHTML = `<i class="fa-solid fa-sitemap"></i> ${sizeVal}v${sizeVal} Son 16 Turnuva Ağacı`;
    }

    function initTournamentMode() {
        if (!tournamentMatches) {
            tournamentMatches = getInitialTournamentMatches();
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'tournament-bracket-wrapper';
        wrapper.id = 'tournamentBracket';

        const sizeVal = teamSizeSelect ? teamSizeSelect.value : '5';

        // Topbar
        const topbar = document.createElement('div');
        topbar.className = 'bracket-topbar';
        topbar.innerHTML = `
            <div class="bracket-info">
                <span class="bracket-badge" id="tournamentTitleBadge"><i class="fa-solid fa-sitemap"></i> ${sizeVal}v${sizeVal} Son 16 Turnuva Ağacı</span>
                <span class="bracket-subtext">UEFA & Dünya Kupası Çift Taraflı Format &bull; ${sizeVal}'er kişilik kadrolarla finale yükselme</span>
            </div>
            <div class="bracket-actions">
                <button id="resetBracketBtn" class="btn warning-btn" title="Turnuva ağacındaki tüm maç sonuçlarını ve turları sıfırlar"><i class="fa-solid fa-rotate-left"></i> Ağacı Sıfırla</button>
            </div>
        `;
        wrapper.appendChild(topbar);

        // Bracket Tree
        const tree = document.createElement('div');
        tree.className = 'bracket-tree';

        // --- SOL KANAT ---
        const leftWing = document.createElement('div');
        leftWing.className = 'bracket-wing bracket-left';

        leftWing.appendChild(buildRoundColumn('Son 16', '4 Maç', ['m_r16_1', 'm_r16_2', 'm_r16_3', 'm_r16_4']));
        leftWing.appendChild(buildRoundColumn('Çeyrek Final', '2 Maç', ['m_qf_1', 'm_qf_2']));
        leftWing.appendChild(buildRoundColumn('Yarı Final', '1 Maç', ['m_sf_1']));
        tree.appendChild(leftWing);

        // --- MERKEZ (Grand Final & Trophy Podium) ---
        const centerWing = document.createElement('div');
        centerWing.className = 'bracket-center';

        const podium = document.createElement('div');
        podium.className = 'champion-podium';
        podium.id = 'championPodium';
        podium.innerHTML = `
            <div class="trophy-wrap">
                <i class="fa-solid fa-trophy trophy-icon"></i>
            </div>
            <div class="champion-title">TURNUVA ŞAMPİYONU</div>
            <div class="champion-name" id="championTeamName">Bekleniyor...</div>
            <div class="champion-roster" id="championRoster"></div>
        `;
        centerWing.appendChild(podium);

        const grandFinalWrap = document.createElement('div');
        grandFinalWrap.className = 'grand-final-wrap';
        grandFinalWrap.innerHTML = `
            <div class="round-header grand-final-header">
                <span class="round-title"><i class="fa-solid fa-crown"></i> BÜYÜK FİNAL</span>
                <span class="round-count">1 Maç</span>
            </div>
        `;
        const finalMatchesCont = document.createElement('div');
        finalMatchesCont.className = 'round-matches';
        finalMatchesCont.appendChild(buildMatchCardElement(tournamentMatches['m_final']));
        grandFinalWrap.appendChild(finalMatchesCont);
        centerWing.appendChild(grandFinalWrap);

        tree.appendChild(centerWing);

        // --- SAĞ KANAT ---
        const rightWing = document.createElement('div');
        rightWing.className = 'bracket-wing bracket-right';

        rightWing.appendChild(buildRoundColumn('Yarı Final', '1 Maç', ['m_sf_2']));
        rightWing.appendChild(buildRoundColumn('Çeyrek Final', '2 Maç', ['m_qf_3', 'm_qf_4']));
        rightWing.appendChild(buildRoundColumn('Son 16', '4 Maç', ['m_r16_5', 'm_r16_6', 'm_r16_7', 'm_r16_8']));
        tree.appendChild(rightWing);

        wrapper.appendChild(tree);
        teamsContainer.appendChild(wrapper);

        const resetBtn = topbar.querySelector('#resetBracketBtn');
        if (resetBtn) resetBtn.addEventListener('click', resetTournamentBracket);
    }

    function buildRoundColumn(title, countText, matchIds) {
        const col = document.createElement('div');
        col.className = 'bracket-round';
        col.innerHTML = `
            <div class="round-header">
                <span class="round-title">${title}</span>
                <span class="round-count">${countText}</span>
            </div>
        `;
        const matchesContainer = document.createElement('div');
        matchesContainer.className = 'round-matches';

        matchIds.forEach(id => {
            const match = tournamentMatches[id];
            if (match) {
                matchesContainer.appendChild(buildMatchCardElement(match));
            }
        });

        col.appendChild(matchesContainer);
        return col;
    }

    function buildMatchCardElement(match) {
        const card = document.createElement('div');
        card.className = `bracket-match-card ${match.round === 'final' ? 'final-match' : ''}`;
        card.dataset.matchId = match.id;

        const badge = document.createElement('div');
        badge.className = 'match-badge';
        badge.textContent = match.name;
        card.appendChild(badge);

        if (match.round === 'r16') {
            card.appendChild(buildR16TeamSlot(match, 'teamA'));
            
            const divider = document.createElement('div');
            divider.className = 'match-vs-divider';
            divider.innerHTML = '<span>VS</span>';
            card.appendChild(divider);

            card.appendChild(buildR16TeamSlot(match, 'teamB'));
        } else {
            card.appendChild(buildProgressTeamSlot(match, 'teamA'));

            const divider = document.createElement('div');
            divider.className = 'match-vs-divider';
            divider.innerHTML = '<span>VS</span>';
            card.appendChild(divider);

            card.appendChild(buildProgressTeamSlot(match, 'teamB'));
        }

        const undoBtn = document.createElement('button');
        undoBtn.className = `match-undo-btn ${match.winner ? '' : 'hidden'}`;
        undoBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Sonucu Geri Al';
        undoBtn.onclick = () => handleTournamentMatchUndo(match.id);
        card.appendChild(undoBtn);

        return card;
    }

    function buildR16TeamSlot(match, slotKey) {
        const teamData = match[slotKey];
        const isWinner = match.winner === slotKey;
        const isEliminated = match.winner && match.winner !== slotKey;

        const slot = document.createElement('div');
        slot.className = `bracket-team-slot ${isWinner ? 'slot-winner' : ''} ${isEliminated ? 'slot-eliminated' : ''}`;
        slot.dataset.slot = slotKey;

        const header = document.createElement('div');
        header.className = 'slot-header';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'slot-name-input';
        nameInput.value = teamData.name;
        nameInput.oninput = () => {
            teamData.name = nameInput.value;
        };

        const maxSize = parseInt(teamSizeSelect ? teamSizeSelect.value : '5');
        const countBadge = document.createElement('span');
        countBadge.className = 'team-count badge';
        countBadge.textContent = `0/${maxSize}`;

        header.appendChild(nameInput);
        header.appendChild(countBadge);
        slot.appendChild(header);

        const actions = document.createElement('div');
        actions.className = 'slot-actions';

        if (isWinner) {
            const winTag = document.createElement('span');
            winTag.className = 'slot-winner-tag';
            winTag.innerHTML = '<i class="fa-solid fa-trophy"></i> Galip';
            actions.appendChild(winTag);
        } else if (isEliminated) {
            const elTag = document.createElement('span');
            elTag.className = 'slot-eliminated-tag';
            elTag.innerHTML = '<i class="fa-solid fa-xmark"></i> Elendi';
            actions.appendChild(elTag);
        } else {
            const winBtn = document.createElement('button');
            winBtn.className = 'slot-win-btn';
            winBtn.innerHTML = '<i class="fa-solid fa-trophy"></i> Kazandı';
            winBtn.onclick = (e) => {
                e.stopPropagation();
                handleTournamentMatchWin(match.id, slotKey);
            };
            actions.appendChild(winBtn);
        }
        slot.appendChild(actions);

        const teamList = document.createElement('ul');
        teamList.className = 'team-list sortable-list';
        teamList.id = `team-${teamData.teamNum}`;

        slot.appendChild(teamList);

        const sortable = new Sortable(teamList, {
            group: 'shared',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onAdd: (evt) => handleSortableChange(evt, teamList, countBadge, slot),
            onRemove: (evt) => handleSortableChange(evt, teamList, countBadge, slot)
        });
        sortableInstances.push(sortable);

        return slot;
    }

    function buildProgressTeamSlot(match, slotKey) {
        const teamData = match[slotKey];
        const isWinner = match.winner === slotKey;
        const isEliminated = match.winner && match.winner !== slotKey;

        const slot = document.createElement('div');
        slot.className = `bracket-team-slot ${isWinner ? 'slot-winner' : ''} ${isEliminated ? 'slot-eliminated' : ''}`;
        slot.dataset.slot = slotKey;

        if (!teamData) {
            const sourceName = slotKey === 'teamA' ? match.sourceA : match.sourceB;
            slot.innerHTML = `
                <div class="slot-placeholder">
                    <i class="fa-regular fa-clock"></i> Bekleniyor (${sourceName})
                </div>
            `;
            return slot;
        }

        const header = document.createElement('div');
        header.className = 'slot-header';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'slot-name-text';
        nameSpan.textContent = teamData.name;

        const maxSize = parseInt(teamSizeSelect ? teamSizeSelect.value : '5');
        const countBadge = document.createElement('span');
        countBadge.className = 'badge';
        countBadge.textContent = `👥 ${teamData.players.length}/${maxSize}`;

        header.appendChild(nameSpan);
        header.appendChild(countBadge);
        slot.appendChild(header);

        const actions = document.createElement('div');
        actions.className = 'slot-actions';

        if (isWinner) {
            const winTag = document.createElement('span');
            winTag.className = 'slot-winner-tag';
            winTag.innerHTML = '<i class="fa-solid fa-trophy"></i> Galip';
            actions.appendChild(winTag);
        } else if (isEliminated) {
            const elTag = document.createElement('span');
            elTag.className = 'slot-eliminated-tag';
            elTag.innerHTML = '<i class="fa-solid fa-xmark"></i> Elendi';
            actions.appendChild(elTag);
        } else {
            const winBtn = document.createElement('button');
            winBtn.className = 'slot-win-btn';
            winBtn.innerHTML = '<i class="fa-solid fa-trophy"></i> Kazandı';
            winBtn.onclick = (e) => {
                e.stopPropagation();
                handleTournamentMatchWin(match.id, slotKey);
            };
            actions.appendChild(winBtn);
        }

        const rosterBtn = document.createElement('button');
        rosterBtn.className = 'slot-roster-btn';
        rosterBtn.innerHTML = '<i class="fa-solid fa-users"></i> Kadro';
        actions.appendChild(rosterBtn);
        slot.appendChild(actions);

        const drawer = document.createElement('div');
        drawer.className = 'slot-roster-drawer hidden';
        if (teamData.players && teamData.players.length > 0) {
            teamData.players.forEach(p => {
                const pill = document.createElement('span');
                pill.className = 'roster-pill';
                const detail = getPlayerStats(p);
                pill.innerHTML = `${p} <small>(%${detail.winRate.toFixed(0)})</small>`;
                drawer.appendChild(pill);
            });
        } else {
            drawer.innerHTML = '<small style="color:#64748b;">Kadro boş</small>';
        }
        slot.appendChild(drawer);

        rosterBtn.onclick = (e) => {
            e.stopPropagation();
            drawer.classList.toggle('hidden');
        };

        return slot;
    }

    function updateTournamentMatchDOM(matchId) {
        const card = document.querySelector(`.bracket-match-card[data-match-id="${matchId}"]`);
        if (!card) return;

        const match = tournamentMatches[matchId];
        if (!match) return;

        const newCard = buildMatchCardElement(match);
        card.replaceWith(newCard);
    }

    function handleTournamentMatchWin(matchId, winnerSlotKey) {
        const match = tournamentMatches[matchId];
        if (!match) return;

        const loserSlotKey = winnerSlotKey === 'teamA' ? 'teamB' : 'teamA';

        let winnerTeamName = '';
        let winnerPlayers = [];
        let winnerTeamNum = null;

        let loserTeamName = '';
        let loserPlayers = [];

        if (match.round === 'r16') {
            const cardEl = document.querySelector(`.bracket-match-card[data-match-id="${matchId}"]`);
            const winInput = cardEl ? cardEl.querySelector(`.bracket-team-slot[data-slot="${winnerSlotKey}"] .slot-name-input`) : null;
            const loseInput = cardEl ? cardEl.querySelector(`.bracket-team-slot[data-slot="${loserSlotKey}"] .slot-name-input`) : null;

            winnerTeamNum = match[winnerSlotKey].teamNum;
            winnerTeamName = winInput ? winInput.value.trim() : match[winnerSlotKey].name;

            const loserTeamNum = match[loserSlotKey].teamNum;
            loserTeamName = loseInput ? loseInput.value.trim() : match[loserSlotKey].name;

            const winListEl = document.getElementById(`team-${winnerTeamNum}`);
            const loseListEl = document.getElementById(`team-${loserTeamNum}`);

            if (winListEl) {
                winnerPlayers = Array.from(winListEl.querySelectorAll('.player-item')).map(el => el.dataset.name);
            }
            if (loseListEl) {
                loserPlayers = Array.from(loseListEl.querySelectorAll('.player-item')).map(el => el.dataset.name);
            }
        } else {
            if (!match[winnerSlotKey] || !match[loserSlotKey]) {
                showToast('Henüz iki rakip takım da belli olmadı!', true);
                return;
            }
            winnerTeamName = match[winnerSlotKey].name;
            winnerPlayers = match[winnerSlotKey].players || [];
            winnerTeamNum = match[winnerSlotKey].teamNum;

            loserTeamName = match[loserSlotKey].name;
            loserPlayers = match[loserSlotKey].players || [];
        }

        if (winnerPlayers.length === 0) {
            if (!confirm(`${winnerTeamName} takımında hiç oyuncu yok. Yine de maçın galibi yapılsın mı?`)) {
                return;
            }
        }

        match.winner = winnerSlotKey;

        // Galip oyunculara +1 W
        winnerPlayers.forEach(name => {
            const s = getPlayerStats(name);
            channelStats[s.key].wins += 1;
        });

        // Mağlup oyunculara +1 L
        loserPlayers.forEach(name => {
            const s = getPlayerStats(name);
            channelStats[s.key].losses += 1;
        });

        saveChannelStats();
        refreshAllPlayerElements();
        renderLeaderboard();

        // Bir sonraki tura aktar
        if (match.nextMatchId && match.nextSlot) {
            const nextMatch = tournamentMatches[match.nextMatchId];
            if (nextMatch) {
                nextMatch[match.nextSlot] = {
                    teamNum: winnerTeamNum,
                    name: winnerTeamName,
                    players: [...winnerPlayers]
                };
                updateTournamentMatchDOM(match.nextMatchId);
            }
        }

        // Büyük Final ise Şampiyon ilan et
        if (match.round === 'final') {
            playUiSfx('win');
            renderChampionPodium({ name: winnerTeamName, players: winnerPlayers });
            showToast(`👑 TEBRİKLER! ${winnerTeamName.toUpperCase()} TURNUVA ŞAMPİYONU OLDU! 🎉`);
        } else {
            playUiSfx('win');
            showToast(`🏆 ${winnerTeamName} kazandı! Bir üst tura yükseldi. (+1W/+1L işlendi)`);
        }

        updateTournamentMatchDOM(matchId);
    }

    function handleTournamentMatchUndo(matchId) {
        const match = tournamentMatches[matchId];
        if (!match || !match.winner) return;

        const prevWinnerSlot = match.winner;
        const prevLoserSlot = prevWinnerSlot === 'teamA' ? 'teamB' : 'teamA';

        let winnerPlayers = [];
        let loserPlayers = [];

        if (match.round === 'r16') {
            const winNum = match[prevWinnerSlot].teamNum;
            const loseNum = match[prevLoserSlot].teamNum;
            const winList = document.getElementById(`team-${winNum}`);
            const loseList = document.getElementById(`team-${loseNum}`);
            if (winList) winnerPlayers = Array.from(winList.querySelectorAll('.player-item')).map(el => el.dataset.name);
            if (loseList) loserPlayers = Array.from(loseList.querySelectorAll('.player-item')).map(el => el.dataset.name);
        } else {
            if (match[prevWinnerSlot]) winnerPlayers = match[prevWinnerSlot].players || [];
            if (match[prevLoserSlot]) loserPlayers = match[prevLoserSlot].players || [];
        }

        winnerPlayers.forEach(name => {
            const key = name.trim().toLowerCase();
            if (channelStats[key] && channelStats[key].wins > 0) {
                channelStats[key].wins -= 1;
            }
        });
        loserPlayers.forEach(name => {
            const key = name.trim().toLowerCase();
            if (channelStats[key] && channelStats[key].losses > 0) {
                channelStats[key].losses -= 1;
            }
        });

        saveChannelStats();
        refreshAllPlayerElements();
        renderLeaderboard();

        // Bir sonraki maçtaki ilerlemeyi temizle
        if (match.nextMatchId && match.nextSlot) {
            const nextMatch = tournamentMatches[match.nextMatchId];
            if (nextMatch) {
                if (nextMatch.winner) {
                    handleTournamentMatchUndo(match.nextMatchId);
                }
                nextMatch[match.nextSlot] = null;
                updateTournamentMatchDOM(match.nextMatchId);
            }
        }

        if (match.round === 'final') {
            renderChampionPodium(null);
        }

        match.winner = null;
        updateTournamentMatchDOM(matchId);
        showToast('↩️ Maç sonucu geri alındı ve puanlar düzeltildi.');
    }

    function renderChampionPodium(champ) {
        const podium = document.getElementById('championPodium');
        const champNameEl = document.getElementById('championTeamName');
        const champRosterEl = document.getElementById('championRoster');
        if (!podium || !champNameEl || !champRosterEl) return;

        if (!champ) {
            podium.classList.remove('crowned');
            champNameEl.textContent = 'Bekleniyor...';
            champRosterEl.innerHTML = '';
            return;
        }

        podium.classList.add('crowned');
        champNameEl.textContent = champ.name;
        champRosterEl.innerHTML = '';

        champ.players.forEach(pName => {
            const pill = document.createElement('span');
            pill.className = 'roster-pill';
            const detail = getPlayerStats(pName);
            pill.innerHTML = `<strong>${pName}</strong> <small>(%${detail.winRate.toFixed(0)})</small>`;
            champRosterEl.appendChild(pill);
        });
    }

    function resetTournamentBracket() {
        if (!confirm('Turnuva ağacındaki tüm maç sonuçlarını ve turları sıfırlamak istediğinize emin misiniz? (Oyuncu havuzundaki oyuncular korunur)')) {
            return;
        }
        tournamentMatches = getInitialTournamentMatches();
        initTeams();
        showToast('Turnuva ağacı sıfırlandı.');
    }

    function initPoolSortable() {
        new Sortable(playerPool, {
            group: 'shared',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onAdd: () => updatePoolCount(),
            onRemove: () => updatePoolCount()
        });
    }

    function handleSortableChange(evt, listElement, countElement, boxElement) {
        const maxSize = parseInt(teamSizeSelect.value);
        const currentCount = listElement.children.length;
        const isTournament = gameModeSelect && gameModeSelect.value === 'tournament';
        
        if (countElement) {
            countElement.textContent = isTournament ? `${currentCount}/${maxSize}` : currentCount;
        }

        if (currentCount > maxSize) {
            // Eğer kapasite aşıldıysa son ekleneni geri havuza gönder
            showToast(`Bir takım en fazla ${maxSize} kişi olabilir!`, true);
            playerPool.appendChild(evt.item);
            if (countElement) {
                countElement.textContent = isTournament ? `${listElement.children.length}/${maxSize}` : listElement.children.length;
            }
            updatePoolCount();
        }

        if (boxElement) {
            if (listElement.children.length === maxSize) {
                boxElement.classList.add('full');
            } else {
                boxElement.classList.remove('full');
            }
        }
        
        updatePoolCount();
    }

    function updatePoolCount() {
        poolCount.textContent = playerPool.children.length;
    }

    // =========================================================================
    // Rekabetçi Rank, Kanal Kalıcılığı & Sıralama Sistemi
    // =========================================================================

    function sanitizeChannelName(name) {
        if (!name) return 'genel';
        return name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'genel';
    }

    function calculateRank(wins, losses) {
        const total = wins + losses;
        const winRate = total > 0 ? (wins / total) * 100 : 0;

        if (total === 0) {
            return { title: 'Derecesiz', icon: 'fa-solid fa-shield-halved', className: 'rank-unranked' };
        }
        if (total >= 5 && winRate >= 75) {
            return { title: 'Efsane', icon: 'fa-solid fa-crown', className: 'rank-champion' };
        }
        if (total >= 4 && winRate >= 65) {
            return { title: 'Elmas', icon: 'fa-solid fa-gem', className: 'rank-diamond' };
        }
        if (total >= 3 && winRate >= 55) {
            return { title: 'Platin', icon: 'fa-solid fa-medal', className: 'rank-platinum' };
        }
        if (total >= 2 && winRate >= 45) {
            return { title: 'Altın', icon: 'fa-solid fa-trophy', className: 'rank-gold' };
        }
        if (total >= 1 && winRate >= 35) {
            return { title: 'Gümüş', icon: 'fa-solid fa-award', className: 'rank-silver' };
        }
        return { title: 'Bronz', icon: 'fa-solid fa-shield', className: 'rank-bronze' };
    }

    function initChannelStorage() {
        const savedChannel = localStorage.getItem('kick_strikers_last_channel');
        if (savedChannel) {
            if (channelNameInput) channelNameInput.value = savedChannel;
            loadChannelStats(savedChannel);
        } else {
            loadChannelStats('genel');
        }
    }

    function loadChannelStats(channelName) {
        currentChannel = sanitizeChannelName(channelName);
        if (currentChannelNameDisplay) {
            currentChannelNameDisplay.textContent = currentChannel.toUpperCase();
        }
        try {
            const raw = localStorage.getItem(`kick_strikers_stats_${currentChannel}`);
            if (raw) {
                channelStats = JSON.parse(raw);
            } else {
                channelStats = {};
            }
        } catch (e) {
            console.error('Kanal istatistikleri okunamadı:', e);
            channelStats = {};
        }

        refreshAllPlayerElements();
        if (leaderboardModal && !leaderboardModal.classList.contains('hidden')) {
            renderLeaderboard();
        }
    }

    function saveChannelStats() {
        try {
            localStorage.setItem(`kick_strikers_stats_${currentChannel}`, JSON.stringify(channelStats));
        } catch (e) {
            console.error('Kanal istatistikleri kaydedilemedi:', e);
        }
    }

    function switchChannel(name) {
        const clean = sanitizeChannelName(name);
        if (clean !== currentChannel) {
            localStorage.setItem('kick_strikers_last_channel', clean);
            loadChannelStats(clean);
            showToast(`Aktif Kanal: ${clean.toUpperCase()} (Veriler Yüklendi)`);
        }
    }

    function getPlayerStats(name) {
        const key = name.trim().toLowerCase();
        if (!channelStats[key]) {
            channelStats[key] = {
                wins: 0,
                losses: 0,
                displayName: name.trim()
            };
        }
        const stat = channelStats[key];
        const total = stat.wins + stat.losses;
        const winRate = total > 0 ? (stat.wins / total) * 100 : 0;
        const rank = calculateRank(stat.wins, stat.losses);
        return {
            key,
            displayName: stat.displayName || name,
            wins: stat.wins,
            losses: stat.losses,
            total,
            winRate,
            rank
        };
    }

    function updatePlayerItemBadge(li, name) {
        const detail = getPlayerStats(name);
        const chip = li.querySelector('.player-rank-chip');
        if (!chip) return;

        chip.className = `player-rank-chip ${detail.rank.className}`;
        chip.title = `${detail.rank.title} | ${detail.wins}G - ${detail.losses}M | Win Rate: %${detail.winRate.toFixed(1)}`;
        chip.innerHTML = `<i class="${detail.rank.icon}"></i> %${detail.winRate.toFixed(0)}`;
    }

    function refreshAllPlayerElements() {
        document.querySelectorAll('.player-item').forEach(li => {
            const name = li.dataset.name;
            if (name) updatePlayerItemBadge(li, name);
        });
    }

    function createPlayerElement(name) {
        const li = document.createElement('li');
        li.className = 'player-item';
        li.dataset.name = name;
        
        const infoWrap = document.createElement('div');
        infoWrap.className = 'player-info-wrap';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'player-name-text';
        nameSpan.textContent = name;

        const rankChip = document.createElement('span');
        rankChip.className = 'player-rank-chip';

        infoWrap.appendChild(nameSpan);
        infoWrap.appendChild(rankChip);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-player';
        removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        removeBtn.onclick = function() {
            li.remove();
            updatePoolCount();
            document.querySelectorAll('.team-list').forEach(list => {
                const teamBox = list.closest('.team-box') || list.closest('.bracket-team-slot');
                if (teamBox) {
                    const countBadge = teamBox.querySelector('.team-count');
                    if (countBadge) countBadge.textContent = list.children.length;
                    if (list.children.length < parseInt(teamSizeSelect.value)) {
                        teamBox.classList.remove('full');
                    }
                }
            });
        };

        li.appendChild(infoWrap);
        li.appendChild(removeBtn);

        // Rank bilgilerini doldur
        updatePlayerItemBadge(li, name);

        return li;
    }

    function isPlayerInSystem(name) {
        if (!name) return true;
        const clean = name.trim().toLowerCase();
        
        // 1. Havuz kontrolü
        const inPool = Array.from(playerPool.children).some(el => {
            return (el.dataset.name || '').trim().toLowerCase() === clean;
        });
        if (inPool) return true;

        // 2. Takımlar kontrolü
        const inTeams = Array.from(document.querySelectorAll('.team-list .player-item')).some(el => {
            return (el.dataset.name || '').trim().toLowerCase() === clean;
        });
        return inTeams;
    }

    function addPlayerToPool(name) {
        if (!name || !name.trim()) return false;
        const cleanName = name.trim();

        if (isPlayerInSystem(cleanName)) return false;

        // Oyuncu kaydını garanti et ve kaydet
        getPlayerStats(cleanName);
        saveChannelStats();

        const playerEl = createPlayerElement(cleanName);
        playerPool.appendChild(playerEl);
        updatePoolCount();
        playUiSfx('join');
        return true;
    }

    // =========================================================================
    // Maç Sonucu & Galibiyet İlanı
    // =========================================================================

    function handleTeamWinClick(teamNum, teamTitle, teamListElement) {
        const winnerPlayers = Array.from(teamListElement.querySelectorAll('.player-item')).map(el => el.dataset.name);
        if (winnerPlayers.length === 0) {
            showToast(`${teamTitle} içinde hiç oyuncu yok!`, true);
            return;
        }

        pendingMatch = {
            winnerTeamNum: teamNum,
            winnerTitle: teamTitle,
            winnerPlayers: winnerPlayers
        };

        matchWinnerName.textContent = teamTitle;
        matchWinnerPlayers.innerHTML = '';
        winnerPlayers.forEach(p => {
            const pill = document.createElement('span');
            pill.className = 'player-pill';
            pill.textContent = p;
            matchWinnerPlayers.appendChild(pill);
        });

        const isSingle = gameModeSelect.value === 'single';
        matchLoserSelect.innerHTML = '';

        if (isSingle) {
            // Tek Maç Modu: Diğer takım otomatik rakip
            loserSelectGroup.style.display = 'none';
            const otherTeamNum = teamNum === 1 ? 2 : 1;
            const otherTeamList = document.getElementById(`team-${otherTeamNum}`);
            const otherTeamBox = otherTeamList ? otherTeamList.parentElement : null;
            const otherTitle = otherTeamBox ? otherTeamBox.querySelector('input').value : `Takım ${otherTeamNum}`;
            const otherPlayers = otherTeamList ? Array.from(otherTeamList.querySelectorAll('.player-item')).map(el => el.dataset.name) : [];
            
            pendingMatch.loserTeamNum = otherTeamNum;
            pendingMatch.loserTitle = otherTitle;
            pendingMatch.loserPlayers = otherPlayers;
        } else {
            // Turnuva Modu: Rakip takımı seç
            loserSelectGroup.style.display = 'flex';
            const allTeamLists = Array.from(document.querySelectorAll('.team-list'));

            allTeamLists.forEach(tl => {
                const tNum = parseInt(tl.id.replace('team-', ''));
                if (tNum !== teamNum) {
                    const tBox = tl.parentElement;
                    const tInput = tBox.querySelector('input');
                    const tTitle = tInput ? tInput.value : `Takım ${tNum}`;
                    const tPlayers = Array.from(tl.querySelectorAll('.player-item')).map(el => el.dataset.name);
                    
                    const opt = document.createElement('option');
                    opt.value = tNum;
                    opt.textContent = `${tTitle} (${tPlayers.length} Oyuncu)`;
                    opt.dataset.players = JSON.stringify(tPlayers);
                    opt.dataset.title = tTitle;
                    matchLoserSelect.appendChild(opt);
                }
            });
        }

        matchModal.classList.remove('hidden');
    }

    function confirmMatchResult() {
        if (!pendingMatch) return;

        const isSingle = gameModeSelect.value === 'single';
        let loserPlayers = [];
        let loserTitle = '';

        if (isSingle) {
            loserPlayers = pendingMatch.loserPlayers || [];
            loserTitle = pendingMatch.loserTitle || 'Rakip Takım';
        } else {
            const selectedOpt = matchLoserSelect.selectedOptions[0];
            if (selectedOpt) {
                loserPlayers = JSON.parse(selectedOpt.dataset.players || '[]');
                loserTitle = selectedOpt.dataset.title;
            }
        }

        if (loserPlayers.length === 0) {
            if (!confirm(`${loserTitle} takımında hiç oyuncu yok. Yine de kazanan takıma +1W eklensin mi?`)) {
                return;
            }
        }

        // Galip oyunculara +1 W
        pendingMatch.winnerPlayers.forEach(name => {
            const key = name.trim().toLowerCase();
            if (!channelStats[key]) {
                channelStats[key] = { wins: 0, losses: 0, displayName: name.trim() };
            }
            channelStats[key].wins += 1;
        });

        // Mağlup oyunculara +1 L
        loserPlayers.forEach(name => {
            const key = name.trim().toLowerCase();
            if (!channelStats[key]) {
                channelStats[key] = { wins: 0, losses: 0, displayName: name.trim() };
            }
            channelStats[key].losses += 1;
        });

        saveChannelStats();
        refreshAllPlayerElements();
        renderLeaderboard();

        matchModal.classList.add('hidden');
        showToast(`🏆 ${pendingMatch.winnerTitle} kazandı! +1W ve +1L istatistiklere işlendi.`);
        pendingMatch = null;
    }

    // =========================================================================
    // Sıralama Paneli (Liderlik Tablosu) Mantığı
    // =========================================================================

    function openLeaderboard() {
        renderLeaderboard();
        leaderboardModal.classList.remove('hidden');
    }

    function closeLeaderboard() {
        leaderboardModal.classList.add('hidden');
    }

    function renderLeaderboard() {
        if (!currentChannelNameDisplay || !leaderboardTbody) return;

        currentChannelNameDisplay.textContent = currentChannel.toUpperCase();
        const searchVal = leaderboardSearch ? leaderboardSearch.value.trim().toLowerCase() : '';
        const sortBy = leaderboardSort ? leaderboardSort.value : 'winrate';

        const playerKeys = Object.keys(channelStats);
        let playerList = playerKeys.map(k => {
            const s = channelStats[k];
            const total = s.wins + s.losses;
            const winRate = total > 0 ? (s.wins / total) * 100 : 0;
            const rank = calculateRank(s.wins, s.losses);
            return {
                name: s.displayName || k,
                wins: s.wins,
                losses: s.losses,
                total,
                winRate,
                rank
            };
        });

        // Arama filtresi
        if (searchVal) {
            playerList = playerList.filter(p => p.name.toLowerCase().includes(searchVal));
        }

        // Sıralama mantığı
        playerList.sort((a, b) => {
            if (sortBy === 'winrate') {
                if (b.winRate !== a.winRate) return b.winRate - a.winRate;
                if (b.wins !== a.wins) return b.wins - a.wins;
                return b.total - a.total;
            } else if (sortBy === 'wins') {
                if (b.wins !== a.wins) return b.wins - a.wins;
                return b.winRate - a.winRate;
            } else if (sortBy === 'matches') {
                if (b.total !== a.total) return b.total - a.total;
                return b.winRate - a.winRate;
            }
            return 0;
        });

        leaderboardTbody.innerHTML = '';

        if (playerList.length === 0) {
            if (leaderboardEmpty) leaderboardEmpty.classList.remove('hidden');
            return;
        }

        if (leaderboardEmpty) leaderboardEmpty.classList.add('hidden');

        playerList.forEach((player, idx) => {
            const tr = document.createElement('tr');

            // Pozisyon rozeti (#1, #2, #3, ...)
            let posHtml = '';
            if (idx === 0) posHtml = '<span class="pos-badge pos-1">1</span>';
            else if (idx === 1) posHtml = '<span class="pos-badge pos-2">2</span>';
            else if (idx === 2) posHtml = '<span class="pos-badge pos-3">3</span>';
            else posHtml = `<span class="pos-default">${idx + 1}</span>`;

            tr.innerHTML = `
                <td class="th-rank">${posHtml}</td>
                <td class="player-col">${player.name}</td>
                <td>
                    <span class="player-rank-chip ${player.rank.className}">
                        <i class="${player.rank.icon}"></i> ${player.rank.title}
                    </span>
                </td>
                <td class="th-center font-bold" style="color: #00ff00;">${player.wins}</td>
                <td class="th-center font-bold" style="color: #ff4d4d;">${player.losses}</td>
                <td class="th-center font-bold">${player.total}</td>
                <td class="th-rate">
                    <div class="rate-cell">
                        <span class="rate-val">%${player.winRate.toFixed(1)}</span>
                        <div class="rate-bar-bg">
                            <div class="rate-bar-fill" style="width: ${Math.min(100, Math.max(0, player.winRate))}%"></div>
                        </div>
                    </div>
                </td>
            `;
            leaderboardTbody.appendChild(tr);
        });
    }

    function addManualPlayer() {
        const name = manualNameInput.value.trim();
        if (name) {
            if (addPlayerToPool(name)) {
                manualNameInput.value = '';
            } else {
                showToast('Bu oyuncu zaten ekli!', true);
            }
        }
    }

    function clearAllPlayers() {
        if(confirm('Tüm oyuncuları silmek istediğinize emin misiniz?')) {
            playerPool.innerHTML = '';
            document.querySelectorAll('.team-list').forEach(list => {
                list.innerHTML = '';
                const teamBox = list.closest('.team-box') || list.closest('.bracket-team-slot');
                if (teamBox) {
                    const countBadge = teamBox.querySelector('.team-count');
                    if (countBadge) countBadge.textContent = '0';
                    teamBox.classList.remove('full');
                }
            });
            if (gameModeSelect.value === 'tournament') {
                tournamentMatches = getInitialTournamentMatches();
                initTeams();
            }
            updatePoolCount();
            showToast('Tüm oyuncular temizlendi.');
        }
    }

    function randomizePlayers() {
        const allPlayers = Array.from(playerPool.children);
        if (allPlayers.length === 0) {
            showToast('Havuzda dağıtılacak oyuncu yok!', true);
            return;
        }

        const teams = document.querySelectorAll('.team-list');
        const maxSize = parseInt(teamSizeSelect.value);
        
        // Karıştır
        for (let i = allPlayers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allPlayers[i], allPlayers[j]] = [allPlayers[j], allPlayers[i]];
        }

        let playerIndex = 0;
        let distributed = 0;

        const isTournament = gameModeSelect && gameModeSelect.value === 'tournament';
        teams.forEach(teamList => {
            let currentCount = teamList.children.length;
            const teamBox = teamList.closest('.team-box') || teamList.closest('.bracket-team-slot') || teamList.parentElement;
            const countBadge = teamBox ? teamBox.querySelector('.team-count') : null;

            while (currentCount < maxSize && playerIndex < allPlayers.length) {
                teamList.appendChild(allPlayers[playerIndex]);
                currentCount++;
                playerIndex++;
                distributed++;
            }
            
            if (countBadge) {
                countBadge.textContent = isTournament ? `${currentCount}/${maxSize}` : currentCount;
            }
            if (teamBox) {
                if (currentCount === maxSize) {
                    teamBox.classList.add('full');
                } else {
                    teamBox.classList.remove('full');
                }
            }
        });

        updatePoolCount();
        if (distributed > 0) {
            showToast(`${distributed} oyuncu takımlara dağıtıldı!`);
        }
        
        if (playerIndex < allPlayers.length) {
            showToast('Takımlar doldu, kalan oyuncular havuzda bekliyor.', true);
        }
    }

    function updateTeamLimits() {
        const maxSize = parseInt(teamSizeSelect.value);
        const isTournament = gameModeSelect && gameModeSelect.value === 'tournament';
        document.querySelectorAll('.team-list').forEach(list => {
            const teamBox = list.closest('.team-box') || list.closest('.bracket-team-slot') || list.parentElement;
            if (list.children.length > maxSize) {
                // Fazlalıkları havuza at
                while (list.children.length > maxSize) {
                    playerPool.appendChild(list.lastElementChild);
                }
            }
            
            if (teamBox) {
                const countBadge = teamBox.querySelector('.team-count');
                if (countBadge) {
                    countBadge.textContent = isTournament ? `${list.children.length}/${maxSize}` : list.children.length;
                }
                if (list.children.length === maxSize) {
                    teamBox.classList.add('full');
                } else {
                    teamBox.classList.remove('full');
                }
            }
        });
        updateTournamentHeaderBadge();
        updatePoolCount();
    }

    // =========================================================================
    // Kick Chat & Kesintisiz Bağlantı Sistemi
    // =========================================================================

    const KNOWN_STREAMERS = {
        'xqc': 668,
        'wtcn': 1000890,
        'elraenn': 31920,
        'kendinemuzisyen': 1000891,
        'mithrain': 1000892,
        'hype': 11956,
        'jaus': 16674,
        'alihan': 102435
    };

    function sanitizeChannelInput(input) {
        if (!input) return '';
        return input.trim().toLowerCase()
            .replace(/^https?:\/\/kick\.com\//i, '')
            .replace(/^kick\.com\//i, '')
            .replace(/^@/, '')
            .replace(/\/.*$/, '')
            .trim();
    }

    async function resolveKickChatroomId(rawInput) {
        const clean = sanitizeChannelInput(rawInput);
        if (!clean) return null;

        // 1. Doğrudan sayısal Sohbet ID girildiyse (Örn: 1000890)
        if (/^\d+$/.test(clean)) {
            return { id: parseInt(clean), channel: clean, source: 'direct_id' };
        }

        // 2. localStorage hafızasında kayıtlı mı?
        const cached = localStorage.getItem(`kick_chatroom_${clean}`);
        if (cached && /^\d+$/.test(cached)) {
            return { id: parseInt(cached), channel: clean, source: 'cached' };
        }

        // 3. Bilinen popüler yayıncı listesinde var mı?
        if (KNOWN_STREAMERS[clean]) {
            const id = KNOWN_STREAMERS[clean];
            localStorage.setItem(`kick_chatroom_${clean}`, id);
            return { id, channel: clean, source: 'known' };
        }

        // 4. Yerel Sunucu Köprüsü (Windows yerel API ile anında bağlanır)
        const currentOrigin = window.location.origin && window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:18888';
        const localEndpoints = [
            `${currentOrigin}/api/kick?channel=${encodeURIComponent(clean)}`,
            `http://localhost:18888/api/kick?channel=${encodeURIComponent(clean)}`,
            `http://127.0.0.1:18888/api/kick?channel=${encodeURIComponent(clean)}`
        ];

        for (const endpoint of localEndpoints) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                const res = await fetch(endpoint, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.success && data.chatroomId) {
                        localStorage.setItem(`kick_chatroom_${clean}`, data.chatroomId);
                        return { id: data.chatroomId, channel: clean, source: 'local_bridge' };
                    }
                }
            } catch (e) {
                // Yerel köprü yanıt vermediyse sonraki seçeneğe geç
            }
        }

        // 5. Çevrimiçi JSON Proxies (AllOrigins & CorsProxy Fallbacks)
        const onlineProxies = [
            `https://api.allorigins.win/get?url=${encodeURIComponent('https://kick.com/api/v2/channels/' + clean)}`,
            `https://corsproxy.io/?${encodeURIComponent('https://kick.com/api/v2/channels/' + clean)}`
        ];

        for (const proxyUrl of onlineProxies) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);
                const res = await fetch(proxyUrl, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (res.ok) {
                    let kickData = null;
                    const data = await res.json();
                    if (data && data.contents) {
                        kickData = typeof data.contents === 'string' ? JSON.parse(data.contents) : data.contents;
                    } else if (data && data.chatroom) {
                        kickData = data;
                    }

                    if (kickData && kickData.chatroom && kickData.chatroom.id) {
                        const id = kickData.chatroom.id;
                        localStorage.setItem(`kick_chatroom_${clean}`, id);
                        return { id, channel: clean, source: 'online_proxy' };
                    }
                }
            } catch (e) {
                // Proxy başarısız olursa bir sonrakini dene
            }
        }

        return { id: null, channel: clean };
    }

    async function connectToKick() {
        const raw = channelNameInput.value.trim();
        if (!raw) {
            showToast('Lütfen bir Kick kanal adı veya Sohbet ID girin!', true);
            return;
        }

        const clean = sanitizeChannelInput(raw);
        switchChannel(clean);

        connectBtn.disabled = true;
        connectBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Bağlanıyor...';
        connectionStatus.textContent = 'Aranıyor...';
        connectionStatus.className = 'status disconnected';

        try {
            const resolved = await resolveKickChatroomId(raw);

            if (!resolved || !resolved.id) {
                // Otomatik bulunamadıysa kullanıcı dostu yardım penceresini aç
                connectBtn.disabled = false;
                connectBtn.innerHTML = '<i class="fa-brands fa-kickstarter"></i> Chat\'e Bağlan';
                connectionStatus.textContent = 'Yardım Gerekli';
                connectionStatus.className = 'status disconnected';
                openKickModal(clean);
                showToast('Kanal ID otomatik alınamadı. Yardım merkezi açıldı.', true);
                return;
            }

            setupPusher(resolved.id, resolved.channel);

        } catch (error) {
            console.error('Kick bağlantı hatası:', error);
            showToast('Bağlantı hatası: ' + (error.message || 'Bilinmeyen hata'), true);
            connectionStatus.textContent = 'Hata';
            connectionStatus.className = 'status disconnected';
        } finally {
            connectBtn.disabled = false;
            connectBtn.innerHTML = '<i class="fa-brands fa-kickstarter"></i> Chat\'e Bağlan';
        }
    }

    function setupPusher(chatroomId, channelName = '') {
        if (pusher) {
            try {
                pusher.disconnect();
            } catch (e) {}
        }

        connectionStatus.textContent = 'Bağlanıyor...';
        connectionStatus.className = 'status disconnected';

        // Kick's Pusher App Key with full transport fallbacks
        pusher = new Pusher('32cbd69e4b950bf97679', {
            cluster: 'us2',
            forceTLS: true,
            wsHost: 'ws-us2.pusher.com',
            wsPort: 443,
            wssPort: 443,
            enabledTransports: ['ws', 'wss', 'xhr_streaming', 'xhr_polling']
        });

        pusher.connection.bind('connected', () => {
            connectionStatus.textContent = 'Bağlandı';
            connectionStatus.className = 'status connected';
        });

        pusher.connection.bind('connecting', () => {
            connectionStatus.textContent = 'Bağlanıyor...';
            connectionStatus.className = 'status disconnected';
        });

        pusher.connection.bind('disconnected', () => {
            connectionStatus.textContent = 'Bağlantı Kesildi';
            connectionStatus.className = 'status disconnected';
        });

        pusher.connection.bind('error', (err) => {
            console.error('Pusher ağ hatası:', err);
            connectionStatus.textContent = 'Ağ Hatası';
            connectionStatus.className = 'status disconnected';
        });

        chatChannel = pusher.subscribe(`chatrooms.${chatroomId}.v2`);

        chatChannel.bind('pusher:subscription_succeeded', () => {
            connectionStatus.textContent = 'Canlı Bağlandı';
            connectionStatus.className = 'status connected';
            const cmd = currentJoinCommand || '!kingsc';
            showToast(`${channelName ? channelName.toUpperCase() : 'Kick'} sohbetine bağlandı! Chate '${cmd}' yazanlar otomatik ekleniyor.`);
        });

        chatChannel.bind('pusher:subscription_error', (status) => {
            console.error('Pusher abonelik hatası:', status);
            connectionStatus.textContent = 'Oda Hatası';
            connectionStatus.className = 'status disconnected';
            showToast(`Odaya (${chatroomId}) bağlanılamadı. ID hatalı olabilir!`, true);
        });

        chatChannel.bind('App\\Events\\ChatMessageEvent', function(data) {
            let msgData = data;
            if (typeof msgData === 'string') {
                try {
                    msgData = JSON.parse(msgData);
                } catch (e) {
                    console.error('Pusher veri ayrıştırma hatası:', e);
                }
            }
            if (!msgData) return;

            const sender = msgData.sender || msgData.user || {};
            const username = sender.username || sender.slug;
            if (!username) return;

            // Mesaj içeriğini tespit et (Kick Pusher content veya message alanı)
            const rawContent = (msgData.content || msgData.message || msgData.text || '').trim();
            if (!rawContent) return;

            // Aktif katılım komutu kontrolü (örn: !kingsc, büyük/küçük harf ve Türkçe i/ı duyarsız)
            const activeCmd = (currentJoinCommand || '!kingsc').trim().toLowerCase().replace(/ı/g, 'i');
            const firstToken = rawContent.toLowerCase().split(/\s+/)[0].replace(/ı/g, 'i');

            if (firstToken === activeCmd) {
                const added = addPlayerToPool(username);
                if (added) {
                    showToast(`🎮 ${username} havuza eklendi! (${activeCmd})`);
                }
            }
        });
    }

    function openKickModal(channel) {
        const clean = sanitizeChannelInput(channel || (channelNameInput ? channelNameInput.value : '') || currentChannel || '');
        if (manualChatroomIdInput) {
            const cached = localStorage.getItem(`kick_chatroom_${clean}`);
            manualChatroomIdInput.value = cached || '';
        }
        if (findChatroomIdLink) {
            findChatroomIdLink.href = clean ? `https://kick.com/api/v2/channels/${clean}` : 'https://kick.com';
        }
        if (kickModal) kickModal.classList.remove('hidden');
    }

    function closeKickModal() {
        if (kickModal) kickModal.classList.add('hidden');
    }

    function handleManualChatroomIdSave() {
        const val = manualChatroomIdInput.value.trim();
        if (!val || isNaN(val) || parseInt(val) <= 0) {
            showToast('Lütfen geçerli bir sayısal Sohbet ID girin!', true);
            return;
        }
        const cleanChan = sanitizeChannelInput(channelNameInput ? channelNameInput.value : '') || currentChannel || 'genel';
        const id = parseInt(val);
        localStorage.setItem(`kick_chatroom_${cleanChan}`, id);
        closeKickModal();
        setupPusher(id, cleanChan);
        showToast(`${cleanChan.toUpperCase()} sohbet ID kaydedildi ve bağlanılıyor...`);
    }

    function showToast(message, isError = false) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${isError ? 'error' : ''}`;
        
        setTimeout(() => {
            toast.className = 'toast hidden';
        }, 3000);
    }

    // =========================================================================
    // İnteraktif Kullanım Rehberi (Tour Guide) & Klavye Kısayolu
    // =========================================================================
    const guideOverlay = document.getElementById('guideOverlay');
    const guideSpotlight = document.getElementById('guideSpotlight');
    const guideCard = document.getElementById('guideCard');
    const guideStepBadge = document.getElementById('guideStepBadge');
    const guideTitle = document.getElementById('guideTitle');
    const guideText = document.getElementById('guideText');
    const guideDotsContainer = document.getElementById('guideDots');
    const guidePrevBtn = document.getElementById('guidePrevBtn');
    const guideNextBtn = document.getElementById('guideNextBtn');
    const guideCloseBtn = document.getElementById('guideCloseBtn');
    const guideBtn = document.getElementById('guideBtn');

    let currentGuideStep = 0;
    let isGuideActive = false;

    const tourSteps = [
        {
            target: '.connection-panel',
            title: '<i class="fa-brands fa-kickstarter"></i> Kick Chat & !kingsc Komut Filtresi',
            text: 'Kick kanal adınızı yazıp <b>Chat\'e Bağlan</b> butonuna tıklayın. Yayınınızda sadece sohbete <b>!kingsc</b> (veya belirlediğiniz komutu) yazan izleyiciler otomatik olarak İzleyici Havuzuna eklenir.'
        },
        {
            target: '.controls',
            title: '<i class="fa-solid fa-sliders"></i> Oyun Modu & Son 16 Turnuva Ağacı',
            text: 'Oyun formatını belirleyin! <b>Tek Maç (2 Takım)</b> veya <b>Turnuva (16 Takım - Son 16)</b> seçebilir; takım boyutunu <b>5v5, 8v8 veya 11v11</b> olarak ayarlayabilirsiniz. Katılım komutunu da bu alandan özelleştirebilirsiniz.'
        },
        {
            target: '.pool-container',
            title: '<i class="fa-solid fa-users"></i> İzleyici Havuzu & Manuel Ekleme',
            text: 'Sohbetten gelen izleyiciler burada toplanır. Dilerseniz arama kutusuna isim yazıp <b>+</b> butonuna veya Enter\'a basarak manuel olarak da oyuncu ekleyebilirsiniz.'
        },
        {
            target: '.action-buttons',
            title: '<i class="fa-solid fa-shuffle"></i> Hızlı Aksiyonlar & Ağacı Sıfırla',
            text: '<b>Rastgele Dağıt</b> butonuna basarak havuzdaki tüm oyuncuları takımlara adil paylaştırabilirsiniz. Turnuva modunda <b>Turnuvayı Sıfırla</b> butonu ile fikstürü baştan başlatabilirsiniz.'
        },
        {
            target: '#teamsContainer',
            title: '<i class="fa-solid fa-sitemap"></i> Son 16 Turnuva Ağacı & Tur Atlama',
            text: 'Turnuva modunda 16 takım çift taraflı (UEFA/Dünya Kupası stili) profesyonel ağaçta listelenir. Maçlarda <b>🏆 Kazandı</b> butonuna basarak galip takımı kadrosuyla birlikte Çeyrek Finale, Yarı Finale ve Büyük Finale yükseltebilirsiniz!'
        },
        {
            target: '#leaderboardBtn',
            title: '<i class="fa-solid fa-trophy"></i> Rekabetçi Rank & Sıralama Paneli',
            text: 'Oyuncuların maç sonuçlarına göre <b>Win Rate (%)</b> hesaplanır ve <b>Bronz\'dan Efsane\'ye</b> kadar dinamik kademeleri (Rank) belirlenir. Bu panel ile kanalınızın canlı liderlik tablosunu görüntüleyebilir, arama yapabilir ve filtreleyebilirsiniz.'
        },
        {
            target: '#teamsContainer',
            title: '<i class="fa-solid fa-medal"></i> Maç Sonucu & Kalıcı İstatistik',
            text: 'Takım başlığındaki <b>🏆 Kazandı</b> butonuna basarak galip takımı ilan edebilirsiniz. Kazanan oyunculara <b>+1 W</b>, kaybedenlere <b>+1 L</b> yazılır. Kanal verileri tarayıcınıza kaydedilir; sayfayı yenileseniz veya sonraki gün açsanız bile istatistikler asla sıfırlanmaz!'
        },
        {
            target: '#guideBtn',
            title: '<i class="fa-solid fa-circle-question"></i> Kısayol & İpuçları',
            text: 'Bu öğreticiyi istediğiniz an klavyenizden <kbd>H</kbd> tuşuna basarak veya buradaki <b>Rehber (H)</b> butonuna tıklayarak tekrar başlatabilirsiniz!'
        }
    ];

    function initGuideDots() {
        guideDotsContainer.innerHTML = '';
        tourSteps.forEach((_, idx) => {
            const dot = document.createElement('div');
            dot.className = `guide-dot ${idx === currentGuideStep ? 'active' : ''}`;
            dot.addEventListener('click', () => showGuideStep(idx));
            guideDotsContainer.appendChild(dot);
        });
    }

    function positionGuide(stepIndex) {
        const step = tourSteps[stepIndex];
        const targetEl = document.querySelector(step.target);

        if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            
            // Küçük bir gecikmeyle pozisyonu hesapla (scroll hareketi için)
            setTimeout(() => {
                const rect = targetEl.getBoundingClientRect();
                const padding = 8;
                
                // Spotlight Çerçevesi
                guideSpotlight.style.top = `${Math.max(0, rect.top - padding)}px`;
                guideSpotlight.style.left = `${Math.max(0, rect.left - padding)}px`;
                guideSpotlight.style.width = `${rect.width + padding * 2}px`;
                guideSpotlight.style.height = `${rect.height + padding * 2}px`;
                guideSpotlight.style.display = 'block';

                // Rehber Kartı
                const cardWidth = Math.min(440, window.innerWidth - 40);
                let cardLeft = rect.left + (rect.width / 2) - (cardWidth / 2);
                cardLeft = Math.max(20, Math.min(window.innerWidth - cardWidth - 20, cardLeft));

                let cardTop = rect.bottom + 16;
                // Ekranın altına taşarsa yukarı al
                if (cardTop + 240 > window.innerHeight) {
                    cardTop = Math.max(20, rect.top - 240 - 16);
                }

                guideCard.style.top = `${cardTop}px`;
                guideCard.style.left = `${cardLeft}px`;
            }, 50);
        } else {
            // Hedef yoksa ekran ortasına al
            guideSpotlight.style.display = 'none';
            guideCard.style.top = '50%';
            guideCard.style.left = '50%';
            guideCard.style.transform = 'translate(-50%, -50%)';
        }
    }

    function showGuideStep(stepIndex) {
        currentGuideStep = stepIndex;
        const step = tourSteps[stepIndex];

        guideStepBadge.textContent = `Adım ${stepIndex + 1} / ${tourSteps.length}`;
        guideTitle.innerHTML = step.title;
        guideText.innerHTML = step.text;

        // Buton durumları
        guidePrevBtn.style.visibility = stepIndex === 0 ? 'hidden' : 'visible';
        
        if (stepIndex === tourSteps.length - 1) {
            guideNextBtn.innerHTML = 'Tamamla <i class="fa-solid fa-check"></i>';
        } else {
            guideNextBtn.innerHTML = 'İleri <i class="fa-solid fa-chevron-right"></i>';
        }

        // Noktaları güncelle
        const dots = guideDotsContainer.querySelectorAll('.guide-dot');
        dots.forEach((dot, idx) => {
            dot.classList.toggle('active', idx === stepIndex);
        });

        positionGuide(stepIndex);
    }

    function openGuide() {
        isGuideActive = true;
        guideOverlay.classList.remove('hidden');
        initGuideDots();
        showGuideStep(0);
    }

    function closeGuide() {
        isGuideActive = false;
        guideOverlay.classList.add('hidden');
    }

    function toggleGuide() {
        if (isGuideActive) {
            closeGuide();
        } else {
            openGuide();
        }
    }

    function nextGuideStep() {
        if (currentGuideStep < tourSteps.length - 1) {
            showGuideStep(currentGuideStep + 1);
        } else {
            closeGuide();
            showToast('Rehber tamamlandı! Dilediğiniz an H tuşuyla tekrar açabilirsiniz.');
        }
    }

    function prevGuideStep() {
        if (currentGuideStep > 0) {
            showGuideStep(currentGuideStep - 1);
        }
    }

    // Rehber Event Dinleyicileri
    if (guideBtn) guideBtn.addEventListener('click', toggleGuide);
    if (guideCloseBtn) guideCloseBtn.addEventListener('click', closeGuide);
    if (guideNextBtn) guideNextBtn.addEventListener('click', nextGuideStep);
    if (guidePrevBtn) guidePrevBtn.addEventListener('click', prevGuideStep);

    // Overlay arka planına tıklanırsa kapat
    guideOverlay.addEventListener('click', (e) => {
        if (e.target === guideOverlay) {
            closeGuide();
        }
    });

    // Pencere yeniden boyutlandırıldığında pozisyonu güncelle
    window.addEventListener('resize', () => {
        if (isGuideActive) positionGuide(currentGuideStep);
    });

    // Klavye Kısayolları (H, Esc, Yön Tuşları)
    window.addEventListener('keydown', (e) => {
        const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

        // H tuşu ile rehberi aç / kapat (Kullanıcı yazı yazmıyorken)
        if ((e.key === 'h' || e.key === 'H') && !isTyping) {
            e.preventDefault();
            toggleGuide();
            return;
        }

        // Rehber açıkken gezinme
        if (isGuideActive) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeGuide();
            } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
                e.preventDefault();
                nextGuideStep();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                prevGuideStep();
            }
        }
    });
});
