(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const levelLabel = document.getElementById('levelLabel');
  const bubble = document.getElementById('speechBubble');
  const levelModal = document.getElementById('levelModal');
  const winModal = document.getElementById('winModal');
  const loseModal = document.getElementById('loseModal');
  const soundBtn = document.getElementById('soundBtn');
  const nextLevelBtn = document.getElementById('nextLevelBtn');
  const levelMenuCloseBtn = document.getElementById('levelMenuCloseBtn');
  const levelButtons = [...document.querySelectorAll('[data-level]')];

  const W = 960;
  const H = 640;
  const RENDER_SCALE = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
  canvas.width = W * RENDER_SCALE;
  canvas.height = H * RENDER_SCALE;
  ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const mouseImage = loadImage('assets/mouse.png');
  const cheeseImage = loadImage('assets/cheese.png');
  const exitImage = loadImage('assets/exit.png');
  const trapImage = loadImage('assets/mousetrap.png');
  const syllables = ['СА', 'СО', 'СУ', 'СЫ', 'СЭ'];
  const syllableBubbleClasses = {
    'СА': 'speech-bubble--sa',
    'СО': 'speech-bubble--so',
    'СУ': 'speech-bubble--su',
    'СЫ': 'speech-bubble--sy',
    'СЭ': 'speech-bubble--se'
  };
  const syllableAudio = {
    'СА': new Audio('assets/audio/sa.m4a'),
    'СО': new Audio('assets/audio/so.m4a'),
    'СУ': new Audio('assets/audio/su.m4a'),
    'СЫ': new Audio('assets/audio/sy.m4a'),
    'СЭ': new Audio('assets/audio/se.m4a')
  };

  const borderWalls = [
    {x:20,y:20,w:920,h:24}, {x:20,y:596,w:920,h:24}, {x:20,y:20,w:24,h:600},
    {x:916,y:20,w:24,h:38}, {x:916,y:142,w:24,h:478}
  ];

  const LEVELS = [
    {
      name: 'Лёгкий путь',
      walls: [
        ...borderWalls,
        {x:208,y:458,w:20,h:138}, {x:382,y:44,w:20,h:138},
        {x:730,y:182,w:20,h:138}, {x:730,y:320,w:20,h:138},
        {x:566,y:172,w:174,h:20},
        {x:44,y:310,w:174,h:20}, {x:218,y:310,w:174,h:20},
        {x:566,y:310,w:174,h:20},
        {x:218,y:448,w:174,h:20}, {x:392,y:448,w:174,h:20}
      ],
      cheeses: [[131,113],[479,113],[305,251],[653,251],[131,389],[479,389],[828,389],[305,527]],
      traps: []
    },
    {
      name: 'Ловкий мышонок',
      walls: [
        ...borderWalls,
        {x:208,y:44,w:20,h:138}, {x:382,y:182,w:20,h:138},
        {x:382,y:458,w:20,h:138}, {x:556,y:320,w:20,h:138},
        {x:730,y:182,w:20,h:138}, {x:730,y:320,w:20,h:138},
        {x:392,y:172,w:174,h:20},
        {x:218,y:310,w:174,h:20}, {x:566,y:310,w:174,h:20},
        {x:44,y:448,w:174,h:20}, {x:392,y:448,w:174,h:20}
      ],
      cheeses: [[131,113],[653,113],[479,251],[828,251],[653,389],[479,527],[828,527]],
      traps: [[345,389]]
    },
    {
      name: 'Сырное приключение',
      walls: [
        ...borderWalls,
        {x:208,y:182,w:20,h:138},
        {x:382,y:320,w:20,h:138},
        {x:556,y:182,w:20,h:138}, {x:556,y:458,w:20,h:138},
        {x:730,y:320,w:20,h:138},
        {x:218,y:172,w:174,h:20}, {x:392,y:172,w:174,h:20},
        {x:566,y:172,w:174,h:20}, {x:740,y:310,w:176,h:20},
        {x:44,y:448,w:174,h:20}
      ],
      cheeses: [[131,113],[479,113],[653,113],[305,251],[131,370],[828,389],[828,527]],
      traps: [[305,458],[566,389]]
    }
  ];

  let activeSyllableAudio = null;
  let soundOn = true;
  let playing = false;
  let won = false;
  let lost = false;
  let currentLevelIndex = 0;
  let unlockedLevel = readUnlockedLevel();
  let gameStarted = false;
  let menuCanResume = false;
  let lastTime = performance.now();
  let dust = [];
  let cheeses = [];
  let traps = [];

  const player = {
    x: 100, y: 530, r: 28,
    targetX: 100, targetY: 530, angle: 0,
    moving: false, runPhase: 0, dustCooldown: 0
  };
  const exit = { x: 900, y: 100, r: 50 };

  Object.values(syllableAudio).forEach(audio => {
    audio.preload = 'auto';
    audio.addEventListener('ended', () => {
      if (activeSyllableAudio === audio) activeSyllableAudio = null;
    });
  });

  function loadImage(src) {
    const image = new Image();
    image.src = src;
    image.onload = draw;
    return image;
  }

  function readUnlockedLevel() {
    try {
      return Math.max(1, Math.min(3, Number(localStorage.getItem('cheeseMazeUnlocked')) || 1));
    } catch (_) {
      return 1;
    }
  }

  function saveUnlockedLevel() {
    try {
      localStorage.setItem('cheeseMazeUnlocked', String(unlockedLevel));
    } catch (_) {
      // Игра продолжает работать, даже если браузер запретил локальное сохранение.
    }
  }

  function currentLevel() {
    return LEVELS[currentLevelIndex];
  }

  function startLevel(levelNumber) {
    if (levelNumber > unlockedLevel) return;
    currentLevelIndex = levelNumber - 1;
    gameStarted = true;
    menuCanResume = false;
    levelModal.classList.remove('is-open');
    winModal.classList.remove('is-open');
    loseModal.classList.remove('is-open');
    resetLevel();
    showBubble('Начинаем!', 145, 535);
  }

  function resetLevel() {
    const level = currentLevel();
    player.x = 100;
    player.y = 530;
    player.targetX = player.x;
    player.targetY = player.y;
    player.angle = 0;
    player.moving = false;
    player.runPhase = 0;
    player.dustCooldown = 0;
    cheeses = level.cheeses.map((p, i) => ({
      x:p[0], y:p[1], r:28,
      syllable:syllables[i % syllables.length],
      collected:false,
      pulse:i * .73
    }));
    traps = level.traps.map(p => ({x:p[0], y:p[1], r:34, pulse:Math.random() * Math.PI * 2}));
    dust = [];
    won = false;
    lost = false;
    playing = true;
    levelLabel.textContent = `Уровень ${currentLevelIndex + 1}`;
    updateScore();
    draw();
  }

  function openLevelMenu(canResume = false) {
    menuCanResume = canResume && gameStarted && !won && !lost;
    playing = false;
    player.moving = false;
    stopCurrentSound();
    winModal.classList.remove('is-open');
    loseModal.classList.remove('is-open');
    updateLevelButtons();
    levelModal.classList.add('is-open');
  }

  function closeLevelMenu() {
    levelModal.classList.remove('is-open');
    if (menuCanResume) {
      playing = true;
      menuCanResume = false;
      return;
    }
    startLevel(currentLevelIndex + 1);
  }

  function updateLevelButtons() {
    levelButtons.forEach(button => {
      const level = Number(button.dataset.level);
      const isLocked = level > unlockedLevel;
      button.disabled = isLocked;
      button.classList.toggle('is-locked', isLocked);
      const status = button.querySelector('.level-choice__status');
      if (status) status.textContent = isLocked ? '🔒 Сначала пройди предыдущий' : LEVELS[level - 1].name;
    });
  }

  function updateScore() {
    const collected = cheeses.filter(c => c.collected).length;
    scoreEl.textContent = `${collected} / ${cheeses.length}`;
  }

  function stopCurrentSound() {
    if (activeSyllableAudio) {
      activeSyllableAudio.pause();
      activeSyllableAudio.currentTime = 0;
      activeSyllableAudio = null;
    }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  function speak(text, x, y) {
    showBubble(text, x, y);
    if (!soundOn) return;
    stopCurrentSound();
    const recordedAudio = syllableAudio[text.toUpperCase()];
    if (recordedAudio) {
      recordedAudio.currentTime = 0;
      activeSyllableAudio = recordedAudio;
      recordedAudio.play().catch(() => {
        if (activeSyllableAudio === recordedAudio) activeSyllableAudio = null;
      });
      return;
    }
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text.toLowerCase());
    utterance.lang = 'ru-RU';
    utterance.rate = .62;
    utterance.pitch = 1.12;
    utterance.volume = 1;
    const ruVoice = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith('ru'));
    if (ruVoice) utterance.voice = ruVoice;
    speechSynthesis.speak(utterance);
  }

  function showBubble(text, x, y) {
    bubble.textContent = text;
    bubble.style.left = `${x / W * 100}%`;
    bubble.style.top = `${y / H * 100}%`;
    bubble.classList.remove('show', ...Object.values(syllableBubbleClasses));
    const colorClass = syllableBubbleClasses[text.toUpperCase()];
    if (colorClass) bubble.classList.add(colorClass);
    void bubble.offsetWidth;
    bubble.classList.add('show');
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x:(event.clientX - rect.left) * W / rect.width,
      y:(event.clientY - rect.top) * H / rect.height
    };
  }

  function chooseTarget(event) {
    event.preventDefault();
    if (!playing || won || lost) return;
    const p = canvasPoint(event);
    player.targetX = Math.max(44, Math.min(914, p.x));
    player.targetY = Math.max(44, Math.min(594, p.y));
    player.angle = Math.atan2(player.targetY - player.y, player.targetX - player.x);
  }

  function hitsWall(x, y) {
    return currentLevel().walls.some(w => circleRect(x, y, player.r, w));
  }

  function circleRect(cx, cy, r, rect) {
    const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
    const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
    return distance(cx, cy, nx, ny) < r;
  }

  function distance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  function triggerLoss() {
    lost = true;
    playing = false;
    player.moving = false;
    player.targetX = player.x;
    player.targetY = player.y;
    stopCurrentSound();
    setTimeout(() => loseModal.classList.add('is-open'), 220);
  }

  function completeLevel() {
    won = true;
    playing = false;
    player.moving = false;
    if (currentLevelIndex < LEVELS.length - 1) {
      unlockedLevel = Math.max(unlockedLevel, currentLevelIndex + 2);
      saveUnlockedLevel();
      nextLevelBtn.hidden = false;
      nextLevelBtn.textContent = `Перейти на уровень ${currentLevelIndex + 2}`;
    } else {
      nextLevelBtn.hidden = true;
    }
    document.getElementById('winTitle').textContent = currentLevelIndex === 2 ? 'Все уровни пройдены!' : 'Уровень пройден!';
    setTimeout(() => winModal.classList.add('is-open'), 350);
    showBubble('Молодец!', exit.x, exit.y);
  }

  function update(dt) {
    if (!playing || won || lost) return;
    const dx = player.targetX - player.x;
    const dy = player.targetY - player.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      const step = Math.min(d, 185 * dt);
      const nx = player.x + dx / d * step;
      const ny = player.y + dy / d * step;
      if (hitsWall(nx, ny)) {
        player.targetX = player.x;
        player.targetY = player.y;
        player.moving = false;
        dust.push({x:player.x + dx / d * 20, y:player.y + dy / d * 20, life:1});
      } else {
        player.x = nx;
        player.y = ny;
        player.moving = true;
        player.runPhase += dt * 13;
        player.dustCooldown -= dt;
        if (player.dustCooldown <= 0) {
          dust.push({
            x:player.x - Math.cos(player.angle) * 25,
            y:player.y - Math.sin(player.angle) * 25 + 15,
            life:.55,
            vx:-Math.cos(player.angle) * 18 + (Math.random() - .5) * 16,
            vy:-15 - Math.random() * 10,
            color:'#c9ad87'
          });
          player.dustCooldown = .16;
        }
      }
    } else {
      player.moving = false;
    }

    traps.forEach(trap => { trap.pulse += dt * 2.2; });
    if (traps.some(trap => distance(player.x, player.y, trap.x, trap.y) < player.r + trap.r)) {
      triggerLoss();
      return;
    }

    cheeses.forEach(c => {
      c.pulse += dt * 3;
      if (!c.collected && distance(player.x, player.y, c.x, c.y) < player.r + c.r) {
        c.collected = true;
        speak(c.syllable, c.x, c.y - 12);
        updateScore();
        for (let i = 0; i < 12; i++) {
          dust.push({x:c.x, y:c.y, life:1, vx:(Math.random() - .5) * 90, vy:(Math.random() - .5) * 90, color:'#ffd447'});
        }
      }
    });
    dust.forEach(p => {
      p.life -= dt * 1.8;
      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;
    });
    dust = dust.filter(p => p.life > 0);

    if (cheeses.length && cheeses.every(c => c.collected) && distance(player.x, player.y, exit.x, exit.y) < 58) {
      completeLevel();
    }
  }

  const mazeLayerCache = new Map();

  function createMazeLayer(levelIndex) {
    const layer = document.createElement('canvas');
    layer.width = W;
    layer.height = H;

    const layerCtx = layer.getContext('2d', { alpha: true });
    const walls = LEVELS[levelIndex].walls;
    const horizontalWalls = walls.filter(wall => wall.w >= wall.h);
    const verticalWalls = walls.filter(wall => wall.h > wall.w);

    // Draw walls at their exact size so their outer edges stay perfectly flat.
    layerCtx.imageSmoothingEnabled = false;
    layerCtx.fillStyle = '#6f795a';
    walls.forEach(wall => {
      layerCtx.fillRect(wall.x, wall.y, wall.w, wall.h);
    });

    // The level geometry joins walls by their centre lines. Fill the complete
    // junction square at every crossing so an elbow has one solid outer corner
    // instead of a gap or a short protruding "step".
    horizontalWalls.forEach(horizontal => {
      const horizontalCenterY = horizontal.y + horizontal.h / 2;

      verticalWalls.forEach(vertical => {
        const verticalCenterX = vertical.x + vertical.w / 2;
        const centerLinesMeet =
          verticalCenterX >= horizontal.x &&
          verticalCenterX <= horizontal.x + horizontal.w &&
          horizontalCenterY >= vertical.y &&
          horizontalCenterY <= vertical.y + vertical.h;

        if (centerLinesMeet) {
          layerCtx.fillRect(vertical.x, horizontal.y, vertical.w, horizontal.h);
        }
      });
    });

    return layer;
  }

  function getMazeLayer(levelIndex) {
    if (!mazeLayerCache.has(levelIndex)) {
      mazeLayerCache.set(levelIndex, createMazeLayer(levelIndex));
    }
    return mazeLayerCache.get(levelIndex);
  }

  function drawMaze() {
    ctx.save();
    ctx.shadowColor = 'rgba(69,64,45,.24)';
    ctx.shadowBlur = 7;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(getMazeLayer(currentLevelIndex), 0, 0, W, H);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#fbf4e8');
    bg.addColorStop(1, '#efe0c9');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(117,86,61,.09)';
    for (let y = 56; y < H; y += 38) {
      for (let x = 56; x < W; x += 43) {
        ctx.beginPath();
        ctx.arc(x + (y % 3) * 4, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawMaze();

    const glow = ctx.createRadialGradient(exit.x, exit.y, 5, exit.x, exit.y, 104);
    glow.addColorStop(0, 'rgba(247,208,112,.78)');
    glow.addColorStop(1, 'rgba(247,208,112,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(exit.x - 108, exit.y - 108, 216, 216);
    if (exitImage.complete) ctx.drawImage(exitImage, exit.x - 93, exit.y - 103, 164, 172);

    traps.forEach(trap => {
      const s = 1 + Math.sin(trap.pulse) * .025;
      ctx.save();
      ctx.translate(trap.x, trap.y);
      ctx.scale(s, s);
      ctx.shadowColor = 'rgba(92,53,30,.24)';
      ctx.shadowBlur = 7;
      ctx.shadowOffsetY = 4;
      if (trapImage.complete) ctx.drawImage(trapImage, -48, -42, 96, 84);
      ctx.restore();
    });

    cheeses.forEach(c => {
      if (c.collected) return;
      const s = 1 + Math.sin(c.pulse) * .05;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(s, s);
      ctx.shadowColor = 'rgba(109,75,39,.20)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;
      if (cheeseImage.complete) ctx.drawImage(cheeseImage, -36, -34, 72, 68);
      ctx.restore();
    });

    dust.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color || '#fff2b1';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4 * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    const runWave = player.moving ? Math.sin(player.runPhase) : 0;
    const runBob = player.moving ? Math.abs(runWave) * 5 : 0;
    const stretchX = player.moving ? 1 + runWave * .045 : 1;
    const stretchY = player.moving ? 1 - runWave * .04 : 1;
    ctx.save();
    ctx.translate(player.x, player.y - runBob);
    if (player.moving) ctx.rotate(runWave * .045);
    if (Math.cos(player.angle) < 0) ctx.scale(-1, 1);
    ctx.scale(stretchX, stretchY);
    ctx.shadowColor = 'rgba(75,53,39,.20)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 4;
    if (mouseImage.complete) ctx.drawImage(mouseImage, -54, -58, 108, 116);
    ctx.restore();

    if (cheeses.length && cheeses.every(c => c.collected) && !won) {
      ctx.fillStyle = 'rgba(255,249,237,.96)';
      ctx.strokeStyle = '#b78454';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(670, 54, 180, 52, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#6d654d';
      ctx.font = 'bold 21px Georgia';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Иди к выходу!', 760, 80);
    }
  }

  function loop(now) {
    const dt = Math.min(.035, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener('pointerdown', chooseTarget);
  levelButtons.forEach(button => button.addEventListener('click', () => startLevel(Number(button.dataset.level))));
  document.getElementById('restartBtn').addEventListener('click', resetLevel);
  document.getElementById('levelsBtn').addEventListener('click', () => openLevelMenu(true));
  levelMenuCloseBtn.addEventListener('click', closeLevelMenu);
  document.getElementById('retryBtn').addEventListener('click', () => {
    loseModal.classList.remove('is-open');
    resetLevel();
  });
  document.getElementById('loseLevelsBtn').addEventListener('click', () => openLevelMenu(false));
  document.getElementById('winLevelsBtn').addEventListener('click', () => openLevelMenu(false));
  nextLevelBtn.addEventListener('click', () => startLevel(currentLevelIndex + 2));
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? '🔊' : '🔇';
    soundBtn.setAttribute('aria-label', soundOn ? 'Выключить звук' : 'Включить звук');
    if (!soundOn) stopCurrentSound();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopCurrentSound();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && levelModal.classList.contains('is-open')) closeLevelMenu();
  });

  updateLevelButtons();
  resetLevel();
  playing = false;
  requestAnimationFrame(loop);
})();
