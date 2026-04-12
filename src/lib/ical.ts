// Minimal iCalendar (.ics) generator. Produces a single VEVENT suitable
// for importing into Google Calendar, Apple Calendar, or Outlook.
//
// We keep this zero-dependency — the .ics format is simple enough that we
// don't need a library for a single-event file.

export interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  organizer?: { name: string; email: string };
  attendee?: { name: string; email: string };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatDate(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function fold(line: string): string {
  const MAX = 75;
  if (line.length <= MAX) return line;
  const parts: string[] = [line.slice(0, MAX)];
  let i = MAX;
  while (i < line.length) {
    parts.push(" " + line.slice(i, i + MAX - 1));
    i += MAX - 1;
  }
  return parts.join("\r\n");
}

function escape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function generateIcs(event: IcsEvent): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SMB AI Ops//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(event.start)}`,
    `DTEND:${formatDate(event.end)}`,
    `SUMMARY:${escape(event.summary)}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escape(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escape(event.location)}`);
  }
  if (event.organizer) {
    lines.push(
      `ORGANIZER;CN=${escape(event.organizer.name)}:mailto:${event.organizer.email}`
    );
  }
  if (event.attendee) {
    lines.push(
      `ATTENDEE;CN=${escape(event.attendee.name)};RSVP=TRUE:mailto:${event.attendee.email}`
    );
  }

  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function parseSchedulingTime(text: string): Date | null {
  // Look for patterns like "Saturday 10am", "next Tuesday at 2:30 PM",
  // "April 15 at 3pm", "4/15 at 14:00", or ISO-ish strings.
  const now = new Date();

  // ISO date-time: 2026-04-15T14:00
  const isoMatch = text.match(
    /(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})/
  );
  if (isoMatch) {
    const d = new Date(`${isoMatch[1]}T${isoMatch[2].padStart(2, "0")}:${isoMatch[3]}:00`);
    if (!isNaN(d.getTime())) return d;
  }

  // "April 15 at 3pm" / "Apr 15 at 3:30 PM"
  const monthDayMatch = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i
  );
  if (monthDayMatch) {
    const monthNames: Record<string, number> = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
      apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
      aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
      nov: 10, november: 10, dec: 11, december: 11,
    };
    const month = monthNames[monthDayMatch[1].toLowerCase()];
    const day = parseInt(monthDayMatch[2], 10);
    let hour = parseInt(monthDayMatch[3], 10);
    const min = monthDayMatch[4] ? parseInt(monthDayMatch[4], 10) : 0;
    const ampm = monthDayMatch[5]?.toLowerCase();
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    const year = month < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();
    const d = new Date(year, month, day, hour, min);
    if (!isNaN(d.getTime())) return d;
  }

  // Day-of-week: "Saturday 10am", "next Tuesday at 2:30pm"
  const dowMatch = text.match(
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i
  );
  if (dowMatch) {
    const dayNames: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };
    const target = dayNames[dowMatch[1].toLowerCase()];
    let hour = parseInt(dowMatch[2], 10);
    const min = dowMatch[3] ? parseInt(dowMatch[3], 10) : 0;
    const ampm = dowMatch[4]?.toLowerCase();
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    const diff = (target - now.getDay() + 7) % 7 || 7;
    const d = new Date(now);
    d.setDate(d.getDate() + diff);
    d.setHours(hour, min, 0, 0);
    return d;
  }

  return null;
}
