export default async (req) => {
  try {
    const url = new URL(req.url);
    const checkIn = url.searchParams.get("checkIn");
    const checkOut = url.searchParams.get("checkOut");

    if (!checkIn || !checkOut) {
      return new Response("Missing checkIn/checkOut", { status: 400 });
    }

    // Convert to RFC3339
    const timeMin = new Date(checkIn + "T00:00:00Z").toISOString();
    const timeMax = new Date(checkOut + "T00:00:00Z").toISOString();

    const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;
    if (!apiKey) {
      return new Response("Missing GOOGLE_CALENDAR_API_KEY env var", { status: 500 });
    }

    // Your 5 calendar IDs
    const calendarIds = {
      ember: "c_bc9057d9e3d351e41ff237eab1b76cc094dde3a10c7dc52300a46fef5b05f6bb@group.calendar.google.com",
      sol:   "c_9604005cce2c6820370868c69a9b5969318db90ea602d02bedf686413231f6c6@group.calendar.google.com",
      olive: "c_2d98df917a5d723591728327104b822366b8d50e9a146074dad22751c39eb3cf@group.calendar.google.com",
      azure: "c_1c15bf34b558008117cb0f300bdf8251cbb2bfde28ac49381526ca9e67fb318c@group.calendar.google.com",
      slate: "c_2b08545133fbeb86d8e8b3de20d9b98843ef9abdab207c5aa509b9bf0bd01950@group.calendar.google.com"
    };

    const results = {};

    // Fetch events in the requested range for each suite
    for (const [suiteKey, calId] of Object.entries(calendarIds)) {
      const calEnc = encodeURIComponent(calId);

      const endpoint =
        `https://www.googleapis.com/calendar/v3/calendars/${calEnc}/events` +
        `?key=${encodeURIComponent(apiKey)}` +
        `&timeMin=${encodeURIComponent(timeMin)}` +
        `&timeMax=${encodeURIComponent(timeMax)}` +
        `&singleEvents=true&orderBy=startTime`;

      const resp = await fetch(endpoint);
      const data = await resp.json();

      // If the calendar is not public or key invalid, Google returns an error object
      if (!resp.ok) {
        // fail "safe": mark as unavailable if we can't verify
        results[suiteKey] = {
          available: false,
          error: data?.error?.message || "Calendar API error"
        };
        continue;
      }

      const items = Array.isArray(data.items) ? data.items : [];
      // If ANY event exists in the range, treat as booked (you can refine later)
      results[suiteKey] = { available: items.length === 0 };
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Cache a bit to reduce Google calls
        "Cache-Control": "public, max-age=60"
      }
    });
  } catch (err) {
    return new Response("Server error: " + (err?.message || "unknown"), { status: 500 });
  }
};
