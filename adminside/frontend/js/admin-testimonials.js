/* ==========================================================================
   CareSphere — Testimonials

   Same approve/reject shape as applications, with one addition: the admin
   can tidy the wording before publishing, and mark a story as featured.
   ========================================================================== */

(function () {
  "use strict";

  CSAdmin.init();

  var all    = [];
  var status = "pending";
  var term   = "";
  var openId = null;      // null while adding a new one

  var rowsEl    = document.getElementById("rows");
  var emptyEl   = document.getElementById("emptyState");
  var summaryEl = document.getElementById("summaryRow");

  var F = {
    name:     document.getElementById("tName"),
    role:     document.getElementById("tRole"),
    body:     document.getElementById("tBody"),
    featured: document.getElementById("tFeatured")
  };

  var LABEL = {
    pending:  { text: "Pending",  cls: "is-pending"  },
    approved: { text: "Approved", cls: "is-approved" },
    rejected: { text: "Rejected", cls: "is-rejected" }
  };

  /* ------------------------------------------------------------------ */

  function load() {
    return CSStore.find("testimonials").then(function (docs) {
      all = docs.sort(function (a, b) {
        return new Date(b.submittedAt) - new Date(a.submittedAt);
      });
      render();
      CSAdmin.refreshBadges();
    });
  }

  function visible() {
    return all.filter(function (t) {
      if (status !== "all" && t.status !== status) return false;
      if (!term) return true;
      return (t.name + " " + t.role + " " + t.body).toLowerCase().indexOf(term) !== -1;
    });
  }

  function trim(text, n) {
    return text.length > n ? text.slice(0, n).trim() + "\u2026" : text;
  }

  /* ------------------------------------------------------------------ */

  function renderSummary() {
    function n(s) { return all.filter(function (t) { return t.status === s; }).length; }
    var featured = all.filter(function (t) { return t.featured && t.status === "approved"; }).length;

    summaryEl.innerHTML =
      '<div class="summary-chip is-hot"><b>' + n("pending")  + '</b><span>pending</span></div>' +
      '<div class="summary-chip"><b>'        + n("approved") + '</b><span>live on the site</span></div>' +
      '<div class="summary-chip"><b>'        + featured      + '</b><span>featured on homepage</span></div>' +
      '<div class="summary-chip"><b>'        + n("rejected") + '</b><span>rejected</span></div>';
  }

  function render() {
    renderSummary();

    var list = visible();
    var esc  = CSAdmin.esc;

    if (!list.length) {
      rowsEl.innerHTML = "";
      emptyEl.hidden = false;
      document.getElementById("emptyTitle").textContent = term ? "No matches" : "Nothing to review";
      document.getElementById("emptyBody").textContent = term
        ? "Try a different search."
        : "Stories submitted through the site appear here before they go live.";
      return;
    }

    emptyEl.hidden = true;

    rowsEl.innerHTML = list.map(function (t) {
      var badge = LABEL[t.status] || LABEL.pending;

      return '' +
        '<tr>' +
          '<td>' +
            '<span class="avatar-cell">' +
              '<span class="avatar-sm">' + esc(t.name.charAt(0)) + '</span>' +
              '<span>' +
                '<span class="cell-primary">' + esc(t.name) + '</span>' +
                '<span class="cell-sub">' + esc(t.role) + '</span>' +
              '</span>' +
            '</span>' +
          '</td>' +
          '<td style="max-width:360px">' + esc(trim(t.body, 120)) +
            (t.featured && t.status === "approved"
              ? '<span class="cell-sub"><span class="tag is-healthcare">Featured on homepage</span></span>' : '') +
          '</td>' +
          '<td>' + CSAdmin.fmtDate(t.submittedAt) + '</td>' +
          '<td><span class="status-badge ' + badge.cls + '">' + badge.text + '</span></td>' +
          '<td class="cell-actions">' +
            '<button class="btn btn-quiet btn-sm" data-open="' + t._id + '">Read</button>' +
          '</td>' +
        '</tr>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Modal
     ------------------------------------------------------------------ */

  function clearErrors() {
    ["tName", "tRole", "tBody"].forEach(function (id) {
      document.getElementById(id).closest(".field").classList.remove("has-error");
      document.getElementById(id + "Error").textContent = "";
    });
  }

  function validate() {
    clearErrors();
    var ok = true, first = null;

    function bad(id, msg) {
      var el = document.getElementById(id);
      el.closest(".field").classList.add("has-error");
      document.getElementById(id + "Error").textContent = msg;
      if (!first) first = el;
      ok = false;
    }

    if (F.name.value.trim().length < 2)  bad("tName", "Who is this from?");
    if (!F.role.value.trim())            bad("tRole", "Add their role and district, for example: Parent, Mandya.");
    if (F.body.value.trim().length < 20) bad("tBody", "The story is too short to publish.");

    if (first) first.focus();
    return ok;
  }

  function openReview(id) {
    openId = id;
    clearErrors();

    var t = id ? all.filter(function (x) { return x._id === id; })[0] : null;

    document.getElementById("reviewTitle").textContent = t ? "Review story" : "Add a testimonial";
    document.getElementById("reviewSub").textContent = t
      ? "Submitted " + CSAdmin.fmtDate(t.submittedAt) + " · " + CSAdmin.daysAgo(t.submittedAt)
      : "Use this for stories collected offline.";

    F.name.value     = t ? t.name : "";
    F.role.value     = t ? t.role : "";
    F.body.value     = t ? t.body : "";
    F.featured.value = t && t.featured ? "yes" : "no";

    var foot = document.getElementById("reviewFoot");

    if (!t) {
      foot.innerHTML =
        '<button class="btn btn-quiet spacer" type="button" data-close-modal>Cancel</button>' +
        '<button class="btn btn-primary" type="button" data-create>Add and publish</button>';
    } else if (t.status === "approved") {
      foot.innerHTML =
        '<span class="spacer status-badge is-approved">Live on the site</span>' +
        '<button class="btn btn-danger" type="button" data-unpublish>Unpublish</button>' +
        '<button class="btn btn-primary" type="button" data-save>Save changes</button>';
    } else if (t.status === "rejected") {
      foot.innerHTML =
        '<span class="spacer status-badge is-rejected">Rejected</span>' +
        '<button class="btn btn-quiet" type="button" data-reopen>Move back to pending</button>' +
        '<button class="btn btn-primary" type="button" data-approve>Approve anyway</button>';
    } else {
      foot.innerHTML =
        '<button class="btn btn-quiet spacer" type="button" data-close-modal>Cancel</button>' +
        '<button class="btn btn-danger" type="button" data-reject>Reject</button>' +
        '<button class="btn btn-primary" type="button" data-approve>Approve and publish</button>';
    }

    CSAdmin.openModal("reviewModal");
  }

  function payload() {
    return {
      name:     F.name.value.trim(),
      role:     F.role.value.trim(),
      body:     F.body.value.trim(),
      featured: F.featured.value === "yes"
    };
  }

  document.getElementById("reviewFoot").addEventListener("click", function (e) {
    var t = openId ? all.filter(function (x) { return x._id === openId; })[0] : null;

    /* Create */
    if (e.target.closest("[data-create]")) {
      if (!validate()) return;
      CSStore.insert("testimonials", Object.assign(payload(), {
        status: "approved",
        submittedAt: CSAdmin.today()
      })).then(function () {
        CSAdmin.closeModal("reviewModal");
        CSAdmin.toast("Testimonial published", "good");
        load();
      });
      return;
    }

    /* Approve */
    if (e.target.closest("[data-approve]")) {
      if (!validate()) return;
      CSStore.updateById("testimonials", openId,
        Object.assign(payload(), { status: "approved" })
      ).then(function () {
        CSAdmin.closeModal("reviewModal");
        CSAdmin.toast(
          payload().featured
            ? "Published and featured on the homepage"
            : "Published on the testimonials page",
          "good"
        );
        load();
      });
      return;
    }

    /* Save edits to something already live */
    if (e.target.closest("[data-save]")) {
      if (!validate()) return;
      CSStore.updateById("testimonials", openId, payload()).then(function () {
        CSAdmin.closeModal("reviewModal");
        CSAdmin.toast("Changes saved", "good");
        load();
      });
      return;
    }

    /* Reject */
    if (e.target.closest("[data-reject]")) {
      CSStore.updateById("testimonials", openId, { status: "rejected", featured: false })
        .then(function () {
          CSAdmin.closeModal("reviewModal");
          CSAdmin.toast("Story from " + t.name + " rejected", "warn");
          load();
        });
      return;
    }

    /* Unpublish */
    if (e.target.closest("[data-unpublish]")) {
      CSStore.updateById("testimonials", openId, { status: "pending", featured: false })
        .then(function () {
          CSAdmin.closeModal("reviewModal");
          CSAdmin.toast("Taken off the site and moved back to pending", "warn");
          load();
        });
      return;
    }

    /* Reopen */
    if (e.target.closest("[data-reopen]")) {
      CSStore.updateById("testimonials", openId, { status: "pending" }).then(function () {
        CSAdmin.closeModal("reviewModal");
        CSAdmin.toast("Moved back to pending");
        load();
      });
    }
  });

  /* ------------------------------------------------------------------ */

  document.getElementById("newTestimonial").addEventListener("click", function () {
    openReview(null);
  });

  rowsEl.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-open]");
    if (btn) openReview(btn.getAttribute("data-open"));
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
