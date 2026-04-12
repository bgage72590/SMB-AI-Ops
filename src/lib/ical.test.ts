import { describe, expect, it } from "vitest";
import { generateIcs, parseSchedulingTime } from "./ical";

describe("generateIcs", () => {
  it("produces a valid VCALENDAR with VEVENT", () => {
    const ics = generateIcs({
      uid: "test-123@smbaiops",
      summary: "Plumbing estimate",
      start: new Date("2026-04-15T14:00:00Z"),
      end: new Date("2026-04-15T15:00:00Z"),
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("UID:test-123@smbaiops");
    expect(ics).toContain("DTSTART:20260415T140000Z");
    expect(ics).toContain("DTEND:20260415T150000Z");
    expect(ics).toContain("SUMMARY:Plumbing estimate");
  });

  it("escapes special characters in summary and description", () => {
    const ics = generateIcs({
      uid: "esc@test",
      summary: "Call re: pricing, discounts; etc",
      description: "Line one\nLine two",
      start: new Date("2026-05-01T09:00:00Z"),
      end: new Date("2026-05-01T10:00:00Z"),
    });
    expect(ics).toContain("SUMMARY:Call re: pricing\\, discounts\\; etc");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two");
  });

  it("includes attendee when provided", () => {
    const ics = generateIcs({
      uid: "att@test",
      summary: "Meeting",
      start: new Date("2026-06-01T10:00:00Z"),
      end: new Date("2026-06-01T11:00:00Z"),
      attendee: { name: "Jane Doe", email: "jane@example.com" },
    });
    expect(ics).toContain("ATTENDEE;CN=Jane Doe;RSVP=TRUE:mailto:jane@example.com");
  });

  it("uses CRLF line endings", () => {
    const ics = generateIcs({
      uid: "crlf@test",
      summary: "Test",
      start: new Date("2026-01-01T00:00:00Z"),
      end: new Date("2026-01-01T01:00:00Z"),
    });
    expect(ics).toMatch(/\r\n/);
    const lines = ics.split("\r\n").filter(Boolean);
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
  });
});

describe("parseSchedulingTime", () => {
  it("parses ISO date-time strings", () => {
    const d = parseSchedulingTime("Let's meet 2026-04-15T14:00 at the office");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(3);
    expect(d!.getDate()).toBe(15);
    expect(d!.getHours()).toBe(14);
    expect(d!.getMinutes()).toBe(0);
  });

  it("parses 'April 15 at 3pm'", () => {
    const d = parseSchedulingTime("Can we do April 15 at 3pm?");
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(3);
    expect(d!.getDate()).toBe(15);
    expect(d!.getHours()).toBe(15);
  });

  it("parses 'Jan 8 at 10:30 AM'", () => {
    const d = parseSchedulingTime("How about Jan 8 at 10:30 AM?");
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(0);
    expect(d!.getDate()).toBe(8);
    expect(d!.getHours()).toBe(10);
    expect(d!.getMinutes()).toBe(30);
  });

  it("parses day-of-week patterns like 'Saturday 10am'", () => {
    const d = parseSchedulingTime("See you Saturday 10am");
    expect(d).not.toBeNull();
    expect(d!.getDay()).toBe(6);
    expect(d!.getHours()).toBe(10);
  });

  it("parses day-of-week with 'at' like 'Tuesday at 2:30pm'", () => {
    const d = parseSchedulingTime("next Tuesday at 2:30pm works");
    expect(d).not.toBeNull();
    expect(d!.getDay()).toBe(2);
    expect(d!.getHours()).toBe(14);
    expect(d!.getMinutes()).toBe(30);
  });

  it("returns null for text with no time", () => {
    expect(parseSchedulingTime("Thanks for the update!")).toBeNull();
    expect(parseSchedulingTime("Please send the invoice")).toBeNull();
  });
});
