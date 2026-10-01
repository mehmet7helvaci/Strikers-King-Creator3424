document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // Web Audio API - Multi-Theme Audio Engine & SFX Manager
    // =========================================================================
    let audioCtx = null;

    let musicEnabled = localStorage.getItem('audio_music_enabled') !== 'false';
    let musicVolume = parseFloat(localStorage.getItem('audio_music_volume') || '40') / 100;
    let sfxEnabled = localStorage.getItem('audio_sfx_enabled') !== 'false';
    let sfxVolume = parseFloat(localStorage.getItem('audio_sfx_volume') || '70') / 100;
    let musicTheme = localStorage.getItem('audio_music_theme') || 'stadium';

    let bgMusicGainNode = null;
    let bgMusicOscTimer = null;
    let bgMusicActive = false;

    // OBS Overlay Modu Tespiti (Müzik ve gereksiz sesleri kapatmak için)
    function isOverlayModeActive() {
        if (typeof document !== 'undefined') {
            if (document.documentElement && document.documentElement.classList.contains('obs-overlay-mode')) return true;
            if (document.body && document.body.classList.contains('obs-overlay-mode')) return true;
        }
        if (typeof window !== 'undefined') {
            if (window.obsstudio !== undefined) return true;
            if (window.location) {
                try {
                    const p = new URLSearchParams(window.location.search);
                    if (p.get('overlay') === '1' || window.location.hash.indexOf('overlay') !== -1) return true;
                } catch (e) {}
            }
            if (navigator && navigator.userAgent && (navigator.userAgent.indexOf('OBS') !== -1 || navigator.userAgent.indexOf('obs-browser') !== -1)) {
                return true;
            }
        }
        return false;
    }

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

    // Müzik Teması Değiştirici
    function setMusicTheme(theme) {
        if (!['stadium', 'cyber', 'chill', 'arcade'].includes(theme)) return;
        musicTheme = theme;
        localStorage.setItem('audio_music_theme', theme);

        document.querySelectorAll('.theme-card').forEach(card => {
            const radio = card.querySelector('input[type="radio"]');
            if (radio) {
                const match = radio.value === theme;
                radio.checked = match;
                card.classList.toggle('active', match);
            }
        });

        if (bgMusicActive) {
            stopBackgroundMusic();
            playBackgroundMusic();
        }
    }

    // 1. Background Music Synthesizer (4 Farklı Seçilebilir Müzik Teması)
    function playBackgroundMusic() {
        if (isOverlayModeActive()) return;
        if (!musicEnabled || bgMusicActive) return;
        const ctx = getAudioContext();
        if (!ctx) return;

        try {
            bgMusicActive = true;
            if (bgMusicGainNode) {
                try { bgMusicGainNode.disconnect(); } catch (e) {}
            }

            bgMusicGainNode = ctx.createGain();
            bgMusicGainNode.gain.setValueAtTime(musicVolume * 0.24, ctx.currentTime);
            bgMusicGainNode.connect(ctx.destination);

            let bpm = 118;
            if (musicTheme === 'cyber') bpm = 128;
            else if (musicTheme === 'chill') bpm = 85;
            else if (musicTheme === 'arcade') bpm = 140;
            else bpm = 118; // stadium

            const stepTime = (60 / bpm) / 4; // 16th note
            let currentStep = 0;

            const stadiumChords = [130.81, 164.81, 196.00, 261.63, 293.66, 329.63];
            const cyberScale = [110.00, 130.81, 146.83, 164.81, 196.00, 220.00, 261.63];
            const chillChords = [146.83, 174.61, 220.00, 261.63, 329.63, 392.00];
            const arcadeNotes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];

            bgMusicOscTimer = setInterval(() => {
                if (!musicEnabled || !bgMusicActive) return;
                const now = ctx.currentTime;

                if (musicTheme === 'cyber') {
                    // CYBER EDM / SYNTHWAVE
                    const bassFreq = (currentStep % 16 < 8) ? 55.0 : ((currentStep % 16 < 12) ? 65.41 : 73.42);
                    const bassOsc = ctx.createOscillator();
                    const bassGain = ctx.createGain();
                    bassOsc.type = 'sawtooth';
                    bassOsc.frequency.setValueAtTime(bassFreq, now);

                    const filter = ctx.createBiquadFilter();
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(currentStep % 4 === 0 ? 900 : 450, now);

                    bassGain.gain.setValueAtTime(0.12, now);
                    bassGain.gain.exponentialRampToValueAtTime(0.001, now + stepTime * 0.9);

                    bassOsc.connect(filter);
                    filter.connect(bassGain);
                    bassGain.connect(bgMusicGainNode);
                    bassOsc.start(now);
                    bassOsc.stop(now + stepTime);

                    // Kick on quarter notes
                    if (currentStep % 4 === 0) {
                        const kickOsc = ctx.createOscillator();
                        const kickGain = ctx.createGain();
                        kickOsc.frequency.setValueAtTime(140, now);
                        kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.08);
                        kickGain.gain.setValueAtTime(0.25, now);
                        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                        kickOsc.connect(kickGain);
                        kickGain.connect(bgMusicGainNode);
                        kickOsc.start(now);
                        kickOsc.stop(now + 0.13);
                    }

                    // Cyber Arp on 16th
                    if (currentStep % 2 === 0) {
                        const arpNote = cyberScale[(currentStep * 3) % cyberScale.length] * 2;
                        const leadOsc = ctx.createOscillator();
                        const leadGain = ctx.createGain();
                        leadOsc.type = 'square';
                        leadOsc.frequency.setValueAtTime(arpNote, now);
                        leadGain.gain.setValueAtTime(0.035, now);
                        leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
                        leadOsc.connect(leadGain);
                        leadGain.connect(bgMusicGainNode);
                        leadOsc.start(now);
                        leadOsc.stop(now + 0.10);
                    }
                } else if (musicTheme === 'chill') {
                    // CHILL LO-FI
                    if (currentStep % 4 === 0) {
                        const chordRoot = chillChords[(Math.floor(currentStep / 16)) % chillChords.length];
                        [chordRoot, chordRoot * 1.25, chordRoot * 1.5].forEach((f, i) => {
                            const eOsc = ctx.createOscillator();
                            const eGain = ctx.createGain();
                            eOsc.type = 'sine';
                            eOsc.frequency.setValueAtTime(f, now);
                            eGain.gain.setValueAtTime(0.07 / (i + 1), now);
                            eGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
                            eOsc.connect(eGain);
                            eGain.connect(bgMusicGainNode);
                            eOsc.start(now);
                            eOsc.stop(now + 0.5);
                        });

                        const subOsc = ctx.createOscillator();
                        const subGain = ctx.createGain();
                        subOsc.type = 'sine';
                        subOsc.frequency.setValueAtTime(chordRoot * 0.5, now);
                        subGain.gain.setValueAtTime(0.18, now);
                        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                        subOsc.connect(subGain);
                        subGain.connect(bgMusicGainNode);
                        subOsc.start(now);
                        subOsc.stop(now + 0.4);
                    }
                } else if (musicTheme === 'arcade') {
                    // 8-BIT RETRO ARCADE
                    const arcNote = arcadeNotes[(currentStep * 5 + Math.floor(currentStep / 8)) % arcadeNotes.length];
                    const arcOsc = ctx.createOscillator();
                    const arcGain = ctx.createGain();
                    arcOsc.type = 'square';
                    arcOsc.frequency.setValueAtTime(arcNote, now);
                    arcGain.gain.setValueAtTime(0.05, now);
                    arcGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                    arcOsc.connect(arcGain);
                    arcGain.connect(bgMusicGainNode);
                    arcOsc.start(now);
                    arcOsc.stop(now + 0.09);

                    if (currentStep % 2 === 0) {
                        const bFreq = (currentStep % 8 < 4) ? 130.81 : 98.00;
                        const bOsc = ctx.createOscillator();
                        const bGain = ctx.createGain();
                        bOsc.type = 'triangle';
                        bOsc.frequency.setValueAtTime(bFreq, now);
                        bGain.gain.setValueAtTime(0.15, now);
                        bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                        bOsc.connect(bGain);
                        bGain.connect(bgMusicGainNode);
                        bOsc.start(now);
                        bOsc.stop(now + 0.14);
                    }
                } else {
                    // STADIUM ANTHEM (Varsayılan)
                    if (currentStep % 4 === 0) {
                        const bassOsc = ctx.createOscillator();
                        const bassGain = ctx.createGain();
                        bassOsc.type = 'triangle';
                        bassOsc.frequency.setValueAtTime(65.41, now);
                        bassOsc.frequency.exponentialRampToValueAtTime(32.7, now + 0.16);

                        bassGain.gain.setValueAtTime(0.22, now);
                        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

                        bassOsc.connect(bassGain);
                        bassGain.connect(bgMusicGainNode);
                        bassOsc.start(now);
                        bassOsc.stop(now + 0.20);
                    }

                    const noteIndex = (currentStep * 3 + Math.floor(currentStep / 4)) % stadiumChords.length;
                    const noteFreq = stadiumChords[noteIndex] * (currentStep % 8 === 0 ? 2 : 1);

                    const arpOsc = ctx.createOscillator();
                    const arpGain = ctx.createGain();
                    arpOsc.type = 'sine';
                    arpOsc.frequency.setValueAtTime(noteFreq, now);

                    arpGain.gain.setValueAtTime(0.07, now);
                    arpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

                    arpOsc.connect(arpGain);
                    arpGain.connect(bgMusicGainNode);
                    arpOsc.start(now);
                    arpOsc.stop(now + 0.13);

                    if (currentStep % 64 === 0) {
                        playCrowdCheerSfx('ambient');
                    }
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

            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1100, now);
            filter.Q.setValueAtTime(1.2, now);

            const gainNode = ctx.createGain();
            let targetVol = 0.04;
            if (intensity === 'high') targetVol = 0.10;
            else if (intensity === 'ambient') targetVol = 0.025;

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

    // Hakem Düdüğü Sentezleyicisi (Referee Whistle SFX)
    function playWhistleSfx() {
        if (!sfxEnabled) return;
        const ctx = getAudioContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(sfxVolume * 0.45, now);
            masterGain.connect(ctx.destination);

            const bursts = [
                { start: now, dur: 0.15 },
                { start: now + 0.20, dur: 0.35 }
            ];

            bursts.forEach(b => {
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                const lfo = ctx.createOscillator();
                const lfoGain = ctx.createGain();
                const burstGain = ctx.createGain();

                osc1.type = 'sine';
                osc2.type = 'sine';
                osc1.frequency.setValueAtTime(2650, b.start);
                osc2.frequency.setValueAtTime(2980, b.start);

                lfo.frequency.setValueAtTime(14, b.start);
                lfoGain.gain.setValueAtTime(45, b.start);
                lfo.connect(lfoGain);
                lfoGain.connect(osc1.frequency);
                lfoGain.connect(osc2.frequency);

                burstGain.gain.setValueAtTime(0.001, b.start);
                burstGain.gain.linearRampToValueAtTime(0.35, b.start + 0.02);
                burstGain.gain.exponentialRampToValueAtTime(0.001, b.start + b.dur);

                osc1.connect(burstGain);
                osc2.connect(burstGain);
                burstGain.connect(masterGain);

                lfo.start(b.start);
                osc1.start(b.start);
                osc2.start(b.start);

                lfo.stop(b.start + b.dur + 0.05);
                osc1.stop(b.start + b.dur + 0.05);
                osc2.stop(b.start + b.dur + 0.05);
            });
        } catch (e) {
            console.warn('Whistle error:', e);
        }
    }

    // Stadyum Gol Kornası / Siren Sentezleyicisi (Stadium Goal Horn SFX)
    function playGoalHornSfx() {
        if (!sfxEnabled) return;
        const ctx = getAudioContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const hornGain = ctx.createGain();
            hornGain.gain.setValueAtTime(sfxVolume * 0.40, now);
            hornGain.connect(ctx.destination);

            const freqs = [116.54, 174.61, 293.66];
            freqs.forEach((f, idx) => {
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = idx === 0 ? 'sawtooth' : 'triangle';
                osc.frequency.setValueAtTime(f, now);

                g.gain.setValueAtTime(0.001, now);
                g.gain.linearRampToValueAtTime(0.38, now + 0.08);
                g.gain.setValueAtTime(0.35, now + 1.1);
                g.gain.exponentialRampToValueAtTime(0.001, now + 1.7);

                osc.connect(g);
                g.connect(hornGain);
                osc.start(now);
                osc.stop(now + 1.75);
            });

            setTimeout(() => playCrowdCheerSfx('high'), 300);
        } catch (e) {
            console.warn('Goal horn error:', e);
        }
    }

    // 2. UI Sound Effects Synthesizer
    function playUiSfx(type) {
        if (!sfxEnabled) return;
        const ctx = getAudioContext();
        if (!ctx) return;

        if (type === 'whistle') {
            playWhistleSfx();
            return;
        }
        if (type === 'goalhorn') {
            playGoalHornSfx();
            return;
        }

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
        if (isOverlayModeActive()) return;
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
            metalGain.linearRampToValueAtTime(0.35, now + 0.002);
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
        if (isOverlayModeActive()) {
            splashScreen.classList.add('hidden');
            splashScreen.style.display = 'none';
        } else {
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
    }

    // DOM Elements
    const gameModeSelect = document.getElementById('gameMode');
    const teamSizeSelect = document.getElementById('teamSize');
    const teamsContainer = document.getElementById('teamsContainer');
    const playerPool = document.getElementById('playerPool');
    const poolCount = document.getElementById('poolCount');
    const manualNameInput = document.getElementById('manualName');
    const addManualBtn = document.getElementById('addManualBtn');
    const poolSearchInput = document.getElementById('poolSearchInput');
    const clearPoolSearchBtn = document.getElementById('clearPoolSearchBtn');
    const poolSearchCount = document.getElementById('poolSearchCount');
    const poolNoMatch = document.getElementById('poolNoMatch');
    const randomizeBtn = document.getElementById('randomizeBtn');
    const clearBtn = document.getElementById('clearBtn');
    const channelNameInput = document.getElementById('channelName');
    const connectBtn = document.getElementById('connectBtn');
    const connectionStatus = document.getElementById('connectionStatus');
    const activeChannelsContainer = document.getElementById('activeChannelsContainer');
    const draftDiceBtn = document.getElementById('draftDiceBtn');
    const draftTurnBanner = document.getElementById('draftTurnBanner');
    const activeCaptainDisplay = document.getElementById('activeCaptainDisplay');
    const activeTeamDisplay = document.getElementById('activeTeamDisplay');
    const nextCaptainDisplay = document.getElementById('nextCaptainDisplay');
    const draftSkipTurnBtn = document.getElementById('draftSkipTurnBtn');
    const draftReDiceBtn = document.getElementById('draftReDiceBtn');
    const draftEndBtn = document.getElementById('draftEndBtn');
    const diceRollModal = document.getElementById('diceRollModal');
    const closeDiceModalBtn = document.getElementById('closeDiceModalBtn');
    const reRollDiceBtn = document.getElementById('reRollDiceBtn');
    const startDraftTurnBtn = document.getElementById('startDraftTurnBtn');
    const diceAnimationStage = document.getElementById('diceAnimationStage');
    const diceResultContainer = document.getElementById('diceResultContainer');
    const diceWinnerName = document.getElementById('diceWinnerName');
    const diceWinnerScoreBadge = document.getElementById('diceWinnerScoreBadge');
    const diceOrderList = document.getElementById('diceOrderList');

    // 👑 Kaptan Sistemi DOM Elemanları
    const captainLimitMinusBtn = document.getElementById('captainLimitMinusBtn');
    const captainLimitPlusBtn = document.getElementById('captainLimitPlusBtn');
    const captainLimitDisplay = document.getElementById('captainLimitDisplay');
    const captainCountBadge = document.getElementById('captainCountBadge');

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
    const exportDataBtn = document.getElementById('exportDataBtn');
    const importDataBtn = document.getElementById('importDataBtn');
    const importFileInput = document.getElementById('importFileInput');

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

    // Katılımcı Sayısı & Ağaç Özelleştirme DOM Elemanları
    const tournamentSizeGroup = document.getElementById('tournamentSizeGroup');
    const participantCountInput = document.getElementById('participantCountInput');
    const applyParticipantCountBtn = document.getElementById('applyParticipantCountBtn');
    const participantCalcBadge = document.getElementById('participantCalcBadge');

    // Bracket State
    let tournamentTeamCount = parseInt(localStorage.getItem('kick_tournament_team_count') || '8', 10);
    if (![4, 8, 16].includes(tournamentTeamCount)) tournamentTeamCount = 8;
    let bracketOrientation = localStorage.getItem('kick_bracket_orientation') || 'horizontal'; // 'horizontal' veya 'upward'
    let bracketZoom = parseFloat(localStorage.getItem('kick_bracket_zoom') || '1.0');
    if (isNaN(bracketZoom) || bracketZoom < 0.5 || bracketZoom > 1.5) bracketZoom = 1.0;

    // State
    let players = [];
    let sortableInstances = [];
    let pusher = null;
    let chatChannel = null;
    let currentChannel = 'genel';
    const activeChannels = new Map(); // channelSlug -> { id, channel, subChannelName, subscription }
    const playerRoles = new Map(); // usernameLower -> roleString (e.g. 'GK', 'CB', 'RM')
    try {
        const savedRoles = JSON.parse(localStorage.getItem('kick_player_roles') || '{}');
        if (savedRoles && typeof savedRoles === 'object') {
            Object.entries(savedRoles).forEach(([u, r]) => {
                if (u && r) playerRoles.set(u.toString().trim().toLowerCase(), r.toString().toUpperCase());
            });
        }
    } catch (e) {}
    let draftModeActive = false;
    let currentDraftOrder = []; // [ { name, teamList, teamName, score, element } ]
    let currentDraftIndex = 0;
    let channelStats = {};
    let pendingMatch = null;
    let tournamentMatches = null;
    let currentJoinCommand = localStorage.getItem('kick_strikers_join_cmd') || '!kingsc';
    let captainLimit = parseInt(localStorage.getItem('kick_captain_limit') || (gameModeSelect && gameModeSelect.value === 'tournament' ? '8' : '2'), 10);
    if (isNaN(captainLimit) || captainLimit < 1) captainLimit = 2;
    const captainSet = new Set();
    try {
        const savedCaps = JSON.parse(localStorage.getItem('kick_captains_set') || '[]');
        if (Array.isArray(savedCaps)) {
            savedCaps.forEach(c => {
                if (c) captainSet.add(c.toString().trim().toLowerCase());
            });
        }
    } catch (e) {}

    // Avatar Cache & API Helper
    const userAvatarCache = new Map();
    const avatarFetchingSet = new Set();
    function getApiBase() {
        return (window.location.protocol.startsWith('http') ? window.location.origin : 'http://localhost:18888');
    }

    // Initialize
    initChannelStorage();
    initJoinCommand();
    initTeams();
    initPoolSortable();
    initCaptainSystem();

    // Event Listeners
    gameModeSelect.addEventListener('change', () => {
        playUiSfx('click');
        if (gameModeSelect.value === 'tournament' && captainLimit < tournamentTeamCount) {
            setCaptainLimit(tournamentTeamCount);
        } else if (gameModeSelect.value === 'single' && captainLimit === tournamentTeamCount) {
            setCaptainLimit(2);
        }
        initTeams();
    });
    teamSizeSelect.addEventListener('change', () => {
        playUiSfx('click');
        updateTeamLimits();
        updateTournamentHeaderBadge();
        updateParticipantCalculation();
    });

    if (participantCountInput) {
        participantCountInput.addEventListener('input', updateParticipantCalculation);
    }
    if (applyParticipantCountBtn) {
        applyParticipantCountBtn.addEventListener('click', applyParticipantCountSettings);
    }
    
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

    const addTestPlayersBtn = document.getElementById('addTestPlayersBtn');

    if (addTestPlayersBtn) {
        addTestPlayersBtn.addEventListener('click', () => {
            playUiSfx('join');
            const sampleNames = [
                'wtcn', 'xqc', 'StrikerKing', 'ProGamer99', 'GamerGirl', 'NeonShadow', 'CyberKnight',
                'FastFeet', 'GoalHunter', 'AlphaWolf', 'KickMaster', 'TurboPlayer',
                'HyperStrike', 'ApexLegend', 'PixelHero', 'SpeedyGonzales', 'EagleEye'
            ];
            let addedCount = 0;
            // Rastgele 10 tanesini seç veya numara ekleyerek garantile
            for (let i = 0; i < sampleNames.length && addedCount < 10; i++) {
                const name = sampleNames[i];
                if (addPlayerToPool(name)) {
                    addedCount++;
                } else {
                    const altName = `${name}_${Math.floor(Math.random() * 89 + 10)}`;
                    if (addPlayerToPool(altName)) {
                        addedCount++;
                    }
                }
            }
            showToast(`🚀 ${addedCount} test izleyicisi havuza eklendi!`);
        });
    }

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

        // Tema kartlarını da senkronize et
        document.querySelectorAll('.theme-card').forEach(card => {
            const radio = card.querySelector('input[type="radio"]');
            if (radio) {
                const match = radio.value === musicTheme;
                radio.checked = match;
                card.classList.toggle('active', match);
            }
        });

        audioModal.classList.remove('hidden');
        playUiSfx('click');
    }

    function closeAudioModal() {
        if (!audioModal) return;
        audioModal.classList.add('hidden');
        playUiSfx('click');
    }

    if (audioSettingsBtn) {
        audioSettingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Çekmece açıksa doğrudan çekmecenin Müzik & Ses sekmesine geçiş yap
            const drawer = document.getElementById('settingsDrawer');
            if (drawer && !drawer.classList.contains('hidden')) {
                const musicTabBtn = document.querySelector('.drawer-tab-btn[data-drawer-tab="music"]');
                if (musicTabBtn) {
                    musicTabBtn.click();
                    playUiSfx('click');
                    return;
                }
            }
            openAudioModal();
        });
    }
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
            const drawerMusicToggle = document.getElementById('drawerMusicToggle');
            if (drawerMusicToggle) drawerMusicToggle.checked = musicEnabled;
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
            const drawerMusicVolumeSlider = document.getElementById('drawerMusicVolumeSlider');
            const drawerMusicVolumeValue = document.getElementById('drawerMusicVolumeValue');
            if (drawerMusicVolumeSlider) drawerMusicVolumeSlider.value = musicVolumeSlider.value;
            if (drawerMusicVolumeValue) drawerMusicVolumeValue.textContent = `${musicVolumeSlider.value}%`;
            localStorage.setItem('audio_music_volume', musicVolumeSlider.value);
            updateMusicVolume();
        });
    }

    if (sfxToggle) {
        sfxToggle.addEventListener('change', () => {
            sfxEnabled = sfxToggle.checked;
            localStorage.setItem('audio_sfx_enabled', sfxEnabled);
            const drawerSfxToggle = document.getElementById('drawerSfxToggle');
            if (drawerSfxToggle) drawerSfxToggle.checked = sfxEnabled;
            if (sfxEnabled) playUiSfx('click');
        });
    }

    if (sfxVolumeSlider) {
        sfxVolumeSlider.addEventListener('input', () => {
            sfxVolume = parseFloat(sfxVolumeSlider.value) / 100;
            sfxVolumeValue.textContent = `${sfxVolumeSlider.value}%`;
            const drawerSfxVolumeSlider = document.getElementById('drawerSfxVolumeSlider');
            const drawerSfxVolumeValue = document.getElementById('drawerSfxVolumeValue');
            if (drawerSfxVolumeSlider) drawerSfxVolumeSlider.value = sfxVolumeSlider.value;
            if (drawerSfxVolumeValue) drawerSfxVolumeValue.textContent = `${sfxVolumeSlider.value}%`;
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

    // İzleyici Havuzu İsim Arama Dinleyicileri
    if (poolSearchInput) {
        poolSearchInput.addEventListener('input', (e) => {
            filterPlayerPool(e.target.value);
        });
        poolSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                poolSearchInput.value = '';
                filterPlayerPool('');
            }
        });
    }
    if (clearPoolSearchBtn) {
        clearPoolSearchBtn.addEventListener('click', () => {
            if (poolSearchInput) {
                poolSearchInput.value = '';
                poolSearchInput.focus();
            }
            filterPlayerPool('');
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

    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', () => {
            exportAllDataToJson();
        });
    }

    if (importDataBtn && importFileInput) {
        importDataBtn.addEventListener('click', () => {
            importFileInput.click();
        });
        importFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                importDataFromJsonFile(e.target.files[0]);
                importFileInput.value = '';
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
    if (matchLoserSelect) matchLoserSelect.addEventListener('change', renderMatchStatsTable);

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
            if (tournamentSizeGroup) tournamentSizeGroup.classList.add('hidden');
            initSingleMode();
        } else {
            if (resetTournamentBtn) resetTournamentBtn.classList.remove('hidden');
            if (tournamentSizeGroup) tournamentSizeGroup.classList.remove('hidden');
            updateParticipantCalculation();
            initTournamentMode();
        }
        updatePoolCount();
    }

    function initSingleMode() {
        for (let i = 1; i <= 2; i++) {
            const teamBox = document.createElement('div');
            teamBox.className = 'team-box';
            teamBox.id = `team${i}Box`;
            teamBox.dataset.teamIndex = i;
            
            const teamHeader = document.createElement('div');
            teamHeader.className = 'team-header';

            // Takım Sürükleme Tutamağı (Drag Handle)
            const dragHandle = document.createElement('div');
            dragHandle.className = 'team-drag-handle';
            dragHandle.draggable = true;
            dragHandle.title = 'Takımı sürükleyip diğer takımla yer değiştirin';
            dragHandle.innerHTML = '&#8942;&#8942;';

            dragHandle.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                teamBox.classList.add('team-dragging');
                const dragPayload = { type: 'single_team', teamIndex: i };
                e.dataTransfer.setData('application/json', JSON.stringify(dragPayload));
                e.dataTransfer.setData('text/plain', JSON.stringify(dragPayload));
                e.dataTransfer.effectAllowed = 'move';
            });

            dragHandle.addEventListener('dragend', (e) => {
                e.stopPropagation();
                teamBox.classList.remove('team-dragging');
                document.querySelectorAll('.team-swap-target').forEach(el => el.classList.remove('team-swap-target'));
                document.querySelectorAll('.team-dragging').forEach(el => el.classList.remove('team-dragging'));
            });

            teamBox.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                if (!teamBox.classList.contains('team-dragging')) {
                    teamBox.classList.add('team-swap-target');
                }
            });

            teamBox.addEventListener('dragleave', (e) => {
                e.stopPropagation();
                teamBox.classList.remove('team-swap-target');
            });

            teamBox.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                teamBox.classList.remove('team-swap-target');
                document.querySelectorAll('.team-dragging').forEach(el => el.classList.remove('team-dragging'));

                let dataStr = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
                if (!dataStr) return;
                try {
                    const payload = JSON.parse(dataStr);
                    if (payload.type === 'single_team' && payload.teamIndex !== i) {
                        executeSingleModeTeamSwap(payload.teamIndex, i);
                    }
                } catch(err) {}
            });
            
            const teamInput = document.createElement('input');
            teamInput.type = 'text';
            teamInput.value = `Takım ${i}`;
            teamInput.setAttribute('value', `Takım ${i}`);
            teamInput.addEventListener('input', function() { this.setAttribute('value', this.value); });
            
            const winBtn = document.createElement('button');
            winBtn.className = 'team-win-btn';
            winBtn.innerHTML = '<i class="fa-solid fa-trophy"></i> Kazandı';
            winBtn.title = 'Bu takımı maçın galibi yap (+1W)';

            const obsBtn = document.createElement('button');
            obsBtn.className = 'obs-focus-btn';
            obsBtn.innerHTML = "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='3'></circle><path d='M3 12h4m10 0h4M12 3v4m0 10v4M4.9 4.9l2.8 2.8m8.6 8.6l2.8 2.8M4.9 19.1l2.8-2.8m8.6-8.6l2.8-2.8'></path></svg>";
            obsBtn.title = 'OBS\'te sadece bu takımı odakla';
            obsBtn.onclick = (e) => {
                e.stopPropagation();
                const isFocused = teamBox.classList.contains('obs-focused');
                document.querySelectorAll('.obs-focused').forEach(el => el.classList.remove('obs-focused'));
                if (!isFocused) {
                    teamBox.classList.add('obs-focused');
                }
                const tc = document.getElementById('teamsContainer');
                if (tc) tc.setAttribute('data-last-focus', Date.now().toString());
            };

            const teamCount = document.createElement('span');
            teamCount.className = 'team-count badge';
            teamCount.textContent = '0';

            teamHeader.appendChild(dragHandle);
            teamHeader.appendChild(teamInput);
            teamHeader.appendChild(obsBtn);
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

            if (typeof Sortable !== 'undefined') {
                try {
                    const sortable = new Sortable(teamList, {
                        group: 'shared',
                        animation: 150,
                        ghostClass: 'sortable-ghost',
                        onAdd: (evt) => handleSortableChange(evt, teamList, teamCount, teamBox),
                        onRemove: (evt) => handleSortableChange(evt, teamList, teamCount, teamBox)
                    });
                    sortableInstances.push(sortable);
                } catch(e) {}
            }
        }
    }

    function executeSingleModeTeamSwap(sourceIdx, targetIdx) {
        const box1 = document.getElementById(`team${sourceIdx}Box`);
        const box2 = document.getElementById(`team${targetIdx}Box`);
        if (!box1 || !box2) return;

        const input1 = box1.querySelector('.team-header input');
        const input2 = box2.querySelector('.team-header input');
        if (input1 && input2) {
            const tempVal = input1.value;
            input1.value = input2.value;
            input1.setAttribute('value', input2.value);
            input2.value = tempVal;
            input2.setAttribute('value', tempVal);
        }

        const list1 = document.getElementById(`team-${sourceIdx}`);
        const list2 = document.getElementById(`team-${targetIdx}`);
        if (list1 && list2) {
            const p1 = Array.from(list1.children);
            const p2 = Array.from(list2.children);
            list1.innerHTML = '';
            list2.innerHTML = '';
            p2.forEach(el => list1.appendChild(el));
            p1.forEach(el => list2.appendChild(el));
        }

        const count1 = box1.querySelector('.team-count');
        const count2 = box2.querySelector('.team-count');
        if (count1 && list1) count1.textContent = list1.children.length;
        if (count2 && list2) count2.textContent = list2.children.length;

        playUiSfx('click');
        showToast('🔄 Takımlar ve oyuncuları yer değiştirdi!');

        if (typeof obsSyncChannel !== 'undefined') {
            const tc = document.getElementById('teamsContainer');
            if (tc) {
                obsSyncChannel.postMessage({ type: 'sync_html', html: tc.innerHTML, modeClass: tc.className });
            }
        }
    }

    // =========================================================================
    // 🏆 Dinamik Turnuva Ağacı Modülü (4, 8, 16 Takım Desteği & Boyutlandırma)
    // =========================================================================
    function updateParticipantCalculation() {
        if (!participantCountInput || !participantCalcBadge) return 8;
        const total = parseInt(participantCountInput.value, 10) || 0;
        const sizeVal = parseInt(teamSizeSelect ? teamSizeSelect.value : '5', 10) || 5;

        const possibleTeams = Math.floor(total / sizeVal);
        let optimalTeams = 8;
        if (possibleTeams >= 16) {
            optimalTeams = 16;
        } else if (possibleTeams >= 8) {
            optimalTeams = 8;
        } else {
            optimalTeams = 4;
        }

        const requiredTotal = optimalTeams * sizeVal;
        const excess = Math.max(0, total - requiredTotal);
        const roundName = optimalTeams === 16 ? "Son 16" : (optimalTeams === 8 ? "Çeyrek Final" : "Yarı Final");

        let info = `${optimalTeams} Takım (${roundName})`;
        if (total < requiredTotal) {
            info += ` &bull; Eksik: ${requiredTotal - total}`;
        } else if (excess > 0) {
            info += ` &bull; Yedek: ${excess}`;
        }
        participantCalcBadge.innerHTML = info;
        return optimalTeams;
    }

    function applyParticipantCountSettings() {
        const optimalTeams = updateParticipantCalculation();
        if (!optimalTeams) return;

        tournamentTeamCount = optimalTeams;
        localStorage.setItem('kick_tournament_team_count', tournamentTeamCount.toString());

        if (captainLimit < tournamentTeamCount) {
            setCaptainLimit(tournamentTeamCount);
        }

        moveTeamPlayersToPool();
        tournamentMatches = getDynamicTournamentMatches(tournamentTeamCount);
        initTeams();

        playUiSfx('click');
        showToast(`✨ ${tournamentTeamCount} takımlı turnuva ağacı başarıyla oluşturuldu!`);
    }

    function get4TeamMatches() {
        return {
            'm_sf_1': {
                id: 'm_sf_1', round: 'sf', matchNum: 1, name: 'YF 1 (Yarı Final)', wing: 'left',
                nextMatchId: 'm_final', nextSlot: 'teamA',
                teamA: { teamNum: 1, name: 'Takım 1', players: [] },
                teamB: { teamNum: 2, name: 'Takım 2', players: [] },
                winner: null
            },
            'm_sf_2': {
                id: 'm_sf_2', round: 'sf', matchNum: 2, name: 'YF 2 (Yarı Final)', wing: 'left',
                nextMatchId: 'm_final', nextSlot: 'teamB',
                teamA: { teamNum: 3, name: 'Takım 3', players: [] },
                teamB: { teamNum: 4, name: 'Takım 4', players: [] },
                winner: null
            },
            'm_final': {
                id: 'm_final', round: 'final', matchNum: 1, name: 'BÜYÜK FİNAL', wing: 'center',
                nextMatchId: null, nextSlot: null,
                sourceA: 'YF 1 Galibi', sourceB: 'YF 2 Galibi',
                teamA: null, teamB: null, winner: null
            }
        };
    }

    function get8TeamMatches() {
        return {
            'm_r8_1': {
                id: 'm_r8_1', round: 'r8', matchNum: 1, name: 'Maç 1 (ÇF)', wing: 'left',
                nextMatchId: 'm_sf_1', nextSlot: 'teamA',
                teamA: { teamNum: 1, name: 'Takım 1', players: [] },
                teamB: { teamNum: 2, name: 'Takım 2', players: [] },
                winner: null
            },
            'm_r8_2': {
                id: 'm_r8_2', round: 'r8', matchNum: 2, name: 'Maç 2 (ÇF)', wing: 'left',
                nextMatchId: 'm_sf_1', nextSlot: 'teamB',
                teamA: { teamNum: 3, name: 'Takım 3', players: [] },
                teamB: { teamNum: 4, name: 'Takım 4', players: [] },
                winner: null
            },
            'm_r8_3': {
                id: 'm_r8_3', round: 'r8', matchNum: 3, name: 'Maç 3 (ÇF)', wing: 'left',
                nextMatchId: 'm_sf_2', nextSlot: 'teamA',
                teamA: { teamNum: 5, name: 'Takım 5', players: [] },
                teamB: { teamNum: 6, name: 'Takım 6', players: [] },
                winner: null
            },
            'm_r8_4': {
                id: 'm_r8_4', round: 'r8', matchNum: 4, name: 'Maç 4 (ÇF)', wing: 'left',
                nextMatchId: 'm_sf_2', nextSlot: 'teamB',
                teamA: { teamNum: 7, name: 'Takım 7', players: [] },
                teamB: { teamNum: 8, name: 'Takım 8', players: [] },
                winner: null
            },
            'm_sf_1': {
                id: 'm_sf_1', round: 'sf', matchNum: 1, name: 'YF 1 (Yarı Final)', wing: 'left',
                nextMatchId: 'm_final', nextSlot: 'teamA',
                sourceA: 'Maç 1 Galibi', sourceB: 'Maç 2 Galibi',
                teamA: null, teamB: null, winner: null
            },
            'm_sf_2': {
                id: 'm_sf_2', round: 'sf', matchNum: 2, name: 'YF 2 (Yarı Final)', wing: 'left',
                nextMatchId: 'm_final', nextSlot: 'teamB',
                sourceA: 'Maç 3 Galibi', sourceB: 'Maç 4 Galibi',
                teamA: null, teamB: null, winner: null
            },
            'm_final': {
                id: 'm_final', round: 'final', matchNum: 1, name: 'BÜYÜK FİNAL', wing: 'center',
                nextMatchId: null, nextSlot: null,
                sourceA: 'YF 1 Galibi', sourceB: 'YF 2 Galibi',
                teamA: null, teamB: null, winner: null
            }
        };
    }

    function get16TeamMatches() {
        const matches = {};
        for (let i = 1; i <= 8; i++) {
            const nextMatchIdx = Math.ceil(i / 2);
            const nextSlotKey = (i % 2 === 1) ? 'teamA' : 'teamB';
            matches[`m_r16_${i}`] = {
                id: `m_r16_${i}`, round: 'r16', matchNum: i, name: `Maç ${i} (Son 16)`, wing: 'left',
                nextMatchId: `m_r8_${nextMatchIdx}`, nextSlot: nextSlotKey,
                teamA: { teamNum: (i * 2) - 1, name: `Takım ${(i * 2) - 1}`, players: [] },
                teamB: { teamNum: i * 2, name: `Takım ${i * 2}`, players: [] },
                winner: null
            };
        }
        for (let i = 1; i <= 4; i++) {
            const nextMatchIdx = Math.ceil(i / 2);
            const nextSlotKey = (i % 2 === 1) ? 'teamA' : 'teamB';
            const mA = (i * 2) - 1;
            const mB = i * 2;
            matches[`m_r8_${i}`] = {
                id: `m_r8_${i}`, round: 'r8', matchNum: i, name: `ÇF ${i} (Çeyrek Final)`, wing: 'left',
                nextMatchId: `m_sf_${nextMatchIdx}`, nextSlot: nextSlotKey,
                sourceA: `Maç ${mA} Galibi`, sourceB: `Maç ${mB} Galibi`,
                teamA: null, teamB: null, winner: null
            };
        }
        matches['m_sf_1'] = {
            id: 'm_sf_1', round: 'sf', matchNum: 1, name: 'YF 1 (Yarı Final)', wing: 'left',
            nextMatchId: 'm_final', nextSlot: 'teamA',
            sourceA: 'ÇF 1 Galibi', sourceB: 'ÇF 2 Galibi',
            teamA: null, teamB: null, winner: null
        };
        matches['m_sf_2'] = {
            id: 'm_sf_2', round: 'sf', matchNum: 2, name: 'YF 2 (Yarı Final)', wing: 'left',
            nextMatchId: 'm_final', nextSlot: 'teamB',
            sourceA: 'ÇF 3 Galibi', sourceB: 'ÇF 4 Galibi',
            teamA: null, teamB: null, winner: null
        };
        matches['m_final'] = {
            id: 'm_final', round: 'final', matchNum: 1, name: 'BÜYÜK FİNAL', wing: 'center',
            nextMatchId: null, nextSlot: null,
            sourceA: 'YF 1 Galibi', sourceB: 'YF 2 Galibi',
            teamA: null, teamB: null, winner: null
        };
        return matches;
    }

    function getDynamicTournamentMatches(teamCount) {
        if (teamCount === 4) return get4TeamMatches();
        if (teamCount === 16) return get16TeamMatches();
        return get8TeamMatches();
    }

    function getInitialTournamentMatches() {
        return getDynamicTournamentMatches(tournamentTeamCount);
    }

    function updateTournamentHeaderBadge() {
        const badge = document.getElementById('tournamentTitleBadge');
        if (!badge) return;
        const sizeVal = teamSizeSelect ? teamSizeSelect.value : '5';
        badge.innerHTML = `<i class="fa-solid fa-sitemap"></i> ${sizeVal}v${sizeVal} ${tournamentTeamCount} Takım Turnuva Ağacı`;
    }

    function initTournamentMode() {
        if (!tournamentMatches) {
            tournamentMatches = getDynamicTournamentMatches(tournamentTeamCount);
        }

        const wrapper = document.createElement('div');
        wrapper.className = `tournament-bracket-wrapper ${bracketOrientation === 'upward' ? 'orient-upward' : ''}`;
        wrapper.id = 'tournamentBracket';

        const sizeVal = teamSizeSelect ? teamSizeSelect.value : '5';

        // Topbar
        const topbar = document.createElement('div');
        topbar.className = 'bracket-topbar';
        
        const bracketInfo = document.createElement('div');
        bracketInfo.className = 'bracket-info';
        
        const badge = document.createElement('span');
        badge.className = 'bracket-badge';
        badge.id = 'tournamentTitleBadge';
        badge.innerHTML = `<i class="fa-solid fa-sitemap"></i> ${sizeVal}v${sizeVal} ${tournamentTeamCount} Takım Turnuva Ağacı`;
        
        const treeObsBtn = document.createElement('button');
        treeObsBtn.className = 'obs-focus-btn';
        treeObsBtn.innerHTML = "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='3'></circle><path d='M3 12h4m10 0h4M12 3v4m0 10v4M4.9 4.9l2.8 2.8m8.6 8.6l2.8 2.8M4.9 19.1l2.8-2.8m8.6-8.6l2.8-2.8'></path></svg>";
        treeObsBtn.title = 'OBS\'te sadece bu ağacı göster';
        treeObsBtn.onclick = (e) => {
            e.stopPropagation();
            const isFocused = wrapper.classList.contains('obs-focused');
            document.querySelectorAll('.obs-focused').forEach(el => el.classList.remove('obs-focused'));
            if (!isFocused) wrapper.classList.add('obs-focused');
            const tc = document.getElementById('teamsContainer');
            if(tc) tc.setAttribute('data-last-focus', Date.now());
        };
        badge.appendChild(treeObsBtn);
        
        const subtext = document.createElement('span');
        subtext.className = 'bracket-subtext';
        if (tournamentTeamCount === 4) {
            subtext.innerHTML = 'Yarı Final (2 Maç) &bull; Büyük Final (1 Maç)';
        } else if (tournamentTeamCount === 16) {
            subtext.innerHTML = '1. Tur / Son 16 (8 Maç) &bull; Çeyrek Final (4 Maç) &bull; Yarı Final (2 Maç) &bull; Büyük Final (1 Maç)';
        } else {
            subtext.innerHTML = '1. Tur / Çeyrek Final (4 Maç) &bull; Yarı Final (2 Maç) &bull; Büyük Final (1 Maç)';
        }
        
        bracketInfo.appendChild(badge);
        bracketInfo.appendChild(subtext);
        
        // Topbar Controls: Orientation, Zoom, Reset
        const topbarControls = document.createElement('div');
        topbarControls.className = 'bracket-topbar-controls';

        // Orientation Toggle
        const orientBtn = document.createElement('button');
        orientBtn.className = 'btn secondary-btn bracket-orientation-btn';
        orientBtn.id = 'bracketOrientBtn';
        orientBtn.title = 'Turnuva ağacı yönünü değiştir (Yatay veya Dikey Piramit)';
        orientBtn.innerHTML = bracketOrientation === 'upward' 
            ? '<i class="fa-solid fa-arrows-left-right"></i> <span>Yatay Ağaç</span>'
            : '<i class="fa-solid fa-arrows-up-down"></i> <span>Dikey Piramit</span>';
        orientBtn.onclick = () => toggleBracketOrientation();
        topbarControls.appendChild(orientBtn);

        // Zoom Controls
        const zoomGroup = document.createElement('div');
        zoomGroup.className = 'bracket-zoom-group';
        zoomGroup.innerHTML = `
            <button type="button" class="btn secondary-btn btn-xs" id="bracketZoomOutBtn" title="Ağacı Küçült (-%10)"><i class="fa-solid fa-minus"></i></button>
            <span class="bracket-zoom-badge" id="bracketZoomBadge">${Math.round(bracketZoom * 100)}%</span>
            <button type="button" class="btn secondary-btn btn-xs" id="bracketZoomInBtn" title="Ağacı Büyüt (+%10)"><i class="fa-solid fa-plus"></i></button>
            <button type="button" class="btn secondary-btn btn-xs auto-fit-btn" id="bracketAutoFitBtn" title="Ekrana Otomatik Sığdır"><i class="fa-solid fa-expand"></i> Sığdır</button>
        `;
        topbarControls.appendChild(zoomGroup);

        const resetBtn = document.createElement('button');
        resetBtn.id = 'resetBracketBtn';
        resetBtn.className = 'btn warning-btn';
        resetBtn.title = 'Turnuva ağacındaki tüm maç sonuçlarını ve turları sıfırlar';
        resetBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Ağacı Sıfırla';
        resetBtn.onclick = resetTournamentBracket;
        topbarControls.appendChild(resetBtn);

        topbar.appendChild(bracketInfo);
        topbar.appendChild(topbarControls);
        wrapper.appendChild(topbar);

        // Viewport
        const viewport = document.createElement('div');
        viewport.className = 'bracket-viewport';

        // Tree
        const tree = document.createElement('div');
        tree.className = `bracket-tree bracket-single-wing ${bracketOrientation === 'upward' ? 'bracket-upward' : ''}`;
        tree.id = 'bracketTreeElement';
        applyZoomToTree(tree);

        // Left Wing / Rounds based on tournamentTeamCount
        const leftWing = document.createElement('div');
        leftWing.className = 'bracket-wing bracket-left';

        if (tournamentTeamCount === 16) {
            const r16Matches = Array.from({length: 8}, (_, i) => `m_r16_${i + 1}`);
            const r8Matches = Array.from({length: 4}, (_, i) => `m_r8_${i + 1}`);
            leftWing.appendChild(buildRoundColumn('Son 16 (1. Tur)', '8 Maç', r16Matches));
            leftWing.appendChild(buildRoundColumn('Çeyrek Final', '4 Maç', r8Matches));
            leftWing.appendChild(buildRoundColumn('Yarı Final', '2 Maç', ['m_sf_1', 'm_sf_2']));
        } else if (tournamentTeamCount === 8) {
            leftWing.appendChild(buildRoundColumn('1. Tur / Çeyrek Final', '4 Maç', ['m_r8_1', 'm_r8_2', 'm_r8_3', 'm_r8_4']));
            leftWing.appendChild(buildRoundColumn('Yarı Final', '2 Maç', ['m_sf_1', 'm_sf_2']));
        } else if (tournamentTeamCount === 4) {
            leftWing.appendChild(buildRoundColumn('1. Tur / Yarı Final', '2 Maç', ['m_sf_1', 'm_sf_2']));
        }
        tree.appendChild(leftWing);

        // Center / Grand Final & Champion Podium
        const centerWing = document.createElement('div');
        centerWing.className = 'bracket-round bracket-center';

        const finalHeader = document.createElement('div');
        finalHeader.className = 'round-header grand-final-header';
        finalHeader.innerHTML = `
            <span class="round-title"><i class="fa-solid fa-crown"></i> BÜYÜK FİNAL</span>
            <span class="round-count">1 Maç</span>
        `;
        centerWing.appendChild(finalHeader);

        const finalMatchesCont = document.createElement('div');
        finalMatchesCont.className = 'round-matches final-matches-container';

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
        finalMatchesCont.appendChild(podium);
        finalMatchesCont.appendChild(buildMatchCardElement(tournamentMatches['m_final']));
        centerWing.appendChild(finalMatchesCont);

        tree.appendChild(centerWing);
        viewport.appendChild(tree);
        wrapper.appendChild(viewport);
        teamsContainer.appendChild(wrapper);

        // Zoom button event bindings
        const zoomOutBtn = zoomGroup.querySelector('#bracketZoomOutBtn');
        const zoomInBtn = zoomGroup.querySelector('#bracketZoomInBtn');
        const autoFitBtn = zoomGroup.querySelector('#bracketAutoFitBtn');
        if (zoomOutBtn) zoomOutBtn.onclick = () => changeBracketZoom(-0.1);
        if (zoomInBtn) zoomInBtn.onclick = () => changeBracketZoom(0.1);
        if (autoFitBtn) autoFitBtn.onclick = () => autoFitBracket();

        // 🎯 Fare Tekerleği & Ctrl+Zoom Entegrasyonu
        // 1. Normal fare tekerleği ağaç görünümünde (bracket-viewport) bağımsız dikey kaydırma yapar;
        //    Sol paneldeki İzleyici Havuzu bu kaydırmadan asla etkilenmez ve sabit kalır.
        // 2. Ctrl + Fare Tekerleği çevrildiğinde ise ağaç dinamik olarak yakınlaştırılır / uzaklaştırılır (%5 adımlarla).
        // 3. Yatay modda dikey taşma yokken fare tekerleği yatay kaydırma sağlar.
        wrapper.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const zoomDelta = e.deltaY < 0 ? 0.05 : -0.05;
                changeBracketZoom(zoomDelta, true);
            }
        }, { passive: false });

        viewport.addEventListener('wheel', (e) => {
            if (!e.ctrlKey && bracketOrientation !== 'upward' && !e.shiftKey && viewport.scrollWidth > viewport.clientWidth && viewport.scrollHeight <= viewport.clientHeight + 20) {
                viewport.scrollLeft += e.deltaY;
            }
        }, { passive: true });

        if (topbar) {
            topbar.addEventListener('wheel', (e) => {
                if (!e.ctrlKey && viewport) {
                    viewport.scrollTop += e.deltaY;
                }
            }, { passive: true });
        }
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
        const isLive = typeof obsConfig !== 'undefined' && obsConfig && obsConfig.activeMatchId === match.id;
        const card = document.createElement('div');
        card.className = `bracket-match-card ${match.round === 'final' ? 'final-match' : ''} ${isLive ? 'active-live-match' : ''}`;
        card.dataset.matchId = match.id;

        const badge = document.createElement('div');
        badge.className = 'match-badge';
        badge.innerHTML = `<span>${match.name}</span>`;
        
        if (isLive) {
            const liveBadge = document.createElement('span');
            liveBadge.className = 'live-match-badge';
            liveBadge.innerHTML = '<span class="live-dot"></span> CANLI';
            badge.appendChild(liveBadge);
        }

        const liveBtn = document.createElement('button');
        liveBtn.className = `obs-live-btn ${isLive ? 'active' : ''}`;
        liveBtn.innerHTML = '<i class="fa-solid fa-satellite-dish"></i>';
        liveBtn.title = isLive ? 'Canlı maç vurgusunu kaldır' : 'OBS\'te bu maçı canlı oynanıyor olarak vurgula (Kırmızı Nabız)';
        liveBtn.onclick = (e) => {
            e.stopPropagation();
            if (typeof setActiveLiveMatch === 'function') {
                if (typeof obsConfig !== 'undefined' && obsConfig.activeMatchId === match.id) {
                    setActiveLiveMatch(null);
                } else {
                    setActiveLiveMatch(match.id);
                }
            }
        };
        badge.appendChild(liveBtn);

        const obsBtn = document.createElement('button');
        obsBtn.className = 'obs-focus-btn';
        obsBtn.innerHTML = "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='3'></circle><path d='M3 12h4m10 0h4M12 3v4m0 10v4M4.9 4.9l2.8 2.8m8.6 8.6l2.8 2.8M4.9 19.1l2.8-2.8m8.6-8.6l2.8-2.8'></path></svg>";
        obsBtn.title = 'OBS\'te sadece bu maçı göster';
        obsBtn.onclick = (e) => {
            e.stopPropagation();
            const isFocused = card.classList.contains('obs-focused');
            document.querySelectorAll('.obs-focused').forEach(el => el.classList.remove('obs-focused'));
            if (!isFocused) {
                card.classList.add('obs-focused');
            }
            const tc = document.getElementById('teamsContainer');
            if(tc) tc.setAttribute('data-last-focus', Date.now());
        };
        badge.appendChild(obsBtn);

        // Karşılaşma Taşıma Tutamağı (Yalnızca ilk tur maçlarında aynı turdaki maçlarla yer değiştirmek için)
        const isInitialMatch = !match.sourceA;
        if (isInitialMatch && match.teamA && match.teamA.teamNum !== undefined) {
            const matchDrag = document.createElement('div');
            matchDrag.className = 'match-drag-handle';
            matchDrag.draggable = true;
            matchDrag.title = 'Karşılaşmayı sürükleyip aynı turdaki başka bir karşılaşmayla takas edin';
            matchDrag.innerHTML = '<i class="fa-solid fa-arrows-up-down-left-right"></i> <span>Maç Taşı</span>';

            matchDrag.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                card.classList.add('match-dragging');
                const dragPayload = {
                    type: 'tournament_match',
                    matchId: match.id,
                    round: match.round
                };
                e.dataTransfer.setData('application/json', JSON.stringify(dragPayload));
                e.dataTransfer.setData('text/plain', JSON.stringify(dragPayload));
                e.dataTransfer.effectAllowed = 'move';
            });

            matchDrag.addEventListener('dragend', (e) => {
                e.stopPropagation();
                card.classList.remove('match-dragging');
                document.querySelectorAll('.match-swap-target').forEach(el => el.classList.remove('match-swap-target'));
                document.querySelectorAll('.match-dragging').forEach(el => el.classList.remove('match-dragging'));
            });

            badge.appendChild(matchDrag);
        }

        // Karşılaşma Sürükle-Bırak Hedef Alanı (Dropzone)
        card.addEventListener('dragover', (e) => {
            // Eğer bir takım veya oyuncu sürükleniyorsa maç takasını tetikleme
            if (document.querySelector('.team-dragging') || document.querySelector('.sortable-ghost')) return;
            const draggingCard = document.querySelector('.bracket-match-card.match-dragging');
            if (draggingCard && draggingCard !== card) {
                const srcMatchId = draggingCard.dataset.matchId;
                const srcMatch = tournamentMatches[srcMatchId];
                if (srcMatch && srcMatch.round === match.round) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    card.classList.add('match-swap-target');
                }
            }
        });

        card.addEventListener('dragleave', (e) => {
            if (!card.contains(e.relatedTarget)) {
                card.classList.remove('match-swap-target');
            }
        });

        card.addEventListener('drop', (e) => {
            if (document.querySelector('.team-dragging') || document.querySelector('.sortable-ghost')) return;
            card.classList.remove('match-swap-target');
            document.querySelectorAll('.match-swap-target').forEach(el => el.classList.remove('match-swap-target'));
            document.querySelectorAll('.match-dragging').forEach(el => el.classList.remove('match-dragging'));

            let dataStr = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
            if (!dataStr) return;
            try {
                const payload = JSON.parse(dataStr);
                if (payload.type === 'tournament_match') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (payload.matchId === match.id) return;
                    if (payload.round !== match.round) {
                        showToast('⚠️ Karşılaşmalar yalnızca aynı tur içerisinde takas edilebilir!', 3000);
                        return;
                    }
                    executeMatchSwap(payload.matchId, match.id);
                }
            } catch(err) {
                console.warn('Match drop error:', err);
            }
        });

        card.appendChild(badge);

        if (isInitialMatch) {
            card.appendChild(buildInitialTeamSlot(match, 'teamA'));
            
            const divider = document.createElement('div');
            divider.className = 'match-vs-divider';
            divider.innerHTML = '<span>VS</span>';
            card.appendChild(divider);

            card.appendChild(buildInitialTeamSlot(match, 'teamB'));
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

    function buildInitialTeamSlot(match, slotKey) {
        const teamData = match[slotKey];
        const isWinner = match.winner === slotKey;
        const isEliminated = match.winner && match.winner !== slotKey;

        const slot = document.createElement('div');
        slot.className = `bracket-team-slot ${isWinner ? 'slot-winner' : ''} ${isEliminated ? 'slot-eliminated' : ''}`;
        slot.dataset.slot = slotKey;
        slot.dataset.matchId = match.id;

        const header = document.createElement('div');
        header.className = 'slot-header';

        // Takım Sürükleme Tutamağı (Drag Handle)
        const dragHandle = document.createElement('div');
        dragHandle.className = 'team-drag-handle';
        dragHandle.draggable = true;
        dragHandle.title = 'Takımı sürükleyip başka bir takımla yer değiştirin';
        dragHandle.innerHTML = '&#8942;&#8942;';

        dragHandle.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            slot.classList.add('team-dragging');
            const dragPayload = {
                type: 'tournament_team',
                matchId: match.id,
                slotKey: slotKey,
                teamNum: teamData.teamNum
            };
            e.dataTransfer.setData('application/json', JSON.stringify(dragPayload));
            e.dataTransfer.setData('text/plain', JSON.stringify(dragPayload));
            e.dataTransfer.effectAllowed = 'move';
        });

        dragHandle.addEventListener('dragend', (e) => {
            e.stopPropagation();
            slot.classList.remove('team-dragging');
            document.querySelectorAll('.team-swap-target').forEach(el => el.classList.remove('team-swap-target'));
            document.querySelectorAll('.team-dragging').forEach(el => el.classList.remove('team-dragging'));
        });

        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            if (!slot.classList.contains('team-dragging')) {
                slot.classList.add('team-swap-target');
            }
        });

        slot.addEventListener('dragleave', (e) => {
            e.stopPropagation();
            slot.classList.remove('team-swap-target');
        });

        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            slot.classList.remove('team-swap-target');
            document.querySelectorAll('.team-dragging').forEach(el => el.classList.remove('team-dragging'));

            let dataStr = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
            if (!dataStr) return;
            try {
                const payload = JSON.parse(dataStr);
                if (payload.type === 'tournament_team') {
                    if (payload.matchId === match.id && payload.slotKey === slotKey) {
                        return;
                    }
                    executeTournamentTeamSwap(payload.matchId, payload.slotKey, match.id, slotKey);
                }
            } catch(err) {
                console.warn('Drop error:', err);
            }
        });

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'slot-name-input';
        nameInput.value = teamData.name;
        nameInput.setAttribute('value', teamData.name);
        nameInput.oninput = () => {
            teamData.name = nameInput.value;
            nameInput.setAttribute('value', nameInput.value);
        };

        const maxSize = parseInt(teamSizeSelect ? teamSizeSelect.value : '5');
        const countBadge = document.createElement('span');
        countBadge.className = 'team-count badge';
        countBadge.textContent = `0/${maxSize}`;

        header.appendChild(dragHandle);
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

        if (typeof Sortable !== 'undefined') {
            try {
                const sortable = new Sortable(teamList, {
                    group: 'shared',
                    animation: 150,
                    ghostClass: 'sortable-ghost',
                    onAdd: (evt) => handleSortableChange(evt, teamList, countBadge, slot),
                    onRemove: (evt) => handleSortableChange(evt, teamList, countBadge, slot)
                });
                sortableInstances.push(sortable);
            } catch(e) {}
        }

        return slot;
    }
    const buildR16TeamSlot = buildInitialTeamSlot;

    function executeTournamentTeamSwap(sourceMatchId, sourceSlotKey, targetMatchId, targetSlotKey, silent = false) {
        const sourceMatch = tournamentMatches[sourceMatchId];
        const targetMatch = tournamentMatches[targetMatchId];
        if (!sourceMatch || !targetMatch) return;

        const sourceTeam = sourceMatch[sourceSlotKey];
        const targetTeam = targetMatch[targetSlotKey];
        if (!sourceTeam || !targetTeam) return;

        // 1. İsimleri takas et
        const tempName = sourceTeam.name;
        sourceTeam.name = targetTeam.name;
        targetTeam.name = tempName;

        // 2. Oyuncu DOM listelerini takas et
        const sourceList = document.getElementById(`team-${sourceTeam.teamNum}`);
        const targetList = document.getElementById(`team-${targetTeam.teamNum}`);
        if (sourceList && targetList) {
            const sourcePlayers = Array.from(sourceList.children);
            const targetPlayers = Array.from(targetList.children);
            sourceList.innerHTML = '';
            targetList.innerHTML = '';
            targetPlayers.forEach(p => sourceList.appendChild(p));
            sourcePlayers.forEach(p => targetList.appendChild(p));
        }

        // 3. Kartlardaki input ve rozetleri güncelle
        const sourceCard = document.querySelector(`.bracket-match-card[data-match-id="${sourceMatchId}"]`);
        const targetCard = document.querySelector(`.bracket-match-card[data-match-id="${targetMatchId}"]`);
        if (sourceCard) {
            const sInput = sourceCard.querySelector(`.bracket-team-slot[data-slot="${sourceSlotKey}"] .slot-name-input`);
            if (sInput) {
                sInput.value = sourceTeam.name;
                sInput.setAttribute('value', sourceTeam.name);
            }
            const sBadge = sourceCard.querySelector(`.bracket-team-slot[data-slot="${sourceSlotKey}"] .team-count`);
            const maxSize = parseInt(teamSizeSelect ? teamSizeSelect.value : '5', 10);
            if (sBadge && sourceList) sBadge.textContent = `${sourceList.children.length}/${maxSize}`;
        }
        if (targetCard) {
            const tInput = targetCard.querySelector(`.bracket-team-slot[data-slot="${targetSlotKey}"] .slot-name-input`);
            if (tInput) {
                tInput.value = targetTeam.name;
                tInput.setAttribute('value', targetTeam.name);
            }
            const tBadge = targetCard.querySelector(`.bracket-team-slot[data-slot="${targetSlotKey}"] .team-count`);
            const maxSize = parseInt(teamSizeSelect ? teamSizeSelect.value : '5', 10);
            if (tBadge && targetList) tBadge.textContent = `${targetList.children.length}/${maxSize}`;
        }

        if (!silent) {
            playUiSfx('click');
            showToast(`🔄 ${sourceTeam.name} ile ${targetTeam.name} takımları başarıyla yer değiştirdi!`);
        }

        if (typeof obsSyncChannel !== 'undefined') {
            const tc = document.getElementById('teamsContainer');
            if (tc) {
                obsSyncChannel.postMessage({ type: 'sync_html', html: tc.innerHTML, modeClass: tc.className });
            }
        }
    }

    // Karşılaşma Takas Etme (Aynı turdaki 2 maçın tüm takımlarını ve oyuncularını karşılıklı yer değiştirir)
    function executeMatchSwap(sourceMatchId, targetMatchId) {
        const sourceMatch = tournamentMatches[sourceMatchId];
        const targetMatch = tournamentMatches[targetMatchId];
        if (!sourceMatch || !targetMatch) return;

        if (sourceMatch.round !== targetMatch.round) {
            showToast('⚠️ Karşılaşmalar yalnızca aynı tur içerisinde takas edilebilir!', 3000);
            return;
        }

        // Maçların takımlarını karşılıklı takas et (Maç numaraları ve başlıkları sabit kalır)
        executeTournamentTeamSwap(sourceMatchId, 'teamA', targetMatchId, 'teamA', true);
        executeTournamentTeamSwap(sourceMatchId, 'teamB', targetMatchId, 'teamB', true);

        playDeepIronStrikeSound('normal');
        showToast(`⚔️ ${sourceMatch.name} ile ${targetMatch.name} karşılaşması takımları karşılıklı takas edildi!`);

        if (typeof obsSyncChannel !== 'undefined') {
            const tc = document.getElementById('teamsContainer');
            if (tc) {
                obsSyncChannel.postMessage({ type: 'sync_html', html: tc.innerHTML, modeClass: tc.className });
            }
        }
    }

    function toggleBracketOrientation() {
        bracketOrientation = bracketOrientation === 'horizontal' ? 'upward' : 'horizontal';
        localStorage.setItem('kick_bracket_orientation', bracketOrientation);

        const wrapper = document.getElementById('tournamentBracket');
        const tree = document.getElementById('bracketTreeElement');
        const orientBtn = document.getElementById('bracketOrientBtn');

        if (wrapper && tree) {
            if (bracketOrientation === 'upward') {
                wrapper.classList.add('orient-upward');
                tree.classList.add('bracket-upward');
            } else {
                wrapper.classList.remove('orient-upward');
                tree.classList.remove('bracket-upward');
            }
            applyZoomToTree(tree);
        }

        if (orientBtn) {
            orientBtn.innerHTML = bracketOrientation === 'upward'
                ? '<i class="fa-solid fa-arrows-left-right"></i> <span>Yatay Ağaç</span>'
                : '<i class="fa-solid fa-arrows-up-down"></i> <span>Dikey Piramit</span>';
        }

        playUiSfx('click');
        showToast(bracketOrientation === 'upward' ? '⬆️ Turnuva ağacı dikey piramit görünümüne alındı!' : '↔️ Turnuva ağacı yatay görünüme alındı!');

        if (typeof obsSyncChannel !== 'undefined') {
            const tc = document.getElementById('teamsContainer');
            if (tc) {
                obsSyncChannel.postMessage({ type: 'sync_html', html: tc.innerHTML, modeClass: tc.className });
            }
        }
    }

    function applyZoomToTree(tree) {
        if (!tree) tree = document.getElementById('bracketTreeElement');
        if (!tree) return;
        tree.style.transform = `scale(${bracketZoom})`;
        tree.style.transformOrigin = bracketOrientation === 'upward' ? 'top center' : 'top left';
        const badge = document.getElementById('bracketZoomBadge');
        if (badge) badge.textContent = `${Math.round(bracketZoom * 100)}%`;
    }

    function changeBracketZoom(delta, silent = false) {
        const prevZoom = bracketZoom;
        bracketZoom = Math.min(1.5, Math.max(0.35, Math.round((bracketZoom + delta) * 100) / 100));
        if (bracketZoom !== prevZoom) {
            localStorage.setItem('kick_bracket_zoom', bracketZoom.toString());
            applyZoomToTree();
            if (!silent) playUiSfx('click');
        }
    }

    function autoFitBracket() {
        const viewport = document.querySelector('.bracket-viewport');
        const tree = document.getElementById('bracketTreeElement');
        if (!viewport || !tree) return;

        // Geçici olarak scale ve animasyonu sıfırlayarak saf piksel boyutlarını al
        const prevTransform = tree.style.transform;
        const prevTransition = tree.style.transition;
        tree.style.transition = 'none';
        tree.style.transform = 'none';

        const naturalWidth = Math.max(tree.scrollWidth, tree.offsetWidth);
        const naturalHeight = Math.max(tree.scrollHeight, tree.offsetHeight);

        const availableWidth = viewport.clientWidth - 48;
        const availableHeight = viewport.clientHeight - 48;

        if (naturalWidth > 0 && availableWidth > 0) {
            let fitScaleX = availableWidth / naturalWidth;
            let fitScale = fitScaleX;

            // Dikey piramit modunda dikey taşmayı da önlemek için oran kontrolü
            if (bracketOrientation === 'upward' && naturalHeight > 0 && availableHeight > 250) {
                let fitScaleY = availableHeight / naturalHeight;
                fitScale = Math.min(fitScaleX, fitScaleY);
            }

            // [0.35, 1.25] aralığında 2 ondalık hassasiyetle sınırla
            fitScale = Math.min(1.25, Math.max(0.35, Math.round(fitScale * 100) / 100));
            bracketZoom = fitScale;
            localStorage.setItem('kick_bracket_zoom', bracketZoom.toString());

            tree.style.transition = prevTransition;
            applyZoomToTree(tree);
            playUiSfx('click');
            showToast(`🔍 Ağaç ekrana sığdırıldı (%${Math.round(bracketZoom * 100)})`);
        } else {
            tree.style.transition = prevTransition;
            tree.style.transform = prevTransform;
        }
    }

    // Turnuva kontrollerini global erişime aç (Konsol & Test desteği)
    window.tournamentSystem = {
        executeTournamentTeamSwap,
        executeMatchSwap,
        executeSingleModeTeamSwap,
        toggleBracketOrientation,
        changeBracketZoom,
        autoFitBracket,
        getDynamicTournamentMatches,
        getTournamentMatches: () => tournamentMatches,
        updateParticipantCalculation,
        applyParticipantCountSettings
    };
    window.executeTournamentTeamSwap = executeTournamentTeamSwap;
    window.executeMatchSwap = executeMatchSwap;
    window.executeSingleModeTeamSwap = executeSingleModeTeamSwap;
    window.toggleBracketOrientation = toggleBracketOrientation;
    window.changeBracketZoom = changeBracketZoom;
    window.autoFitBracket = autoFitBracket;
    window.getTournamentMatches = () => tournamentMatches;

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

        const teamList = document.createElement('ul');
        teamList.className = 'team-list progress-team-list sortable-list';
        if (teamData.players && teamData.players.length > 0) {
            teamData.players.forEach(p => {
                const pEl = createPlayerElement(p);
                teamList.appendChild(pEl);
            });
        }
        slot.appendChild(teamList);

        return slot;
    }

    function updateTournamentMatchDOM(matchId) {
        const card = document.querySelector(`.bracket-match-card[data-match-id="${matchId}"]`);
        if (!card) return;

        const match = tournamentMatches[matchId];
        if (!match) return;

        const newCard = buildMatchCardElement(match);
        card.replaceWith(newCard);

        if (typeof obsSyncChannel !== 'undefined') {
            const tc = document.getElementById('teamsContainer');
            if (tc) {
                obsSyncChannel.postMessage({ type: 'sync_html', html: tc.innerHTML, modeClass: tc.className });
            }
        }
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

        const isInitialRound = !match.sourceA;
        if (isInitialRound) {
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
            awardTournamentBadges(winnerTeamName, winnerPlayers, loserTeamName, loserPlayers);
            triggerConfettiCelebration();
            showTournamentScoreboard();
            showToast(`👑 TEBRİKLER! ${winnerTeamName.toUpperCase()} BÜYÜK FİNALİ KAZANARAK TURNUVA ŞAMPİYONU OLDU! 🎉`);

        } else if (match.nextMatchId === 'm_final') {
            playUiSfx('win');
            showToast(`🏆 ${winnerTeamName} kazandı! BÜYÜK FİNALE yükseldi! 🎉 (+1W/+1L işlendi)`);
            if (typeof checkAndInitLosers === 'function') {
                setTimeout(() => checkAndInitLosers(), 100);
            }

        } else {
            playUiSfx('win');
            showToast(`🏆 ${winnerTeamName} kazandı! Bir sonraki tura yükseldi! (+1W/+1L işlendi)`);
        }

        // Canlı maç vurgusu bu maça aitse otomatik kapat
        if (typeof obsConfig !== 'undefined' && obsConfig && obsConfig.activeMatchId === matchId) {
            if (typeof setActiveLiveMatch === 'function') {
                setActiveLiveMatch(null);
            }
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

        const isInitialRound = !match.sourceA;
        if (isInitialRound) {
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

    function moveTeamPlayersToPool() {
        const teamPlayers = document.querySelectorAll('.team-list .player-item');
        teamPlayers.forEach(playerEl => {
            playerPool.appendChild(playerEl);
        });
        updatePoolCount();
    }

    function resetTournamentBracket() {
        if (!confirm('Turnuva ağacındaki tüm maç sonuçlarını ve turları sıfırlamak istediğinize emin misiniz? (Takımlardaki oyuncular havuzuna aktarılacaktır)')) {
            return;
        }
        if (typeof setActiveLiveMatch === 'function') {
            setActiveLiveMatch(null);
        }
        moveTeamPlayersToPool();
        tournamentMatches = getInitialTournamentMatches();
        initTeams();
        showToast('Turnuva ağacı sıfırlandı ve oyuncular havuza aktarıldı.');
    }

    function initPoolSortable() {
        if (typeof Sortable !== 'undefined' && playerPool) {
            try {
                new Sortable(playerPool, {
                    group: 'shared',
                    animation: 150,
                    ghostClass: 'sortable-ghost',
                    scroll: true,
                    scrollSensitivity: 80,
                    scrollSpeed: 15,
                    bubbleScroll: true,
                    onAdd: () => updatePoolCount(),
                    onRemove: () => updatePoolCount()
                });
            } catch(e) {}
        }
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
        const totalPlayers = playerPool ? playerPool.querySelectorAll('.player-item').length : 0;
        if (poolCount) {
            poolCount.textContent = totalPlayers;
        }
        const collapsedBadge = document.getElementById('collapsedPoolCount');
        if (collapsedBadge && poolCount) {
            collapsedBadge.textContent = poolCount.textContent;
        }
        // Eğer havuzda bir arama sorgusu aktifse sonuçları filtrele ve güncelle
        if (poolSearchInput && poolSearchInput.value.trim()) {
            filterPlayerPool(poolSearchInput.value);
        } else if (poolSearchCount) {
            poolSearchCount.classList.add('hidden');
            if (poolNoMatch) poolNoMatch.classList.add('hidden');
        }
        if (typeof updateCaptainDisplay === 'function') {
            updateCaptainDisplay();
        }
        if (typeof obsSyncChannel !== 'undefined') {
            obsSyncChannel.postMessage({ type: 'update_pool_count', count: totalPlayers });
        }
        if (typeof updateTeamPowerBar === 'function') {
            updateTeamPowerBar();
        }
    }

    // =========================================================================
    // 🔍 İZLEYİCİ HAVUZU İSİMDEN ARAMA VE FİLTRELEME SİSTEMİ
    // =========================================================================
    function normalizeSearchText(str) {
        if (!str) return '';
        return str
            .toLowerCase()
            .replace(/ı/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c')
            .trim();
    }

    function filterPlayerPool(query) {
        if (!playerPool) return;
        const cleanQuery = normalizeSearchText(query);
        const playerItems = Array.from(playerPool.querySelectorAll('.player-item'));
        const totalCount = playerItems.length;

        if (!cleanQuery) {
            playerItems.forEach(item => {
                item.style.display = '';
            });
            if (clearPoolSearchBtn) clearPoolSearchBtn.classList.add('hidden');
            if (poolSearchCount) poolSearchCount.classList.add('hidden');
            if (poolNoMatch) poolNoMatch.classList.add('hidden');
            return;
        }

        if (clearPoolSearchBtn) clearPoolSearchBtn.classList.remove('hidden');

        let matchCount = 0;
        playerItems.forEach(item => {
            const name = item.dataset.name || '';
            const normalizedName = normalizeSearchText(name);
            const matches = normalizedName.includes(cleanQuery);
            if (matches) {
                item.style.display = '';
                matchCount++;
            } else {
                item.style.display = 'none';
            }
        });

        if (poolSearchCount) {
            poolSearchCount.textContent = `${matchCount} / ${totalCount}`;
            poolSearchCount.classList.remove('hidden');
        }

        if (poolNoMatch) {
            if (matchCount === 0 && totalCount > 0) {
                poolNoMatch.classList.remove('hidden');
            } else {
                poolNoMatch.classList.add('hidden');
            }
        }
    }

    // =========================================================================
    // 🖼️ KICK AVATAR (PROFİL FOTOĞRAFI) GETİRME & ÖNBELLEK YÖNETİMİ
    // =========================================================================
    function getCachedAvatar(name) {
        if (!name) return null;
        const key = name.trim().toLowerCase();
        if (userAvatarCache.has(key)) {
            return userAvatarCache.get(key);
        }
        try {
            const stored = localStorage.getItem(`kick_avatar_${key}`);
            if (stored) {
                userAvatarCache.set(key, stored);
                return stored;
            }
        } catch (e) {}
        return null;
    }

    function setCachedAvatar(name, avatarUrl) {
        if (!name || !avatarUrl) return;
        const key = name.trim().toLowerCase();
        userAvatarCache.set(key, avatarUrl);
        try {
            localStorage.setItem(`kick_avatar_${key}`, avatarUrl);
        } catch (e) {}
    }

    async function fetchUserAvatar(name) {
        if (!name || !name.trim()) return null;
        const key = name.trim().toLowerCase();

        const cached = getCachedAvatar(key);
        if (cached) return cached;

        if (avatarFetchingSet.has(key)) return null;
        avatarFetchingSet.add(key);

        try {
            const res = await fetch(`${getApiBase()}/api/kick/avatar?username=${encodeURIComponent(name.trim())}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.success && data.avatar) {
                    setCachedAvatar(key, data.avatar);
                    updateAvatarsInDom(name, data.avatar);
                    return data.avatar;
                } else if (data && data.pending && !data.retried) {
                    // Sunucu arka planda çekiyor, 2.5 saniye sonra önbellekten sessizce al
                    setTimeout(() => {
                        avatarFetchingSet.delete(key);
                        fetch(`${getApiBase()}/api/kick/avatar?username=${encodeURIComponent(name.trim())}`)
                            .then(r => r.json())
                            .then(d => {
                                if (d && d.success && d.avatar) {
                                    setCachedAvatar(key, d.avatar);
                                    updateAvatarsInDom(name, d.avatar);
                                }
                            }).catch(() => {});
                    }, 2500);
                }
            }
        } catch (e) {
            // Ağ veya sunucu yanıt vermezse sessizce geç
        } finally {
            avatarFetchingSet.delete(key);
        }
        return null;
    }

    function updateAvatarsInDom(name, avatarUrl) {
        if (!name || !avatarUrl) return;
        const clean = name.trim().toLowerCase();
        document.querySelectorAll('.player-item').forEach(item => {
            if ((item.dataset.name || '').trim().toLowerCase() === clean) {
                const avatarEl = item.querySelector('.player-avatar');
                if (avatarEl) {
                    let img = avatarEl.querySelector('.avatar-img');
                    const initials = avatarEl.querySelector('.avatar-initials');
                    if (!img) {
                        img = document.createElement('img');
                        img.className = 'avatar-img';
                        img.alt = name;
                        avatarEl.appendChild(img);
                    }
                    img.src = avatarUrl;
                    img.onload = () => {
                        img.style.display = 'block';
                        if (initials) initials.style.display = 'none';
                    };
                    img.onerror = () => {
                        img.style.display = 'none';
                        if (initials) initials.style.display = 'block';
                    };
                }
            }
        });
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

        // Otomatik eski sürüm veri algılama ve tarama motoru
        autoMigrateLegacyData();

        // Bilgisayardaki mühürlü (.json) kayıt dosyalarını otomatik tarama ve aktarma motoru
        scanAndImportSealedBackupsViaApi();
    }

    // =========================================================================
    // Otomatik Veri Göçü (Auto Migration Engine for Legacy Data)
    // =========================================================================
    function autoMigrateLegacyData() {
        let migratedCount = 0;
        const legacyKeys = [
            'kick_strikers_stats',
            'strikers_stats',
            'strikers_players',
            'kick_players',
            'strikers_data',
            'strikers_leaderboard',
            'kick_channel_stats',
            'player_stats',
            'strikers_pool'
        ];

        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) continue;

                const isLegacyKey = legacyKeys.includes(key) ||
                    (key.startsWith('strikers_') && !key.startsWith('kick_strikers_stats_')) ||
                    (key.startsWith('kick_') && !key.startsWith('kick_strikers_'));

                if (isLegacyKey) {
                    try {
                        const val = localStorage.getItem(key);
                        if (!val) continue;
                        const parsed = JSON.parse(val);

                        const count = mergeParsedDataIntoStats(parsed);
                        migratedCount += count;
                    } catch (e) {
                        console.warn(`Legacy key ${key} migration parse error:`, e);
                    }
                }
            }
        } catch (err) {
            console.warn('Auto migration error:', err);
        }

        if (migratedCount > 0) {
            saveChannelStats();
            refreshAllPlayerElements();
            showToast(`📦 Eski sürüm verileri algılandı ve aktarıldı! (${migratedCount} oyuncu kaydı güncellendi)`);
        }
    }

    function mergeParsedDataIntoStats(parsed, targetStats = channelStats) {
        let count = 0;
        if (!parsed) return count;

        // Senaryo A: Dizi biçiminde oyuncu isimleri ["Ahmet", "Mehmet"]
        if (Array.isArray(parsed)) {
            parsed.forEach(item => {
                let name = '';
                let wins = 0, losses = 0, goals = 0, assists = 0, saves = 0, streak = 0, mvpCount = 0;

                if (typeof item === 'string') {
                    name = item;
                } else if (typeof item === 'object' && item !== null) {
                    name = item.name || item.displayName || item.username || '';
                    wins = parseInt(item.wins || item.win || item.w || 0);
                    losses = parseInt(item.losses || item.lose || item.l || 0);
                    goals = parseInt(item.goals || item.g || 0);
                    assists = parseInt(item.assists || item.pass || item.a || 0);
                    saves = parseInt(item.saves || item.save || item.s || 0);
                    streak = parseInt(item.streak || 0);
                    mvpCount = parseInt(item.mvpCount || 0);
                }

                if (name.trim()) {
                    const key = name.trim().toLowerCase();
                    if (!targetStats[key]) {
                        targetStats[key] = { wins, losses, goals, assists, saves, streak, mvpCount, displayName: name.trim() };
                        count++;
                    } else {
                        targetStats[key].wins = Math.max(targetStats[key].wins, wins);
                        targetStats[key].losses = Math.max(targetStats[key].losses, losses);
                        targetStats[key].goals = Math.max(targetStats[key].goals || 0, goals);
                        targetStats[key].assists = Math.max(targetStats[key].assists || 0, assists);
                        targetStats[key].saves = Math.max(targetStats[key].saves || 0, saves);
                        targetStats[key].streak = Math.max(targetStats[key].streak || 0, streak);
                        targetStats[key].mvpCount = Math.max(targetStats[key].mvpCount || 0, mvpCount);
                    }
                }
            });
        }
        // Senaryo B: Nesne biçiminde harita { "ahmet": { wins: 5, losses: 2 }, "mehmet": [5, 2] }
        else if (typeof parsed === 'object') {
            Object.keys(parsed).forEach(playerKey => {
                const item = parsed[playerKey];
                let name = playerKey;
                let wins = 0, losses = 0, goals = 0, assists = 0, saves = 0, streak = 0, mvpCount = 0;

                if (Array.isArray(item)) {
                    wins = parseInt(item[0] || 0);
                    losses = parseInt(item[1] || 0);
                } else if (typeof item === 'object' && item !== null) {
                    name = item.displayName || item.name || playerKey;
                    wins = parseInt(item.wins || item.win || item.w || 0);
                    losses = parseInt(item.losses || item.lose || item.l || 0);
                    goals = parseInt(item.goals || item.g || 0);
                    assists = parseInt(item.assists || item.pass || item.a || 0);
                    saves = parseInt(item.saves || item.save || item.s || 0);
                    streak = parseInt(item.streak || 0);
                    mvpCount = parseInt(item.mvpCount || 0);
                } else if (typeof item === 'number') {
                    wins = item;
                }

                if (name.trim()) {
                    const key = name.trim().toLowerCase();
                    if (!targetStats[key]) {
                        targetStats[key] = { wins, losses, goals, assists, saves, streak, mvpCount, displayName: name.trim() };
                        count++;
                    } else {
                        targetStats[key].wins = Math.max(targetStats[key].wins, wins);
                        targetStats[key].losses = Math.max(targetStats[key].losses, losses);
                        targetStats[key].goals = Math.max(targetStats[key].goals || 0, goals);
                        targetStats[key].assists = Math.max(targetStats[key].assists || 0, assists);
                        targetStats[key].saves = Math.max(targetStats[key].saves || 0, saves);
                        targetStats[key].streak = Math.max(targetStats[key].streak || 0, streak);
                        targetStats[key].mvpCount = Math.max(targetStats[key].mvpCount || 0, mvpCount);
                    }
                }
            });
        }

        return count;
    }

    // =========================================================================
    // JSON Veri İçe / Dışa Aktarma (Export & Import Backup Engine)
    // =========================================================================
    function exportAllDataToJson() {
        try {
            const backupData = {
                __seal: "STRICKERS_KING_OFFICIAL_SEAL_V2",
                signature: "SKC-OFFICIAL-BACKUP-VERIFIED",
                appName: 'Strickers King Creator',
                version: '2.0',
                exportDate: new Date().toISOString(),
                activeChannel: currentChannel,
                lastChannel: localStorage.getItem('kick_strikers_last_channel') || 'genel',
                joinCommand: localStorage.getItem('kick_strikers_join_cmd') || '!kingsc',
                channels: {}
            };

            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('kick_strikers_stats_')) {
                    const chName = k.replace('kick_strikers_stats_', '');
                    try {
                        backupData.channels[chName] = JSON.parse(localStorage.getItem(k));
                    } catch (e) {}
                }
            }

            if (!backupData.channels[currentChannel]) {
                backupData.channels[currentChannel] = channelStats;
            }

            const jsonStr = JSON.stringify(backupData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `Strickers_King_Data_Yedek_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            playUiSfx('click');
            showToast('🛡️ Mühürlü veriler JSON dosyası olarak başarıyla indirildi!');
        } catch (e) {
            console.error('Dışa aktarma hatası:', e);
            showToast('Veriler dışa aktarılırken bir hata oluştu.', true);
        }
    }

    // =========================================================================
    // Bilgisayardaki Mühürlü Kayıt Dosyalarını Otomatik Tarama Motoru
    // =========================================================================
    async function scanAndImportSealedBackupsViaApi() {
        try {
            const res = await fetch('/api/scan-backups');
            if (!res.ok) return;
            const data = await res.json();

            if (data && data.success && data.files && data.files.length > 0) {
                let totalAutoImported = 0;
                let importedFiles = [];
                try {
                    importedFiles = JSON.parse(localStorage.getItem('skc_imported_sealed_files') || '[]');
                } catch (e) {}

                data.files.forEach(f => {
                    if (importedFiles.includes(f.path)) return;

                    try {
                        const parsed = JSON.parse(f.content);
                        const hasSeal = parsed.__seal === 'STRICKERS_KING_OFFICIAL_SEAL_V2' ||
                            parsed.__seal === 'STRICKERS_KING_OFFICIAL_SEAL_V1' ||
                            f.content.includes('STRICKERS_KING_OFFICIAL_SEAL') ||
                            f.content.includes('Strickers King Creator');

                        if (hasSeal) {
                            let count = 0;
                            if (parsed.channels && typeof parsed.channels === 'object') {
                                Object.keys(parsed.channels).forEach(ch => {
                                    count += mergeParsedDataIntoStats(parsed.channels[ch], channelStats);
                                });
                            } else {
                                count = mergeParsedDataIntoStats(parsed, channelStats);
                            }

                            if (count > 0) {
                                totalAutoImported += count;
                                importedFiles.push(f.path);
                            }
                        }
                    } catch (err) {
                        console.warn('Sealed file parse error:', f.filename, err);
                    }
                });

                if (totalAutoImported > 0) {
                    localStorage.setItem('skc_imported_sealed_files', JSON.stringify(importedFiles));
                    saveChannelStats();
                    refreshAllPlayerElements();
                    showToast(`🛡️ Mühürlü Kayıt Dosyası Algılandı! (${totalAutoImported} oyuncu verisi otomatik aktarıldı)`);
                }
            }
        } catch (e) {
            console.warn('Backup scan API unavailable or offline:', e);
        }
    }

    function importDataFromJsonFile(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                const parsed = JSON.parse(content);

                let totalImported = 0;

                // 1. Durum: Yedek formatı (backupData)
                if (parsed && parsed.channels && typeof parsed.channels === 'object') {
                    Object.keys(parsed.channels).forEach(ch => {
                        const chStats = parsed.channels[ch];
                        const cleanCh = sanitizeChannelName(ch);
                        localStorage.setItem(`kick_strikers_stats_${cleanCh}`, JSON.stringify(chStats));
                        // Sunucuya kanal bazlı kaydet
                        fetch(`/api/hub/stats?channel=${encodeURIComponent(cleanCh)}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(chStats)
                        }).catch(() => {});

                        // Sadece aktif kanalla eşleşiyorsa mevcut oturumdaki channelStats ile birleştir
                        if (cleanCh.toLowerCase() === currentChannel.toLowerCase()) {
                            totalImported += mergeParsedDataIntoStats(chStats, channelStats);
                        } else {
                            totalImported += Object.keys(chStats).length;
                        }
                    });

                    if (parsed.joinCommand) {
                        currentJoinCommand = parsed.joinCommand;
                        localStorage.setItem('kick_strikers_join_cmd', currentJoinCommand);
                        if (joinCommandInput) joinCommandInput.value = currentJoinCommand;
                    }
                }
                // 2. Durum: Eski sürüm veya ham veri (Array veya Object)
                else {
                    totalImported = mergeParsedDataIntoStats(parsed, channelStats);
                }

                saveChannelStats();
                refreshAllPlayerElements();
                if (leaderboardModal && !leaderboardModal.classList.contains('hidden')) {
                    renderLeaderboard();
                }

                playUiSfx('join');
                showToast(`🎉 Yedek verileri başarıyla yüklendi! (${totalImported} oyuncu güncellendi)`);
            } catch (err) {
                console.error('JSON okuma hatası:', err);
                showToast('Geçersiz veya bozuk JSON dosyası!', true);
            }
        };

        reader.readAsText(file);
    }

    function loadChannelStats(channelName) {
        currentChannel = sanitizeChannelName(channelName);
        if (currentChannelNameDisplay) {
            currentChannelNameDisplay.textContent = currentChannel.toUpperCase();
        }

        // 'theonlyk1ng' Özel Kraliyet Teması ve Arka Planı
        if (currentChannel.toLowerCase() === 'theonlyk1ng') {
            document.body.classList.add('theme-theonlyk1ng');
            fetch(`/api/kick/channel?name=theonlyk1ng`).then(r => r.json()).then(data => {
                if (data && data.success && data.banner) {
                    document.body.style.setProperty('--theonlyk1ng-banner-url', `url('${data.banner}')`);
                    document.body.classList.add('has-custom-banner');
                }
            }).catch(() => {});
        } else {
            document.body.classList.remove('theme-theonlyk1ng');
            document.body.classList.remove('has-custom-banner');
            document.body.style.removeProperty('--theonlyk1ng-banner-url');
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

        // Eski test/sahte verilerini temizle
        const dummySignatures = {
            'ali': { wins: 0, losses: 1, saves: 3 },
            'ahmet': { wins: 2, losses: 0, goals: 5 },
            'emre': { wins: 1, losses: 0, saves: 4 },
            'batuhan': { wins: 0, losses: 1, saves: 3 },
            'kerem': { wins: 0, losses: 1, goals: 2 },
            'cihan': { wins: 1, losses: 0, goals: 3 },
            'mehmet': { wins: 1, losses: 0, goals: 1 },
            'burak': { wins: 1, losses: 0, goals: 1 }
        };
        let hasDummy = false;
        Object.keys(dummySignatures).forEach(dk => {
            const sig = dummySignatures[dk];
            const p = channelStats[dk];
            if (p && p.wins === sig.wins && p.losses === sig.losses) {
                delete channelStats[dk];
                hasDummy = true;
            }
        });
        if (hasDummy) {
            try {
                localStorage.setItem(`kick_strikers_stats_${currentChannel}`, JSON.stringify(channelStats));
            } catch (e) {}
        }

        // Sunucudaki kanal dosyasından senkronize et
        fetch(`/api/hub/stats?channel=${encodeURIComponent(currentChannel)}`).then(r => r.json()).then(remoteStats => {
            if (remoteStats && typeof remoteStats === 'object' && Object.keys(remoteStats).length > 0) {
                Object.keys(remoteStats).forEach(k => {
                    const rs = remoteStats[k];
                    if (!channelStats[k]) {
                        channelStats[k] = rs;
                    }
                });
                try {
                    localStorage.setItem(`kick_strikers_stats_${currentChannel}`, JSON.stringify(channelStats));
                } catch (e) {}
                refreshAllPlayerElements();
            }
        }).catch(() => {});

        refreshAllPlayerElements();
        if (leaderboardModal && !leaderboardModal.classList.contains('hidden')) {
            renderLeaderboard();
        }
    }

    function saveChannelStats() {
        try {
            localStorage.setItem(`kick_strikers_stats_${currentChannel}`, JSON.stringify(channelStats));
            fetch(`/api/hub/stats?channel=${encodeURIComponent(currentChannel)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(channelStats)
            }).catch(() => {});
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
                goals: 0,
                assists: 0,
                saves: 0,
                streak: 0,
                mvpCount: 0,
                displayName: name.trim()
            };
        }
        const stat = channelStats[key];
        const wins = Number(stat.wins) || 0;
        const losses = Number(stat.losses) || 0;
        const total = wins + losses;
        // 0 maç oynamış oyuncu KESİNLİKLE %0 Win Rate ve Derecesiz
        const winRate = total > 0 ? (wins / total) * 100 : 0;
        const rank = total === 0
            ? { title: 'Derecesiz', icon: 'fa-solid fa-shield-halved', className: 'rank-unranked' }
            : calculateRank(wins, losses);

        return {
            key,
            displayName: stat.displayName || name,
            wins,
            losses,
            goals: Number(stat.goals) || 0,
            assists: Number(stat.assists) || 0,
            saves: Number(stat.saves) || 0,
            streak: Number(stat.streak) || 0,
            mvpCount: Number(stat.mvpCount) || 0,
            total,
            winRate: total === 0 ? 0 : winRate,
            rank
        };
    }

    function updatePlayerItemBadge(li, name) {
        const detail = getPlayerStats(name);
        const chip = li.querySelector('.player-rank-chip');
        if (chip) {
            chip.className = `player-rank-chip ${detail.rank.className}`;
            chip.title = `${detail.rank.title} | ${detail.wins}G - ${detail.losses}M | Win Rate: %${detail.winRate.toFixed(1)}`;
            chip.innerHTML = `<i class="${detail.rank.icon}"></i> %${detail.winRate.toFixed(0)}`;
        }

        // Kazanma Serisi (🔥 Win Streak)
        const infoWrap = li.querySelector('.player-info-wrap');
        let flameBadge = li.querySelector('.win-streak-badge');
        if (detail.streak >= 3) {
            if (!flameBadge) {
                flameBadge = document.createElement('span');
                flameBadge.className = 'win-streak-badge';
                if (infoWrap) infoWrap.appendChild(flameBadge);
            }
            flameBadge.title = `${detail.streak} Maçlık Galibiyet Serisi!`;
            flameBadge.innerHTML = `<i class="fa-solid fa-fire-flame-curved live-flame"></i> ${detail.streak}W`;
        } else if (flameBadge) {
            flameBadge.remove();
        }

        // MVP Altın Taç Rozeti
        let mvpBadge = li.querySelector('.mvp-crown-badge');
        if (detail.mvpCount > 0) {
            if (!mvpBadge) {
                mvpBadge = document.createElement('span');
                mvpBadge.className = 'mvp-crown-badge';
                if (infoWrap) infoWrap.appendChild(mvpBadge);
            }
            mvpBadge.title = `${detail.mvpCount} Kez Maçın Adamı (MVP)`;
            mvpBadge.innerHTML = `<i class="fa-solid fa-crown" style="color:#ffd700;"></i> MVP x${detail.mvpCount}`;
        } else if (mvpBadge) {
            mvpBadge.remove();
        }
    }

    function refreshAllPlayerElements() {
        document.querySelectorAll('.player-item').forEach(li => {
            const name = li.dataset.name;
            if (name) updatePlayerItemBadge(li, name);
        });
        if (typeof updateTeamPowerBar === 'function') {
            updateTeamPowerBar();
        }
    }

    // =========================================================================
    // 👑 TAKIM KAPTANI SİSTEMİ DURUM VE YÖNETİMİ
    // =========================================================================
    function saveCaptainsState() {
        try {
            localStorage.setItem('kick_captains_set', JSON.stringify(Array.from(captainSet)));
            localStorage.setItem('kick_captain_limit', captainLimit.toString());
        } catch (e) {}
    }

    function isCaptain(name) {
        if (!name) return false;
        return captainSet.has(name.trim().toLowerCase());
    }

    function getCaptainsCount() {
        return document.querySelectorAll('.player-item.is-captain').length;
    }

    function updateCaptainDisplay() {
        if (captainLimitDisplay) {
            captainLimitDisplay.textContent = captainLimit;
        }
        const currentCaptains = getCaptainsCount();
        if (captainCountBadge) {
            captainCountBadge.textContent = `${currentCaptains}/${captainLimit}`;
            if (currentCaptains >= captainLimit) {
                captainCountBadge.classList.add('limit-reached');
            } else {
                captainCountBadge.classList.remove('limit-reached');
            }
        }
    }

    function setCaptainLimit(newLimit) {
        captainLimit = Math.max(1, Math.min(32, newLimit));
        saveCaptainsState();
        updateCaptainDisplay();
    }

    function promoteExistingPlayerToCaptain(playerLi, name) {
        const cleanName = name.trim();
        const cleanLower = cleanName.toLowerCase();

        captainSet.add(cleanLower);
        saveCaptainsState();

        if (playerLi) {
            playerLi.classList.add('is-captain');
            playerLi.dataset.isCaptain = "true";

            const infoWrap = playerLi.querySelector('.player-info-wrap');
            if (infoWrap && !infoWrap.querySelector('.player-captain-badge')) {
                const captainBadge = document.createElement('span');
                captainBadge.className = 'player-captain-badge';
                captainBadge.innerHTML = '<i class="fa-solid fa-crown"></i> KAPTAN';
                infoWrap.appendChild(captainBadge);
            }

            const capBtn = playerLi.querySelector('.toggle-captain-btn');
            if (capBtn) {
                capBtn.title = 'Kaptanlığı Geri Al';
            }
        }

        updateCaptainDisplay();
        playUiSfx('join');
        showToast(`👑 ${cleanName} Takım Kaptanı oldu! (${getCaptainsCount()}/${captainLimit})`);

        if (typeof obsSyncChannel !== 'undefined') {
            obsSyncChannel.postMessage({ type: 'request_state' });
        }
    }

    function demotePlayerFromCaptain(playerLi, name) {
        const cleanName = name.trim();
        const cleanLower = cleanName.toLowerCase();
        if (cleanLower === 'meh4n') {
            showToast('🛡️ MeH4n sistem geliştiricisidir; kaptanlıktan çıkarılamaz veya rolü değiştirilemez.', true);
            return;
        }

        captainSet.delete(cleanLower);
        saveCaptainsState();

        if (playerLi) {
            playerLi.classList.remove('is-captain');
            delete playerLi.dataset.isCaptain;

            const badge = playerLi.querySelector('.player-captain-badge');
            if (badge) badge.remove();

            const capBtn = playerLi.querySelector('.toggle-captain-btn');
            if (capBtn) {
                capBtn.title = 'Takım Kaptanı Yap';
            }
        }

        updateCaptainDisplay();
        playUiSfx('click');
        showToast(`👑 ${cleanName} kaptanlıktan alındı.`);

        if (typeof obsSyncChannel !== 'undefined') {
            obsSyncChannel.postMessage({ type: 'request_state' });
        }
    }

    function toggleCaptainStatus(playerLi, name) {
        const cleanName = name.trim();
        const cleanLower = cleanName.toLowerCase();
        if (cleanLower === 'meh4n') {
            showToast('🛡️ MeH4n sistem geliştiricisidir; kaptanlığı veya rolü değiştirilemez.', true);
            return;
        }
        const currentlyCaptain = (playerLi && playerLi.classList.contains('is-captain')) || captainSet.has(cleanLower);

        if (currentlyCaptain) {
            demotePlayerFromCaptain(playerLi, cleanName);
        } else {
            if (getCaptainsCount() >= captainLimit) {
                showToast(`⚠️ Kaptanlık limiti dolu (${captainLimit}/${captainLimit})! Önce bir kaptanı çıkarın veya limiti arttırın.`, true);
                playUiSfx('click');
                return;
            }
            promoteExistingPlayerToCaptain(playerLi, cleanName);
        }
    }

    function findPlayerElementInSystem(name) {
        if (!name) return null;
        const clean = name.trim().toLowerCase().replace(/ı/g, 'i').replace(/İ/g, 'i');
        const allPlayers = document.querySelectorAll('.player-item');
        for (const el of allPlayers) {
            const elName = (el.dataset.name || '').trim().toLowerCase().replace(/ı/g, 'i').replace(/İ/g, 'i');
            if (elName === clean) return el;
        }
        return null;
    }

    function handleCaptainCommand(username, avatarUrl = null) {
        if (!username || !username.trim()) return;
        const cleanName = username.trim();
        const existingEl = findPlayerElementInSystem(cleanName);

        if (existingEl) {
            if (existingEl.classList.contains('is-captain') || isCaptain(cleanName)) {
                showToast(`ℹ️ ${cleanName} zaten Takım Kaptanı!`);
                return;
            }

            if (getCaptainsCount() >= captainLimit) {
                showToast(`⚠️ Kaptanlık kontenjanı dolu (${captainLimit}/${captainLimit})! ${cleanName} normal oyuncu olarak devam ediyor.`, true);
                return;
            }

            // İki tane ondan olmak yerine mevcudu kaptana evrilt
            promoteExistingPlayerToCaptain(existingEl, cleanName);
        } else {
            if (getCaptainsCount() >= captainLimit) {
                showToast(`⚠️ Kaptanlık kontenjanı dolu (${captainLimit}/${captainLimit})! ${cleanName} normal izleyici olarak eklendi.`, true);
                addPlayerToPool(cleanName, avatarUrl);
                return;
            }

            captainSet.add(cleanName.toLowerCase());
            saveCaptainsState();
            addPlayerToPool(cleanName, avatarUrl);
            updateCaptainDisplay();
            showToast(`👑 ${cleanName} Takım Kaptanı olarak havuza katıldı! (${getCaptainsCount()}/${captainLimit})`);
        }
    }

    function findCaptainTeamList(captainName) {
        if (!captainName) return null;
        const clean = captainName.trim().toLowerCase().replace(/ı/g, 'i').replace(/İ/g, 'i');
        const teamPlayers = document.querySelectorAll('.team-list .player-item');
        
        // 1. Aşama: Tam Eşleşme
        for (const playerEl of teamPlayers) {
            const elName = (playerEl.dataset.name || '').trim().toLowerCase().replace(/ı/g, 'i').replace(/İ/g, 'i');
            if (elName === clean) {
                return playerEl.closest('.team-list');
            }
        }

        // 2. Aşama: Başlangıç veya Kısmi Eşleşme Toleransı
        for (const playerEl of teamPlayers) {
            const elName = (playerEl.dataset.name || '').trim().toLowerCase().replace(/ı/g, 'i').replace(/İ/g, 'i');
            if (elName.startsWith(clean) || clean.startsWith(elName)) {
                return playerEl.closest('.team-list');
            }
        }
        return null;
    }

    // =========================================================================
    // 🛡️ OYUNCU ROLLERİ & POZİSYON SİSTEMİ (GK, CB, RM, LM, ST vb.)
    // =========================================================================
    const ROLE_MAP = {
        'gk': 'GK',
        'kaleci': 'GK',
        'keeper': 'GK',
        'goalkeeper': 'GK',
        'gkk': 'GK',
        'eldiven': 'GK',
        'cb': 'CB',
        'stoper': 'CB',
        'centerback': 'CB',
        'centreback': 'CB',
        'def': 'CB',
        'defans': 'CB',
        'lb': 'LB',
        'solbek': 'LB',
        'leftback': 'LB',
        'rb': 'RB',
        'sagbek': 'RB',
        'sağbek': 'RB',
        'rightback': 'RB',
        'rm': 'RM',
        'sagkanat': 'RM',
        'sağkanat': 'RM',
        'sahkanat': 'RM',
        'rightmid': 'RM',
        'lm': 'LM',
        'solkanat': 'LM',
        'leftmid': 'LM',
        'cm': 'CM',
        'ortasaha': 'CM',
        'centralmid': 'CM',
        'cdm': 'CDM',
        'onlibero': 'CDM',
        'önlibero': 'CDM',
        'cam': 'CAM',
        'onnumara': 'CAM',
        '10numara': 'CAM',
        'st': 'ST',
        'forvet': 'ST',
        'santrfor': 'ST',
        'striker': 'ST',
        'rw': 'RW',
        'saghucum': 'RW',
        'lw': 'LW',
        'solhucum': 'LW',
        'cf': 'CF'
    };

    function savePlayerRolesState() {
        try {
            const rolesObj = Object.fromEntries(playerRoles.entries());
            localStorage.setItem('kick_player_roles', JSON.stringify(rolesObj));
        } catch (e) {}
    }

    function normalizeRole(roleInput) {
        if (!roleInput) return null;
        let str = roleInput.toString().trim().toLowerCase();
        // Boşlukları, parantezleri, tire ve alt çizgileri temizle ve Türkçe harfleri standartlaştır
        let clean = str
            .replace(/[\(\)\[\]\s_-]/g, '')
            .replace(/ı/g, 'i')
            .replace(/İ/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/ş/g, 's')
            .replace(/ç/g, 'c')
            .replace(/ö/g, 'o')
            .replace(/ü/g, 'u');

        if (!clean) return null;
        if (ROLE_MAP[clean]) return ROLE_MAP[clean];
        if (clean.includes('gk') || clean.includes('kaleci') || clean.includes('keeper')) return 'GK';
        if (clean.includes('stoper') || clean.includes('defans') || clean === 'cb' || clean === 'def') return 'CB';
        if (clean.includes('solbek') || clean === 'lb' || clean === 'leftback') return 'LB';
        if (clean.includes('sagbek') || clean === 'rb' || clean === 'rightback') return 'RB';
        if (clean.includes('sagkanat') || clean.includes('sahkanat') || clean === 'rm' || clean === 'rightmid') return 'RM';
        if (clean.includes('solkanat') || clean === 'lm' || clean === 'leftmid') return 'LM';
        if (clean.includes('onlibero') || clean === 'cdm') return 'CDM';
        if (clean.includes('onnumara') || clean.includes('10numara') || clean === 'cam') return 'CAM';
        if (clean.includes('ortasaha') || clean === 'cm') return 'CM';
        if (clean.includes('forvet') || clean.includes('santrfor') || clean.includes('striker') || clean === 'st') return 'ST';
        if (clean.includes('saghucum') || clean === 'rw') return 'RW';
        if (clean.includes('solhucum') || clean === 'lw') return 'LW';
        if (/^[a-zA-Z]{2,4}$/.test(clean)) {
            return clean.toUpperCase();
        }
        return null;
    }

    function setPlayerRole(playerLi, role) {
        if (!playerLi) return;
        const pName = playerLi.dataset.name;
        if (!pName) return;
        const cleanRole = normalizeRole(role);
        if (pName.trim().toLowerCase() === 'meh4n' && playerRoles.has('meh4n')) {
            if (!cleanRole) {
                showToast('🛡️ MeH4n sistem geliştiricisidir; rolü silinemez.', true);
                return;
            }
            if (cleanRole !== playerRoles.get('meh4n')) {
                showToast('🛡️ MeH4n sistem geliştiricisidir; belirlenen rolü kilitlidir.', true);
                return;
            }
        }
        if (cleanRole) {
            playerRoles.set(pName.toLowerCase(), cleanRole);
            savePlayerRolesState();
            playerLi.dataset.role = cleanRole;
            let roleBadge = playerLi.querySelector('.player-role-badge');
            if (!roleBadge) {
                roleBadge = document.createElement('span');
                roleBadge.className = 'player-role-badge';
                const infoWrap = playerLi.querySelector('.player-info-wrap');
                if (infoWrap) {
                    const nameSpan = infoWrap.querySelector('.player-name-text');
                    if (nameSpan && nameSpan.nextSibling) {
                        infoWrap.insertBefore(roleBadge, nameSpan.nextSibling);
                    } else if (nameSpan) {
                        infoWrap.appendChild(roleBadge);
                    }
                }
            }
            if (roleBadge) {
                roleBadge.className = `player-role-badge role-${cleanRole.toLowerCase()}`;
                if (cleanRole === 'GK') {
                    roleBadge.innerHTML = '<i class="fa-solid fa-mitten"></i> GK (Kaleci)';
                    roleBadge.title = 'Kaleci (Goalkeeper)';
                } else {
                    roleBadge.textContent = cleanRole;
                    roleBadge.title = `Rol: ${cleanRole}`;
                }
            }
        } else {
            playerRoles.delete(pName.toLowerCase());
            savePlayerRolesState();
            delete playerLi.dataset.role;
            const roleBadge = playerLi.querySelector('.player-role-badge');
            if (roleBadge) roleBadge.remove();
        }
    }

    function extractDraftTarget(message) {
        if (!message) return null;
        let trimmed = message.trim();

        // Türkçe ve mobil klavye toleransı: 'isec', 'ısec', 'iseç', 'ıseç' durumunda baştaki i/ı harfini '!' yap
        trimmed = trimmed.replace(/^[iı](?=(?:sec|seç|al|pick|draft)\b)/i, '!');

        // 1. Seçim komutu ile etiketleme: !sec @oyuncu [rol] VEYA !sec @oyuncu GK
        // Örnekler: !sec @Ahmet GK, !sec Ahmet CB, !sec @Burak GK(kaleci), !sec @Ali rm
        const cmdMatch = trimmed.match(/^!(?:sec|seç|al|pick|draft)\s+@?([a-zA-Z0-9_\u00C0-\u017F-]+)(?:\s+(.+))?$/i);
        if (cmdMatch && cmdMatch[1]) {
            const rawTarget = cmdMatch[1].trim();
            const rawRole = cmdMatch[2] ? cmdMatch[2].trim() : null;
            return {
                target: rawTarget,
                role: normalizeRole(rawRole)
            };
        }

        // 2. Ters kalıp: @oyuncu al [rol] / @oyuncu sec [rol]
        const reverseMatch = trimmed.match(/^@?([a-zA-Z0-9_\u00C0-\u017F-]+)\s+(?:al|sec|seç)(?:\s+(.+))?$/i);
        if (reverseMatch && reverseMatch[1]) {
            return {
                target: reverseMatch[1].trim(),
                role: normalizeRole(reverseMatch[2] ? reverseMatch[2].trim() : null)
            };
        }

        // 2b. Ters kalıp 2: @oyuncu [rol] sec / @oyuncu GK al
        const reverseRoleMatch = trimmed.match(/^@?([a-zA-Z0-9_\u00C0-\u017F-]+)\s+([a-zA-Z()]{2,12})\s+(?:al|sec|seç)$/i);
        if (reverseRoleMatch && reverseRoleMatch[1]) {
            return {
                target: reverseRoleMatch[1].trim(),
                role: normalizeRole(reverseRoleMatch[2].trim())
            };
        }

        // 3. Doğrudan etiketleme: @kullanici [rol]
        const directMentionMatch = trimmed.match(/^@([a-zA-Z0-9_\u00C0-\u017F-]+)(?:\s+([a-zA-Z()]{2,12}))?$/i);
        if (directMentionMatch && directMentionMatch[1]) {
            return {
                target: directMentionMatch[1].trim(),
                role: normalizeRole(directMentionMatch[2] ? directMentionMatch[2].trim() : null)
            };
        }

        return null;
    }

    function executeCaptainPick(captainName, targetInfo, captainTeamList) {
        if (!captainTeamList) return false;

        const targetName = typeof targetInfo === 'object' && targetInfo !== null ? targetInfo.target : targetInfo;
        const role = typeof targetInfo === 'object' && targetInfo !== null ? targetInfo.role : null;

        if (!targetName) return false;

        const cleanTarget = targetName.trim().toLowerCase().replace(/ı/g, 'i').replace(/İ/g, 'i');
        const cleanCaptain = captainName.trim().toLowerCase().replace(/ı/g, 'i').replace(/İ/g, 'i');

        if (cleanTarget === cleanCaptain) {
            showToast(`ℹ️ Kaptan ${captainName} zaten bu takımda!`);
            return false;
        }

        const maxSize = parseInt(teamSizeSelect ? teamSizeSelect.value : '5', 10);
        if (captainTeamList.children.length >= maxSize) {
            showToast(`⚠️ Kaptan ${captainName}'in takımı dolu (${maxSize}/${maxSize})! Daha fazla oyuncu alamaz.`, true);
            playUiSfx('click');
            return false;
        }

        // Kendi takımında zaten var mı?
        const existingInSameTeam = Array.from(captainTeamList.querySelectorAll('.player-item')).some(el => {
            const curName = (el.dataset.name || '').trim().toLowerCase().replace(/ı/g, 'i').replace(/İ/g, 'i');
            return curName === cleanTarget || curName.startsWith(cleanTarget);
        });
        if (existingInSameTeam) {
            showToast(`ℹ️ ${targetName} zaten Kaptan ${captainName}'in takımında.`);
            return false;
        }

        // Başka bir takımda mı?
        const otherTeamsPlayers = Array.from(document.querySelectorAll('.team-list .player-item')).filter(el => {
            return el.closest('.team-list') !== captainTeamList;
        });
        const inOtherTeam = otherTeamsPlayers.some(el => {
            const curName = (el.dataset.name || '').trim().toLowerCase().replace(/ı/g, 'i').replace(/İ/g, 'i');
            return curName === cleanTarget;
        });
        if (inOtherTeam) {
            showToast(`⚠️ ${targetName} zaten başka bir takımda yer alıyor!`, true);
            playUiSfx('click');
            return false;
        }

        // İzleyici havuzunda ara (Akıllı Çok Kademeli Eşleştirme)
        const poolPlayers = Array.from(playerPool ? playerPool.querySelectorAll('.player-item') : []);
        
        // 1. Kademe: Tam Eşleşme
        let targetPlayerEl = poolPlayers.find(el => {
            const pName = (el.dataset.name || '').trim().toLowerCase().replace(/ı/g, 'i').replace(/İ/g, 'i');
            return pName === cleanTarget;
        });

        // 2. Kademe: Başlangıç Eşleşmesi (örn: 'king' -> 'King_Pro')
        if (!targetPlayerEl) {
            targetPlayerEl = poolPlayers.find(el => {
                const pName = (el.dataset.name || '').trim().toLowerCase().replace(/ı/g, 'i').replace(/İ/g, 'i');
                return pName.startsWith(cleanTarget);
            });
        }

        // 3. Kademe: İçerme Eşleşmesi (en az 3 karakter ise)
        if (!targetPlayerEl && cleanTarget.length >= 3) {
            targetPlayerEl = poolPlayers.find(el => {
                const pName = (el.dataset.name || '').trim().toLowerCase().replace(/ı/g, 'i').replace(/İ/g, 'i');
                return pName.includes(cleanTarget);
            });
        }

        if (!targetPlayerEl) {
            showToast(`⚠️ "${targetName}" izleyici havuzunda bulunamadı!`, true);
            playUiSfx('click');
            return false;
        }

        if (isCaptain(targetPlayerEl.dataset.name)) {
            showToast(`⚠️ "${targetPlayerEl.dataset.name}" bir Takım Kaptanıdır! Başka takım tarafından seçilemez.`, true);
            playUiSfx('click');
            return false;
        }

        // Kaptanın takımına aktar
        captainTeamList.appendChild(targetPlayerEl);
        updatePoolCount();

        // Rolü uygula (varsa)
        if (role) {
            setPlayerRole(targetPlayerEl, role);
        }

        // Buton durumunu güncelle
        const assignBtn = targetPlayerEl.querySelector('.quick-assign-btn');
        if (assignBtn) {
            assignBtn.title = 'Havuza Geri Al';
            assignBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i>';
        }

        // Takım kutusu sayacını güncelle
        const teamBox = captainTeamList.closest('.team-box') || captainTeamList.closest('.bracket-team-slot');
        const isTournament = gameModeSelect && gameModeSelect.value === 'tournament';
        if (teamBox) {
            const countBadge = teamBox.querySelector('.team-count');
            if (countBadge) {
                countBadge.textContent = isTournament
                    ? `${captainTeamList.children.length}/${maxSize}`
                    : captainTeamList.children.length;
            }
            if (captainTeamList.children.length >= maxSize) {
                teamBox.classList.add('full');
            } else {
                teamBox.classList.remove('full');
            }
        }

        playUiSfx('join');
        const roleDisplay = role ? (role === 'GK' ? ' [GK (Kaleci)]' : ` [${role}]`) : '';
        showToast(`🎯 Kaptan ${captainName}, @${targetPlayerEl.dataset.name} oyuncusunu${roleDisplay} takımına seçti! (${captainTeamList.children.length}/${maxSize})`);

        if (typeof obsSyncChannel !== 'undefined') {
            const tc = document.getElementById('teamsContainer');
            if (tc) {
                obsSyncChannel.postMessage({ type: 'sync_html', html: tc.innerHTML, modeClass: tc.className });
            }
            obsSyncChannel.postMessage({ type: 'update_pool_count', count: document.querySelectorAll('#playerPool .player-item').length });
        }

        return true;
    }

    // =========================================================================
    // 🎲 KAPTAN ZAR KURASI VE SIRALI OYUNCU SEÇİMİ (TURN-BY-TURN DRAFT)
    // =========================================================================

    function getEligibleCaptainsForDraft() {
        const list = [];
        const seen = new Set();

        // 1. Takımlarda yer alan kaptanları topla
        const teamLists = Array.from(document.querySelectorAll('.team-list'));
        teamLists.forEach((tList, idx) => {
            const capEl = tList.querySelector('.player-item.is-captain');
            if (capEl) {
                const name = capEl.dataset.name;
                const teamBox = tList.closest('.team-box') || tList.closest('.bracket-team-slot');
                const teamNameInput = teamBox ? (teamBox.querySelector('.team-name-input') || teamBox.querySelector('.slot-name-input') || teamBox.querySelector('.slot-name-text')) : null;
                const teamName = teamNameInput ? (teamNameInput.value || teamNameInput.textContent).trim() : `Takım ${idx + 1}`;
                if (!seen.has(name.toLowerCase())) {
                    seen.add(name.toLowerCase());
                    list.push({ name, teamList: tList, teamName, element: capEl });
                }
            }
        });

        // 2. Havuzdaki kaptanları henüz kaptansız olan takımlara dağıt
        const poolCaps = Array.from(playerPool ? playerPool.querySelectorAll('.player-item.is-captain') : []);
        poolCaps.forEach(capEl => {
            const name = capEl.dataset.name;
            if (!seen.has(name.toLowerCase())) {
                const emptyTeamList = teamLists.find(tl => !tl.querySelector('.player-item.is-captain'));
                if (emptyTeamList) {
                    emptyTeamList.appendChild(capEl);
                    updatePoolCount();
                    const teamBox = emptyTeamList.closest('.team-box') || emptyTeamList.closest('.bracket-team-slot');
                    const teamNameInput = teamBox ? (teamBox.querySelector('.team-name-input') || teamBox.querySelector('.slot-name-input') || teamBox.querySelector('.slot-name-text')) : null;
                    const teamName = teamNameInput ? (teamNameInput.value || teamNameInput.textContent).trim() : 'Takım';
                    seen.add(name.toLowerCase());
                    list.push({ name, teamList: emptyTeamList, teamName, element: capEl });
                } else {
                    seen.add(name.toLowerCase());
                    list.push({ name, teamList: null, teamName: 'Takımsız', element: capEl });
                }
            }
        });

        return list;
    }

    function startCaptainDiceRoll() {
        const captains = getEligibleCaptainsForDraft();
        if (captains.length < 2) {
            showToast('⚠️ Zar kurası için en az 2 takım kaptanı gereklidir! Chat\'e !kingkaptan yazarak veya oyuncu kartındaki taç (👑) simgesiyle kaptan belirleyin.', true);
            playUiSfx('click');
            return;
        }

        // Modalı aç
        const diceModal = document.getElementById('diceRollModal');
        const animStage = document.getElementById('diceAnimationStage');
        const resContainer = document.getElementById('diceResultContainer');
        const winnerNameEl = document.getElementById('diceWinnerName');
        const winnerScoreEl = document.getElementById('diceWinnerScoreBadge');
        const orderListEl = document.getElementById('diceOrderList');

        if (!diceModal) return;

        diceModal.classList.remove('hidden');
        if (animStage) animStage.classList.remove('hidden');
        if (resContainer) resContainer.classList.add('hidden');

        playUiSfx('shuffle');

        // Her kaptana rastgele zar skoru ver (10-99), eşitliği önle
        const usedScores = new Set();
        captains.forEach(c => {
            let score;
            do {
                score = Math.floor(Math.random() * 90) + 10;
            } while (usedScores.has(score));
            usedScores.add(score);
            c.score = score;
        });

        // Skorlara göre azalan sırala (en yüksek zar atan 1. sırada, ilk seçimi yapar)
        captains.sort((a, b) => b.score - a.score);
        currentDraftOrder = captains;

        // 1.1 sn sonra zar animasyonunu durdur ve sonucu göster
        setTimeout(() => {
            if (animStage) animStage.classList.add('hidden');
            if (resContainer) resContainer.classList.remove('hidden');

            const winner = currentDraftOrder[0];
            if (winnerNameEl) winnerNameEl.textContent = `${winner.name} (${winner.teamName})`;
            if (winnerScoreEl) winnerScoreEl.innerHTML = `<i class="fa-solid fa-dice"></i> Zar: ${winner.score}`;

            if (orderListEl) {
                orderListEl.innerHTML = '';
                currentDraftOrder.forEach((c, idx) => {
                    const li = document.createElement('li');
                    li.className = `dice-order-item ${idx === 0 ? 'first-pick' : ''}`;
                    li.innerHTML = `
                        <span class="order-rank">#${idx + 1}</span>
                        <span class="order-name"><i class="fa-solid fa-crown" style="color:#fbbf24;"></i> ${c.name}</span>
                        <span class="order-team">${c.teamName}</span>
                        <span class="order-score"><i class="fa-solid fa-dice"></i> ${c.score}</span>
                    `;
                    orderListEl.appendChild(li);
                });
            }

            playUiSfx('win');
        }, 1100);
    }

    function startDraftTurnMode() {
        if (!currentDraftOrder || currentDraftOrder.length === 0) {
            currentDraftOrder = getEligibleCaptainsForDraft();
        }
        if (currentDraftOrder.length < 2) {
            showToast('⚠️ Seçim sırası için en az 2 kaptan gereklidir!', true);
            return;
        }

        const diceModal = document.getElementById('diceRollModal');
        if (diceModal) diceModal.classList.add('hidden');

        draftModeActive = true;
        currentDraftIndex = 0;

        const banner = document.getElementById('draftTurnBanner');
        if (banner) banner.classList.remove('hidden');

        updateDraftTurnUI();
        playUiSfx('start');

        const activeCap = currentDraftOrder[currentDraftIndex];
        showToast(`🎲 Kaptan Seçim Sırası Başladı! İlk seçim: ${activeCap.name} (${activeCap.teamName})`);
    }

    function updateDraftTurnUI() {
        if (!draftModeActive || currentDraftOrder.length === 0) return;

        const banner = document.getElementById('draftTurnBanner');
        if (banner) banner.classList.remove('hidden');

        const activeCap = currentDraftOrder[currentDraftIndex];
        const nextIdx = (currentDraftIndex + 1) % currentDraftOrder.length;
        const nextCap = currentDraftOrder[nextIdx];

        const capDisplay = document.getElementById('activeCaptainDisplay');
        const teamDisplay = document.getElementById('activeTeamDisplay');
        const nextDisplay = document.getElementById('nextCaptainDisplay');

        const liveActiveTeam = activeCap ? (findCaptainTeamList(activeCap.name) || activeCap.teamList) : null;
        let liveActiveTeamName = activeCap ? activeCap.teamName : '-';
        if (liveActiveTeam) {
            const teamBox = liveActiveTeam.closest('.team-box') || liveActiveTeam.closest('.bracket-team-slot');
            const nameEl = teamBox ? (teamBox.querySelector('.team-name-input') || teamBox.querySelector('.slot-name-input') || teamBox.querySelector('.slot-name-text')) : null;
            if (nameEl) liveActiveTeamName = (nameEl.value || nameEl.textContent).trim();
        }

        const liveNextTeam = nextCap ? (findCaptainTeamList(nextCap.name) || nextCap.teamList) : null;
        let liveNextTeamName = nextCap ? nextCap.teamName : '-';
        if (liveNextTeam) {
            const teamBox = liveNextTeam.closest('.team-box') || liveNextTeam.closest('.bracket-team-slot');
            const nameEl = teamBox ? (teamBox.querySelector('.team-name-input') || teamBox.querySelector('.slot-name-input') || teamBox.querySelector('.slot-name-text')) : null;
            if (nameEl) liveNextTeamName = (nameEl.value || nameEl.textContent).trim();
        }

        if (capDisplay) capDisplay.textContent = activeCap ? activeCap.name : '-';
        if (teamDisplay) teamDisplay.textContent = liveActiveTeamName;
        if (nextDisplay) nextDisplay.textContent = nextCap ? `${nextCap.name} (${liveNextTeamName})` : '-';

        // Takım kutularındaki seçim sırası vurgusunu güncelle
        document.querySelectorAll('.team-box.active-draft-turn, .bracket-team-slot.active-draft-turn').forEach(el => {
            el.classList.remove('active-draft-turn');
        });

        if (liveActiveTeam) {
            const teamBox = liveActiveTeam.closest('.team-box') || liveActiveTeam.closest('.bracket-team-slot');
            if (teamBox) {
                teamBox.classList.add('active-draft-turn');
                teamBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    function advanceDraftTurn() {
        if (!draftModeActive || currentDraftOrder.length === 0) return;

        const maxSize = parseInt(teamSizeSelect ? teamSizeSelect.value : '5', 10);

        // Havuzda hiç oyuncu kaldı mı?
        const poolCount = playerPool ? playerPool.querySelectorAll('.player-item').length : 0;
        if (poolCount === 0) {
            showToast('🎉 İzleyici havuzundaki tüm oyuncular seçildi! Kaptan seçim turu tamamlandı.');
            endDraftTurnMode(true);
            return;
        }

        // Tüm takımlar doldu mu?
        const allTeamsFull = currentDraftOrder.every(c => {
            const list = c.teamList || findCaptainTeamList(c.name);
            return list && list.children.length >= maxSize;
        });

        if (allTeamsFull) {
            showToast('🎉 Tüm takımlar kadrolarını doldurdu! Kaptan seçim turu tamamlandı.');
            endDraftTurnMode(true);
            return;
        }

        // Bir sonraki takımı müsait olan kaptanı bul
        let foundNext = false;
        let attempts = 0;
        let nextIndex = currentDraftIndex;

        while (attempts < currentDraftOrder.length) {
            nextIndex = (nextIndex + 1) % currentDraftOrder.length;
            attempts++;
            const candidate = currentDraftOrder[nextIndex];
            const candidateTeam = candidate.teamList || findCaptainTeamList(candidate.name);
            if (candidateTeam && candidateTeam.children.length < maxSize) {
                foundNext = true;
                break;
            }
        }

        if (!foundNext) {
            showToast('🎉 Müsait takım kalmadı! Seçim turu sona erdi.');
            endDraftTurnMode(true);
            return;
        }

        currentDraftIndex = nextIndex;
        updateDraftTurnUI();
        playUiSfx('click');

        const activeCap = currentDraftOrder[currentDraftIndex];
        showToast(`🎲 Sıradaki seçim: Kaptan ${activeCap.name} (${activeCap.teamName})! Komut: !sec @oyuncu GK`);
    }

    function endDraftTurnMode(completed = false) {
        draftModeActive = false;
        const banner = document.getElementById('draftTurnBanner');
        if (banner) banner.classList.add('hidden');

        document.querySelectorAll('.team-box.active-draft-turn, .bracket-team-slot.active-draft-turn').forEach(el => {
            el.classList.remove('active-draft-turn');
        });

        if (completed) {
            playUiSfx('win');
        } else {
            showToast('ℹ️ Kaptan seçim sırası modu sonlandırıldı.');
        }
    }

    function initCaptainSystem() {
        if (captainLimitMinusBtn) {
            captainLimitMinusBtn.addEventListener('click', () => {
                playUiSfx('click');
                if (captainLimit > 1) {
                    setCaptainLimit(captainLimit - 1);
                    showToast(`Kaptanlık Limiti: ${captainLimit}`);
                }
            });
        }

        if (captainLimitPlusBtn) {
            captainLimitPlusBtn.addEventListener('click', () => {
                playUiSfx('click');
                if (captainLimit < 32) {
                    setCaptainLimit(captainLimit + 1);
                    showToast(`Kaptanlık Limiti: ${captainLimit}`);
                }
            });
        }

        // 🎲 Zar & Kaptan Sıralı Seçim Buton Dinleyicileri
        if (draftDiceBtn) {
            draftDiceBtn.addEventListener('click', () => {
                startCaptainDiceRoll();
            });
        }

        if (closeDiceModalBtn) {
            closeDiceModalBtn.addEventListener('click', () => {
                if (diceRollModal) diceRollModal.classList.add('hidden');
            });
        }

        if (reRollDiceBtn) {
            reRollDiceBtn.addEventListener('click', () => {
                startCaptainDiceRoll();
            });
        }

        if (startDraftTurnBtn) {
            startDraftTurnBtn.addEventListener('click', () => {
                startDraftTurnMode();
            });
        }

        if (draftSkipTurnBtn) {
            draftSkipTurnBtn.addEventListener('click', () => {
                advanceDraftTurn();
            });
        }

        if (draftReDiceBtn) {
            draftReDiceBtn.addEventListener('click', () => {
                startCaptainDiceRoll();
            });
        }

        if (draftEndBtn) {
            draftEndBtn.addEventListener('click', () => {
                endDraftTurnMode(false);
            });
        }

        updateCaptainDisplay();

        // Geliştirici & Canlı Test için Kick Chat simülasyon fonksiyonu
        window.simulateKickChat = function(testUser, testMessage) {
            if (!testUser || !testMessage) return;
            handleKickChatMessage({
                sender: { username: testUser },
                content: testMessage
            });
        };

        window.captainSystem = {
            isCaptain,
            getCaptainsCount,
            setCaptainLimit,
            handleCaptainCommand,
            executeCaptainPick,
            findCaptainTeamList,
            startCaptainDiceRoll,
            startDraftTurnMode,
            advanceDraftTurn,
            endDraftTurnMode,
            setPlayerRole,
            normalizeRole,
            simulateKickChat: window.simulateKickChat,
            getActiveChannels: () => Array.from(activeChannels.keys()),
            disconnectKickChannel,
            subscribeToKickChannel
        };
    }

    function quickAssignPlayer(playerLi, name) {
        if (!playerLi) return;
        const isInPool = playerLi.closest('#playerPool') !== null;
        const maxSize = parseInt(teamSizeSelect ? teamSizeSelect.value : '5', 10);
        const isTournament = gameModeSelect && gameModeSelect.value === 'tournament';

        if (isInPool) {
            // Müsait olan ilk takımı bul
            const allTeamLists = Array.from(document.querySelectorAll('.team-list'));
            const availableTeam = allTeamLists.find(list => list.children.length < maxSize);

            if (!availableTeam) {
                showToast(`⚠️ Tüm takımlar dolu (${maxSize}/${maxSize})! Oyuncu eklenemedi.`, true);
                playUiSfx('click');
                return;
            }

            availableTeam.appendChild(playerLi);
            updatePoolCount();

            const teamBox = availableTeam.closest('.team-box') || availableTeam.closest('.bracket-team-slot');
            if (teamBox) {
                const countBadge = teamBox.querySelector('.team-count');
                if (countBadge) {
                    countBadge.textContent = isTournament ? `${availableTeam.children.length}/${maxSize}` : availableTeam.children.length;
                }
                if (availableTeam.children.length >= maxSize) teamBox.classList.add('full');
            }

            const assignBtn = playerLi.querySelector('.quick-assign-btn');
            if (assignBtn) {
                assignBtn.title = 'Havuza Geri Gönder';
                assignBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i>';
            }

            playUiSfx('join');
            showToast(`✅ ${name} takıma eklendi! (${availableTeam.children.length}/${maxSize})`);
        } else {
            // Zaten takımda -> Havuza geri al
            const previousTeam = playerLi.closest('.team-list');
            if (playerPool) {
                playerPool.appendChild(playerLi);
            }
            updatePoolCount();

            if (previousTeam) {
                const teamBox = previousTeam.closest('.team-box') || previousTeam.closest('.bracket-team-slot');
                if (teamBox) {
                    const countBadge = teamBox.querySelector('.team-count');
                    if (countBadge) {
                        countBadge.textContent = isTournament ? `${previousTeam.children.length}/${maxSize}` : previousTeam.children.length;
                    }
                    teamBox.classList.remove('full');
                }
            }

            const assignBtn = playerLi.querySelector('.quick-assign-btn');
            if (assignBtn) {
                assignBtn.title = 'Müsait İlk Takıma Ata';
                assignBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i>';
            }

            playUiSfx('click');
            showToast(`↩️ ${name} tekrar havuza alındı.`);
        }

        const tc = document.getElementById('teamsContainer');
        if (tc && typeof obsSyncChannel !== 'undefined') {
            obsSyncChannel.postMessage({ type: 'sync_html', html: tc.innerHTML, modeClass: tc.className });
            obsSyncChannel.postMessage({ type: 'update_pool_count', count: document.querySelectorAll('#playerPool .player-item').length });
        }
    }

    function createPlayerElement(name, avatarUrl = null) {
        const li = document.createElement('li');
        li.className = 'player-item';
        li.dataset.name = name;

        const isDev = name.trim().toLowerCase() === 'meh4n';
        if (isDev) {
            li.classList.add('is-developer');
        }

        const isPlayerCap = isCaptain(name);
        if (isPlayerCap) {
            li.classList.add('is-captain');
            li.dataset.isCaptain = "true";
        }
        
        // Avatar dairesi (profil fotoğrafı veya renkli baş harf yedeği)
        const avatarEl = createPlayerAvatar(name, avatarUrl);
        avatarEl.classList.add('player-avatar-circle');
        avatarEl.style.cursor = 'pointer';
        avatarEl.title = `${name} - FUT Oyuncu Kartını Aç`;
        avatarEl.onclick = function(e) {
            e.stopPropagation();
            openFifaCardModal(name);
        };

        const infoWrap = document.createElement('div');
        infoWrap.className = 'player-info-wrap';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'player-name-text';
        nameSpan.textContent = name;

        const rankChip = document.createElement('span');
        rankChip.className = 'player-rank-chip';
        rankChip.style.cursor = 'pointer';
        rankChip.title = `${name} - FUT Oyuncu Kartını Aç`;
        rankChip.onclick = function(e) {
            e.stopPropagation();
            openFifaCardModal(name);
        };

        infoWrap.appendChild(nameSpan);
        infoWrap.appendChild(rankChip);

        const cleanNameLower = name.trim().toLowerCase();
        if (playerRoles.has(cleanNameLower)) {
            const savedRole = playerRoles.get(cleanNameLower);
            li.dataset.role = savedRole;
            const roleBadge = document.createElement('span');
            roleBadge.className = `player-role-badge role-${savedRole.toLowerCase()}`;
            if (savedRole === 'GK') {
                roleBadge.innerHTML = '<i class="fa-solid fa-mitten"></i> GK (Kaleci)';
                roleBadge.title = 'Kaleci (Goalkeeper)';
            } else {
                roleBadge.textContent = savedRole;
                roleBadge.title = `Rol: ${savedRole}`;
            }
            infoWrap.appendChild(roleBadge);
        }

        if (isDev) {
            const devBadge = document.createElement('span');
            devBadge.className = 'player-role-badge role-dev';
            devBadge.innerHTML = '<i class="fa-solid fa-code"></i> DEVELOPER';
            devBadge.title = 'Sistem Geliştiricisi (Dokunulmaz)';
            infoWrap.appendChild(devBadge);
        }

        if (isPlayerCap) {
            const captainBadge = document.createElement('span');
            captainBadge.className = 'player-captain-badge';
            captainBadge.innerHTML = '<i class="fa-solid fa-crown"></i> KAPTAN';
            infoWrap.appendChild(captainBadge);
        }

        // Butonlar / Eylemler Kapsayıcısı
        const actionsWrap = document.createElement('div');
        actionsWrap.className = 'player-item-actions';

        // FUT Kart Butonu
        const fifaBtn = document.createElement('button');
        fifaBtn.className = 'fifa-card-btn';
        fifaBtn.type = 'button';
        fifaBtn.title = 'FUT Oyuncu Kartını Gör';
        fifaBtn.innerHTML = '<i class="fa-solid fa-id-card-clip"></i>';
        fifaBtn.onclick = function(e) {
            e.stopPropagation();
            openFifaCardModal(name);
        };
        actionsWrap.appendChild(fifaBtn);

        // Hızlı Takıma Ekle / Havuza Gönder Butonu (Tek tıkla atama kolaylığı)
        const assignBtn = document.createElement('button');
        assignBtn.className = 'quick-assign-btn';
        assignBtn.type = 'button';
        assignBtn.title = 'Müsait İlk Takıma Ata';
        assignBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i>';
        assignBtn.onclick = function(e) {
            e.stopPropagation();
            quickAssignPlayer(li, name);
        };
        actionsWrap.appendChild(assignBtn);

        // Kaptanlık Aç/Kapat Butonu
        const toggleCapBtn = document.createElement('button');
        toggleCapBtn.className = 'toggle-captain-btn';
        toggleCapBtn.type = 'button';
        if (isDev) {
            toggleCapBtn.disabled = true;
            toggleCapBtn.style.opacity = '0.4';
            toggleCapBtn.title = 'Developer Kaptanlığı / Rolü Değiştirilemez';
        } else {
            toggleCapBtn.title = isPlayerCap ? 'Kaptanlığı Geri Al' : 'Takım Kaptanı Yap';
        }
        toggleCapBtn.innerHTML = '<i class="fa-solid fa-crown"></i>';
        toggleCapBtn.onclick = function(e) {
            e.stopPropagation();
            if (isDev) {
                showToast('🛡️ MeH4n sistem geliştiricisidir; kaptanlığı veya rolü değiştirilemez.', true);
                return;
            }
            toggleCaptainStatus(li, name);
        };

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-player';
        removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        if (isDev) {
            removeBtn.title = 'Geliştirici Kaldırılamaz';
        } else {
            removeBtn.title = 'Oyuncuyu Kaldır';
        }
        removeBtn.onclick = function(e) {
            e.stopPropagation();
            if (isDev) {
                showToast('🛡️ MeH4n sistem geliştiricisidir; sistemden kaldırılamaz.', true);
                return;
            }
            if (li.classList.contains('is-captain') || isCaptain(name)) {
                captainSet.delete(name.trim().toLowerCase());
                saveCaptainsState();
            }
            playerRoles.delete(name.trim().toLowerCase());
            li.remove();
            updatePoolCount();
            updateCaptainDisplay();
            const isTournament = gameModeSelect && gameModeSelect.value === 'tournament';
            const maxSize = parseInt(teamSizeSelect.value);
            document.querySelectorAll('.team-list').forEach(list => {
                const teamBox = list.closest('.team-box') || list.closest('.bracket-team-slot');
                if (teamBox) {
                    const countBadge = teamBox.querySelector('.team-count');
                    if (countBadge) {
                        countBadge.textContent = isTournament
                            ? `${list.children.length}/${maxSize}`
                            : list.children.length;
                    }
                    if (list.children.length < maxSize) {
                        teamBox.classList.remove('full');
                    }
                }
            });
        };

        actionsWrap.appendChild(toggleCapBtn);
        actionsWrap.appendChild(removeBtn);

        // Oyuncuya tıklanınca istatistik kartı aç
        li.addEventListener('click', (e) => {
            if (e.target.closest('.player-item-actions') || e.target.closest('.remove-player') || e.target.closest('.toggle-captain-btn')) return;
            showPlayerStatCard(name, li);
        });

        li.appendChild(avatarEl);
        li.appendChild(infoWrap);
        li.appendChild(actionsWrap);

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

    function addPlayerToPool(name, avatarUrl = null) {
        if (!name || !name.trim()) return false;
        const cleanName = name.trim();

        if (isPlayerInSystem(cleanName)) return false;

        if (avatarUrl) {
            setCachedAvatar(cleanName, avatarUrl);
        }

        // Oyuncu kaydını garanti et ve kaydet
        getPlayerStats(cleanName);
        saveChannelStats();

        const playerEl = createPlayerElement(cleanName, avatarUrl);
        playerPool.appendChild(playerEl);
        updatePoolCount();
        playUiSfx('join');
        if (typeof obsSyncChannel !== 'undefined') obsSyncChannel.postMessage({ type: 'new_player', name: cleanName });
        setTimeout(() => {
            obsSyncChannel.postMessage({ type: 'request_state' });
        }, 500);
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
                    // Bracket slot veya team-box parent'ını doğru bul
                    const tSlot = tl.closest('.bracket-team-slot') || tl.closest('.team-box') || tl.parentElement;
                    // Turnuva bracket'ında .slot-name-input, tek maç modunda düz input
                    const tInput = tSlot ? (tSlot.querySelector('.slot-name-input') || tSlot.querySelector('input[type="text"]')) : null;
                    const tTitle = tInput ? tInput.value.trim() : `Takım ${tNum}`;
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

        renderMatchStatsTable();
        matchModal.classList.remove('hidden');
    }

    function renderMatchStatsTable() {
        const tbody = document.getElementById('matchStatsEntryBody');
        if (!tbody || !pendingMatch) return;
        
        tbody.innerHTML = '';
        
        const isSingle = gameModeSelect.value === 'single';
        let loserPlayers = [];
        
        if (isSingle) {
            loserPlayers = pendingMatch.loserPlayers || [];
        } else {
            const selectedOpt = matchLoserSelect.selectedOptions[0];
            if (selectedOpt) {
                loserPlayers = JSON.parse(selectedOpt.dataset.players || '[]');
            }
        }
        
        const allPlayers = [
            ...pendingMatch.winnerPlayers.map(p => ({ name: p, type: 'W' })),
            ...loserPlayers.map(p => ({ name: p, type: 'L' }))
        ];
        
        allPlayers.forEach(p => {
            const tr = document.createElement('tr');
            const cleanName = p.name.replace(/"/g, '&quot;');
            const typeBadge = p.type === 'W' 
                ? '<span class="stat-val green" title="Kazanan Takım" style="font-size:11px; margin-left:4px; font-weight:800;">(W)</span>' 
                : '<span class="stat-val red" title="Kaybeden Takım" style="font-size:11px; margin-left:4px; font-weight:800;">(L)</span>';
            
            const pKey = p.name.trim().toLowerCase();
            const liveG = (typeof liveMatchScores !== 'undefined' && liveMatchScores[pKey]?.goals) ? liveMatchScores[pKey].goals : 0;
            const liveA = (typeof liveMatchScores !== 'undefined' && liveMatchScores[pKey]?.assists) ? liveMatchScores[pKey].assists : 0;

            tr.innerHTML = `
                <td><strong>${p.name}</strong> ${typeBadge}</td>
                <td class="th-center">
                    <div class="quick-step-wrap">
                        <button type="button" class="quick-step-btn minus" title="1 Gol Azalt"><i class="fa-solid fa-minus"></i></button>
                        <input type="number" min="0" max="99" value="${liveG}" class="stat-input stat-goal" data-player="${cleanName}" />
                        <button type="button" class="quick-step-btn plus" title="1 Gol Ekle"><i class="fa-solid fa-plus"></i></button>
                    </div>
                </td>
                <td class="th-center">
                    <div class="quick-step-wrap">
                        <button type="button" class="quick-step-btn minus" title="1 Pas/Asist Azalt"><i class="fa-solid fa-minus"></i></button>
                        <input type="number" min="0" max="99" value="${liveA}" class="stat-input stat-pass" data-player="${cleanName}" />
                        <button type="button" class="quick-step-btn plus" title="1 Pas/Asist Ekle"><i class="fa-solid fa-plus"></i></button>
                    </div>
                </td>
                <td class="th-center">
                    <div class="quick-step-wrap">
                        <button type="button" class="quick-step-btn minus" title="1 Kurtarış Azalt"><i class="fa-solid fa-minus"></i></button>
                        <input type="number" min="0" max="99" value="0" class="stat-input stat-save" data-player="${cleanName}" />
                        <button type="button" class="quick-step-btn plus" title="1 Kurtarış Ekle"><i class="fa-solid fa-plus"></i></button>
                    </div>
                </td>
            `;

            tr.querySelectorAll('.quick-step-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const wrap = btn.closest('.quick-step-wrap');
                    if (!wrap) return;
                    const inp = wrap.querySelector('.stat-input');
                    if (!inp) return;
                    let val = parseInt(inp.value || '0', 10);
                    if (btn.classList.contains('plus')) {
                        val = Math.min(99, val + 1);
                    } else {
                        val = Math.max(0, val - 1);
                    }
                    inp.value = val;
                    playUiSfx('click');
                };
            });

            tbody.appendChild(tr);
        });
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

        // Apply stats from inputs and collect for Hub
        const playerUpdates = [];
        const handledMap = {};

        const tbody = document.getElementById('matchStatsEntryBody');
        if (tbody) {
            const rows = Array.from(tbody.querySelectorAll('tr'));
            rows.forEach(tr => {
                const goalInput = tr.querySelector('.stat-goal');
                const passInput = tr.querySelector('.stat-pass');
                const saveInput = tr.querySelector('.stat-save');
                
                if (goalInput) {
                    const pName = goalInput.dataset.player;
                    const key = pName.trim().toLowerCase();
                    const g = parseInt(goalInput.value || 0);
                    const a = parseInt(passInput.value || 0);
                    const s = parseInt(saveInput.value || 0);
                    const isWin = pendingMatch.winnerPlayers.some(w => w.trim().toLowerCase() === key);

                    if (!channelStats[key]) {
                        channelStats[key] = { wins: 0, losses: 0, goals: 0, assists: 0, saves: 0, streak: 0, mvpCount: 0, displayName: pName.trim() };
                    }
                    channelStats[key].goals = (channelStats[key].goals || 0) + g;
                    channelStats[key].assists = (channelStats[key].assists || 0) + a;
                    channelStats[key].saves = (channelStats[key].saves || 0) + s;

                    playerUpdates.push({
                        name: pName.trim(),
                        goals: g,
                        assists: a,
                        saves: s,
                        win: isWin
                    });
                    handledMap[key] = true;
                }
            });
        }

        // MVP Hesabı: (goals * 2) + assists
        let matchMvpName = null;
        let highestMvpScore = 0;

        playerUpdates.forEach(pu => {
            const mvpScore = (pu.goals * 2) + pu.assists;
            if (mvpScore > highestMvpScore) {
                highestMvpScore = mvpScore;
                matchMvpName = pu.name;
            }
        });

        if (matchMvpName && highestMvpScore > 0) {
            const mvpKey = matchMvpName.trim().toLowerCase();
            if (channelStats[mvpKey]) {
                channelStats[mvpKey].mvpCount = (channelStats[mvpKey].mvpCount || 0) + 1;
            }
            playerUpdates.forEach(pu => {
                if (pu.name.trim().toLowerCase() === mvpKey) {
                    pu.isMvp = true;
                }
            });
            showToast(`👑 MAÇIN MVP'Sİ: ${matchMvpName} (${highestMvpScore} MVP Puanı)!`, false);
            if (typeof triggerConfettiCelebration === 'function') triggerConfettiCelebration();
        }

        // Galip oyunculara +1 W ve streak +1
        pendingMatch.winnerPlayers.forEach(name => {
            const key = name.trim().toLowerCase();
            if (!channelStats[key]) {
                channelStats[key] = { wins: 0, losses: 0, goals: 0, assists: 0, saves: 0, streak: 0, mvpCount: 0, displayName: name.trim() };
            }
            channelStats[key].wins += 1;
            channelStats[key].streak = (channelStats[key].streak || 0) + 1;

            if (!handledMap[key]) {
                playerUpdates.push({ name: name.trim(), goals: 0, assists: 0, saves: 0, win: true });
                handledMap[key] = true;
            }
        });

        // Mağlup oyunculara +1 L ve streak 0
        loserPlayers.forEach(name => {
            const key = name.trim().toLowerCase();
            if (!channelStats[key]) {
                channelStats[key] = { wins: 0, losses: 0, goals: 0, assists: 0, saves: 0, streak: 0, mvpCount: 0, displayName: name.trim() };
            }
            channelStats[key].losses += 1;
            channelStats[key].streak = 0;

            if (!handledMap[key]) {
                playerUpdates.push({ name: name.trim(), goals: 0, assists: 0, saves: 0, win: false });
                handledMap[key] = true;
            }
        });

        // Canlı skor panelini temizle
        if (typeof liveMatchScores !== 'undefined') {
            liveMatchScores = {};
            if (typeof updateLiveScoreTotals === 'function') updateLiveScoreTotals();
        }

        saveChannelStats();
        refreshAllPlayerElements();
        renderLeaderboard();

        // Hub'a ilet
        if (typeof HubClient !== 'undefined' && HubClient.isConnected) {
            HubClient.submitMatchResult({
                streamer: currentChannel || 'Yayıncı',
                channel: currentChannel || 'genel',
                winnerTitle: pendingMatch.winnerTitle,
                winnerPlayers: pendingMatch.winnerPlayers,
                loserTitle: loserTitle,
                loserPlayers: loserPlayers,
                playerUpdates: playerUpdates
            });
        }

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
                goals: s.goals || 0,
                assists: s.assists || 0,
                saves: s.saves || 0,
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
            } else if (sortBy === 'goals') {
                if (b.goals !== a.goals) return b.goals - a.goals;
                return b.winRate - a.winRate;
            } else if (sortBy === 'assists') {
                if (b.assists !== a.assists) return b.assists - a.assists;
                return b.winRate - a.winRate;
            } else if (sortBy === 'saves') {
                if (b.saves !== a.saves) return b.saves - a.saves;
                return b.winRate - a.winRate;
            }
            return 0;
        });

        const maxGoals = playerList.length > 0 ? Math.max(...playerList.map(p => p.goals)) : 0;

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

            const isGolKrali = player.goals === maxGoals && maxGoals > 0;
            const golKraliHtml = isGolKrali ? ' <span title="Gol Kralı" style="color: gold; margin-left: 5px;"><i class="fa-solid fa-crown"></i></span>' : '';

            const pKey = player.name.trim().toLowerCase();
            const pStat = channelStats[pKey] || {};
            const pStreak = pStat.streak || 0;
            const pMvp = pStat.mvpCount || 0;
            const streakHtml = pStreak >= 3 ? ` <span class="win-streak-badge" title="${pStreak} Maçlık Galibiyet Serisi!"><i class="fa-solid fa-fire live-flame"></i> ${pStreak}W</span>` : '';
            const mvpHtml = pMvp > 0 ? ` <span class="mvp-crown-badge" title="${pMvp} Kez Maçın MVP'si!"><i class="fa-solid fa-crown" style="color:#ffd700;"></i> MVP x${pMvp}</span>` : '';
            const devHtml = pKey === 'meh4n' ? ` <span class="role-dev" title="Sistem Geliştiricisi"><i class="fa-solid fa-code"></i> DEV</span>` : '';

            tr.innerHTML = `
                <td class="th-rank">${posHtml}</td>
                <td class="player-col">${player.name}${golKraliHtml}${streakHtml}${mvpHtml}${devHtml} ${getTournamentBadgeHtml(channelStats[pKey])}</td>
                <td>
                    <span class="player-rank-chip ${player.rank.className}">
                        <i class="${player.rank.icon}"></i> ${player.rank.title}
                    </span>
                </td>
                <td class="th-center font-bold" style="color: #00e6e6;">${player.goals}</td>
                <td class="th-center font-bold" style="color: #55c2ff;">${player.assists}</td>
                <td class="th-center font-bold" style="color: #b3b3b3;">${player.saves}</td>
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
                <td class="th-center">
                    <button type="button" class="btn-table-edit" title="${player.name} istatistiklerini düzenle" data-player="${player.name}">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                </td>
            `;

            const editBtn = tr.querySelector('.btn-table-edit');
            if (editBtn) {
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    showPlayerStatCard(player.name, editBtn);
                };
            }

            leaderboardTbody.appendChild(tr);
        });
    }

    function addManualPlayer() {
        const name = manualNameInput.value.trim();
        if (name) {
            if (addPlayerToPool(name)) {
                manualNameInput.value = '';
                // Arka planda Kick profil fotoğrafını getirmeyi dene
                fetchUserAvatar(name);
            } else {
                showToast('Bu oyuncu zaten ekli!', true);
            }
        }
    }

    function clearAllPlayers() {
        if (confirm('Tüm izleyicileri havuzdan ve takımlardan silmek istediğinize emin misiniz?')) {
            // MeH4n geliştirici koruması: MeH4n sisteme katılmışsa rolü ve kaptanlığıyla korunur
            const devEl = document.querySelector('.player-item.is-developer, .player-item[data-name="MeH4n" i]');
            const devRole = playerRoles.get('meh4n');
            const devIsCaptain = captainSet.has('meh4n');

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
            captainSet.clear();
            playerRoles.clear();

            if (devEl) {
                // MeH4n'i koruyarak havuza geri yerleştir
                const preservedDev = createPlayerElement('MeH4n');
                if (devRole) {
                    playerRoles.set('meh4n', devRole);
                    setPlayerRole(preservedDev, devRole);
                }
                if (devIsCaptain) {
                    captainSet.add('meh4n');
                    preservedDev.classList.add('is-captain');
                    preservedDev.dataset.isCaptain = "true";
                }
                playerPool.appendChild(preservedDev);
            }

            savePlayerRolesState();
            endDraftTurnMode(false);
            saveCaptainsState();
            updateCaptainDisplay();
            updatePoolCount();
            if (devEl) {
                showToast('İzleyiciler temizlendi (🛡️ Sistem Geliştiricisi MeH4n korundu).');
            } else {
                showToast('Tüm izleyiciler sıfırlandı ve silindi.');
            }
        }
    }

    function randomizePlayers() {
        const allPlayers = Array.from(playerPool.children);
        if (allPlayers.length === 0) {
            showToast('Havuzda dağıtılacak oyuncu yok!', true);
            return;
        }

        const isTournament = gameModeSelect && gameModeSelect.value === 'tournament';
        const teams = document.querySelectorAll(isTournament ? 'ul.team-list:not(.progress-team-list)' : '.team-box .team-list');
        const maxSize = parseInt(teamSizeSelect.value);
        
        // Karıştır
        for (let i = allPlayers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allPlayers[i], allPlayers[j]] = [allPlayers[j], allPlayers[i]];
        }

        let playerIndex = 0;
        let distributed = 0;

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

    // =========================================================================
    // 📡 KICK ÇOKLU YAYINCI (MULTI-CHANNEL) VE SOHBET DİNLEME SİSTEMİ
    // =========================================================================

    function initPusherClient() {
        if (pusher) return pusher;
        if (typeof Pusher === 'undefined') {
            if (connectionStatus) {
                connectionStatus.textContent = 'Pusher Yok';
                connectionStatus.className = 'status disconnected';
            }
            showToast('Pusher kütüphanesi yüklenemedi. İnternet bağlantınızı kontrol edin.', true);
            return null;
        }

        try {
            pusher = new Pusher('32cbd69e4b950bf97679', {
                cluster: 'us2',
                forceTLS: true,
                wsHost: 'ws-us2.pusher.com',
                wsPort: 443,
                wssPort: 443,
                enabledTransports: ['ws', 'wss', 'xhr_streaming', 'xhr_polling']
            });

            pusher.connection.bind('connected', () => {
                updateActiveChannelsUI();
            });

            pusher.connection.bind('connecting', () => {
                if (connectionStatus && activeChannels.size === 0) {
                    connectionStatus.textContent = 'Bağlanıyor...';
                    connectionStatus.className = 'status disconnected';
                }
            });

            pusher.connection.bind('disconnected', () => {
                if (activeChannels.size === 0 && connectionStatus) {
                    connectionStatus.textContent = 'Bağlantı Kesildi';
                    connectionStatus.className = 'status disconnected';
                }
            });

            pusher.connection.bind('error', (err) => {
                console.error('Pusher ağ hatası:', err);
            });

            return pusher;
        } catch(err) {
            console.error('Pusher oluşturulamadı:', err);
            return null;
        }
    }

    function subscribeToKickChannel(chatroomId, channelName = '') {
        const client = initPusherClient();
        if (!client) return;

        const clean = sanitizeChannelInput(channelName || chatroomId.toString());
        if (activeChannels.has(clean)) {
            showToast(`ℹ️ "${clean}" zaten bağlı.`);
            return;
        }

        const subChannelName = `chatrooms.${chatroomId}.v2`;
        const channelSub = client.subscribe(subChannelName);

        channelSub.bind('pusher:subscription_succeeded', () => {
            const displayName = channelName || clean;
            showToast(`🟢 ${displayName.toUpperCase()} sohbetine bağlandı!`);
            updateActiveChannelsUI();
        });

        channelSub.bind('pusher:subscription_error', (status) => {
            console.error(`${channelName} abonelik hatası:`, status);
            showToast(`⚠️ ${channelName || clean} odasına (${chatroomId}) bağlanılamadı!`, true);
        });

        channelSub.bind('App\\Events\\ChatMessageEvent', function(data) {
            handleKickChatMessage(data, clean);
        });

        activeChannels.set(clean, {
            id: chatroomId,
            channel: channelName || clean,
            subChannelName: subChannelName,
            subscription: channelSub
        });

        localStorage.setItem(`kick_chatroom_${clean}`, chatroomId.toString());
        updateActiveChannelsUI();

        // theonlyk1ng kanalı bağlandığında arka plan ve temayı otomatik yansıt
        if (clean === 'theonlyk1ng' || (channelName && channelName.toLowerCase() === 'theonlyk1ng')) {
            switchChannel('theonlyk1ng');
        }
    }

    function disconnectKickChannel(channelName) {
        const clean = sanitizeChannelInput(channelName);
        const entry = activeChannels.get(clean);
        if (!entry) return;

        if (pusher && entry.subChannelName) {
            try {
                pusher.unsubscribe(entry.subChannelName);
            } catch (e) {}
        }
        activeChannels.delete(clean);
        showToast(`🔴 ${clean.toUpperCase()} sohbet bağlantısı kesildi.`);
        updateActiveChannelsUI();

        // theonlyk1ng bağlantısı kesildiğinde varsayılan temaya dön
        if (clean === 'theonlyk1ng' && currentChannel.toLowerCase() === 'theonlyk1ng') {
            switchChannel('genel');
        }

        if (activeChannels.size === 0 && pusher) {
            try {
                pusher.disconnect();
                pusher = null;
            } catch(e) {}
        }
    }

    function updateActiveChannelsUI() {
        const container = document.getElementById('activeChannelsContainer');
        if (!container) return;

        if (activeChannels.size === 0) {
            container.innerHTML = '';
            container.classList.add('hidden');
            if (connectionStatus) {
                connectionStatus.innerHTML = '<i class="fa-solid fa-circle"></i> <span>Bağlı Değil</span>';
                connectionStatus.className = 'status disconnected';
            }
            return;
        }

        container.classList.remove('hidden');
        container.innerHTML = '';

        activeChannels.forEach((item, chKey) => {
            const chip = document.createElement('div');
            chip.className = 'active-channel-chip';
            chip.innerHTML = `
                <i class="fa-brands fa-kickstarter"></i>
                <span>${item.channel}</span>
                <button type="button" class="remove-channel-btn" title="${item.channel} sohbetini kes">&times;</button>
            `;
            const removeBtn = chip.querySelector('.remove-channel-btn');
            if (removeBtn) {
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    disconnectKickChannel(chKey);
                };
            }
            container.appendChild(chip);
        });

        if (connectionStatus) {
            const count = activeChannels.size;
            if (count === 1) {
                const first = Array.from(activeChannels.values())[0];
                connectionStatus.innerHTML = `<i class="fa-solid fa-circle"></i> <span>${first.channel} (Canlı)</span>`;
            } else {
                connectionStatus.innerHTML = `<i class="fa-solid fa-circle"></i> <span>${count} Yayıncı Canlı</span>`;
            }
            connectionStatus.className = 'status connected';
        }
    }

    function setupPusher(chatroomId, channelName = '') {
        subscribeToKickChannel(chatroomId, channelName);
    }

    async function connectToKick() {
        const raw = channelNameInput ? channelNameInput.value.trim() : '';
        if (!raw && activeChannels.size === 0) {
            showToast('Lütfen bir Kick kanal adı veya Sohbet ID girin! (Birden çok kanal için virgülle ayırabilirsiniz: wtcn, elraenn)', true);
            return;
        }

        // Çoklu kanal desteği: virgül, noktalı virgül veya boşluk ile ayrılan tüm kanalları topla
        const rawTokens = raw.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);

        if (rawTokens.length === 0 && activeChannels.size > 0) {
            showToast('Mevcut bağlı kanallar aktif olarak dinleniyor.');
            return;
        }

        connectBtn.disabled = true;
        connectBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Bağlanıyor...';
        if (connectionStatus && activeChannels.size === 0) {
            connectionStatus.textContent = 'Aranıyor...';
            connectionStatus.className = 'status disconnected';
        }

        let connectedCount = 0;
        let failedChannels = [];

        try {
            for (const token of rawTokens) {
                const clean = sanitizeChannelInput(token);
                if (!clean) continue;

                if (activeChannels.has(clean)) {
                    showToast(`ℹ️ "${clean}" zaten bağlı.`);
                    continue;
                }

                const resolved = await resolveKickChatroomId(token);
                if (resolved && resolved.id) {
                    subscribeToKickChannel(resolved.id, resolved.channel);
                    connectedCount++;
                } else {
                    failedChannels.push(clean);
                }
            }

            if (connectedCount > 0) {
                if (channelNameInput) channelNameInput.value = '';
                showToast(`🟢 ${connectedCount} yayıncı sohbetine başarıyla bağlanıldı!`);
            }

            if (failedChannels.length > 0) {
                showToast(`⚠️ Bazı kanalların Sohbet ID'si otomatik bulunamadı: ${failedChannels.join(', ')}`, true);
                if (activeChannels.size === 0) {
                    openKickModal(failedChannels[0]);
                }
            }

        } catch (error) {
            console.error('Kick bağlantı hatası:', error);
            showToast('Bağlantı hatası: ' + (error.message || 'Bilinmeyen hata'), true);
        } finally {
            connectBtn.disabled = false;
            connectBtn.innerHTML = '<i class="fa-solid fa-plug"></i> <span>Chat\'e Bağlan</span>';
            updateActiveChannelsUI();
        }
    }

    function handleKickChatMessage(data, sourceChannel = '') {
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

        // Kick Pusher profil fotoğrafı kontrolü
        const pusherAvatar = sender.profile_picture || sender.profilepic || sender.profile_thumb || (sender.identity && sender.identity.profile_picture) || null;
        if (pusherAvatar) {
            setCachedAvatar(username, pusherAvatar);
        }

        // Mesaj içeriğini tespit et (Kick Pusher content veya message alanı)
        const rawContent = (msgData.content || msgData.message || msgData.text || '').trim();
        if (!rawContent) return;

        // Türkçe i/ı normalizasyonu ve küçük harfe çevirme
        const turkishNormContent = rawContent.replace(/ı/g, 'i').replace(/İ/g, 'i').toLowerCase();
        const firstToken = turkishNormContent.split(/\s+/)[0];

        // 👑 1. Kaptanlık Komutu Kontrolü (!kingkaptan / !KİngKAPTAN / !kingcaptain)
        if (firstToken === '!kingkaptan' || firstToken === '!kingcaptain') {
            handleCaptainCommand(username, pusherAvatar);
            if (!pusherAvatar) {
                fetchUserAvatar(username);
            }
            return;
        }

        // 👑 2. Kaptan Oyuncu ve Rol Seçme (Draft / Pick) Sistemi (!sec @oyuncu GK / CB / RM / LM vb.)
        if (isCaptain(username)) {
            const draftInfo = extractDraftTarget(rawContent);
            if (draftInfo && draftInfo.target) {
                // Eğer sıralı seçim modu aktifse: Sadece sırası gelen kaptan seçim yapabilir
                if (draftModeActive && currentDraftOrder && currentDraftOrder.length > 0) {
                    const activeCap = currentDraftOrder[currentDraftIndex];
                    const cleanSender = username.trim().toLowerCase().replace(/ı/g, 'i').replace(/İ/g, 'i');
                    const cleanActive = activeCap ? activeCap.name.trim().toLowerCase().replace(/ı/g, 'i').replace(/İ/g, 'i') : '';
                    if (cleanSender !== cleanActive) {
                        showToast(`⏳ Sıra Kaptan ${activeCap ? activeCap.name : '...'}'de! Lütfen sıranızı bekleyin.`, true);
                        return;
                    }
                }

                const captainTeamList = findCaptainTeamList(username);
                if (!captainTeamList) {
                    showToast(`⚠️ Kaptan ${username} henüz bir takıma yerleşmediği için oyuncu seçemez!`, true);
                } else {
                    const picked = executeCaptainPick(username, draftInfo, captainTeamList);
                    if (picked && draftModeActive) {
                        advanceDraftTurn();
                    }
                }
                return;
            }
        }

        // 🎮 3. Aktif normal katılım komutu kontrolü (örn: !kingsc)
        const activeCmd = (currentJoinCommand || '!kingsc').trim().toLowerCase().replace(/ı/g, 'i').replace(/İ/g, 'i');

        if (firstToken === activeCmd) {
            const added = addPlayerToPool(username, pusherAvatar);
            if (added) {
                showToast(`🎮 ${username} havuza eklendi! (${activeCmd})`);
                if (!pusherAvatar) {
                    fetchUserAvatar(username);
                }
            }
            return;
        }

        // ⚽⚡ 4. Canlı Gol ve Boost/Asist Komutları (/goal, /boost, /gol, /asist)
        const isGoalCmd = ['/goal', '!goal', '/gol', '!gol'].includes(firstToken);
        const isBoostCmd = ['/boost', '!boost', '/asist', '!asist'].includes(firstToken);

        if (isGoalCmd || isBoostCmd) {
            if (!isWatcherActive) {
                return;
            }

            const tokens = rawContent.split(/\s+/);
            let targetUser = '';
            if (tokens.length > 1) {
                targetUser = tokens[1].replace(/^@/, '').trim();
            }
            if (!targetUser) {
                targetUser = username;
            }

            const targetKey = targetUser.trim().toLowerCase();

            // Takımlarda veya canlı skor tablosunda eşleşen oyuncuyu bul
            let matchedName = null;
            if (typeof liveMatchScores !== 'undefined' && liveMatchScores[targetKey]) {
                matchedName = targetUser;
            } else {
                const teamPlayers = document.querySelectorAll('.team-list .player-item');
                for (const pel of teamPlayers) {
                    const pName = pel.dataset.name || '';
                    if (pName.trim().toLowerCase() === targetKey) {
                        matchedName = pName;
                        break;
                    }
                }
            }

            if (matchedName) {
                const cleanKey = matchedName.trim().toLowerCase();
                if (!liveMatchScores[cleanKey]) {
                    liveMatchScores[cleanKey] = { goals: 0, assists: 0, team: 1 };
                }

                if (isGoalCmd) {
                    liveMatchScores[cleanKey].goals = (liveMatchScores[cleanKey].goals || 0) + 1;
                    showToast(`⚽ [Kick Chat] ${matchedName} gol attı! (${liveMatchScores[cleanKey].goals} Gol)`, false);
                    playUiSfx('join');
                } else {
                    liveMatchScores[cleanKey].assists = (liveMatchScores[cleanKey].assists || 0) + 1;
                    showToast(`⚡ [Kick Chat] ${matchedName} asist/boost yaptı! (${liveMatchScores[cleanKey].assists} Asist)`, false);
                    playUiSfx('click');
                }

                renderLiveScorePanel();
                updateTeamPowerBar();

                try {
                    const origin = (window.location.origin && window.location.origin.includes('http')) ? window.location.origin : 'http://localhost:18888';
                    fetch(`${origin}/api/watcher/score`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            player: matchedName,
                            type: isGoalCmd ? 'goal' : 'assist',
                            count: 1
                        })
                    }).catch(() => {});
                } catch(e) {}
                return;
            }
        }
    }

    function openKickModal(channel) {
        if (typeof closeSettingsDrawer === 'function') closeSettingsDrawer();
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

    // =========================================================================
    // 🎊 1. KONFETİ ANİMASYONU (Canvas Tabanlı)
    // =========================================================================
    function triggerConfettiCelebration() {
        const canvas = document.getElementById('confettiCanvas');
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.display = 'block';

        const ctx = canvas.getContext('2d');
        const colors = ['#FFD700', '#00e6e6', '#ff4da6', '#7fff00', '#ff6b35', '#9b59b6', '#3498db'];
        const pieces = [];
        const count = 180;

        for (let i = 0; i < count; i++) {
            pieces.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                w: Math.random() * 12 + 6,
                h: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                vy: Math.random() * 3 + 2,
                vx: (Math.random() - 0.5) * 2,
                rotation: Math.random() * 360,
                rotSpeed: (Math.random() - 0.5) * 6,
                opacity: 1
            });
        }

        let frame = 0;
        const maxFrames = 240;

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            pieces.forEach(p => {
                ctx.save();
                ctx.globalAlpha = p.opacity;
                ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
                ctx.rotate(p.rotation * Math.PI / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
                p.y += p.vy;
                p.x += p.vx;
                p.rotation += p.rotSpeed;
                if (frame > maxFrames * 0.6) {
                    p.opacity = Math.max(0, p.opacity - 0.015);
                }
            });
            frame++;
            if (frame < maxFrames) {
                requestAnimationFrame(draw);
            } else {
                canvas.style.display = 'none';
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
        draw();
    }

    // =========================================================================
    // 🏅 2. TURNUVA ROZETİ / UNVAN SİSTEMİ
    // =========================================================================
    function awardTournamentBadges(champName, champPlayers, runnerUpName, runnerUpPlayers) {
        // SF kaybedenlerini bul
        const sfLoserPlayers = [];
        ['m_sf_1', 'm_sf_2'].forEach(sfId => {
            const sfMatch = tournamentMatches ? tournamentMatches[sfId] : null;
            if (sfMatch && sfMatch.winner) {
                const loserSlot = sfMatch.winner === 'teamA' ? 'teamB' : 'teamA';
                const loserTeam = sfMatch[loserSlot];
                if (loserTeam && loserTeam.players) {
                    sfLoserPlayers.push(...loserTeam.players);
                }
            }
        });

        const stamp = new Date().toISOString().slice(0,10);

        function setBadge(players, badge) {
            players.forEach(name => {
                const key = name.trim().toLowerCase();
                if (!channelStats[key]) channelStats[key] = { wins: 0, losses: 0, displayName: name.trim() };
                channelStats[key].tournamentBadge = badge;
                channelStats[key].tournamentDate = stamp;
            });
        }

        setBadge(champPlayers, 'champion');
        setBadge(runnerUpPlayers, 'runner-up');
        setBadge(sfLoserPlayers, 'semifinalist');

        saveChannelStats();
        refreshAllPlayerElements();
        renderLeaderboard();
    }

    function getTournamentBadgeHtml(stat) {
        if (!stat || !stat.tournamentBadge) return '';
        const map = {
            'champion':    '<span class="t-badge t-badge-champ" title="Turnuva Şampiyonu">🥇 Şampiyon</span>',
            'runner-up':   '<span class="t-badge t-badge-runner" title="Finalist">🥈 Finalist</span>',
            'semifinalist':'<span class="t-badge t-badge-semi" title="Yarı Finalist">🥉 YF</span>'
        };
        return map[stat.tournamentBadge] || '';
    }

    // =========================================================================
    // 📊 3. TURNUVA SKOR TABLOSU
    // =========================================================================
    function showTournamentScoreboard() {
        const modal = document.getElementById('tournamentScoreModal');
        const tbody = document.getElementById('scoreTableBody');
        if (!modal || !tbody || !tournamentMatches) return;

        const roundLabel = {
            'r8': '1. Tur', 'r16': '1. Tur',
            'sf': 'Yarı Final', 'final': 'Büyük Final'
        };

        // Tüm maçlardan takım sonuçlarını topla
        const teamResults = {};

        Object.values(tournamentMatches).forEach(match => {
            ['teamA', 'teamB'].forEach(slot => {
                const team = match[slot];
                if (!team || !team.name) return;
                const key = team.name;
                if (!teamResults[key]) {
                    teamResults[key] = { name: team.name, wins: 0, losses: 0, lastRound: match.round };
                }
                if (match.winner) {
                    if (match.winner === slot) {
                        teamResults[key].wins++;
                        teamResults[key].lastRound = match.round;
                    } else {
                        teamResults[key].losses++;
                    }
                }
            });
        });

        const sorted = Object.values(teamResults).sort((a, b) => b.wins - a.wins || a.losses - b.losses);

        tbody.innerHTML = '';
        sorted.forEach((t, i) => {
            const label = i === 0 ? '🥇 Şampiyon' : i === 1 ? '🥈 Finalist' : (roundLabel[t.lastRound] || '-');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="pos-${i < 3 ? i+1 : 'default'} pos-badge">${i+1}</span></td>
                <td style="font-weight:600">${t.name}</td>
                <td>${label}</td>
                <td class="th-center" style="color:#00ff00;font-weight:bold">${t.wins}</td>
                <td class="th-center" style="color:#ff4d4d;font-weight:bold">${t.losses}</td>
            `;
            tbody.appendChild(tr);
        });

        modal.classList.remove('hidden');

        const close = () => modal.classList.add('hidden');
        document.getElementById('closeScoreModalBtn').onclick = close;
        document.getElementById('closeScoreModalFooterBtn').onclick = close;
        modal.onclick = e => { if (e.target === modal) close(); };
    }

    // =========================================================================
    // 💀 4. LOSERS BRACKET (3. Yer Playoff)
    // =========================================================================
    let losersMatches = null;

    function getInitialLosersMatches() {
        return {
            'l_sf': {
                id: 'l_sf', round: 'l_sf', name: '3. Yer Yarı Final', wing: 'losers',
                nextMatchId: 'l_final', nextSlot: null,
                sourceA: 'YF 1 Kaybedeni', sourceB: 'YF 2 Kaybedeni',
                teamA: null, teamB: null, winner: null
            },
            'l_final': {
                id: 'l_final', round: 'l_final', name: '3. Yer Finali', wing: 'losers',
                nextMatchId: null, nextSlot: null,
                sourceA: 'L-YF Galibi', sourceB: 'L-YF Kaybedeni',
                teamA: null, teamB: null, winner: null
            }
        };
    }

    function buildLosersPanel() {
        const existing = document.getElementById('losersBracketPanel');
        if (existing) existing.remove();

        if (!losersMatches) losersMatches = getInitialLosersMatches();

        const panel = document.createElement('div');
        panel.id = 'losersBracketPanel';
        panel.className = 'losers-bracket-panel losers-bracket-container'; // Added container class for style wrapper

        const header = document.createElement('div');
        header.className = 'losers-header';
        header.innerHTML = `<span><i class="fa-solid fa-skull"></i> Kaybedenler Braketi</span> <span class="losers-sub">3. Yer Playoff</span>`;
        
        const obsBtn = document.createElement('button');
        obsBtn.className = 'obs-focus-btn';
        obsBtn.innerHTML = "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='3'></circle><path d='M3 12h4m10 0h4M12 3v4m0 10v4M4.9 4.9l2.8 2.8m8.6 8.6l2.8 2.8M4.9 19.1l2.8-2.8m8.6-8.6l2.8-2.8'></path></svg>";
        obsBtn.title = 'OBS\'te sadece bu ağacı göster';
        obsBtn.style.color = '#ff4d4d'; // Match red theme
        obsBtn.onclick = (e) => {
            e.stopPropagation();
            const isFocused = panel.classList.contains('obs-focused');
            document.querySelectorAll('.obs-focused').forEach(el => el.classList.remove('obs-focused'));
            if (!isFocused) panel.classList.add('obs-focused');
            const tc = document.getElementById('teamsContainer');
            if(tc) tc.setAttribute('data-last-focus', Date.now());
        };
        header.querySelector('span').appendChild(obsBtn);
        
        panel.appendChild(header);

        const matchWrap = document.createElement('div');
        matchWrap.className = 'losers-matches';

        Object.values(losersMatches).forEach(match => {
            matchWrap.appendChild(buildLosersMatchCard(match));
        });

        panel.appendChild(matchWrap);

        const bracket = document.getElementById('tournamentBracket');
        if (bracket) {
            bracket.parentElement.appendChild(panel);
        } else {
            const teamsC = document.getElementById('teamsContainer');
            if (teamsC) teamsC.appendChild(panel);
        }
    }

    function buildLosersMatchCard(match) {
        const card = document.createElement('div');
        card.className = 'losers-match-card bracket-match-card'; // Added bracket-match-card for standard obs scaling
        card.dataset.losersMatchId = match.id;

        const badge = document.createElement('div');
        badge.className = 'match-badge';
        badge.style.background = 'rgba(120,0,0,0.5)';
        badge.innerHTML = `<span>${match.name}</span>`;
        
        const obsBtn = document.createElement('button');
        obsBtn.className = 'obs-focus-btn';
        obsBtn.innerHTML = "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='3'></circle><path d='M3 12h4m10 0h4M12 3v4m0 10v4M4.9 4.9l2.8 2.8m8.6 8.6l2.8 2.8M4.9 19.1l2.8-2.8m8.6-8.6l2.8-2.8'></path></svg>";
        obsBtn.title = 'OBS\'te sadece bu maçı göster';
        obsBtn.onclick = (e) => {
            e.stopPropagation();
            const isFocused = card.classList.contains('obs-focused');
            document.querySelectorAll('.obs-focused').forEach(el => el.classList.remove('obs-focused'));
            if (!isFocused) {
                card.classList.add('obs-focused');
            }
            const tc = document.getElementById('teamsContainer');
            if(tc) tc.setAttribute('data-last-focus', Date.now());
        };
        badge.appendChild(obsBtn);
        card.appendChild(badge);

        ['teamA', 'teamB'].forEach((slot, idx) => {
            const teamData = match[slot];
            const isWinner = match.winner === slot;
            const isElim = match.winner && match.winner !== slot;

            const slotEl = document.createElement('div');
            slotEl.className = `bracket-team-slot ${isWinner ? 'slot-winner' : ''} ${isElim ? 'slot-eliminated' : ''}`;
            slotEl.style.borderColor = isWinner ? '#FFD700' : '';

            if (!teamData) {
                slotEl.innerHTML = `<div class="slot-placeholder"><i class="fa-regular fa-clock"></i> ${slot === 'teamA' ? match.sourceA : match.sourceB}</div>`;
            } else {
                const actions = document.createElement('div');
                actions.className = 'slot-actions';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'slot-name-text';
                nameSpan.textContent = teamData.name;
                slotEl.appendChild(nameSpan);

                if (isWinner) {
                    actions.innerHTML = '<span class="slot-winner-tag"><i class="fa-solid fa-trophy"></i> 3. Oldu</span>';
                } else if (isElim) {
                    actions.innerHTML = '<span class="slot-eliminated-tag"><i class="fa-solid fa-xmark"></i> 4. Oldu</span>';
                } else if (match[slot === 'teamA' ? 'teamB' : 'teamA']) {
                    const winBtn = document.createElement('button');
                    winBtn.className = 'slot-win-btn';
                    winBtn.innerHTML = '<i class="fa-solid fa-trophy"></i> Kazandı';
                    winBtn.onclick = () => handleLosersMatchWin(match.id, slot);
                    actions.appendChild(winBtn);
                }
                slotEl.appendChild(actions);
            }

            card.appendChild(slotEl);

            if (idx === 0) {
                const vs = document.createElement('div');
                vs.className = 'match-vs-divider';
                vs.innerHTML = '<span>VS</span>';
                card.appendChild(vs);
            }
        });

        return card;
    }

    function handleLosersMatchWin(matchId, winnerSlot) {
        const match = losersMatches[matchId];
        if (!match || !match.teamA || !match.teamB) return;

        match.winner = winnerSlot;
        const loserSlot = winnerSlot === 'teamA' ? 'teamB' : 'teamA';

        if (matchId === 'l_sf') {
            losersMatches['l_final'].teamA = { ...match[winnerSlot] };
            losersMatches['l_final'].teamB = { ...match[loserSlot] };
        }

        buildLosersPanel();
        showToast(`🥉 ${match[winnerSlot].name} 3. yer için finale çıktı!`);
    }

    function syncLosersFromSF() {
        if (!tournamentMatches || !losersMatches) return;

        ['m_sf_1', 'm_sf_2'].forEach((sfId, idx) => {
            const sfMatch = tournamentMatches[sfId];
            if (!sfMatch || !sfMatch.winner) return;
            const loserSlot = sfMatch.winner === 'teamA' ? 'teamB' : 'teamA';
            const loserTeam = sfMatch[loserSlot];
            if (!loserTeam) return;

            if (idx === 0) {
                losersMatches['l_sf'].teamA = { ...loserTeam };
            } else {
                losersMatches['l_sf'].teamB = { ...loserTeam };
            }
        });

        buildLosersPanel();
    }

    // =========================================================================
    // 🖼️ 5. OYUNCU AVATAR + İSTATİSTİK KARTI
    // =========================================================================
    const AVATAR_COLORS = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63','#00bcd4','#4caf50'];

    function getAvatarColor(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
    }

    function createPlayerAvatar(name, avatarUrl = null) {
        const div = document.createElement('div');
        div.className = 'player-avatar';
        div.style.background = getAvatarColor(name);
        div.title = name;

        const initials = document.createElement('span');
        initials.className = 'avatar-initials';
        initials.textContent = (name || '?').slice(0, 2).toUpperCase();
        div.appendChild(initials);

        const img = document.createElement('img');
        img.className = 'avatar-img';
        img.alt = name;
        img.style.display = 'none';

        const resolvedUrl = avatarUrl || getCachedAvatar(name);

        function applyAvatarSrc(src) {
            if (!src) return;
            img.src = src;
            img.onload = () => {
                img.style.display = 'block';
                initials.style.display = 'none';
            };
            img.onerror = () => {
                img.style.display = 'none';
                initials.style.display = 'block';
            };
        }

        if (resolvedUrl) {
            applyAvatarSrc(resolvedUrl);
        } else {
            // Asenkron olarak sunucudan ve Kick'ten çek
            fetchUserAvatar(name).then(src => {
                if (src) applyAvatarSrc(src);
            });
        }

        div.appendChild(img);
        return div;
    }

    function showPlayerStatCard(name, anchorEl) {
        const card = document.getElementById('playerStatCard');
        if (!card || !name) return;

        const detail = getPlayerStats(name);
        const key = name.trim().toLowerCase();
        if (!channelStats[key]) {
            channelStats[key] = {
                wins: 0,
                losses: 0,
                goals: 0,
                assists: 0,
                saves: 0,
                displayName: name.trim()
            };
        }
        const stat = channelStats[key];

        const avatarCardEl = document.getElementById('statCardAvatar');
        if (avatarCardEl) {
            avatarCardEl.innerHTML = '';
            avatarCardEl.style.background = getAvatarColor(name);

            const statInitials = document.createElement('span');
            statInitials.className = 'stat-avatar-initials';
            statInitials.textContent = (name || '?').slice(0, 2).toUpperCase();
            avatarCardEl.appendChild(statInitials);

            const statImg = document.createElement('img');
            statImg.className = 'stat-avatar-img';
            statImg.alt = name;
            statImg.style.display = 'none';

            const resolvedAvatar = getCachedAvatar(name);
            function applyStatAvatar(src) {
                if (!src) return;
                statImg.src = src;
                statImg.onload = () => {
                    statImg.style.display = 'block';
                    statInitials.style.display = 'none';
                };
                statImg.onerror = () => {
                    statImg.style.display = 'none';
                    statInitials.style.display = 'block';
                };
            }

            if (resolvedAvatar) {
                applyStatAvatar(resolvedAvatar);
            } else {
                fetchUserAvatar(name).then(src => {
                    if (src) applyStatAvatar(src);
                });
            }
            avatarCardEl.appendChild(statImg);
        }

        const nameEl = document.getElementById('statCardName');
        if (nameEl) nameEl.textContent = detail.displayName;

        const rankEl = document.getElementById('statCardRank');
        if (rankEl) {
            rankEl.innerHTML = `<i class="${detail.rank.icon}"></i> ${detail.rank.title}`;
            rankEl.className = `stat-card-rank ${detail.rank.className}`;
        }

        const winsEl = document.getElementById('statCardWins');
        if (winsEl) winsEl.textContent = detail.wins;

        const lossesEl = document.getElementById('statCardLosses');
        if (lossesEl) lossesEl.textContent = detail.losses;

        const totalEl = document.getElementById('statCardTotal');
        if (totalEl) totalEl.textContent = detail.total;

        const winRateEl = document.getElementById('statCardWinRate');
        if (winRateEl) winRateEl.textContent = `%${detail.winRate.toFixed(1)}`;

        const badgeRow = document.getElementById('statCardBadgeRow');
        if (badgeRow) badgeRow.innerHTML = getTournamentBadgeHtml(stat);

        // İstatistik Giriş Alanları (Gol, Asist, Kurtarış)
        const goalsInput = document.getElementById('statCardGoalsInput');
        const assistsInput = document.getElementById('statCardAssistsInput');
        const savesInput = document.getElementById('statCardSavesInput');

        if (goalsInput) goalsInput.value = stat.goals || 0;
        if (assistsInput) assistsInput.value = stat.assists || 0;
        if (savesInput) savesInput.value = stat.saves || 0;

        // İstatistik Güncelleme Fonksiyonu
        function applyStatValue(statType, rawVal, triggerEl) {
            let val = parseInt(rawVal, 10);
            if (isNaN(val) || val < 0) val = 0;
            if (val > 9999) val = 9999;

            const oldVal = stat[statType] || 0;
            stat[statType] = val;

            let targetInput = null;
            if (statType === 'goals') targetInput = goalsInput;
            else if (statType === 'assists') targetInput = assistsInput;
            else if (statType === 'saves') targetInput = savesInput;

            if (targetInput) {
                targetInput.value = val;
                targetInput.classList.remove('stat-flash-inc', 'stat-flash-dec');
                void targetInput.offsetWidth;
                targetInput.classList.add(val >= oldVal ? 'stat-flash-inc' : 'stat-flash-dec');
                setTimeout(() => targetInput.classList.remove('stat-flash-inc', 'stat-flash-dec'), 600);
            }

            if (triggerEl) {
                triggerEl.classList.remove('stat-flash-inc', 'stat-flash-dec');
                void triggerEl.offsetWidth;
                triggerEl.classList.add(val >= oldVal ? 'stat-flash-inc' : 'stat-flash-dec');
                setTimeout(() => triggerEl.classList.remove('stat-flash-inc', 'stat-flash-dec'), 600);
            }

            playUiSfx('click');
            saveChannelStats();
            refreshAllPlayerElements();
            if (leaderboardModal && !leaderboardModal.classList.contains('hidden')) {
                renderLeaderboard();
            }
        }

        // Doğrudan input giriş dinleyicileri
        if (goalsInput) {
            goalsInput.onchange = () => applyStatValue('goals', goalsInput.value, goalsInput);
            goalsInput.onkeyup = (e) => { if (e.key === 'Enter') applyStatValue('goals', goalsInput.value, goalsInput); };
        }
        if (assistsInput) {
            assistsInput.onchange = () => applyStatValue('assists', assistsInput.value, assistsInput);
            assistsInput.onkeyup = (e) => { if (e.key === 'Enter') applyStatValue('assists', assistsInput.value, assistsInput); };
        }
        if (savesInput) {
            savesInput.onchange = () => applyStatValue('saves', savesInput.value, savesInput);
            savesInput.onkeyup = (e) => { if (e.key === 'Enter') applyStatValue('saves', savesInput.value, savesInput); };
        }

        // Stepper (+ / -) butonları
        card.querySelectorAll('.stat-step-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const statType = btn.dataset.stat;
                if (!statType) return;
                const isPlus = btn.classList.contains('plus');
                const cur = stat[statType] || 0;
                applyStatValue(statType, isPlus ? cur + 1 : Math.max(0, cur - 1), btn);
            };
        });

        // Hızlı Ekleme (+1) butonları
        card.querySelectorAll('.stat-quick-add').forEach(chip => {
            chip.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const statType = chip.dataset.stat;
                if (!statType) return;
                const addVal = parseInt(chip.dataset.add || '1', 10);
                const cur = stat[statType] || 0;
                applyStatValue(statType, cur + addVal, chip);
            };
        });

        // Kaydet & Kapat butonu
        const saveBtn = document.getElementById('statCardSaveBtn');
        if (saveBtn) {
            saveBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                playUiSfx('click');
                saveChannelStats();
                refreshAllPlayerElements();
                if (leaderboardModal && !leaderboardModal.classList.contains('hidden')) {
                    renderLeaderboard();
                }
                showToast(`✅ ${detail.displayName} istatistikleri kaydedildi.`);
                card.classList.add('hidden');
            };
        }

        // Kartı görünür kıl ve akıllı pozisyonla
        card.classList.remove('hidden');
        const rect = anchorEl ? anchorEl.getBoundingClientRect() : null;
        if (rect) {
            const cardWidth = 300;
            const cardHeight = 390;
            let top = rect.bottom + 8;
            let left = rect.left;
            if (top + cardHeight > window.innerHeight) {
                top = Math.max(10, rect.top - cardHeight - 8);
            }
            if (left + cardWidth > window.innerWidth) {
                left = Math.max(10, window.innerWidth - cardWidth - 16);
            }
            card.style.top = `${top + window.scrollY}px`;
            card.style.left = `${Math.max(8, left)}px`;
        }

        // Kapat butonu
        const closeBtn = document.getElementById('statCardClose');
        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                card.classList.add('hidden');
            };
        }
    }

    // Stat kartı dışına tıklanınca kapat (Leaderboard düzenle ve oyuncu öğeleri istisna)
    document.addEventListener('click', (e) => {
        const card = document.getElementById('playerStatCard');
        if (card && !card.classList.contains('hidden')) {
            if (!card.contains(e.target) && !e.target.closest('.player-item') && !e.target.closest('.btn-table-edit')) {
                card.classList.add('hidden');
            }
        }
    });

    // =========================================================================
    // 🎥 6. OBS OVERLAY MODU (Akıllı Ölçeklendirme & Canlı Senkronizasyon)
    // =========================================================================
    let obsConfig = {
        scaleMode: 'auto',      // 'auto' | 'manual'
        manualScale: 100,       // 40 - 200
        infoBarPos: 'top',      // 'top' | 'bottom' | 'compact' | 'hidden'
        align: 'center',        // 'center' | 'top'
        activeMatchId: null     // null | 'm_r8_1' | 'm_r8_2' | etc.
    };

    try {
        const savedConfig = localStorage.getItem('obs_overlay_config');
        if (savedConfig) {
            obsConfig = Object.assign(obsConfig, JSON.parse(savedConfig));
        }
    } catch(e) {}

    // 🎥 6. OBS SENKRONİZASYON KÖPRÜSÜ (Triple-Layer Real-Time Bridge)
    let nativeBroadcast = null;
    try {
        if (typeof BroadcastChannel !== 'undefined') {
            nativeBroadcast = new BroadcastChannel('skc_obs_sync_v2');
        }
    } catch(e) {}

    var localObsState = {
        html: '',
        modeClass: '',
        cmd: '',
        poolCount: '',
        newPlayer: null,
        obsConfig: obsConfig,
        activeMatchId: obsConfig.activeMatchId || null,
        ts: Date.now()
    };

    var obsSyncChannel = {
        postMessage: function(msg) {
            const isCurrentlyOverlay = document.body.classList.contains('obs-overlay-mode');
            if (isCurrentlyOverlay && msg.type !== 'request_state') {
                return; // OBS ekranı sunucu durumunu asla ezemez!
            }

            if (msg.type === 'sync_html') {
                localObsState.html = msg.html;
                localObsState.modeClass = msg.modeClass;
            } else if (msg.type === 'update_command') {
                localObsState.cmd = msg.cmd;
            } else if (msg.type === 'update_pool_count') {
                localObsState.poolCount = msg.count;
            } else if (msg.type === 'new_player') {
                localObsState.newPlayer = { name: msg.name, ts: Date.now() };
            } else if (msg.type === 'update_obs_config') {
                localObsState.obsConfig = msg.config;
                if (msg.config && msg.config.activeMatchId !== undefined) {
                    localObsState.activeMatchId = msg.config.activeMatchId;
                }
            } else if (msg.type === 'update_live_match') {
                localObsState.activeMatchId = msg.matchId;
                if (!localObsState.obsConfig) localObsState.obsConfig = {};
                localObsState.obsConfig.activeMatchId = msg.matchId;
            }
            localObsState.ts = Date.now();

            // Layer 1: Native BroadcastChannel (0ms gecikme)
            if (nativeBroadcast) {
                try { nativeBroadcast.postMessage(msg); } catch(e) {}
            }

            // Layer 2: localStorage StorageEvent (0ms gecikme)
            try {
                localStorage.setItem('obs_live_sync_packet', JSON.stringify({
                    msg: msg,
                    fullState: localObsState,
                    ts: Date.now()
                }));
            } catch(e) {}

            // Layer 3: HTTP Server POST (180ms Debounce buffer ile istek birleştirme)
            if (!isCurrentlyOverlay) {
                if (_obsPostDebounceTimer) {
                    clearTimeout(_obsPostDebounceTimer);
                }
                _obsPostDebounceTimer = setTimeout(() => {
                    _obsPostDebounceTimer = null;
                    fetch(`${getApiBase()}/api/state`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(localObsState)
                    }).catch(e => {});
                }, 180);
            }
        },
        onmessage: null
    };

    var _obsPostDebounceTimer = null;

    // Layer 1 Dinleyici: BroadcastChannel
    if (nativeBroadcast) {
        nativeBroadcast.onmessage = (e) => {
            if (obsSyncChannel.onmessage && e.data) {
                obsSyncChannel.onmessage(e);
            }
        };
    }

    // Layer 2 Dinleyici: localStorage StorageEvent
    window.addEventListener('storage', (e) => {
        if (e.key === 'obs_live_sync_packet' && e.newValue) {
            try {
                const packet = JSON.parse(e.newValue);
                if (obsSyncChannel.onmessage && packet.msg) {
                    obsSyncChannel.onmessage({ data: packet.msg });
                    if (packet.fullState && packet.fullState.obsConfig) {
                        obsSyncChannel.onmessage({ data: { type: 'update_obs_config', config: packet.fullState.obsConfig } });
                    }
                }
            } catch(err) {}
        }
    });

    // Layer 3 Dinleyici: HTTP Server Polling (Yedek senkronizasyon, in-flight korumalı)
    let _lastObsStateStr = "";
    let _lastObsNewPlayerTs = 0;
    let _isObsPollingActive = false;

    setInterval(() => {
        if (_isObsPollingActive) return; // Önceki istek henüz tamamlanmadıysa kuyruk oluşturma
        _isObsPollingActive = true;

        fetch(`${getApiBase()}/api/state`)
            .then(r => r.text())
            .then(txt => {
                if (txt === _lastObsStateStr || txt === "{}" || !txt) return;
                _lastObsStateStr = txt;
                const state = JSON.parse(txt);
                if (obsSyncChannel.onmessage) {
                    if (state.obsConfig) {
                        obsSyncChannel.onmessage({ data: { type: 'update_obs_config', config: state.obsConfig } });
                    }
                    if (state.activeMatchId !== undefined) {
                        obsSyncChannel.onmessage({ data: { type: 'update_live_match', matchId: state.activeMatchId } });
                    }
                    if (state.html) {
                        obsSyncChannel.onmessage({ data: { type: 'sync_html', html: state.html, modeClass: state.modeClass } });
                    }
                    if (state.cmd) {
                        obsSyncChannel.onmessage({ data: { type: 'update_command', cmd: state.cmd } });
                    }
                    if (state.poolCount !== undefined) {
                        obsSyncChannel.onmessage({ data: { type: 'update_pool_count', count: state.poolCount } });
                    }
                    if (state.newPlayer && state.newPlayer.ts !== _lastObsNewPlayerTs) {
                        _lastObsNewPlayerTs = state.newPlayer.ts;
                        obsSyncChannel.onmessage({ data: { type: 'new_player', name: state.newPlayer.name } });
                    }
                }
            })
            .catch(e => {})
            .finally(() => {
                _isObsPollingActive = false;
            });
    }, 1200);

    function showObsToast(name) {
        const container = document.getElementById('obsToastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'obs-toast';
        toast.innerHTML = '<i class="fa-solid fa-user-plus"></i> Yeni Katılımcı: <strong>' + name + '</strong>';
        container.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
    }

    // =========================================================================
    // 📺 OBS Dinamik Akıllı Ölçeklendirme Motoru (Auto-Fit Matrix Engine)
    // =========================================================================
    function applyObsScaling() {
        if (!document.body.classList.contains('obs-overlay-mode')) return;
        const tc = document.getElementById('teamsContainer');
        if (!tc) return;

        // Bilgi çubuğu ve hizalama sınıflarını uygula
        document.body.classList.remove('obs-info-pos-top', 'obs-info-pos-bottom', 'obs-info-pos-compact', 'obs-info-pos-hidden', 'obs-align-top');
        document.body.classList.add('obs-info-pos-' + (obsConfig.infoBarPos || 'top'));
        if (obsConfig.align === 'top') {
            document.body.classList.add('obs-align-top');
        }

        if (obsConfig.scaleMode === 'manual') {
            const scaleFactor = (obsConfig.manualScale || 100) / 100;
            tc.style.transform = `scale(${scaleFactor})`;
            return;
        }

        // AKILLI OTOMATİK SIĞDIRMA (Auto-Fit Matrix Engine)
        tc.style.transform = 'none';

        requestAnimationFrame(() => {
            const winW = window.innerWidth || document.documentElement.clientWidth || 1920;
            const winH = window.innerHeight || document.documentElement.clientHeight || 1080;

            let reservedTop = 0;
            let reservedBottom = 0;
            const infoBar = document.getElementById('obsInfoBar');
            if (infoBar && obsConfig.infoBarPos !== 'hidden' && obsConfig.infoBarPos !== 'compact') {
                const infoHeight = infoBar.offsetHeight || 38;
                if (obsConfig.infoBarPos === 'top') reservedTop = infoHeight + 16;
                if (obsConfig.infoBarPos === 'bottom') reservedBottom = infoHeight + 16;
            }

            const marginX = 24;
            const marginY = 20;
            const availW = Math.max(200, winW - (marginX * 2));
            const availH = Math.max(150, winH - (marginY * 2) - reservedTop - reservedBottom);

            const focusWrapper = tc.querySelector('.obs-focus-wrapper');
            const tournamentTree = tc.querySelector('.bracket-tree') || tc.querySelector('.tournament-bracket-wrapper') || tc.querySelector('.tournament-wrapper');
            const targetEl = focusWrapper || tournamentTree || tc.firstElementChild || tc;

            const rect = targetEl.getBoundingClientRect();
            const contentW = Math.max(targetEl.scrollWidth || 0, rect.width || 0, 300);
            const contentH = Math.max(targetEl.scrollHeight || 0, rect.height || 0, 200);

            if (contentW > 0 && contentH > 0) {
                const scaleX = availW / contentW;
                const scaleY = availH / contentH;
                let optimalScale = Math.min(scaleX, scaleY) * 0.90; // %10 güvenli boşluk
                optimalScale = Math.min(Math.max(optimalScale, 0.20), 1.35);
                
                if (obsConfig.align === 'top') {
                    tc.style.transformOrigin = 'top center';
                } else {
                    tc.style.transformOrigin = 'center center';
                }
                
                tc.style.transform = `scale(${optimalScale.toFixed(3)})`;
            }
        });
    }

    function extractOverlayContent(html) {
        if (!html) {
            const currentTc = document.getElementById('teamsContainer');
            if (currentTc && currentTc.innerHTML.trim().length > 0) {
                html = currentTc.innerHTML;
            } else {
                return '';
            }
        }
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Manuel odaklanmış eleman varsa öncelikli (Göz simgesi 👁️ ile tıklanan eleman)
        const focusedEl = tempDiv.querySelector('.obs-focused');
        if (focusedEl) {
            return `<div class="obs-focus-wrapper">${focusedEl.outerHTML}</div>`;
        }

        // Manuel odak yoksa tüm turnuva ağacını/takımları döndür (Canlı maç ağaç üzerinde kırmızı nabızla vurgulanır)
        return html;
    }

    function initOverlayMode() {
        const params = new URLSearchParams(window.location.search);
        const isOverlayParam = (
            params.get('overlay') === '1' ||
            window.location.hash.indexOf('overlay') !== -1 ||
            window.obsstudio !== undefined ||
            (navigator.userAgent && (navigator.userAgent.indexOf('OBS') !== -1 || navigator.userAgent.indexOf('obs-browser') !== -1))
        );
        if (!isOverlayParam) return false;

        // OBS Overlay için arka plan müziğini ve ses efektlerini tamamen durdur
        stopBackgroundMusic();

        document.documentElement.classList.add('obs-overlay-mode');
        if (document.body) document.body.classList.add('obs-overlay-mode');

        // URL parametresi ile geçersiz kılma desteği
        if (params.get('scale')) {
            const sParam = params.get('scale');
            if (sParam === 'auto') {
                obsConfig.scaleMode = 'auto';
            } else {
                const sNum = parseInt(sParam, 10);
                if (!isNaN(sNum)) {
                    obsConfig.scaleMode = 'manual';
                    obsConfig.manualScale = sNum;
                }
            }
        }
        if (params.get('info')) {
            obsConfig.infoBarPos = params.get('info');
        }
        if (params.get('align')) {
            obsConfig.align = params.get('align');
        }
        if (params.get('live')) {
            obsConfig.activeMatchId = params.get('live');
        }

        const hideSelectors = [
            'header', '.app-header', '.controls', '.pool-container',
            '#advancedControlsPanel', '#settingsDrawer', '#drawerOverlay',
            '#comprehensiveGuideModal', '#poolCollapsedStrip',
            '#guideOverlay', '#leaderboardModal', '#matchModal',
            '#kickModal', '#audioModal', '.splash-screen',
            '#playerStatCard', '#tournamentScoreModal'
        ];
        hideSelectors.forEach(sel => {
            const el = document.querySelector(sel);
            if (el) el.style.display = 'none';
        });

        if (document.body) {
            document.body.style.background = 'transparent';
            document.body.style.backgroundImage = 'none';
        }
        const bg = document.querySelector('.background-overlay');
        if (bg) bg.style.display = 'none';

        const workspace = document.querySelector('.workspace');
        if (workspace) {
            workspace.style.gridTemplateColumns = '1fr';
            workspace.style.padding = '0';
        }

        const tc = document.getElementById('teamsContainer');
        if (tc && tc.innerHTML.trim().length > 0) {
            tc.innerHTML = extractOverlayContent(tc.innerHTML);
        }
        
        obsSyncChannel.onmessage = (e) => {
            if (e.data.type === 'sync_html') {
                const teamsContainer = document.getElementById('teamsContainer');
                if (teamsContainer && e.data.html !== undefined) {
                    if (e.data.modeClass) {
                        teamsContainer.className = e.data.modeClass;
                    }
                    teamsContainer.innerHTML = extractOverlayContent(e.data.html);
                    applyLiveMatchToOverlay();
                    requestAnimationFrame(applyObsScaling);
                }
            } else if (e.data.type === 'update_obs_config') {
                if (e.data.config) {
                    obsConfig = Object.assign(obsConfig, e.data.config);
                    applyLiveMatchToOverlay();
                    applyObsScaling();
                }
            } else if (e.data.type === 'update_live_match') {
                obsConfig.activeMatchId = e.data.matchId || null;
                applyLiveMatchToOverlay();
                applyObsScaling();
            } else if (e.data.type === 'new_player') {
                showObsToast(e.data.name);
            } else if (e.data.type === 'update_command') {
                const infoText = document.getElementById('obsInfoBarText');
                if (infoText) infoText.innerHTML = "Oyuna katılmak için sohbete <strong>" + e.data.cmd + "</strong> yazın!";
            } else if (e.data.type === 'update_pool_count') {
                const countBadge = document.getElementById('obsPoolCountDisplay');
                if (countBadge) countBadge.textContent = e.data.count;
            }
        };

        window.addEventListener('resize', () => {
            requestAnimationFrame(applyObsScaling);
        });

        // İlk açılışta anında sunucudan ve yerel depolamadan en güncel durumu çek
        fetch(`${getApiBase()}/api/state`)
            .then(r => r.json())
            .then(state => {
                if (state && (state.html || state.obsConfig)) {
                    if (state.obsConfig) obsConfig = Object.assign(obsConfig, state.obsConfig);
                    if (state.activeMatchId !== undefined) obsConfig.activeMatchId = state.activeMatchId;
                    if (state.html) {
                        const tc = document.getElementById('teamsContainer');
                        if (tc) {
                            if (state.modeClass) tc.className = state.modeClass;
                            tc.innerHTML = extractOverlayContent(state.html);
                        }
                    }
                    if (state.cmd) {
                        const infoText = document.getElementById('obsInfoBarText');
                        if (infoText) infoText.innerHTML = "Oyuna katılmak için sohbete <strong>" + state.cmd + "</strong> yazın!";
                    }
                    if (state.poolCount !== undefined) {
                        const countBadge = document.getElementById('obsPoolCountDisplay');
                        if (countBadge) countBadge.textContent = state.poolCount;
                    }
                    applyLiveMatchToOverlay();
                    requestAnimationFrame(applyObsScaling);
                }
            }).catch(e => {});

        setTimeout(() => {
            obsSyncChannel.postMessage({ type: 'request_state' });
            applyLiveMatchToOverlay();
            applyObsScaling();
        }, 200);

        return true;
    }

    function applyLiveMatchToOverlay() {
        const activeId = obsConfig.activeMatchId;
        const cards = document.querySelectorAll('.bracket-match-card');
        let activeMatchName = '';
        let activeTeamA = '';
        let activeTeamB = '';

        cards.forEach(card => {
            const mId = card.dataset.matchId;
            const badgeCont = card.querySelector('.match-badge');
            const existingBadge = card.querySelector('.live-match-badge');
            if (mId === activeId && activeId) {
                card.classList.add('active-live-match');
                const mTitleEl = badgeCont ? badgeCont.querySelector('span') : null;
                if (mTitleEl) activeMatchName = mTitleEl.textContent.trim();

                const slotA = card.querySelector('.bracket-team-slot[data-slot="teamA"] input');
                const slotB = card.querySelector('.bracket-team-slot[data-slot="teamB"] input');
                activeTeamA = slotA ? slotA.value.trim() : 'Takım 1';
                activeTeamB = slotB ? slotB.value.trim() : 'Takım 2';

                if (!existingBadge && badgeCont) {
                    const liveBadge = document.createElement('span');
                    liveBadge.className = 'live-match-badge';
                    liveBadge.innerHTML = '<span class="live-dot pulse"></span> CANLI';
                    const firstSpan = badgeCont.querySelector('span');
                    if (firstSpan && firstSpan.nextSibling) {
                        badgeCont.insertBefore(liveBadge, firstSpan.nextSibling);
                    } else {
                        badgeCont.appendChild(liveBadge);
                    }
                }
            } else {
                card.classList.remove('active-live-match');
                if (existingBadge) {
                    existingBadge.remove();
                }
            }
        });

        // 2 Takımlı / Tek Maç modu için de kontrol et
        const teamBoxes = document.querySelectorAll('.team-box');
        if (teamBoxes.length === 2 && activeId === 'single_match') {
            teamBoxes.forEach(box => box.classList.add('active-live-match'));
            const t1 = document.querySelector('#team1Box .team-header input');
            const t2 = document.querySelector('#team2Box .team-header input');
            activeMatchName = 'Tek Maç';
            activeTeamA = t1 ? t1.value.trim() : 'Takım 1';
            activeTeamB = t2 ? t2.value.trim() : 'Takım 2';
        }

        // OBS Üst Bar Canlı Maç Ticker'ı Güncelle
        const liveBanner = document.getElementById('obsLiveMatchBanner');
        const liveTitle = document.getElementById('obsLiveMatchTitle');
        if (liveBanner && liveTitle) {
            if (activeId && (activeTeamA || activeMatchName)) {
                liveTitle.innerHTML = `<strong>${activeMatchName || 'Canlı'}:</strong> ${activeTeamA} <span style="color:#00f0ff;font-size:11px;margin:0 4px;">VS</span> ${activeTeamB}`;
                liveBanner.classList.remove('hidden');
            } else {
                liveBanner.classList.add('hidden');
            }
        }
    }

    const isOverlay = initOverlayMode();

    if (!isOverlay) {
        const teamsContainer = document.getElementById('teamsContainer');
        if (teamsContainer) {
            let syncTimeout = null;
            const sendSync = () => {
                clearTimeout(syncTimeout);
                syncTimeout = setTimeout(() => {
                    obsSyncChannel.postMessage({ type: 'sync_html', html: teamsContainer.innerHTML, modeClass: teamsContainer.className });
                }, 80);
            };
            const observer = new MutationObserver(sendSync);
            observer.observe(teamsContainer, { childList: true, subtree: true, attributes: true, characterData: true });
        }
        
        setTimeout(() => {
            const tc = document.getElementById('teamsContainer');
            if (tc) {
                obsSyncChannel.postMessage({ type: 'sync_html', html: tc.innerHTML, modeClass: tc.className });
            }
            obsSyncChannel.postMessage({ type: 'update_command', cmd: typeof currentJoinCommand !== "undefined" ? currentJoinCommand : "!kingsc" });
            const pCount = document.getElementById('poolCount');
            if (pCount) obsSyncChannel.postMessage({ type: 'update_pool_count', count: pCount.textContent });
            obsSyncChannel.postMessage({ type: 'update_obs_config', config: obsConfig });
            if (obsConfig.activeMatchId) {
                obsSyncChannel.postMessage({ type: 'update_live_match', matchId: obsConfig.activeMatchId });
            }
        }, 300);
        
        obsSyncChannel.onmessage = (e) => {
            if (e.data.type === 'request_state') {
                const tc = document.getElementById('teamsContainer');
                if (tc) {
                    obsSyncChannel.postMessage({ type: 'sync_html', html: tc.innerHTML, modeClass: tc.className });
                }
                const cmdInput = document.getElementById('joinCommandInput');
                obsSyncChannel.postMessage({ type: 'update_command', cmd: cmdInput ? cmdInput.value : (typeof currentJoinCommand !== "undefined" ? currentJoinCommand : "!kingsc") });
                const pCount = document.getElementById('poolCount');
                if (pCount) obsSyncChannel.postMessage({ type: 'update_pool_count', count: pCount.textContent });
                obsSyncChannel.postMessage({ type: 'update_obs_config', config: obsConfig });
                if (obsConfig.activeMatchId) {
                    obsSyncChannel.postMessage({ type: 'update_live_match', matchId: obsConfig.activeMatchId });
                }
            }
        };
        
        const cmdInputNode = document.getElementById('joinCommandInput');
        if (cmdInputNode) {
            cmdInputNode.addEventListener('input', () => {
                obsSyncChannel.postMessage({ type: 'update_command', cmd: cmdInputNode.value });
            });
        }
        
        // Modal & Canlı Kontrol Mantığı
        const obsOverlayBtn = document.getElementById('obsOverlayBtn');
        const obsLinkModal = document.getElementById('obsLinkModal');
        const closeObsLinkModalBtn = document.getElementById('closeObsLinkModalBtn');
        const closeObsLinkModalFooterBtn = document.getElementById('closeObsLinkModalFooterBtn');
        const copyObsLinkBtn = document.getElementById('copyObsLinkBtn');
        const obsLinkInput = document.getElementById('obsLinkInput');
        const openObsPreviewBtn = document.getElementById('openObsPreviewBtn');

        // Modal Ayar Elemanları
        const obsScaleAuto = document.getElementById('obsScaleAuto');
        const obsScaleManual = document.getElementById('obsScaleManual');
        const obsManualScaleContainer = document.getElementById('obsManualScaleContainer');
        const obsScaleSlider = document.getElementById('obsScaleSlider');
        const obsScaleValue = document.getElementById('obsScaleValue');
        const obsInfoBarPosSelect = document.getElementById('obsInfoBarPosSelect');
        const obsAlignSelect = document.getElementById('obsAlignSelect');
        const resetObsScaleBtn = document.getElementById('resetObsScaleBtn');

        function setActiveLiveMatch(matchId, skipBroadcast = false) {
            obsConfig.activeMatchId = matchId || null;

            // Ana paneldeki maç kartlarını güncelle
            const allCards = document.querySelectorAll('.bracket-match-card');
            allCards.forEach(card => {
                const cMatchId = card.dataset.matchId;
                const liveBtn = card.querySelector('.obs-live-btn');
                const badgeCont = card.querySelector('.match-badge');
                const existingBadge = card.querySelector('.live-match-badge');

                if (cMatchId === matchId && matchId) {
                    card.classList.add('active-live-match');
                    if (liveBtn) {
                        liveBtn.classList.add('active');
                        liveBtn.title = 'Canlı maç vurgusunu kaldır';
                    }
                    if (!existingBadge && badgeCont) {
                        const liveBadge = document.createElement('span');
                        liveBadge.className = 'live-match-badge';
                        liveBadge.innerHTML = '<span class="live-dot"></span> CANLI';
                        const firstSpan = badgeCont.querySelector('span');
                        if (firstSpan && firstSpan.nextSibling) {
                            badgeCont.insertBefore(liveBadge, firstSpan.nextSibling);
                        } else {
                            badgeCont.appendChild(liveBadge);
                        }
                    }
                } else {
                    card.classList.remove('active-live-match');
                    if (liveBtn) {
                        liveBtn.classList.remove('active');
                        liveBtn.title = 'OBS\'te bu maçı canlı oynanıyor olarak vurgula (Kırmızı Nabız)';
                    }
                    if (existingBadge) {
                        existingBadge.remove();
                    }
                }
            });

            // Hızlı çubuk dropdown senkronizasyonu
            const quickSelect = document.getElementById('obsQuickLiveMatchSelect');
            if (quickSelect) {
                quickSelect.value = matchId || '';
                if (matchId) {
                    quickSelect.classList.add('has-live');
                } else {
                    quickSelect.classList.remove('has-live');
                }
            }

            // Modal içi kontrolleri senkronize et
            const modalSelect = document.getElementById('obsLiveMatchSelect');
            if (modalSelect) {
                modalSelect.value = matchId || '';
            }
            document.querySelectorAll('.btn-live-quick').forEach(btn => {
                const btnMatch = btn.getAttribute('data-match');
                if (btnMatch === matchId && matchId) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            if (!skipBroadcast) {
                if (matchId) {
                    const matchObj = typeof tournamentMatches !== 'undefined' ? tournamentMatches[matchId] : null;
                    const mName = matchObj ? matchObj.name : matchId;
                    showToast('🔴 Canlı Maç Yayında: ' + mName);
                } else {
                    showToast('⚪ Canlı maç vurgusu kapatıldı');
                }
                updateObsLinkAndBroadcast();
            }
        }
        window.setActiveLiveMatch = setActiveLiveMatch;

        function updateObsLinkAndBroadcast() {
            const baseUrl = window.location.href.split('?')[0].split('#')[0];
            const cleanUrl = baseUrl + '?overlay=1';

            if (obsLinkInput) obsLinkInput.value = cleanUrl;
            if (openObsPreviewBtn) openObsPreviewBtn.href = cleanUrl;

            const drawerObsLinkInput = document.getElementById('drawerObsLinkInput');
            if (drawerObsLinkInput) drawerObsLinkInput.value = cleanUrl;

            try {
                localStorage.setItem('obs_overlay_config', JSON.stringify(obsConfig));
            } catch(e) {}

            obsSyncChannel.postMessage({ type: 'update_obs_config', config: obsConfig });
            obsSyncChannel.postMessage({ type: 'update_live_match', matchId: obsConfig.activeMatchId });
            const tc = document.getElementById('teamsContainer');
            if (tc) {
                obsSyncChannel.postMessage({ type: 'sync_html', html: tc.innerHTML, modeClass: tc.className });
            }
        }

        function syncModalInputsFromConfig() {
            if (obsConfig.scaleMode === 'manual') {
                if (obsScaleManual) obsScaleManual.checked = true;
                if (obsManualScaleContainer) obsManualScaleContainer.style.display = 'block';
            } else {
                if (obsScaleAuto) obsScaleAuto.checked = true;
                if (obsManualScaleContainer) obsManualScaleContainer.style.display = 'none';
            }

            if (obsScaleSlider) obsScaleSlider.value = obsConfig.manualScale || 100;
            if (obsScaleValue) obsScaleValue.textContent = (obsConfig.manualScale || 100) + '%';
            if (obsInfoBarPosSelect) obsInfoBarPosSelect.value = obsConfig.infoBarPos || 'top';
            if (obsAlignSelect) obsAlignSelect.value = obsConfig.align || 'center';

            const modalLiveSelect = document.getElementById('obsLiveMatchSelect');
            if (modalLiveSelect) {
                modalLiveSelect.value = obsConfig.activeMatchId || '';
            }
            document.querySelectorAll('.btn-live-quick').forEach(btn => {
                const btnMatch = btn.getAttribute('data-match');
                if (btnMatch === obsConfig.activeMatchId && obsConfig.activeMatchId) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        // Hızlı Kontrol Çubuğu Elemanları
        const obsZoomOutBtn = document.getElementById('obsZoomOutBtn');
        const obsZoomInBtn = document.getElementById('obsZoomInBtn');
        const obsQuickScaleBadge = document.getElementById('obsQuickScaleBadge');
        const obsQuickAutoBtn = document.getElementById('obsQuickAutoBtn');
        const obsResetFocusBtn = document.getElementById('obsResetFocusBtn');
        const obsQuickSettingsBtn = document.getElementById('obsQuickSettingsBtn');

        function syncQuickToolbarUI() {
            if (obsQuickScaleBadge) {
                if (obsConfig.scaleMode === 'auto') {
                    obsQuickScaleBadge.textContent = 'Auto';
                    obsQuickScaleBadge.style.color = '#00e6e6';
                } else {
                    obsQuickScaleBadge.textContent = (obsConfig.manualScale || 100) + '%';
                    obsQuickScaleBadge.style.color = '#fff';
                }
            }
            if (obsQuickAutoBtn) {
                if (obsConfig.scaleMode === 'auto') {
                    obsQuickAutoBtn.classList.add('active');
                } else {
                    obsQuickAutoBtn.classList.remove('active');
                }
            }
            // Preset butonlarını güncelle
            document.querySelectorAll('.btn-quick-preset').forEach(btn => {
                const sVal = parseInt(btn.getAttribute('data-scale'), 10);
                if (obsConfig.scaleMode === 'manual' && obsConfig.manualScale === sVal) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            const quickSelect = document.getElementById('obsQuickLiveMatchSelect');
            if (quickSelect) {
                quickSelect.value = obsConfig.activeMatchId || '';
                if (obsConfig.activeMatchId) {
                    quickSelect.classList.add('has-live');
                } else {
                    quickSelect.classList.remove('has-live');
                }
            }
            // Odak Sıfırlama Butonu Görünürlüğü
            if (obsResetFocusBtn) {
                const hasFocus = document.querySelector('.obs-focused') !== null;
                if (hasFocus) {
                    obsResetFocusBtn.classList.remove('hidden');
                } else {
                    obsResetFocusBtn.classList.add('hidden');
                }
            }
        }

        function changeObsScale(delta) {
            if (obsConfig.scaleMode === 'auto') {
                obsConfig.scaleMode = 'manual';
                obsConfig.manualScale = 100;
            }
            let newScale = (obsConfig.manualScale || 100) + delta;
            newScale = Math.min(Math.max(newScale, 40), 200);
            obsConfig.manualScale = newScale;
            syncModalInputsFromConfig();
            syncQuickToolbarUI();
            updateObsLinkAndBroadcast();
            showToast('📺 OBS Ölçeği: %' + newScale);
        }

        function toggleObsAutoFit() {
            if (obsConfig.scaleMode === 'auto') {
                obsConfig.scaleMode = 'manual';
                obsConfig.manualScale = 100;
                showToast('📺 OBS: Manuel Ölçek Modu (%100)');
            } else {
                obsConfig.scaleMode = 'auto';
                showToast('📺 OBS: Akıllı Otomatik Sığdırma (Auto-Fit) Aktif');
            }
            syncModalInputsFromConfig();
            syncQuickToolbarUI();
            updateObsLinkAndBroadcast();
        }

        if (obsScaleAuto && obsScaleManual) {
            obsScaleAuto.addEventListener('change', () => {
                obsConfig.scaleMode = 'auto';
                if (obsManualScaleContainer) obsManualScaleContainer.style.display = 'none';
                syncQuickToolbarUI();
                updateObsLinkAndBroadcast();
            });
            obsScaleManual.addEventListener('change', () => {
                obsConfig.scaleMode = 'manual';
                if (obsManualScaleContainer) obsManualScaleContainer.style.display = 'block';
                syncQuickToolbarUI();
                updateObsLinkAndBroadcast();
            });
        }

        if (obsScaleSlider && obsScaleValue) {
            obsScaleSlider.addEventListener('input', () => {
                const val = parseInt(obsScaleSlider.value, 10);
                obsConfig.manualScale = val;
                obsScaleValue.textContent = val + '%';
                syncQuickToolbarUI();
                updateObsLinkAndBroadcast();
            });
        }

        document.querySelectorAll('.btn-preset[data-scale], .btn-quick-preset[data-scale]').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = parseInt(btn.getAttribute('data-scale'), 10);
                obsConfig.scaleMode = 'manual';
                obsConfig.manualScale = val;
                if (obsScaleManual) obsScaleManual.checked = true;
                if (obsManualScaleContainer) obsManualScaleContainer.style.display = 'block';
                if (obsScaleSlider) obsScaleSlider.value = val;
                if (obsScaleValue) obsScaleValue.textContent = val + '%';
                syncQuickToolbarUI();
                updateObsLinkAndBroadcast();
                showToast('📺 OBS Ölçeği: %' + val);
            });
        });

        if (resetObsScaleBtn) {
            resetObsScaleBtn.addEventListener('click', () => {
                obsConfig.scaleMode = 'auto';
                obsConfig.manualScale = 100;
                obsConfig.infoBarPos = 'top';
                obsConfig.align = 'center';
                syncModalInputsFromConfig();
                syncQuickToolbarUI();
                updateObsLinkAndBroadcast();
            });
        }

        if (obsInfoBarPosSelect) {
            obsInfoBarPosSelect.addEventListener('change', () => {
                obsConfig.infoBarPos = obsInfoBarPosSelect.value;
                updateObsLinkAndBroadcast();
            });
        }

        if (obsAlignSelect) {
            obsAlignSelect.addEventListener('change', () => {
                obsConfig.align = obsAlignSelect.value;
                updateObsLinkAndBroadcast();
            });
        }

        // Canlı Maç Kontrolleri Event Listener'ları
        const obsQuickLiveMatchSelect = document.getElementById('obsQuickLiveMatchSelect');
        if (obsQuickLiveMatchSelect) {
            obsQuickLiveMatchSelect.addEventListener('change', () => {
                setActiveLiveMatch(obsQuickLiveMatchSelect.value || null);
            });
        }

        const obsLiveMatchSelect = document.getElementById('obsLiveMatchSelect');
        if (obsLiveMatchSelect) {
            obsLiveMatchSelect.addEventListener('change', () => {
                setActiveLiveMatch(obsLiveMatchSelect.value || null);
            });
        }

        const clearLiveMatchBtn = document.getElementById('clearLiveMatchBtn');
        if (clearLiveMatchBtn) {
            clearLiveMatchBtn.addEventListener('click', () => {
                setActiveLiveMatch(null);
            });
        }

        document.querySelectorAll('.btn-live-quick[data-match]').forEach(btn => {
            btn.addEventListener('click', () => {
                const matchId = btn.getAttribute('data-match');
                if (obsConfig.activeMatchId === matchId) {
                    setActiveLiveMatch(null);
                } else {
                    setActiveLiveMatch(matchId);
                }
            });
        });

        if (obsZoomOutBtn) obsZoomOutBtn.addEventListener('click', () => changeObsScale(-5));
        if (obsZoomInBtn) obsZoomInBtn.addEventListener('click', () => changeObsScale(+5));
        if (obsQuickAutoBtn) obsQuickAutoBtn.addEventListener('click', toggleObsAutoFit);

        const obsAutoEnhanceBtn = document.getElementById('obsAutoEnhanceBtn');
        if (obsAutoEnhanceBtn) {
            obsAutoEnhanceBtn.addEventListener('click', () => {
                document.querySelectorAll('.obs-focused').forEach(el => el.classList.remove('obs-focused'));
                obsConfig.scaleMode = 'auto';
                obsConfig.infoBarPos = 'top';
                obsConfig.align = 'center';
                syncModalInputsFromConfig();
                syncQuickToolbarUI();
                updateObsLinkAndBroadcast();
                showToast('✨ OBS Görünümü Otomatik Optimize Edildi & Kusursuzlaştırıldı!');
            });
        }

        if (obsResetFocusBtn) {
            obsResetFocusBtn.addEventListener('click', () => {
                document.querySelectorAll('.obs-focused').forEach(el => el.classList.remove('obs-focused'));
                syncQuickToolbarUI();
                const tc = document.getElementById('teamsContainer');
                if (tc) {
                    tc.setAttribute('data-last-focus', Date.now());
                    obsSyncChannel.postMessage({ type: 'sync_html', html: tc.innerHTML, modeClass: tc.className });
                }
                showToast('📺 Tek maç odaklanması kaldırıldı, tüm ağaç yayında.');
            });
        }

        const openObsModalHandler = () => {
            if (typeof closeSettingsDrawer === 'function') closeSettingsDrawer();
            syncModalInputsFromConfig();
            if (obsLinkModal) obsLinkModal.classList.remove('hidden');
        };

        if (obsOverlayBtn) obsOverlayBtn.addEventListener('click', openObsModalHandler);
        if (obsQuickSettingsBtn) obsQuickSettingsBtn.addEventListener('click', openObsModalHandler);
        
        const closeObsModal = () => {
            if (obsLinkModal) obsLinkModal.classList.add('hidden');
        };
        if (closeObsLinkModalBtn) closeObsLinkModalBtn.addEventListener('click', closeObsModal);
        if (closeObsLinkModalFooterBtn) closeObsLinkModalFooterBtn.addEventListener('click', closeObsModal);
        
        if (copyObsLinkBtn) {
            copyObsLinkBtn.addEventListener('click', () => {
                if (obsLinkInput) {
                    obsLinkInput.select();
                    document.execCommand('copy');
                    copyObsLinkBtn.innerHTML = '<i class="fa-solid fa-check"></i> Kopyalandı!';
                    copyObsLinkBtn.classList.replace('primary-btn', 'guide-btn-secondary');
                    setTimeout(() => {
                        copyObsLinkBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Kopyala';
                        copyObsLinkBtn.classList.replace('guide-btn-secondary', 'primary-btn');
                    }, 2000);
                }
            });
        }

        // Global Klavye Kısayolları ([ = Küçült, ] = Büyüt, \ = Auto-Fit, O = OBS Ayarları)
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
            if (e.key === '[') {
                e.preventDefault();
                changeObsScale(-5);
            } else if (e.key === ']') {
                e.preventDefault();
                changeObsScale(+5);
            } else if (e.key === '\\') {
                e.preventDefault();
                toggleObsAutoFit();
            } else if (e.key === 'o' || e.key === 'O') {
                e.preventDefault();
                openObsModalHandler();
            } else if (e.key === 'Escape') {
                const focused = document.querySelectorAll('.obs-focused');
                if (focused.length > 0) {
                    e.preventDefault();
                    focused.forEach(el => el.classList.remove('obs-focused'));
                    const tc = document.getElementById('teamsContainer');
                    if (tc && typeof obsSyncChannel !== 'undefined') {
                        obsSyncChannel.postMessage({ type: 'sync_html', html: tc.innerHTML, modeClass: tc.className });
                    }
                    showToast('🔍 OBS Odaklaması sıfırlandı (Genel görünüm).');
                }
            }
        });

        // Focus değişikliklerini gözlemleyip Toolbar'ı dinamik güncelle
        const tcObserver = new MutationObserver(() => {
            syncQuickToolbarUI();
        });
        const teamsContainerEl = document.getElementById('teamsContainer');
        if (teamsContainerEl) {
            tcObserver.observe(teamsContainerEl, { subtree: true, attributes: true, attributeFilter: ['class', 'data-last-focus'] });
        }

        // İlk açılışta hızlı barı senkronize et
        syncModalInputsFromConfig();
        syncQuickToolbarUI();
    }
    function showToast(message, isError = false) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.className = 'toast ' + (isError ? 'error' : '');
        setTimeout(() => {
            toast.className = 'toast hidden';
        }, 3000);
    }

    const _origHandleTournamentMatchWin = handleTournamentMatchWin;
    function checkAndInitLosers() {
        if (typeof tournamentMatches === 'undefined' || !tournamentMatches) return;
        const sf1Done = tournamentMatches['m_sf_1'] && tournamentMatches['m_sf_1'].winner;
        const sf2Done = tournamentMatches['m_sf_2'] && tournamentMatches['m_sf_2'].winner;
        if (sf1Done && sf2Done && typeof gameModeSelect !== 'undefined' && gameModeSelect.value === 'tournament') {
            if (typeof losersMatches === 'undefined' || !losersMatches) {
                if (typeof getInitialLosersMatches === 'function') {
                    window.losersMatches = getInitialLosersMatches();
                }
            }
            if (typeof syncLosersFromSF === 'function') syncLosersFromSF();
        }
    }

    const _origInitTeams = initTeams;
    window.initTeams = function() {
        if (typeof _origInitTeams === 'function') _origInitTeams();
    };

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
            title: '<i class="fa-brands fa-kickstarter"></i> Kick Chat & Katılım Komutu Filtresi',
            text: 'Kick kanal adınızı yazıp <b>Chat\'e Bağlan</b> butonuna tıklayın. Yayınınızda sadece sohbete <b>!kingsc</b> (veya belirlediğiniz komutu) yazan izleyiciler otomatik olarak İzleyici Havuzuna eklenir.'
        },
        {
            target: '.controls',
            title: '<i class="fa-solid fa-sliders"></i> Oyun Modu & 8 Takım Turnuva Ağacı',
            text: 'Oyun formatını belirleyin! <b>Tek Maç (2 Takım)</b> veya <b>Turnuva (8 Takım - Turnuva Ağacı)</b> seçebilir; takım boyutunu <b>5v5, 8v8 veya 11v11</b> olarak ayarlayabilirsiniz. Katılım komutunu da bu alandan özelleştirebilirsiniz.'
        },
        {
            target: '.pool-container',
            title: '<i class="fa-solid fa-users"></i> İzleyici Havuzu & Manuel Ekleme',
            text: 'Sohbetten gelen izleyiciler burada toplanır. Dilerseniz arama kutusuna isim yazıp <b>+</b> butonuna veya Enter\'a basarak manuel olarak da oyuncu ekleyebilirsiniz.'
        },
        {
            target: '.action-buttons',
            title: '<i class="fa-solid fa-shuffle"></i> Hızlı Aksiyonlar, Test & Sıfırlama',
            text: '<b>Rastgele Dağıt</b> butonu ile oyuncuları adil paylaştırabilir, <b>+10 Test</b> ile bot ekleyebilir ve <b>Turnuvayı Sıfırla</b> ile fikstürü baştan başlatabilirsiniz.'
        },
        {
            target: '.app-header',
            title: '<i class="fa-solid fa-crown"></i> Yeni Modern Üst Menü & Kick Chat',
            text: 'Tasarım tamamen yenilendi! Kanal adınızı yazıp <b>Chat\'e Bağlan</b> diyerek izleyicileri otomatik toplayabilir; sağdaki butonlardan <b>Sıralama</b>, <b>Rehber</b> ve <b>Ayarlar Çekmecesi</b>ne anında ulaşabilirsiniz.'
        },
        {
            target: '.connection-panel',
            title: '<i class="fa-brands fa-kickstarter"></i> Kesintisiz Kick Chat Bağlantısı',
            text: 'Yayınınızda izleyicilerin sohbete katılım komutunu (varsayılan: <b>!kingsc</b>) yazması yeterlidir. Bağlantı durumunuzu yeşil/kırmızı rozetten canlı takip edebilirsiniz.'
        },
        {
            target: '#leaderboardBtn',
            title: '<i class="fa-solid fa-trophy"></i> Rekabetçi Sıralama & Kademeler',
            text: 'Oyuncuların maç sonuçlarına göre <b>Win Rate (%)</b>, Gol, Pas ve Kurtarışları işlenir. <b>Bronz\'dan Efsane\'ye</b> kadar dinamik kademeleri bu panelden filtreleyebilir ve dışa aktarabilirsiniz.'
        },
        {
            target: '#settingsDrawerBtn',
            title: '<i class="fa-solid fa-sliders"></i> Sağdan Açılan Ayarlar & Kontrol Çekmecesi (S)',
            text: 'Tek tıkla veya klavyeden <b>S</b> tuşuna basarak açılan bu modern çekmecede: <b>4 Müzik Teması</b>, <b>OBS Yayın Araçları</b>, <b>Ortak Veri Merkezi</b> ve <b>Kick Gelişmiş Ayarlar</b> yer alır.'
        },
        {
            target: '.controls',
            title: '<i class="fa-solid fa-gamepad"></i> Oyun Modu, Takım Boyutu & Komut',
            text: '<b>Tek Maç</b> veya <b>8 Takım Turnuva Ağacı</b> formatını seçin. Takım boyutunu 5v5, 8v8 veya 11v11 yapabilir; katılım komutunu anında özelleştirebilirsiniz.'
        },
        {
            target: '#toggleAdvancedToolsBtn',
            title: '<i class="fa-solid fa-layer-group"></i> Katlanabilir Gelişmiş Araçlar Paneli (T)',
            text: 'OBS Canlı Hızlı Ölçek butonları ve <b>+10 Test İzleyici</b> aracı tek tıkla veya <b>T</b> tuşu ile açılıp kapanan bu kompakt panel altına yerleştirilmiştir.'
        },
        {
            target: '#poolContainer',
            title: '<i class="fa-solid fa-users"></i> İzleyici Havuzu & Tek Tıkla Daraltma',
            text: 'Sohbetten gelen oyuncular burada listelenir. Dilerseniz başlığın sağındaki ok simgesine basarak havuzu dikey şeride daraltabilir, sahaya ve turnuvaya tam alan açabilirsiniz.'
        },
        {
            target: '#randomizeBtn',
            title: '<i class="fa-solid fa-shuffle"></i> Rastgele Dağıt & Aksiyonlar',
            text: '<b>Rastgele Dağıt</b> ile havuzdaki izleyicileri takımlara adil ve dengeli biçimde paylaştırabilirsiniz. Turnuva bittiğinde <b>Turnuvayı Sıfırla</b> butonu fikstürü yeniler.'
        },
        {
            target: '#teamsContainer',
            title: '<i class="fa-solid fa-sitemap"></i> Takımlar, Maç Alanı & Canlı Skor Girişi',
            text: 'Takım kartlarındaki <b>🏆 Kazandı</b> butonuna basarak maç sonuçlarını, golleri, pasları ve kurtarışları işleyebilirsiniz. Turnuva modunda kazananlar otomatik tur atlar!'
        },
        {
            target: '#guideBtn',
            title: '<i class="fa-solid fa-book-open"></i> Kılavuz & Yardım Merkezi (H)',
            text: 'Detaylı turnuva kuralları, OBS rehberi, çoklu yayıncı veri merkezi ve klavye kısayolları için dilediğiniz an <b>H</b> tuşuna basarak yardım merkezine ulaşabilirsiniz.'
        }
    ];

    function showGuideStep(stepIndex) {
        if (!guideOverlay || !tourSteps[stepIndex]) return;
        
        currentGuideStep = stepIndex;
        const step = tourSteps[stepIndex];
        
        if (guideStepBadge) guideStepBadge.textContent = 'Adım ' + (stepIndex + 1) + ' / ' + tourSteps.length;
        if (guideTitle) guideTitle.innerHTML = step.title;
        if (guideText) guideText.innerHTML = step.text;
        
        if (guidePrevBtn) guidePrevBtn.style.display = stepIndex === 0 ? 'none' : 'inline-block';
        if (guideNextBtn) guideNextBtn.innerHTML = stepIndex === tourSteps.length - 1 ? 'Bitir <i class="fa-solid fa-check"></i>' : 'İleri <i class="fa-solid fa-chevron-right"></i>';
        
        if (guideDotsContainer) {
            guideDotsContainer.innerHTML = '';
            tourSteps.forEach((_, i) => {
                const dot = document.createElement('div');
                dot.className = 'guide-dot ' + (i === stepIndex ? 'active' : '');
                dot.onclick = () => showGuideStep(i);
                guideDotsContainer.appendChild(dot);
            });
        }
        
        const targetEl = document.querySelector(step.target);
        if (targetEl && guideSpotlight) {
            const rect = targetEl.getBoundingClientRect();
            guideSpotlight.style.top = (rect.top - 10) + 'px';
            guideSpotlight.style.left = (rect.left - 10) + 'px';
            guideSpotlight.style.width = (rect.width + 20) + 'px';
            guideSpotlight.style.height = (rect.height + 20) + 'px';
            guideSpotlight.style.display = 'block';
        } else if (guideSpotlight) {
            guideSpotlight.style.display = 'none';
        }
    }

    function openGuide() {
        if (!guideOverlay) return;
        isGuideActive = true;
        guideOverlay.classList.remove('hidden');
        showGuideStep(0);
    }

    function closeGuide() {
        if (!guideOverlay) return;
        isGuideActive = false;
        guideOverlay.classList.add('hidden');
    }

    if (guideCloseBtn) guideCloseBtn.addEventListener('click', closeGuide);
    if (guideNextBtn) guideNextBtn.addEventListener('click', () => {
        if (currentGuideStep < tourSteps.length - 1) showGuideStep(currentGuideStep + 1);
        else closeGuide();
    });
    if (guidePrevBtn) guidePrevBtn.addEventListener('click', () => {
        if (currentGuideStep > 0) showGuideStep(currentGuideStep - 1);
    });

    // =========================================================================
    // Kapsamlı Rehber & Kılavuz Modalı (Comprehensive Guide Modal)
    // =========================================================================
    const comprehensiveGuideModal = document.getElementById('comprehensiveGuideModal');
    const closeComprehensiveGuideBtn = document.getElementById('closeComprehensiveGuideBtn');
    const closeComprehensiveGuideFooterBtn = document.getElementById('closeComprehensiveGuideFooterBtn');
    const startInteractiveTourBtn = document.getElementById('startInteractiveTourBtn');

    function openComprehensiveGuide(tab = 'tour') {
        if (!comprehensiveGuideModal) return;
        comprehensiveGuideModal.classList.remove('hidden');
        playUiSfx('click');

        // İlgili sekmeyi aktifleştir
        document.querySelectorAll('.guide-tab-btn').forEach(btn => {
            const match = btn.dataset.guideTab === tab;
            btn.classList.toggle('active', match);
        });
        document.querySelectorAll('.guide-modal-body .guide-tab-pane').forEach(pane => {
            const paneId = 'guideTab' + tab.charAt(0).toUpperCase() + tab.slice(1);
            pane.classList.toggle('active', pane.id === paneId);
        });
    }

    function closeComprehensiveGuide() {
        if (!comprehensiveGuideModal) return;
        comprehensiveGuideModal.classList.add('hidden');
        playUiSfx('click');
    }

    if (guideBtn) {
        guideBtn.addEventListener('click', () => openComprehensiveGuide('tour'));
    }
    if (closeComprehensiveGuideBtn) {
        closeComprehensiveGuideBtn.addEventListener('click', closeComprehensiveGuide);
    }
    if (closeComprehensiveGuideFooterBtn) {
        closeComprehensiveGuideFooterBtn.addEventListener('click', closeComprehensiveGuide);
    }
    if (comprehensiveGuideModal) {
        comprehensiveGuideModal.addEventListener('click', (e) => {
            if (e.target === comprehensiveGuideModal) closeComprehensiveGuide();
        });
    }
    if (startInteractiveTourBtn) {
        startInteractiveTourBtn.addEventListener('click', () => {
            closeComprehensiveGuide();
            setTimeout(openGuide, 250);
        });
    }

    // Rehber Sekme Geçişleri
    document.querySelectorAll('.guide-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            playUiSfx('click');
            const targetTab = btn.dataset.guideTab;
            document.querySelectorAll('.guide-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
            document.querySelectorAll('.guide-modal-body .guide-tab-pane').forEach(pane => {
                const paneId = 'guideTab' + targetTab.charAt(0).toUpperCase() + targetTab.slice(1);
                pane.classList.toggle('active', pane.id === paneId);
            });
        });
    });

    // =========================================================================
    // Sağdan Kayan Kontrol & Ayarlar Çekmecesi (Offcanvas Settings Drawer)
    // =========================================================================
    const settingsDrawer = document.getElementById('settingsDrawer');
    const drawerOverlay = document.getElementById('drawerOverlay');
    const settingsDrawerBtn = document.getElementById('settingsDrawerBtn');
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');

    function openSettingsDrawer(tab = 'music') {
        if (!settingsDrawer || !drawerOverlay) return;
        
        // OBS Linkini doldur
        const drawerObsLinkInput = document.getElementById('drawerObsLinkInput');
        if (drawerObsLinkInput) {
            const loc = window.location;
            drawerObsLinkInput.value = `${loc.protocol}//${loc.host}${loc.pathname}?overlay=1`;
        }

        // Ses kontrollerini senkronize et
        const drawerMusicToggle = document.getElementById('drawerMusicToggle');
        const drawerMusicVol = document.getElementById('drawerMusicVolumeSlider');
        const drawerMusicVal = document.getElementById('drawerMusicVolumeValue');
        const drawerSfxToggle = document.getElementById('drawerSfxToggle');
        const drawerSfxVol = document.getElementById('drawerSfxVolumeSlider');
        const drawerSfxVal = document.getElementById('drawerSfxVolumeValue');

        if (drawerMusicToggle) drawerMusicToggle.checked = musicEnabled;
        if (drawerMusicVol) {
            drawerMusicVol.value = Math.round(musicVolume * 100);
            if (drawerMusicVal) drawerMusicVal.textContent = `${drawerMusicVol.value}%`;
        }
        if (drawerSfxToggle) drawerSfxToggle.checked = sfxEnabled;
        if (drawerSfxVol) {
            drawerSfxVol.value = Math.round(sfxVolume * 100);
            if (drawerSfxVal) drawerSfxVal.textContent = `${drawerSfxVol.value}%`;
        }

        // Tema kartını seç
        document.querySelectorAll('.theme-card').forEach(card => {
            const radio = card.querySelector('input[type="radio"]');
            if (radio) {
                const match = radio.value === musicTheme;
                radio.checked = match;
                card.classList.toggle('active', match);
            }
        });

        // İlgili sekmeyi göster
        document.querySelectorAll('.drawer-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.drawerTab === tab);
        });
        document.querySelectorAll('.drawer-tab-pane').forEach(pane => {
            const paneId = 'drawerTab' + tab.charAt(0).toUpperCase() + tab.slice(1);
            pane.classList.toggle('active', pane.id === paneId);
        });

        drawerOverlay.classList.remove('hidden');
        drawerOverlay.classList.add('open');
        settingsDrawer.classList.remove('hidden');
        settingsDrawer.classList.add('open');
        playUiSfx('click');
    }

    function closeSettingsDrawer() {
        if (!settingsDrawer || !drawerOverlay) return;
        drawerOverlay.classList.remove('open');
        settingsDrawer.classList.remove('open');
        setTimeout(() => {
            drawerOverlay.classList.add('hidden');
            settingsDrawer.classList.add('hidden');
        }, 300);
        playUiSfx('click');
    }

    if (settingsDrawerBtn) settingsDrawerBtn.addEventListener('click', () => openSettingsDrawer('music'));
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeSettingsDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener('click', closeSettingsDrawer);

    // Çekmece Sekme Değiştirici
    document.querySelectorAll('.drawer-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            playUiSfx('click');
            const tabKey = btn.dataset.drawerTab;
            document.querySelectorAll('.drawer-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
            document.querySelectorAll('.drawer-tab-pane').forEach(pane => {
                const paneId = 'drawerTab' + tabKey.charAt(0).toUpperCase() + tabKey.slice(1);
                pane.classList.toggle('active', pane.id === paneId);
            });
        });
    });

    // Tema Seçici Kartları Dinle
    document.querySelectorAll('.theme-card').forEach(card => {
        card.addEventListener('click', () => {
            const radio = card.querySelector('input[type="radio"]');
            if (radio && radio.value) {
                playUiSfx('click');
                setMusicTheme(radio.value);
            }
        });
    });

    // Çekmece Ses Kontrolleri
    const drawerMusicToggle = document.getElementById('drawerMusicToggle');
    if (drawerMusicToggle) {
        drawerMusicToggle.addEventListener('change', () => {
            musicEnabled = drawerMusicToggle.checked;
            localStorage.setItem('audio_music_enabled', musicEnabled);
            if (musicToggle) musicToggle.checked = musicEnabled;
            if (musicEnabled) playBackgroundMusic();
            else stopBackgroundMusic();
            playUiSfx('click');
        });
    }

    const drawerMusicVolumeSlider = document.getElementById('drawerMusicVolumeSlider');
    const drawerMusicVolumeValue = document.getElementById('drawerMusicVolumeValue');
    if (drawerMusicVolumeSlider) {
        drawerMusicVolumeSlider.addEventListener('input', () => {
            musicVolume = parseFloat(drawerMusicVolumeSlider.value) / 100;
            if (drawerMusicVolumeValue) drawerMusicVolumeValue.textContent = `${drawerMusicVolumeSlider.value}%`;
            if (musicVolumeSlider) {
                musicVolumeSlider.value = drawerMusicVolumeSlider.value;
                if (musicVolumeValue) musicVolumeValue.textContent = `${drawerMusicVolumeSlider.value}%`;
            }
            localStorage.setItem('audio_music_volume', drawerMusicVolumeSlider.value);
            updateMusicVolume();
        });
    }

    const drawerSfxToggle = document.getElementById('drawerSfxToggle');
    if (drawerSfxToggle) {
        drawerSfxToggle.addEventListener('change', () => {
            sfxEnabled = drawerSfxToggle.checked;
            localStorage.setItem('audio_sfx_enabled', sfxEnabled);
            if (sfxToggle) sfxToggle.checked = sfxEnabled;
            if (sfxEnabled) playUiSfx('click');
        });
    }

    const drawerSfxVolumeSlider = document.getElementById('drawerSfxVolumeSlider');
    const drawerSfxVolumeValue = document.getElementById('drawerSfxVolumeValue');
    if (drawerSfxVolumeSlider) {
        drawerSfxVolumeSlider.addEventListener('input', () => {
            sfxVolume = parseFloat(drawerSfxVolumeSlider.value) / 100;
            if (drawerSfxVolumeValue) drawerSfxVolumeValue.textContent = `${drawerSfxVolumeSlider.value}%`;
            if (sfxVolumeSlider) {
                sfxVolumeSlider.value = drawerSfxVolumeSlider.value;
                if (sfxVolumeValue) sfxVolumeValue.textContent = `${drawerSfxVolumeSlider.value}%`;
            }
            localStorage.setItem('audio_sfx_volume', drawerSfxVolumeSlider.value);
        });
    }

    // Çekmece SFX Test Butonları
    const testWhistleBtn = document.getElementById('testWhistleBtn');
    if (testWhistleBtn) testWhistleBtn.addEventListener('click', () => playWhistleSfx());

    const testGoalHornBtn = document.getElementById('testGoalHornBtn');
    if (testGoalHornBtn) testGoalHornBtn.addEventListener('click', () => playGoalHornSfx());

    const testVictoryBtn = document.getElementById('testVictoryBtn');
    if (testVictoryBtn) testVictoryBtn.addEventListener('click', () => {
        playUiSfx('win');
        setTimeout(() => playIronOnConcreteSound('final'), 350);
    });

    const testClickBtn = document.getElementById('testClickBtn');
    if (testClickBtn) testClickBtn.addEventListener('click', () => playUiSfx('click'));

    // Çekmece OBS Link Kopyalama
    const drawerCopyObsLinkBtn = document.getElementById('drawerCopyObsLinkBtn');
    const drawerObsLinkInput = document.getElementById('drawerObsLinkInput');
    if (drawerCopyObsLinkBtn && drawerObsLinkInput) {
        drawerCopyObsLinkBtn.addEventListener('click', () => {
            drawerObsLinkInput.select();
            document.execCommand('copy');
            drawerCopyObsLinkBtn.innerHTML = '<i class="fa-solid fa-check"></i> Kopyalandı!';
            showToast('📋 OBS Browser Source linki panoya kopyalandı!');
            playUiSfx('click');
            setTimeout(() => {
                drawerCopyObsLinkBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Kopyala';
            }, 2500);
        });
    }

    // Çekmece OBS Canlı Maç Butonları
    document.querySelectorAll('.drawer-live-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const matchKey = btn.dataset.match || '';
            const obsSelect = document.getElementById('obsQuickLiveMatchSelect');
            if (obsSelect) {
                obsSelect.value = matchKey;
                obsSelect.dispatchEvent(new Event('change'));
            }
            const modalSelect = document.getElementById('obsLiveMatchSelect');
            if (modalSelect) {
                modalSelect.value = matchKey;
                modalSelect.dispatchEvent(new Event('change'));
            }
            document.querySelectorAll('.drawer-live-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.match === matchKey && matchKey !== '');
            });
            playUiSfx('click');
            showToast(matchKey ? `🔴 Canlı maç: ${btn.textContent.trim()}` : 'Canlı maç vurgusu kapatıldı.');
        });
    });

    // Çekmece OBS Ölçek Presetleri
    document.querySelectorAll('.drawer-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const scale = parseInt(btn.dataset.scale, 10);
            const slider = document.getElementById('drawerObsScaleSlider');
            const badge = document.getElementById('drawerObsScaleValue');
            if (slider) {
                slider.value = scale;
                if (badge) badge.textContent = `${scale}%`;
                slider.dispatchEvent(new Event('input'));
            }
            const mainSlider = document.getElementById('obsScaleSlider');
            if (mainSlider) {
                mainSlider.value = scale;
                mainSlider.dispatchEvent(new Event('input'));
            }
            playUiSfx('click');
        });
    });

    // Çekmece Tünel Butonları
    const drawerStartTunnelBtn = document.getElementById('drawerStartTunnelBtn');
    const drawerStopTunnelBtn = document.getElementById('drawerStopTunnelBtn');
    const startTunnelBtn = document.getElementById('startTunnelBtn');
    const stopTunnelBtn = document.getElementById('stopTunnelBtn');

    if (drawerStartTunnelBtn && startTunnelBtn) {
        drawerStartTunnelBtn.addEventListener('click', () => {
            startTunnelBtn.click();
            playUiSfx('click');
        });
    }
    if (drawerStopTunnelBtn && stopTunnelBtn) {
        drawerStopTunnelBtn.addEventListener('click', () => {
            stopTunnelBtn.click();
            playUiSfx('click');
        });
    }

    const drawerCopyTunnelUrlBtn = document.getElementById('drawerCopyTunnelUrlBtn');
    const drawerTunnelUrlInput = document.getElementById('drawerTunnelUrlInput');
    if (drawerCopyTunnelUrlBtn && drawerTunnelUrlInput) {
        drawerCopyTunnelUrlBtn.addEventListener('click', () => {
            drawerTunnelUrlInput.select();
            document.execCommand('copy');
            showToast('📋 Cloudflare tünel linki kopyalandı!');
            playUiSfx('click');
        });
    }

    const copyPublishUrlBtn = document.getElementById('copyPublishUrlBtn');
    const drawerPublishUrlInput = document.getElementById('drawerPublishUrlInput');
    if (copyPublishUrlBtn && drawerPublishUrlInput) {
        copyPublishUrlBtn.addEventListener('click', () => {
            drawerPublishUrlInput.select();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(drawerPublishUrlInput.value).catch(() => {});
            } else {
                document.execCommand('copy');
            }
            showToast('🌐 Canlı yayın linki panoya kopyalandı!');
            playUiSfx('click');
        });
    }

    const drawerConnectHubBtn = document.getElementById('drawerConnectHubBtn');
    const drawerHubRemoteUrlInput = document.getElementById('drawerHubRemoteUrlInput');
    if (drawerConnectHubBtn && drawerHubRemoteUrlInput) {
        drawerConnectHubBtn.addEventListener('click', () => {
            const url = drawerHubRemoteUrlInput.value.trim();
            if (url) {
                HubClient.connectAsClient(url, true);
                playUiSfx('click');
            } else {
                showToast('Lütfen geçerli bir tünel URL adresi girin!', true);
            }
        });
    }

    const drawerExportHubDbBtn = document.getElementById('drawerExportHubDbBtn');
    const origExportHubDbBtn = document.getElementById('exportHubDbBtn');
    if (drawerExportHubDbBtn && origExportHubDbBtn) {
        drawerExportHubDbBtn.addEventListener('click', () => origExportHubDbBtn.click());
    }

    const drawerResetHubDbBtn = document.getElementById('drawerResetHubDbBtn');
    const origResetHubDbBtn = document.getElementById('resetHubDbBtn');
    if (drawerResetHubDbBtn && origResetHubDbBtn) {
        drawerResetHubDbBtn.addEventListener('click', () => origResetHubDbBtn.click());
    }

    // Çekmece Manuel Chatroom ID
    const drawerSaveChatroomIdBtn = document.getElementById('drawerSaveChatroomIdBtn');
    const drawerManualChatroomIdInput = document.getElementById('drawerManualChatroomIdInput');
    const origSaveChatroomIdBtn = document.getElementById('saveChatroomIdBtn');
    const origManualChatroomIdInput = document.getElementById('manualChatroomIdInput');
    if (drawerSaveChatroomIdBtn && drawerManualChatroomIdInput && origManualChatroomIdInput && origSaveChatroomIdBtn) {
        drawerSaveChatroomIdBtn.addEventListener('click', () => {
            origManualChatroomIdInput.value = drawerManualChatroomIdInput.value;
            origSaveChatroomIdBtn.click();
            playUiSfx('click');
        });
    }

    // =========================================================================
    // Katlanabilir Gelişmiş Kontrol Paneli (Advanced Controls Panel)
    // =========================================================================
    const toggleAdvancedToolsBtn = document.getElementById('toggleAdvancedToolsBtn');
    const advancedControlsPanel = document.getElementById('advancedControlsPanel');
    const advancedArrow = document.getElementById('advancedArrow');

    function toggleAdvancedTools() {
        if (!advancedControlsPanel) return;
        const isHidden = advancedControlsPanel.classList.contains('hidden');
        if (isHidden) {
            advancedControlsPanel.classList.remove('hidden');
            if (toggleAdvancedToolsBtn) toggleAdvancedToolsBtn.classList.add('open');
        } else {
            advancedControlsPanel.classList.add('hidden');
            if (toggleAdvancedToolsBtn) toggleAdvancedToolsBtn.classList.remove('open');
        }
        playUiSfx('click');
    }

    if (toggleAdvancedToolsBtn) {
        toggleAdvancedToolsBtn.addEventListener('click', toggleAdvancedTools);
    }

    // =========================================================================
    // İzleyici Havuzu Dikey Daraltma / Genişletme (Collapsible Pool Panel)
    // =========================================================================
    const togglePoolCollapseBtn = document.getElementById('togglePoolCollapseBtn');
    const poolContainer = document.getElementById('poolContainer');
    const poolToggleIcon = document.getElementById('poolToggleIcon');
    const poolCollapsedStrip = document.getElementById('poolCollapsedStrip');
    const collapsedPoolCount = document.getElementById('collapsedPoolCount');

    function updateCollapsedPoolCount() {
        if (collapsedPoolCount && poolCount) {
            collapsedPoolCount.textContent = poolCount.textContent;
        }
    }

    function togglePoolCollapse(forceState = null) {
        if (!poolContainer) return;
        const willCollapse = forceState !== null ? forceState : !poolContainer.classList.contains('collapsed');
        
        if (willCollapse) {
            poolContainer.classList.add('collapsed');
            if (poolCollapsedStrip) poolCollapsedStrip.classList.remove('hidden');
            if (poolToggleIcon) {
                poolToggleIcon.classList.replace('fa-chevron-left', 'fa-chevron-right');
            }
            updateCollapsedPoolCount();
        } else {
            poolContainer.classList.remove('collapsed');
            if (poolCollapsedStrip) poolCollapsedStrip.classList.add('hidden');
            if (poolToggleIcon) {
                poolToggleIcon.classList.replace('fa-chevron-right', 'fa-chevron-left');
            }
        }
        localStorage.setItem('kick_strikers_pool_collapsed', willCollapse ? '1' : '0');
        playUiSfx('click');
    }

    if (togglePoolCollapseBtn) {
        togglePoolCollapseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePoolCollapse();
        });
    }
    if (poolCollapsedStrip) {
        poolCollapsedStrip.addEventListener('click', () => togglePoolCollapse(false));
    }

    // Kayıtlı havuz durumunu yükle
    if (localStorage.getItem('kick_strikers_pool_collapsed') === '1') {
        togglePoolCollapse(true);
    }

    // =========================================================================
    // Klavye Kısayolları (H, S, T, [, ], \, Esc)
    // =========================================================================
    document.addEventListener('keydown', (e) => {
        // Form girdilerinde iken harf kısayollarını tetikleme
        const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT';
        
        if (e.key === 'Escape') {
            if (isGuideActive) closeGuide();
            if (comprehensiveGuideModal && !comprehensiveGuideModal.classList.contains('hidden')) closeComprehensiveGuide();
            if (settingsDrawer && settingsDrawer.classList.contains('open')) closeSettingsDrawer();
            if (audioModal && !audioModal.classList.contains('hidden')) closeAudioModal();
            if (leaderboardModal && !leaderboardModal.classList.contains('hidden')) closeLeaderboard();
            if (kickModal && !kickModal.classList.contains('hidden')) closeKickModal();
            if (obsLinkModal && !obsLinkModal.classList.contains('hidden')) closeObsLinkModal();
            return;
        }

        if (isInput) return;

        if (e.key === 'h' || e.key === 'H') {
            if (isGuideActive) {
                closeGuide();
            } else if (comprehensiveGuideModal && !comprehensiveGuideModal.classList.contains('hidden')) {
                closeComprehensiveGuide();
            } else {
                openComprehensiveGuide('tour');
            }
        } else if (e.key === 's' || e.key === 'S') {
            if (settingsDrawer && settingsDrawer.classList.contains('open')) {
                closeSettingsDrawer();
            } else {
                openSettingsDrawer('music');
            }
        } else if (e.key === 't' || e.key === 'T') {
            toggleAdvancedTools();
        }

        if (isGuideActive) {
            if (e.key === 'ArrowRight' && currentGuideStep < tourSteps.length - 1) showGuideStep(currentGuideStep + 1);
            if (e.key === 'ArrowLeft' && currentGuideStep > 0) showGuideStep(currentGuideStep - 1);
        }
    });

    // Global erişilebilirlik için window üzerine bağla
    window.openSettingsDrawer = openSettingsDrawer;
    window.closeSettingsDrawer = closeSettingsDrawer;
    window.openComprehensiveGuide = openComprehensiveGuide;
    window.closeComprehensiveGuide = closeComprehensiveGuide;
    window.toggleAdvancedTools = toggleAdvancedTools;
    window.togglePoolCollapse = togglePoolCollapse;
    window.setMusicTheme = setMusicTheme;
    window.playWhistleSfx = playWhistleSfx;
    window.playGoalHornSfx = playGoalHornSfx;

    // =========================================================================
    // Ortak Veri Merkezi (Data Hub) ve Gerçek Zamanlı Senkronizasyon Modülü
    // =========================================================================
    const HubClient = {
        mode: 'offline', // 'host' | 'client' | 'offline'
        baseUrl: '',
        lastEventId: 0,
        pollTimer: null,
        isConnected: false,
        ping: 0,
        syncIntervalMs: 2500,

        async init() {
            this.bindEvents();

            // 1. Kaydedilmiş uzak sunucu URL'si var mı kontrol et
            const savedRemoteUrl = localStorage.getItem('kick_strikers_hub_remote_url');
            if (savedRemoteUrl) {
                const ok = await this.connectAsClient(savedRemoteUrl, false);
                if (ok) return;
            }

            // 2. Eğer yerel sunucu (host) çalışıyorsa otomatik host olarak bağlan
            const hostOk = await this.checkLocalHost();
            if (hostOk) return;

            // 3. hub_config.json varsa kontrol et
            try {
                const res = await fetch('./hub_config.json', { cache: 'no-store' });
                if (res.ok) {
                    const cfg = await res.json();
                    if (cfg && cfg.remoteUrl) {
                        await this.connectAsClient(cfg.remoteUrl, false);
                    }
                }
            } catch (e) {}
        },

        async checkLocalHost() {
            try {
                const origin = (window.location.origin && window.location.origin.includes('http')) 
                    ? window.location.origin 
                    : 'http://localhost:18888';
                const res = await fetch(`${origin}/api/hub/status`, { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.hub && data.isHost) {
                        this.mode = 'host';
                        this.baseUrl = origin;
                        this.isConnected = true;
                        this.updatePill('host', 'Host (Aktif)');
                        this.startSync();
                        this.refreshHostDashboard(data);
                        return true;
                    }
                }
            } catch (e) {}
            return false;
        },

        async connectAsClient(url, notify = true) {
            url = url.trim().replace(/\/+$/, '');
            if (!url) return false;

            const tStart = Date.now();
            try {
                const res = await fetch(`${url}/api/hub/status`, { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.hub) {
                        this.ping = Date.now() - tStart;
                        this.mode = 'client';
                        this.baseUrl = url;
                        this.isConnected = true;
                        localStorage.setItem('kick_strikers_hub_remote_url', url);

                        this.updatePill('connected', 'Merkeze Bağlı');
                        this.updateClientStatusCard(true, url, data.playerCount || 0);
                        this.startSync();

                        if (notify) {
                            showToast('🎉 Merkezi Veri Havuzuna başarıyla bağlanıldı!', false);
                            if (typeof playUiSfx === 'function') playUiSfx('join');
                        }
                        return true;
                    }
                }
            } catch (err) {
                console.warn('Hub bağlantı hatası:', err);
            }

            if (notify) {
                showToast('Merkezi sunucuya bağlanılamadı! Lütfen linki ve sunucu durumunu kontrol edin.', true);
            }
            this.updateClientStatusCard(false, url, 0);
            return false;
        },

        disconnectClient() {
            this.stopSync();
            this.mode = 'offline';
            this.baseUrl = '';
            this.isConnected = false;
            localStorage.removeItem('kick_strikers_hub_remote_url');
            this.updatePill('offline', 'Yerel');
            this.updateClientStatusCard(false, '', 0);
            showToast('Merkezi Veri Havuzu bağlantısı kesildi. (Yerel moda geçildi)');
        },

        updatePill(type, text) {
            const pill = document.getElementById('hubStatusPill');
            if (!pill) return;
            pill.className = `hub-pill ${type}`;
            pill.textContent = text;
        },

        updateClientStatusCard(connected, url, playersCount) {
            const card = document.getElementById('hubClientStatusCard');
            const dot = document.getElementById('clientStatusDot');
            const statusText = document.getElementById('clientStatusText');
            const details = document.getElementById('clientCardDetails');
            const connectedUrlSpan = document.getElementById('clientConnectedUrl');
            const pingSpan = document.getElementById('clientPingText');
            const playersSpan = document.getElementById('clientSyncedPlayersText');
            const connectBtn = document.getElementById('connectHubBtn');
            const disconnectBtn = document.getElementById('disconnectHubBtn');

            if (!card) return;

            if (connected) {
                if (dot) dot.className = 'status-indicator-dot online';
                if (statusText) statusText.textContent = 'Merkezi Havuz Aktif (Senkronize)';
                if (details) details.style.display = 'grid';
                if (connectedUrlSpan) connectedUrlSpan.textContent = url;
                if (pingSpan) pingSpan.textContent = `${this.ping} ms`;
                if (playersSpan) playersSpan.textContent = playersCount;
                if (connectBtn) connectBtn.classList.add('hidden');
                if (disconnectBtn) disconnectBtn.classList.remove('hidden');
            } else {
                if (dot) dot.className = 'status-indicator-dot offline';
                if (statusText) statusText.textContent = 'Bağlantı Yok (Yerel Mod)';
                if (details) details.style.display = 'none';
                if (connectBtn) connectBtn.classList.remove('hidden');
                if (disconnectBtn) disconnectBtn.classList.add('hidden');
            }
        },

        startSync() {
            this.stopSync();
            this.poll(true);
            this.pollTimer = setInterval(() => this.poll(false), this.syncIntervalMs);
        },

        stopSync() {
            if (this.pollTimer) {
                clearInterval(this.pollTimer);
                this.pollTimer = null;
            }
        },

        async poll(isFull = false) {
            if (!this.baseUrl) return;
            try {
                const clientParam = encodeURIComponent(currentChannel || 'izleyici');
                const channelParam = encodeURIComponent(currentChannel || 'genel');
                const fullParam = isFull ? '&full=1' : '';
                const url = `${this.baseUrl}/api/hub/sync?since=${this.lastEventId}&client=${clientParam}&channel=${channelParam}${fullParam}`;

                const tStart = Date.now();
                const res = await fetch(url, { cache: 'no-store' });
                if (res.ok) {
                    this.ping = Date.now() - tStart;
                    const data = await res.json();
                    if (data && data.success) {
                        this.isConnected = true;

                        if (data.fullStats) {
                            try {
                                const parsedStats = typeof data.fullStats === 'string' ? JSON.parse(data.fullStats) : data.fullStats;
                                this.mergeStats(parsedStats);
                            } catch (e) {}
                        }

                        if (Array.isArray(data.events) && data.events.length > 0) {
                            data.events.forEach(ev => this.handleEvent(ev));
                        }

                        if (typeof data.lastId === 'number') {
                            this.lastEventId = Math.max(this.lastEventId, data.lastId);
                        }

                        const activeClientsEl = document.getElementById('hubActiveClientsCount');
                        if (activeClientsEl && data.activeClients) {
                            activeClientsEl.textContent = data.activeClients;
                        }
                    }
                }
            } catch (err) {}
        },

        handleEvent(event) {
            if (!event || !event.type) return;

            if (event.type === 'MATCH_RECORDED') {
                const toastMsg = event.summary || `🏆 ${event.streamer}: Maç sonuçlandı!`;
                showToast(toastMsg, false);
                if (typeof playUiSfx === 'function') playUiSfx('join');

                if (Array.isArray(event.playerUpdates)) {
                    event.playerUpdates.forEach(p => {
                        if (!p.name) return;
                        const key = p.name.trim().toLowerCase();
                        if (!channelStats[key]) {
                            channelStats[key] = { wins: 0, losses: 0, goals: 0, assists: 0, saves: 0, streak: 0, mvpCount: 0, displayName: p.name.trim() };
                        }
                        channelStats[key].goals = (channelStats[key].goals || 0) + (p.goals || 0);
                        channelStats[key].assists = (channelStats[key].assists || 0) + (p.assists || 0);
                        channelStats[key].saves = (channelStats[key].saves || 0) + (p.saves || 0);
                        if (p.win) {
                            channelStats[key].wins += 1;
                            channelStats[key].streak = (channelStats[key].streak || 0) + 1;
                        } else {
                            channelStats[key].losses += 1;
                            channelStats[key].streak = 0;
                        }
                        if (p.isMvp) {
                            channelStats[key].mvpCount = (channelStats[key].mvpCount || 0) + 1;
                        }
                        channelStats[key].displayName = p.name.trim();
                    });

                    saveChannelStats();
                    refreshAllPlayerElements();
                    if (leaderboardModal && !leaderboardModal.classList.contains('hidden')) {
                        renderLeaderboard();
                    }
                }
            } else if (event.type === 'STATS_RESET') {
                showToast('⚠️ Merkezi istatistik havuzu sıfırlandı.', true);
                channelStats = {};
                saveChannelStats();
                refreshAllPlayerElements();
                if (leaderboardModal && !leaderboardModal.classList.contains('hidden')) {
                    renderLeaderboard();
                }
            }
        },

        mergeStats(newStats) {
            if (!newStats || typeof newStats !== 'object') return;
            Object.keys(newStats).forEach(key => {
                const s = newStats[key];
                if (!channelStats[key]) {
                    channelStats[key] = { wins: 0, losses: 0, goals: 0, assists: 0, saves: 0, streak: 0, mvpCount: 0, displayName: s.displayName || key };
                }
                channelStats[key].wins = Math.max(channelStats[key].wins, s.wins || 0);
                channelStats[key].losses = Math.max(channelStats[key].losses, s.losses || 0);
                channelStats[key].goals = Math.max(channelStats[key].goals, s.goals || 0);
                channelStats[key].assists = Math.max(channelStats[key].assists, s.assists || 0);
                channelStats[key].saves = Math.max(channelStats[key].saves, s.saves || 0);
                channelStats[key].streak = Math.max(channelStats[key].streak || 0, s.streak || 0);
                channelStats[key].mvpCount = Math.max(channelStats[key].mvpCount || 0, s.mvpCount || 0);
                if (s.displayName) channelStats[key].displayName = s.displayName;
            });

            saveChannelStats();
            refreshAllPlayerElements();
            if (leaderboardModal && !leaderboardModal.classList.contains('hidden')) {
                renderLeaderboard();
            }

            const pCountEl = document.getElementById('hubRegisteredPlayersCount');
            if (pCountEl) pCountEl.textContent = Object.keys(channelStats).length;
        },

        async submitMatchResult(payload) {
            if (!this.baseUrl) return false;
            try {
                const res = await fetch(`${this.baseUrl}/api/hub/match-result`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.success) {
                        this.lastEventId = Math.max(this.lastEventId, data.eventId || 0);
                        return true;
                    }
                }
            } catch (err) {
                console.error('Merkeze maç iletme hatası:', err);
            }
            return false;
        },

        async refreshHostDashboard(cachedData = null) {
            try {
                const origin = this.baseUrl || window.location.origin;
                const data = cachedData || await (await fetch(`${origin}/api/hub/status`, { cache: 'no-store' })).json();
                if (!data) return;

                const pCountEl = document.getElementById('hubRegisteredPlayersCount');
                const clientsEl = document.getElementById('hubActiveClientsCount');
                const eventsEl = document.getElementById('hubTotalEventsCount');
                const tunnelBadge = document.getElementById('hubTunnelBadge');
                const tunnelContainer = document.getElementById('tunnelUrlContainer');
                const tunnelInput = document.getElementById('tunnelUrlInput');
                const startBtn = document.getElementById('startTunnelBtn');
                const stopBtn = document.getElementById('stopTunnelBtn');

                if (pCountEl) pCountEl.textContent = data.playerCount || Object.keys(channelStats).length;
                if (clientsEl) clientsEl.textContent = data.activeClients || 1;
                if (eventsEl) eventsEl.textContent = data.eventCount || 0;

                if (data.tunnelUrl) {
                    if (tunnelBadge) {
                        tunnelBadge.className = 'tunnel-status-badge active';
                        tunnelBadge.textContent = '🟢 Tünel Aktif';
                    }
                    if (tunnelContainer) tunnelContainer.classList.remove('hidden');
                    if (tunnelInput) tunnelInput.value = data.tunnelUrl;
                    if (startBtn) startBtn.classList.add('hidden');
                    if (stopBtn) stopBtn.classList.remove('hidden');
                } else {
                    if (tunnelBadge) {
                        tunnelBadge.className = 'tunnel-status-badge inactive';
                        tunnelBadge.textContent = 'Tünel Kapalı';
                    }
                    if (tunnelContainer) tunnelContainer.classList.add('hidden');
                    if (startBtn) {
                        startBtn.classList.remove('hidden');
                        startBtn.disabled = false;
                        startBtn.innerHTML = '<i class="fa-solid fa-play"></i> Tüneli Başlat (Cloudflare)';
                    }
                    if (stopBtn) stopBtn.classList.add('hidden');
                }

                // Drawer Hub Elemanlarını Senkronize Et
                const drawerPCount = document.getElementById('drawerHubPlayersCount');
                const drawerClients = document.getElementById('drawerHubClientsCount');
                const drawerTunnelWrap = document.getElementById('drawerTunnelUrlContainer');
                const drawerTunnelInp = document.getElementById('drawerTunnelUrlInput');
                const drawerStartT = document.getElementById('drawerStartTunnelBtn');
                const drawerStopT = document.getElementById('drawerStopTunnelBtn');

                if (drawerPCount) drawerPCount.textContent = data.playerCount || Object.keys(channelStats).length;
                if (drawerClients) drawerClients.textContent = data.activeClients || 1;

                if (data.tunnelUrl) {
                    if (drawerTunnelWrap) drawerTunnelWrap.classList.remove('hidden');
                    if (drawerTunnelInp) drawerTunnelInp.value = data.tunnelUrl;
                    if (drawerStartT) drawerStartT.classList.add('hidden');
                    if (drawerStopT) drawerStopT.classList.remove('hidden');
                } else {
                    if (drawerTunnelWrap) drawerTunnelWrap.classList.add('hidden');
                    if (drawerStartT) drawerStartT.classList.remove('hidden');
                    if (drawerStopT) drawerStopT.classList.add('hidden');
                }
            } catch (e) {}
        },

        bindEvents() {
            const dataHubBtn = document.getElementById('dataHubBtn');
            const hubModal = document.getElementById('hubModal');
            const closeHubModalBtn = document.getElementById('closeHubModalBtn');
            const closeHubModalFooterBtn = document.getElementById('closeHubModalFooterBtn');
            const hubTabHostBtn = document.getElementById('hubTabHostBtn');
            const hubTabClientBtn = document.getElementById('hubTabClientBtn');
            const hubHostPanel = document.getElementById('hubHostPanel');
            const hubClientPanel = document.getElementById('hubClientPanel');
            const startTunnelBtn = document.getElementById('startTunnelBtn');
            const stopTunnelBtn = document.getElementById('stopTunnelBtn');
            const refreshHubStatusBtn = document.getElementById('refreshHubStatusBtn');
            const copyTunnelUrlBtn = document.getElementById('copyTunnelUrlBtn');
            const exportHubDbBtn = document.getElementById('exportHubDbBtn');
            const resetHubDbBtn = document.getElementById('resetHubDbBtn');
            const connectHubBtn = document.getElementById('connectHubBtn');
            const disconnectHubBtn = document.getElementById('disconnectHubBtn');
            const hubRemoteUrlInput = document.getElementById('hubRemoteUrlInput');

            if (dataHubBtn && hubModal) {
                dataHubBtn.addEventListener('click', () => {
                    if (typeof closeSettingsDrawer === 'function') closeSettingsDrawer();
                    hubModal.classList.remove('hidden');
                    if (this.mode === 'host' || !this.mode || this.mode === 'offline') {
                        this.refreshHostDashboard();
                    }
                    const savedUrl = localStorage.getItem('kick_strikers_hub_remote_url');
                    if (savedUrl && hubRemoteUrlInput) {
                        hubRemoteUrlInput.value = savedUrl;
                    }
                });
            }

            const closeHub = () => { if (hubModal) hubModal.classList.add('hidden'); };
            if (closeHubModalBtn) closeHubModalBtn.addEventListener('click', closeHub);
            if (closeHubModalFooterBtn) closeHubModalFooterBtn.addEventListener('click', closeHub);

            if (hubTabHostBtn && hubTabClientBtn && hubHostPanel && hubClientPanel) {
                hubTabHostBtn.addEventListener('click', () => {
                    hubTabHostBtn.classList.add('active');
                    hubTabClientBtn.classList.remove('active');
                    hubHostPanel.classList.add('active');
                    hubClientPanel.classList.remove('active');
                    this.refreshHostDashboard();
                });
                hubTabClientBtn.addEventListener('click', () => {
                    hubTabClientBtn.classList.add('active');
                    hubTabHostBtn.classList.remove('active');
                    hubClientPanel.classList.add('active');
                    hubHostPanel.classList.remove('active');
                });
            }

            if (startTunnelBtn) {
                startTunnelBtn.addEventListener('click', async () => {
                    startTunnelBtn.disabled = true;
                    startTunnelBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Tünel Başlatılıyor...';
                    try {
                        const origin = this.baseUrl || window.location.origin;
                        const res = await fetch(`${origin}/api/hub/tunnel/start`, { method: 'POST' });
                        const data = await res.json();
                        if (data && data.success && data.url) {
                            showToast('🎉 Cloudflare Tüneli başarıyla aktif edildi!', false);
                            this.refreshHostDashboard();
                        } else {
                            showToast(data.error || 'Tünel açılamadı. Lütfen TuneliBaslat.bat dosyasını kontrol edin.', true);
                            startTunnelBtn.disabled = false;
                            startTunnelBtn.innerHTML = '<i class="fa-solid fa-play"></i> Tekrar Dene';
                        }
                    } catch (e) {
                        showToast('Tünel başlatma isteği başarısız oldu.', true);
                        startTunnelBtn.disabled = false;
                        startTunnelBtn.innerHTML = '<i class="fa-solid fa-play"></i> Tüneli Başlat';
                    }
                });
            }

            if (stopTunnelBtn) {
                stopTunnelBtn.addEventListener('click', async () => {
                    try {
                        const origin = this.baseUrl || window.location.origin;
                        await fetch(`${origin}/api/hub/tunnel/stop`, { method: 'POST' });
                        showToast('Cloudflare Tüneli durduruldu.');
                        this.refreshHostDashboard();
                    } catch (e) {}
                });
            }

            if (refreshHubStatusBtn) {
                refreshHubStatusBtn.addEventListener('click', () => {
                    this.refreshHostDashboard();
                    showToast('Veri Merkezi durumu güncellendi.');
                });
            }

            if (copyTunnelUrlBtn) {
                copyTunnelUrlBtn.addEventListener('click', () => {
                    const tunnelInput = document.getElementById('tunnelUrlInput');
                    if (tunnelInput && tunnelInput.value) {
                        navigator.clipboard.writeText(tunnelInput.value);
                        showToast('📋 Tünel linki panoya kopyalandı! Diğer yayıncılara gönderebilirsiniz.');
                    }
                });
            }

            if (exportHubDbBtn) {
                exportHubDbBtn.addEventListener('click', async () => {
                    try {
                        const origin = this.baseUrl || window.location.origin;
                        const res = await fetch(`${origin}/api/hub/stats`);
                        const text = await res.text();
                        const blob = new Blob([text], { type: 'application/json' });
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        a.download = `strickers_hub_stats_${Date.now()}.json`;
                        a.click();
                        showToast('💾 Merkezi havuz veritabanı indirildi.');
                    } catch (e) {
                        showToast('İndirme başarısız oldu.', true);
                    }
                });
            }

            if (resetHubDbBtn) {
                resetHubDbBtn.addEventListener('click', async () => {
                    if (confirm('Tüm merkezi oyuncu istatistiklerini (gol, asist, maç sonuçları) sıfırlamak istediğinize emin misiniz? Bu işlem geri alınamaz!')) {
                        try {
                            const origin = this.baseUrl || window.location.origin;
                            await fetch(`${origin}/api/hub/reset`, { method: 'POST' });
                            channelStats = {};
                            saveChannelStats();
                            refreshAllPlayerElements();
                            if (leaderboardModal && !leaderboardModal.classList.contains('hidden')) {
                                renderLeaderboard();
                            }
                            this.refreshHostDashboard();
                            showToast('⚠️ Merkezi veri havuzu başarıyla sıfırlandı.', true);
                        } catch (e) {
                            showToast('Sıfırlama başarısız oldu.', true);
                        }
                    }
                });
            }

            if (connectHubBtn && hubRemoteUrlInput) {
                connectHubBtn.addEventListener('click', async () => {
                    const url = hubRemoteUrlInput.value.trim();
                    if (!url) {
                        showToast('Lütfen geçerli bir tünel/sunucu URL adresi girin!', true);
                        return;
                    }
                    connectHubBtn.disabled = true;
                    connectHubBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Bağlanılıyor...';
                    await this.connectAsClient(url, true);
                    connectHubBtn.disabled = false;
                    connectHubBtn.innerHTML = '<i class="fa-solid fa-link"></i> Bağlan';
                });
            }

            if (disconnectHubBtn) {
                disconnectHubBtn.addEventListener('click', () => {
                    this.disconnectClient();
                });
            }
        }
    };

    // =========================================================================
    // ⌚ 1. APPLE WATCH / DIGITAL CROWN 3D SILINDIR KAYDIRICI
    // =========================================================================
    function initWatchCrownSlider() {
        const slider = document.getElementById('watchCrownSlider');
        const barrel = document.getElementById('watchCylinderBarrel');
        const viewport = document.getElementById('watchCylinderViewport');
        const prevBtn = document.getElementById('crownPrevBtn');
        const nextBtn = document.getElementById('crownNextBtn');
        const select = document.getElementById('teamSize');
        if (!slider || !barrel || !select) return;

        const values = [1, 2, 3, 5, 8, 11];
        let currentIndex = values.indexOf(parseInt(select.value, 10));
        if (currentIndex < 0) currentIndex = 3;

        const angleStep = 40;
        const radius = 48;

        const items = barrel.querySelectorAll('.cylinder-item');
        items.forEach((item, idx) => {
            const itemAngle = idx * angleStep;
            item.style.transform = `rotateX(${itemAngle}deg) translateZ(${radius}px)`;
        });

        function updateCylinder(animate = true) {
            items.forEach((item, idx) => {
                if (idx === currentIndex) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });

            const currentAngle = -currentIndex * angleStep;
            barrel.style.transition = animate ? 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)' : 'none';
            barrel.style.transform = `translateZ(-${radius}px) rotateX(${currentAngle}deg)`;

            const newVal = values[currentIndex].toString();
            if (select.value !== newVal) {
                select.value = newVal;
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        function setIndex(idx) {
            if (idx < 0) idx = 0;
            if (idx >= values.length) idx = values.length - 1;
            if (idx !== currentIndex) {
                currentIndex = idx;
                playUiSfx('click');
                updateCylinder(true);
            }
        }

        if (prevBtn) {
            prevBtn.onclick = (e) => {
                e.stopPropagation();
                setIndex(currentIndex - 1);
            };
        }
        if (nextBtn) {
            nextBtn.onclick = (e) => {
                e.stopPropagation();
                setIndex(currentIndex + 1);
            };
        }

        if (viewport) {
            viewport.addEventListener('wheel', (e) => {
                e.preventDefault();
                if (e.deltaY > 0) {
                    setIndex(currentIndex + 1);
                } else if (e.deltaY < 0) {
                    setIndex(currentIndex - 1);
                }
            }, { passive: false });

            let startY = 0;
            let isDragging = false;
            viewport.addEventListener('mousedown', (e) => {
                isDragging = true;
                startY = e.clientY;
            });
            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const diff = e.clientY - startY;
                if (Math.abs(diff) > 28) {
                    if (diff < 0) setIndex(currentIndex + 1);
                    else setIndex(currentIndex - 1);
                    startY = e.clientY;
                }
            });
            window.addEventListener('mouseup', () => { isDragging = false; });

            viewport.addEventListener('touchstart', (e) => {
                if (e.touches.length > 0) {
                    startY = e.touches[0].clientY;
                }
            }, { passive: true });
            viewport.addEventListener('touchmove', (e) => {
                if (e.touches.length > 0) {
                    const diff = e.touches[0].clientY - startY;
                    if (Math.abs(diff) > 28) {
                        if (diff < 0) setIndex(currentIndex + 1);
                        else setIndex(currentIndex - 1);
                        startY = e.touches[0].clientY;
                    }
                }
            }, { passive: true });
        }

        barrel.querySelectorAll('.cylinder-item').forEach((item, idx) => {
            item.onclick = (e) => {
                e.stopPropagation();
                setIndex(idx);
            };
        });

        select.addEventListener('change', () => {
            const idx = values.indexOf(parseInt(select.value, 10));
            if (idx !== -1 && idx !== currentIndex) {
                currentIndex = idx;
                updateCylinder(false);
            }
        });

        updateCylinder(false);
    }

    // =========================================================================
    // ⚖️ 2. MAÇ ÖNCESİ TAKIM GÜÇ DENGESİ ÇUBUĞU (POWER BAR)
    // =========================================================================
    function updateTeamPowerBar() {
        const wrap = document.getElementById('teamPowerBarWrap');
        if (!wrap) return;

        let team1List = document.getElementById('team-1');
        let team2List = document.getElementById('team-2');

        if (!team1List || !team2List) {
            const slots = document.querySelectorAll('.bracket-match-card.active-live-match .team-list, .bracket-match-card:first-child .team-list');
            if (slots.length >= 2) {
                team1List = slots[0];
                team2List = slots[1];
            }
        }

        if (!team1List || !team2List) {
            wrap.classList.add('hidden');
            return;
        }

        const t1Players = Array.from(team1List.querySelectorAll('.player-item'));
        const t2Players = Array.from(team2List.querySelectorAll('.player-item'));

        if (t1Players.length === 0 && t2Players.length === 0) {
            wrap.classList.add('hidden');
            return;
        }

        wrap.classList.remove('hidden');

        function calcPlayerPower(name) {
            if (!name) return 50;
            const key = name.trim().toLowerCase();
            const stat = channelStats[key];
            if (!stat) return 50;
            const total = (stat.wins || 0) + (stat.losses || 0);
            if (total === 0) return 50;
            const winrate = (stat.wins / total) * 100;
            const goalBonus = Math.min(25, ((stat.goals || 0) * 2 + (stat.assists || 0)));
            const expBonus = Math.min(15, total * 1.5);
            return Math.max(20, Math.min(99, Math.round((winrate * 0.6) + goalBonus + expBonus)));
        }

        let p1Total = 0;
        t1Players.forEach(p => { p1Total += calcPlayerPower(p.dataset.name); });
        let p2Total = 0;
        t2Players.forEach(p => { p2Total += calcPlayerPower(p.dataset.name); });

        let pct1 = 50;
        let pct2 = 50;
        if (p1Total + p2Total > 0) {
            pct1 = Math.round((p1Total / (p1Total + p2Total)) * 100);
            pct2 = 100 - pct1;
        }

        const t1Box = team1List.closest('.team-box') || team1List.closest('.bracket-team-slot');
        const t2Box = team2List.closest('.team-box') || team2List.closest('.bracket-team-slot');
        const t1Name = (t1Box?.querySelector('.team-name-input') || t1Box?.querySelector('.slot-name-input') || t1Box?.querySelector('input[type="text"]'))?.value || 'Takım 1';
        const t2Name = (t2Box?.querySelector('.team-name-input') || t2Box?.querySelector('.slot-name-input') || t2Box?.querySelector('input[type="text"]'))?.value || 'Takım 2';

        if (fill1) fill1.style.width = `${pct1}%`;
        if (fill2) fill2.style.width = `${pct2}%`;
        if (label1) label1.innerHTML = `<i class="fa-solid fa-shield"></i> ${t1Name}: %${pct1}`;
        if (label2) label2.innerHTML = `%${pct2} :${t2Name} <i class="fa-solid fa-shield"></i>`;
    }

    // =========================================================================
    // ⏱️ 3. CANLI MAÇ SKOR DÜZENLEME PANELİ & CANLI VERİ
    // =========================================================================
    let liveMatchScores = {};

    function toggleLiveScorePanel() {
        const panel = document.getElementById('matchLiveScorePanel');
        if (!panel) return;
        if (panel.classList.contains('hidden')) {
            renderLiveScorePanel();
            panel.classList.remove('hidden');
            playUiSfx('click');
        } else {
            panel.classList.add('hidden');
        }
    }

    function renderLiveScorePanel() {
        const panel = document.getElementById('matchLiveScorePanel');
        if (!panel) return;

        const t1Box = document.getElementById('team1Box');
        const t2Box = document.getElementById('team2Box');
        const t1Name = t1Box?.querySelector('.team-name-input')?.value || 'Takım 1';
        const t2Name = t2Box?.querySelector('.team-name-input')?.value || 'Takım 2';

        const t1Title = document.getElementById('liveScoreTeam1Title');
        const t2Title = document.getElementById('liveScoreTeam2Title');
        if (t1Title) t1Title.textContent = t1Name;
        if (t2Title) t2Title.textContent = t2Name;

        const t1List = document.getElementById('team-1');
        const t2List = document.getElementById('team-2');
        const t1Container = document.getElementById('liveScoreTeam1Players');
        const t2Container = document.getElementById('liveScoreTeam2Players');

        if (!t1Container || !t2Container) return;
        t1Container.innerHTML = '';
        t2Container.innerHTML = '';

        function buildLivePlayerRow(pName, teamNum) {
            const key = pName.trim().toLowerCase();
            if (!liveMatchScores[key]) {
                liveMatchScores[key] = { goals: 0, assists: 0, team: teamNum };
            }
            const row = document.createElement('div');
            row.className = 'live-score-player-row';
            row.innerHTML = `
                <span class="live-player-name" title="${pName}">${pName}</span>
                <div class="live-player-controls">
                    <div class="live-stepper" title="Gol">
                        <span class="stepper-label"><i class="fa-solid fa-futbol"></i></span>
                        <button type="button" class="live-btn-minus goal-minus"><i class="fa-solid fa-minus"></i></button>
                        <span class="live-val goal-val">${liveMatchScores[key].goals}</span>
                        <button type="button" class="live-btn-plus goal-plus"><i class="fa-solid fa-plus"></i></button>
                    </div>
                    <div class="live-stepper" title="Asist">
                        <span class="stepper-label"><i class="fa-solid fa-wand-magic-sparkles"></i></span>
                        <button type="button" class="live-btn-minus assist-minus"><i class="fa-solid fa-minus"></i></button>
                        <span class="live-val assist-val">${liveMatchScores[key].assists}</span>
                        <button type="button" class="live-btn-plus assist-plus"><i class="fa-solid fa-plus"></i></button>
                    </div>
                </div>
            `;

            const goalVal = row.querySelector('.goal-val');
            const assistVal = row.querySelector('.assist-val');

            row.querySelector('.goal-minus').onclick = () => {
                if (liveMatchScores[key].goals > 0) {
                    liveMatchScores[key].goals--;
                    goalVal.textContent = liveMatchScores[key].goals;
                    updateLiveScoreTotals();
                    playUiSfx('click');
                }
            };
            row.querySelector('.goal-plus').onclick = () => {
                liveMatchScores[key].goals++;
                goalVal.textContent = liveMatchScores[key].goals;
                updateLiveScoreTotals();
                playUiSfx('click');
            };
            row.querySelector('.assist-minus').onclick = () => {
                if (liveMatchScores[key].assists > 0) {
                    liveMatchScores[key].assists--;
                    assistVal.textContent = liveMatchScores[key].assists;
                    updateLiveScoreTotals();
                    playUiSfx('click');
                }
            };
            row.querySelector('.assist-plus').onclick = () => {
                liveMatchScores[key].assists++;
                assistVal.textContent = liveMatchScores[key].assists;
                updateLiveScoreTotals();
                playUiSfx('click');
            };

            return row;
        }

        if (t1List) {
            const t1Players = Array.from(t1List.querySelectorAll('.player-item'));
            if (t1Players.length === 0) {
                t1Container.innerHTML = '<div class="live-empty">Oyuncu yok</div>';
            } else {
                t1Players.forEach(p => t1Container.appendChild(buildLivePlayerRow(p.dataset.name, 1)));
            }
        }

        if (t2List) {
            const t2Players = Array.from(t2List.querySelectorAll('.player-item'));
            if (t2Players.length === 0) {
                t2Container.innerHTML = '<div class="live-empty">Oyuncu yok</div>';
            } else {
                t2Players.forEach(p => t2Container.appendChild(buildLivePlayerRow(p.dataset.name, 2)));
            }
        }

        updateLiveScoreTotals();
    }

    function updateLiveScoreTotals() {
        let t1Goals = 0;
        let t2Goals = 0;
        Object.keys(liveMatchScores).forEach(key => {
            const item = liveMatchScores[key];
            if (item.team === 1) t1Goals += (item.goals || 0);
            else if (item.team === 2) t2Goals += (item.goals || 0);
        });
        const totalDisplay = document.getElementById('liveScoreTotalDisplay');
        if (totalDisplay) {
            totalDisplay.textContent = `${t1Goals} - ${t2Goals}`;
        }
    }

    // =========================================================================
    // 📸 4. C# SESSİZ EKRAN VE TAB SKOR ALGILAYICI KÖPRÜSÜ
    // =========================================================================
    let isWatcherActive = false;
    let watcherPollTimer = null;

    function initWatcherControls() {
        const toggleBtn = document.getElementById('watcherToggleBtn');
        const btnLabel = document.getElementById('watcherBtnState');
        const drawerCheckbox = document.getElementById('drawerWatcherToggleCheckbox');
        const drawerLabel = document.getElementById('drawerWatcherStatusLabel');

        async function setWatcherState(enabled) {
            isWatcherActive = enabled;
            if (btnLabel) btnLabel.textContent = enabled ? 'AÇIK' : 'KAPALI';
            if (toggleBtn) toggleBtn.classList.toggle('active', enabled);
            if (drawerCheckbox) drawerCheckbox.checked = enabled;
            if (drawerLabel) {
                drawerLabel.textContent = enabled ? 'AKTİF' : 'DEVRE DIŞI';
                drawerLabel.style.color = enabled ? '#00ffcc' : '#ff4444';
            }

            try {
                const origin = (window.location.origin && window.location.origin.includes('http')) ? window.location.origin : 'http://localhost:18888';
                await fetch(`${origin}/api/watcher/state`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled: enabled })
                });
            } catch(e) {}

            if (enabled) {
                startWatcherPolling();
                showToast('📸 TAB Skor Algılayıcı aktif! Oyunda TAB tuşuna basıldığında ekran taranır.', false);
            } else {
                stopWatcherPolling();
                showToast('TAB Algılayıcı kapatıldı.');
            }
        }

        if (toggleBtn) {
            toggleBtn.onclick = () => {
                playUiSfx('click');
                setWatcherState(!isWatcherActive);
            };
        }

        if (drawerCheckbox) {
            drawerCheckbox.onchange = () => {
                playUiSfx('click');
                setWatcherState(drawerCheckbox.checked);
            };
        }

        (async () => {
            try {
                const origin = (window.location.origin && window.location.origin.includes('http')) ? window.location.origin : 'http://localhost:18888';
                const res = await fetch(`${origin}/api/watcher/state`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.enabled) {
                        setWatcherState(true);
                    }
                }
            } catch(e) {}
        })();
    }

    let lastWatcherTs = 0;

    function startWatcherPolling() {
        stopWatcherPolling();
        watcherPollTimer = setInterval(async () => {
            if (!isWatcherActive) return;
            try {
                const origin = (window.location.origin && window.location.origin.includes('http')) ? window.location.origin : 'http://localhost:18888';
                const res = await fetch(`${origin}/api/watcher/score?since=${lastWatcherTs}`);
                if (res.ok) {
                    const data = await res.json();
                    let changed = false;

                    // 1. C# TAB Ekran ve Kick Olaylarını işle
                    if (data && Array.isArray(data.events) && data.events.length > 0) {
                        data.events.forEach(ev => {
                            if (ev.timestamp && ev.timestamp > lastWatcherTs) {
                                lastWatcherTs = ev.timestamp;
                            }

                            if (ev.type === 'tab_capture') {
                                showToast('📸 Oyun içi TAB Skor Tablosu yakalandı! Canlı Skor panelinden teyit edebilirsiniz.', false);
                                playUiSfx('click');

                                const statusEl = document.getElementById('lastTabCaptureStatus');
                                if (statusEl) {
                                    const timeStr = new Date().toLocaleTimeString();
                                    statusEl.textContent = `Yakalandı (${timeStr})`;
                                    statusEl.style.color = '#00ffcc';
                                }
                                const viewBtn = document.getElementById('viewTabCaptureBtn');
                                if (viewBtn) {
                                    viewBtn.classList.remove('hidden');
                                }
                                const panel = document.getElementById('matchLiveScorePanel');
                                if (panel && panel.classList.contains('hidden')) {
                                    renderLiveScorePanel();
                                    panel.classList.remove('hidden');
                                }
                            } else if (ev.type === 'goal' || ev.type === 'assist' || ev.type === 'boost') {
                                const pName = ev.player;
                                if (pName) {
                                    const key = pName.trim().toLowerCase();
                                    if (typeof liveMatchScores[key] !== 'undefined') {
                                        const count = ev.count || 1;
                                        if (ev.type === 'goal') {
                                            liveMatchScores[key].goals = (liveMatchScores[key].goals || 0) + count;
                                            showToast(`⚽ ${pName} gol attı! (+${count})`, false);
                                            playUiSfx('join');
                                        } else {
                                            liveMatchScores[key].assists = (liveMatchScores[key].assists || 0) + count;
                                            showToast(`⚡ ${pName} asist/boost yaptı! (+${count})`, false);
                                            playUiSfx('click');
                                        }
                                        changed = true;
                                    }
                                }
                            }
                        });
                    }

                    // 2. Toplu skor güncellemesi varsa uygula
                    if (data && data.scores && Array.isArray(data.scores)) {
                        data.scores.forEach(s => {
                            if (!s.name) return;
                            const key = s.name.trim().toLowerCase();
                            if (typeof liveMatchScores[key] !== 'undefined') {
                                if (typeof s.goals === 'number' && s.goals !== liveMatchScores[key].goals) {
                                    liveMatchScores[key].goals = s.goals;
                                    changed = true;
                                }
                                if (typeof s.assists === 'number' && s.assists !== liveMatchScores[key].assists) {
                                    liveMatchScores[key].assists = s.assists;
                                    changed = true;
                                }
                            }
                        });
                    }

                    if (changed) {
                        renderLiveScorePanel();
                        updateTeamPowerBar();
                    }
                }
            } catch(e) {}
        }, 1500);
    }

    function stopWatcherPolling() {
        if (watcherPollTimer) {
            clearInterval(watcherPollTimer);
            watcherPollTimer = null;
        }
    }

    // =========================================================================
    // 🎡 5. KICK CANLI ÇARKIFELEK / KURA ÇEKİM SİSTEMİ
    // =========================================================================
    function initLuckyWheelModal() {
        const modal = document.getElementById('wheelModal');
        const openBtn = document.getElementById('luckyWheelBtn');
        const closeBtn = document.getElementById('closeWheelModalBtn');
        const closeFooterBtn = document.getElementById('closeWheelModalFooterBtn');
        const canvas = document.getElementById('luckyWheelCanvas');
        const spinBtn = document.getElementById('spinWheelBtn');
        const resultBox = document.getElementById('wheelResultBox');
        const winnerDisplay = document.getElementById('wheelWinnerName');
        const assignTeam1Btn = document.getElementById('wheelAssignTeam1Btn');
        const assignTeam2Btn = document.getElementById('wheelAssignTeam2Btn');

        if (!modal || !canvas) return;

        const ctx = canvas.getContext('2d');
        let wheelPlayers = [];
        let currentAngle = 0;
        let isSpinning = false;
        let selectedWinner = null;

        const colors = [
            '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899',
            '#06b6d4', '#eab308', '#6366f1', '#14b8a6', '#f43f5e'
        ];

        function getPoolPlayers() {
            const poolItems = playerPool ? Array.from(playerPool.querySelectorAll('.player-item')) : [];
            if (poolItems.length > 0) {
                return poolItems.map(el => el.dataset.name);
            }
            const keys = Object.keys(channelStats);
            if (keys.length > 0) {
                return keys.map(k => channelStats[k].displayName || k);
            }
            return ['İzleyici 1', 'İzleyici 2', 'İzleyici 3', 'İzleyici 4'];
        }

        function drawWheel() {
            const count = wheelPlayers.length;
            if (count === 0) return;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const radius = (canvas.width / 2) - 10;
            const arc = (2 * Math.PI) / count;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (let i = 0; i < count; i++) {
                const angle = currentAngle + (i * arc);
                ctx.beginPath();
                ctx.fillStyle = colors[i % colors.length];
                ctx.moveTo(centerX, centerY);
                ctx.arc(centerX, centerY, radius, angle, angle + arc);
                ctx.lineTo(centerX, centerY);
                ctx.fill();
                ctx.stroke();

                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(angle + (arc / 2));
                ctx.textAlign = 'right';
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 13px Inter, sans-serif';
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 4;
                const displayName = wheelPlayers[i].length > 12 ? wheelPlayers[i].slice(0, 11) + '..' : wheelPlayers[i];
                ctx.fillText(displayName, radius - 20, 5);
                ctx.restore();
            }

            ctx.beginPath();
            ctx.arc(centerX, centerY, 28, 0, 2 * Math.PI);
            ctx.fillStyle = '#1e293b';
            ctx.fill();
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#fbbf24';
            ctx.stroke();

            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('KICK', centerX, centerY);
        }

        function openModal() {
            wheelPlayers = getPoolPlayers();
            selectedWinner = null;
            if (resultBox) resultBox.classList.add('hidden');
            modal.classList.remove('hidden');
            drawWheel();
            playUiSfx('click');
        }

        function closeModal() {
            modal.classList.add('hidden');
        }

        if (openBtn) openBtn.onclick = openModal;
        if (closeBtn) closeBtn.onclick = closeModal;
        if (closeFooterBtn) closeFooterBtn.onclick = closeModal;

        if (spinBtn) {
            spinBtn.onclick = () => {
                if (isSpinning || wheelPlayers.length === 0) return;
                isSpinning = true;
                spinBtn.disabled = true;
                if (resultBox) resultBox.classList.add('hidden');

                const spinDuration = 3800;
                const startTime = performance.now();
                const totalRotations = (Math.PI * 2 * (6 + Math.floor(Math.random() * 5))) + (Math.random() * Math.PI * 2);
                const initialAngle = currentAngle;

                function animate(time) {
                    const elapsed = time - startTime;
                    const progress = Math.min(1, elapsed / spinDuration);
                    const ease = 1 - Math.pow(1 - progress, 3);
                    currentAngle = initialAngle + (totalRotations * ease);
                    drawWheel();

                    if (progress < 1) {
                        requestAnimationFrame(animate);
                    } else {
                        isSpinning = false;
                        spinBtn.disabled = false;
                        const count = wheelPlayers.length;
                        const arc = (2 * Math.PI) / count;
                        const normalizedAngle = (2 * Math.PI - (currentAngle % (2 * Math.PI))) % (2 * Math.PI);
                        const pointerAngle = (normalizedAngle + (3 * Math.PI / 2)) % (2 * Math.PI);
                        const winnerIdx = Math.floor(pointerAngle / arc) % count;
                        selectedWinner = wheelPlayers[winnerIdx];

                        if (winnerDisplay) winnerDisplay.textContent = selectedWinner;
                        if (resultBox) resultBox.classList.remove('hidden');
                        playUiSfx('win');
                        if (typeof triggerConfettiCelebration === 'function') triggerConfettiCelebration();
                        showToast(`🎯 Çarkıfelek Kazananı: ${selectedWinner}!`, false);
                    }
                }
                requestAnimationFrame(animate);
            };
        }

        function assignWinnerToTeam(targetTeamNum) {
            if (!selectedWinner) return;
            const targetList = document.getElementById(`team-${targetTeamNum}`);
            if (!targetList) return;

            let playerEl = null;
            if (playerPool) {
                playerEl = playerPool.querySelector(`.player-item[data-name="${CSS.escape(selectedWinner)}"]`);
            }
            if (!playerEl) {
                playerEl = createPlayerElement(selectedWinner);
            }
            targetList.appendChild(playerEl);

            const teamBox = targetList.closest('.team-box') || targetList.closest('.bracket-team-slot') || targetList.parentElement;
            if (teamBox) {
                const countBadge = teamBox.querySelector('.team-count');
                const maxSize = parseInt(teamSizeSelect?.value || '5', 10);
                const currentCount = targetList.children.length;
                if (countBadge) {
                    const isTournament = gameModeSelect && gameModeSelect.value === 'tournament';
                    countBadge.textContent = isTournament ? `${currentCount}/${maxSize}` : `${currentCount}/${maxSize}`;
                }
                if (currentCount >= maxSize) {
                    teamBox.classList.add('full');
                } else {
                    teamBox.classList.remove('full');
                }
            }

            updatePoolCount();
            updateTeamPowerBar();
            showToast(`✅ ${selectedWinner} Takım ${targetTeamNum}'e atandı!`);
            closeModal();
        }

        if (assignTeam1Btn) assignTeam1Btn.onclick = () => assignWinnerToTeam(1);
        if (assignTeam2Btn) assignTeam2Btn.onclick = () => assignWinnerToTeam(2);
    }

    // =========================================================================
    // 🎴 6. FUT / EAFC PROFESYONEL OYUNCU KARTI & KARŞILAŞTIRMA
    // =========================================================================
    function calculateFifaStats(playerName) {
        const key = (playerName || '').trim().toLowerCase();
        const stat = channelStats[key] || { wins: 0, losses: 0, goals: 0, assists: 0, saves: 0 };
        const role = (typeof playerRoles !== 'undefined' && playerRoles.get(key)) ? playerRoles.get(key) : 'ST';
        const total = (stat.wins || 0) + (stat.losses || 0);
        const wr = total > 0 ? (stat.wins / total) * 100 : 0;
        const streak = stat.streak || 0;

        let sho = Math.min(99, Math.max(50, Math.round(70 + Math.min(25, (stat.goals || 0) * 1.5))));
        let pas = Math.min(99, Math.max(50, Math.round(70 + Math.min(25, (stat.assists || 0) * 2))));
        let def = Math.min(99, Math.max(50, Math.round(55 + Math.min(35, (stat.saves || 0) * 3))));
        let pac = Math.min(99, Math.max(55, Math.round(72 + Math.min(20, (wr / 5)))));
        let dri = Math.min(99, Math.max(55, Math.round(70 + Math.min(20, ((stat.goals || 0) + (stat.assists || 0))))));
        let phy = Math.min(99, Math.max(55, Math.round(68 + Math.min(25, total * 0.8))));

        let ovr = 75;
        if (role === 'GK') {
            ovr = Math.round((def * 0.5) + (phy * 0.3) + (pas * 0.2));
        } else if (role === 'CB' || role === 'LB' || role === 'RB') {
            ovr = Math.round((def * 0.4) + (phy * 0.3) + (pac * 0.2) + (pas * 0.1));
        } else if (role === 'CM' || role === 'CAM' || role === 'CDM') {
            ovr = Math.round((pas * 0.35) + (dri * 0.25) + (sho * 0.2) + (phy * 0.2));
        } else {
            ovr = Math.round((sho * 0.35) + (pac * 0.25) + (dri * 0.25) + (phy * 0.15));
        }
        ovr = Math.min(99, Math.max(65, ovr));

        return {
            ovr, role, pac, sho, pas, dri, def, phy,
            total, goals: stat.goals || 0, assists: stat.assists || 0, saves: stat.saves || 0,
            winRate: wr, streak, displayName: stat.displayName || playerName
        };
    }

    function populateFifaCard(cardNum, playerName) {
        const data = calculateFifaStats(playerName);

        const ovrEl = document.getElementById(`fifaOvr${cardNum}`);
        const posEl = document.getElementById(`fifaPos${cardNum}`);
        const nameEl = document.getElementById(`fifaName${cardNum}`);
        const pacEl = document.getElementById(`fifaPac${cardNum}`);
        const shoEl = document.getElementById(`fifaSho${cardNum}`);
        const pasEl = document.getElementById(`fifaPas${cardNum}`);
        const driEl = document.getElementById(`fifaDri${cardNum}`);
        const defEl = document.getElementById(`fifaDef${cardNum}`);
        const phyEl = document.getElementById(`fifaPhy${cardNum}`);
        const careerEl = document.getElementById(`fifaCareer${cardNum}`);
        const streakEl = document.getElementById(`fifaStreak${cardNum}`);
        const avatarEl = document.getElementById(`fifaAvatar${cardNum}`);

        if (ovrEl) ovrEl.textContent = data.ovr;
        if (posEl) posEl.textContent = data.role;
        if (nameEl) nameEl.textContent = data.displayName;
        if (pacEl) pacEl.textContent = data.pac;
        if (shoEl) shoEl.textContent = data.sho;
        if (pasEl) pasEl.textContent = data.pas;
        if (driEl) driEl.textContent = data.dri;
        if (defEl) defEl.textContent = data.def;
        if (phyEl) phyEl.textContent = data.phy;
        if (careerEl) careerEl.textContent = `${data.goals}G - ${data.total}M | %${data.winRate.toFixed(0)} WR`;
        if (streakEl) {
            streakEl.textContent = data.streak >= 3 ? `🔥 ${data.streak} Seri` : `${data.streak} Seri`;
            streakEl.style.color = data.streak >= 3 ? '#ff3b30' : '#ffd700';
        }

        if (avatarEl) {
            const cachedAv = (typeof getCachedAvatar === 'function') ? getCachedAvatar(data.displayName) : null;
            if (cachedAv) {
                avatarEl.innerHTML = `<img src="${cachedAv}" alt="${data.displayName}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`;
            } else {
                avatarEl.innerHTML = `<i class="fa-solid fa-user"></i>`;
            }
        }
    }

    function openFifaCardModal(playerName) {
        const modal = document.getElementById('fifaCardModal');
        if (!modal) return;

        populateFifaCard(1, playerName);

        const compareSelect = document.getElementById('fifaCompareSelect');
        if (compareSelect) {
            compareSelect.innerHTML = '<option value="">(Karşılaştırma Yapılmıyor - Tek Kart)</option>';
            const nameSet = new Set();
            Object.keys(channelStats).forEach(k => {
                nameSet.add(channelStats[k].displayName || k);
            });
            document.querySelectorAll('.player-item').forEach(el => {
                if (el.dataset.name) nameSet.add(el.dataset.name.trim());
            });

            Array.from(nameSet).sort().forEach(disp => {
                if (disp.toLowerCase() !== playerName.toLowerCase()) {
                    const k = disp.toLowerCase();
                    const st = channelStats[k] || { wins: 0, losses: 0 };
                    const opt = document.createElement('option');
                    opt.value = disp;
                    opt.textContent = `${disp} (${st.wins || 0}W - ${st.losses || 0}L)`;
                    compareSelect.appendChild(opt);
                }
            });
            compareSelect.value = '';
        }

        const card2 = document.getElementById('fifaCard2');
        if (card2) card2.classList.add('hidden');

        modal.classList.remove('hidden');
        playUiSfx('click');
    }
    window.openFifaCardModal = openFifaCardModal;

    function initFifaCardModal() {
        const modal = document.getElementById('fifaCardModal');
        const closeBtn = document.getElementById('closeFifaCardModalBtn');
        const closeFooterBtn = document.getElementById('closeFifaCardModalFooterBtn');
        const compareSelect = document.getElementById('fifaCompareSelect');
        const card2 = document.getElementById('fifaCard2');

        if (!modal) return;
        const closeModal = () => modal.classList.add('hidden');
        if (closeBtn) closeBtn.onclick = closeModal;
        if (closeFooterBtn) closeFooterBtn.onclick = closeModal;

        if (compareSelect) {
            compareSelect.onchange = () => {
                const p2 = compareSelect.value;
                if (p2 && card2) {
                    card2.classList.remove('hidden');
                    populateFifaCard(2, p2);
                } else if (card2) {
                    card2.classList.add('hidden');
                }
            };
        }
    }

    // =========================================================================
    // 🚀 TÜM YENİ MODÜLLERİN ARAYÜZ ENTEGRASYONU VE BAŞLATILMASI
    // =========================================================================
    initWatchCrownSlider();
    initWatcherControls();
    initLuckyWheelModal();
    initFifaCardModal();
    updateTeamPowerBar();

    const qsToggleBtn = document.getElementById('quickScorePanelToggleBtn');
    if (qsToggleBtn) qsToggleBtn.onclick = toggleLiveScorePanel;
    const closeQsBtn = document.getElementById('closeLiveScorePanelBtn');
    if (closeQsBtn) closeQsBtn.onclick = toggleLiveScorePanel;
    const finishMatchBtn = document.getElementById('finishLiveMatchBtn');
    if (finishMatchBtn) {
        finishMatchBtn.onclick = () => {
            let t1G = 0, t2G = 0;
            Object.keys(liveMatchScores).forEach(k => {
                if (liveMatchScores[k].team === 1) t1G += liveMatchScores[k].goals || 0;
                if (liveMatchScores[k].team === 2) t2G += liveMatchScores[k].goals || 0;
            });
            const t1Box = document.getElementById('team1Box');
            const t2Box = document.getElementById('team2Box');
            const t1Title = t1Box?.querySelector('.team-name-input')?.value || 'Takım 1';
            const t2Title = t2Box?.querySelector('.team-name-input')?.value || 'Takım 2';

            let winNum = 1;
            let tTitle = t1Title;
            if (t1G === t2G) {
                const pickT1 = confirm(`Skorlar eşit (${t1G} - ${t2G})!\n[Tamam]: ${t1Title} Kazandı\n[İptal]: ${t2Title} Kazandı`);
                winNum = pickT1 ? 1 : 2;
                tTitle = winNum === 1 ? t1Title : t2Title;
            } else {
                winNum = t2G > t1G ? 2 : 1;
                tTitle = winNum === 1 ? t1Title : t2Title;
            }

            const winList = document.getElementById(`team-${winNum}`);
            if (winList) {
                handleTeamWinClick(winNum, tTitle, winList);
            }
        };
    }

    // Hub Modülünü Başlat
    HubClient.init();

    window.handleTournamentMatchWin = function(matchId, slotKey) {
        if (typeof _origHandleTournamentMatchWin === 'function') _origHandleTournamentMatchWin(matchId, slotKey);
        checkAndInitLosers();
    };
});


