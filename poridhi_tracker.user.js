// ==UserScript==
// @name         Poridhi Lab Tracker
// @namespace    http://tampermonkey.net/
// @version      0.1.5
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

  GM_registerMenuCommand("Log Tracker State", () => {
    const courseId = getCourseId();
    const map = getModuleNameIdMap(courseId);
    const courseData = getCourseData(courseId);
    console.log("[Poridhi Tracker]", { courseId, map, courseData });

    const cards = document.querySelectorAll(
      "div.rounded-\\[6px\\].bg-white.font-ibm",
    );
    console.table(
      Array.from(cards).map((card) => {
        const title = card.querySelector("h3")?.textContent.trim() ?? "";
        const titleKey = sanitizeId(title);
        const linkedId = getModuleIdFromCard(card, courseId);
        const moduleId = linkedId ?? map[titleKey];
        return {
          title,
          titleKey,
          linkedId,
          mappedId: map[titleKey] ?? null,
          done: !!(moduleId && courseData[moduleId]),
          visible: card.getClientRects().length > 0,
        };
      }),
    );
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

  // The modules page never renders a module id, but each card links to its
  // labs page (/lab-group-modules/{courseId}/{moduleId}) — an exact id, unlike
  // matching the card title against a title→id map built on another page.
  function getModuleIdFromCard(card, courseId) {
    const links = Array.from(card.querySelectorAll("a[href]"));
    const wrapper = card.closest("a[href]");
    if (wrapper) links.push(wrapper);

    for (const link of links) {
      let pathname;
      try {
        pathname = new URL(link.href, location.origin).pathname;
      } catch {
        continue;
      }
      const match = pathname.match(/\/lab-group-modules\/([^/]+)\/([^/]+)/);
      if (match && match[1] === courseId) return match[2];
    }
    return null;
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

  function isPlainObject(value) {
    return (
      typeof value === "object" && value !== null && !Array.isArray(value)
    );
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
    if (typeof err.message === "string" && err.message.trim()) {
      return err.message;
    }
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

  // Module completion is derived from its labs, so recompute it from local lab
  // data rather than tracking it separately — a course record that lost the
  // flag then heals on the next labs-page visit.
  function recomputeModuleDone(courseId, moduleId) {
    const moduleData = getModuleData(moduleId);
    const allDone =
      Object.keys(moduleData).length > 0 &&
      Object.values(moduleData).every((v) => v === true);
    const courseData = getCourseData(courseId);
    if (courseData[moduleId] !== allDone) {
      courseData[moduleId] = allDone;
      setCourseData(courseId, courseData);
    }
    return allDone;
  }

  function toggleLab(courseId, moduleId, labId) {
    const moduleData = getModuleData(moduleId);
    const next = !moduleData[labId];
    moduleData[labId] = next;
    setModuleData(moduleId, moduleData);
    recomputeModuleDone(courseId, moduleId);
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
      // A 404 body is `{ status, error }`, not a module map — reading it as
      // one prunes every local module and writes its keys in as module ids.
      if (status === 404) return;
      if (isPlainObject(data)) {
        const serverModules = data;
        if (
          Object.values(serverModules).some((info) => !isPlainObject(info))
        ) {
          showSyncNotification("Unexpected module payload; skipped sync");
          return;
        }

        const moduleNameIdMap = { ...getModuleNameIdMap(courseId) };
        const localData = getCourseData(courseId);

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
          // Card links outrank a stored key, so only fill in modules that
          // have no local mapping yet.
          const mapped = Object.values(moduleNameIdMap).includes(moduleId);
          if (
            !mapped &&
            upsertModuleTitleKeyMapping(moduleNameIdMap, moduleId, titleKey)
          ) {
            changed = true;
          }
        }

        if (changed) {
          setCourseData(courseId, localData);
          setModuleNameIdMap(courseId, moduleNameIdMap);
          syncModuleCards(courseId);
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
      // A 404 body is `{ status, error }`, not a lab map — reading it as one
      // prunes every local lab and clears the module's completion flag.
      if (status === 404) return;
      if (isPlainObject(data)) {
        const serverLabs = data;
        if (Object.values(serverLabs).some((v) => typeof v !== "boolean")) {
          showSyncNotification("Unexpected lab payload; skipped sync");
          return;
        }

        const localData = getModuleData(moduleId);
        const unsyncedLabs = Object.keys(localData).filter(
          (local) => serverLabs[local] === undefined,
        );
        unsyncedLabs.forEach((labId) => {
          delete localData[labId];
        });

        let changed = unsyncedLabs.length > 0;
        for (const [labId, done] of Object.entries(serverLabs)) {
          if (localData[labId] !== done) {
            localData[labId] = done;
            changed = true;
          }
        }
        if (changed) {
          setModuleData(moduleId, localData);
          recomputeModuleDone(courseId, moduleId);
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
      // Bootstrap only. This heading can be the course title rather than the
      // module's, and one key holds one module — writing it over an existing
      // mapping silently unmaps whichever module owned it.
      const existingKey = Object.keys(map).find((k) => map[k] === moduleId);
      if (existingKey) return;
      if (map[key] && map[key] !== moduleId) return;
      map[key] = moduleId;
      setModuleNameIdMap(courseId, map);
      postModuleTitleKeyUpdate(courseId, moduleId, key);
    }, 100);
  }

  // Stamps done state and counts progress in one pass, so the progress bar can
  // never disagree with the outlines drawn on the cards.
  // Runs over already-tagged cards too: React recycles card nodes when the
  // search filter changes, keeping [data-pt] while swapping in another module.
  function syncModuleCards(courseId) {
    const map = getModuleNameIdMap(courseId);
    const courseData = getCourseData(courseId);
    const cards = document.querySelectorAll(
      "div.rounded-\\[6px\\].bg-white.font-ibm",
    );

    const nextMap = { ...map };
    let mapChanged = false;
    const stamped = [];
    cards.forEach((card) => {
      const title = card.querySelector("h3")?.textContent.trim();
      if (!title) return;
      if (!card.dataset.pt) card.dataset.pt = "1";

      // A card link gives the id outright; the title map is the fallback for
      // when the site stops linking cards. Re-key the map off the title shown
      // here, so a card whose labs-page heading reads differently still
      // resolves and the server learns the corrected key.
      const titleKey = sanitizeId(title);
      const linkedId = getModuleIdFromCard(card, courseId);
      // Two cards can carry the same title; first one claims the key, or the
      // pair would trade it back and forth on every pass.
      const keyOwner = nextMap[titleKey];
      if (
        linkedId &&
        (!keyOwner || keyOwner === linkedId) &&
        upsertModuleTitleKeyMapping(nextMap, linkedId, titleKey)
      ) {
        mapChanged = true;
        postModuleTitleKeyUpdate(courseId, linkedId, titleKey);
      }

      const moduleId = linkedId ?? map[titleKey];
      const isDone = !!(moduleId && courseData[moduleId]);
      card.classList.toggle("pt-card-done", isDone);
      if (isDone) ensureOverlay(card);
      else removeOverlay(card);
      stamped.push({ card, isDone });
    });

    // Counted after every write above so the reads below flush layout once.
    // An empty rect list means the search filter hid the card via display:none
    // or React has already detached the node.
    let visible = 0;
    let done = 0;
    stamped.forEach(({ card, isDone }) => {
      if (!card.getClientRects().length) return;
      visible++;
      if (isDone) done++;
    });

    if (mapChanged) setModuleNameIdMap(courseId, nextMap);
    if (cards.length) renderModuleProgress(cards[0], done, visible);
    return cards.length;
  }

  function renderModuleProgress(anchorCard, done, total) {
    const bars = document.querySelectorAll("#pt-progress-bar");
    for (let i = 1; i < bars.length; i++) bars[i].remove();

    const bar = bars[0] ?? document.createElement("div");
    bar.id = "pt-progress-bar";
    bar.className = "pt-progress";

    const grid = anchorCard.closest('[class*="grid"]');
    if (grid && bar.nextElementSibling !== grid) {
      grid.insertAdjacentElement("beforebegin", bar);
    }
    // Only write on change: the page-wide MutationObserver re-runs this pass,
    // and an unconditional write makes it retrigger itself forever.
    const text = `✓ Progress: ${done} / ${total} modules completed`;
    if (bar.textContent !== text) bar.textContent = text;
  }

  // The site rebuilds the filtered grid asynchronously, so one pass on the
  // debounced input event can read a half-updated list. Re-check while it
  // settles; each pass is idempotent.
  function resyncModuleCards(courseId) {
    [0, 150, 400, 800, 1500].forEach((delay) =>
      setTimeout(() => syncModuleCards(courseId), delay),
    );
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

  // Attaches a debounced "input" listener to the search box so that any
  // keystroke that changes the visible card count triggers a re-render.
  // Safe to call repeatedly — the listener is only attached once per element
  // (guarded by data-pt-search on the input node).
  function watchSearchInput(onSearch) {
    const input = document.querySelector('input[placeholder="Search"]');
    if (!input || input.dataset.ptSearch) return;
    input.dataset.ptSearch = "1";
    let searchDebounce;
    input.addEventListener("input", () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(onSearch, 300);
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODULES PAGE  — URL: /lab-group-modules/{courseId}
  // Done state is derived entirely from lab completion — no manual button.
  // Visual indication (border + badge) is preserved.
  // ══════════════════════════════════════════════════════════════════════════
  function injectModuleTrackers() {
    const courseId = getCourseId();
    if (!courseId) return;

    const cardCount = syncModuleCards(courseId);

    if (cardCount > 0 && _lastSyncedPath !== location.pathname) {
      _lastSyncedPath = location.pathname;
      syncModulesFromApi(courseId);
    }

    watchSearchInput(() => resyncModuleCards(courseId));
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

    if (cards.length > 0) recomputeModuleDone(courseId, moduleId);

    if (cards.length > 0 && _lastSyncedPath !== location.pathname) {
      _lastSyncedPath = location.pathname;
      syncLabsFromApi(courseId, moduleId);
    }

    // Re-run whenever the search input changes so overlays and buttons are
    // injected on newly visible lab cards after filtering.
    // rerenderLabCards() re-stamps pt-card-done and the button state on any
    // already-tagged card whose DOM node React recycled during the re-render.
    watchSearchInput(() => {
      injectLabTrackers();
      rerenderLabCards(moduleId);
    });
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
