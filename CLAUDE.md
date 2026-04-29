# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

icspresso is a Firefox WebExtension that intercepts calendar file downloads (based on Content-Type) and opens them directly in Google Calendar. It uses Manifest V2 for `webRequestBlocking` support.

## Build & Package

Create ZIP for Mozilla signing:
```bash
7z a icspresso.zip manifest.json background.js
```
Upload at addons.mozilla.org, then download signed XPI.

Temporary testing in Firefox:
1. Go to `about:debugging#/runtime/this-firefox`
2. Load `manifest.json` as temporary add-on

## Architecture

The extension consists of a single background script (`background.js`) with no external dependencies.

**Request Interception Flow:**
1. `onBeforeRequest` listener intercepts ALL `main_frame` requests (page navigations)
2. Uses Firefox-specific `filterResponseData()` API to capture response body while keeping original cookies/auth
3. `onHeadersReceived` listener checks Content-Type for calendar MIME types (`text/calendar`, `application/ics`, etc.)
4. If calendar: marks request, changes Content-Type to `text/html` to prevent download dialog
5. If not calendar: passes through original data unchanged
6. `handledRequests` Map synchronizes between the two listeners (tracks request state)

**ICS Parsing:**
- `unfoldIcsLines()`: Handles RFC 5545 line folding (continuation lines starting with space/tab)
- `parseIcsValue()`: Extracts parameters (like TZID) and unescapes values
- `parseIcsDate()`: Converts ICS dates to Google Calendar format, handles timezone conversion. Floating times (no TZID, no Z) are converted via browser-local timezone
- `parseRrule()`: Converts recurrence rules to human-readable text (Google Calendar URL doesn't support RRULE)

**Google Calendar Integration:**
- Builds `calendar.google.com/calendar/render?action=TEMPLATE` URLs
- Supports: title, dates, location, description, attendees (as text)
- Truncates description to 1500 chars (Google limit)
- Appends source URL and recurrence info to description

## Key Technical Decisions

- **Manifest V2**: Required for `webRequestBlocking` permission (Manifest V3 doesn't support synchronous request blocking)
- **filterResponseData vs fetch**: Must use `filterResponseData` to maintain original request cookies for authenticated calendar downloads
- **Content-Type based detection**: Intercepts ALL main_frame requests and decides based on Content-Type header, not URL patterns. This catches calendar files from services like Wix that use dynamic URLs without `.ics` extension
- **Two-listener pattern**: `onBeforeRequest` sets up filter and captures body, `onHeadersReceived` checks Content-Type and marks calendar requests - both needed because headers arrive after request starts but before body completes
- **Passthrough for non-calendar**: Non-calendar responses are buffered and written back unchanged, ensuring normal browsing isn't affected
- **Floating time fallback**: ICS dates without TZID and without Z suffix are treated as browser-local time, not UTC. Many real-world generators omit timezone info

## Known Limitations

- **Zero-duration events**: When DTEND == DTSTART or DTEND is missing, the event is passed through as-is, resulting in a zero-duration event in Google Calendar. Some generators set this when end time is unknown — could default to 1h instead
- **RRULE as text only**: Google Calendar's URL API doesn't support RRULE, so recurrence is appended as human-readable text in the description
