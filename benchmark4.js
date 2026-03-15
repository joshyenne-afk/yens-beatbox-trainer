const fs = require('fs');

const code = fs.readFileSync('index.html', 'utf8');

const patternsMatch = code.match(/const patterns = (\[[\s\S]*?\]);/);
let patternsStr = patternsMatch[1];
const patterns = eval(patternsStr);

function renderPatternsOriginal(searchVal) {
    let activeGenre = 'All';
    let seq = { pattern: null };

    const search = (searchVal || '').toLowerCase();
    const filtered = patterns.filter(p => {
        const gOk = activeGenre === 'All' || p.genre === activeGenre;
        const sOk = p.name.toLowerCase().includes(search) || p.desc.toLowerCase().includes(search) || p.genre.toLowerCase().includes(search);
        return gOk && sOk;
    });

    return filtered.map(p => {
        const active = seq.pattern && seq.pattern.name === p.name ? ' active' : '';
        const idx = patterns.indexOf(p);
        return `<div class="pattern-item${active}" onclick="loadPattern(patterns[${idx}])"><div class="pattern-item-name">${p.name}</div><div class="pattern-item-meta">${p.genre} · ${p.tempo} BPM</div></div>`;
    }).join('');
}

function renderPatternsOptimized(searchVal) {
    let activeGenre = 'All';
    let seq = { pattern: null };

    const search = (searchVal || '').toLowerCase();

    const html = patterns.reduce((acc, p, idx) => {
        const gOk = activeGenre === 'All' || p.genre === activeGenre;

        if (!p._nameLower) {
            p._nameLower = p.name.toLowerCase();
            p._descLower = p.desc.toLowerCase();
            p._genreLower = p.genre.toLowerCase();
        }

        const sOk = p._nameLower.includes(search) || p._descLower.includes(search) || p._genreLower.includes(search);

        if (gOk && sOk) {
            const active = seq.pattern && seq.pattern.name === p.name ? ' active' : '';
            acc.push(`<div class="pattern-item${active}" onclick="loadPattern(patterns[${idx}])"><div class="pattern-item-name">${p.name}</div><div class="pattern-item-meta">${p.genre} · ${p.tempo} BPM</div></div>`);
        }
        return acc;
    }, []).join('');

    return html;
}

const searchTerms = ['', 'rock', 'hop', 'a', 'the', 'kick'];

// Warmup
for (let i = 0; i < 10000; i++) {
    renderPatternsOriginal(searchTerms[i % searchTerms.length]);
    renderPatternsOptimized(searchTerms[i % searchTerms.length]);
}

const iterations = 100000;

console.log("Benchmarking original...");
const startOrig = performance.now();
for (let i = 0; i < iterations; i++) {
    const term = searchTerms[i % searchTerms.length];
    renderPatternsOriginal(term);
}
const endOrig = performance.now();
const timeOrig = endOrig - startOrig;
console.log(`Original time: ${timeOrig.toFixed(2)} ms`);

console.log("Benchmarking optimized...");
const startOpt = performance.now();
for (let i = 0; i < iterations; i++) {
    const term = searchTerms[i % searchTerms.length];
    renderPatternsOptimized(term);
}
const endOpt = performance.now();
const timeOpt = endOpt - startOpt;
console.log(`Optimized time: ${timeOpt.toFixed(2)} ms`);

console.log(`Improvement: ${((timeOrig - timeOpt) / timeOrig * 100).toFixed(2)}%`);
