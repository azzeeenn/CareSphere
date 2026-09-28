/* ==========================================================================
   CareSphere — Admin Requests

   Volunteers asking to become admins. Who can do what:

     any admin     see requests, read the record, endorse (once each)
     super admin   also record the interview, approve / reject,
                   and change the eligibility rules

   The buttons here only reflect those rules. Every one of them is
   enforced again by the server, so hiding a button is a convenience,
   not the protection.
   ========================================================================== */

(function () {
  "use strict";

  var me = CSAdmin.init();
  if (!me) return;

  var esc     = CSAdmin.esc;
  var isSuper = CSAdmin.isSuper();
  var myId    = String(me._id || me.id || "");

  var all     = [];
  var status  = "pending";
  var term    = "";
  var openId  = null;

  var rowsEl    = document.getElementById("rows");
  var emptyEl   = document.getElementById("emptyState");
  var summaryEl = document.getElementById("summaryRow");
  var bodyEl    = document.getElementById("reqBody");

  /* ------------------------------------------------------------------
     Load + list
     ------------------------------------------------------------------ */

  function load() {
    return CSStore.promotion.list().then(function (rows) {
      all = rows;
      render();
      if (openId) {
        var still = byId(openId);
        if (still) renderDetail(still);
      }
    }).catch(function (err) {
      CSAdmin.toast((err && err.detail) || "Couldn't load requests", "warn");
    });
  }

  function byId(id) {
    return all.filter(function (r) { return r._id === id; })[0];
  }

  function visible() {
    return all.filter(function (r) {
      if (status !== "all" && r.status !== status) return false;
      if (!term) return true;
      return ((r.name || "") + " " + (r.email || "")).toLowerCase().indexOf(term) !== -1;
    });
  }

  function pill(s) {
    var label = s === "approved" ? "Approved" : s === "rejected" ? "Rejected" : "Pending";
    return '<span class="ar-pill is-' + esc(s) + '">' + label + '</span>';
  }

  function render() {
    function count(s) { return all.filter(function (r) { return r.status === s; }).length; }

    summaryEl.innerHTML =
      '<div class="summary-chip"><b>' + count("pending")  + '</b><span>waiting</span></div>' +
      '<div class="summary-chip"><b>' + count("approved") + '</b><span>approved</span></div>' +
      '<div class="summary-chip"><b>' + count("rejected") + '</b><span>rejected</span></div>';

    var list = visible();

    if (!list.length) {
      rowsEl.innerHTML = "";
      emptyEl.hidden = false;
      document.getElementById("emptyTitle").textContent = term ? "No matches" : "Nothing here";
      document.getElementById("emptyBody").textContent = term
        ? "Try a different search."
        : (status === "pending"
            ? "When a volunteer applies to become an admin, it appears here."
            : "No requests with this status yet.");
      return;
    }

    emptyEl.hidden = true;

    rowsEl.innerHTML = list.map(function (r) {
      var rec = r.record || { passed: 0, total: 7, eligible: false };
      return '' +
        '<tr>' +
          '<td><span class="cell-primary">' + esc(r.name) + '</span><br>' +
              '<span class="ar-muted">' + esc(r.email) + '</span></td>' +
          '<td><span class="ar-score' + (rec.eligible ? "" : " is-fail") + '">' +
              rec.passed + ' of ' + rec.total + '</span> rules</td>' +
          '<td>' + r.endorsements.length + ' of ' + r.endorsementsNeeded + '</td>' +
          '<td>' + (r.interviewedAt ? "Done" : "—") + '</td>' +
          '<td>' + esc(CSAdmin.fmtDate(r.submittedAt)) + '</td>' +
          '<td>' + pill(r.status) + '</td>' +
          '<td class="cell-actions"><button class="btn btn-quiet btn-sm" data-open="' + esc(r._id) + '">Open</button></td>' +
        '</tr>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Detail
     ------------------------------------------------------------------ */

  function answer(label, text) {
    return '<dl class="ar-answer"><dt>' + esc(label) + '</dt><dd>' + esc(text || "—") + '</dd></dl>';
  }

  function readiness(r) {
    var others = r.endorsements.filter(function (e) { return e.adminId !== myId; }).length;
    return [
      { ok: r.record && r.record.eligible, text: "Record meets all " + (r.record ? r.record.total : 7) + " rules" },
      { ok: others >= r.endorsementsNeeded,
        text: "Endorsed by " + r.endorsementsNeeded + " other admins (" + others + " so far, not counting you)" },
      { ok: !!r.interviewNotes, text: "Interview notes recorded" }
    ];
  }

  function renderDetail(r) {
    document.getElementById("reqTitle").textContent = r.name + " — admin request";
    document.getElementById("reqSub").innerHTML =
      esc(r.email) + " &middot; sent " + esc(CSAdmin.fmtDate(r.submittedAt)) + " &middot; " + pill(r.status);

    var rec = r.record || { checks: [] };
    var html = '';

    /* Their record — counted by the server */
    html += '<section class="ar-section"><h3>Their record (' + (rec.passed || 0) + ' of ' + (rec.total || 7) + ' rules met)</h3>' +
      '<div class="ar-checks">' + rec.checks.map(function (c) {
        return '<div class="ar-check ' + (c.passed ? "is-pass" : "is-fail") + '">' +
                 '<i aria-hidden="true">' + (c.passed ? "✓" : "✕") + '</i>' +
                 '<div><b>' + esc(c.label) + '</b><span>' + esc(c.detail) + '</span></div>' +
               '</div>';
      }).join("") + '</div></section>';

    /* What they wrote */
    html += '<section class="ar-section"><h3>What they wrote</h3>' +
      answer("Why they'd make a good admin", r.motivation) +
      answer("Achievements", r.achievements) +
      answer("Roles and responsibilities held", r.rolesHeld) +
      answer("Time offered", r.hoursPerWeek + " hours a week" +
             (r.preferredArea ? " · prefers " + r.preferredArea : "")) +
      '</section>';

    /* Endorsements */
    var mine = r.endorsements.some(function (e) { return e.adminId === myId; });
    html += '<section class="ar-section"><h3>Endorsements (' + r.endorsements.length + ' of ' + r.endorsementsNeeded + ')</h3>';
    html += r.endorsements.length
      ? r.endorsements.map(function (e) {
          return '<div class="ar-endorse"><b>' + esc(e.adminName) + '</b> ' +
                 '<span class="ar-muted">&middot; ' + esc(CSAdmin.fmtDate(e.createdAt)) + '</span>' +
                 '<p>' + esc(e.comment) + '</p></div>';
        }).join("")
      : '<p class="ar-muted">No one has endorsed this yet.</p>';

    if (r.status === "pending" && !mine) {
      html += '<div class="ar-box">' +
        '<label for="endorseText" class="ar-muted">Why do you vouch for them? (at least 20 characters)</label>' +
        '<textarea id="endorseText" placeholder="What you have seen them do, and why you trust them with admin access."></textarea>' +
        '<div class="ar-actions"><button class="btn btn-primary" type="button" id="doEndorse">Endorse</button></div>' +
      '</div>';
    } else if (r.status === "pending" && mine) {
      html += '<p class="ar-muted">You have endorsed this request.</p>';
    }
    html += '</section>';

    /* Interview */
    html += '<section class="ar-section"><h3>Interview</h3>';
    if (r.interviewNotes) {
      html += answer("Notes by " + (r.interviewedBy || "a Super Admin") + ", " + CSAdmin.fmtDate(r.interviewedAt), r.interviewNotes);
    } else {
      html += '<p class="ar-muted">No interview recorded yet.</p>';
    }
    if (r.status === "pending" && isSuper) {
      html += '<div class="ar-box">' +
        '<label for="interviewText" class="ar-muted">' + (r.interviewNotes ? "Update the notes" : "Record the interview") + ' (at least 30 characters)</label>' +
        '<textarea id="interviewText" placeholder="Questions asked, how they answered, any concerns.">' + esc(r.interviewNotes || "") + '</textarea>' +
        '<div class="ar-actions"><button class="btn btn-quiet" type="button" id="doInterview">Save interview notes</button></div>' +
      '</div>';
    }
    html += '</section>';

    /* Decision */
    html += '<section class="ar-section"><h3>Decision</h3>';
    if (r.status !== "pending") {
      html += '<p>' + pill(r.status) + ' by ' + esc(r.reviewedBy || "a Super Admin") +
              ' on ' + esc(CSAdmin.fmtDate(r.reviewedAt)) + '</p>' +
              (r.decisionNote ? answer("Note to the volunteer", r.decisionNote) : "");
    } else if (!isSuper) {
      html += '<p class="ar-muted">A Super Admin makes the final decision.</p>';
    } else {
      var ready = readiness(r);
      var allOk = ready.every(function (x) { return x.ok; });
      html += '<ul class="ar-ready">' + ready.map(function (x) {
        return '<li class="' + (x.ok ? "ok" : "no") + '">' + (x.ok ? "✓ " : "✕ ") + esc(x.text) + '</li>';
      }).join("") + '</ul>' +
      '<div class="ar-box">' +
        '<label for="decisionText" class="ar-muted">Note to the volunteer (required if you reject)</label>' +
        '<textarea id="decisionText" placeholder="They will see this."></textarea>' +
        '<div class="ar-actions">' +
          '<button class="btn btn-danger" type="button" id="doReject">Reject</button>' +
          '<button class="btn btn-primary" type="button" id="doApprove"' + (allOk ? '' : ' disabled title="Everything above must be ticked first"') + '>Approve &mdash; make them an admin</button>' +
        '</div>' +
      '</div>';
    }
    html += '</section>';

    bodyEl.innerHTML = html;
  }

  function open(id) {
    var r = byId(id);
    if (!r) return;
    openId = id;
    renderDetail(r);
    CSAdmin.openModal("reqModal");
  }

  /* ------------------------------------------------------------------
     Actions (delegated, since the modal is re-drawn after each one)
     ------------------------------------------------------------------ */

  function busy(btn, text) {
    btn.disabled = true;
    btn.dataset.label = btn.innerHTML;
    btn.textContent = text;
  }

  function after(work, btn, okMessage) {
    return work.then(function () {
      CSAdmin.toast(okMessage, "good");
      CSAdmin.refreshBadges();
      return load();
    }).catch(function (err) {
      CSAdmin.toast((err && err.detail) || "That didn't work. Try again.", "warn");
      if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.label; }
    });
  }

  bodyEl.addEventListener("click", function (e) {
    var r = byId(openId);
    if (!r) return;

    if (e.target.id === "doEndorse") {
      var comment = document.getElementById("endorseText").value.trim();
      if (comment.length < 20) { CSAdmin.toast("Say a little more about why (20+ characters)", "warn"); return; }
      busy(e.target, "Endorsing…");
      after(CSStore.promotion.endorse(r._id, comment), e.target, "Endorsement added");
    }

    if (e.target.id === "doInterview") {
      var notes = document.getElementById("interviewText").value.trim();
      if (notes.length < 30) { CSAdmin.toast("Interview notes need at least 30 characters", "warn"); return; }
      busy(e.target, "Saving…");
      after(CSStore.promotion.interview(r._id, notes), e.target, "Interview notes saved");
    }

    if (e.target.id === "doReject") {
      var why = document.getElementById("decisionText").value.trim();
      if (why.length < 10) { CSAdmin.toast("Give the volunteer a reason before rejecting", "warn"); return; }
      busy(e.target, "Rejecting…");
      after(CSStore.promotion.review(r._id, "rejected", why), e.target, "Request rejected");
    }

    if (e.target.id === "doApprove") {
      var note = document.getElementById("decisionText").value.trim();
      busy(e.target, "Approving…");
      after(CSStore.promotion.review(r._id, "approved", note), e.target,
            r.name + " is now an admin");
    }
  });

  rowsEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-open]");
    if (b) open(b.getAttribute("data-open"));
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

  /* ------------------------------------------------------------------
     Eligibility rules (Super Admin)
     ------------------------------------------------------------------ */

  var RULE_INPUTS = {
    minYears: "rYears", minHours: "rHours", minEvents: "rEvents", minAreas: "rAreas",
    minActiveMonths: "rActive", minAttendancePct: "rAttend", minEndorsements: "rEndorse"
  };

  document.getElementById("openRules").addEventListener("click", function () {
    CSStore.promotion.rules().then(function (rules) {
      Object.keys(RULE_INPUTS).forEach(function (k) {
        document.getElementById(RULE_INPUTS[k]).value = rules[k];
      });
      CSAdmin.openModal("rulesModal");
    }).catch(function (err) {
      CSAdmin.toast((err && err.detail) || "Couldn't load the rules", "warn");
    });
  });

  document.getElementById("saveRules").addEventListener("click", function () {
    var body = {};
    Object.keys(RULE_INPUTS).forEach(function (k) {
      var v = parseInt(document.getElementById(RULE_INPUTS[k]).value, 10);
      if (!isNaN(v)) body[k] = v;
    });
    CSStore.promotion.updateRules(body).then(function () {
      CSAdmin.closeModal("rulesModal");
      CSAdmin.toast("Rules saved. Every record is now checked against them.", "good");
      load();
    }).catch(function (err) {
      CSAdmin.toast((err && err.detail) || "Those rules didn't save", "warn");
    });
  });

  /* Closing the detail modal stops it being re-drawn on reload. */
  document.getElementById("reqModal").addEventListener("click", function (e) {
    if (e.target.closest("[data-close-modal]") || e.target.id === "reqModal") openId = null;
  });

  load();

})();
