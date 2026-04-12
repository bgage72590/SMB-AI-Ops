"use client";

import { useState } from "react";

interface Props {
  text: string;
  children: React.ReactNode;
  position?: "top" | "bottom";
}

export function HelpTip({ text, children, position = "top" }: Props) {
  const [show, setShow] = useState(false);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      <button
        type="button"
        className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-surface-2 text-fg-subtle text-[10px] font-bold hover:bg-border cursor-help"
        aria-label={text}
        tabIndex={0}
      >
        ?
      </button>
      {show && (
        <span
          role="tooltip"
          className={`absolute z-50 left-1/2 -translate-x-1/2 max-w-xs px-3 py-2 rounded-lg bg-fg text-bg text-xs shadow-[var(--shadow-pop)] whitespace-normal pointer-events-none ${
            position === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
