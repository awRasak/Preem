"use client";

import { Field, Input } from "@/components/Field";
import { WINDOW_OPTIONS } from "./types";
import type { WizardState } from "./types";

export function Step3Pricing({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  return (
    <div>
      <p className="mb-4 text-xs text-muted">
        Every Preem drop is pay-what-you-want — fans can pay more, but never less than
        the minimum you set here.
      </p>
      <Field label="Minimum Price (₦)">
        <Input
          required
          type="number"
          min={1}
          value={state.minPriceNaira}
          onChange={(e) => onChange({ minPriceNaira: e.target.value })}
          placeholder="800"
        />
      </Field>

      {state.dropType === "early-access" && (
        <Field label="Window">
          <select
            value={state.windowHours}
            onChange={(e) => onChange({ windowHours: Number(e.target.value) })}
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-paper focus:border-line-strong focus:outline-none"
          >
            {WINDOW_OPTIONS.map((o) => (
              <option key={o.hours} value={o.hours}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-muted">
            How long this stays exclusive to Preem before you can distribute it elsewhere.
          </p>
        </Field>
      )}
    </div>
  );
}
