// ==UserScript==
// @name         Poridhi Lab Tracker
// @namespace    http://tampermonkey.net/
// @version      0.1.1
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
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 5px 12px;
            border-radius: 6px;
            border: 1.5px solid #484FA3;
            background: transparent;
            color: #484FA3;
            font-size: 13px;
            font-weight: 500;
            font-family: Montserrat, sans-serif;
            cursor: pointer;
            transition: all 0.15s ease;
            white-space: nowrap;
            flex-shrink: 0;
            z-index: 10;
            position: relative;
        }
        .pt-done-btn:hover {
            background: #484FA310;
        }
        .pt-done-btn.pt-done {
            background: #484FA3;
            color: #fff;
        }
        .pt-done-btn.pt-done:hover {
            background: #3a3f8a;
            border-color: #3a3f8a;
        }
        .pt-card-done {
            outline: 2px solid #484FA350 !important;
            background: #484FA308 !important;
        }
        .pt-progress {
            font-size: 12px;
            font-family: Montserrat, sans-serif;
            color: #484FA3;
            font-weight: 600;
            padding: 6px 0 2px 0;
        }
        .pt-done-overlay {
            position: absolute;
            top: 8px;
            right: 8px;
            background: #484FA3;
            color: #fff;
            font-size: 11px;
            font-family: Montserrat, sans-serif;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 4px;
            z-index: 20;
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);

    // ── Storage ───────────────────────────────────────────────────────────────
    function storageKey(title) {
        return 'pt_' + title.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }

    function isDone(title) {
        return GM_getValue(storageKey(title), false);
    }

    function toggleDone(title) {
        const next = !isDone(title);
        GM_setValue(storageKey(title), next);
        return next;
    }

    // ── Toggle button factory ─────────────────────────────────────────────────
    function makeBtn(title, onToggle) {
        const btn = document.createElement('button');
        const done = isDone(title);
        btn.className = 'pt-done-btn' + (done ? ' pt-done' : '');
        btn.textContent = done ? '✓ Done' : '○ Mark done';
        btn.title = title;

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const nowDone = toggleDone(title);
            btn.className = 'pt-done-btn' + (nowDone ? ' pt-done' : '');
            btn.textContent = nowDone ? '✓ Done' : '○ Mark done';
            if (onToggle) onToggle(nowDone);
        });

        return btn;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // MODULES PAGE  — URL: /lab-group-modules/{id}  (no second segment)
    // Card: div.rounded-[6px].bg-white.font-ibm
    // Title: h3
    // Button row: the parent of the "See All Labs" <button>
    // ══════════════════════════════════════════════════════════════════════════
    function injectModuleTrackers() {
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

            // "See All Labs" button — its parent is our insertion point
            const seeAllBtn = card.querySelector('button');
            if (!seeAllBtn) return;
            const btnContainer = seeAllBtn.parentElement;

            if (isDone(title)) {
                card.classList.add('pt-card-done');
                ensureOverlay(card);
            }

            const btn = makeBtn(title, (nowDone) => {
                card.classList.toggle('pt-card-done', nowDone);
                if (nowDone) ensureOverlay(card);
                else removeOverlay(card);
                updateModuleProgress();
            });

            btnContainer.appendChild(btn);
            injected++;
        });

        if (injected > 0) updateModuleProgress();
    }

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

    function updateModuleProgress() {
        const cards = document.querySelectorAll(
            'div.rounded-\\[6px\\].bg-white.font-ibm[data-pt]'
        );
        if (!cards.length) return;

        let done = 0;
        cards.forEach(card => {
            const title = card.querySelector('h3')?.textContent.trim();
            if (title && isDone(title)) done++;
        });

        let bar = document.getElementById('pt-progress-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'pt-progress-bar';
            bar.className = 'pt-progress';
            // Insert before the card grid
            const grid = cards[0]?.closest('[class*="grid"]');
            if (grid) grid.insertAdjacentElement('beforebegin', bar);
        }
        bar.textContent = `✓ Progress: ${done} / ${cards.length} modules completed`;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LABS PAGE  — URL: /lab-group-modules/{id}/{moduleId}
    // Card: div.rounded-[6px].bg-white  (contains a <dt> title)
    // Title: dt.text-base.font-semibold
    // Button row: div.flex.gap-2.items-center.w-full.font-montserrat
    // ══════════════════════════════════════════════════════════════════════════
    function injectLabTrackers() {
        // Lab cards are white rounded cards that contain a <dt> element (not font-ibm)
        const cards = document.querySelectorAll(
            'div.rounded-\\[6px\\].bg-white:not([data-pt]):not(.font-ibm)'
        );

        cards.forEach(card => {
            const titleEl = card.querySelector('dt');
            if (!titleEl) return;
            const title = titleEl.textContent.trim();
            if (!title) return;

            card.dataset.pt = '1';

            // Button row identified by exact Tailwind classes from the real HTML
            const btnRow = card.querySelector(
                'div.flex.gap-2.items-center.w-full.font-montserrat'
            );
            if (!btnRow) return;

            if (isDone(title)) {
                card.classList.add('pt-card-done');
                ensureOverlay(card);
            }

            const btn = makeBtn(title, (nowDone) => {
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
        // /lab-group-modules/ABC           → modules listing
        // /lab-group-modules/ABC/XYZ       → labs listing inside a module
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
        // Route change
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
