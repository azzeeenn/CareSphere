/* ==========================================================================
   CareSphere — Volunteer Applications

   The decision made here is what gates login. Writing status "approved"
   on an application is the only thing that lets that volunteer sign in.
   auth.js reads the same record.
   ========================================================================== */

(function () {
  "use strict";

  var admin = CSAdmin.init();

  var all       = [];
  var status    = "pending";
  var district  = "all";
  var term      = "";
  var openId    = null;
  var pendingAction = null;   // "rejected" | "more_info"

  var rowsEl     = document.getElementById("rows");
  var emptyEl    = document.getElementById("emptyState");
  var summaryEl  = document.getElementById("summaryRow");
  var districtEl = document.getElementById("districtFilter");

  var LABEL = {
    pending:   { text: "Pending",         cls: "is-pending"  },
    approved:  { text: "Approved",        cls: "is-approved" },
    rejected:  { text: "Rejected",        cls: "is-rejected" },
    more_info: { text: "Info requested",  cls: "is-info"     }
  };

  /* ------------------------------------------------------------------
     Load
     ------------------------------------------------------------------ */

  function load() {
    return CSStore.find("applications").then(function (docs) {
      all = docs.sort(function (a, b) {
        return new Date(b.submittedAt) - new Date(a.submittedAt);
      });
      render();
      CSAdmin.refreshBadges();
    });
  }

  /* ------------------------------------------------------------------
     Filtering
     ------------------------------------------------------------------ */

  function visible() {
    return all.filter(function (a) {
      if (status !== "all" && a.status !== status) return false;
      if (district !== "all" && a.district !== district) return false;
      if (!term) return true;
      var hay = (a.name + " " + a.email + " " + a.district + " " + a.interest).toLowerCase();
      return hay.indexOf(term) !== -1;
    });
  }

  /* ------------------------------------------------------------------
     Render
     ------------------------------------------------------------------ */

  function renderSummary() {
    function n(s) { return all.filter(function (a) { return a.status === s; }).length; }
    summaryEl.innerHTML =
      '<div class="summary-chip is-hot"><b>' + n("pending")   + '</b><span>pending</span></div>' +
      '<div class="summary-chip"><b>'        + n("approved")  + '</b><span>approved</span></div>' +
      '<div class="summary-chip"><b>'        + n("rejected")  + '</b><span>rejected</span></div>' +
      '<div class="summary-chip"><b>'        + n("more_info") + '</b><span>info requested</span></div>';
  }

  function render() {
    renderSummary();

    var list = visible();
    var esc  = CSAdmin.esc;

    if (!list.length) {
      rowsEl.innerHTML = "";
      emptyEl.hidden = false;
      document.getElementById("emptyTitle").textContent =
        term || district !== "all" ? "No matches" : "Nothing to review";
      document.getElementById("emptyBody").textContent =
        term || district !== "all"
          ? "Try a different search or clear the filters."
          : "New applications will appear here as soon as volunteers submit them.";
      return;
    }

    emptyEl.hidden = true;

    rowsEl.innerHTML = list.map(function (a) {
      var badge = LABEL[a.status] || LABEL.pending;
      var cat = a.interest === "Education"  ? "is-education"
              : a.interest === "Healthcare" ? "is-healthcare" : "is-green";

      return '' +
        '<tr>' +
          '<td>' +
            '<span class="avatar-cell">' +
              '<span class="avatar-sm">' + esc(a.name.charAt(0)) + '</span>' +
              '<span>' +
                '<span class="cell-primary">' + esc(a.name) + '</span>' +
                '<span class="cell-sub">' + esc(a.email) + '</span>' +
              '</span>' +
            '</span>' +
          '</td>' +
          '<td>' + esc(a.district) + '</td>' +
          '<td><span class="tag ' + cat + '">' + esc(a.interest) + '</span></td>' +
          '<td>' + esc(a.availability) + '<span class="cell-sub">' + esc(a.hoursPerWeek) + ' hrs/week</span></td>' +
          '<td>' + CSAdmin.fmtDate(a.submittedAt) + '<span class="cell-sub">' + CSAdmin.daysAgo(a.submittedAt) + '</span></td>' +
          '<td><span class="status-badge ' + badge.cls + '">' + badge.text + '</span></td>' +
          '<td class="cell-actions">' +
            '<button class="btn btn-quiet btn-sm" data-view="' + a._id + '">View form</button>' +
          '</td>' +
        '</tr>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Detail modal
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

  function openDetail(id) {
    var a = all.filter(function (x) { return x._id === id; })[0];
    if (!a) return;
    openId = id;

    var badge = LABEL[a.status] || LABEL.pending;

    document.getElementById("detailName").textContent = a.name;
    document.getElementById("detailMeta").textContent =
      "Submitted " + CSAdmin.fmtDate(a.submittedAt) + " · " + a.district + " · " + a.interest;

    document.getElementById("detailGrid").innerHTML =
      field("Email", a.email) +
      field("Phone", a.phone) +
      field("City", a.city) +
      field("District", a.district) +
      field("Area of interest", a.interest) +
      field("Availability", a.availability) +
      field("Hours per week", a.hoursPerWeek) +
      field("Current status", badge.text) +
      block("Skills", a.skills) +
      block("Prior experience", a.experience) +
      block("Why they want to join", a.motivation) +
      field("Emergency contact", a.emergencyName) +
      field("Emergency phone", a.emergencyPhone) +
      (a.note ? block("Note on file", a.note) : "") +
      (a.reviewedAt ? field("Reviewed", CSAdmin.fmtDate(a.reviewedAt) + " by " + (a.reviewedBy || "—"), true) : "");

    var foot = document.getElementById("detailFoot");

    if (a.status === "approved") {
      foot.innerHTML =
        '<span class="spacer status-badge is-approved">Approved — this volunteer can sign in</span>' +
        '<button class="btn btn-quiet" type="button" data-close-modal>Close</button>';
    } else if (a.status === "rejected") {
      foot.innerHTML =
        '<span class="spacer status-badge is-rejected">Rejected</span>' +
        '<button class="btn btn-quiet" type="button" data-reopen>Move back to pending</button>' +
        '<button class="btn btn-quiet" type="button" data-close-modal>Close</button>';
    } else {
      foot.innerHTML =
        '<button class="btn btn-quiet spacer" type="button" data-close-modal>Cancel</button>' +
        '<button class="btn btn-ghost" type="button" data-ask>Request more info</button>' +
        '<button class="btn btn-danger" type="button" data-reject>Reject</button>' +
        '<button class="btn btn-primary" type="button" data-approve>Approve</button>';
    }

    CSAdmin.openModal("detailModal");
  }

  /* ------------------------------------------------------------------
     Decisions
     ------------------------------------------------------------------ */

  function decide(id, newStatus, note) {
    return CSStore.updateById("applications", id, {
      status: newStatus,
      note: note || "",
      reviewedAt: newStatus === "pending" ? null : CSAdmin.today(),
      reviewedBy: newStatus === "pending" ? null : admin.name
    }).then(function () {
      return load();
    });
  }

  function approve(id) {
    var a = all.filter(function (x) { return x._id === id; })[0];
    decide(id, "approved").then(function () {
      CSAdmin.closeModal("detailModal");
      CSAdmin.toast(a.name + " approved — they can sign in now", "good");
    });
  }

  function askReason(action) {
    pendingAction = action;
    var isReject = action === "rejected";

    document.getElementById("reasonTitle").textContent =
      isReject ? "Reject this application" : "Request more information";
    document.getElementById("reasonHelp").textContent =
      isReject
        ? "The applicant sees this when they try to sign in."
        : "The applicant is asked to update their form and resubmit.";
    document.getElementById("reasonLabel").textContent =
      isReject ? "Reason for rejecting" : "What do you need from them?";

    var box = document.getElementById("reasonText");
    box.value = "";
    box.placeholder = isReject
      ? "For example: we are not running programmes in this district yet."
      : "For example: please add your emergency contact number.";

    document.getElementById("reasonError").textContent = "";
    document.getElementById("reasonConfirm").textContent = isReject ? "Reject" : "Send request";

    CSAdmin.closeModal("detailModal");
    CSAdmin.openModal("reasonModal");
  }

  document.getElementById("reasonConfirm").addEventListener("click", function () {
    var box  = document.getElementById("reasonText");
    var text = box.value.trim();
    var wrap = box.closest(".field");

    if (text.length < 10) {
      wrap.classList.add("has-error");
      document.getElementById("reasonError").textContent =
        "Write at least a short sentence so the applicant knows what to do.";
      box.focus();
      return;
    }

    wrap.classList.remove("has-error");
    var a = all.filter(function (x) { return x._id === openId; })[0];

    decide(openId, pendingAction, text).then(function () {
      CSAdmin.closeModal("reasonModal");
      CSAdmin.toast(
        pendingAction === "rejected"
          ? a.name + "'s application was rejected"
          : "Information requested from " + a.name,
        pendingAction === "rejected" ? "warn" : "good"
      );
    });
  });

  /* ------------------------------------------------------------------
     Events
     ------------------------------------------------------------------ */

  rowsEl.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-view]");
    if (btn) openDetail(btn.getAttribute("data-view"));
  });

  document.getElementById("detailFoot").addEventListener("click", function (e) {
    if (e.target.closest("[data-approve]")) approve(openId);
    if (e.target.closest("[data-reject]"))  askReason("rejected");
    if (e.target.closest("[data-ask]"))     askReason("more_info");
    if (e.target.closest("[data-reopen]")) {
      decide(openId, "pending").then(function () {
        CSAdmin.closeModal("detailModal");
        CSAdmin.toast("Moved back to pending");
      });
    }
  });

  document.getElementById("statusFilter").addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    this.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("is-on"); });
    chip.classList.add("is-on");
    status = chip.getAttribute("data-status");
    render();
  });

  districtEl.addEventListener("change", function () {
    district = this.value;
    render();
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

  districtEl.innerHTML = '<option value="all">All districts</option>' +
    CSStore.districts.map(function (d) {
      return '<option value="' + CSAdmin.esc(d) + '">' + CSAdmin.esc(d) + '</option>';
    }).join("");

  load();

})();
