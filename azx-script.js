const TOTAL_TIME = 120;
const BASE_ROWS = 16;
const BASE_COLS = 10;
let ROWS = BASE_ROWS;
let COLS = BASE_COLS;

let gridData = [];
let isMouseDown = false;
let score = 0;
let timeRemaining = TOTAL_TIME;
let timerInterval = null;
let startTime = 0;
let finalClearTimeSeconds = 0;
let isPaused = false;
let isGameOver = false

let startTile = null;
let currentTile = null;
let selectedTiles = [];
let startPoint = { x: 0, y: 0 };
let currentPoint = { x: 0, y: 0 };

let hintsLeft = 1;
let bombsLeft = 1;
let shufflesLeft = 1;
let bombModeActive = false;

const gridEl = document.getElementById('grid');
const selectionBox = document.getElementById('selection-box');
const scoreEl = document.getElementById('score')
const currentSumEl = document.getElementById('current-sum')
const timerEl = document.getElementById('timer');
const pauseOverlay = document.getElementById('pause-overlay');
const ggOverlay = document.getElementById('gameover-overlay');
const pauseBtn = document.getElementById('pause-btn');

const AVATARS = [
    'pictures/avatars/pfp_brid.png',
    'pictures/avatars/pfp_diesel.png',
    'pictures/avatars/pfp_soline.png',
    'pictures/avatars/pfp_sbs.png'
];

function startGame() {
    isMouseDown = false;
    startTile = null;
    currentTile = null;
    selectedTiles = [];
    score = 0;
    timeRemaining = TOTAL_TIME;
    clearInterval(timerInterval);
    startTime = performance.now();
    finalClearTimeSeconds = 0;
    isPaused = false;
    isGameOver = false;
    
    hintsLeft = 1;
    bombsLeft = 1;
    bombModeActive = false;
    shufflesLeft = 1;
    updatePowerupUI();
    
    scoreEl.textContent = score;
    timerEl.textContent = timeRemaining;
    currentSumEl.textContent = 0;
    pauseBtn.textContent = "Pause";
    
    pauseOverlay.classList.add('hidden');
    ggOverlay.classList.add('hidden');
    hideSelectionBox();
    initGridDimensions(ROWS, COLS);

    /*setRandomAvatar();*/
    
    gridData = Array.from( { length: ROWS }, () => Array(COLS).fill(0) );
    
    function generateSum10Group(size) {
        let cuts = new Set();
        while (cuts.size < size - 1) {
            cuts.add(Math.floor(Math.random() * 9) + 1);
        }
        let sortedCuts = [0, ...Array.from(cuts).sort((a, b) => a - b), 10];
        let values = [];
        for (let i = 0; i < sortedCuts.length - 1; i++) {
            values.push(sortedCuts[i + 1] - sortedCuts[i]);
        }
        return values;
    }
    
    let allValues = [];
    let totalSlots = ROWS * COLS;
    
    while (allValues.length < totalSlots) {
        const groupSize = Math.floor(Math.random() * 3) + 2;
        const group = generateSum10Group(groupSize);

        if (allValues.length + group.length <= totalSlots) {
            allValues.push(...group);
        } else {
            while (allValues.length < totalSlots) {
                allValues.push(Math.floor(Math.random() * 9) + 1);
            }
        }
    }
    
    let positions = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            positions.push({ r, c });
        }
    }
    
    positions.sort((a, b) => {
        let keyA = (a.r * 3 + a.c * 7) % 100;
        let keyB = (b.r * 3 + b.c * 7) % 100;
        return keyA - keyB;
    });
    
    for (let i = 0; i < positions.length; i++) {
        gridData[positions[i].r][positions[i].c] = allValues[i];
    }
    
    if (!findValidCombination()) {
        startGame();
        return;
    }
    
    renderGrid();
    
    timerInterval = setInterval(() => {
        timeRemaining--;
        timerEl.textContent = timeRemaining;
        if (timeRemaining <= 0) {
            endGame("TIME'S UP!");
        }
    }, 1000);
}

function renderGrid() {
    const tiles = gridEl.querySelectorAll('.tile');
    tiles.forEach(t => t.remove());
    
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const tile = document.createElement('div');
            tile.classList.add('tile');
            tile.dataset.row = r;
            tile.dataset.col = c;
            
            if (gridData[r][c] === 0) {
                tile.classList.add('empty');
            } else {
                tile.textContent = gridData[r][c];
            }
            
            gridEl.appendChild(tile);
        }
    }
}

function initGridDimensions(rows, cols) {
    const isMobile = window.innerWidth <= 800;
    if (isMobile) {
        ROWS = Math.max(BASE_ROWS, BASE_COLS);
        COLS = Math.min(BASE_ROWS, BASE_COLS);
    } else {
        ROWS = Math.min(BASE_ROWS, BASE_COLS);
        COLS = Math.max(BASE_ROWS, BASE_COLS);
    }

    gridEl.style.setProperty('--rows', ROWS);
    gridEl.style.setProperty('--cols', COLS);
}

gridEl.addEventListener('mousedown', (e) => {
    if (isPaused || isGameOver) return;
    const tileEl = e.target.closest('.tile');
    
    if (bombModeActive) {
        if (tileEl && !tileEl.classList.contains('empty')) {
            const r = parseInt(tileEl.dataset.row);
            const c = parseInt(tileEl.dataset.col);
            gridData[r][c] = 0;
            bombsLeft--;
            bombModeActive = false;
            updatePowerupUI();
            renderGrid();
            checkPossibleMoves();
        }
        return;
    }
    
    isMouseDown = true;
    const gridRect = gridEl.getBoundingClientRect();
    
    startPoint = {
        x: e.clientX - gridRect.left,
        y: e.clientY - gridRect.top
    };
    currentPoint = { ...startPoint };

    updateSelectionBoxAndTiles();
});

window.addEventListener('mousemove', (e) => {
    if (!isMouseDown || isPaused || isGameOver) return;
    
    const gridRect = gridEl.getBoundingClientRect();
    currentPoint = {
        x: Math.max(0, Math.min(e.clientX - gridRect.left, gridRect.width)),
        y: Math.max(0, Math.min(e.clientY - gridRect.top, gridRect.height))
    };
    updateSelectionBoxAndTiles();
});

function updateSelectionBoxAndTiles() {
    const minX = Math.min(startPoint.x, currentPoint.x);
    const maxX = Math.max(startPoint.x, currentPoint.x);
    const minY = Math.min(startPoint.y, currentPoint.y);
    const maxY = Math.max(startPoint.y, currentPoint.y);
    
    selectionBox.style.left = `${minX}px`;
    selectionBox.style.top = `${minY}px`;
    selectionBox.style.width = `${maxX - minX}px`;
    selectionBox.style.height = `${maxY - minY}px`;
    selectionBox.style.display = 'block';

    /*clearHighlights();*/
    selectedTiles = [];
    let sum = 0;

    const gridRect = gridEl.getBoundingClientRect();
    const allTiles = gridEl.querySelectorAll('.tile');

    allTiles.forEach(tileEl => {
        if (tileEl.classList.contains('empty')) return;

        const tileRect = tileEl.getBoundingClientRect();
        
        const tLeft = tileRect.left - gridRect.left;
        const tRight = tileRect.right - gridRect.left;
        const tTop = tileRect.top - gridRect.top;
        const tBottom = tileRect.bottom - gridRect.top;

        const isIntersecting = !(tLeft > maxX || tRight < minX || tTop > maxY || tBottom < minY);

        if (isIntersecting) {
            const r = parseInt(tileEl.dataset.row);
            const c = parseInt(tileEl.dataset.col);

            selectedTiles.push({ r, c });
            sum += gridData[r][c];
            /*tileEl.classList.add('selected');*/
        }
    });

    currentSumEl.textContent = sum;

    selectionBox.classList.remove('valid', 'invalid');
    if (sum === 10) {
        selectionBox.classList.add('valid');
    }
}

window.addEventListener('mouseup', () => {
    if (!isMouseDown) return;
    isMouseDown = false;
    hideSelectionBox();
    processSelection();
});

function hideSelectionBox() {
    selectionBox.style.display = 'none';
    selectionBox.classList.remove('valid', 'invalid');
}

function clearHighlights() {
    document.querySelectorAll('.tile').forEach(t => {
        t.classList.remove('hint-active');
    });
    /*
    document.querySelectorAll('.tile').forEach(t => {
        t.classList.remove('selected', 'highlight-valid', 'highlight-invalid', 'hint-active');
    });
    */
}

window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey || isGameOver) return;
    const key = e.key.toLowerCase();

    switch (key) {
        case 'q':
            useHint();
            break;
        case 'w':
            useShuffle();
            break;
        case 'e':
            toggleBomb();
            break;
        case 'escape':
            togglePause();
            break;
    }
});

function resetSelection() {
    startTile = null;
    currentTile = null;
    selectedTiles = [];
    currentSumEl.textContent = 0;
    clearHighlights();
}

function processSelection() {
    if (isGameOver || selectedTiles.length === 0) return;
    
    let sum = selectedTiles.reduce((acc, pos) => acc + gridData[pos.r][pos.c], 0);
    
    if (sum === 10) {
        finalClearTimeSeconds = (performance.now() - startTime) / 1000;
        
        selectedTiles.forEach(pos => {
            const el = getTileElement(pos.r, pos.c);
            if (el) el.classList.add('highlight-valid');
            gridData[pos.r][pos.c] = 0;
        });
        
        score += selectedTiles.length * 1000;
        scoreEl.textContent = score;
        
        setTimeout(() => {
            renderGrid();
            resetSelection();
            checkPossibleMoves();
        }, 150);
        
    } else {
        /*
        selectedTiles.forEach(pos => {
            const el = getTileElement(pos.r, pos.c);
            if (el) el.classList.add('highlight-invalid');
        });
        */
        
        setTimeout(() => { resetSelection(); }, 250);
    }
}

function useHint() {
    if (hintsLeft <= 0 || isPaused || isGameOver) return;
    
    const move = findValidCombination();
    if (move) {
        hintsLeft--;
        updatePowerupUI();
        clearHighlights();
        
        for (let r = move.r1; r <= move.r2; r++) {
            for (let c = move.c1; c <= move.c2; c++) {
                if (gridData[r][c] !== 0) {
                    const el = getTileElement(r, c);
                    if (el) el.classList.add('hint-active');
                }
            }
        }
        
        setTimeout(() => { clearHighlights(); }, 2500);
    }
}

function findValidCombination() {
    for (let r1 = 0; r1 < ROWS; r1++) {
        for (let c1 = 0; c1 < COLS; c1++) {
            for (let r2 = r1; r2 < ROWS; r2++) {
                for (let c2 = c1; c2 < COLS; c2++) {
                    let sum = 0;
                    let count = 0;
                    for (let r = r1; r <= r2; r++) {
                        for (let c = c1; c <= c2; c++) {
                            if (gridData[r][c] !== 0) {
                                sum += gridData[r][c];
                                count++;
                            }
                        }
                    }
                    if (sum === 10 && count > 0) {
                        return { r1, c1, r2, c2 };
                    }
                }
            }
        }
    }
    return null;
}

function toggleBomb() {
    if (bombsLeft <= 0 || isPaused || isGameOver) return;
    bombModeActive = !bombModeActive;
    updatePowerupUI();
}

function useShuffle() {
    if (shufflesLeft <= 0 || isPaused || isGameOver) return;

    let activePositions = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (gridData[r][c] !== 0) {
                activePositions.push({ r, c });
            }
        }
    }

    shufflesLeft--;
    updatePowerupUI();

    function generateSum10Group(size) {
        let cuts = new Set();
        while (cuts.size < size - 1) {
            cuts.add(Math.floor(Math.random() * 9) + 1);
        }
        let sortedCuts = [0, ...Array.from(cuts).sort((a, b) => a - b), 10];
        let values = [];
        for (let i = 0; i < sortedCuts.length - 1; i++) {
            values.push(sortedCuts[i + 1] - sortedCuts[i]);
        }
        return values;
    }
    
    let newValues = [];
    let totalSlotsFF = activePositions.length;
    
    while (newValues.length < totalSlotsFF) {
        const groupSize = Math.floor(Math.random() * 3) + 2;
        const group = generateSum10Group(groupSize);

        if (newValues.length + group.length <= totalSlotsFF) {
            newValues.push(...group);
        } else {
            while (newValues.length < totalSlotsFF) {
                newValues.push(Math.floor(Math.random() * 9) + 1);
            }
        }
    }
    
    activePositions.sort((a, b) => {
        let keyA = (a.r * 3 + a.c * 7) % 100;
        let keyB = (b.r * 3 + b.c * 7) % 100;
        return keyA - keyB;
    });

    for (let i = 0; i < activePositions.length; i++) {
        const pos = activePositions[i];
        gridData[pos.r][pos.c] = newValues[i];
    }

    if (!findValidCombination()) {
        shufflesLeft++;
        updatePowerupUI();
        useShuffle();
        return;
    }

    renderGrid();
    resetSelection();
    checkPossibleMoves();
}

function updatePowerupUI() {
    const hintBtn = document.getElementById('hint-btn');
    const bombBtn = document.getElementById('bomb-btn');
    const shuffleBtn = document.getElementById('shuffle-btn');

    document.getElementById('hint-count').textContent = hintsLeft;
    document.getElementById('bomb-count').textContent = bombsLeft;
    document.getElementById('shuffle-count').textContent = shufflesLeft;

    // Hint Button
    if (hintsLeft <= 0) {
        hintBtn.classList.add('disabled');
        hintBtn.disabled = true;
    } else {
        hintBtn.classList.remove('disabled');
        hintBtn.disabled = false;
    }

    // Bomb Button
    if (bombsLeft <= 0) {
        bombBtn.classList.add('disabled');
        bombBtn.disabled = true;
        bombModeActive = false;
    } else {
        bombBtn.classList.remove('disabled');
        bombBtn.disabled = false;
    }

    // Shuffle Button
    if (shufflesLeft <= 0) {
        shuffleBtn.classList.add('disabled');
        shuffleBtn.disabled = true;
    } else {
        shuffleBtn.classList.remove('disabled');
        shuffleBtn.disabled = false;
    }

    if (bombModeActive) {
        bombBtn.classList.add('active');
    } else {
        bombBtn.classList.remove('active');
    }
}

function checkPossibleMoves() {
    if (!findValidCombination()) {
        endGame("NO MORE MOVES!");
        return false;
    }
    return true;
}

function getTileElement(r, c) {
    return gridEl.querySelector(`.tile[data-row="${r}"][data-col="${c}"]`);
}

function togglePause() {
    if (isGameOver) return;
    isPaused = !isPaused;
    if (isPaused) {
        pauseOverlay.classList.remove('hidden');
        pauseBtn.textContent = "Resume";
    } else {
        pauseOverlay.classList.add('hidden');
        pauseBtn.textContent = "Pause";
    }
}

function endGame(reason) {
    isGameOver = true;
    clearInterval(timerInterval);

    if (isMouseDown) {
        isMouseDown = false;
        hideSelectionBox();
        selectedTiles = [];
        currentSumEl.textContent = 0;
    }

    document.getElementById('gameover-title').textContent = reason;
    document.getElementById('final-score').textContent = score;
    document.getElementById('clear-time').textContent = `${finalClearTimeSeconds.toFixed(3)}s`;
    ggOverlay.classList.remove('hidden');
}

window.addEventListener('resize', () => {
    const prevRows = ROWS;
    const prevCols = COLS;
    initGridDimensions();
    
    if (prevRows !== ROWS || prevCols !== COLS) {
        startGame();
    }
});

function setRandomAvatar() {
    const avatarEl = document.getElementById('player-avatar');
    if (!avatarEl || AVATARS.length === 0) return;

    const randomIndex = Math.floor(Math.random() * AVATARS.length);
    avatarEl.src = AVATARS[randomIndex];
}

startGame();