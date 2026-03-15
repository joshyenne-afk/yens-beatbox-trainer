const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const patternsMatch = html.match(/const patterns = (\[[\s\S]*?\]);/);
let patternsStr = patternsMatch[1];
const patterns = eval(patternsStr);

function simulateRenderPatterns() {
    let activeGenre = 'All';
    let seq = { pattern: null };
    const search = '';

    return patterns.reduce((acc, p, idx) => {
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
}

const renderedHTML = simulateRenderPatterns();
console.log("Rendered items:", renderedHTML.split('pattern-item').length - 1);
