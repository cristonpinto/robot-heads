import { useState } from 'react';
import { OwlHead, owlHeadStates, type OwlState } from '../../src/owl';

const hints: Record<OwlState, string> = {
  idle: 'Looks around, blinks, hops now and then.',
  thinking: 'Eyes up, one brow raised, dots above.',
  searching: 'Sweeps its head side to side.',
  listening: 'Head cocked, tufts perked, sound waves.',
  speaking: 'The beak moves with the words.',
  working: 'Head down, squinting, circuits pulsing.',
  happy: 'Bouncing, smiling eyes, sparkles.',
  error: 'Shakes its head. Red X eyes.',
  sleeping: 'Drooped, eyes closed, dreaming in z’s.',
};

const q = new URLSearchParams(location.search);

/* the owl's own page: /?owl */
export default function OwlApp() {
  const [state, setState] = useState<OwlState>((q.get('state') as OwlState) ?? 'idle');
  const size = Math.round(Math.max(200, Math.min(window.innerWidth - 120, window.innerHeight - 380, 380)));
  return (
    <div className="app" style={{ gridTemplateColumns: '1fr' }}>
      <header className="masthead">
        <div className="byline"><span className="name">robot-heads</span><span className="by">/ owl</span></div>
      </header>
      <main className="stage" aria-label="Preview">
        <OwlHead state={state} size={size} paused={q.has('paused')} />
        <div className="caption">
          <h1 className="font-bold">{state[0].toUpperCase() + state.slice(1)}</h1>
          <p>{hints[state]}</p>
        </div>
      </main>
      <nav className="states" aria-label="State" style={{ flexWrap: 'wrap' }}>
        {owlHeadStates.map((s) => (
          <button key={s} className="state" aria-pressed={s === state} onClick={() => setState(s)}>
            <span className="state-name">{s[0].toUpperCase() + s.slice(1)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
