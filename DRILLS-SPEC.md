# YEN's Beatbox Trainer — Drill System Spec

Written against `index.html` @ `cccafbd` (v3). **Sections 1–4 are the original
diagnosis, kept as written.** Section 5 tracks what has since shipped.

**Status:** D1, D2, D4, D5, D6 and the session engine are live in v5. D3 and D7,
the sound reference surface, and the Worker clock are still open.

---

## 1. Diagnosis

v3 is a **play-along**, not a trainer. It does exactly one thing well: loop an
authored groove with karaoke syllables, velocity-differentiated, at a ramping
tempo. That's a good foundation and the groove data is genuinely strong — the
linearizer model (monophonic, one sound per slot) is the right abstraction and
the teach copy is real musical writing, not filler.

But every "drill" in v3 is a *mode on top of a groove*: voice toggles, half-loop,
ramp, trade. There is no drill that exists independently of a groove, which means
there is no way to train a **skill** — only a **pattern**.

The gap is exposed by the app's own teach copy:

| Groove | Teach copy says the skill is… | Drill that trains it |
|---|---|---|
| Country Train | "pop the KA louder on 2 & 4 without breaking the roll's evenness — that's the real skill" | none |
| Funky Drummer | "add ONE ghost at a time, quieter than feels useful" | none |
| Superstition | "accent by relaxing the ghosts, not by pushing the accents" | none |
| Purdie | "ghosts whispering constantly, then ONE fat KAT" | none |
| Country Two-Step | "the failure mode at speed is straightening into a polka" | none |
| Jazz Swing | "lock it like a metronome" | none |

Five of seventeen grooves name the *same underlying skill* — **dynamic control
under a continuous stream** — and nothing in the app isolates it.

Second gap: **Phase 0 breathing is gone from v3.** Per project memory this is the
third time it's been dropped. Breath is the thing that ends a take at bar 9.

Third gap: **the looper use case is untrained.** A looper records take one.
Nothing in the app rehearses count-in → one perfect pass → stop. Every groove is
an infinite loop, which is neither how music nor how a Ditto works.

---

## 2. Drill architecture

Drills are **first-class data**, siblings of grooves — not modes over them.

```js
const DRILLS = [ { id, name, family, skill, spec, pass } ]
```

A drill declares a *generator* (produces slots at runtime from parameters) rather
than a fixed `slots[]` array. The scheduler already consumes `slots` + `grid`, so
a drill just needs to hand it a freshly generated bar each pass.

Six families. Ship 1–4 first; 5–6 are the differentiators.

### D1 · Isolation (Wawad method)
One sound, metronome, one hit per click, 60 seconds. Then 2/click, 3/click,
4/click. App runs the clock, counts hits, advances the ladder on completion.

- params: `sound`, `subdivision ∈ {1,2,3,4}`, `bpm`, `seconds`
- pass condition: complete the set without stopping
- why: this is the Alem/Wawad discipline the reference doc calls the core of all
  professional pedagogy, and it currently cannot be done in the app at all —
  there is no way to hear or loop a single sound without loading a groove.

### D2 · Dynamic Split — **highest leverage, build first**
One sound, 4 or 16 slots, one accent among ghosts. Accent position walks.

```
K k k k  →  k K k k  →  k k K k  →  k k k K   (2 bars each, no stop)
```

- params: `sound`, `grid`, `accentPositions[]`, `walk: bool`
- variant: invert — one ghost among accents (harder, trains restraint)
- why: directly trains the skill named in five grooves. Also the fastest audible
  improvement — dynamics are what make a mouth sound like a kit.

### D3 · Subdivision Ladder
Same tempo, same sound, cycle quarter → 8th → triplet → 16th, 2 bars each,
continuous, no count between. Then descend. Then randomize the order.

- why: fixes "the shuffle straightens under pressure." Straightening happens
  because triplet and 16th feel aren't independently addressable — this makes
  the switch itself the exercise.

### D4 · Two-Voice Independence
Continuous ghost stream on voice A; loud accent on voice B at fixed positions.
Stream must not flinch.

```
d g d g | d g d g   +   KA on 2 & 4
```

- params: `streamSound`, `accentSound`, `streamGrid`, `accentPositions[]`
- ramp: increase stream density (8th → 16th) before increasing tempo
- why: Country Train, Purdie, Second-Line all collapse without it.

### D5 · Breath (Phase 0 — non-negotiable, always present)
Two sub-drills:

1. **Diaphragm check** — timed guided box breathing, 4 in / 4 hold / 4 out, with
   the two-hand test instruction on screen. 90 seconds. Runs before any session.
2. **Breath windows** — a groove with a designated inward slot; app counts bars
   and holds you to a target (2 → 4 → 8 → 16 bars unbroken). Failure is running
   out of air, and the app should show bars-survived, not pass/fail.

Put this at the top of the drill list, never gated, never buried in a panel.

### D6 · Take (the looper drill) — **the one that matters for gigs**
Count-off → record exactly N bars via `MediaRecorder` → stop → play the take back
with the click over it. No ML, no scoring, ~40 lines. Self-assessment against a
click is the entire feedback loop and it beats the current zero.

- params: `bars ∈ {1,2,4}`, `bpm`, `groove`
- store last 5 takes in memory (no backend needed)
- why: this is the actual performance condition. Everything else is rehearsal.

### D7 · Cold Recall
App picks a groove at random, gives 2 bars of count, mutes itself entirely. You
play it from memory. Tests recall rather than reading — the karaoke line is a
crutch that must eventually come off.

---

## 3. Session engine

A drill list is inert without a clock driving it. Add a **20-minute session**
that runs top to bottom, no choices required:

| Block | Min | Content |
|---|---|---|
| Breath | 2 | D5.1 diaphragm |
| Isolation | 4 | D1 on the weakest sound (user-picked or last-failed) |
| Dynamics | 4 | D2 accent walk at a comfortable tempo |
| Groove | 6 | current groove + Ramp |
| Take | 4 | D6, 2-bar takes, 3 attempts |

Plus a plain **log**: date, drill, tempo reached, bars survived. Not gamified,
not gated — just a record, so tempo progress over weeks is visible. Localstorage
is enough.

---

## 4. Ship blockers in current code

### Audio
1. **No master bus.** Every voice connects straight to `ac.destination`. On dense
   16th grooves (Superstition, Country Train, Funky Drummer) the summed peaks
   exceed 1.0 and clip on phone speakers. Insert `GainNode → DynamicsCompressor →
   destination` and route all voices through it. Single highest-impact audio fix.
2. **Scheduler starves when backgrounded.** `setInterval(scheduler, 25)` with a
   0.12 s lookahead: browsers throttle background intervals to ≥1 s, so the
   phone dimming its screen mid-loop causes audible dropouts. Raise lookahead to
   0.25 s and move the clock into a `Worker` (or accept the wake lock below as a
   partial mitigation).
3. **No wake lock.** `navigator.wakeLock.request('screen')` on play, release on
   stop. The screen currently sleeps mid-drill.
4. **Kick doesn't survive a phone speaker.** Beater click is bandpassed at
   1800 Hz; the app's own reference targets a 2–5 kHz transient. Phone speakers
   roll off hard below ~500 Hz, so the 48 Hz fundamental is inaudible and there's
   no HF click to imply it. Add a 3–4 kHz click layer.
5. **iOS hardware mute switch silences WebAudio.** Known platform behavior;
   either apply the silent-`<audio>`-element workaround or state it in How-To.

### Repo
6. **`Untitled/` is committed as a gitlink** — mode `160000`, commit
   `8fe93db`, and there is **no `.gitmodules`**. A broken embedded repo in the
   tree. Vercel clones get an empty directory. `git rm --cached Untitled` and
   delete it.
7. **Root is full of tracked cruft:** `benchmark.js`–`benchmark5.js`, `test.js`,
   `test2.js`, `patch.js`, `code_review_prompt.txt`. All dead. Remove.
8. **`api/chat.js` is deployed but never called** — zero references in
   `index.html`. It expects `GEMINI_API_KEY` and does nothing. Either wire the
   Gemini coaching layer or delete the endpoint.
9. **`.claude/launch.json` is tracked and deleted in the worktree.** Dirty state;
   `.claude/` should be ignored.

### UX contradicting the stated pedagogy
10. **Voice toggles start all-on**, but the teach panel instructs "loop Kick
    alone, then +Snare, then +Hat." Doing what the app says requires turning two
    things *off*. Either default to kick-only, or make the buttons an additive
    build-up stepper as originally described.
11. **Trade mode keeps a click running during YOUR phase** — so you never
    actually play unaccompanied. Add a second stage where the click drops out and
    the app re-enters on the next downbeat; if you drifted, you hear the
    collision. That's the real time test.
12. **Ramp is fixed** at 10 loops / +2 BPM with no back-off on failure and no
    user control of either number. A ramp that only goes up isn't a drill.
13. **Half-loop labels are ambiguous** — "1st/2nd" means *bar 1 / bar 2* on
    32-slot grooves and *half a bar* on 16-slot ones. Label from the data.
14. **No sound reference surface.** The `TODO` at line 903 is correct and should
    now be built: one entry per mouth sound with SBN notation, execution steps
    from the reference doc, common errors, and an audition button.

---

## 5. Order of work

| # | Item | Status |
|---|---|---|
| 1 | Master bus + compressor + kick HF click | **done** — v4 |
| 2 | Repo cleanup (`Untitled` gitlink, root cruft) | **done** — v4 |
| 3 | D2 Accent Walk + D1 Isolation ladders | **done** — v4 |
| 4 | D5 Breath, restored to the top and never removed again | **done** — v4 |
| 5 | D4 Independence (train roll) | **done** — v4 |
| 6 | Wake lock, 0.25 s lookahead, generalized `stepDur` | **done** — v4 |
| 7 | D6 Take (MediaRecorder, one clean pass) | **done** — v5 |
| 8 | Session engine (5 drills, ~9 min, hands free) | **done** — v5 |
| 9 | Practice log (localStorage, ungated) | **done** — v5 |
| 10 | D3 Subdivision Ladder as a standalone flip drill | open |
| 11 | D7 Cold Recall | open |
| 12 | Sound reference surface (the `TODO` in the source) | open |
| 13 | Worker-based clock | open |
| 14 | iOS mute-switch workaround | open |

### Notes on what shipped

**Take** is a transport mode, not a drill entry — it layers over *any* groove,
which is the point: you record a take of the thing you're actually going to
loop. Arming it collapses Half/Ramp/Trade, because a take is one clean pass and
those three all reshape the bar underneath it. The app goes **completely silent**
for the length of the take — no groove, no click, just the four-count and then
you. Playback decodes the blob to an `AudioBuffer` and plays it on the
`AudioContext` clock with a **freshly generated** click grid on top, so drift
shows up as your take walking away from a grid that never moved. Mic capture
requests `echoCancellation`, `noiseSuppression` and `autoGainControl` all off —
every one of them mangles beatbox transients.

**Session** reuses the drill machinery rather than introducing a parallel
scheduler: it's an ordered list of groove indices that advances on
`drillDone`. Roughly 9 minutes.

**Log** is deliberately inert — it records, it never gates. Wrapped in
try/catch so private-mode Safari degrades to a no-op instead of throwing.

Nothing above requires Gemini, Magenta, or a backend. Do those after the drills
work — a coaching layer over a trainer with no drills is decoration.
