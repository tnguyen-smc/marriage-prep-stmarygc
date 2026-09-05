import { google } from "googleapis";

/**
 * Creates a real Google Calendar event on the signed-in priest's primary
 * calendar and emails an invitation to the couple.
 *
 * - `attendees` is the couple's email address (the guests list).
 * - `description` is the URL of the couple's profile card in this app, so
 *   the priest can jump straight from the calendar entry back to their file.
 * - sendUpdates: "all" is what actually makes Google send the invite email;
 *   without it the couple is listed as a guest but never notified.
 */
export async function createEvent(auth, { summary, description, start, end, attendees, timeZone }) {
  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.events.insert({
    calendarId: "primary",
    sendUpdates: "all",
    requestBody: {
      summary,
      description,
      start: { dateTime: start, timeZone },
      end: { dateTime: end, timeZone },
      attendees: (attendees || []).filter(Boolean).map((email) => ({ email })),
    },
    fields: "id, htmlLink",
  });
  return { id: res.data.id, htmlLink: res.data.htmlLink };
}
