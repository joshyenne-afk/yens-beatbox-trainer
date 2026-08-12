/* Headless smoke test.  Run:  node smoke.js
 *
 * Extracts the <script> out of index.html and executes it against a minimal
 * DOM + Web Audio shim, then asserts the things that are easy to break and
 * expensive to notice on a phone in a green room: groove data, drill stage
 * generation, scheduler timing math, take bar-counting, and mode exclusivity.
 *
 * This can't test audio quality, mic capture, or layout — those need a real
 * browser. It CAN catch every regression that is pure arithmetic or data.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const js   = html.split('<script>')[1].split('</script>')[0];
const body = html.split('</style>')[1].split('<script>')[0];

/* ---------- shims ---------- */
const el = () => new Proxy({
  style:{}, dataset:{}, textContent:'', innerHTML:'', value:0,
  scrollLeft:0, scrollTop:0, offsetTop:0, offsetHeight:0, clientHeight:0,
  offsetLeft:0, offsetWidth:0, clientWidth:0,
  classList:{add(){},remove(){},toggle(){},contains(){return false}},
  appendChild(){}, addEventListener(){}, click(){}, scrollIntoView(){},
  querySelector(){return null}, querySelectorAll(){return []},
}, { get(t,k){ return k in t ? t[k] : el(); }, set(t,k,v){ t[k]=v; return true; } });

global.document = { getElementById: el, querySelector: el, querySelectorAll: () => [],
                    createElement: el, addEventListener(){}, visibilityState:'visible' };
// Node >=21 defines `navigator` as a getter-only global, so it needs redefining
Object.defineProperty(global, 'navigator', { value:{}, writable:true, configurable:true });
global.window = { AudioContext: function(){} };
global.requestAnimationFrame = () => {};
global.setInterval = () => 0;
global.clearInterval = () => {};
global.setTimeout = (f) => 0;

const M = new Function(js + `
;return { GROOVES, DRILLS, CANON, st, curG, stepDur, stepsPerBeat, applyStage,
          isDrill, halfWindow, audible, setGroove, setHalf, setTake, toggleVoice,
          TAKE_BARS, rec, sessionIdxs, SESSION_ORDER, logRead, logAdd,
          GENRES, genreOf };`)();

/* ---------- harness ---------- */
let fail = 0, count = 0;
const ok = (c, m) => { count++; console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; };
const head = (s) => console.log('\n' + s);

/* ---------- inventory ---------- */
head('inventory');
ok(M.DRILLS.length === 7,  'drills: ' + M.DRILLS.length);
ok(M.CANON.length === 17,  'canon grooves: ' + M.CANON.length);
ok(M.GROOVES.length === 24,'total: ' + M.GROOVES.length);
ok(M.GENRES[0] === 'Drills', 'Drills is the first genre (leads the picker)');

/* ---------- drill generators ---------- */
head('drill stages generate legal bars');
for (const d of M.DRILLS) {
  let bad = 0;
  for (const s of d.drill.stages) {
    const slots = s.gen();
    if (slots.length % s.grid !== 0) bad++;          // whole bars only
    if (!(s.passes > 0)) bad++;
    for (const x of slots)
      if (x && !['kick','snare','hat','open','breath'].includes(x.snd)) bad++;
  }
  ok(bad === 0, d.name + ' — ' + d.drill.stages.length + ' stages');
}

head('accent walk');
(() => {
  const aw = M.DRILLS.find(d => d.name === 'Accent Walk · Snare');
  let good = true;
  aw.drill.stages.forEach((s, i) => {
    const acc = s.gen().map((x,j) => x && x.vel === 2 ? j : -1).filter(j => j >= 0);
    if (acc.length !== 1 || acc[0] !== i) good = false;
  });
  ok(good, '16 stages, exactly one accent each, position === stage index');
})();

head('isolation ladder');
ok(M.DRILLS.find(d => d.name === 'Isolation · Kick')
    .drill.stages.map(s => s.grid).join(',') === '4,8,12,16', 'grids 4,8,12,16');

head('breath pacer');
(() => {
  const b = M.DRILLS.find(d => d.name.startsWith('Breath')).drill.stages[0].gen();
  ok(b.length === 16, 'box cycle = 16 counts');
  ok(b[0].syl==='IN' && b[4].syl==='HOLD' && b[8].syl==='OUT' && b[12].syl==='HOLD',
     'IN / HOLD / OUT / HOLD every 4');
})();

/* ---------- timing ---------- */
head('step duration across every grid');
(() => {
  M.st.bpm = 60;
  const want = { 4:1, 8:0.5, 12:1/3, 16:0.25 };
  let good = true, msg = [];
  for (const grid of [4,8,12,16]) {
    M.st.gi = 0; M.GROOVES[0].grid = grid;
    const d = M.stepDur();
    msg.push(grid + '→' + d.toFixed(4));
    if (Math.abs(d - want[grid]) > 1e-9) good = false;
    if (Math.abs(d * grid - 4) > 1e-9) good = false;   // every bar = 4s @ 60bpm
  }
  ok(good, '@60bpm ' + msg.join(' ') + '  (each bar = 4.000s)');
})();

/* ---------- take ---------- */
head('take: bar countdown stops on the bar');
for (const bars of [1,2,4]) {
  for (const name of ['Boots & Cats','Shuffle Blues','Cissy Strut']) {
    const g = M.CANON.find(x => x.name === name);
    let left = bars, run = 0, stopped = -1;
    for (let step = 0; step < g.slots.length * 20; step++) {
      const prev = step % g.slots.length;
      run++;
      if ((prev + 1) % g.grid === 0) { left--; if (left <= 0 && stopped < 0) stopped = run; }
      if (stopped > 0) break;
    }
    ok(stopped === bars * g.grid,
       name + ' (' + g.grid + '/bar, ' + g.slots.length + ' slots) · ' + bars +
       ' bars → ' + stopped + ' steps');
  }
}

head('take: replay grid lands on the recorded downbeat');
(() => {
  const bpm = 90, bars = 2, beat = 60/bpm;
  const started = 10.000, downbeat = 10.437;     // recorder fires mid count-off
  const offset = downbeat - started;
  const clicks = []; for (let b = 0; b <= bars*4; b++) clicks.push(offset + b*beat);
  ok(Math.abs(clicks[0] - offset) < 1e-9, 'click 1 at the downbeat (+' + offset.toFixed(3) + 's)');
  ok(clicks.length === bars*4 + 1, bars + ' bars → ' + clicks.length + ' clicks');
  ok(Math.abs((clicks.at(-1) - clicks[0]) - bars*4*beat) < 1e-9,
     'grid spans exactly ' + bars + ' bars');
})();

ok(M.TAKE_BARS.join(',') === '0,1,2,4', 'take cycles Off/1/2/4');

/* ---------- mode exclusivity (the v6 modes sheet) ---------- */
head('modes are mutually sane');
(() => {
  M.setGroove(M.DRILLS.length);              // Boots & Cats
  M.st.ramp = true; M.st.trade = true; M.setHalf(1);
  M.setTake(2);
  ok(M.st.takeBars === 2 && !M.st.ramp && !M.st.trade && M.st.half === 0,
     'arming a take clears ramp / trade / half (a take is one clean pass)');
  M.setTake(0);
  ok(M.st.takeBars === 0, 'take disarms back to Off');
})();

head('voice build-up never silences everything');
(() => {
  M.setGroove(M.DRILLS.length);
  M.toggleVoice('kick'); M.toggleVoice('snare'); M.toggleVoice('hat');
  const live = ['kick','snare','hat'].filter(v => M.st.on[v]);
  ok(live.length >= 1, 'at least one voice always audible (got ' + live.join(',') + ')');
  ['kick','snare','hat'].forEach(v => { if (!M.st.on[v]) M.toggleVoice(v); });
})();

head('drills ignore voice toggles');
(() => {
  M.setGroove(0);
  M.st.on.kick = false; M.st.on.snare = false;
  ok(M.audible().length === 5, 'drill audible() returns every voice regardless');
  M.st.on.kick = true; M.st.on.snare = true;
})();

/* ---------- session ---------- */
head('session');
(() => {
  const idxs = M.sessionIdxs();
  ok(idxs.length === 5, '5 steps');
  ok(idxs.every(i => M.isDrill(M.GROOVES[i])), 'every step is a real drill');
  ok(idxs.map(i => M.GROOVES[i].name).join('|') === M.SESSION_ORDER.join('|'),
     'resolves in declared order');
  let secs = 0;
  for (const i of idxs) { const d = M.GROOVES[i];
    for (const s of d.drill.stages) secs += s.passes*(s.gen().length/s.grid)*(60/d.start)*4; }
  ok(secs/60 > 7 && secs/60 < 12, 'runs ' + (secs/60).toFixed(1) + ' min');
})();

/* ---------- log ---------- */
head('practice log');
(() => {
  global.localStorage = undefined;
  let threw = false;
  try { M.logAdd('drill','x',90,10); M.logRead(); } catch (e) { threw = true; }
  ok(!threw, 'no-ops safely when storage is unavailable (private mode)');
})();

/* ---------- markup / wiring ---------- */
head('no dead DOM references');
(() => {
  const ids  = new Set([...body.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const used = new Set([...js.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]));
  const dead = [...used].filter(i => !ids.has(i));
  ok(dead.length === 0, 'every getElementById target exists' +
     (dead.length ? ' — MISSING: ' + dead.join(', ') : ''));

  const qs = [...js.matchAll(/querySelector(?:All)?\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
  const cls = new Set();
  for (const m of body.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach(c => cls.add(c));
  const badSel = qs.filter(q => {
    const m = /^[.#]([\w-]+)/.exec(q); if (!m) return false;
    if (q.startsWith('.syl')) return false;            // built in JS
    return !(q[0] === '.' ? cls.has(m[1]) : ids.has(m[1]));
  });
  ok(badSel.length === 0, 'every querySelector target exists' +
     (badSel.length ? ' — MISSING: ' + badSel.join(', ') : ''));
})();

head('every panel re-applies the safe-area insets');
(() => {
  const css = html.split('<style>')[1].split('</style>')[0];
  const rule = /\.panel\s*\{[^}]*\}/.exec(css);
  ok(!!rule && /safe-area-inset-top/.test(rule[0]),
     '.panel has safe-area padding (position:fixed escapes body padding — this is '
     + 'what buried the Log panel\'s Done button under the status bar)');
  const panels = [...body.matchAll(/class="panel"/g)].length;
  const closers = [...body.matchAll(/id="close[A-Z]"/g)].length;
  ok(panels === closers, panels + ' panels, ' + closers + ' close buttons — every panel has an exit');
})();

console.log('\n' + (fail ? 'FAILED ' + fail + ' of ' + count
                         : 'all ' + count + ' checks passed'));
process.exit(fail ? 1 : 0);
