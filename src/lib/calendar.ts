function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r/g, "");
}
function timestamp(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}
// RFC 5545 folds at 75 octets, without splitting a UTF-8 character.
function fold(line: string) {
  const chunks: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = new TextEncoder().encode(char).length;
    if (size + bytes > 75) {
      chunks.push(current);
      current = " ";
      size = 1;
    }
    current += char;
    size += bytes;
  }
  chunks.push(current);
  return chunks.join("\r\n");
}
export function buildCalendar(
  events: {
    id: string;
    title: string;
    startsAt: Date;
    durationMinutes: number;
    location: string | null;
    updatedAt: Date;
    status: string;
    description: string;
  }[],
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WiseCard//Advisor Calendar//HE",
    "CALSCALE:GREGORIAN",
    ...events.flatMap((a) => [
      "BEGIN:VEVENT",
      `UID:${a.id}@wisecard`,
      `DTSTAMP:${timestamp(a.updatedAt)}`,
      `LAST-MODIFIED:${timestamp(a.updatedAt)}`,
      `DTSTART:${timestamp(a.startsAt)}`,
      `DTEND:${timestamp(new Date(a.startsAt.getTime() + a.durationMinutes * 60000))}`,
      `SUMMARY:${escapeText(a.title)}`,
      `DESCRIPTION:${escapeText(a.description)}`,
      `LOCATION:${escapeText(a.location || "")}`,
      `STATUS:${a.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
