// ==UserScript==
// @name         Poridhi Lab Tracker
// @namespace    http://tampermonkey.net/
// @version      0.1.2
// @description  Mark labs and modules as done/incomplete on poridhi.io
// @author       Md. Saiful Islam Roni
// @match        https://poridhi.io/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
    'use strict';

    // ── Styles ───────────────────────────────────────────────────────────────
    const style = document.createElement('style');
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
    `;
    document.head.appendChild(style);

    // ── ID helpers ────────────────────────────────────────────────────────────
    // course_id  : raw first URL segment  e.g. "abc123"
    // module_id  : course_id + '_' + sanitized(moduleTitle)
    // lab_id     : sanitized(labTitle)
    function sanitizeId(text) {
        return text.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }

    function getCourseId() {
        const match = window.location.pathname.match(/\/lab-group-modules\/([^/]+)/);
        return match ? match[1] : null;
    }

    function buildModuleId(courseId, moduleTitle) {
        return courseId + '_' + sanitizeId(moduleTitle);
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

        const allDone = Object.keys(moduleData).length > 0
                     && Object.values(moduleData).every(v => v === true);
        const courseData = getCourseData(courseId);
        courseData[moduleId] = allDone;
        setCourseData(courseId, courseData);
        return next;
    }

    // ── Toggle button factory ─────────────────────────────────────────────────
    function makeBtn(done, onClick) {
        const btn = document.createElement('button');
        btn.className = 'pt-done-btn' + (done ? ' pt-done' : '');
        btn.textContent = '✓';
        btn.title = done ? 'Mark as incomplete' : 'Mark as done';

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick(btn);
        });

        return btn;
    }

    // ── Shared overlay helpers ────────────────────────────────────────────────
    function ensureOverlay(card) {
        if (!card.querySelector('.pt-done-overlay')) {
            const badge = document.createElement('div');
            badge.className = 'pt-done-overlay';
            badge.textContent = '✓ Done';
            card.appendChild(badge);
        }
    }

    function removeOverlay(card) {
        card.querySelector('.pt-done-overlay')?.remove();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // MODULES PAGE  — URL: /lab-group-modules/{courseId}
    // Done state is derived entirely from lab completion — no manual button.
    // Visual indication (border + badge) is preserved.
    // ══════════════════════════════════════════════════════════════════════════
    function injectModuleTrackers() {
        const courseId = getCourseId();
        if (!courseId) return;

        const cards = document.querySelectorAll(
            'div.rounded-\\[6px\\].bg-white.font-ibm:not([data-pt])'
        );

        let injected = 0;
        cards.forEach(card => {
            const titleEl = card.querySelector('h3');
            if (!titleEl) return;
            const title = titleEl.textContent.trim();
            if (!title) return;

            card.dataset.pt = '1';

            const moduleId = buildModuleId(courseId, title);
            if (isModuleDone(courseId, moduleId)) {
                card.classList.add('pt-card-done');
                ensureOverlay(card);
            }

            injected++;
        });

        if (injected > 0) updateModuleProgress(courseId);
    }

    function updateModuleProgress(courseId) {
        const cards = document.querySelectorAll(
            'div.rounded-\\[6px\\].bg-white.font-ibm[data-pt]'
        );
        if (!cards.length) return;

        const courseData = getCourseData(courseId);
        let done = 0;
        cards.forEach(card => {
            const title = card.querySelector('h3')?.textContent.trim();
            if (title && courseData[buildModuleId(courseId, title)]) done++;
        });

        let bar = document.getElementById('pt-progress-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'pt-progress-bar';
            bar.className = 'pt-progress';
            const grid = cards[0]?.closest('[class*="grid"]');
            if (grid) grid.insertAdjacentElement('beforebegin', bar);
        }
        bar.textContent = `✓ Progress: ${done} / ${cards.length} modules completed`;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LABS PAGE  — URL: /lab-group-modules/{courseId}/{moduleSegment}
    // Card: div.rounded-[6px].bg-white  (contains a <dt> title, not font-ibm)
    // Button row: div.flex.gap-2.items-center.w-full.font-montserrat
    // ══════════════════════════════════════════════════════════════════════════

    // Resolve module title from the page heading; fall back to the URL segment.
    // Both the modules page (h3 card title) and labs page heading must produce
    // the same text so that buildModuleId() returns a consistent key.
    function getModuleTitleOnLabsPage() {
        const headings = Array.from(document.querySelectorAll('h1, h2'));
        for (const h of headings) {
            if (h.closest('div.rounded-\\[6px\\].bg-white')) continue;
            const text = h.textContent.trim();
            if (text) return text;
        }
        // Fallback: URL segment (may differ from card title sanitization)
        const match = window.location.pathname.match(/\/lab-group-modules\/[^/]+\/([^/]+)/);
        return match ? decodeURIComponent(match[1]) : null;
    }

    function injectLabTrackers() {
        const courseId = getCourseId();
        if (!courseId) return;

        const moduleTitle = getModuleTitleOnLabsPage();
        if (!moduleTitle) return;
        const moduleId = buildModuleId(courseId, moduleTitle);

        const cards = document.querySelectorAll(
            'div.rounded-\\[6px\\].bg-white:not([data-pt]):not(.font-ibm)'
        );

        cards.forEach(card => {
            const titleEl = card.querySelector('dt');
            if (!titleEl) return;
            const title = titleEl.textContent.trim();
            if (!title) return;

            card.dataset.pt = '1';
            const labId = sanitizeId(title);

            const btnRow = card.querySelector(
                'div.flex.gap-2.items-center.w-full.font-montserrat'
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
                card.classList.add('pt-card-done');
                ensureOverlay(card);
            }

            const btn = makeBtn(done, (btn) => {
                const nowDone = toggleLab(courseId, moduleId, labId);
                btn.className = 'pt-done-btn' + (nowDone ? ' pt-done' : '');
                btn.title = nowDone ? 'Mark as incomplete' : 'Mark as done';
                card.classList.toggle('pt-card-done', nowDone);
                if (nowDone) ensureOverlay(card);
                else removeOverlay(card);
            });

            btnRow.appendChild(btn);
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Route detection & SPA watcher
    // ══════════════════════════════════════════════════════════════════════════
    function getPageType() {
        const match = window.location.pathname.match(
            /\/lab-group-modules\/([^/]+)(\/([^/]+))?/
        );
        if (!match) return null;
        return match[3] ? 'labs' : 'modules';
    }

    function run() {
        const type = getPageType();
        if (type === 'modules') setTimeout(injectModuleTrackers, 700);
        else if (type === 'labs') setTimeout(injectLabTrackers, 700);
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
            if (type === 'modules') injectModuleTrackers();
            else if (type === 'labs') injectLabTrackers();
        }, 500);
    }).observe(document.body, { childList: true, subtree: true });

})();
