// GOLF SCOREBOARD - CORE LOGIC

class GolfApp {
    constructor() {
        this.STORAGE_KEY = 'golf_scoreboard_state';
        
        // Default App State
        this.defaultState = {
            tournament: {
                name: "第1回 独自イーブン選手権",
                date: "2026/07/10 - 07/11"
            },
            players: [
                { id: 1, name: "田安プロ", handicapDay1: 120, handicapDay2: 120 },
                { id: 2, name: "黒岩プロ", handicapDay1: 99, handicapDay2: 99 },
                { id: 3, name: "渡辺プロ", handicapDay1: 112, handicapDay2: 112 },
                { id: 4, name: "ジャンボ慎太アマ", handicapDay1: 135, handicapDay2: 135 }
            ],
            parsDay1: [4, 3, 4, 4, 4, 4, 3, 5, 5,  5, 4, 4, 3, 5, 4, 3, 4, 4], // Day 1 Pars (Total: 72)
            parsDay2: [4, 4, 3, 4, 5, 4, 3, 4, 5,  4, 3, 4, 4, 5, 3, 4, 4, 5], // Day 2 Pars (Total: 72)
            scores: {
                1: { day1: Array(18).fill(null), day2: Array(18).fill(null) },
                2: { day1: Array(18).fill(null), day2: Array(18).fill(null) },
                3: { day1: Array(18).fill(null), day2: Array(18).fill(null) },
                4: { day1: Array(18).fill(null), day2: Array(18).fill(null) }
            },
            supabaseUrl: "",
            supabaseKey: "",
            last_updated: Date.now()
        };

        this.state = null;
        this.isInitialLoad = true;
        this.supabase = null;
        this.syncIntervalId = null;
        
        // Active UI States
        this.currentTab = 'home';
        this.leaderboardDay = 'total'; // 'total', 'day1', 'day2'
        
        // Score Entry UI States
        this.scoreActiveDay = 1; // 1 or 2
        this.scoreActivePlayerId = 1; // Player ID
        this.scoreActiveHalf = 'out'; // 'out', 'in', 'summary'
        
        // Par settings active editing day
        this.parEditActiveDay = 1; // 1 or 2
        
        // Keypad Modal States
        this.keypadState = {
            playerId: null,
            day: null,
            holeIndex: null,
            currentValue: null
        };
        
        this.init();
    }

    init() {
        // Load state
        this.loadState();
        this.initSupabase();
        
        // Render initial view & tournament info
        this.renderAll();
        this.switchTab('home');
        
        // Initialize transparent logos, then run splash animation
        this.initTransparentLogos(() => {
            this.runSplashScreen();
        });
        
        // Pre-fill settings inputs
        this.initSettingsInputs();
        
        // Check UI components size on load (for mobile height)
        this.adjustAppHeight();
        window.addEventListener('resize', () => this.adjustAppHeight());
    }

    adjustAppHeight() {
        // Solve the 100vh issue on mobile browsers
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    initTransparentLogos(callback) {
        const splashLogoImg = document.querySelector('.splash-logo');
        const portalLogoImg = document.querySelector('.portal-logo-img');
        
        // If logo image elements exist, process the JPG dynamically to transparent PNG via Canvas
        if (splashLogoImg || portalLogoImg) {
            this.getTransparentLogo('logo.jpg', (pngDataUrl) => {
                if (pngDataUrl) {
                    if (splashLogoImg) {
                        splashLogoImg.src = pngDataUrl;
                        splashLogoImg.classList.add('animate');
                    }
                    if (portalLogoImg) portalLogoImg.src = pngDataUrl;
                } else {
                    // Fallback to start animation anyway if canvas fails
                    if (splashLogoImg) splashLogoImg.classList.add('animate');
                }
                if (callback) callback();
            });
        } else {
            if (callback) callback();
        }
    }

    getTransparentLogo(imageSrc, callback) {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i+1];
                    const b = data[i+2];
                    
                    // To prevent removing the logo text itself (which could be light-colored or grayish),
                    // we check the saturation (difference between max and min color channels) and brightness.
                    const maxColor = Math.max(r, g, b);
                    const minColor = Math.min(r, g, b);
                    const colorDiff = maxColor - minColor;
                    const v = 0.299 * r + 0.587 * g + 0.114 * b; // Brightness
                    
                    // Background is gray/white (low saturation, high brightness).
                    // If the pixel is close to white (brightness > 160) and has low color difference (diff < 35), transparentize it.
                    if (v > 165 && colorDiff < 35) {
                        data[i+3] = 0; // Fully transparent
                    } else if (v > 120 && colorDiff < 45) {
                        // Anti-aliasing gradient for borders
                        const factor = (v - 120) / 45;
                        data[i+3] = Math.min(data[i+3], Math.round((1 - factor) * 255));
                    }
                }
                
                ctx.putImageData(imageData, 0, 0);
                callback(canvas.toDataURL('image/png'));
            } catch (e) {
                console.error("Error processing transparent logo via canvas", e);
                callback(null);
            }
        };
        img.onerror = () => {
            callback(null);
        };
        img.src = imageSrc;
    }

    runSplashScreen() {
        const splash = document.getElementById('splash-screen');
        const pageHome = document.getElementById('page-home');
        
        if (!splash) return;
        
        // Disable body overflow during splash
        document.body.style.overflow = 'hidden';
        
        // 3.4s: Start fading out the white screen
        setTimeout(() => {
            splash.classList.add('fade-out');
        }, 3400);
        
        // 3.7s: Staggered fade-in of portal contents (logo, date, menu cards)
        setTimeout(() => {
            if (pageHome) {
                pageHome.classList.remove('portal-content-hidden');
                pageHome.classList.add('portal-content-visible');
            }
        }, 3700);
        
        // 4.2s: Remove splash screen from DOM completely
        setTimeout(() => {
            splash.remove();
            document.body.style.overflow = '';
        }, 4200);
    }

    // STATE MANAGEMENT
    loadState() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                this.state = JSON.parse(saved);
                // Schema validation / migration if necessary
                let migrated = false;
                
                if (!this.state.parsDay1 || this.state.parsDay1.length !== 18) {
                    this.state.parsDay1 = this.state.pars 
                        ? [...this.state.pars] 
                        : [...this.defaultState.parsDay1];
                    migrated = true;
                }
                if (!this.state.parsDay2 || this.state.parsDay2.length !== 18) {
                    this.state.parsDay2 = this.state.pars 
                        ? [...this.state.pars] 
                        : [...this.defaultState.parsDay2];
                    migrated = true;
                }
                if (this.state.pars) {
                    delete this.state.pars;
                    migrated = true;
                }
                
                // Force update Day 1 Pars to user's specified layout (2026/06/16)
                if (!this.state.pars_updated_20260616) {
                    this.state.parsDay1 = [...this.defaultState.parsDay1];
                    this.state.pars_updated_20260616 = true;
                    migrated = true;
                }

                // Check if scores is properly initialized
                if (!this.state.scores) {
                    this.state.scores = { ...this.defaultState.scores };
                    migrated = true;
                }
                // Migrate date if it's the old default to automatically reflect new dates
                if (this.state.tournament && this.state.tournament.date === "2026/06/11 - 06/12") {
                    this.state.tournament.date = "2026/07/10 - 07/11";
                    migrated = true;
                }

                // Migrate players and handicaps to D1/D2 style
                const fixedNames = {
                    1: "田安プロ",
                    2: "黒岩プロ",
                    3: "渡辺プロ",
                    4: "ジャンボ慎太アマ"
                };

                if (this.state.players) {
                    this.state.players = this.state.players.map(p => {
                        const newName = fixedNames[p.id];
                        let updated = false;
                        
                        if (newName && p.name !== newName) {
                            p.name = newName;
                            updated = true;
                        }
                        
                        if (p.handicapDay1 === undefined) {
                            p.handicapDay1 = p.handicap !== undefined ? p.handicap : 0;
                            updated = true;
                        }
                        if (p.handicapDay2 === undefined) {
                            p.handicapDay2 = p.handicap !== undefined ? p.handicap : 0;
                            updated = true;
                        }
                        
                        if (p.handicap !== undefined) {
                            delete p.handicap;
                            updated = true;
                        }
                        
                        if (updated) migrated = true;
                        return p;
                    });
                } else {
                    this.state.players = JSON.parse(JSON.stringify(this.defaultState.players));
                    migrated = true;
                }

                // Migrate to new default handicaps (2026/06/15)
                const newDefaultHandicaps = {
                    1: 120, // 田安プロ
                    2: 99,  // 黒岩プロ
                    3: 112, // 渡辺プロ
                    4: 135  // ジャンボ慎太アマ
                };
                if (!this.state.handicaps_updated_20260615) {
                    if (this.state.players) {
                        this.state.players = this.state.players.map(p => {
                            const defaultHcp = newDefaultHandicaps[p.id];
                            if (defaultHcp !== undefined) {
                                p.handicapDay1 = defaultHcp;
                                p.handicapDay2 = defaultHcp;
                            }
                            return p;
                        });
                    }
                    this.state.handicaps_updated_20260615 = true;
                    migrated = true;
                }

                // Migrate to Supabase properties
                if (this.state.supabaseUrl === undefined) {
                    this.state.supabaseUrl = "";
                    migrated = true;
                }
                if (this.state.supabaseKey === undefined) {
                    this.state.supabaseKey = "";
                    migrated = true;
                }
                if (this.state.last_updated === undefined) {
                    this.state.last_updated = Date.now();
                    migrated = true;
                }

                if (migrated) {
                    this.saveState();
                }
            } else {
                this.state = JSON.parse(JSON.stringify(this.defaultState));
                this.saveState();
            }
        } catch (e) {
            console.error("Failed to load state", e);
            this.state = JSON.parse(JSON.stringify(this.defaultState));
        }
    }

    saveState() {
        try {
            this.state.last_updated = Date.now();
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
            this.uploadStateToCloud();
        } catch (e) {
            console.error("Failed to save state", e);
            this.showToast("データの保存に失敗しました", true);
        }
    }

    async uploadStateToCloud() {
        if (!this.supabase) return;
        try {
            const { error } = await this.supabase
                .from('golf_tournament_state')
                .upsert({ 
                    id: 'default', 
                    state: this.state,
                    updated_at: new Date().toISOString()
                });
            if (error) {
                console.error("Supabase upsert error:", error);
            }
        } catch (e) {
            console.error("Failed to upload state to cloud", e);
        }
    }

    initSupabase() {
        if (this.state.supabaseUrl && this.state.supabaseKey) {
            try {
                if (window.supabase) {
                    this.supabase = window.supabase.createClient(this.state.supabaseUrl, this.state.supabaseKey);
                    console.log("Supabase client initialized successfully.");
                    this.startCloudSyncInterval();
                } else {
                    console.error("Supabase SDK is not loaded.");
                }
            } catch (e) {
                console.error("Failed to initialize Supabase client", e);
            }
        } else {
            console.log("Supabase configuration is missing. Sync disabled.");
            if (this.syncIntervalId) {
                clearInterval(this.syncIntervalId);
                this.syncIntervalId = null;
            }
            this.supabase = null;
        }
    }

    async syncWithCloud(isAuto = false) {
        if (!this.supabase) {
            if (!isAuto) this.showToast("クラウド同期（Supabase）が設定されていません", true);
            return;
        }

        try {
            // Visual feedback: rotate reload icons during sync
            const reloadBtns = document.querySelectorAll('.header-reload-btn');
            reloadBtns.forEach(btn => btn.classList.add('syncing'));

            const { data, error } = await this.supabase
                .from('golf_tournament_state')
                .select('state')
                .eq('id', 'default')
                .single();

            // Delay removing class briefly for smooth animation
            setTimeout(() => {
                reloadBtns.forEach(btn => btn.classList.remove('syncing'));
            }, 500);

            if (error) {
                if (error.code === 'PGRST116') {
                    console.log("No cloud state found. Uploading current state as default...");
                    this.uploadStateToCloud();
                    if (!isAuto) this.showToast("クラウドにデータが存在しないため、現在のデータをアップロードしました");
                } else {
                    console.error("Supabase select error:", error);
                    if (!isAuto) this.showToast("同期エラーが発生しました", true);
                }
                return;
            }

            if (data && data.state) {
                const cloudState = data.state;
                
                const cloudTime = cloudState.last_updated || 0;
                const localTime = this.state.last_updated || 0;

                if (cloudTime > localTime) {
                    this.state = cloudState;
                    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
                    this.renderAll();
                    this.initSettingsInputs();
                    if (isAuto) {
                        this.showToast("他端末でのスコア更新を同期しました");
                    } else {
                        this.showToast("クラウドからデータを同期しました");
                    }
                } else {
                    if (!isAuto) this.showToast("データはすでに最新です");
                }
            }
        } catch (e) {
            console.error("Failed to sync with cloud", e);
            if (!isAuto) this.showToast("同期処理に失敗しました", true);
        }
    }

    startCloudSyncInterval() {
        if (this.syncIntervalId) {
            clearInterval(this.syncIntervalId);
        }
        
        // Poll every 8 seconds for background synchronization
        this.syncIntervalId = setInterval(() => {
            this.syncWithCloud(true);
        }, 8000);
    }

    resetAllData() {
        if (confirm("すべてのスコアと設定をリセットします。よろしいですか？")) {
            this.state = JSON.parse(JSON.stringify(this.defaultState));
            this.saveState();
            this.showToast("データをリセットしました");
            this.initSettingsInputs();
            this.renderAll();
        }
    }

    resetScoresOnly() {
        if (confirm("選手設定やPar設定は残し、入力されたスコアのみをすべて削除（リセット）します。よろしいですか？")) {
            this.state.scores = {
                1: { day1: Array(18).fill(null), day2: Array(18).fill(null) },
                2: { day1: Array(18).fill(null), day2: Array(18).fill(null) },
                3: { day1: Array(18).fill(null), day2: Array(18).fill(null) },
                4: { day1: Array(18).fill(null), day2: Array(18).fill(null) }
            };
            this.saveState();
            this.showToast("スコアのみリセットしました");
            this.renderAll();
        }
    }

    exportData() {
        try {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state, null, 2));
            const downloadAnchor = document.createElement('a');
            const dateStr = new Date().toISOString().slice(0,10);
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `golf_scores_${dateStr}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            this.showToast("データをエクスポートしました");
        } catch (e) {
            this.showToast("エクスポートに失敗しました", true);
        }
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (imported.players && imported.scores && imported.pars) {
                    this.state = imported;
                    this.saveState();
                    this.showToast("データをインポートしました");
                    this.initSettingsInputs();
                    this.renderAll();
                } else {
                    this.showToast("不正なファイル形式です", true);
                }
            } catch (err) {
                this.showToast("ファイルの解析に失敗しました", true);
            }
        };
        reader.readAsText(file);
        // Clear input value
        event.target.value = '';
    }

    // TOAST NOTIFICATIONS
    showToast(message, isError = false) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${isError ? 'toast-error' : ''}`;
        toast.innerText = message;
        
        container.appendChild(toast);
        
        // Trigger reflow
        toast.offsetHeight;
        
        // Remove after 3s
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-out forwards';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 2500);
    }

    // CALCULATIONS & STATISTICS
    getPlayerStats(playerId, dayNum = null) {
        const player = this.state.players.find(p => p.id === playerId);
        if (!player) return null;

        // If dayNum is null (TOTAL), combine stats of Day 1 and Day 2
        if (dayNum === null) {
            const day1Stats = this.getPlayerStats(playerId, 1);
            const day2Stats = this.getPlayerStats(playerId, 2);
            
            return {
                player,
                playedHoles: day1Stats.playedHoles + day2Stats.playedHoles,
                totalGross: day1Stats.totalGross + day2Stats.totalGross,
                totalPar: day1Stats.totalPar + day2Stats.totalPar,
                grossDiff: day1Stats.grossDiff + day2Stats.grossDiff,
                netDiff: day1Stats.netDiff + day2Stats.netDiff,
                netScore: day1Stats.netScore + day2Stats.netScore,
                liveHandicap: parseFloat((day1Stats.liveHandicap + day2Stats.liveHandicap).toFixed(1)),
                outGross: day1Stats.outGross + day2Stats.outGross,
                inGross: day1Stats.inGross + day2Stats.inGross,
                outPar: day1Stats.outPar + day2Stats.outPar,
                inPar: day1Stats.inPar + day2Stats.inPar,
                isFinished: day1Stats.isFinished && day2Stats.isFinished
            };
        }

        // Single Day Calculation
        const handicap = dayNum === 1 
            ? (player.handicapDay1 ?? 0) 
            : (player.handicapDay2 ?? 0);
        
        const pars = dayNum === 1 ? this.state.parsDay1 : this.state.parsDay2;
        
        let playedHoles = 0;
        let totalGross = 0;
        let totalPar = 0;
        
        const dayKey = `day${dayNum}`;
        const dayScores = this.state.scores[playerId]?.[dayKey] || Array(18).fill(null);
        
        dayScores.forEach((score, idx) => {
            if (score !== null && score > 0) {
                playedHoles++;
                totalGross += score;
                totalPar += pars[idx];
            }
        });

        // Day specific live handicap (max 18 holes)
        const liveHandicap = playedHoles > 0 ? (handicap * (playedHoles / 18)) : 0;
        
        const grossDiff = totalGross - totalPar;
        const netDiff = grossDiff - liveHandicap;
        const netScore = totalGross - liveHandicap;

        // Out/In breakdown
        let outGross = 0;
        let inGross = 0;
        let outPar = 0;
        let inPar = 0;
        
        // Out (Holes 1-9, index 0-8)
        for (let i = 0; i < 9; i++) {
            if (dayScores[i] !== null && dayScores[i] > 0) {
                outGross += dayScores[i];
                outPar += pars[i];
            }
        }
        // In (Holes 10-18, index 9-17)
        for (let i = 9; i < 18; i++) {
            if (dayScores[i] !== null && dayScores[i] > 0) {
                inGross += dayScores[i];
                inPar += pars[i];
            }
        }

        return {
            player,
            playedHoles,
            totalGross,
            totalPar,
            grossDiff,
            netDiff,
            netScore,
            liveHandicap: parseFloat(liveHandicap.toFixed(1)),
            outGross,
            inGross,
            outPar,
            inPar,
            isFinished: playedHoles === 18
        };
    }

    getTournamentProgress() {
        let totalPossibleHoles = 4 * 36; // 4 players * 36 holes
        let totalPlayedHoles = 0;
        
        this.state.players.forEach(p => {
            const stats = this.getPlayerStats(p.id);
            totalPlayedHoles += stats.playedHoles;
        });

        const percent = totalPossibleHoles > 0 ? Math.round((totalPlayedHoles / totalPossibleHoles) * 100) : 0;
        return {
            percent,
            played: totalPlayedHoles,
            total: totalPossibleHoles
        };
    }

    // NAVIGATION
    switchTab(tabId) {
        this.currentTab = tabId;
        
        const performSwitch = () => {
            // Update DOM active classes for pages
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
            });
            document.getElementById(`page-${tabId}`).classList.add('active');
            
            // Bottom tab items active class
            document.querySelectorAll('.tab-item').forEach(item => {
                item.classList.remove('active');
            });
            const activeTabBtn = document.getElementById(`tab-${tabId}`);
            if (activeTabBtn) {
                activeTabBtn.classList.add('active');
            }
            
            // Show/Hide bottom navigation bar based on active page
            const tabBar = document.querySelector('.tab-bar');
            if (tabId === 'home' || tabId === 'regulation') {
                tabBar.classList.add('tab-bar-hidden');
            } else {
                tabBar.classList.remove('tab-bar-hidden');
            }
            
            // Trigger tab-specific renders
            this.renderActiveTab();
        };

        if (this.isInitialLoad) {
            performSwitch();
            this.isInitialLoad = false;
        } else {
            this.triggerSplashTransition(performSwitch);
        }
    }

    triggerSplashTransition(callback) {
        const canvas = document.getElementById('transition-canvas');
        if (!canvas) {
            callback();
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Match canvas dimensions to the app-container for pixel perfect alignment in mobile frame
        const container = document.getElementById('app');
        const width = container ? container.clientWidth : window.innerWidth;
        const height = container ? container.clientHeight : window.innerHeight;
        
        canvas.width = width;
        canvas.height = height;
        
        // Block interaction during transition
        canvas.style.pointerEvents = 'auto';
        
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Cyan and Dark Splatter Palette (More fine-grained particles)
        const colors = ['#00d2ff', '#000000', '#050e14', '#00d2ff', '#000000'];
        const particles = [];
        const particleCount = 65; // High particle count for fine details
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 4 + Math.random() * 12; // Variable speed
            
            // Stagger start frames to create the "betta-betta-betta" stamp-like rhythm
            const delay = Math.floor(Math.random() * 32); // Delay up to 32 frames
            
            particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 4 + Math.random() * 14, // Smaller, finer droplets
                targetSize: Math.max(width, height) * 0.45, // Smaller target size for layered density
                color: colors[i % colors.length],
                delay: delay,
                active: false,
                age: 0,
                subDroplets: []
            });
            
            // Orbiting satellite droplets for realistic splatter grunge texture
            const subCount = 4 + Math.floor(Math.random() * 5);
            for (let j = 0; j < subCount; j++) {
                particles[i].subDroplets.push({
                    relX: (Math.random() - 0.5) * 80, // Farther dispersion
                    relY: (Math.random() - 0.5) * 80,
                    sizeRatio: 0.1 + Math.random() * 0.25 // Smaller secondary droplets
                });
            }
        }
        
        let phase = 'grow'; // 'grow' -> 'full' -> 'shrink'
        let progress = 0; // Declare the missing progress variable
        let currentFrame = 0;
        let frameId;
        let switched = false;
        let growCompleteFrame = 0;
        
        const animate = () => {
            currentFrame++;
            
            if (phase === 'grow') {
                ctx.clearRect(0, 0, width, height);
                
                let fullyGrownCount = 0;
                
                particles.forEach(p => {
                    if (currentFrame >= p.delay) {
                        p.active = true;
                        p.age++;
                    }
                    
                    if (p.active) {
                        // Stretched growth over time (approx 35 frames max per droplet)
                        const growDuration = 35;
                        const t = Math.min(1.0, p.age / growDuration);
                        
                        if (t >= 1.0) {
                            fullyGrownCount++;
                        }
                        
                        // Physics motion with slight friction to slow down and "stick" (heavy splatter feel)
                        p.vx *= 0.96;
                        p.vy *= 0.96;
                        p.x += p.vx;
                        p.y += p.vy;
                        
                        const currentSize = p.size + (p.targetSize - p.size) * t;
                        
                        ctx.fillStyle = p.color;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
                        ctx.fill();
                        
                        p.subDroplets.forEach(sub => {
                            ctx.beginPath();
                            ctx.arc(
                                p.x + sub.relX * (1 + t * 2.2), 
                                p.y + sub.relY * (1 + t * 2.2), 
                                currentSize * sub.sizeRatio, 
                                0, 
                                Math.PI * 2
                            );
                            ctx.fill();
                        });
                    }
                });
                
                // Transition to 'full' once all are mostly grown or safety limit is reached
                const allStarted = particles.every(p => p.active);
                const safetyLimit = currentFrame > 85;
                
                if ((allStarted && fullyGrownCount >= particles.length * 0.9) || safetyLimit) {
                    phase = 'full';
                    growCompleteFrame = currentFrame;
                }
                
                // Solid fill-in overlay at the final stage of grow phase
                const growProgress = currentFrame / 75; // Normalized overall progress
                if (growProgress > 0.75) {
                    ctx.fillStyle = '#000000';
                    ctx.globalAlpha = Math.min(1.0, (growProgress - 0.75) / 0.25);
                    ctx.fillRect(0, 0, width, height);
                    ctx.globalAlpha = 1.0;
                }
                
            } else if (phase === 'full') {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, width, height);
                
                if (!switched) {
                    callback();
                    switched = true;
                }
                
                // Hold full covered state for 6 frames (~100ms) to feel heavy and impact-rich
                if (currentFrame - growCompleteFrame > 6) {
                    phase = 'shrink';
                    progress = 0;
                }
                
            } else if (phase === 'shrink') {
                // Slightly slower erase reveal (approx 40 frames total / 650ms)
                progress += 0.026;
                if (progress >= 1.0) {
                    canvas.style.pointerEvents = 'none';
                    ctx.clearRect(0, 0, width, height);
                    cancelAnimationFrame(frameId);
                    return;
                }
                
                ctx.clearRect(0, 0, width, height);
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, width, height);
                
                ctx.globalCompositeOperation = 'destination-out';
                
                // Erase mask from center outwards with jagged splatter edge
                const eraseRadius = Math.max(width, height) * 1.4 * progress;
                ctx.fillStyle = 'rgba(0, 0, 0, 1)';
                
                ctx.beginPath();
                const steps = 36; // More steps for finer detail
                for (let i = 0; i <= steps; i++) {
                    const angle = (i / steps) * Math.PI * 2;
                    // Highly complex grunge splatter silhouette edge
                    const noise = 0.8 + 
                                  Math.sin(angle * 9) * 0.12 + 
                                  Math.cos(angle * 19) * 0.06 + 
                                  Math.sin(angle * 31) * 0.02;
                    const r = eraseRadius * noise;
                    const x = centerX + Math.cos(angle) * r;
                    const y = centerY + Math.sin(angle) * r;
                    
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
                
                // Fine flying ink spots erased around the main opening
                for (let i = 0; i < 22; i++) {
                    const angle = (i / 22) * Math.PI * 2 + progress * 1.5;
                    const r = eraseRadius * 0.8 + Math.sin(i * 3) * 60;
                    const x = centerX + Math.cos(angle) * r;
                    const y = centerY + Math.sin(angle) * r;
                    const size = 32 * (1 - progress) * (0.5 + Math.random() * 0.5);
                    ctx.beginPath();
                    ctx.arc(x, y, Math.max(0, size), 0, Math.PI * 2);
                    ctx.fill();
                }
                
                ctx.globalCompositeOperation = 'source-over';
            }
            
            frameId = requestAnimationFrame(animate);
        };
        
        frameId = requestAnimationFrame(animate);
    }

    goHome() {
        this.switchTab('home');
    }

    renderActiveTab() {
        switch (this.currentTab) {
            case 'home':
                this.renderHome();
                break;
            case 'leaderboard':
                this.renderLeaderboard();
                break;
            case 'score':
                this.renderScoreInput();
                break;
            case 'settings':
                this.renderSettings();
                break;
            case 'regulation':
                this.renderRegulation();
                break;
        }
    }

    renderAll() {
        // Update header tournament info across all pages
        const nameElem = document.getElementById('display-tournament-name');
        const dateElem = document.getElementById('display-tournament-date');
        if (nameElem) nameElem.innerText = this.state.tournament.name;
        if (dateElem) dateElem.innerText = this.state.tournament.date;
        
        this.renderActiveTab();
    }

    // REGULATION SCREEN
    renderRegulation() {
        // Render current players and their handicaps in a table
        const table = document.getElementById('regulation-players-list');
        if (table) {
            table.innerHTML = '';
            this.state.players.forEach(p => {
                const row = document.createElement('div');
                row.className = 'reg-player-row';
                row.innerHTML = `
                    <span class="reg-p-name">${p.name}</span>
                    <span class="reg-p-hcp">イーブン値: D1(+${p.handicapDay1 ?? 0}) / D2(+${p.handicapDay2 ?? 0})</span>
                `;
                table.appendChild(row);
            });
        }

        // Calculate pars for Day 1 and Day 2
        let outPar1 = 0, inPar1 = 0;
        let outPar2 = 0, inPar2 = 0;
        for (let i = 0; i < 9; i++) {
            outPar1 += this.state.parsDay1[i];
            outPar2 += this.state.parsDay2[i];
        }
        for (let i = 9; i < 18; i++) {
            inPar1 += this.state.parsDay1[i];
            inPar2 += this.state.parsDay2[i];
        }
        
        const totalPar1 = outPar1 + inPar1;
        const totalPar2 = outPar2 + inPar2;
        
        let displayTotal, displayOut, displayIn;
        if (this.leaderboardDay === 'day1') {
            displayTotal = `${totalPar1}`;
            displayOut = `${outPar1}`;
            displayIn = `${inPar1}`;
        } else if (this.leaderboardDay === 'day2') {
            displayTotal = `${totalPar2}`;
            displayOut = `${outPar2}`;
            displayIn = `${inPar2}`;
        } else {
            displayTotal = `${totalPar1 + totalPar2} (D1:${totalPar1} / D2:${totalPar2})`;
            displayOut = `D1:${outPar1} / D2:${outPar2}`;
            displayIn = `D1:${inPar1} / D2:${inPar2}`;
        }

        const totalParElem = document.getElementById('regulation-total-par');
        const outParElem = document.getElementById('regulation-out-par');
        const inParElem = document.getElementById('regulation-in-par');
        if (totalParElem) totalParElem.innerText = displayTotal;
        if (outParElem) outParElem.innerText = displayOut;
        if (inParElem) inParElem.innerText = displayIn;
    }

    renderHome() {
        // Ensure portal content is visible if splash is already completed/removed
        const splash = document.getElementById('splash-screen');
        const pageHome = document.getElementById('page-home');
        if (!splash && pageHome) {
            pageHome.classList.remove('portal-content-hidden');
            pageHome.classList.add('portal-content-visible');
        }
    }

    // LEADERBOARD SCREEN
    changeLeaderboardDay(dayType) {
        this.leaderboardDay = dayType;
        
        document.querySelectorAll('#page-leaderboard .control-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`btn-leaderboard-${dayType}`).classList.add('active');
        
        this.renderLeaderboard();
    }

    renderLeaderboard() {
        const container = document.getElementById('detailed-leaderboard');
        container.innerHTML = '';

        const dayNum = this.leaderboardDay === 'day1' ? 1 : (this.leaderboardDay === 'day2' ? 2 : null);

        // Map and sort players based on selected day
        const playerStats = this.state.players.map(p => this.getPlayerStats(p.id, dayNum))
            .sort((a, b) => {
                if (a.playedHoles === 0) return 1;
                if (b.playedHoles === 0) return -1;
                
                if (a.netDiff !== b.netDiff) return a.netDiff - b.netDiff;
                return a.grossDiff - b.grossDiff;
            });

        playerStats.forEach((stat, index) => {
            const rank = index + 1;
            const netDiffText = this.formatScoreDiff(stat.netDiff, stat.playedHoles);
            const grossDiffText = this.formatScoreDiff(stat.grossDiff, stat.playedHoles);
            
            let hcpText = "";
            if (dayNum === 1) {
                hcpText = `イーブン値 (D1): ${stat.player.handicapDay1 ?? 0} (按分: ${stat.liveHandicap})`;
            } else if (dayNum === 2) {
                hcpText = `イーブン値 (D2): ${stat.player.handicapDay2 ?? 0} (按分: ${stat.liveHandicap})`;
            } else {
                hcpText = `イーブン値: D1:${stat.player.handicapDay1 ?? 0} / D2:${stat.player.handicapDay2 ?? 0} (按分計: ${stat.liveHandicap})`;
            }

            // Formulate detail row html for Out / In details
            const card = document.createElement('div');
            card.className = `glass-card leader-card pos-${rank}`;
            
            // Expandable details (accordion)
            card.onclick = () => {
                const details = card.querySelector('.leader-details');
                details.classList.toggle('hidden');
            };

            card.innerHTML = `
                <div class="leader-main">
                    <span class="leader-rank rank-${rank}">${rank}</span>
                    <div class="leader-name-section">
                        <div class="leader-name">${stat.player.name}</div>
                        <div class="leader-handicap-tag">${hcpText}</div>
                    </div>
                    <div class="leader-scores">
                        <div class="score-item">
                            <span class="score-lbl">グロス</span>
                            <span class="score-val">${stat.playedHoles > 0 ? stat.totalGross : '-'} (${grossDiffText})</span>
                        </div>
                        <div class="score-item">
                            <span class="score-lbl">ネット</span>
                            <span class="net-score-val ${this.getScoreClass(stat.netDiff, stat.playedHoles)}">${netDiffText}</span>
                        </div>
                    </div>
                </div>
                <div class="leader-details hidden">
                    <div class="details-row">
                        <span>進行状況</span>
                        <span class="details-val">${stat.playedHoles} / ${dayNum ? 18 : 36} ホール完了</span>
                    </div>
                    <div class="details-row">
                        <span>OUT グロス / Par</span>
                        <span class="details-val">${stat.outGross} / ${stat.outPar}</span>
                    </div>
                    <div class="details-row">
                        <span>IN グロス / Par</span>
                        <span class="details-val">${stat.inGross} / ${stat.inPar}</span>
                    </div>
                    <div class="details-row">
                        <span>基準打数 (Par合計)</span>
                        <span class="details-val">${stat.totalPar}</span>
                    </div>
                    <div class="details-row" style="grid-column: span 2; border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 6px; margin-top: 4px; font-weight:500;">
                        <span>※ カードタップで詳細を閉じる</span>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    // SCORE INPUT SCREEN
    changeScoreDay(dayNum) {
        this.scoreActiveDay = dayNum;
        
        document.querySelectorAll('#page-score .segmented-control.mini .control-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`btn-score-day${dayNum}`).classList.add('active');
        
        this.renderScoreInput();
    }

    changeScorePlayer(playerId) {
        this.scoreActivePlayerId = playerId;
        
        document.querySelectorAll('.player-chip').forEach(chip => {
            chip.classList.remove('active');
        });
        document.getElementById(`chip-player-${playerId}`).classList.add('active');
        
        this.renderScoreInput();
    }

    switchScoreHalf(half) {
        this.scoreActiveHalf = half;
        
        document.querySelectorAll('.score-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(`tab-score-${half}`).classList.add('active');
        
        document.getElementById('grid-out').classList.add('hidden');
        document.getElementById('grid-in').classList.add('hidden');
        document.getElementById('grid-summary').classList.add('hidden');
        
        document.getElementById(`grid-${half}`).classList.remove('hidden');
        
        this.renderScoreInput();
    }

    renderScoreInput() {
        // 1. Render Player Chips
        const chipsContainer = document.getElementById('player-selector-chips');
        chipsContainer.innerHTML = '';
        this.state.players.forEach(p => {
            const chip = document.createElement('button');
            chip.id = `chip-player-${p.id}`;
            chip.className = `player-chip ${this.scoreActivePlayerId === p.id ? 'active' : ''}`;
            chip.innerText = p.name;
            chip.onclick = () => this.changeScorePlayer(p.id);
            chipsContainer.appendChild(chip);
        });

        // Current scores and pars
        const pId = this.scoreActivePlayerId;
        const dayKey = `day${this.scoreActiveDay}`;
        const currentScores = this.state.scores[pId]?.[dayKey] || Array(18).fill(null);
        
        // 2. Render OUT (1-9) Rows
        const rowsOut = document.getElementById('rows-out');
        rowsOut.innerHTML = '';
        for (let i = 0; i < 9; i++) {
            rowsOut.appendChild(this.createScoreRowElement(i, currentScores[i]));
        }

        // 3. Render IN (10-18) Rows
        const rowsIn = document.getElementById('rows-in');
        rowsIn.innerHTML = '';
        for (let i = 9; i < 18; i++) {
            rowsIn.appendChild(this.createScoreRowElement(i, currentScores[i]));
        }

        // 4. Render Summary Tab
        this.renderScoreSummary(pId);
    }

    createScoreRowElement(holeIdx, score) {
        const holeNum = holeIdx + 1;
        const pars = this.scoreActiveDay === 1 ? this.state.parsDay1 : this.state.parsDay2;
        const parVal = pars[holeIdx];
        
        const row = document.createElement('div');
        row.className = 'score-grid-row';
        
        let scoreClass = 'empty';
        let scoreText = '−';
        
        if (score !== null && score > 0) {
            scoreText = score.toString();
            const diff = score - parVal;
            if (diff < 0) {
                scoreClass = 'birdie-plus'; // Under par
            } else if (diff > 0) {
                scoreClass = 'bogey-plus'; // Over par
            } else {
                scoreClass = 'even-play'; // Even
            }
        }
        
        row.innerHTML = `
            <div class="grid-col-hole">
                <span class="hole-num">Hole ${holeNum}</span>
                <span class="hole-par-badge">Par ${parVal}</span>
            </div>
            <div class="score-inplace-control">
                <button class="score-adjust-btn btn-minus" onclick="app.adjustScoreInplace(${holeIdx}, -1)">−</button>
                <div id="score-display-${holeIdx}" class="score-value-display ${scoreClass}">
                    ${scoreText}
                </div>
                <button class="score-adjust-btn btn-plus" onclick="app.adjustScoreInplace(${holeIdx}, 1)">+</button>
            </div>
        `;
        return row;
    }

    renderScoreSummary(playerId) {
        const summaryContainer = document.getElementById('grid-summary');
        const dayKey = `day${this.scoreActiveDay}`;
        const dayScores = this.state.scores[playerId]?.[dayKey] || Array(18).fill(null);
        const player = this.state.players.find(p => p.id === playerId);
        
        let playedOut = 0, playedIn = 0;
        let grossOut = 0, grossIn = 0;
        let parOut = 0, parIn = 0;
        
        const pars = this.scoreActiveDay === 1 ? this.state.parsDay1 : this.state.parsDay2;

        // Out Calculations
        for (let i = 0; i < 9; i++) {
            const s = dayScores[i];
            if (s !== null && s > 0) {
                playedOut++;
                grossOut += s;
                parOut += pars[i];
            }
        }
        // In Calculations
        for (let i = 9; i < 18; i++) {
            const s = dayScores[i];
            if (s !== null && s > 0) {
                playedIn++;
                grossIn += s;
                parIn += pars[i];
            }
        }

        const totalPlayed = playedOut + playedIn;
        const totalGross = grossOut + grossIn;
        const totalPar = parOut + parIn;
        const grossDiff = totalGross - totalPar;
        
        // Single Day live handicap
        const hcp = this.scoreActiveDay === 1 
            ? (player.handicapDay1 ?? 0) 
            : (player.handicapDay2 ?? 0);
        const liveHcp = parseFloat((hcp * (totalPlayed / 18)).toFixed(1)); // Day specific handicap (base 18 holes)
        const netScore = totalGross - liveHcp;
        const netDiff = grossDiff - liveHcp;

        summaryContainer.innerHTML = `
            <div class="summary-stats-grid">
                <div class="stat-box">
                    <span class="stat-val">${totalPlayed > 0 ? totalGross : '-'}</span>
                    <span class="stat-lbl">グロススコア</span>
                </div>
                <div class="stat-box">
                    <span class="stat-val ${this.getScoreClass(netDiff, totalPlayed)}">${totalPlayed > 0 ? this.formatScoreDiff(netDiff, totalPlayed) : '-'}</span>
                    <span class="stat-lbl">ネット相対 (Par ${totalPar})</span>
                </div>
            </div>
            <div class="summary-analysis">
                <h4 class="analysis-title">${player.name} の成績内訳 (Day ${this.scoreActiveDay})</h4>
                <div class="analysis-row">
                    <span>OUT (1-9) スコア</span>
                    <span class="analysis-val">${playedOut > 0 ? grossOut : '-'} / Par ${parOut} (${playedOut}ホール消化)</span>
                </div>
                <div class="analysis-row">
                    <span>IN (10-18) スコア</span>
                    <span class="analysis-val">${playedIn > 0 ? grossIn : '-'} / Par ${parIn} (${playedIn}ホール消化)</span>
                </div>
                <div class="analysis-row" style="border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 8px; margin-top: 8px;">
                    <span>設定ハンデ値 (Day単体)</span>
                    <span class="analysis-val" style="color:var(--accent-gold);">${hcp} (按分: ${liveHcp})</span>
                </div>
                <div class="analysis-row">
                    <span>ネットスコア値</span>
                    <span class="analysis-val">${totalPlayed > 0 ? netScore.toFixed(1) : '-'}</span>
                </div>
            </div>
        `;
    }

    // INPLACE SCORE ADJUSTMENT (DIRECT ADJUSTMENT WITH PLUS / MINUS)
    adjustScoreInplace(holeIdx, delta) {
        const playerId = this.scoreActivePlayerId;
        const dayKey = `day${this.scoreActiveDay}`;
        
        if (!this.state.scores[playerId]) {
            this.state.scores[playerId] = { day1: Array(18).fill(null), day2: Array(18).fill(null) };
        }
        
        let currentValue = this.state.scores[playerId][dayKey][holeIdx];
        const pars = this.scoreActiveDay === 1 ? this.state.parsDay1 : this.state.parsDay2;
        const parVal = pars[holeIdx];
        
        if (currentValue === null || currentValue <= 0) {
            // If empty, pressing + or - sets it to Par first
            currentValue = parVal;
        } else {
            const newValue = currentValue + delta;
            if (newValue < 1) {
                // If adjusted below 1, clear to empty (null)
                currentValue = null;
            } else {
                currentValue = Math.max(1, Math.min(15, newValue));
            }
        }
        
        this.state.scores[playerId][dayKey][holeIdx] = currentValue;
        this.saveState();
        
        // Re-render score input grid
        this.renderScoreInput();
        
        // Trigger bounce pop animation for the updated cell display
        const displayElem = document.getElementById(`score-display-${holeIdx}`);
        if (displayElem) {
            displayElem.classList.add('cell-pop-active');
            setTimeout(() => {
                displayElem.classList.remove('cell-pop-active');
            }, 350);
        }
        
        this.showToast(currentValue === null 
            ? `Hole ${holeIdx + 1} のスコアをクリアしました` 
            : `Hole ${holeIdx + 1} のスコアを ${currentValue} に更新しました`
        );
    }

    // SETTINGS SCREEN
    initSettingsInputs() {
        document.getElementById('input-tournament-name').value = this.state.tournament.name;
        document.getElementById('input-tournament-date').value = this.state.tournament.date;
        
        // Populating Supabase URL and Key inputs
        const urlInput = document.getElementById('input-supabase-url');
        const keyInput = document.getElementById('input-supabase-key');
        if (urlInput) urlInput.value = this.state.supabaseUrl || "";
        if (keyInput) keyInput.value = this.state.supabaseKey || "";
        
        // Players Config List
        const playerList = document.getElementById('players-settings-list');
        playerList.innerHTML = '';
        
        this.state.players.forEach((p, idx) => {
            const row = document.createElement('div');
            row.className = 'player-config-row';
            row.innerHTML = `
                <span class="player-num-indicator">P${idx+1}</span>
                <span class="player-name-label">${p.name}</span>
                <div class="player-even-inputs-container">
                    <div class="player-even-input-group">
                        <span>D1:</span>
                        <input type="number" class="player-even-input" id="settings-p-hcp-day1-${p.id}" value="${p.handicapDay1 ?? 0}">
                    </div>
                    <div class="player-even-input-group">
                        <span>D2:</span>
                        <input type="number" class="player-even-input" id="settings-p-hcp-day2-${p.id}" value="${p.handicapDay2 ?? 0}">
                    </div>
                </div>
            `;
            playerList.appendChild(row);
        });

        // Par Settings
        const parOutGrid = document.getElementById('par-edit-out');
        const parInGrid = document.getElementById('par-edit-in');
        parOutGrid.innerHTML = '';
        parInGrid.innerHTML = '';
        
        // Out Par
        for (let i = 0; i < 9; i++) {
            parOutGrid.appendChild(this.createParEditCell(i));
        }
        // In Par
        for (let i = 9; i < 18; i++) {
            parInGrid.appendChild(this.createParEditCell(i));
        }
    }

    createParEditCell(holeIdx) {
        const cell = document.createElement('div');
        cell.className = 'par-edit-cell';
        const pars = this.parEditActiveDay === 1 ? this.state.parsDay1 : this.state.parsDay2;
        cell.innerHTML = `
            <span class="par-cell-num">${holeIdx + 1}</span>
            <input type="number" class="par-cell-input" id="settings-par-${holeIdx}" value="${pars[holeIdx]}" min="3" max="5">
        `;
        return cell;
    }

    renderSettings() {
        // Settings elements are pre-rendered and saved dynamically on button click.
    }

    async saveSupabaseSettings() {
        const url = document.getElementById('input-supabase-url').value.trim();
        const key = document.getElementById('input-supabase-key').value.trim();
        
        this.state.supabaseUrl = url;
        this.state.supabaseKey = key;
        this.saveState();
        
        this.showToast("クラウド同期設定を保存しました。再接続します...");
        this.initSupabase();
        
        if (this.supabase) {
            await this.syncWithCloud();
        }
    }

    saveTournamentInfo() {
        const name = document.getElementById('input-tournament-name').value.trim();
        const date = document.getElementById('input-tournament-date').value.trim();
        
        if (!name) {
            this.showToast("大会名を入力してください", true);
            return;
        }

        this.state.tournament.name = name;
        this.state.tournament.date = date;
        this.saveState();
        
        document.getElementById('display-tournament-name').innerText = name;
        document.getElementById('display-tournament-date').innerText = date;
        
        this.showToast("大会情報を保存しました");
    }

    savePlayersSettings() {
        const newPlayers = this.state.players.map(p => {
            const hcpDay1Input = document.getElementById(`settings-p-hcp-day1-${p.id}`);
            const hcpDay2Input = document.getElementById(`settings-p-hcp-day2-${p.id}`);
            
            const hcp1 = parseInt(hcpDay1Input.value, 10);
            const hcp2 = parseInt(hcpDay2Input.value, 10);
            
            return {
                id: p.id,
                name: p.name,
                handicapDay1: isNaN(hcp1) ? 0 : hcp1,
                handicapDay2: isNaN(hcp2) ? 0 : hcp2
            };
        });

        this.state.players = newPlayers;
        this.saveState();
        this.showToast("選手・ハンデ情報を保存しました");
        this.renderAll();
    }

    changeParEditDay(dayNum) {
        this.parEditActiveDay = dayNum;
        
        document.querySelectorAll('#page-settings .segmented-control.mini .control-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`btn-par-edit-day${dayNum}`).classList.add('active');
        
        // Re-render only Par settings inputs
        const parOutGrid = document.getElementById('par-edit-out');
        const parInGrid = document.getElementById('par-edit-in');
        parOutGrid.innerHTML = '';
        parInGrid.innerHTML = '';
        
        for (let i = 0; i < 9; i++) {
            parOutGrid.appendChild(this.createParEditCell(i));
        }
        for (let i = 9; i < 18; i++) {
            parInGrid.appendChild(this.createParEditCell(i));
        }
    }

    saveParSettings() {
        const newPars = [];
        for (let i = 0; i < 18; i++) {
            const parInput = document.getElementById(`settings-par-${i}`);
            const parVal = parseInt(parInput.value, 10);
            if (isNaN(parVal) || parVal < 3 || parVal > 5) {
                this.showToast(`Hole ${i+1} のPar設定が不正です (3〜5に設定してください)`, true);
                return;
            }
            newPars.push(parVal);
        }
        
        if (this.parEditActiveDay === 1) {
            this.state.parsDay1 = newPars;
        } else {
            this.state.parsDay2 = newPars;
        }
        
        this.saveState();
        this.showToast(`Day ${this.parEditActiveDay} の基準打数(Par)設定を保存しました`);
        this.renderAll();
    }

    // HELPER FORMATTING
    formatScoreDiff(diff, played) {
        if (played === 0) return '-';
        
        // Format to 1 decimal place if float
        const val = parseFloat(diff.toFixed(1));
        if (val === 0) return 'E';
        return val > 0 ? `+${val}` : `${val}`;
    }

    getScoreClass(diff, played) {
        if (played === 0) return 'even-par';
        const val = parseFloat(diff.toFixed(1));
        if (val === 0) return 'even-par';
        return val < 0 ? 'under-par' : 'over-par';
    }
}

// Global instance initiation
window.app = new GolfApp();
