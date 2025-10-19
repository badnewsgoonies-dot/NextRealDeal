import React from 'react';

export function CombatLog({ lines }: { lines: string[] }): JSX.Element {
  const endRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines]);

  return (
    <div className="rounded-xl bg-black/40 backdrop-blur p-3 border border-white/15 max-h-[40vh] overflow-auto text-sm">
      {lines.length === 0 && <div className="opacity-60">Battle started…</div>}
      {lines.map((l, i) => <div key={i} className="leading-6">{l}</div>)}
      <div ref={endRef} />
    </div>
  );
}

