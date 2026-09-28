/* ==========================================================================
   CareSphere: Become an admin (volunteer side)

   1. Shows the seven eligibility rules with the volunteer's real numbers,
      straight from the server. Nothing here decides eligibility, the
      page only displays what /api/admin-requests/eligibility/me says.
   2. Unlocks the form only when every rule passes and nothing is
      already waiting. The server checks both again on submit.
   3. Lists their requests with where each one has got to.
   ========================================================================== */

(function () {
  "use strict";

  var user = CSVol.start();
  if (!user) return;

  var esc = CSVol.esc;

  var checksEl   = document.getElementById("checks");
  var scoreEl    = document.getElementById("score");
  var lockedEl   = document.getElementById("locked");
  var panelEl    = document.getElementById("applyPanel");
  var requestsEl = document.getElementById("requests");

  var F = {
    motivation:    document.getElementById("motivation"),
    achievements:  document.getElementById("achievements"),
    rolesHeld:     document.getElementById("rolesHeld"),
    hoursPerWeek:  document.getElementById("hoursPerWeek"),
    preferredArea: document.getElementById("preferredArea")
  };

  var MIN = { motivation: 80, achievements: 40, rolesHeld: 20 };

  var TICK  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  var CROSS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M7 7l10 10M17 7 7 17"/></svg>';
  var LOCK  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';
  var CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 1.9"/></svg>';

  /* ------------------------------------------------------------------
     1. Checklist
     ------------------------------------------------------------------ */

  function barWidth(c) {
    if (c.key === "clean") return c.passed ? 100 : 0;
    if (!c.need) return 100;
    return Math.max(0, Math.min(100, Math.round(100 * c.have / c.need)));
  }

  function renderChecks(result) {
    scoreEl.textContent = result.passed + " of " + result.total + " met";
    scoreEl.classList.toggle("is-all", result.eligible);

    checksEl.innerHTML = result.checks.map(function (c) {
      return '' +
        '<div class="ba-check ' + (c.passed ? "is-pass" : "is-fail") + '">' +
          '<span class="ba-icon" aria-hidden="true">' + (c.passed ? TICK : CROSS) + '</span>' +
          '<div class="ba-body">' +
            '<h3>' + esc(c.label) +
              '<span class="visually-hidden">' + (c.passed ? " (met)" : " (not met)") + '</span></h3>' +
            '<p>' + esc(c.detail) + '</p>' +
            '<div class="ba-bar" aria-hidden="true"><i style="width:' + barWidth(c) + '%"></i></div>' +
          '</div>' +
        '</div>';
    }).join("");
  }

  function renderGate(result) {
    if (result.canApply) {
      lockedEl.hidden = true;
      panelEl.hidden = false;
      return;
    }

    panelEl.hidden = true;
    lockedEl.hidden = false;

    if (result.hasPending) {
      lockedEl.innerHTML = CLOCK +
        '<div><strong>Your application is with the team</strong>' +
        '<span>You can follow its progress below. You can apply again only once this one is decided.</span></div>';
      return;
    }

    var missing = result.total - result.passed;
    lockedEl.innerHTML = LOCK +
      '<div><strong>The form opens once every rule above is met</strong>' +
      '<span>' + missing + (missing === 1 ? " rule is" : " rules are") +
      ' still to go. Keep logging your hours at events. This page updates as they are verified.</span></div>';
  }

  /* ------------------------------------------------------------------
     3. Requests
     ------------------------------------------------------------------ */

  function statusBadge(s) {
    var label = s === "approved" ? "Approved" : s === "rejected" ? "Not taken forward" : "In review";
    return '<span class="vol-badge is-' + esc(s) + '">' + label + '</span>';
  }

  function renderRequests(rows) {
    if (!rows.length) {
      requestsEl.innerHTML = CSVol.empty(
        "No requests yet",
        "When you apply, you'll be able to follow it here: endorsements, interview, and the decision."
      );
      return;
    }

    requestsEl.innerHTML = rows.map(function (r) {
      var steps = '' +
        '<div class="ba-steps">' +
          '<span>Sent <b>' + esc(CSVol.fmtDate(r.submittedAt)) + '</b></span>' +
          '<span>Endorsements <b>' + r.endorsementCount + ' of ' + r.endorsementsNeeded + '</b></span>' +
          '<span>Interview <b>' + (r.interviewedAt ? "done" : "not yet") + '</b></span>' +
          (r.reviewedAt ? '<span>Decided <b>' + esc(CSVol.fmtDate(r.reviewedAt)) + '</b></span>' : '') +
        '</div>';

      var outcome = "";
      if (r.status === "approved") {
        outcome = '<div class="ba-note"><b>Welcome to the team.</b> Your account is now an admin account. ' +
                  'Sign out, then sign in again choosing <b>Admin</b>.' +
                  (r.decisionNote ? '<br>' + esc(r.decisionNote) : '') + '</div>';
      } else if (r.status === "rejected" && r.decisionNote) {
        outcome = '<div class="ba-note"><b>From the team:</b> ' + esc(r.decisionNote) + '</div>';
      }

      return '' +
        '<article class="vol-card ba-request">' +
          '<div class="vol-card-body">' +
            '<h3>Admin application' + (r.preferredArea ? ' &middot; ' + esc(r.preferredArea) : '') + '</h3>' +
            '<p>' + esc(r.hoursPerWeek) + ' hours a week offered</p>' +
            steps + outcome +
          '</div>' +
          statusBadge(r.status) +
        '</article>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Load
     ------------------------------------------------------------------ */

  function load() {
    return Promise.all([
      CSStore.promotion.myEligibility(),
      CSStore.promotion.mine()
    ]).then(function (r) {
      renderChecks(r[0]);
      renderGate(r[0]);
      renderRequests(r[1]);
    }).catch(function (err) {
      checksEl.innerHTML = CSVol.empty(
        "Couldn't load your record",
        (err && err.detail) || "Check the backend is running, then refresh."
      );
    });
  }

  /* Programme list for the preference dropdown */
  (CSStore.loadCategories ? CSStore.loadCategories() : Promise.resolve(CSStore.categories))
    .catch(function () { return CSStore.categories; })
    .then(function (cats) {
      F.preferredArea.innerHTML = '<option value="">No preference</option>' +
        (cats || []).map(function (c) {
          return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
        }).join("");
    });

  /* ------------------------------------------------------------------
     2. Form
     ------------------------------------------------------------------ */

  ["motivation", "achievements", "rolesHeld"].forEach(function (k) {
    var counter = document.getElementById(k + "Count");
    F[k].addEventListener("input", function () {
      counter.textContent = this.value.trim().length;
    });
  });

  function validate() {
    CSAuth.clearErrors(panelEl);
    var first = null;

    function bad(el, msg) {
      CSAuth.fail(el, msg);
      if (!first) first = el;
    }

    if (F.motivation.value.trim().length < MIN.motivation)
      bad(F.motivation, "Tell them a bit more (at least " + MIN.motivation + " characters).");
    if (F.achievements.value.trim().length < MIN.achievements)
      bad(F.achievements, "Add at least " + MIN.achievements + " characters about what you've achieved.");
    if (F.rolesHeld.value.trim().length < MIN.rolesHeld)
      bad(F.rolesHeld, "List at least one role or responsibility.");

    var h = parseInt(F.hoursPerWeek.value, 10);
    if (!h || h < 2 || h > 60) bad(F.hoursPerWeek, "Between 2 and 60 hours.");

    if (first) first.focus();
    return !first;
  }

  var submit = document.getElementById("submitRequest");

  submit.addEventListener("click", function () {
    if (!validate()) return;

    submit.disabled = true;
    submit.textContent = "Sending…";

    CSStore.promotion.apply({
      motivation:    F.motivation.value.trim(),
      achievements:  F.achievements.value.trim(),
      rolesHeld:     F.rolesHeld.value.trim(),
      hoursPerWeek:  parseInt(F.hoursPerWeek.value, 10),
      preferredArea: F.preferredArea.value || null
    }).then(function () {
      CSVol.toast("Application sent. The team will be in touch.", "good");
      Object.keys(F).forEach(function (k) { F[k].value = ""; });
      ["motivation", "achievements", "rolesHeld"].forEach(function (k) {
        document.getElementById(k + "Count").textContent = "0";
      });
      return load();
    }).catch(function (err) {
      CSVol.toast((err && err.detail) || "That didn't send. Try again.", "warn");
      /* The rules may have changed since the page loaded. */
      load();
    }).then(function () {
      submit.disabled = false;
      submit.textContent = "Send my application";
    });
  });

  load();

})();
