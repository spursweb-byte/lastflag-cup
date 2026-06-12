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
                { id: 1, name: "プレイヤーA", handicap: 10 },
                { id: 2, name: "プレイヤーB", handicap: 15 },
                { id: 3, name: "プレイヤーC", handicap: 5 },
                { id: 4, name: "プレイヤーD", handicap: 0 }
            ],
            pars: [4, 4, 3, 4, 5, 4, 3, 4, 5,  4, 3, 4, 4, 5, 3, 4, 4, 5], // 18 holes par (Out: 36, In: 36)
            scores: {
                1: { day1: Array(18).fill(null), day2: Array(18).fill(null) },
                2: { day1: Array(18).fill(null), day2: Array(18).fill(null) },
                3: { day1: Array(18).fill(null), day2: Array(18).fill(null) },
                4: { day1: Array(18).fill(null), day2: Array(18).fill(null) }
            }
        };

        this.state = null;
        
        // Active UI States
        this.currentTab = 'home';
        this.leaderboardDay = 'total'; // 'total', 'day1', 'day2'
        
        // Score Entry UI States
        this.scoreActiveDay = 1; // 1 or 2
        this.scoreActivePlayerId = 1; // Player ID
        this.scoreActiveHalf = 'out'; // 'out', 'in', 'summary'
        
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
                if (!this.state.pars || this.state.pars.length !== 18) {
                    this.state.pars = [...this.defaultState.pars];
                }
                // Check if scores is properly initialized
                if (!this.state.scores) {
                    this.state.scores = { ...this.defaultState.scores };
                }
                // Migrate date if it's the old default to automatically reflect new dates
                if (this.state.tournament && this.state.tournament.date === "2026/06/11 - 06/12") {
                    this.state.tournament.date = "2026/07/10 - 07/11";
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
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
        } catch (e) {
            console.error("Failed to save state", e);
            this.showToast("データの保存に失敗しました", true);
        }
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

        const handicap = player.handicap || 0;
        
        let playedHoles = 0;
        let totalGross = 0;
        let totalPar = 0;
        
        const daysToProcess = dayNum ? [dayNum] : [1, 2];
        
        daysToProcess.forEach(d => {
            const dayKey = `day${d}`;
            const dayScores = this.state.scores[playerId]?.[dayKey] || Array(18).fill(null);
            
            dayScores.forEach((score, idx) => {
                if (score !== null && score > 0) {
                    playedHoles++;
                    totalGross += score;
                    totalPar += this.state.pars[idx];
                }
            });
        });

        // Live Handicap Calculation:按分ハンデ (イーブン値 * 消化ホール数 / 大会総ホール数(36))
        // 1日のみの計算（dayNum指定時）なら、総ホール数は18として按分する
        const maxHoles = dayNum ? 18 : 36;
        const liveHandicap = playedHoles > 0 ? (handicap * (playedHoles / maxHoles)) : 0;
        
        const grossDiff = totalGross - totalPar; // Parに対する差 (グロス)
        const netDiff = grossDiff - liveHandicap; // Parに対する差 (ネット)
        const netScore = totalGross - liveHandicap; // ネットスコア実値

        // Out/In breakdown
        let outGross = 0;
        let inGross = 0;
        let outPar = 0;
        let inPar = 0;
        
        daysToProcess.forEach(d => {
            const dayKey = `day${d}`;
            const dayScores = this.state.scores[playerId]?.[dayKey] || Array(18).fill(null);
            
            // Out (Holes 1-9, index 0-8)
            for (let i = 0; i < 9; i++) {
                if (dayScores[i] !== null && dayScores[i] > 0) {
                    outGross += dayScores[i];
                    outPar += this.state.pars[i];
                }
            }
            // In (Holes 10-18, index 9-17)
            for (let i = 9; i < 18; i++) {
                if (dayScores[i] !== null && dayScores[i] > 0) {
                    inGross += dayScores[i];
                    inPar += this.state.pars[i];
                }
            }
        });

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
            // 完了したか (すべて入力済みか)
            isFinished: playedHoles === maxHoles
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
        
        this.triggerSplashTransition(() => {
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
        });
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
                    <span class="reg-p-hcp">独自イーブン値: +${p.handicap}</span>
                `;
                table.appendChild(row);
            });
        }

        // Calculate total par, out par, in par
        let outPar = 0;
        let inPar = 0;
        for (let i = 0; i < 9; i++) {
            outPar += this.state.pars[i];
        }
        for (let i = 9; i < 18; i++) {
            inPar += this.state.pars[i];
        }
        const totalPar = outPar + inPar;

        const totalParElem = document.getElementById('regulation-total-par');
        const outParElem = document.getElementById('regulation-out-par');
        const inParElem = document.getElementById('regulation-in-par');
        if (totalParElem) totalParElem.innerText = totalPar;
        if (outParElem) outParElem.innerText = outPar;
        if (inParElem) inParElem.innerText = inPar;
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
                        <div class="leader-handicap-tag">ハンデ値 (設定値): ${stat.player.handicap} (按分: ${stat.liveHandicap})</div>
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
        const parVal = this.state.pars[holeIdx];
        
        const row = document.createElement('div');
        row.className = 'score-grid-row';
        
        let scoreClass = 'empty';
        let scoreText = '入力';
        
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
            </div>
            <div class="hole-par-val">Par ${parVal}</div>
            <div class="score-input-trigger">
                <button id="score-btn-${holeIdx}" class="score-cell-btn ${scoreClass}" onclick="app.openKeypad(${this.scoreActivePlayerId}, ${this.scoreActiveDay}, ${holeIdx}, ${score})">
                    ${scoreText}
                </button>
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
        
        // Out Calculations
        for (let i = 0; i < 9; i++) {
            const s = dayScores[i];
            if (s !== null && s > 0) {
                playedOut++;
                grossOut += s;
                parOut += this.state.pars[i];
            }
        }
        // In Calculations
        for (let i = 9; i < 18; i++) {
            const s = dayScores[i];
            if (s !== null && s > 0) {
                playedIn++;
                grossIn += s;
                parIn += this.state.pars[i];
            }
        }

        const totalPlayed = playedOut + playedIn;
        const totalGross = grossOut + grossIn;
        const totalPar = parOut + parIn;
        const grossDiff = totalGross - totalPar;
        
        // Single Day live handicap
        const hcp = player.handicap || 0;
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

    // KEYPAD MODAL
    openKeypad(playerId, day, holeIdx, currentScore) {
        const player = this.state.players.find(p => p.id === playerId);
        const par = this.state.pars[holeIdx];
        
        this.keypadState = {
            playerId,
            day,
            holeIndex: holeIdx,
            currentValue: currentScore !== null ? currentScore : par // Default to Par if empty
        };
        
        document.getElementById('keypad-hole-num').innerText = holeIdx + 1;
        document.getElementById('keypad-hole-par').innerText = par;
        document.getElementById('keypad-player-display').innerText = player.name;
        
        this.updateKeypadDisplay();
        
        document.getElementById('keypad-modal').classList.add('open');
    }

    updateKeypadDisplay() {
        const display = document.getElementById('keypad-score-value');
        if (this.keypadState.currentValue === null || this.keypadState.currentValue <= 0) {
            display.innerText = '未入力';
            display.classList.add('empty');
        } else {
            display.innerText = this.keypadState.currentValue;
            display.classList.remove('empty');
        }
    }

    adjustKeypadScore(delta) {
        if (this.keypadState.currentValue === null) {
            this.keypadState.currentValue = this.state.pars[this.keypadState.holeIndex];
        } else {
            this.keypadState.currentValue = Math.max(1, this.keypadState.currentValue + delta);
        }
        this.updateKeypadDisplay();
    }

    setKeypadScore(val) {
        this.keypadState.currentValue = val;
        this.updateKeypadDisplay();
    }

    clearKeypadScore() {
        this.keypadState.currentValue = null;
        this.updateKeypadDisplay();
    }

    closeKeypad(event) {
        // Can be called with event or null
        if (event && event.target !== document.getElementById('keypad-modal')) {
            return;
        }
        document.getElementById('keypad-modal').classList.remove('open');
    }

    confirmKeypadScore() {
        const { playerId, day, holeIndex, currentValue } = this.keypadState;
        const dayKey = `day${day}`;
        
        if (!this.state.scores[playerId]) {
            this.state.scores[playerId] = { day1: Array(18).fill(null), day2: Array(18).fill(null) };
        }
        
        this.state.scores[playerId][dayKey][holeIndex] = currentValue;
        this.saveState();
        
        this.closeKeypad(null);
        
        const wasOutHole = holeIndex < 9;
        const isCurrentOutTab = this.scoreActiveHalf === 'out';
        const isCurrentInTab = this.scoreActiveHalf === 'in';
        
        this.renderScoreInput();
        
        // If the modified hole is currently rendered on screen, trigger bounce pop animation
        if ((wasOutHole && isCurrentOutTab) || (!wasOutHole && isCurrentInTab)) {
            const btn = document.getElementById(`score-btn-${holeIndex}`);
            if (btn) {
                btn.classList.add('cell-pop-active');
                setTimeout(() => {
                    btn.classList.remove('cell-pop-active');
                }, 400);
            }
        }
        
        this.showToast(`Hole ${holeIndex + 1} のスコアを更新しました`);
    }

    // SETTINGS SCREEN
    initSettingsInputs() {
        document.getElementById('input-tournament-name').value = this.state.tournament.name;
        document.getElementById('input-tournament-date').value = this.state.tournament.date;
        
        // Players Config List
        const playerList = document.getElementById('players-settings-list');
        playerList.innerHTML = '';
        
        this.state.players.forEach((p, idx) => {
            const row = document.createElement('div');
            row.className = 'player-config-row';
            row.innerHTML = `
                <span class="player-num-indicator">P${idx+1}</span>
                <input type="text" class="player-name-input" id="settings-p-name-${p.id}" value="${p.name}" placeholder="選手名">
                <div class="player-even-input-group">
                    <span>イーブン:</span>
                    <input type="number" class="player-even-input" id="settings-p-hcp-${p.id}" value="${p.handicap}" placeholder="ハンデ">
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
        cell.innerHTML = `
            <span class="par-cell-num">${holeIdx + 1}</span>
            <input type="number" class="par-cell-input" id="settings-par-${holeIdx}" value="${this.state.pars[holeIdx]}" min="3" max="5">
        `;
        return cell;
    }

    renderSettings() {
        // Settings elements are pre-rendered and saved dynamically on button click.
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
        let hasError = false;
        
        const newPlayers = this.state.players.map(p => {
            const nameInput = document.getElementById(`settings-p-name-${p.id}`);
            const hcpInput = document.getElementById(`settings-p-hcp-${p.id}`);
            
            const name = nameInput.value.trim();
            const handicap = parseInt(hcpInput.value, 10);
            
            if (!name) {
                hasError = true;
                nameInput.style.borderColor = 'var(--accent-red)';
            } else {
                nameInput.style.borderColor = 'var(--card-border)';
            }
            
            return {
                id: p.id,
                name: name || p.name,
                handicap: isNaN(handicap) ? 0 : handicap
            };
        });

        if (hasError) {
            this.showToast("選手名を入力してください", true);
            return;
        }

        this.state.players = newPlayers;
        this.saveState();
        this.showToast("選手・ハンデ情報を保存しました");
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
        
        this.state.pars = newPars;
        this.saveState();
        this.showToast("基準打数(Par)設定を保存しました");
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
