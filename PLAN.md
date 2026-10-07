# Technical Implementation Plan: Zalo Web Online Audio Player

## Phase 2: Plan

### 1. Architecture & Component Interaction
```
+-------------------------------------------------------------------------+
| Browser Tab: https://chat.zalo.me/                                      |
|                                                                         |
|  [MAIN World: inject.js]                                               |
|    • Monkey-patches HTMLAnchorElement.prototype.click                   |
|    • Intercepts blob downloads triggered by the inline player          |
|    • Bridges decrypted audio Blob URLs to the player via custom events  |
|    • Exposes window.__zaloAudioTriggerDownload(msgId)                   |
|                                                                         |
|  [ISOLATED World: content.js]                                          |
|    • Injects inject.js into the MAIN world                              |
|    • Watches DOM via MutationObserver for audio message bubbles         |
|    • Detects audio files (.m4a, .mp3, .wav, .aac, .ogg, .flac, etc.)   |
|    • Renders modern inline audio player widget into message card        |
|    • Manages audio playback, scrubber, timecode, speed (1x-2x), volume  |
|    • Coordinates single active audio instance (pauses other playbacks) |
|                                                                         |
|  [CSS: styles.css]                                                     |
|    • Premium dark/light mode compatible styles                          |
|    • Custom scrubber, waveform visualizer, responsive layout            |
|                                                                         |
|  [Popup: popup.html + popup.js + popup.css]                            |
|    • User toggle for extension enabled/disabled                        |
|    • Speed preference, volume memory, format filters                   |
+-------------------------------------------------------------------------+
```

### 2. Implementation Order
1. **Manifest & Icons**: Establish the extension configuration (`manifest.json`) and placeholder high-res SVG/PNG icons.
2. **Main-World Interceptor (`inject.js`)**: Robust download interception and blob capture without modifying browser downloads for non-audio or direct downloads.
3. **Content Script & DOM Observer (`content.js`)**: Real-time detection of audio attachments with dynamic mounting on chat scrolling.
4. **Inline Player Component & Styling (`styles.css`)**: Beautiful, native-looking audio player with HTML5 `<audio>`, scrubber, duration formatting, playback rate controls.
5. **Extension Settings Popup (`popup/`)**: Quick toggle switch, audio format settings, status indicators.
6. **Documentation & Validation**: README with installation instructions, test against `Zalo - Thanh Hiến.html` and manifest validation.

### 3. Risks & Mitigations
- **Risk 1: Zalo re-renders React DOM on virtual list scroll.**
  - *Mitigation*: Use a lightweight `MutationObserver` with debounce, plus `data-zalo-audio-enhanced="true"` attribute guard to avoid duplicate enhancements and re-attach listeners when DOM nodes are recycled.
- **Risk 2: User clicks regular download button instead of Play.**
  - *Mitigation*: Our click interceptor ONLY intercepts when a Play request is active (`isPlayInitiated = true`). Direct clicks on the download button proceed to disk download untouched.
- **Risk 3: Audio memory leaks with multiple Blobs.**
  - *Mitigation*: Store and revoke old Object URLs when audio elements are destroyed or replaced.

---

## Phase 3: Tasks

- [ ] **Task 1: Project Scaffolding & Manifest Configuration**
  - Acceptance: `manifest.json` configured with V3 specs, permissions, content scripts, and icons generated.
  - Verify: Node.js JSON validation, file existence check.
  - Files: `manifest.json`, `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`.

- [ ] **Task 2: Injected Script for Download Interception (`inject.js`)**
  - Acceptance: Intercepts `a.click()` when triggered by audio player; prevents download dialog and emits `zalo-audio-blob-ready` event with blob URL.
  - Verify: Automated test simulating `a.click()` with blob URL and verifying download is prevented and event received.
  - Files: `content/inject.js`.

- [ ] **Task 3: Content Script & Dynamic DOM Enhancer (`content.js`)**
  - Acceptance: Detects audio file cards (`.m4a`, `.mp3`, etc.), injects the player UI, wires HTML5 audio playback and controls, manages play state across messages.
  - Verify: Test execution against DOM nodes parsed from `Zalo - Thanh Hiến.html`.
  - Files: `content/content.js`.

- [ ] **Task 4: Polished Player UI Styling (`styles.css`)**
  - Acceptance: Modern, clean styling matching Zalo Web interface, responsive scrubber slider, loading spinner, speed toggle badge, volume control.
  - Verify: CSS lint and visual validation on DOM elements.
  - Files: `content/styles.css`.

- [ ] **Task 5: Extension Popup UI (`popup/`)**
  - Acceptance: Functional popup with status toggle (Enabled/Disabled), audio formats list, and playback speed preference.
  - Verify: HTML/CSS/JS syntax validation.
  - Files: `popup/popup.html`, `popup/popup.js`, `popup/popup.css`.

- [ ] **Task 6: Documentation & Verification Test Suite**
  - Acceptance: `README.md` with clear step-by-step loading guide in Chrome, and test runner verifying full flow against `Zalo - Thanh Hiến.html`.
  - Verify: Run test suite with python/node, 100% passing tests.
  - Files: `README.md`, `test/test_extension.js` (or python test).
