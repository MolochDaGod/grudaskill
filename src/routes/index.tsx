import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState, type ComponentType } from "react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [Lab, setLab] = useState<ComponentType<{ autoEnter?: boolean }> | null>(null);
  const [busy, setBusy] = useState(false);

  const enter = useCallback(() => {
    if (busy) return;
    setBusy(true);
    void import("@/components/ability-lab")
      .then((m) => {
        setLab(() => m.AbilityLab);
      })
      .catch(() => {
        setBusy(false);
      });
  }, [busy]);

  if (Lab) return <Lab autoEnter />;

  return (
    <main className="relative grid h-dvh w-full place-items-center overflow-hidden bg-bg px-4 text-fg">
      <div className="hud-panel w-full max-w-md rounded-lg p-6 shadow-2xl">
        <p className="text-xs tracking-[0.28em] text-gold uppercase">Grudge Studio · Warlords</p>
        <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight">Ability Lab</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Warlords era · Grudge6 toon · weapon skills on 1–6 · class on R F V T G B.
          Select a skill in the book, tune it, then fire.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
          <div>
            <b className="text-fg">1–6</b> Weapon skills
          </div>
          <div>
            <b className="text-fg">R F V T G B</b> Class abilities
          </div>
          <div>
            <b className="text-fg">LMB</b> fire · <b className="text-fg">RMB</b> focus
          </div>
          <div>
            <b className="text-fg">Tab</b> spell book · editor bind
          </div>
        </div>
        <button
          type="button"
          className="mt-5 w-full rounded-lg bg-fg py-3 text-sm font-semibold text-bg"
          onClick={enter}
          disabled={busy}
        >
          {busy ? "Loading kits…" : "Enter the lab"}
        </button>
        <p className="mt-3 text-center text-xs text-muted">
          1–6 weapons · R F V T G B class · LMB places the shot
        </p>
      </div>
    </main>
  );
}
