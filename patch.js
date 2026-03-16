const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

const targetStr = `        function renderPatterns() {
            const search = (document.getElementById('patSearch').value || '').toLowerCase();
            const filtered = patterns.filter(p => {
                const gOk = activeGenre === 'All' || p.genre === activeGenre;
                const sOk = p.name.toLowerCase().includes(search) || p.desc.toLowerCase().includes(search) || p.genre.toLowerCase().includes(search);
                return gOk && sOk;
            });
            document.getElementById('patList').innerHTML = filtered.map(p => {
                const active = seq.pattern && seq.pattern.name === p.name ? ' active' : '';
                const idx = patterns.indexOf(p);
                return \`<div class="pattern-item\${active}" onclick="loadPattern(patterns[\${idx}])"><div class="pattern-item-name">\${p.name}</div><div class="pattern-item-meta">\${p.genre} · \${p.tempo} BPM</div></div>\`;
            }).join('');
        }`;

const replacementStr = `        function renderPatterns() {
            const search = (document.getElementById('patSearch').value || '').toLowerCase();
            document.getElementById('patList').innerHTML = patterns.reduce((acc, p, idx) => {
                const gOk = activeGenre === 'All' || p.genre === activeGenre;

                if (!p._nameLower) {
                    p._nameLower = p.name.toLowerCase();
                    p._descLower = p.desc.toLowerCase();
                    p._genreLower = p.genre.toLowerCase();
                }

                const sOk = p._nameLower.includes(search) || p._descLower.includes(search) || p._genreLower.includes(search);

                if (gOk && sOk) {
                    const active = seq.pattern && seq.pattern.name === p.name ? ' active' : '';
                    acc.push(\`<div class="pattern-item\${active}" onclick="loadPattern(patterns[\${idx}])"><div class="pattern-item-name">\${p.name}</div><div class="pattern-item-meta">\${p.genre} · \${p.tempo} BPM</div></div>\`);
                }
                return acc;
            }, []).join('');
        }`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync('index.html', content);
    console.log('Patched index.html successfully!');
} else {
    console.error('Target string not found in index.html!');
    console.log(content.substring(content.indexOf('function renderPatterns()'), content.indexOf('function renderPatterns()') + 500));
}
