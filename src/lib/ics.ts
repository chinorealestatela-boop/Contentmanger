// Minimal .ics (iCalendar) generator — just enough for a single VEVENT so
// "Add to Calendar" works with Apple/Google/Outlook without a library.

function toICSDate(date: Date, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function escapeICS(text: string): string {
  return text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
}

export function buildAppointmentICS(params: {
  uid: string;
  title: string;
  description: string;
  location: string;
  date: Date;
  startTime: string;
  endTime: string;
}): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AutoMax LV//Test Drive Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${params.uid}@automaxlv-booking`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toICSDate(params.date, params.startTime)}`,
    `DTEND:${toICSDate(params.date, params.endTime)}`,
    `SUMMARY:${escapeICS(params.title)}`,
    `DESCRIPTION:${escapeICS(params.description)}`,
    `LOCATION:${escapeICS(params.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
