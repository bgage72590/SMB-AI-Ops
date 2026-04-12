"use client";

import Link from "next/link";
import type { CalendarEvent } from "@/app/calendar/page";

interface Props {
  year: number;
  month: number;
  events: CalendarEvent[];
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarGrid({ year, month, events }: Props) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const cells: Array<{ day: number | null; dateStr: string }> = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: null, dateStr: "" });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, dateStr });
  }

  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    if (!eventsByDate.has(ev.date)) eventsByDate.set(ev.date, []);
    eventsByDate.get(ev.date)!.push(ev);
  }

  return (
    <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="text-center text-[10px] uppercase tracking-wider text-fg-subtle font-medium py-2">
            {wd}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          const isToday = cell.dateStr === todayStr;
          const dayEvents = cell.dateStr ? eventsByDate.get(cell.dateStr) || [] : [];

          return (
            <div
              key={idx}
              className={
                "min-h-[80px] lg:min-h-[100px] border-b border-r border-border p-1.5 " +
                (cell.day === null ? "bg-surface-2/30" : "bg-surface") +
                (idx % 7 === 6 ? " border-r-0" : "")
              }
            >
              {cell.day !== null && (
                <>
                  <div className={
                    "text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full " +
                    (isToday ? "bg-accent text-accent-fg" : "text-fg-muted")
                  }>
                    {cell.day}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const color =
                        ev.kind === "scheduled" ? "bg-accent" :
                        ev.kind === "followup" ? "bg-info" :
                        "bg-success";
                      const content = (
                        <div
                          className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate text-white ${color}`}
                        >
                          {ev.title}
                        </div>
                      );
                      return ev.href ? (
                        <Link key={ev.id} href={ev.href} className="block hover:opacity-80 transition-opacity">
                          {content}
                        </Link>
                      ) : (
                        <div key={ev.id}>{content}</div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-fg-subtle pl-1">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
