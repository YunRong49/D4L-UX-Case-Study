/*
  Data4Life eConsent prototype — shared state, progress, and interaction helpers.
  No framework, no backend: state lives in localStorage for the length of a browser session.
*/

(function () {
  'use strict';

  var STORAGE_KEY = 'd4l-econsent:v1';

  var defaultState = {
    toggles: { reuseData: false, contactMe: false, shareResults: false },
    privacyAck: false,
    confirmAck: false,
    signatureDrawn: false,
    submitted: false
  };

  function loadState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaultState));
      var parsed = JSON.parse(raw);
      return Object.assign(JSON.parse(JSON.stringify(defaultState)), parsed, {
        toggles: Object.assign({}, defaultState.toggles, parsed.toggles || {})
      });
    } catch (e) {
      return JSON.parse(JSON.stringify(defaultState));
    }
  }

  var state = loadState();

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* localStorage unavailable (private mode, etc.) — state stays in-memory only */
    }
  }

  function setState(patch) {
    Object.assign(state, patch);
    saveState();
  }

  /* ── Progress indicator ──────────────────────────────────── */
  /* Figma's source mislabels the Confirm & Submit screen "STEP 3 OF 4" —
     corrected here to 4 of 4, per DESIGN_BRIEF.md Experience Principle 3. */

  function initProgress(root, step, total, label) {
    var stepEl = root.querySelector('.progress__step');
    var labelEl = root.querySelector('.progress__label');
    var fillEl = root.querySelector('.progress__fill');
    if (stepEl) stepEl.textContent = 'STEP ' + step + ' OF ' + total;
    if (labelEl) labelEl.textContent = label;
    if (fillEl) fillEl.style.width = Math.round((step / total) * 100) + '%';
  }

  /* ── Gated buttons ───────────────────────────────────────── */
  /* conditionFn() -> true means the button may be used. Keeps a visually
     hidden hint in sync so screen readers know why a button is inert. */

  function bindGate(buttonEl, hintEl, conditionFn) {
    function refresh() {
      var ok = conditionFn();
      buttonEl.disabled = !ok;
      buttonEl.setAttribute('aria-disabled', String(!ok));
      if (hintEl) hintEl.hidden = ok;
    }
    refresh();
    return refresh;
  }

  /* ── Checkbox ────────────────────────────────────────────── */

  function bindCheckbox(el, stateKey, onChange) {
    function apply(checked) {
      el.setAttribute('aria-checked', String(checked));
      var patch = {};
      patch[stateKey] = checked;
      setState(patch);
      if (onChange) onChange(checked);
    }

    apply(!!state[stateKey]);

    el.addEventListener('click', function () {
      apply(el.getAttribute('aria-checked') !== 'true');
    });

    el.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        apply(el.getAttribute('aria-checked') !== 'true');
      }
    });
  }

  /* ── Toggle switch ───────────────────────────────────────── */

  function bindToggle(el, stateKey, onChange) {
    function apply(checked) {
      el.setAttribute('aria-checked', String(checked));
      state.toggles[stateKey] = checked;
      saveState();
      if (onChange) onChange(checked);
    }

    apply(!!state.toggles[stateKey]);

    el.addEventListener('click', function () {
      apply(el.getAttribute('aria-checked') !== 'true');
    });

    el.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        apply(el.getAttribute('aria-checked') !== 'true');
      }
    });
  }

  /* ── Signature pad ───────────────────────────────────────── */
  /* Pointer + touch drawing on a canvas. The checkbox (bindCheckbox above)
     remains the real gating condition per the brief — this only tracks
     whether a mark exists, for the Submit button's second gate. */

  function initSignaturePad(padEl) {
    var canvas = padEl.querySelector('canvas');
    var ctx = canvas.getContext('2d');
    var drawing = false;
    var hasDrawn = !!state.signatureDrawn;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      var ratio = window.devicePixelRatio || 1;
      var prevDrawing = ctx.getImageData ? null : null;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary') || '#1b1c1c';
    }

    resize();
    window.addEventListener('resize', resize);

    function markDrawn() {
      if (hasDrawn) return;
      hasDrawn = true;
      padEl.setAttribute('data-drawn', 'true');
      setState({ signatureDrawn: true });
      padEl.dispatchEvent(new CustomEvent('signature-change'));
    }

    function pointFromEvent(e) {
      var rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    canvas.addEventListener('pointerdown', function (e) {
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      var p = pointFromEvent(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    });

    canvas.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      var p = pointFromEvent(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      markDrawn();
    });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (evt) {
      canvas.addEventListener(evt, function () {
        drawing = false;
      });
    });

    if (hasDrawn) padEl.setAttribute('data-drawn', 'true');

    return {
      isDrawn: function () {
        return hasDrawn;
      },
      clear: function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasDrawn = false;
        padEl.removeAttribute('data-drawn');
        setState({ signatureDrawn: false });
        padEl.dispatchEvent(new CustomEvent('signature-change'));
      }
    };
  }

  window.D4L = {
    state: state,
    setState: setState,
    initProgress: initProgress,
    bindGate: bindGate,
    bindCheckbox: bindCheckbox,
    bindToggle: bindToggle,
    initSignaturePad: initSignaturePad
  };
})();
