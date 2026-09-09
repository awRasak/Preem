"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

type Draft = { y: number; mo: number; d: number; h: number; mi: number };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toValue(d: Draft) {
  return `${d.y}-${pad(d.mo + 1)}-${pad(d.d)}T${pad(d.h)}:${pad(d.mi)}`;
}

function parseValue(v: string): Draft | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  if (!m) return null;
  return {
    y: Number(m[1]),
    mo: Number(m[2]) - 1,
    d: Number(m[3]),
    h: Number(m[4]),
    mi: Number(m[5]),
  };
}

// Default for a fresh pick: today, next full hour (show-friendly).
function defaultDraft(): Draft {
  const now = new Date();
  now.setHours(now.getHours() + 1, 0, 0, 0);
  return {
    y: now.getFullYear(),
    mo: now.getMonth(),
    d: now.getDate(),
    h: now.getHours(),
    mi: now.getMinutes(),
  };
}

function displayText(v: string): string | null {
  const p = parseValue(v);
  if (!p) return null;
  const weekday = new Date(p.y, p.mo, p.d).toLocaleDateString("en-US", {
    weekday: "short",
  });
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
  const ampm = p.h < 12 ? "AM" : "PM";
  return `${weekday}, ${MONTHS_SHORT[p.mo]} ${p.d} · ${h12}:${pad(p.mi)} ${ampm}`;
}

export function DateTimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(defaultDraft);
  const [viewY, setViewY] = useState(draft.y);
  const [viewMo, setViewMo] = useState(draft.mo);

  function handleOpen() {
    const p = parseValue(value) ?? defaultDraft();
    setDraft(p);
    setViewY(p.y);
    setViewMo(p.mo);
    setOpen(true);
  }

  function commit(next: Draft) {
    setDraft(next);
    onChange(toValue(next));
  }

  function shiftMonth(delta: number) {
    const d = new Date(viewY, viewMo + delta, 1);
    setViewY(d.getFullYear());
    setViewMo(d.getMonth());
  }

  // Calendar cells for the viewed month, Sunday-first, with adjacent-month fill.
  const firstWeekday = new Date(viewY, viewMo, 1).getDay();
  const daysInMonth = new Date(viewY, viewMo + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewY, viewMo, 0).getDate();
  const cells: { d: number; inMonth: boolean; key: string }[] = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    cells.push({ d: daysInPrevMonth - i, inMonth: false, key: `p${i}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ d, inMonth: true, key: `c${d}` });
  }
  let next = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ d: next, inMonth: false, key: `n${next}` });
    next += 1;
  }

  const today = new Date();
  const isToday = (d: number) =>
    viewY === today.getFullYear() &&
    viewMo === today.getMonth() &&
    d === today.getDate();

  const selected = parseValue(value);
  const isSelected = (d: number) =>
    !!selected &&
    selected.y === viewY &&
    selected.mo === viewMo &&
    selected.d === d;

  const h12 = draft.h % 12 === 0 ? 12 : draft.h % 12;
  const ampm = draft.h < 12 ? "AM" : "PM";

  return (
    <div
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-left text-base text-paper focus:border-line-strong focus:outline-none"
      >
        {displayText(value) ? (
          <span>{displayText(value)}</span>
        ) : (
          <span className="text-muted">mm/dd/yyyy, --:-- --</span>
        )}
        <CalendarDays className="h-4 w-4 flex-shrink-0 text-muted" />
      </button>

      {open && (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="dialog"
            aria-label="Pick a date and time"
            className="absolute left-0 z-50 mt-2 w-[19rem] rounded-xl border border-line bg-surface p-4 shadow-xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-paper">
                {new Date(viewY, viewMo, 1).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => shiftMonth(-1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-paper"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => shiftMonth(1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-paper"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {WEEKDAYS.map((w, i) => (
                <span
                  key={i}
                  className="py-1 text-center text-[11px] font-bold text-muted"
                >
                  {w}
                </span>
              ))}
              {cells.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  disabled={!c.inMonth}
                  onClick={() =>
                    commit({ ...draft, y: viewY, mo: viewMo, d: c.d })
                  }
                  className={`flex h-9 items-center justify-center rounded-lg text-sm transition-colors ${
                    isSelected(c.d)
                      ? "bg-accent font-bold text-[#1a0d05]"
                      : c.inMonth
                        ? isToday(c.d)
                          ? "font-bold text-accent hover:bg-surface-2"
                          : "text-paper hover:bg-surface-2"
                        : "text-muted/40"
                  }`}
                >
                  {c.d}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
              <Clock className="h-4 w-4 flex-shrink-0 text-muted" />
              <select
                aria-label="Hour"
                value={h12}
                onChange={(e) => {
                  const picked = Number(e.target.value);
                  const h24 =
                    ampm === "AM" ? picked % 12 : (picked % 12) + 12;
                  commit({ ...draft, h: h24 });
                }}
                className="rounded-lg border border-line bg-surface-2 px-2 py-2 text-sm font-bold text-paper focus:border-line-strong focus:outline-none"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>
                    {pad(h)}
                  </option>
                ))}
              </select>
              <span className="font-bold text-muted">:</span>
              <select
                aria-label="Minute"
                value={draft.mi}
                onChange={(e) => commit({ ...draft, mi: Number(e.target.value) })}
                className="rounded-lg border border-line bg-surface-2 px-2 py-2 text-sm font-bold text-paper focus:border-line-strong focus:outline-none"
              >
                {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                  <option key={m} value={m}>
                    {pad(m)}
                  </option>
                ))}
              </select>
              <div className="ml-auto flex overflow-hidden rounded-lg border border-line">
                {(["AM", "PM"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => {
                      const h24 =
                        a === "AM" ? h12 % 12 : (h12 % 12) + 12;
                      commit({ ...draft, h: h24 });
                    }}
                    aria-pressed={ampm === a}
                    className={`px-2.5 py-2 text-xs font-bold ${
                      ampm === a
                        ? "bg-accent text-[#1a0d05]"
                        : "text-muted hover:text-paper"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 flex items-center border-t border-line pt-3">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setDraft(defaultDraft());
                }}
                className="text-sm font-bold text-muted hover:text-paper"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  const t = new Date();
                  commit({
                    ...draft,
                    y: t.getFullYear(),
                    mo: t.getMonth(),
                    d: t.getDate(),
                  });
                  setViewY(t.getFullYear());
                  setViewMo(t.getMonth());
                }}
                className="ml-auto text-sm font-bold text-accent hover:opacity-80"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-3 rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-[#1a0d05] hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
