// GridStack initialization
let grid;
let previousRegisters = new Array(16).fill(0);
let previousMemory = new Array(256).fill(0);
let memoryPage = 0;
let regFormat = 0; // 0=DEC, 1=HEX, 2=BIN
let execStartTime = 0;
let lastInstrCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting init...');

    // Check if GridStack is available
    if (typeof GridStack === 'undefined') {
        console.error('GridStack not loaded!');
        alert('GridStack failed to load!');
        return;
    }
    console.log('GridStack available:', GridStack.version || 'unknown version');

    try {
        initGrid();
        console.log('Grid initialized');
    } catch (e) {
        console.error('Grid init failed:', e);
        localStorage.removeItem('gridLayout');
        try {
            initGrid();
            console.log('Grid initialized after reset');
        } catch (e2) {
            console.error('Grid init failed again:', e2);
        }
    }

    initLineNumbers();
    updateHighlight();
    initTheme();
    initScreen();

    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
        console.log('Lucide icons created');
    } else {
        console.warn('Lucide not loaded');
    }

    // Fetch initial state
    getState();
    console.log('Initialization complete');
});

function initGrid() {
    grid = GridStack.init({
        column: 12,
        cellHeight: 55,
        margin: 5,
        handle: '.drag-handle',
        animate: true,
        float: true,
        resizable: { handles: 'all' }
    });

    // Save on change
    grid.on('change', saveLayout);
}

function saveLayout() {
    if (grid) {
        const items = grid.save(false);
        localStorage.setItem('gridLayout', JSON.stringify(items));
    }
}

function resetLayout() {
    localStorage.removeItem('gridLayout');
    location.reload();
}

// DOM helpers
const $ = id => document.getElementById(id);
const code = $('code');
const highlight = $('highlight');

// ==========================================
// Line Numbers
// ==========================================
function initLineNumbers() {
    updateLineNumbers();
    if (code) {
        code.addEventListener('input', () => {
            updateHighlight();
            updateLineNumbers();
        });
        code.addEventListener('scroll', syncScroll);
    }
}

function updateLineNumbers() {
    const lineNumbers = $('lineNumbers');
    const lineCount = $('lineCount');
    if (!lineNumbers || !code) return;

    const lines = code.value.split('\n');
    lineNumbers.innerHTML = lines.map((_, i) =>
        `<span class="line-num">${i + 1}</span>`
    ).join('');

    if (lineCount) {
        lineCount.textContent = `${lines.length} lignes`;
    }
}

function syncScroll() {
    const lineNumbers = $('lineNumbers');
    if (lineNumbers && code) {
        lineNumbers.scrollTop = code.scrollTop;
    }
    if (highlight) {
        highlight.scrollTop = code.scrollTop;
        highlight.scrollLeft = code.scrollLeft;
    }
}

// ==========================================
// Theme Switcher
// ==========================================
function initTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    setTheme(saved);

    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setTheme(btn.dataset.theme);
        });
    });
}

function setTheme(theme) {
    document.body.className = `theme-${theme}`;
    localStorage.setItem('theme', theme);

    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

// ==========================================
// Screen
// ==========================================
function initScreen() {
    const screenGrid = $('screen');
    if (screenGrid) {
        // Initialize empty pixels
        screenGrid.innerHTML = Array(32 * 32).fill(0).map((_, i) =>
            `<div class="pixel" data-idx="${i}"></div>`
        ).join('');
    }
}

function setScreenColor(color) {
    const wrapper = document.querySelector('.screen-wrapper');
    if (wrapper) {
        wrapper.classList.remove('screen-green', 'screen-amber', 'screen-white', 'screen-blue');
        if (color !== 'green') {
            wrapper.classList.add(`screen-${color}`);
        }
    }
}

// ==========================================
// Syntax Highlighting
// ==========================================
const OPCODES = ['nop', 'hlt', 'add', 'sub', 'nor', 'and', 'xor', 'rsh', 'ldi', 'adi', 'jmp', 'brh', 'cal', 'ret', 'lod', 'str', 'cmp', 'mov', 'lsh', 'inc', 'dec', 'not', 'neg'];
const PORTS = ['pixel_x', 'pixel_y', 'draw_pixel', 'clear_pixel', 'load_pixel', 'buffer_screen', 'clear_screen_buffer', 'write_char', 'buffer_chars', 'clear_chars_buffer', 'show_number', 'clear_number', 'signed_mode', 'unsigned_mode', 'rng', 'controller_input'];

function hl(text) {
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .split('\n').map(line => {
            const commentIdx = line.search(/[;#\/]/);
            let main = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
            let comment = commentIdx >= 0 ? '<span class="hl-comment">' + line.slice(commentIdx) + '</span>' : '';

            main = main.replace(/\b(define)\b/gi, '<span class="hl-define">$1</span>');
            main = main.replace(/(\.[a-zA-Z_][a-zA-Z0-9_]*)/g, '<span class="hl-label">$1</span>');

            const opRe = new RegExp('\\b(' + OPCODES.join('|') + ')\\b', 'gi');
            main = main.replace(opRe, '<span class="hl-opcode">$1</span>');

            const portRe = new RegExp('\\b(' + PORTS.join('|') + ')\\b', 'gi');
            main = main.replace(portRe, '<span class="hl-port">$1</span>');

            main = main.replace(/\b(r\d{1,2})\b/gi, '<span class="hl-register">$1</span>');
            main = main.replace(/\b(0x[0-9a-fA-F]+|0b[01]+|-?\d+)\b/g, '<span class="hl-number">$1</span>');

            return main + comment;
        }).join('\n');
}

function updateHighlight() {
    if (!highlight || !code) return;
    highlight.innerHTML = hl(code.value) + '\n';
    syncScroll();
}

// ==========================================
// File Drop
// ==========================================
const dz = $('dropzone');
const fi = $('fileInput');

if (dz && fi) {
    dz.onclick = () => fi.click();
    ['dragenter', 'dragover'].forEach(e => dz.addEventListener(e, ev => { ev.preventDefault(); dz.classList.add('active'); }));
    ['dragleave', 'drop'].forEach(e => dz.addEventListener(e, () => dz.classList.remove('active')));

    dz.addEventListener('drop', e => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) readFile(f);
    });

    fi.addEventListener('change', e => {
        if (e.target.files[0]) readFile(e.target.files[0]);
    });
}

function readFile(f) {
    const r = new FileReader();
    r.onload = e => {
        code.value = e.target.result;
        updateHighlight();
        updateLineNumbers();
        msg('Fichier chargé: ' + f.name, 'ok');
    };
    r.readAsText(f);
}

function msg(t, type) {
    const m = $('msg');
    if (m) {
        m.textContent = t;
        m.className = 'msg ' + type;
        setTimeout(() => m.className = 'msg', 4000);
    }
    updateLastAction(t);
}

function updateLastAction(text) {
    const el = $('lastAction');
    if (el) el.textContent = text;
}

// ==========================================
// API Calls
// ==========================================
async function load() {
    if (!code || !code.value.trim()) {
        msg('Entrez du code', 'err');
        return;
    }
    try {
        const res = await fetch('/api/load', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code.value })
        });
        const d = await res.json();
        if (d.success) {
            msg(d.message, 'ok');
            await getState();
            await getDisasm();
            execStartTime = Date.now();
            lastInstrCount = 0;
        }
        else msg('Erreur: ' + d.message, 'err');
    } catch (e) {
        msg('Erreur: ' + e.message, 'err');
    }
}

async function step() {
    try {
        execStartTime = Date.now();
        const res = await fetch('/api/step', { method: 'POST' });
        const data = await res.json();
        render(data);
        await getDisasm();
        updateExecStats(data);
    } catch (e) {
        msg('Erreur: ' + e.message, 'err');
    }
}

async function run() {
    try {
        execStartTime = Date.now();
        const res = await fetch('/api/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ max: 100000 })
        });
        const data = await res.json();
        render(data);
        await getDisasm();
        updateExecStats(data);
    } catch (e) {
        msg('Erreur: ' + e.message, 'err');
    }
}

async function reset() {
    try {
        const res = await fetch('/api/reset', { method: 'POST' });
        const data = await res.json();
        render(data);
        await getDisasm();
        msg('Reset effectué', 'ok');
        previousRegisters = new Array(16).fill(0);
        previousMemory = new Array(256).fill(0);
    } catch (e) {
        msg('Erreur: ' + e.message, 'err');
    }
}

async function getState() {
    try {
        const res = await fetch('/api/state');
        const data = await res.json();
        render(data);
    } catch (e) {
        console.error('getState error:', e);
    }
}

async function getDisasm() {
    try {
        const res = await fetch('/api/disasm');
        const d = await res.json();
        renderDisasm(d.disasm);
    } catch (e) {
        console.error('getDisasm error:', e);
    }
}

function updateExecStats(data) {
    const execTime = Date.now() - execStartTime;
    const execTimeEl = $('execTime');
    if (execTimeEl) execTimeEl.textContent = `${execTime}ms`;

    if (data && data.instructions > lastInstrCount && execStartTime > 0) {
        const elapsed = (Date.now() - execStartTime) / 1000;
        const ips = Math.round((data.instructions - lastInstrCount) / Math.max(elapsed, 0.001));
        const ipsEl = $('ips');
        if (ipsEl) ipsEl.textContent = `${ips.toLocaleString()} IPS`;
        lastInstrCount = data.instructions;
    }
}

// ==========================================
// Register Format Toggle
// ==========================================
function toggleRegFormat() {
    regFormat = (regFormat + 1) % 3;
    getState();
}

function formatRegValue(val) {
    switch (regFormat) {
        case 0: return val.toString();
        case 1: return '0x' + val.toString(16).toUpperCase().padStart(2, '0');
        case 2: return val.toString(2).padStart(8, '0');
        default: return val.toString();
    }
}

// ==========================================
// Memory Page
// ==========================================
function setMemPage(page) {
    memoryPage = page;
    document.querySelectorAll('.mem-page-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === page);
    });
    getState();
}

// ==========================================
// Render Functions
// ==========================================
function render(d) {
    if (!d) return;

    const pc = $('pc'), instr = $('instr'), prog = $('prog'), state = $('state');
    if (pc) pc.textContent = d.pc || 0;
    if (instr) instr.textContent = d.instructions || 0;
    if (prog) prog.textContent = d.programLength || 0;

    if (state) {
        if (d.halted) {
            state.textContent = 'HALTED';
            state.className = 'status-value halted';
        }
        else if (d.programLength > 0) {
            state.textContent = 'RUN';
            state.className = 'status-value running';
        }
        else {
            state.textContent = 'READY';
            state.className = 'status-value';
        }
    }

    // Output
    const out = $('output');
    if (out) {
        if (d.numberDisplay !== null && d.numberDisplay !== undefined) {
            out.textContent = d.numberDisplay;
            out.style.color = 'var(--success)';
        } else if (d.charBuffer && d.charBuffer.length > 0) {
            out.textContent = d.charBuffer;
            out.style.color = 'var(--accent-bright)';
        } else {
            out.textContent = '-';
            out.style.color = 'var(--text-muted)';
        }
    }

    const chips = $('chips');
    if (chips && d.outputs) {
        chips.innerHTML = d.outputs.length
            ? d.outputs.map(o => `<span class="chip">${o}</span>`).join('')
            : '';
    }

    // Registers with change animation
    const regs = $('regs');
    if (regs && d.registers) {
        regs.innerHTML = d.registers.map((v, i) => {
            const changed = v !== previousRegisters[i];
            const classes = ['reg'];
            if (v) classes.push('active');
            if (changed) classes.push('changed');
            return `<div class="${classes.join(' ')}"><span class="reg-name">r${i}</span><span class="reg-val">${formatRegValue(v)}</span></div>`;
        }).join('');
        previousRegisters = [...d.registers];
    }

    // Flags - LED Style Panel
    if (d.flags) {
        const flagZ = $('flag-z');
        const flagC = $('flag-c');
        const zfValue = $('zf-value');
        const cfValue = $('cf-value');

        if (flagZ) flagZ.className = 'flag-led' + (d.flags.zero ? ' on' : '');
        if (flagC) flagC.className = 'flag-led' + (d.flags.carry ? ' on' : '');
        if (zfValue) zfValue.textContent = d.flags.zero ? '1' : '0';
        if (cfValue) cfValue.textContent = d.flags.carry ? '1' : '0';

        // Update branch conditions
        const condEq = $('cond-eq');
        const condNe = $('cond-ne');
        const condGe = $('cond-ge');
        const condLt = $('cond-lt');

        if (condEq) condEq.className = 'cond' + (d.flags.zero ? ' active' : '');
        if (condNe) condNe.className = 'cond' + (!d.flags.zero ? ' active' : '');
        if (condGe) condGe.className = 'cond' + (d.flags.carry ? ' active' : '');
        if (condLt) condLt.className = 'cond' + (!d.flags.carry ? ' active' : '');
    }

    // Call Stack
    const callStackEl = $('callStack');
    const stackDepth = $('stack-depth');
    if (callStackEl && d.callStack !== undefined) {
        if (d.callStack.length === 0) {
            callStackEl.innerHTML = '<p class="placeholder-text">Vide</p>';
        } else {
            callStackEl.innerHTML = d.callStack.map((addr, i) =>
                `<div class="stack-frame">
                    <span class="stack-index">#${i}</span>
                    <span class="stack-addr">${String(addr).padStart(4, '0')}</span>
                    <span class="stack-label">RET</span>
                </div>`
            ).reverse().join('');
        }
        if (stackDepth) stackDepth.textContent = `${d.callStack.length}/16`;
    }

    // I/O Ports
    const portPx = $('port-px');
    const portPy = $('port-py');
    const portMode = $('port-mode');
    const portChars = $('port-chars');
    const cursorX = $('cursor-x');
    const cursorY = $('cursor-y');

    if (portPx && d.pixelX !== undefined) portPx.textContent = d.pixelX;
    if (portPy && d.pixelY !== undefined) portPy.textContent = d.pixelY;
    if (portMode && d.signedMode !== undefined) portMode.textContent = d.signedMode ? 'signed' : 'unsigned';
    if (portChars && d.charBuffer !== undefined) portChars.textContent = d.charBuffer.length;
    if (cursorX && d.pixelX !== undefined) cursorX.textContent = d.pixelX;
    if (cursorY && d.pixelY !== undefined) cursorY.textContent = d.pixelY;

    // Update screen cursor position
    const screenCursor = $('screenCursor');
    if (screenCursor && d.pixelX !== undefined && d.pixelY !== undefined) {
        const x = d.pixelX % 32;
        const y = d.pixelY % 32;
        screenCursor.style.left = `${(x / 32) * 100}%`;
        screenCursor.style.top = `${(y / 32) * 100}%`;
    }

    // Memory with pagination
    const mem = $('mem');
    const memAscii = $('memAscii');
    if (mem && d.memory) {
        const start = memoryPage * 64;
        const end = start + 64;
        const fullMemory = [...d.memory];
        // Pad to 256 if needed
        while (fullMemory.length < 256) fullMemory.push(0);
        const pageMemory = fullMemory.slice(start, end);

        mem.innerHTML = pageMemory.map((v, i) => {
            const globalIdx = start + i;
            const changed = v !== previousMemory[globalIdx];
            const isPort = globalIdx >= 240;
            const classes = ['mem-cell'];
            if (v) classes.push('active');
            if (changed) classes.push('changed');
            if (isPort) classes.push('port');
            return `<div class="${classes.join(' ')}" title="[${globalIdx}]=${v}">${v.toString(16).padStart(2, '0').toUpperCase()}</div>`;
        }).join('');

        // ASCII view
        if (memAscii) {
            let ascii = '';
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col < 16; col++) {
                    const idx = row * 16 + col;
                    if (idx < pageMemory.length) {
                        const v = pageMemory[idx];
                        ascii += (v >= 32 && v <= 126) ? String.fromCharCode(v) : '.';
                    }
                }
                ascii += '\n';
            }
            memAscii.textContent = ascii;
        }

        // Store for next comparison
        for (let i = 0; i < fullMemory.length; i++) {
            previousMemory[i] = fullMemory[i];
        }
    }

    // Screen
    const screen = $('screen');
    if (screen && d.screen) {
        const pixels = screen.querySelectorAll('.pixel');
        const flat = d.screen.flat();
        pixels.forEach((p, i) => {
            if (i < flat.length) {
                p.classList.toggle('on', flat[i] === 1);
            }
        });
    }
}

function renderDisasm(lines) {
    const disasm = $('disasm');
    if (!disasm) return;

    if (!lines || !lines.length) {
        disasm.innerHTML = '<p class="placeholder-text">Aucune instruction</p>';
        return;
    }

    disasm.innerHTML = lines.map(l =>
        `<div class="disasm-line ${l.current ? 'current' : ''} ${l.breakpoint ? 'has-breakpoint' : ''}" 
              data-addr="${l.addr}" 
              onclick="toggleBreakpoint(${l.addr})" 
              oncontextmenu="showBinary('${l.binary}'); return false;"
              title="Clic: breakpoint | Clic droit: binaire">
            <span class="disasm-addr">${String(l.addr).padStart(4, '0')}</span>
            <span class="disasm-instr">${l.text}</span>
        </div>`
    ).join('');

    const cur = disasm.querySelector('.current');
    if (cur) cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function showBinary(bin) {
    const bv = $('binaryValue');
    if (bv && bin && bin !== 'undefined') {
        bv.textContent = bin.match(/.{1,4}/g).join(' ');
    } else if (bv) {
        bv.textContent = '-';
    }
}

// ==========================================
// Breakpoint Management
// ==========================================
async function toggleBreakpoint(addr) {
    try {
        const res = await fetch('/api/breakpoint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addr: addr })
        });
        const d = await res.json();
        if (d.success) {
            const line = document.querySelector(`.disasm-line[data-addr="${addr}"]`);
            if (line) {
                line.classList.toggle('has-breakpoint', d.action === 'added');
            }
            msg(`Breakpoint ${d.action} @ ${addr}`, 'ok');
        }
    } catch (e) {
        msg('Erreur: ' + e.message, 'err');
    }
}

// ==========================================
// Keyboard Shortcuts
// ==========================================
document.addEventListener('keydown', (e) => {
    // Ctrl+Enter in textarea = assemble
    if (e.target.tagName === 'TEXTAREA' && e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        load();
        return;
    }

    // Don't trigger shortcuts when typing in textarea
    if (e.target.tagName === 'TEXTAREA') {
        return;
    }

    if (e.key === 'F5') {
        e.preventDefault();
        run();
    }
    else if (e.key === 'F6') {
        e.preventDefault();
        step();
    }
    else if (e.key === 'F8') {
        e.preventDefault();
        reset();
    }
});
