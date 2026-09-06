/* ==========================================================================
   CareSphere — Hours Verification

   Verifying can also correct the claim: the admin records the number they
   agree with, not necessarily the number submitted.
   ========================================================================== */

(function () {
  "use strict";

  var admin = CSAdmin.init();

  var all    = [];
  var status = "pending";
  var term   = "";
  var openId = null;

  var rowsEl    = document.getElementById("rows");
  var emptyEl   = document.getElementById("emptyState");
  var summaryEl = document.getElementById("summaryRow");

  var LABEL = {
    pending:  { text: "Pending",  cls: "is-pending"  },
    verified: { text: "Verified", cls: "is-approved" },
    rejected: { text: "Rejected", cls: "is-rejected" }
  };

  /* ------------------------------------------------------------------ */

  function load() {
    return CSStore.find("hours").then(function (docs) {
      all = docs.sort(function (a, b) {
        return new Date(b.loggedAt) - new Date(a.loggedAt);
      });
      render();
      CSAdmin.refreshBadges();
    });
  }

  function visible() {
    return all.filter(function (h) {
      if (status !== "all" && h.status !== status) return false;
      if (!term) return true;
      return (h.name + " " + h.eventTitle).toLowerCase().indexOf(term) !== -1;
    });
  }

  /* ------------------------------------------------------------------ */

  function renderSummary() {
    function n(s) { return all.filter(function (h) { return h.status === s; }).length; }
    var claimed = all.filter(function (h) { return h.status === "pending"; })
                     .reduce(function (s, h) { return s + h.hours; }, 0);
    var verified = all.filter(function (h) { return h.status === "verified"; })
                      .reduce(function (s, h) { return s + h.hours; }, 0);

    summaryEl.innerHTML =
      '<div class="summary-chip is-hot"><b>' + n("pending") + '</b><span>entries pending</span></div>' +
      '<div class="summary-chip"><b>' + claimed  + '</b><span>hours claimed</span></div>' +
      '<div class="summary-chip"><b>' + verified + '</b><span>hours verified</span></div>' +
      '<div class="summary-chip"><b>' + n("rejected") + '</b><span>rejected</span></div>';
  }

  function render() {
    renderSummary();

    var list = visible();
    var esc  = CSAdmin.esc;

    if (!list.length) {
      rowsEl.innerHTML = "";
      emptyEl.hidden = false;
      document.getElementById("emptyTitle").textContent = term ? "No matches" : "Nothing to verify";
      document.getElementById("emptyBody").textContent = term
        ? "Try a different search."
        : "Hours appear here once volunteers log them against an event they attended.";
      return;
    }

    emptyEl.hidden = true;

    rowsEl.innerHTML = list.map(function (h) {
      var badge = LABEL[h.status] || LABEL.pending;
      var actions = h.status === "pending"
        ? '<button class="btn btn-danger btn-sm" data-reject="' + h._id + '">Reject</button> ' +
          '<button class="btn btn-primary btn-sm" data-verify="' + h._id + '">Verify</button>'
        : '<button class="btn btn-ghost btn-sm" data-reopen="' + h._id + '">Reopen</button>';

      return '' +
        '<tr>' +
          '<td>' +
            '<span class="avatar-cell">' +
              '<span class="avatar-sm">' + esc(h.name.charAt(0)) + '</span>' +
              '<span class="cell-primary">' + esc(h.name) + '</span>' +
            '</span>' +
          '</td>' +
          '<td>' + esc(h.eventTitle) +
            (h.note ? '<span class="cell-sub">' + esc(h.note) + '</span>' : '') +
          '</td>' +
          '<td><span class="cell-primary">' + h.hours + ' hrs</span></td>' +
          '<td>' + CSAdmin.fmtDate(h.loggedAt) + '<span class="cell-sub">' + CSAdmin.daysAgo(h.loggedAt) + '</span></td>' +
          '<td><span class="status-badge ' + badge.cls + '">' + badge.text + '</span></td>' +
          '<td class="cell-actions">' + actions + '</td>' +
        '</tr>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Verify
     ------------------------------------------------------------------ */

  function openVerify(id) {
    var h = all.filter(function (x) { return x._id === id; })[0];
    if (!h) return;
    openId = id;

    document.getElementById("verifySub").textContent =
      h.name + " · " + h.eventTitle + " · claimed " + h.hours + " hrs";
    document.getElementById("vHours").value = h.hours;
    document.getElementById("vNote").value = "";
    document.getElementById("vHoursError").textContent = "";
    document.getElementById("vHours").closest(".field").classList.remove("has-error");

    CSAdmin.openModal("verifyModal");
  }

  document.getElementById("confirmVerify").addEventListener("click", function () {
    var input = document.getElementById("vHours");
    var value = parseFloat(input.value);

    if (!value || value <= 0 || value > 24) {
      input.closest(".field").classList.add("has-error");
      document.getElementById("vHoursError").textContent = "Enter a number between 0.5 and 24.";
      input.focus();
      return;
    }

    var h = all.filter(function (x) { return x._id === openId; })[0];

    CSStore.updateById("hours", openId, {
      status: "verified",
      hours: value,
      note: document.getElementById("vNote").value.trim(),
      verifiedAt: CSAdmin.today(),
      verifiedBy: admin.name
    }).then(function () {
      CSAdmin.closeModal("verifyModal");
      CSAdmin.toast(
        value === h.hours
          ? value + " hrs verified for " + h.name
          : "Recorded " + value + " hrs for " + h.name + " (claimed " + h.hours + ")",
        "good"
      );
      load();
    });
  });

  /* ------------------------------------------------------------------
     Reject
     ------------------------------------------------------------------ */

  function openReject(id) {
    openId = id;
    document.getElementById("rNote").value = "";
    document.getElementById("rNoteError").textContent = "";
    document.getElementById("rNote").closest(".field").classList.remove("has-error");
    CSAdmin.openModal("rejectModal");
  }

  document.getElementById("confirmReject").addEventListener("click", function () {
    var box  = document.getElementById("rNote");
    var text = box.value.trim();

    if (text.length < 10) {
      box.closest(".field").classList.add("has-error");
      document.getElementById("rNoteError").textContent =
        "Write a short reason so the volunteer knows why.";
      box.focus();
      return;
    }

    var h = all.filter(function (x) { return x._id === openId; })[0];

    CSStore.updateById("hours", openId, {
      status: "rejected",
      note: text,
      verifiedAt: CSAdmin.today(),
      verifiedBy: admin.name
    }).then(function () {
      CSAdmin.closeModal("rejectModal");
      CSAdmin.toast("Entry from " + h.name + " rejected", "warn");
      load();
    });
  });

  /* ------------------------------------------------------------------
     Events
     ------------------------------------------------------------------ */

  rowsEl.addEventListener("click", function (e) {
    var v = e.target.closest("[data-verify]");
    var r = e.target.closest("[data-reject]");
    var o = e.target.closest("[data-reopen]");

    if (v) openVerify(v.getAttribute("data-verify"));
    if (r) openReject(r.getAttribute("data-reject"));
    if (o) {
      CSStore.updateById("hours", o.getAttribute("data-reopen"), {
        status: "pending", verifiedAt: null, verifiedBy: null
      }).then(function () {
        CSAdmin.toast("Moved back to pending");
        load();
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

  var typing;
  document.getElementById("searchBox").addEventListener("input", function () {
    var v = this.value.trim().toLowerCase();
    clearTimeout(typing);
    typing = setTimeout(function () { term = v; render(); }, 160);
  });

  load();

})();
