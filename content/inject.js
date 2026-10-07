/**
 * Zalo Web Online Audio Player - Main World Injected Script
 * Runs in the webpage execution context (MAIN world) to intercept audio blob downloads
 * and safely pass audio streams to the inline audio player without downloading to disk.
 */
(function() {
  "use strict";

  if (window.__zaloAudioPlayerInjected) return;
  window.__zaloAudioPlayerInjected = true;

  // Active play requests: msgId -> { fileName, timestamp }
  window.__zaloAudioPendingPlay = null;

  const AUDIO_EXTENSIONS = [
    ".m4a", ".mp3", ".wav", ".aac", ".ogg",
    ".flac", ".opus", ".m4r", ".weba", ".wma"
  ];

  function isAudioFileName(name) {
    if (!name || typeof name !== "string") return false;
    const lower = name.toLowerCase().trim();
    return AUDIO_EXTENSIONS.some(ext => lower.endsWith(ext));
  }

  // Intercept HTMLAnchorElement.prototype.click
  const originalAnchorClick = HTMLAnchorElement.prototype.click;

  HTMLAnchorElement.prototype.click = function() {
    try {
      const href = this.href || this.getAttribute("href") || "";
      const downloadAttr = this.getAttribute("download") || this.download || "";
      const pending = window.__zaloAudioPendingPlay;

      // Check if this download is triggered by an active audio play request
      const isAudio = isAudioFileName(downloadAttr) || (pending && isAudioFileName(pending.fileName));

      if (pending && isAudio) {
        // Prevent browser download
        window.__zaloAudioPendingPlay = null;

        // Dispatch captured blob to content script
        window.dispatchEvent(new CustomEvent("__zalo_audio_blob_captured__", {
          detail: {
            blobUrl: href,
            fileName: downloadAttr || pending.fileName,
            msgId: pending.msgId
          }
        }));

        // Do not call originalAnchorClick, stopping disk save!
        return;
      }
    } catch (err) {
      console.warn("[ZaloAudioPlayer] Error in click interceptor:", err);
    }

    // Default behavior for normal downloads
    return originalAnchorClick.apply(this, arguments);
  };

  // Listen for request from content script to trigger play
  window.addEventListener("__zalo_audio_request_play__", function(e) {
    const detail = e.detail || {};
    const { msgId, fileName } = detail;

    window.__zaloAudioPendingPlay = {
      msgId,
      fileName,
      timestamp: Date.now()
    };

    // Auto-timeout pending play after 30 seconds to avoid hanging
    setTimeout(() => {
      if (window.__zaloAudioPendingPlay && window.__zaloAudioPendingPlay.msgId === msgId) {
        window.__zaloAudioPendingPlay = null;
        window.dispatchEvent(new CustomEvent("__zalo_audio_error__", {
          detail: { msgId, error: "TIMEOUT" }
        }));
      }
    }, 30000);
  });

  // Cancel pending play if user cancels
  window.addEventListener("__zalo_audio_cancel_play__", function(e) {
    window.__zaloAudioPendingPlay = null;
  });

  console.log("[ZaloAudioPlayer] Injected interceptor initialized.");
})();
