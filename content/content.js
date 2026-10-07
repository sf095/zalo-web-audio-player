/**
 * Zalo Web Online Audio Player - Content Script
 * Observes chat messages in Zalo Web, detects audio attachments (.m4a, .mp3, etc.),
 * and mounts an interactive inline audio player for instant online playback.
 */
(function() {
  "use strict";

  const AUDIO_EXTENSIONS = [
    ".m4a", ".mp3", ".wav", ".aac", ".ogg",
    ".flac", ".opus", ".m4r", ".weba", ".wma"
  ];

  const PLAY_SPEEDS = [1, 1.25, 1.5, 2];

  // SVG Icons
  const ICONS = {
    play: `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
    pause: `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
    spinner: `<div class="zap-spinner"></div>`,
    volume: `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
    mute: `<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`
  };

  let currentlyPlayingAudio = null;
  let isExtensionEnabled = true;

  // Initialize extension setting
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get({ enabled: true }, (res) => {
      isExtensionEnabled = res.enabled !== false;
    });

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.enabled) {
        isExtensionEnabled = changes.enabled.newValue !== false;
      }
    });
  }

  // Inject MAIN world script
  function injectMainWorldScript() {
    if (document.getElementById("zap-injected-script")) return;
    const s = document.createElement("script");
    s.id = "zap-injected-script";
    s.src = chrome.runtime.getURL("content/inject.js");
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
  }

  // Format seconds to mm:ss
  function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  // Check if filename has an audio extension
  function isAudioFile(name) {
    if (!name || typeof name !== "string") return false;
    const clean = name.toLowerCase().trim();
    return AUDIO_EXTENSIONS.some(ext => clean.endsWith(ext));
  }

  // Extract message ID from DOM hierarchy
  function getMessageId(container) {
    const parentWithQid = container.closest("[data-qid]");
    if (parentWithQid) {
      const qid = parentWithQid.getAttribute("data-qid") || "";
      const match = qid.match(/@(\d+)_/);
      if (match) return match[1];
    }
    const parentWithId = container.closest("[id*='msg_id_'], [id*='message-frame_']");
    if (parentWithId) {
      const match = parentWithId.id.match(/\d+/);
      if (match) return match[0];
    }
    return "msg_" + Math.random().toString(36).substring(2, 9);
  }

  // Extract clean file name from container
  function getFileName(container) {
    const titleEl = container.querySelector(".file-message__content-title, [classname*='file-message__content-title']");
    if (titleEl) {
      const titleAttr = titleEl.getAttribute("title");
      if (titleAttr && isAudioFile(titleAttr)) return titleAttr.trim();
      const text = titleEl.textContent ? titleEl.textContent.replace(/\u00a0/g, " ").trim() : "";
      if (isAudioFile(text)) return text;
    }
    return "";
  }

  // Build audio player component
  function createPlayerUI(container, fileName, msgId) {
    const wrapper = document.createElement("div");
    wrapper.className = "zap-player-wrapper";

    const card = document.createElement("div");
    card.className = "zap-player-card";

    // Play Button
    const playBtn = document.createElement("button");
    playBtn.className = "zap-play-btn";
    playBtn.title = "Phát trực tuyến";
    playBtn.innerHTML = ICONS.play;

    // Track Section (Seeker & Times)
    const trackSection = document.createElement("div");
    trackSection.className = "zap-track-section";

    const timeRow = document.createElement("div");
    timeRow.className = "zap-time-row";

    const currentTimeSpan = document.createElement("span");
    currentTimeSpan.className = "zap-current-time";
    currentTimeSpan.textContent = "0:00";

    const durationSpan = document.createElement("span");
    durationSpan.className = "zap-duration";
    durationSpan.textContent = "--:--";

    timeRow.appendChild(currentTimeSpan);
    timeRow.appendChild(durationSpan);

    const seeker = document.createElement("input");
    seeker.type = "range";
    seeker.className = "zap-seeker";
    seeker.min = "0";
    seeker.max = "100";
    seeker.value = "0";
    seeker.step = "0.1";

    trackSection.appendChild(seeker);
    trackSection.appendChild(timeRow);

    // Controls Right (Speed & Volume)
    const controlsRight = document.createElement("div");
    controlsRight.className = "zap-controls-right";

    let currentSpeedIdx = 0;
    const speedBtn = document.createElement("button");
    speedBtn.className = "zap-speed-btn";
    speedBtn.title = "Tốc độ phát";
    speedBtn.textContent = "1x";

    const volBtn = document.createElement("button");
    volBtn.className = "zap-vol-btn";
    volBtn.title = "Tắt/Bật âm lượng";
    volBtn.innerHTML = ICONS.volume;

    controlsRight.appendChild(speedBtn);
    controlsRight.appendChild(volBtn);

    card.appendChild(playBtn);
    card.appendChild(trackSection);
    card.appendChild(controlsRight);
    wrapper.appendChild(card);

    // Audio element
    const audio = document.createElement("audio");
    audio.preload = "none";
    wrapper.appendChild(audio);

    let isLoading = false;
    let isUserSeeking = false;

    // Update play button state
    function setPlayState(state) {
      if (state === "loading") {
        isLoading = true;
        playBtn.innerHTML = ICONS.spinner;
      } else if (state === "playing") {
        isLoading = false;
        playBtn.innerHTML = ICONS.pause;
      } else {
        isLoading = false;
        playBtn.innerHTML = ICONS.play;
      }
    }

    // Audio playback event listeners
    audio.addEventListener("loadedmetadata", () => {
      durationSpan.textContent = formatTime(audio.duration);
    });

    audio.addEventListener("timeupdate", () => {
      if (isUserSeeking || isNaN(audio.duration)) return;
      currentTimeSpan.textContent = formatTime(audio.currentTime);
      const percent = (audio.currentTime / audio.duration) * 100;
      seeker.value = percent || 0;
    });

    audio.addEventListener("ended", () => {
      setPlayState("paused");
      seeker.value = "0";
      currentTimeSpan.textContent = "0:00";
    });

    audio.addEventListener("play", () => {
      if (currentlyPlayingAudio && currentlyPlayingAudio !== audio) {
        currentlyPlayingAudio.pause();
      }
      currentlyPlayingAudio = audio;
      setPlayState("playing");
    });

    audio.addEventListener("pause", () => {
      setPlayState("paused");
    });

    // Seeker input handling
    seeker.addEventListener("input", () => {
      isUserSeeking = true;
      if (!isNaN(audio.duration)) {
        const targetTime = (seeker.value / 100) * audio.duration;
        currentTimeSpan.textContent = formatTime(targetTime);
      }
    });

    seeker.addEventListener("change", () => {
      if (!isNaN(audio.duration)) {
        audio.currentTime = (seeker.value / 100) * audio.duration;
      }
      isUserSeeking = false;
    });

    // Speed button handling
    speedBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      currentSpeedIdx = (currentSpeedIdx + 1) % PLAY_SPEEDS.length;
      const speed = PLAY_SPEEDS[currentSpeedIdx];
      audio.playbackRate = speed;
      speedBtn.textContent = `${speed}x`;
    });

    // Volume button handling
    volBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      audio.muted = !audio.muted;
      volBtn.innerHTML = audio.muted ? ICONS.mute : ICONS.volume;
    });

    // Play/Pause button handling
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();

      if (isLoading) return;

      // If audio already has source loaded, toggle playback
      if (audio.src) {
        if (audio.paused) {
          audio.play().catch(err => console.warn("[ZaloAudioPlayer] Play error:", err));
        } else {
          audio.pause();
        }
        return;
      }

      // Fetch and load audio online via download interception
      setPlayState("loading");

      // Register capture listener
      const onBlobCaptured = (event) => {
        const detail = event.detail || {};
        if (detail.msgId === msgId || detail.fileName === fileName) {
          window.removeEventListener("__zalo_audio_blob_captured__", onBlobCaptured);
          window.removeEventListener("__zalo_audio_error__", onBlobError);

          audio.src = detail.blobUrl;
          audio.play().catch(err => console.warn("[ZaloAudioPlayer] Play error:", err));
        }
      };

      const onBlobError = (event) => {
        const detail = event.detail || {};
        if (detail.msgId === msgId) {
          window.removeEventListener("__zalo_audio_blob_captured__", onBlobCaptured);
          window.removeEventListener("__zalo_audio_error__", onBlobError);
          setPlayState("paused");
          alert("Không thể tải file âm thanh. Vui lòng thử lại.");
        }
      };

      window.addEventListener("__zalo_audio_blob_captured__", onBlobCaptured);
      window.addEventListener("__zalo_audio_error__", onBlobError);

      // Tell MAIN world about pending play
      window.dispatchEvent(new CustomEvent("__zalo_audio_request_play__", {
        detail: { msgId, fileName }
      }));

      // Trigger Zalo's download button
      const dlBtn = container.querySelector(
        ".file-message__actions.download, a[data-translate-title='STR_DOWNLOAD_FILE'], a[title='Lưu về máy']"
      );

      if (dlBtn) {
        dlBtn.click();
      } else {
        console.warn("[ZaloAudioPlayer] Could not find download button to trigger.");
        setPlayState("paused");
        window.removeEventListener("__zalo_audio_blob_captured__", onBlobCaptured);
      }
    });

    return wrapper;
  }

  // Enhance a file message container if it's an audio file
  function enhanceFileMessage(container) {
    if (!isExtensionEnabled) return;
    if (container.getAttribute("data-zap-enhanced") === "true") return;

    const fileName = getFileName(container);
    if (!fileName || !isAudioFile(fileName)) return;

    // Mark enhanced to prevent duplicate insertion
    container.setAttribute("data-zap-enhanced", "true");

    const msgId = getMessageId(container);
    const contentBox = container.querySelector(".file-message__content") || container;
    const playerUI = createPlayerUI(container, fileName, msgId);

    // Insert player into content box
    contentBox.appendChild(playerUI);
  }

  // Scan current DOM for audio messages
  function scanExistingMessages() {
    const fileMessages = document.querySelectorAll(".file-message-v2, .file-message__container");
    fileMessages.forEach(enhanceFileMessage);
  }

  // Setup MutationObserver to handle dynamic message loading / scrolling
  function setupObserver() {
    let debounceTimer = null;
    const observer = new MutationObserver((mutations) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        scanExistingMessages();
      }, 100);
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // Initialize
  function init() {
    injectMainWorldScript();
    scanExistingMessages();
    setupObserver();
    console.log("[ZaloAudioPlayer] Content script running and monitoring audio attachments.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
