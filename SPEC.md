# Spec: Zalo Web Online Audio Player (Chrome Extension)

## Objective
Build a Manifest V3 Chrome Extension for Zalo Web (`https://chat.zalo.me/`) that allows users to play audio files (such as `.m4a`, `.mp3`, `.wav`, `.aac`, `.ogg`, `.flac`) directly inside the chat interface online with an inline player instead of being forced to download them to disk.

Specifically, for audio files like "Bản ghi Mới 10.m4a" (voice recordings, voice memos, music tracks sent as file attachments):
- Automatically detect audio file messages in the chat conversation.
- Provide an inline, sleek audio player (Play/Pause, time scrubber, duration, speed control, volume).
- Intercept the audio stream/blob when "Play" is clicked so the file is fetched/decrypted via Zalo's existing secure pipeline into browser memory without prompting the browser to save a file to the Downloads folder.
- Retain the option to download if the user explicitly wants to save the file.

---

## Tech Stack
- **Platform**: Google Chrome Extension (Manifest V3)
- **Target URL**: `https://chat.zalo.me/*`
- **Languages**: Vanilla JavaScript (ES2022+), HTML5 Audio API, CSS3
- **Tools / Runtime**: Chrome Extensions API (Scripting, Storage, Content Scripts in MAIN/ISOLATED world)
- **No Heavy Bundlers**: Zero external runtime dependencies to keep the extension lightweight, instant, and easy to load unpacked in Developer Mode.

---

## Commands
```bash
# Verify directory structure
ls -la

# Validate manifest syntax
node -e "JSON.parse(require('fs').readFileSync('manifest.json'))"

# Load Extension in Chrome:
# 1. Open chrome://extensions/
# 2. Enable "Developer mode" (top-right toggle)
# 3. Click "Load unpacked"
# 4. Select folder: /Users/hientranthanh/Downloads/Zalo chrome ext
# 5. Open or reload https://chat.zalo.me/
```

---

## Project Structure
```
/Users/hientranthanh/Downloads/Zalo chrome ext/
├── manifest.json              → Manifest V3 configuration
├── content/
│   ├── content.js             → Isolated content script (DOM observer & bridge)
│   ├── inject.js              → Main-world script (Zalo React & download interceptor)
│   └── styles.css             → Inline audio player & UI styling matching Zalo Web
├── icons/
│   ├── icon16.png             → Extension toolbar icon (16x16)
│   ├── icon48.png             → Extension icon (48x48)
│   └── icon128.png            → Extension icon (128x128)
├── popup/
│   ├── popup.html             → Settings popup (enable/disable, autoplay, formats)
│   ├── popup.js               → Popup logic
│   └── popup.css              → Popup styles
├── SPEC.md                    → This specification document
└── README.md                  → Installation and usage guide
```

---

## Code Style & Conventions
- Modular ES6+ JavaScript with strict mode (`"use strict";`).
- Clean separation between DOM detection (`MutationObserver`), interceptor logic (`window` interception in main world), and UI rendering.
- Resilient CSS scoped under `.zalo-audio-player-container` to avoid conflicting with Zalo's Tailwind/custom classes.
- Safe DOM handling (no `innerHTML` with untrusted data).

Example code structure:
```javascript
// Main-world interceptor pattern
(function() {
  "use strict";
  const activePlayRequests = new Map(); // msgId -> callback

  // Intercept anchor click downloads when triggered by Play request
  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function() {
    const href = this.href || "";
    const downloadAttr = this.getAttribute("download") || "";
    if (href.startsWith("blob:") && isAudioFile(downloadAttr)) {
      const handled = handleAudioBlob(href, downloadAttr);
      if (handled) return; // Prevent browser download!
    }
    return originalClick.apply(this, arguments);
  };
})();
```

---

## Testing Strategy
1. **Static Syntax Validation**:
   - Validate `manifest.json` schema and JSON syntax.
   - Static analysis of JavaScript files for syntax errors.
2. **DOM Test on Stored Zalo Web Snapshot**:
   - Validate selector accuracy against `Zalo - Thanh Hiến.html` (verifying that `.file-message-v2`, `.file-message__content-title`, `Bản ghi Mới 10.m4a`, and download buttons are correctly matched).
3. **End-to-End Verification on Live Zalo Web**:
   - Load unpacked extension into Chrome.
   - Navigate to `https://chat.zalo.me/`.
   - Locate audio file message `Bản ghi Mới 10.m4a`.
   - Verify inline Play button appears.
   - Click Play -> Verify audio streams online without triggering Chrome "Save file" download dialog.
   - Verify audio controls: seek, pause, volume, playback rate (1x, 1.5x, 2x).
   - Verify original download button still works if clicked directly.

---

## Boundaries
- **Always do**:
  - Prevent accidental file downloads when user clicks "Play".
  - Clean up audio object URLs when messages unmount or replace to prevent memory leaks.
  - Support common audio extensions: `.m4a`, `.mp3`, `.wav`, `.aac`, `.ogg`, `.flac`, `.opus`, `.m4r`, `.weba`.
  - Seamlessly support light and dark modes of Zalo Web.
- **Ask first**:
  - Adding external dependencies or build tools.
  - Adding persistent background service workers unless required for permissions.
- **Never do**:
  - Never transmit user audio, chat data, or credentials to any third-party server. All playback is 100% local inside the browser.
  - Never break or override non-audio file downloads (e.g. `.pdf`, `.zip`, `.docx`, `.xlsx`).
  - Never block the user from legitimately downloading the audio file if they click the download icon.

---

## Success Criteria
1. When opening any conversation in Zalo Web containing an audio attachment (such as `Bản ghi Mới 10.m4a`), an inline player UI with a Play button is rendered within the message item.
2. Clicking "Phát" (Play) loads and plays the audio directly in the browser via HTML5 `<audio>`.
3. No file is downloaded to the user's computer disk when playing online.
4. Controls include: Play / Pause, current time / total duration, scrubber seek bar, playback speed (1x / 1.25x / 1.5x / 2x), and volume control.
5. The original download button remains accessible in case the user genuinely wants to save the file.
6. The extension works seamlessly on dynamic chat scrolling and message pagination without slowing down Zalo Web.

---

## UX & Interaction Design (Validated)
1. **Inline Integrated Player**:
   - Audio messages (such as `.m4a`, `.mp3`, `.wav`, `.aac`, `.ogg`, `.flac`) in Zalo Web will have an embedded play button integrated directly into the file message box.
   - Includes a circular play/pause button, time display (`0:00 / 0:15`), interactive seek bar / audio scrubber, playback speed multiplier (`1x`, `1.5x`, `2x`), and volume control.
   - The original "Lưu về máy" (Download) button remains available alongside the player.
2. **On-Demand Loading**:
   - The file is only fetched/streamed into memory when the user clicks "Play", conserving network bandwidth and avoiding unnecessary decryption requests until explicitly requested.
   - While fetching, a smooth loading spinner is displayed on the play button.
   - Once loaded, subsequent play/pause/seek operations are instantaneous.

---

## Open Questions & Decisions
- [x] **Player Placement**: Inline integrated player directly inside the message card.
- [x] **Loading Strategy**: On-demand loading upon clicking Play.
- [x] **Download Button**: Keep download button visible alongside the player.

