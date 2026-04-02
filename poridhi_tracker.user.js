// ==UserScript==
// @name         Poridhi Lab Tracker
// @namespace    http://tampermonkey.net/
// @version      0.1.3-dev
// @description  Mark labs and modules as done/incomplete on poridhi.io
// @author       Md. Saiful Islam Roni
// @match        https://poridhi.io/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// ==/UserScript==

const API_HOST = "http://localhost:8787";

(function () {
  "use strict";

  const GM_KEYNAME_APIKEY = "api-key";
  const WHITELISTED_STATUS_CODES = [200, 404]; // 404 is expected for unregistered modules/labs

  // ---- MENU: SET SECRET ----
  GM_registerMenuCommand("Set API Key", () => {
    const key = prompt("Enter API Key:");
    if (key) {
      GM_setValue(GM_KEYNAME_APIKEY, key);
      alert("API Key saved");
    }
  });

  // ── Styles ───────────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
        .pt-done-btn {
            position: absolute;
            top: -15px;
            right: -15px;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 2px solid #484FA3;
            background: white;
            color: #484FA3;
            font-size: 16px;
            font-weight: 700;
            font-family: Montserrat, sans-serif;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            line-height: 1;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease, background 0.15s ease;
            z-index: 30;
        }
        [data-pt]:hover .pt-done-btn {
            opacity: 1;
            pointer-events: auto;
        }
        [data-pt]:hover .pt-done-overlay {
            opacity: 1;
        }
        .pt-done-btn:hover {
            background: #484FA3;
            color: #fff;
        }
        .pt-done-btn.pt-done {
            background: #484FA3;
            color: #fff;
            border-color: #484FA3;
        }
        .pt-done-btn.pt-done:hover {
            background: #3a3f8a;
            border-color: #3a3f8a;
        }
        .pt-card-done {
            outline: 2px solid #484FA3 !important;
            background: #484FA305 !important;
        }
        .pt-progress {
            font-size: 12px;
            font-family: Montserrat, sans-serif;
            color: #484FA3;
            font-weight: 600;
            padding: 6px 0 2px 0;
            margin-bottom: 10px;
        }
        .pt-done-overlay {
            position: absolute;
            top: 8px;
            left: 8px;
            background: #484FA3;
            color: #fff;
            font-size: 11px;
            font-family: Montserrat, sans-serif;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 4px;
            z-index: 20;
            pointer-events: none;
            opacity: 0;
        }
        .pt-sync-banner {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.8);
            color: #3a3d69;
            font-size: 12px;
            font-family: Montserrat, sans-serif;
            font-weight: 400;
            padding: 8px 14px;
            border-radius: 8px;
            border-left: 3px solid #e06c6c;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
            z-index: 99999;
            max-width: 300px;
            backdrop-filter: blur(4px);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease;
        }
        .pt-sync-banner.pt-visible {
            opacity: 1;
        }
    `;
  document.head.appendChild(style);

  // ── ID helpers ────────────────────────────────────────────────────────────
  // course_id  : raw first URL segment  e.g. "abc123"
  // module_id  : raw second URL segment (labs page URL only)
  // lab_id     : sanitized(labTitle)
  function sanitizeId(text) {
    return text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
  }

  function getCourseId() {
    const match = window.location.pathname.match(
      /\/lab-group-modules\/([^/]+)/,
    );
    return match ? match[1] : null;
  }

  function getModuleIdFromUrl() {
    const match = window.location.pathname.match(
      /\/lab-group-modules\/[^/]+\/([^/]+)/,
    );
    return match ? match[1] : null;
  }

  // ── Storage helpers ───────────────────────────────────────────────────────
  // Module labs data  — key: moduleId  → value: { [labId]: bool, … }
  function getModuleData(moduleId) {
    return GM_getValue(moduleId, {});
  }
  function setModuleData(moduleId, data) {
    GM_setValue(moduleId, data);
  }

  // Course modules data — key: courseId → value: { [moduleId]: bool, … }
  function getCourseData(courseId) {
    return GM_getValue(courseId, {});
  }
  function setCourseData(courseId, data) {
    GM_setValue(courseId, data);
  }

  const GM_KEYNAME_MODULE_MAP = "moduleNameIdMap";
  function getModuleNameIdMap(courseId) {
    const mnm = GM_getValue(GM_KEYNAME_MODULE_MAP, {});
    return mnm[courseId] ?? {};
  }
  function setModuleNameIdMap(courseId, map) {
    const existing = GM_getValue(GM_KEYNAME_MODULE_MAP, {});
    const next = {
      ...existing,
      [courseId]: map,
    };
    GM_setValue(GM_KEYNAME_MODULE_MAP, next);
  }

  function parseJsonSafe(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function getErrorMessage(err) {
    if (!err) return "Unknown error";
    if (typeof err === "string") return err;
    if (typeof err.message === "string" && err.message.trim())
      return err.message;
    return "Unknown error";
  }

  function upsertModuleTitleKeyMapping(map, moduleId, titleKey) {
    if (!titleKey) return false;
    const existingKey = Object.keys(map).find((k) => map[k] === moduleId);
    if (existingKey === titleKey && map[titleKey] === moduleId) return false;
    if (existingKey && existingKey !== titleKey) {
      delete map[existingKey];
    }
    if (map[titleKey] !== moduleId) {
      map[titleKey] = moduleId;
      return true;
    }
    return false;
  }

  function normalizeServerModuleInfo(info) {
    if (!info || typeof info !== "object") {
      return { done: false, titleKey: undefined };
    }
    return {
      done: info.done === true,
      titleKey:
        typeof info.titleKey === "string" && info.titleKey.trim()
          ? info.titleKey
          : undefined,
    };
  }

  function isLabDone(moduleId, labId) {
    return !!getModuleData(moduleId)[labId];
  }

  function isModuleDone(courseId, moduleId) {
    return !!getCourseData(courseId)[moduleId];
  }

  // Toggle a lab and propagate all-done status up to the course record
  function toggleLab(courseId, moduleId, labId) {
    const moduleData = getModuleData(moduleId);
    const next = !moduleData[labId];
    moduleData[labId] = next;
    setModuleData(moduleId, moduleData);

    const allDone =
      Object.keys(moduleData).length > 0 &&
      Object.values(moduleData).every((v) => v === true);
    const courseData = getCourseData(courseId);
    courseData[moduleId] = allDone;
    setCourseData(courseId, courseData);
    return next;
  }

  // ── API helpers ────────────────────────────────────────────────────────────
  let _lastSyncedPath = null;

  function apiRequest(method, path, body) {
    const apiKey = GM_getValue(GM_KEYNAME_APIKEY, "");
    if (!apiKey) return Promise.reject(new Error("API key not set"));
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url: API_HOST + path,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        data: body ? JSON.stringify(body) : undefined,
        onload(res) {
          resolve({
            status: res.status,
            data: parseJsonSafe(res.responseText),
          });
        },
        onerror(err) {
          reject(err);
        },
      });
    });
  }

  function showSyncNotification(msg) {
    console.error("[Poridhi Tracker]", msg);
    let banner = document.getElementById("pt-sync-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "pt-sync-banner";
      banner.className = "pt-sync-banner";
      document.body.appendChild(banner);
    }
    banner.textContent = msg;
    clearTimeout(banner._hideTimer);
    banner.classList.add("pt-visible");
    banner._hideTimer = setTimeout(() => {
      banner.classList.remove("pt-visible");
    }, 4000);
  }

  async function syncModulesFromApi(courseId) {
    try {
      const { status, data } = await apiRequest(
        "GET",
        `/course/${courseId}/modules`,
      );
      if (!WHITELISTED_STATUS_CODES.includes(status)) {
        showSyncNotification(`Failed to sync module status: HTTP ${status}`);
        return;
      }
      if (data) {
        const moduleNameIdMap = { ...getModuleNameIdMap(courseId) };
        const localData = getCourseData(courseId);
        const serverModules =
          typeof data === "object" && data !== null ? data : {};

        const unsyncedModules = Object.keys(localData).filter(
          (local) => serverModules[local] === undefined,
        );
        unsyncedModules.forEach((moduleId) => {
          delete localData[moduleId];
        });

        let changed = unsyncedModules.length > 0;
        for (const [moduleId, info] of Object.entries(serverModules)) {
          const { titleKey, done } = normalizeServerModuleInfo(info);
          if (localData[moduleId] !== done) {
            localData[moduleId] = done;
            changed = true;
          }
          if (
            upsertModuleTitleKeyMapping(moduleNameIdMap, moduleId, titleKey)
          ) {
            changed = true;
          }
        }

        if (changed) {
          setCourseData(courseId, localData);
          setModuleNameIdMap(courseId, moduleNameIdMap);
          rerenderModuleCards(courseId);
        }
      }
    } catch (err) {
      const message = getErrorMessage(err);
      showSyncNotification(`Failed to sync module status: ${message}`);
    }
  }

  async function syncLabsFromApi(courseId, moduleId) {
    try {
      const { status, data } = await apiRequest(
        "GET",
        `/modules/${moduleId}/labs`,
      );
      if (!WHITELISTED_STATUS_CODES.includes(status)) {
        showSyncNotification(`Failed to sync lab status: HTTP ${status}`);
        return;
      }
      if (data) {
        const localData = getModuleData(moduleId);
        const serverLabs =
          typeof data === "object" && data !== null ? data : {};

        const unsyncedLabs = Object.keys(localData).filter(
          (local) =>
            serverLabs[local] === undefined ||
            typeof serverLabs[local] !== "boolean",
        );
        unsyncedLabs.forEach((labId) => {
          delete localData[labId];
        });

        let changed = unsyncedLabs.length > 0;
        for (const [labId, done] of Object.entries(serverLabs)) {
          if (typeof done !== "boolean") continue;
          if (localData[labId] !== done) {
            localData[labId] = done;
            changed = true;
          }
        }
        if (changed) {
          setModuleData(moduleId, localData);
          const allDone =
            Object.keys(localData).length > 0 &&
            Object.values(localData).every((v) => v === true);
          const courseData = getCourseData(courseId);
          courseData[moduleId] = allDone;
          setCourseData(courseId, courseData);
          rerenderLabCards(moduleId);
        }
      }
    } catch (err) {
      const message = getErrorMessage(err);
      showSyncNotification(`Failed to sync lab status: ${message}`);
    }
  }

  async function postLabUpdate(courseId, moduleId, labId, done) {
    try {
      const moduleData = getModuleData(moduleId);
      moduleData[labId] = done;
      const payload = Object.entries(moduleData).map(([id, d]) => ({
        labId: id,
        done: d,
      }));
      await apiRequest(
        "POST",
        `/course/${courseId}/modules/${moduleId}/labs`,
        payload,
      );
    } catch (err) {
      showSyncNotification("Failed to sync lab status with server");
    }
  }

  async function postModuleTitleKeyUpdate(courseId, moduleId, titleKey) {
    try {
      const payload = { titleKey };
      await apiRequest(
        "POST",
        `/course/${courseId}/modules/${moduleId}/title`,
        payload,
      );
    } catch (err) {
      showSyncNotification("Failed to sync module title with server");
    }
  }

  // ── moduleNameIdMap updater ───────────────────────────────────────────────
  // Polls every 100 ms for a non-empty h1 outside of a card, then stores
  // sanitized(h1Text) → moduleId in moduleNameIdMap and syncs titleKey to API.
  // One poller per URL.
  let _moduleMapUpdaterPath = null;
  function startModuleNameIdMapUpdater(courseId, moduleId) {
    if (_moduleMapUpdaterPath === location.pathname) return;
    _moduleMapUpdaterPath = location.pathname;
    const startedAt = Date.now();
    const intervalId = setInterval(() => {
      // Stop polling after 25s on pages where header may not load as expected.
      if (Date.now() - startedAt > 25000) {
        clearInterval(intervalId);
        return;
      }
      console.log("[Poridhi Tracker] Polling for module title...");
      const h1El = Array.from(document.querySelectorAll("h1")).find(
        (h) => !h.closest("div.rounded-\\[6px\\].bg-white"),
      );
      if (!h1El) return;
      const text = h1El.textContent.trim();
      if (!text) return;
      clearInterval(intervalId);
      const key = sanitizeId(text);
      const map = { ...getModuleNameIdMap(courseId) };
      postModuleTitleKeyUpdate(courseId, moduleId, key);
      // each moduleId may only be associated with one title key
      const existingKey = Object.keys(map).find((k) => map[k] === moduleId);
      if (existingKey === key) return; // already correctly mapped
      if (existingKey) delete map[existingKey];
      map[key] = moduleId;
      setModuleNameIdMap(courseId, map);
    }, 100);
  }

  function rerenderModuleCards(courseId) {
    const map = getModuleNameIdMap(courseId);
    const cards = document.querySelectorAll(
      "div.rounded-\\[6px\\].bg-white.font-ibm[data-pt]",
    );
    cards.forEach((card) => {
      const title = card.querySelector("h3")?.textContent.trim();
      if (!title) return;
      const moduleId = map[sanitizeId(title)];
      if (!moduleId) return;
      const done = isModuleDone(courseId, moduleId);
      card.classList.toggle("pt-card-done", done);
      if (done) ensureOverlay(card);
      else removeOverlay(card);
    });
    updateModuleProgress(courseId);
  }

  function rerenderLabCards(moduleId) {
    const cards = document.querySelectorAll(
      "div.rounded-\\[6px\\].bg-white[data-pt]:not(.font-ibm)",
    );
    cards.forEach((card) => {
      const titleEl = card.querySelector("dt");
      if (!titleEl) return;
      const labId = sanitizeId(titleEl.textContent.trim());
      if (!labId) return;
      const done = isLabDone(moduleId, labId);
      card.classList.toggle("pt-card-done", done);
      if (done) ensureOverlay(card);
      else removeOverlay(card);
      const btn = card.querySelector(".pt-done-btn");
      if (btn) {
        btn.className = "pt-done-btn" + (done ? " pt-done" : "");
        btn.title = done ? "Mark as incomplete" : "Mark as done";
      }
    });
  }

  // ── Toggle button factory ─────────────────────────────────────────────────
  function makeBtn(done, onClick) {
    const btn = document.createElement("button");
    btn.className = "pt-done-btn" + (done ? " pt-done" : "");
    btn.textContent = "✓";
    btn.title = done ? "Mark as incomplete" : "Mark as done";

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(btn);
    });

    return btn;
  }

  // ── Shared overlay helpers ────────────────────────────────────────────────
  function ensureOverlay(card) {
    if (!card.querySelector(".pt-done-overlay")) {
      const badge = document.createElement("div");
      badge.className = "pt-done-overlay";
      badge.textContent = "✓ Done";
      card.appendChild(badge);
    }
  }

  function removeOverlay(card) {
    card.querySelector(".pt-done-overlay")?.remove();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODULES PAGE  — URL: /lab-group-modules/{courseId}
  // Done state is derived entirely from lab completion — no manual button.
  // Visual indication (border + badge) is preserved.
  // ══════════════════════════════════════════════════════════════════════════
  function injectModuleTrackers() {
    const courseId = getCourseId();
    if (!courseId) return;

    const map = getModuleNameIdMap(courseId);
    const cards = document.querySelectorAll(
      "div.rounded-\\[6px\\].bg-white.font-ibm:not([data-pt])",
    );

    let injected = 0;
    cards.forEach((card) => {
      const titleEl = card.querySelector("h3");
      if (!titleEl) return;
      const title = titleEl.textContent.trim();
      if (!title) return;

      card.dataset.pt = "1";

      const moduleId = map[sanitizeId(title)];
      if (moduleId && isModuleDone(courseId, moduleId)) {
        card.classList.add("pt-card-done");
        ensureOverlay(card);
      }

      injected++;
    });

    if (injected > 0) updateModuleProgress(courseId);

    if (injected > 0 && _lastSyncedPath !== location.pathname) {
      _lastSyncedPath = location.pathname;
      syncModulesFromApi(courseId);
    }
  }

  function updateModuleProgress(courseId) {
    const cards = document.querySelectorAll(
      "div.rounded-\\[6px\\].bg-white.font-ibm[data-pt]",
    );
    if (!cards.length) return;

    const map = getModuleNameIdMap(courseId);
    const courseData = getCourseData(courseId);
    let done = 0;
    cards.forEach((card) => {
      const title = card.querySelector("h3")?.textContent.trim();
      if (!title) return;
      const moduleId = map[sanitizeId(title)];
      if (moduleId && courseData[moduleId]) done++;
    });

    let bar = document.getElementById("pt-progress-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "pt-progress-bar";
      bar.className = "pt-progress";
      const grid = cards[0]?.closest('[class*="grid"]');
      if (grid) grid.insertAdjacentElement("beforebegin", bar);
    }
    bar.textContent = `✓ Progress: ${done} / ${cards.length} modules completed`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LABS PAGE  — URL: /lab-group-modules/{courseId}/{moduleSegment}
  // Card: div.rounded-[6px].bg-white  (contains a <dt> title, not font-ibm)
  // Button row: div.flex.gap-2.items-center.w-full.font-montserrat
  // ══════════════════════════════════════════════════════════════════════════

  function injectLabTrackers() {
    const courseId = getCourseId();
    if (!courseId) return;

    const moduleId = getModuleIdFromUrl();
    if (!moduleId) return;

    startModuleNameIdMapUpdater(courseId, moduleId);

    const cards = document.querySelectorAll(
      "div.rounded-\\[6px\\].bg-white:not([data-pt]):not(.font-ibm)",
    );

    cards.forEach((card) => {
      const titleEl = card.querySelector("dt");
      if (!titleEl) return;
      const title = titleEl.textContent.trim();
      if (!title) return;

      card.dataset.pt = "1";
      const labId = sanitizeId(title);

      const btnRow = card.querySelector(
        "div.flex.gap-2.items-center.w-full.font-montserrat",
      );
      if (!btnRow) return;

      // Register lab in module data with false if not yet seen
      const moduleData = getModuleData(moduleId);
      if (!(labId in moduleData)) {
        moduleData[labId] = false;
        setModuleData(moduleId, moduleData);
      }

      const done = isLabDone(moduleId, labId);
      if (done) {
        card.classList.add("pt-card-done");
        ensureOverlay(card);
      }

      const btn = makeBtn(done, (btn) => {
        const nowDone = toggleLab(courseId, moduleId, labId);
        btn.className = "pt-done-btn" + (nowDone ? " pt-done" : "");
        btn.title = nowDone ? "Mark as incomplete" : "Mark as done";
        card.classList.toggle("pt-card-done", nowDone);
        if (nowDone) ensureOverlay(card);
        else removeOverlay(card);
        postLabUpdate(courseId, moduleId, labId, nowDone);
      });

      btnRow.appendChild(btn);
    });

    if (cards.length > 0 && _lastSyncedPath !== location.pathname) {
      _lastSyncedPath = location.pathname;
      syncLabsFromApi(courseId, moduleId);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Route detection & SPA watcher
  // ══════════════════════════════════════════════════════════════════════════
  function getPageType() {
    const match = window.location.pathname.match(
      /\/lab-group-modules\/([^/]+)(\/([^/]+))?/,
    );
    if (!match) return null;
    return match[3] ? "labs" : "modules";
  }

  function run() {
    const type = getPageType();
    if (type === "modules") setTimeout(injectModuleTrackers, 700);
    else if (type === "labs") setTimeout(injectLabTrackers, 700);
  }

  run();

  // Watch for SPA route changes (React router)
  let lastPath = location.pathname;
  let debounce;
  new MutationObserver(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      run();
      return;
    }
    // Same page — re-scan for lazy-loaded cards
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const type = getPageType();
      if (type === "modules") injectModuleTrackers();
      else if (type === "labs") injectLabTrackers();
    }, 500);
  }).observe(document.body, { childList: true, subtree: true });
})();
