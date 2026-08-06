"use client";

import type { ReactNode } from "react";

/**
 * Labelled form control.
 *
 * Every CRM form previously leaned on `placeholder` as its only label. A
 * placeholder disappears the moment the field has a value, so a half-filled
 * form is a column of unnamed boxes — unreadable to a screen reader (WCAG
 * 3.3.2) and unverifiable for a sighted user reviewing what they typed.
 *
 * The control is nested inside the `label`, so the association is implicit and
 * needs no id — which matters here because several of these forms are rendered
 * more than once on a page and hand-written ids would collide.
 */
export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  /** Secondary text after the label — units, "(optional)", a required marker. */
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label
      className={
        "block text-[11px] font-medium text-muted-foreground" +
        (className ? " " + className : "")
      }
    >
      <span className="block mb-0.5">
        {label}
        {hint && <span className="ml-1 font-normal opacity-70">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
