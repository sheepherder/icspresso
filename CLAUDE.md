# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

icspresso is a Firefox WebExtension that intercepts `.ics` calendar file downloads and opens them directly in Google Calendar. It uses Manifest V2 for `webRequestBlocking` support.

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
1. `onBeforeRequest` listener matches ICS URL patterns (`*.ics`, `*.ical`, `*.ifb`, `*.vcs`)
2. Only intercepts `main_frame` requests (not XHR/fetch) to preserve page functionality
3. Uses Firefox-specific `filterResponseData()` API to capture response body while keeping original cookies/auth
4. `onHeadersReceived` listener changes `Content-Type` to `text/html` to prevent browser download dialog
5. `handledRequests` Set synchronizes between the two listeners (tracks which requests are being handled)

**ICS Parsing:**
- `unfoldIcsLines()`: Handles RFC 5545 line folding (continuation lines starting with space/tab)
- `parseIcsValue()`: Extracts parameters (like TZID) and unescapes values
- `parseIcsDate()`: Converts ICS dates to Google Calendar format, handles timezone conversion
- `parseRrule()`: Converts recurrence rules to human-readable text (Google Calendar URL doesn't support RRULE)

**Google Calendar Integration:**
- Builds `calendar.google.com/calendar/render?action=TEMPLATE` URLs
- Supports: title, dates, location, description, attendees (as text)
- Truncates description to 1500 chars (Google limit)
- Appends source URL and recurrence info to description

## Key Technical Decisions

- **Manifest V2**: Required for `webRequestBlocking` permission (Manifest V3 doesn't support synchronous request blocking)
- **filterResponseData vs fetch**: Must use `filterResponseData` to maintain original request cookies for authenticated calendar downloads
- **Two-listener pattern**: `onBeforeRequest` captures body, `onHeadersReceived` fixes headers - both needed because headers determine download behavior before body is processed
