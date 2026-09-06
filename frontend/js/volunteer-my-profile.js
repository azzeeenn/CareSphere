/* ==========================================================================
   CareSphere — My profile

   Contact details live in two places: the account record and the
   application record the admin panel reads. Both get written, or an
   organiser would end up ringing an out-of-date number.
   ========================================================================== */

(function () {
  "use strict";

  var user = CSVol.start();
  if (!user) return;

  var account = null;
  var app     = null;
  var esc     = CSVol.esc;

  var D = {
    name:           document.getElementById("pName"),
    email:          document.getElementById("pEmail"),
    phone:          document.getElementById("pPhone"),
    city:           document.getElementById("pCity"),
    emergencyName:  document.getElementById("pEmergencyName"),
    emergencyPhone: document.getElementById("pEmergencyPhone")
  };

  var P = {
    current: document.getElementById("pCurrent"),
    fresh:   document.getElementById("pNew"),
    confirm: document.getElementById("pConfirm")
  };

  /* ------------------------------------------------------------------ */

  function load() {
    return Promise.all([
      CSStore.findById("users", user._id),
      CSStore.find("applications", { userId: user._id })
    ]).then(function (r) {
      account = r[0];
      app     = r[1][0];

      document.getElementById("profileName").textContent = account.name;

      if (app) {
        document.getElementById("profileSince").textContent =
          "Volunteering since " + CSVol.fmtDate(app.reviewedAt) +
          " \u00B7 " + app.district + " \u00B7 " + app.interest;
      }

      D.name.value  = account.name;
      D.email.value = account.email;

      if (app) {
        D.phone.value          = app.phone;
        D.city.value           = app.city;
        D.emergencyName.value  = app.emergencyName;
        D.emergencyPhone.value = app.emergencyPhone;
      }

      renderApplication();
    });
  }

  /* ------------------------------------------------------------------ */

  function row(label, value, full) {
    return '<div class="' + (full ? "full" : "") + '">' +
             '<dt>' + label + '</dt>' +
             '<dd>' + esc(value || "\u2014") + '</dd>' +
           '</div>';
  }

  function block(label, value) {
    return '<div class="full">' +
             '<dt>' + label + '</dt>' +
             '<dd class="block">' + esc(value || "\u2014") + '</dd>' +
           '</div>';
  }

  function renderApplication() {
    if (!app) {
      document.getElementById("applicationDetail").innerHTML =
        '<div class="full"><dd>No application on file.</dd></div>';
      return;
    }

    document.getElementById("applicationDetail").innerHTML =
      row("District", app.district) +
      row("Area of interest", app.interest) +
      row("Availability", app.availability) +
      row("Hours per week", app.hoursPerWeek) +
      row("Applied on", CSVol.fmtDate(app.submittedAt)) +
      row("Approved on", CSVol.fmtDate(app.reviewedAt)) +
      block("Skills", app.skills) +
      block("Previous volunteering", app.experience) +
      block("Why you wanted to join", app.motivation);
  }

  /* ------------------------------------------------------------------
     Save details
     ------------------------------------------------------------------ */

  function validateDetails() {
    CSAuth.clearErrors(D.name.closest(".vol-panel"));
    var ok = true, first = null;

    function bad(el, msg) {
      CSAuth.fail(el, msg);
      first = first || el;
      ok = false;
    }

    if (D.name.value.trim().length < 2) bad(D.name, "Tell us your name.");

    if (!D.phone.value.trim())               bad(D.phone, "We need a number to reach you on.");
    else if (!CSAuth.isPhone(D.phone.value)) bad(D.phone, "That doesn't look like a phone number.");

    if (!D.city.value.trim()) bad(D.city, "Which town or city are you in?");

    if (D.emergencyName.value.trim().length < 2) bad(D.emergencyName, "Who should we call in an emergency?");

    if (!D.emergencyPhone.value.trim()) {
      bad(D.emergencyPhone, "Add their phone number.");
    } else if (!CSAuth.isPhone(D.emergencyPhone.value)) {
      bad(D.emergencyPhone, "That doesn't look like a phone number.");
    } else if (D.emergencyPhone.value.replace(/\D/g, "") === D.phone.value.replace(/\D/g, "")) {
      bad(D.emergencyPhone, "This should be someone else's number, not your own.");
    }

    if (first) first.focus();
    return ok;
  }

  document.getElementById("saveDetails").addEventListener("click", function () {
    if (!validateDetails()) return;

    var name = D.name.value.trim();

    var jobs = [CSStore.updateById("users", user._id, { name: name })];

    if (app) {
      jobs.push(CSStore.updateById("applications", app._id, {
        name:           name,
        phone:          D.phone.value.trim(),
        city:           D.city.value.trim(),
        emergencyName:  D.emergencyName.value.trim(),
        emergencyPhone: D.emergencyPhone.value.trim()
      }));
    }

    Promise.all(jobs).then(function () {
      /* Keep the session in step so the top bar and greeting update too */
      CSStore.session.set(Object.assign({}, user, { name: name }));
      user.name = name;
      CSVol.toast("Your details are saved", "good");
      load();
    });
  });

  /* ------------------------------------------------------------------
     Change password
     ------------------------------------------------------------------ */

  document.getElementById("savePassword").addEventListener("click", function () {
    CSAuth.clearErrors(P.current.closest(".vol-panel"));
    var ok = true, first = null;

    function bad(el, msg) {
      CSAuth.fail(el, msg);
      first = first || el;
      ok = false;
    }

    if (!P.current.value) {
      bad(P.current, "Enter your current password.");
    } else if (P.current.value !== account.password) {
      bad(P.current, "That isn't your current password.");
    }

    if (P.fresh.value.length < 8) {
      bad(P.fresh, "Use at least 8 characters.");
    } else if (!/[0-9]/.test(P.fresh.value)) {
      bad(P.fresh, "Include at least one number.");
    } else if (P.fresh.value === P.current.value) {
      bad(P.fresh, "Pick something different from your current password.");
    }

    if (!P.confirm.value) bad(P.confirm, "Type the new password again.");
    else if (P.confirm.value !== P.fresh.value) bad(P.confirm, "These two don't match.");

    if (!ok) { if (first) first.focus(); return; }

    CSStore.updateById("users", user._id, { password: P.fresh.value }).then(function () {
      P.current.value = P.fresh.value = P.confirm.value = "";
      CSVol.toast("Password changed", "good");
      load();
    });
  });

  load();

})();
