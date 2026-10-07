/**
 * Zalo Web Audio Player - Popup Settings Logic
 */
document.addEventListener("DOMContentLoaded", () => {
  const toggleEnabled = document.getElementById("toggle-enabled");
  const defaultSpeed = document.getElementById("default-speed");

  // Load current settings from chrome.storage
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get({ enabled: true, defaultSpeed: 1 }, (data) => {
      toggleEnabled.checked = data.enabled !== false;
      defaultSpeed.value = String(data.defaultSpeed || 1);
    });

    // Save toggle changes
    toggleEnabled.addEventListener("change", () => {
      chrome.storage.local.set({ enabled: toggleEnabled.checked });
    });

    // Save speed preference
    defaultSpeed.addEventListener("change", () => {
      chrome.storage.local.set({ defaultSpeed: parseFloat(defaultSpeed.value) || 1 });
    });
  }
});
