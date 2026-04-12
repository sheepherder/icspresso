// icspresso - Firefox WebExtension background script

// Content-Types that indicate calendar data
const CALENDAR_CONTENT_TYPES = [
  'text/calendar',
  'application/ics',
  'application/icalendar',
  'text/x-vcalendar'
];

// Fallback offsets for non-IANA TZIDs (abbreviations); IANA zones use Intl API
const TIMEZONE_OFFSETS = {
  'UTC': 0, 'GMT': 0,
  'EST': -5, 'CST': -6, 'MST': -7, 'PST': -8,
  'EDT': -4, 'CDT': -5, 'MDT': -6, 'PDT': -7
};

const dtfCache = new Map();
function getDtf(tzid) {
  let dtf = dtfCache.get(tzid);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tzid, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    dtfCache.set(tzid, dtf);
  }
  return dtf;
}

function localOffsetMs(dtf, utcMs) {
  const parts = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const asLocal = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asLocal - utcMs;
}

// Returns UTC ms for a wall-clock time in a named timezone, or null if unknown.
// Two-pass correction so wall times near DST transitions resolve correctly.
function wallTimeToUtc(tzid, year, month, day, hour, min, sec) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, min, sec);
  try {
    const dtf = getDtf(tzid);
    const firstPass = utcGuess - localOffsetMs(dtf, utcGuess);
    return utcGuess - localOffsetMs(dtf, firstPass);
  } catch (e) {
    const offset = TIMEZONE_OFFSETS[tzid];
    if (offset === undefined) return null;
    return utcGuess - offset * 3600 * 1000;
  }
}

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
    if (tzid) {
      const utcMs = wallTimeToUtc(
        tzid,
        parseInt(dateStr.slice(0, 4)),
        parseInt(dateStr.slice(4, 6)),
        parseInt(dateStr.slice(6, 8)),
        parseInt(dateStr.slice(9, 11)),
        parseInt(dateStr.slice(11, 13)),
        parseInt(dateStr.slice(13, 15))
      );
      if (utcMs !== null) {
        const d = new Date(utcMs);
        const pad = n => n.toString().padStart(2, '0');
        return { allDay: false, date: `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z` };
      }
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
    details += '<i><a href="' + sourceUrl + '">' + sourceUrl + '</a></i>';
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

// Track request IDs and their calendar status
const handledRequests = new Map();

function isCalendarContentType(contentType) {
  if (!contentType) return false;
  const lower = contentType.toLowerCase();
  return CALENDAR_CONTENT_TYPES.some(ct => lower.includes(ct));
}

// Intercept all main_frame requests and filter based on Content-Type
browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    const filter = browser.webRequest.filterResponseData(details.requestId);
    const decoder = new TextDecoder('utf-8');
    const textChunks = [];
    const rawChunks = [];

    filter.ondata = (event) => {
      rawChunks.push(new Uint8Array(event.data));
      textChunks.push(decoder.decode(event.data, { stream: true }));
    };

    filter.onstop = () => {
      const requestInfo = handledRequests.get(details.requestId);
      handledRequests.delete(details.requestId);

      if (requestInfo && requestInfo.isCalendar) {
        // Calendar file - process it
        const icsText = textChunks.join('') + decoder.decode();

        const encoder = new TextEncoder();
        filter.write(encoder.encode(`<!DOCTYPE html><html><head><title>icspresso</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f5f5f5}
.msg{text-align:center;color:#333}h1{font-size:24px;margin:0 0 8px}</style></head>
<body><div class="msg"><h1>icspresso</h1>Opening in Google Calendar...</div></body></html>`));
        filter.close();

        processIcsData(icsText, details.tabId, details.originUrl);
      } else {
        // Not a calendar file - pass through original data
        for (const chunk of rawChunks) {
          filter.write(chunk);
        }
        filter.close();
      }
    };

    filter.onerror = () => {
      handledRequests.delete(details.requestId);
      filter.disconnect();
    };

    // Mark request as being filtered, calendar status determined in onHeadersReceived
    handledRequests.set(details.requestId, { isCalendar: false });

    return {};
  },
  { urls: ['<all_urls>'], types: ['main_frame'] },
  ['blocking']
);

// Check Content-Type to identify calendar files
browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    const requestInfo = handledRequests.get(details.requestId);
    if (!requestInfo) {
      return {};
    }

    const contentTypeHeader = details.responseHeaders.find(
      h => h.name.toLowerCase() === 'content-type'
    );

    if (isCalendarContentType(contentTypeHeader?.value)) {
      requestInfo.isCalendar = true;

      // Modify headers to prevent download dialog
      const headers = details.responseHeaders.filter(
        h => h.name.toLowerCase() !== 'content-type' &&
             h.name.toLowerCase() !== 'content-disposition'
      );
      headers.push({ name: 'Content-Type', value: 'text/html; charset=utf-8' });

      return { responseHeaders: headers };
    }

    return {};
  },
  { urls: ['<all_urls>'], types: ['main_frame'] },
  ['blocking', 'responseHeaders']
);
