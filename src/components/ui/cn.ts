// Tiny class-name joiner. Avoids adding `clsx` as a dependency for
// something this simple. Accepts strings, falsy values, and booleans.
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
