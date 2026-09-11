// Cross-check the new solver against the independent, shipped tablebase and
// replay every decisive experiment with separately expressed movement rules.
// node analysis/verify.mjs analysis/*.jsonl
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RULESETS } from '../web/rulesets.mjs';
import { parsePerfectTablebase } from '../web/perfect-engine.mjs';

const paths = process.argv.slice(2);
assert.ok(paths.length, 'provide result JSONL files');
const results = (await Promise.all(paths.map(path => readFile(path, 'utf8'))))
  .flatMap(text => text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)));
const bytes = await readFile(new URL('../web/perfect-tablebase.bin', import.meta.url));
const table = parsePerfectTablebase(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const patternKeys = patterns => patterns.map(p => [...p].sort((a,b) => a-b).join(',')).sort();
const mod = n => (n + 8) % 8;
const label = p => p === 255 ? 'pass' : `${'SIO'[Math.floor(p/8)]}${p%8}`;

let sampleCount = 0, moveCount = 0;
for (const r of results) {
  assert.equal(r.bellmanAudit, true);
  if (r.id === 'original') assert.deepEqual(patternKeys(r.patterns), patternKeys(RULESETS.proper.winningPatterns));
  if (r.id === 'legacy-targets') assert.deepEqual(patternKeys(r.patterns), patternKeys(RULESETS.legacy.winningPatterns));
  if (r.movement === 'proper' && r.id === 'original') {
    assert.equal(r.states, 5_527_111);
    assert.equal(r.edges, 84_458_408);
    assert.equal(r.wins, 3_181_193);
    assert.equal(r.losses, 1_016_545);
    assert.equal(r.draws, 1_329_373);
    assert.equal(r.terminals, 18_220);
    assert.equal(r.stalemates, 0);
    assert.equal(r.outcome, 'win');
    assert.equal(r.distance, 89);
    assert.equal(r.maximumDistance, 108);
    for (const s of r.auditSamples) {
      assert.deepEqual(table.lookup({ red:s.white, blue:s.black, turn:s.side ? 'blue' : 'red', ruleset:'proper' }),
        {outcome:s.outcome,distance:s.distance});
      sampleCount++;
    }
  }
  let white=[0,2,4,6], black=[1,3,5,7], side=0;
  const hasWin = pieces => r.patterns.some(pattern => pattern.every(p => pieces.includes(p)));
  function legalMoves() {
    const own = side ? black : white, occupied = [...white,...black];
    return own.flatMap(from => {
      if(r.movement === 'deploy' && own.some(p => p<8) && from>=8) return [];
      const i=from%8;
      let to;
      if(from<8) to=[8+mod(i-1),8+i,16+mod(i-1),16+i];
      else if(from<16) {
        to = ['local-inner','legacy'].includes(r.movement)
          ? [8+mod(i-1),8+mod(i+1)]
          : Array.from({length:8},(_,j)=>8+j).filter(p=>p!==from);
        to.push(16+mod(i-1),16+mod(i+1));
        if(!['legacy','no-radial'].includes(r.movement)) to.push(16+i);
      } else {
        to=[8+mod(i-1),8+mod(i+1)];
        if(!['legacy','no-radial'].includes(r.movement)) to.push(8+i);
        if(r.movement==='outer-ring') to.push(16+mod(i-1),16+mod(i+1));
      }
      return to.filter(p=>!occupied.includes(p)).map(to=>({from,to}));
    }).concat(r.movement==='pass' ? [{from:255,to:255}] : []);
  }
  assert.deepEqual(r.opening.map(({from,to})=>`${from},${to}`).sort(),legalMoves().map(({from,to})=>`${from},${to}`).sort());
  assert.equal(r.outcome === 'draw' ? null : r.pv.length,r.distance);
  const visited=new Set();
  for(const [ply,step] of r.pv.entries()) {
    assert.equal(hasWin(white)||hasWin(black),false);
    assert.equal(step.side,side);
    assert.deepEqual(step.white,white);
    assert.deepEqual(step.black,black);
    const key=`${white}|${black}|${side}`;
    assert.ok(!visited.has(key),'decisive PV repeats'); visited.add(key);
    const moves=legalMoves();
    assert.equal(moves.length,step.winMoves+step.drawMoves+step.lossMoves);
    assert.ok(moves.some(m=>m.from===step.from&&m.to===step.to),`${r.movement}/${r.id} illegal ${label(step.from)}–${label(step.to)}`);
    if(step.from!==255) {
      const own=side ? black : white;
      const moved=own.map(p=>p===step.from ? step.to : p).sort((a,b)=>a-b);
      if(side) black=moved; else white=moved;
    }
    if(r.movement==='proper'&&r.id==='original') {
      const child=table.lookup({red:white,blue:black,turn:side ? 'red' : 'blue',ruleset:'proper'});
      assert.equal(child.distance,89-ply-1);
    }
    side^=1; moveCount++;
  }
  assert.deepEqual(r.finalWhite,white);
  assert.deepEqual(r.finalBlack,black);
  if(r.distance!==null) {
    assert.equal(hasWin(white),r.outcome==='win');
    assert.equal(hasWin(black),r.outcome==='loss');
  }
}
console.log(`Verified ${results.length} experiments, ${sampleCount} independent tablebase samples, and ${moveCount} PV moves.`);
