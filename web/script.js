// GridStack initialization
let grid;

document.addEventListener('DOMContentLoaded', () => {
    initGrid();
    updateHighlight();
    getState();
});

function initGrid() {
    grid = GridStack.init({
        column: 12,
        cellHeight: 60,
        margin: 6,
        handle: '.drag-handle',
        animate: true,
        float: true,
        resizable: { handles: 'all' }
    });

    // Load saved layout
    const saved = localStorage.getItem('gridLayout');
    if (saved) {
        try {
            const items = JSON.parse(saved);
            grid.load(items);
        } catch (e) {
            console.warn('Failed to load layout:', e);
        }
    }

    // Save on change
    grid.on('change', saveLayout);
}

function saveLayout() {
    const items = grid.save(false);
    localStorage.setItem('gridLayout', JSON.stringify(items));
}

function resetLayout() {
    localStorage.removeItem('gridLayout');
    location.reload();
}

// DOM helpers
const $ = id => document.getElementById(id);
const code = $('code');
const highlight = $('highlight');

// Syntax highlighting
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
    highlight.scrollTop = code.scrollTop;
    highlight.scrollLeft = code.scrollLeft;
}

if (code) {
    code.addEventListener('input', updateHighlight);
    code.addEventListener('scroll', () => {
        highlight.scrollTop = code.scrollTop;
        highlight.scrollLeft = code.scrollLeft;
    });
}

// File drop
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
        msg('📁 ' + f.name, 'ok');
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
}

// API
async function load() {
    if (!code.value.trim()) { msg('⚠️ Entrez du code', 'err'); return; }
    try {
        const res = await fetch('/api/load', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code.value })
        });
        const d = await res.json();
        if (d.success) { msg(d.message, 'ok'); getState(); getDisasm(); }
        else msg('❌ ' + d.message, 'err');
    } catch (e) { msg('❌ ' + e, 'err'); }
}

async function step() {
    try {
        const res = await fetch('/api/step', { method: 'POST' });
        render(await res.json());
        getDisasm();
    } catch (e) { msg('❌ ' + e, 'err'); }
}

async function run() {
    try {
        const res = await fetch('/api/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ max: 100000 })
        });
        render(await res.json());
        getDisasm();
    } catch (e) { msg('❌ ' + e, 'err'); }
}

async function reset() {
    try {
        const res = await fetch('/api/reset', { method: 'POST' });
        render(await res.json());
        getDisasm();
        msg('🔄 Reset', 'ok');
    } catch (e) { msg('❌ ' + e, 'err'); }
}

async function getState() {
    try { render(await (await fetch('/api/state')).json()); } catch (e) { }
}

async function getDisasm() {
    try {
        const d = await (await fetch('/api/disasm')).json();
        renderDisasm(d.disasm);
    } catch (e) { }
}

function render(d) {
    if (!d) return;

    const pc = $('pc'), instr = $('instr'), prog = $('prog'), state = $('state');
    if (pc) pc.textContent = d.pc;
    if (instr) instr.textContent = d.instructions;
    if (prog) prog.textContent = d.programLength;

    if (state) {
        if (d.halted) { state.textContent = 'HALTED'; state.className = 'status-value halted'; }
        else if (d.programLength > 0) { state.textContent = 'RUN'; state.className = 'status-value running'; }
        else { state.textContent = 'READY'; state.className = 'status-value'; }
    }

    // Output
    const out = $('output');
    if (out) {
        if (d.numberDisplay !== null) {
            out.textContent = d.numberDisplay;
            out.style.color = 'var(--success)';
        } else if (d.charBuffer) {
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

    // Registers
    const regs = $('regs');
    if (regs && d.registers) {
        regs.innerHTML = d.registers.map((v, i) =>
            `<div class="reg ${v ? 'active' : ''}"><span class="reg-name">r${i}</span><span class="reg-val">${v}</span></div>`
        ).join('');
    }

    // Flags
    const zf = $('zf'), cf = $('cf');
    if (zf && d.flags) {
        zf.textContent = 'Z=' + (d.flags.zero ? 1 : 0);
        zf.className = 'flag' + (d.flags.zero ? ' on' : '');
    }
    if (cf && d.flags) {
        cf.textContent = 'C=' + (d.flags.carry ? 1 : 0);
        cf.className = 'flag' + (d.flags.carry ? ' on' : '');
    }

    // Memory
    const mem = $('mem');
    if (mem && d.memory) {
        mem.innerHTML = d.memory.map((v, i) =>
            `<div class="mem-cell ${v ? 'active' : ''}" title="[${i}]=${v}">${v.toString(16).padStart(2, '0').toUpperCase()}</div>`
        ).join('');
    }

    // Screen
    const screen = $('screen');
    if (screen && d.screen) {
        screen.innerHTML = d.screen.flat().map((v, i) =>
            `<div class="pixel ${v ? 'on' : ''}" title="[${i % 32},${Math.floor(i / 32)}]"></div>`
        ).join('');
    }
}

function renderDisasm(lines) {
    const disasm = $('disasm');
    if (!disasm) return;

    if (!lines?.length) {
        disasm.innerHTML = '<p class="placeholder-text">Aucune instruction</p>';
        return;
    }

    disasm.innerHTML = lines.map(l =>
        `<div class="disasm-line ${l.current ? 'current' : ''}" onclick="showBinary('${l.binary}')" style="cursor:pointer">
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
