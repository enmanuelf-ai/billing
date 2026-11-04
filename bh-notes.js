/* My Billing Hours - progress note status (Aliado). Needs window.PNCFG = {c: clinician, n: note-flow key} */
(function () {
  var CFG = window.PNCFG || {};
  if (!CFG.c || !CFG.n) return;
  var NOTE_URL = "https://default5c737bedc35d48c39a6d89e766c7c7.03.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/07/workflows/872baf79ecaf4558b9eba2d61cc183d4/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0";
  var OVERDUE_HRS = 72;
  var START = new Date(2026, 10, 9); /* only encounters from this date on are tracked */
  if (CFG.since && /^\d{4}-\d{2}-\d{2}$/.test(CFG.since)) { var sp = CFG.since.split("-"); START = new Date(+sp[0], +sp[1] - 1, +sp[2]); }

  function norm(s) { return String(s == null ? "" : s).trim().replace(/\s+/g, " ").toLowerCase(); }
  function keyOf(e) { return norm(CFG.c) + "|" + norm(e.youth) + "|" + String(e.date).trim() + "|" + norm(e.start); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }); }
  function call(body) {
    return fetch(NOTE_URL + "&sig=" + encodeURIComponent(CFG.n), { method: "POST", headers: { "Content-Type": "text/plain" }, referrerPolicy: "no-referrer", body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function endDate(e) {
    var p = String(e.date).trim().split(/[\/\-]/); if (p.length < 3) return null;
    var m = String(e.end || e.start).trim().match(/(\d{1,2}):(\d{2})\s*([AP]M)?/i); var h = 23, mi = 59;
    if (m) { h = parseInt(m[1], 10) % 12; mi = parseInt(m[2], 10); if (m[3] && m[3].toUpperCase() === "PM") h += 12; if (!m[3] && parseInt(m[1], 10) === 12) h = 12; }
    var y = parseInt(p[2], 10); if (y < 100) y += 2000;
    return new Date(y, parseInt(p[0], 10) - 1, parseInt(p[1], 10), h, mi);
  }

  var css = document.createElement("style");
  css.textContent =
    ".enc{flex-wrap:wrap}" +
    ".pn-chip{display:inline-block;margin-top:5px;font-size:.68rem;font-weight:700;padding:2px 9px;border-radius:999px}" +
    ".pn-ok{background:#dcfce7;color:#15803d}.pn-pend{background:#fef3c7;color:#92400e}.pn-late{background:#fee2e2;color:#b91c1c}" +
    ".pn-acts{flex-basis:100%;display:flex;gap:8px;margin:8px 0 2px 54px}" +
    ".pn-acts button{flex:1;border-radius:11px;padding:9px 6px;font:700 .78rem -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;cursor:pointer}" +
    ".pn-w{background:#1a3a8f;color:#fff;border:0}.pn-m{background:#fff;color:#1a3a8f;border:1.5px solid #cfd8ee}" +
    ".pn-banner{display:flex;align-items:center;gap:12px;background:#fff;border-radius:18px;padding:13px 14px;margin:0 0 12px;border:1.5px solid #fde68a;box-shadow:0 4px 16px rgba(15,35,102,.06)}" +
    ".pn-banner.late{border-color:#fecaca;background:#fff5f5}.pn-banner.done{border-color:#bbf7d0;background:#f0fdf4}" +
    ".pn-n{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;background:#f59e0b;flex-shrink:0;font-size:1rem}" +
    ".late .pn-n{background:#dc2626}.done .pn-n{background:#16a34a}" +
    ".pn-banner b{display:block;font-size:.9rem}.pn-banner span{font-size:.76rem;color:#5b6478}" +
    ".pn-ov{position:fixed;inset:0;background:rgba(15,23,41,.45);display:flex;align-items:flex-end;justify-content:center;z-index:1000}" +
    ".pn-sh{background:#fff;width:100%;max-width:520px;border-radius:24px 24px 0 0;padding:22px 20px calc(24px + env(safe-area-inset-bottom))}" +
    ".pn-sh h3{font-size:1.1rem;margin:0 0 6px}.pn-sh p{font-size:.84rem;color:#5b6478;margin:0;line-height:1.45}" +
    ".pn-box{background:#eef2fc;border-radius:14px;padding:12px;margin:14px 0;font-size:.84rem}.pn-box b{display:block;font-size:.95rem}" +
    ".pn-sh button{display:block;width:100%;border-radius:14px;padding:14px;font:700 .95rem -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;margin-top:8px;cursor:pointer}" +
    ".pn-yes{background:#16a34a;color:#fff;border:0}.pn-no{background:#fff;color:#1a3a8f;border:1.5px solid #e3e8f4}" +
    ".pn-err{color:#dc2626;font-size:.8rem;font-weight:600;margin-top:8px;display:none}";
  document.head.appendChild(css);

  var ITEMS = [], MARKS = {};

  function collect() {
    var raw = Array.prototype.slice.call(document.querySelectorAll("#raw .encounter-card")).map(function (c) {
      var t = ((c.querySelector(".enc-time") || {}).textContent || "").split(/\s*[—–-]\s*/);
      return { order: parseFloat(c.style.order) || 0, date: ((c.querySelector(".enc-date") || {}).textContent || "").trim(), start: (t[0] || "").trim(), end: (t[1] || "").trim(), youth: ((c.querySelector(".enc-youth") || {}).textContent || "").trim() };
    }).sort(function (a, b) { return a.order - b.order; });
    var rows = document.querySelectorAll("#encList .enc");
    ITEMS = [];
    for (var i = 0; i < rows.length && i < raw.length; i++) { raw[i].row = rows[i]; raw[i].key = keyOf(raw[i]); ITEMS.push(raw[i]); }
  }

  function render() {
    var now = new Date(), pend = 0, late = 0;
    ITEMS.forEach(function (e) {
      var main = e.row.querySelector(".enc-main");
      var old = e.row.querySelector(".pn-chip"); if (old) old.remove();
      var oa = e.row.querySelector(".pn-acts"); if (oa) oa.remove();
      var day = endDate({ date: e.date, start: "12:00 AM" });
      if (day && day < START) return;
      var chip = document.createElement("span"); chip.className = "pn-chip";
      if (MARKS[e.key]) {
        var at = String(MARKS[e.key]).slice(5, 10).replace("-", "/");
        chip.className += " pn-ok"; chip.textContent = "✓ In CYBER" + (at ? " · " + at : "");
      } else {
        var ed = endDate(e), hrs = ed ? (now - ed) / 36e5 : 0; pend++;
        if (hrs > OVERDUE_HRS) { late++; chip.className += " pn-late"; chip.textContent = "Overdue · " + Math.floor(hrs / 24) + " days"; }
        else { chip.className += " pn-pend"; chip.textContent = "Note pending"; }
        var acts = document.createElement("div"); acts.className = "pn-acts";
        var w = document.createElement("button"); w.className = "pn-w"; w.type = "button"; w.textContent = "✎ Write note";
        w.onclick = function () { writeNote(e); };
        var m = document.createElement("button"); m.className = "pn-m"; m.type = "button"; m.textContent = "✓ Mark in CYBER";
        m.onclick = function () { confirmMark(e); };
        acts.appendChild(w); acts.appendChild(m); e.row.appendChild(acts);
      }
      if (main) main.appendChild(chip);
    });
    banner(pend, late);
  }

  function banner(pend, late) {
    var b = document.getElementById("pnBanner");
    var list = document.querySelector(".card.list");
    if (!b) { b = document.createElement("div"); b.id = "pnBanner"; if (list && list.parentNode) list.parentNode.insertBefore(b, list); else return; }
    b.className = "pn-banner" + (pend === 0 ? " done" : late ? " late" : "");
    b.innerHTML = pend === 0
      ? '<div class="pn-n">✓</div><div><b>All progress notes are in CYBER</b><span>Recent encounters are up to date.</span></div>'
      : '<div class="pn-n">' + pend + '</div><div><b>' + pend + ' progress note' + (pend > 1 ? 's' : '') + ' pending</b><span>' + (late ? late + ' over 72 hours · ' : '') + 'Write the note or mark it once it is in CYBER.</span></div>';
  }

  function writeNote(e) {
    var hp = new URLSearchParams();
    hp.set("c", CFG.c); hp.set("k", CFG.n); hp.set("d", e.date); hp.set("s", e.start); hp.set("e", e.end); hp.set("y", e.youth); hp.set("from", "bh");
    location.href = "https://enmanuelf-ai.github.io/billing/note.html#" + hp.toString();
  }

  function confirmMark(e) {
    var ov = document.createElement("div"); ov.className = "pn-ov";
    ov.innerHTML = '<div class="pn-sh"><h3>Is this note in CYBER?</h3><p>Only confirm after the progress note is pasted and signed in CYBER.</p>' +
      '<div class="pn-box"><b>' + esc(e.youth.replace(/\s*\(CFT\)$/, "")) + '</b>' + esc(e.date) + ' · ' + esc(e.start) + ' – ' + esc(e.end) + '</div>' +
      '<button class="pn-yes">Yes, it\'s in CYBER</button><button class="pn-no">Not yet</button><div class="pn-err">Couldn\'t save. Try again.</div></div>';
    document.body.appendChild(ov);
    var yes = ov.querySelector(".pn-yes"), err = ov.querySelector(".pn-err");
    ov.querySelector(".pn-no").onclick = function () { ov.remove(); };
    ov.onclick = function (ev) { if (ev.target === ov) ov.remove(); };
    yes.onclick = function () {
      yes.disabled = true; yes.textContent = "Saving…"; err.style.display = "none";
      call({ action: "mark", clinician: CFG.c, youth: e.youth, date: e.date, start: e.start, end: e.end, source: "billing-hours" })
        .then(function (d) { if (!d || !d.ok) throw 0; setMarks(d.marks); ov.remove(); render(); })
        .catch(function () { yes.disabled = false; yes.textContent = "Yes, it's in CYBER"; err.style.display = "block"; });
    };
  }

  function setMarks(list) { MARKS = {}; (list || []).forEach(function (x) { if (x && x.k) MARKS[x.k] = x.at || ""; }); }
  function refresh() { return call({ action: "status", clinician: CFG.c }).then(function (d) { if (d && d.ok) { setMarks(d.marks); render(); } }).catch(function () {}); }

  function start(tries) {
    if (!document.querySelector("#encList .enc")) { if (tries < 40) setTimeout(function () { start(tries + 1); }, 150); return; }
    collect(); refresh();
  }
  start(0);
  window.addEventListener("pageshow", function (ev) { if (ev.persisted) refresh(); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") refresh(); });
})();
