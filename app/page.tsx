"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

const LETTERS = "Monteverge".split("");
const ACT_COUNT = 10;
const ACT_LENGTH_MS = 30_000;
const ACT_STORAGE_KEY = "monteverge.landing.act";

function readStoredAct(): number {
  try {
    const raw = window.localStorage.getItem(ACT_STORAGE_KEY);
    const value = raw === null ? Number.NaN : Number.parseInt(raw, 10);
    return Number.isInteger(value) && value >= 1 && value <= ACT_COUNT ? value : 0;
  } catch {
    /* Storage can be blocked (private mode, strict cookie settings). */
    return 0;
  }
}

function storeAct(act: number) {
  try {
    window.localStorage.setItem(ACT_STORAGE_KEY, String(act));
  } catch {
    /* The cycle still runs when persistence is unavailable. */
  }
}

export default function Home() {
  const [act, setAct] = useState(1);
  const actRef = useRef(1);
  const resumed = useRef(false);

  /* Resume from the last saved act when the page loads or is refreshed, then
     advance every 30 seconds and loop back to act 1 after act 10. */
  useEffect(() => {
    let current = actRef.current;

    if (!resumed.current) {
      resumed.current = true;
      const stored = readStoredAct();
      current = stored === 0 ? 1 : (stored % ACT_COUNT) + 1;
      actRef.current = current;
      setAct(current);
      storeAct(current);
    }

    const timer = setInterval(() => {
      current = (current % ACT_COUNT) + 1;
      actRef.current = current;
      setAct(current);
      storeAct(current);
    }, ACT_LENGTH_MS);

    return () => clearInterval(timer);
  }, []);

  return (
    <main className={`landing landing--act-${act}`}>
      <div className="landing__frame">
        <div className="landing__hero">
          <h1 className="landing__title" aria-label="Monteverge.">
            {LETTERS.map((char, i) => (
              <span key={i} className="landing__letter" style={{ "--i": i } as CSSProperties} aria-hidden="true">
                <span className="landing__glyph">{char}</span>
              </span>
            ))}
            <span className="landing__period" aria-hidden="true">.</span>
          </h1>
          <div className="landing__cta">
            <Link className="landing__button" href="/market">
              Get started <span aria-hidden="true">&#8599;</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
