/* ==========================================================================
   CareSphere — My hours

   You can only log against an event you actually attended: it has to be in
   the past, and you have to have been registered for it. Anything else
   would leave an organiser verifying claims they can't check.
   ========================================================================== */

(function () {
  "use strict";

  var user = CSVol.start();
  if (!user) return;

  var myHours   = [];
  var attended  = [];   // past events I was registered for
  var esc       = CSVol.esc;

  var listEl  = document.getElementById("list");
  var eventEl = document.getElementById("hEvent");
  var hoursEl = document.getElementById("hHours");
  var noteEl  = document.getElementById("hNote");

  var LABEL = {
    pending:  "Awaiting check",
    verified: "Verified",
    rejected: "Not accepted"
  };

  /* ------------------------------------------------------------------ */

  function load() {
    return Promise.all([
      CSStore.find("hours", { userId: user._id }),
      CSStore.find("registrations", { userId: user._id }),
      CSStore.find("events")
    ]).then(function (r) {
      myHours = r[0];

      var regs = r[1].filter(function (g) { return g.status !== "cancelled"; });
      var joined = {};
      regs.forEach(function (g) { joined[g.eventId] = true; });

      var now = new Date();
      attended = r[2].filter(function (e) {
        return joined[e._id] && new Date(e.startsAt) < now;
      }).sort(function (a, b) { return new Date(b.startsAt) - new Date(a.startsAt); });

      renderStats();
      renderPicker();
      renderList();
    });
  }

  /* ------------------------------------------------------------------ */

  function renderStats() {
    function total(status) {
      return myHours.filter(function (h) { return h.status === status; })
                    .reduce(function (s, h) { return s + h.hours; }, 0);
    }

    document.getElementById("statVerified").textContent = total("verified");
    document.getElementById("statPending").textContent  = total("pending");
    document.getElementById("statRejected").textContent = total("rejected");
    document.getElementById("statEvents").textContent   = attended.length;
  }

  /* Events already logged drop out of the picker, so nobody claims twice */
  function renderPicker() {
    var logged = {};
    myHours.forEach(function (h) {
      if (h.status !== "rejected") logged[h.eventId] = true;
    });

    var choices = attended.filter(function (e) { return !logged[e._id]; });
    var panel = document.getElementById("logPanel");

    if (!choices.length) {
      panel.innerHTML = attended.length
        ? '<h3>Nothing left to log</h3>' +
          '<p style="margin:0">You\'ve logged hours for every event you attended.</p>'
        : '<h3>Nothing to log yet</h3>' +
          '<p style="margin:0 0 16px">Once you\'ve attended an event you can record your hours here.</p>' +
          '<a class="btn btn-primary" href="volunteer-my-events.html">Find an event</a>';
      return;
    }

    eventEl.innerHTML = choices.map(function (e) {
      return '<option value="' + esc(e._id) + '">' +
               esc(e.title) + " \u2014 " + CSVol.fmtDate(e.startsAt) +
             '</option>';
    }).join("");
  }

  function renderList() {
    if (!myHours.length) {
      listEl.innerHTML = CSVol.empty(
        "Nothing logged yet",
        "Hours you record will show up here with their status."
      );
      return;
    }

    var sorted = myHours.slice().sort(function (a, b) {
      return new Date(b.loggedAt) - new Date(a.loggedAt);
    });

    listEl.innerHTML = sorted.map(function (h) {
      var d = CSVol.dayPart(h.loggedAt);

      return '' +
        '<article class="vol-card">' +
          '<span class="vol-date"><b>' + d.day + '</b><span>' + d.month + '</span></span>' +
          '<span class="vol-card-body">' +
            '<h3>' + esc(h.eventTitle) + '</h3>' +
            '<p>' + h.hours + ' hrs' +
              (h.note ? ' \u00B7 ' + esc(h.note) : '') +
              (h.verifiedBy ? ' \u00B7 checked by ' + esc(h.verifiedBy) : '') +
            '</p>' +
          '</span>' +
          '<span class="vol-badge is-' + h.status + '">' + LABEL[h.status] + '</span>' +
        '</article>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Logging
     ------------------------------------------------------------------ */

  function validate() {
    CSAuth.clearErrors(document.getElementById("logPanel"));
    var ok = true;

    var hours = parseFloat(hoursEl.value);
    if (!hours || hours < 0.5 || hours > 24) {
      CSAuth.fail(hoursEl, "Enter a number between 0.5 and 24.");
      hoursEl.focus();
      ok = false;
    }

    return ok;
  }

  document.addEventListener("click", function (e) {
    if (!e.target.closest("#logHours")) return;
    if (!validate()) return;

    var eventId = eventEl.value;
    var chosen  = attended.filter(function (x) { return x._id === eventId; })[0];
    if (!chosen) return;

    var btn = e.target.closest("#logHours");
    btn.disabled = true;
    btn.textContent = "Sending\u2026";

    /* If a previous claim was rejected, replace it rather than stacking a
       second one on top */
    var previous = myHours.filter(function (h) {
      return h.eventId === eventId && h.status === "rejected";
    })[0];

    var payload = {
      userId:     user._id,
      name:       user.name,
      eventId:    eventId,
      eventTitle: chosen.title,
      hours:      parseFloat(hoursEl.value),
      loggedAt:   CSAuth.today(),
      status:     "pending",
      note:       noteEl.value.trim(),
      verifiedAt: null,
      verifiedBy: null
    };

    var work = previous
      ? CSStore.updateById("hours", previous._id, payload)
      : CSStore.insert("hours", payload);

    work.then(function () {
      hoursEl.value = "";
      noteEl.value = "";
      btn.disabled = false;
      btn.textContent = "Log these hours";
      CSVol.toast("Logged. An organiser will check it shortly.", "good");
      load();
    });
  });

  load();

})();
