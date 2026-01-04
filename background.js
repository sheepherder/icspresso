// icspresso - Firefox WebExtension background script

const ICS_URL_PATTERNS = [
  "*://*/*.ics",
  "*://*/*.ics?*",
  "*://*/*.ical",
  "*://*/*.ical?*",
  "*://*/*.ifb",
  "*://*/*.ifb?*",
  "*://*/*.vcs",
  "*://*/*.vcs?*"
];

// Common timezone offsets (best effort)
const TIMEZONE_OFFSETS = {
  'America/New_York': -5, 'America/Chicago': -6, 'America/Denver': -7,
  'America/Los_Angeles': -8, 'America/Anchorage': -9, 'Pacific/Honolulu': -10,
  'Europe/London': 0, 'Europe/Paris': 1, 'Europe/Berlin': 1,
  'Europe/Moscow': 3, 'Asia/Dubai': 4, 'Asia/Kolkata': 5.5,
  'Asia/Shanghai': 8, 'Asia/Tokyo': 9, 'Australia/Sydney': 11,
  'Pacific/Auckland': 13, 'UTC': 0, 'GMT': 0,
  'EST': -5, 'CST': -6, 'MST': -7, 'PST': -8,
  'EDT': -4, 'CDT': -5, 'MDT': -6, 'PDT': -7
};

const FREQ_MAP = {
  'DAILY': 'daily',
  'WEEKLY': 'weekly',
  'MONTHLY': 'monthly',
  'YEARLY': 'yearly'
};

const DAY_MAP = {
  'SU': 'Sunday', 'MO': 'Monday', 'TU': 'Tuesday', 'WE': 'Wednesday',
  'TH': 'Thursday', 'FR': 'Friday', 'SA': 'Saturday'
};

function showNotification(title, message) {
  browser.notifications.create({
    type: 'basic',
    title: title,
    message: message
  });
}

function htmlToMarkdown(html) {
  if (!html) return '';
  return html
    .replace(/<a\s+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi, '[$2]($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<strong>([^<]+)<\/strong>/gi, '**$1**')
    .replace(/<b>([^<]+)<\/b>/gi, '**$1**')
    .replace(/<em>([^<]+)<\/em>/gi, '*$1*')
    .replace(/<i>([^<]+)<\/i>/gi, '*$1*')
    .replace(/<ul>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<li>([^<]+)<\/li>/gi, '- $1\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function unfoldIcsLines(icsText) {
  return icsText.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseIcsValue(line) {
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) return { params: {}, value: '' };

  const beforeColon = line.substring(0, colonIndex);
  const value = line.substring(colonIndex + 1);

  const params = {};
  const semicolonIndex = beforeColon.indexOf(';');
  if (semicolonIndex !== -1) {
    const paramStr = beforeColon.substring(semicolonIndex + 1);
    paramStr.split(';').forEach(p => {
      const [key, val] = p.split('=');
      if (key && val) params[key.toUpperCase()] = val;
    });
  }

  return { params, value: value.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\\\/g, '\\') };
}

function parseIcsDate(dateStr, tzid) {
  if (/^\d{8}$/.test(dateStr)) {
    return { allDay: true, date: dateStr };
  }

  if (/^\d{8}T\d{6}Z$/.test(dateStr)) {
    return { allDay: false, date: dateStr };
  }

  if (/^\d{8}T\d{6}$/.test(dateStr)) {
    const offset = tzid ? TIMEZONE_OFFSETS[tzid] : null;
    if (offset !== null && offset !== undefined) {
      const year = parseInt(dateStr.slice(0, 4));
      const month = parseInt(dateStr.slice(4, 6)) - 1;
      const day = parseInt(dateStr.slice(6, 8));
      const hour = parseInt(dateStr.slice(9, 11));
      const min = parseInt(dateStr.slice(11, 13));
      const sec = parseInt(dateStr.slice(13, 15));

      const asUtcMs = Date.UTC(year, month, day, hour, min, sec);
      const actualUtcMs = asUtcMs - (offset * 60 * 60 * 1000);
      const utcDate = new Date(actualUtcMs);

      const pad = n => n.toString().padStart(2, '0');
      const utcStr = `${utcDate.getUTCFullYear()}${pad(utcDate.getUTCMonth() + 1)}${pad(utcDate.getUTCDate())}T${pad(utcDate.getUTCHours())}${pad(utcDate.getUTCMinutes())}${pad(utcDate.getUTCSeconds())}Z`;
      return { allDay: false, date: utcStr };
    }
    return { allDay: false, date: dateStr + 'Z' };
  }

  return { allDay: false, date: dateStr };
}

function parseRrule(rrule) {
  if (!rrule) return '';

  const parts = {};
  rrule.split(';').forEach(p => {
    const [key, val] = p.split('=');
    if (key && val) parts[key.toUpperCase()] = val;
  });

  let result = 'Repeats: ';
  const freq = FREQ_MAP[parts.FREQ] || parts.FREQ?.toLowerCase();
  if (!freq) return '';

  if (parts.INTERVAL && parts.INTERVAL !== '1') {
    result += `every ${parts.INTERVAL} ${freq.replace(/ly$/, '')}s`;
  } else {
    result += freq;
  }

  if (parts.BYDAY) {
    const days = parts.BYDAY.split(',').map(d => DAY_MAP[d.replace(/[0-9-]/g, '')] || d).join(', ');
    result += ` on ${days}`;
  }

  if (parts.COUNT) {
    result += `, ${parts.COUNT} times`;
  }

  if (parts.UNTIL) {
    const until = parts.UNTIL;
    if (until.length >= 8) {
      result += ` until ${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}`;
    }
  }

  return result;
}

function parseIcs(icsText) {
  const lines = unfoldIcsLines(icsText).split('\n');
  const events = [];
  let currentEvent = null;

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = { attendees: [] };
    } else if (line.startsWith('END:VEVENT') && currentEvent) {
      events.push(currentEvent);
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('SUMMARY')) {
        currentEvent.summary = parseIcsValue(line).value;
      } else if (line.startsWith('DTSTART')) {
        const { params, value } = parseIcsValue(line);
        currentEvent.dtstart = parseIcsDate(value, params.TZID);
      } else if (line.startsWith('DTEND')) {
        const { params, value } = parseIcsValue(line);
        currentEvent.dtend = parseIcsDate(value, params.TZID);
      } else if (line.startsWith('LOCATION')) {
        currentEvent.location = parseIcsValue(line).value;
      } else if (line.startsWith('DESCRIPTION')) {
        currentEvent.description = parseIcsValue(line).value;
      } else if (line.startsWith('RRULE')) {
        currentEvent.rrule = parseIcsValue(line).value;
      } else if (line.startsWith('ATTENDEE')) {
        const { params, value } = parseIcsValue(line);
        const email = value.replace(/^mailto:/i, '');
        const name = params.CN || email;
        currentEvent.attendees.push(name);
      }
    }
  }

  return events;
}

function buildGoogleCalendarUrl(event, sourceUrl) {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const params = [];

  if (event.summary) {
    params.push(`text=${encodeURIComponent(event.summary)}`);
  }

  if (event.dtstart) {
    let dates = event.dtstart.date;
    if (event.dtend) {
      dates += '/' + event.dtend.date;
    } else {
      dates += '/' + event.dtstart.date;
    }
    params.push(`dates=${dates}`);
  }

  if (event.location) {
    params.push(`location=${encodeURIComponent(event.location)}`);
  }

  let details = event.description ? htmlToMarkdown(event.description) : '';

  if (event.attendees && event.attendees.length > 0) {
    if (details) details += '\n\n';
    details += 'Attendees: ' + event.attendees.join(', ');
  }

  if (event.rrule) {
    const rruleText = parseRrule(event.rrule);
    if (rruleText) {
      if (details) details += '\n\n';
      details += rruleText;
    }
  }

  if (sourceUrl) {
    if (details) details += '\n\n';
    details += 'Source: ' + sourceUrl + '\n';
  }

  if (details.length > 1500) {
    details = details.slice(0, 1497) + '...';
  }

  if (details) {
    params.push(`details=${encodeURIComponent(details)}`);
  }

  return base + (params.length ? '&' + params.join('&') : '');
}

function processIcsData(icsText, tabId, sourceUrl) {
  try {
    const events = parseIcs(icsText);

    if (events.length === 0) {
      showNotification('icspresso', 'No events found in file');
      return;
    }

    // Open Google Calendar tabs for each event
    for (let i = 0; i < events.length; i++) {
      const gcalUrl = buildGoogleCalendarUrl(events[i], sourceUrl);
      browser.tabs.create({
        url: gcalUrl,
        active: i === 0
      });
    }

    // Close the original tab that was loading the .ics file
    if (tabId && tabId !== -1) {
      browser.tabs.remove(tabId);
    }

  } catch (error) {
    showNotification('icspresso', `Error parsing calendar: ${error.message}`);
  }
}

// Track request IDs we're handling
const handledRequests = new Set();

// Intercept ICS file requests and capture response using filterResponseData
browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Only intercept main document navigations (not XHR, fetch, etc.)
    if (details.type !== 'main_frame') {
      return {};
    }

    handledRequests.add(details.requestId);

    const filter = browser.webRequest.filterResponseData(details.requestId);
    const decoder = new TextDecoder('utf-8');
    const chunks = [];

    filter.ondata = (event) => {
      chunks.push(decoder.decode(event.data, { stream: true }));
    };

    filter.onstop = () => {
      const icsText = chunks.join('') + decoder.decode();

      // Write a simple page to show while redirecting
      const encoder = new TextEncoder();
      filter.write(encoder.encode(`<!DOCTYPE html><html><head><title>icspresso</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f5f5f5}
.msg{text-align:center;color:#333}h1{font-size:24px;margin:0 0 8px}</style></head>
<body><div class="msg"><h1>icspresso</h1>Opening in Google Calendar...</div></body></html>`));
      filter.close();

      handledRequests.delete(details.requestId);
      // Use originUrl (the page with the link) instead of the .ics URL
      processIcsData(icsText, details.tabId, details.originUrl);
    };

    filter.onerror = () => {
      handledRequests.delete(details.requestId);
      filter.disconnect();
    };

    return {};
  },
  { urls: ICS_URL_PATTERNS },
  ['blocking']
);

// Change Content-Type to text/html to prevent download behavior
browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (!handledRequests.has(details.requestId)) {
      return {};
    }

    const headers = details.responseHeaders.filter(
      h => h.name.toLowerCase() !== 'content-type' && h.name.toLowerCase() !== 'content-disposition'
    );
    headers.push({ name: 'Content-Type', value: 'text/html; charset=utf-8' });

    return { responseHeaders: headers };
  },
  { urls: ICS_URL_PATTERNS },
  ['blocking', 'responseHeaders']
);
