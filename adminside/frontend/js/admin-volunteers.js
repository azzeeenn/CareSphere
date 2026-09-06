/* ==========================================================================
   CareSphere — Volunteers

   A volunteer's record is spread across four collections, so this page
   joins them: the account (users), what they applied with (applications),
   what they signed up for (registrations) and what they logged (hours).
   ========================================================================== */

(function () {
  "use strict";

  CSAdmin.init();

  var people   = [];
  var state    = "active";
  var district = "all";
  var interest = "all";
  var term     = "";
  var openId   = null;

  var rowsEl    = document.getElementById("rows");
  var emptyEl   = document.getElementById("emptyState");
  var summaryEl = document.getElementById("summaryRow");

  /* ------------------------------------------------------------------
     Load and join
     ------------------------------------------------------------------ */

  function load() {
    return Promise.all([
      CSStore.find("users", { role: "volunteer" }),
      CSStore.find("applications", { status: "approved" }),
      CSStore.find("registrations"),
      CSStore.find("hours")
    ]).then(function (r) {
      var users = r[0], apps = r[1], regs = r[2], hrs = r[3];

      var appByUser = {};
      apps.forEach(function (a) { appByUser[a.userId] = a; });

      people = users
        .filter(function (u) { return appByUser[u._id]; })
        .map(function (u) {
          var app = appByUser[u._id];
          var myRegs = regs.filter(function (x) {
            return x.userId === u._id && x.status !== "cancelled";
          });
          var verified = hrs.filter(function (x) {
            return x.userId === u._id && x.status === "verified";
          }).reduce(function (s, x) { return s + x.hours; }, 0);

          return {
            _id: u._id,
            name: u.name,
            email: u.email,
            active: u.active,
            joinedAt: app.reviewedAt || u.createdAt,
            phone: app.phone,
            city: app.city,
            district: app.district,
            interest: app.interest,
            availability: app.availability,
            hoursPerWeek: app.hoursPerWeek,
            skills: app.skills,
            experience: app.experience,
            emergencyName: app.emergencyName,
            emergencyPhone: app.emergencyPhone,
            eventCount: myRegs.length,
            hoursLogged: verified
          };
        })
        .sort(function (a, b) { return a.name.localeCompare(b.name); });

      render();
    });
  }

  function visible() {
    return people.filter(function (p) {
      if (state === "active"   && !p.active) return false;
      if (state === "inactive" &&  p.active) return false;
      if (district !== "all" && p.district !== district) return false;
      if (interest !== "all" && p.interest !== interest) return false;
      if (!term) return true;
      return (p.name + " " + p.email).toLowerCase().indexOf(term) !== -1;
    });
  }

  /* ------------------------------------------------------------------
     Render
     ------------------------------------------------------------------ */

  function renderSummary() {
    var active = people.filter(function (p) { return p.active; }).length;
    var hours  = people.reduce(function (s, p) { return s + p.hoursLogged; }, 0);
    var districts = {};
    people.forEach(function (p) { if (p.active) districts[p.district] = 1; });

    summaryEl.innerHTML =
      '<div class="summary-chip"><b>' + active + '</b><span>active</span></div>' +
      '<div class="summary-chip"><b>' + (people.length - active) + '</b><span>deactivated</span></div>' +
      '<div class="summary-chip"><b>' + Object.keys(districts).length + '</b><span>districts covered</span></div>' +
      '<div class="summary-chip"><b>' + hours + '</b><span>hours verified</span></div>';
  }

  function render() {
    renderSummary();

    var list = visible();
    var esc  = CSAdmin.esc;

    if (!list.length) {
      rowsEl.innerHTML = "";
      emptyEl.hidden = false;
      var filtered = term || district !== "all" || interest !== "all" || state !== "active";
      document.getElementById("emptyTitle").textContent = filtered ? "No matches" : "No volunteers yet";
      document.getElementById("emptyBody").textContent = filtered
        ? "Try a different search or clear the filters."
        : "Approve an application and that person appears here.";
      return;
    }

    emptyEl.hidden = true;

    rowsEl.innerHTML = list.map(function (p) {
      var cat = p.interest === "Education"  ? "is-education"
              : p.interest === "Healthcare" ? "is-healthcare" : "is-green";

      return '' +
        '<tr>' +
          '<td>' +
            '<span class="avatar-cell">' +
              '<span class="avatar-sm">' + esc(p.name.charAt(0)) + '</span>' +
              '<span>' +
                '<span class="cell-primary">' + esc(p.name) + '</span>' +
                '<span class="cell-sub">' + esc(p.email) + '</span>' +
              '</span>' +
            '</span>' +
          '</td>' +
          '<td>' + esc(p.district) + '</td>' +
          '<td><span class="tag ' + cat + '">' + esc(p.interest) + '</span></td>' +
          '<td>' + p.eventCount + '</td>' +
          '<td>' + p.hoursLogged + ' hrs</td>' +
          '<td><span class="status-badge ' + (p.active ? "is-approved" : "is-draft") + '">' +
              (p.active ? "Active" : "Deactivated") + '</span></td>' +
          '<td class="cell-actions">' +
            '<button class="btn btn-quiet btn-sm" data-view="' + p._id + '">View</button>' +
          '</td>' +
        '</tr>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Profile modal
     ------------------------------------------------------------------ */

  function field(label, value, full) {
    return '<div class="detail' + (full ? " full" : "") + '">' +
             '<dt>' + label + '</dt>' +
             '<dd>' + CSAdmin.esc(value || "—") + '</dd>' +
           '</div>';
  }

  function block(label, value) {
    return '<div class="detail full">' +
             '<dt>' + label + '</dt>' +
             '<dd class="detail-block">' + CSAdmin.esc(value || "—") + '</dd>' +
           '</div>';
  }

  function openProfile(id) {
    var p = people.filter(function (x) { return x._id === id; })[0];
    if (!p) return;
    openId = id;

    document.getElementById("profileName").textContent = p.name;
    document.getElementById("profileMeta").textContent =
      "Volunteering since " + CSAdmin.fmtDate(p.joinedAt) + " · " + p.district;

    document.getElementById("profileGrid").innerHTML =
      field("Email", p.email) +
      field("Phone", p.phone) +
      field("City", p.city) +
      field("District", p.district) +
      field("Area of interest", p.interest) +
      field("Availability", p.availability) +
      field("Events joined", p.eventCount) +
      field("Hours verified", p.hoursLogged + " hrs") +
      block("Skills", p.skills) +
      block("Prior experience", p.experience) +
      field("Emergency contact", p.emergencyName) +
      field("Emergency phone", p.emergencyPhone);

    document.getElementById("profileFoot").innerHTML = p.active
      ? '<span class="spacer"></span>' +
        '<button class="btn btn-quiet" type="button" data-close-modal>Close</button>' +
        '<button class="btn btn-danger" type="button" data-toggle>Deactivate account</button>'
      : '<span class="spacer status-badge is-draft">Cannot sign in</span>' +
        '<button class="btn btn-quiet" type="button" data-close-modal>Close</button>' +
        '<button class="btn btn-primary" type="button" data-toggle>Reactivate account</button>';

    CSAdmin.openModal("profileModal");
  }

  document.getElementById("profileFoot").addEventListener("click", function (e) {
    if (!e.target.closest("[data-toggle]")) return;
    var p = people.filter(function (x) { return x._id === openId; })[0];

    CSStore.updateById("users", openId, { active: !p.active }).then(function () {
      CSAdmin.closeModal("profileModal");
      CSAdmin.toast(
        p.active ? p.name + " can no longer sign in" : p.name + " can sign in again",
        p.active ? "warn" : "good"
      );
      load();
    });
  });

  /* ------------------------------------------------------------------
     Events
     ------------------------------------------------------------------ */

  rowsEl.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-view]");
    if (btn) openProfile(btn.getAttribute("data-view"));
  });

  document.getElementById("stateFilter").addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    this.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("is-on"); });
    chip.classList.add("is-on");
    state = chip.getAttribute("data-state");
    render();
  });

  document.getElementById("districtFilter").addEventListener("change", function () {
    district = this.value; render();
  });

  document.getElementById("interestFilter").addEventListener("change", function () {
    interest = this.value; render();
  });

  var typing;
  document.getElementById("searchBox").addEventListener("input", function () {
    var v = this.value.trim().toLowerCase();
    clearTimeout(typing);
    typing = setTimeout(function () { term = v; render(); }, 160);
  });

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */

  function options(list) {
    return list.map(function (v) {
      return '<option value="' + CSAdmin.esc(v) + '">' + CSAdmin.esc(v) + '</option>';
    }).join("");
  }

  document.getElementById("districtFilter").innerHTML =
    '<option value="all">All districts</option>' + options(CSStore.districts);
  document.getElementById("interestFilter").innerHTML =
    '<option value="all">All interests</option>' + options(CSStore.categories);

  load();

})();
