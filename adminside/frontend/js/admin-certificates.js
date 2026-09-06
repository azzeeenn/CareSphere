/* ==========================================================================
   CareSphere — Certificates

   The organisation's name goes on whatever gets issued here, so the review
   modal doesn't just show what the volunteer typed. It independently works
   out what the records actually support — verified hours, whether they
   really attended that event — and says plainly when the claim and the
   records don't line up.
   ========================================================================== */

(function () {
  "use strict";

  var admin = CSAdmin.init();
  if (!admin) return;

  var all      = [];
  var evidence = {};   // certificate _id -> what the records support
  var status   = "pending";
  var type     = "all";
  var term     = "";
  var openId   = null;

  var rowsEl    = document.getElementById("rows");
  var emptyEl   = document.getElementById("emptyState");
  var summaryEl = document.getElementById("summaryRow");
  var esc       = CSAdmin.esc;

  var TYPES = CSStore.certificateTypes;

  var LABEL = {
    pending:  { text: "Pending",    cls: "is-pending"  },
    approved: { text: "Issued",     cls: "is-approved" },
    rejected: { text: "Not issued", cls: "is-rejected" }
  };

  function typeLabel(id) {
    var t = TYPES.filter(function (x) { return x.id === id; })[0];
    return t ? t.label : id;
  }

  function typeNeeds(id) {
    var t = TYPES.filter(function (x) { return x.id === id; })[0];
    return t ? t.needs : "";
  }

  /* ------------------------------------------------------------------
     Load, and work out what the records support
     ------------------------------------------------------------------ */

  function load() {
    return Promise.all([
      CSStore.find("certificates"),
      CSStore.find("hours"),
      CSStore.find("registrations"),
      CSStore.find("events")
    ]).then(function (r) {
      all = r[0].sort(function (a, b) {
        return new Date(b.requestedAt) - new Date(a.requestedAt);
      });

      var hours = r[1], regs = r[2], events = r[3];
      var eventById = {};
      events.forEach(function (e) { eventById[e._id] = e; });

      evidence = {};

      all.forEach(function (c) {
        var verified = hours.filter(function (h) {
          return h.userId === c.userId && h.status === "verified";
        }).reduce(function (s, h) { return s + h.hours; }, 0);

        var attended = regs.filter(function (g) {
          var e = eventById[g.eventId];
          return g.userId === c.userId &&
                 g.status !== "cancelled" &&
                 e && new Date(e.startsAt) < new Date();
        });

        var wasThere = c.eventId
          ? attended.some(function (g) { return g.eventId === c.eventId; })
          : null;

        evidence[c._id] = {
          verifiedHours: verified,
          eventsAttended: attended.length,
          wasThere: wasThere,
          photos: (c.proof || []).length,
          hasReference: !!(c.referenceName && c.referencePhone)
        };
      });

      render();
      CSAdmin.refreshBadges();
    });
  }

  /* Does the evidence back the request up? */
  function verdict(c) {
    var ev = evidence[c._id] || {};

    if (typeNeeds(c.type) === "verifiedHours") {
      return ev.verifiedHours > 0
        ? { ok: true,  text: ev.verifiedHours + " verified hours on record." }
        : { ok: false, text: "No verified hours on record. Nothing to certify yet." };
    }

    if (typeNeeds(c.type) === "event") {
      if (ev.wasThere === true)  return { ok: true,  text: "Registered for that event, and it has passed." };
      if (ev.wasThere === false) return { ok: false, text: "No registration found for that event under this volunteer." };
      return { ok: false, text: "No event named on the request." };
    }

    if (typeNeeds(c.type) === "reference") {
      return ev.hasReference
        ? { ok: true,  text: "Reference given \u2014 worth a phone call before issuing." }
        : { ok: false, text: "No contactable reference given." };
    }

    return { ok: true, text: "" };
  }

  /* ------------------------------------------------------------------
     Render
     ------------------------------------------------------------------ */

  function visible() {
    return all.filter(function (c) {
      if (status !== "all" && c.status !== status) return false;
      if (type   !== "all" && c.type   !== type)   return false;
      if (!term) return true;
      return (c.name + " " + c.certificateNo + " " + typeLabel(c.type))
              .toLowerCase().indexOf(term) !== -1;
    });
  }

  function render() {
    function n(s) { return all.filter(function (c) { return c.status === s; }).length; }

    var thin = all.filter(function (c) {
      return c.status === "pending" && !verdict(c).ok;
    }).length;

    summaryEl.innerHTML =
      '<div class="summary-chip is-hot"><b>' + n("pending")  + '</b><span>pending</span></div>' +
      '<div class="summary-chip"><b>'        + n("approved") + '</b><span>issued</span></div>' +
      '<div class="summary-chip"><b>'        + n("rejected") + '</b><span>declined</span></div>' +
      '<div class="summary-chip' + (thin ? " is-hot" : "") + '"><b>' + thin +
        '</b><span>evidence doesn\'t stack up</span></div>';

    var list = visible();

    if (!list.length) {
      rowsEl.innerHTML = "";
      emptyEl.hidden = false;
      document.getElementById("emptyTitle").textContent = term ? "No matches" : "Nothing to review";
      document.getElementById("emptyBody").textContent = term
        ? "Try a different search."
        : "Certificate requests from volunteers will appear here.";
      return;
    }

    emptyEl.hidden = true;

    rowsEl.innerHTML = list.map(function (c) {
      var badge = LABEL[c.status] || LABEL.pending;
      var ev    = evidence[c._id] || {};
      var v     = verdict(c);

      var bits = [];
      if (ev.photos)       bits.push(ev.photos + (ev.photos === 1 ? " photo" : " photos"));
      if (ev.hasReference) bits.push("reference");
      if (typeNeeds(c.type) === "verifiedHours") bits.push(ev.verifiedHours + " hrs verified");

      return '' +
        '<tr>' +
          '<td>' +
            '<span class="avatar-cell">' +
              '<span class="avatar-sm">' + esc(c.name.charAt(0)) + '</span>' +
              '<span>' +
                '<span class="cell-primary">' + esc(c.name) + '</span>' +
                '<span class="cell-sub">' + esc(c.email) + '</span>' +
              '</span>' +
            '</span>' +
          '</td>' +
          '<td style="max-width:250px">' +
            '<span class="cell-primary">' + esc(typeLabel(c.type)) + '</span>' +
            (c.eventTitle ? '<span class="cell-sub">' + esc(c.eventTitle) + '</span>' : '') +
            (c.certificateNo ? '<span class="cell-sub">' + esc(c.certificateNo) + '</span>' : '') +
          '</td>' +
          '<td>' +
            (bits.length
              ? esc(bits.join(" \u00B7 "))
              : '<span style="color:var(--cs-muted)">Nothing attached</span>') +
            (c.status === "pending" && !v.ok
              ? '<span class="cell-sub" style="color:var(--cs-coral-dark)">Check before issuing</span>'
              : '') +
          '</td>' +
          '<td>' + CSAdmin.fmtDate(c.requestedAt) +
            '<span class="cell-sub">' + CSAdmin.daysAgo(c.requestedAt) + '</span></td>' +
          '<td><span class="status-badge ' + badge.cls + '">' + badge.text + '</span></td>' +
          '<td class="cell-actions">' +
            '<button class="btn btn-quiet btn-sm" data-open="' + c._id + '">Review</button>' +
          '</td>' +
        '</tr>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Review modal
     ------------------------------------------------------------------ */

  function field(label, value, full) {
    return '<div class="detail' + (full ? " full" : "") + '">' +
             '<dt>' + label + '</dt>' +
             '<dd>' + esc(value || "\u2014") + '</dd>' +
           '</div>';
  }

  function block(label, value) {
    return '<div class="detail full">' +
             '<dt>' + label + '</dt>' +
             '<dd class="detail-block">' + esc(value || "\u2014") + '</dd>' +
           '</div>';
  }

  function openReview(id) {
    var c = all.filter(function (x) { return x._id === id; })[0];
    if (!c) return;
    openId = id;

    var ev = evidence[id] || {};
    var v  = verdict(c);

    document.getElementById("reviewName").textContent = c.name;
    document.getElementById("reviewMeta").textContent =
      typeLabel(c.type) + " \u00B7 requested " + CSAdmin.fmtDate(c.requestedAt);

    document.getElementById("evidenceBox").innerHTML =
      '<div class="evidence' + (v.ok ? "" : " is-thin") + '">' +
        '<span><b>' + (v.ok ? "The records back this up." : "Worth checking first.") +
        '</b> ' + esc(v.text) + '</span>' +
      '</div>';

    var photos = (c.proof || []).length
      ? '<div class="detail full">' +
          '<dt>Photos supplied</dt>' +
          '<dd><div class="proof-grid">' +
            c.proof.map(function (src, i) {
              /* Uploaded files live on the API server, not on the port
                 that serves these pages, so the path needs its host
                 putting back before an <img> can load it. */
              return '<button class="proof-view" type="button" data-photo="' + i + '">' +
                       '<img src="' + CSStore.fileUrl(src) + '" alt="Proof ' + (i + 1) + '">' +
                     '</button>';
            }).join("") +
          '</div></dd>' +
        '</div>'
      : '';

    document.getElementById("reviewGrid").innerHTML =
      field("Certificate type", typeLabel(c.type)) +
      field("Email", c.email) +
      field("Verified hours on record", ev.verifiedHours + " hrs") +
      field("Past events attended", ev.eventsAttended) +
      (c.eventTitle ? field("Event named", c.eventTitle, true) : "") +
      block("What they need it for", c.purpose) +
      (c.referenceName
        ? field("Reference", c.referenceName + " \u2014 " + c.referenceRole) +
          field("Reference phone", c.referencePhone)
        : "") +
      photos +
      (c.status === "approved"
        ? field("Issued", c.certificateNo + " on " + CSAdmin.fmtDate(c.issuedAt), true)
        : "") +
      (c.status === "rejected" && c.note ? block("Reason given", c.note) : "") +
      (c.reviewedAt
        ? field("Reviewed", CSAdmin.fmtDate(c.reviewedAt) + " by " + (c.reviewedBy || "\u2014"), true)
        : "");

    var foot = document.getElementById("reviewFoot");

    if (c.status === "approved") {
      foot.innerHTML =
        '<span class="spacer status-badge is-approved">Issued as ' + esc(c.certificateNo) + '</span>' +
        '<a class="btn btn-quiet" href="../../../frontend/html/certificate.html?id=' +
          encodeURIComponent(c._id) + '">View certificate</a>' +
        '<button class="btn btn-quiet" type="button" data-close-modal>Close</button>';
    } else if (c.status === "rejected") {
      foot.innerHTML =
        '<span class="spacer status-badge is-rejected">Declined</span>' +
        '<button class="btn btn-quiet" type="button" data-reopen>Move back to pending</button>' +
        '<button class="btn btn-quiet" type="button" data-close-modal>Close</button>';
    } else {
      foot.innerHTML =
        '<button class="btn btn-quiet spacer" type="button" data-close-modal>Cancel</button>' +
        '<button class="btn btn-danger" type="button" data-decline>Decline</button>' +
        '<button class="btn btn-primary" type="button" data-issue>Issue certificate</button>';
    }

    CSAdmin.openModal("reviewModal");
  }

  /* Lightbox for the proof photos */
  document.getElementById("reviewGrid").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-photo]");
    if (!btn) return;
    var c = all.filter(function (x) { return x._id === openId; })[0];
    document.getElementById("lightboxImg").src =
      CSStore.fileUrl(c.proof[parseInt(btn.getAttribute("data-photo"), 10)]);
    document.getElementById("lightbox").classList.add("is-open");
  });

  document.getElementById("lightbox").addEventListener("click", function () {
    this.classList.remove("is-open");
  });

  /* ------------------------------------------------------------------
     Issue
     ------------------------------------------------------------------ */

  function nextNumber() {
    var year   = new Date().getFullYear();
    var prefix = "CS-CERT-" + year + "-";

    var used = all
      .map(function (c) { return c.certificateNo; })
      .filter(function (n) { return n && n.indexOf(prefix) === 0; })
      .map(function (n) { return parseInt(n.slice(prefix.length), 10); })
      .filter(function (n) { return !isNaN(n); });

    return prefix + String(used.length ? Math.max.apply(null, used) + 1 : 1).padStart(4, "0");
  }

  function openIssue() {
    var c = all.filter(function (x) { return x._id === openId; })[0];

    document.getElementById("issueSub").textContent =
      c.name + " \u00B7 " + typeLabel(c.type);

    var box = document.getElementById("iNumber");
    box.value = nextNumber();
    box.closest(".field").classList.remove("has-error");
    document.getElementById("iNumberError").textContent = "";

    CSAdmin.closeModal("reviewModal");
    CSAdmin.openModal("issueModal");
  }

  document.getElementById("confirmIssue").addEventListener("click", function () {
    var box   = document.getElementById("iNumber");
    var value = box.value.trim();

    if (value.length < 4) {
      box.closest(".field").classList.add("has-error");
      document.getElementById("iNumberError").textContent = "Enter a certificate number.";
      box.focus();
      return;
    }

    var clash = all.some(function (c) {
      return c._id !== openId && c.certificateNo === value;
    });

    if (clash) {
      box.closest(".field").classList.add("has-error");
      document.getElementById("iNumberError").textContent =
        "That number is already on another certificate.";
      box.focus();
      return;
    }

    var c = all.filter(function (x) { return x._id === openId; })[0];

    CSStore.updateById("certificates", openId, {
      status: "approved",
      certificateNo: value,
      issuedAt: CSAdmin.today(),
      reviewedAt: CSAdmin.today(),
      reviewedBy: admin.name,
      note: ""
    }).then(function () {
      CSAdmin.closeModal("issueModal");
      CSAdmin.toast("Issued to " + c.name + " as " + value, "good");
      load();
    });
  });

  /* ------------------------------------------------------------------
     Decline
     ------------------------------------------------------------------ */

  function openDecline() {
    var box = document.getElementById("dReason");
    box.value = "";
    box.closest(".field").classList.remove("has-error");
    document.getElementById("dReasonError").textContent = "";

    CSAdmin.closeModal("reviewModal");
    CSAdmin.openModal("declineModal");
  }

  document.getElementById("confirmDecline").addEventListener("click", function () {
    var box  = document.getElementById("dReason");
    var text = box.value.trim();

    if (text.length < 10) {
      box.closest(".field").classList.add("has-error");
      document.getElementById("dReasonError").textContent =
        "Write a short reason so they know what to do next.";
      box.focus();
      return;
    }

    var c = all.filter(function (x) { return x._id === openId; })[0];

    CSStore.updateById("certificates", openId, {
      status: "rejected",
      note: text,
      reviewedAt: CSAdmin.today(),
      reviewedBy: admin.name
    }).then(function () {
      CSAdmin.closeModal("declineModal");
      CSAdmin.toast("Request from " + c.name + " declined", "warn");
      load();
    });
  });

  /* ------------------------------------------------------------------
     Events
     ------------------------------------------------------------------ */

  rowsEl.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-open]");
    if (btn) openReview(btn.getAttribute("data-open"));
  });

  document.getElementById("reviewFoot").addEventListener("click", function (e) {
    if (e.target.closest("[data-issue]"))   openIssue();
    if (e.target.closest("[data-decline]")) openDecline();

    if (e.target.closest("[data-reopen]")) {
      CSStore.updateById("certificates", openId, {
        status: "pending", note: "", reviewedAt: null, reviewedBy: null
      }).then(function () {
        CSAdmin.closeModal("reviewModal");
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

  document.getElementById("typeFilter").addEventListener("change", function () {
    type = this.value; render();
  });

  var typing;
  document.getElementById("searchBox").addEventListener("input", function () {
    var v = this.value.trim().toLowerCase();
    clearTimeout(typing);
    typing = setTimeout(function () { term = v; render(); }, 160);
  });

  /* ------------------------------------------------------------------ */

  document.getElementById("typeFilter").innerHTML =
    '<option value="all">All types</option>' +
    TYPES.map(function (t) {
      return '<option value="' + esc(t.id) + '">' + esc(t.label) + '</option>';
    }).join("");

  load();

})();
