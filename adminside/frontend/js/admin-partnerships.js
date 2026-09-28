/* ==========================================================================
   CareSphere: Partnerships

   Requests from the "Partner With Us" form on institutions.html.
   An admin opens one, assigns it, keeps internal notes, and moves it
   along: new -> contacted -> active partner (or declined).

   "Draft in Gmail" opens a reply to the contact, worded to match the
   status, the same way the Messages page replies to enquiries.
   ========================================================================== */

(function () {
  "use strict";

  if (!CSAdmin.init()) return;

  var esc    = CSAdmin.esc;
  var all    = [];
  var staff  = [];
  var status = "new";
  var term   = "";
  var openId = null;

  var rowsEl  = document.getElementById("rows");
  var emptyEl = document.getElementById("emptyState");

  var TYPES = {
    "school": "School",
    "college": "College",
    "community-center": "Community centre",
    "ngo": "NGO",
    "corporate": "Company"
  };

  var STATUS_LABEL = {
    "new": "New",
    "contacted": "Contacted",
    "active": "Active partner",
    "declined": "Declined"
  };

  /* ------------------------------------------------------------------ */

  function load() {
    return CSStore.find("partnerships").then(function (rows) {
      all = rows.sort(function (a, b) {
        return new Date(b.receivedAt) - new Date(a.receivedAt);
      });
      render();
    }).catch(function (err) {
      CSAdmin.toast((err && err.detail) || "Couldn't load partnership requests", "warn");
    });
  }

  function loadStaff() {
    return CSStore.staff().then(function (rows) {
      staff = rows || [];
    }).catch(function () { staff = []; });
  }

  function byId(id) {
    return all.filter(function (p) { return p._id === id; })[0];
  }

  function visible() {
    return all.filter(function (p) {
      if (status !== "all" && p.status !== status) return false;
      if (!term) return true;
      return [p.institutionName, p.contactName, p.location, p.email]
        .join(" ").toLowerCase().indexOf(term) !== -1;
    });
  }

  function statusTag(s) {
    var cls = s === "active" ? "is-green" : s === "declined" ? "is-healthcare" : "is-education";
    return '<span class="tag ' + cls + '">' + esc(STATUS_LABEL[s] || s) + '</span>';
  }

  /* ------------------------------------------------------------------ */

  function render() {
    function count(s) { return all.filter(function (p) { return p.status === s; }).length; }

    document.getElementById("summaryRow").innerHTML =
      '<div class="summary-chip"><b>' + count("new") + '</b><span>new</span></div>' +
      '<div class="summary-chip"><b>' + count("contacted") + '</b><span>contacted</span></div>' +
      '<div class="summary-chip"><b>' + count("active") + '</b><span>active partners</span></div>' +
      '<div class="summary-chip"><b>' + count("declined") + '</b><span>declined</span></div>';

    var list = visible();

    if (!list.length) {
      rowsEl.innerHTML = "";
      emptyEl.hidden = false;
      document.getElementById("emptyTitle").textContent = term ? "No matches" : "Nothing here";
      document.getElementById("emptyBody").textContent = term
        ? "Try a different search."
        : (status === "new"
            ? "No new partnership requests from the institutions page."
            : "No requests with this status.");
      return;
    }

    emptyEl.hidden = true;

    rowsEl.innerHTML = list.map(function (p) {
      return '' +
        '<tr>' +
          '<td><span class="cell-primary">' + esc(p.institutionName) + '</span><br>' +
              '<span class="cell-secondary">' + esc(TYPES[p.type] || p.type) +
              (p.location ? ' · ' + esc(p.location) : '') + '</span></td>' +
          '<td>' + esc(p.contactName || "") +
              (p.contactRole ? '<br><span class="cell-secondary">' + esc(p.contactRole) + '</span>' : '') + '</td>' +
          '<td>' + esc(CSAdmin.fmtDate(p.receivedAt)) + '</td>' +
          '<td>' + (p.childCount != null ? esc(p.childCount) : "Not given") + '</td>' +
          '<td>' + (p.assignedTo ? esc(p.assignedTo) : "Nobody yet") + '</td>' +
          '<td>' + statusTag(p.status) + '</td>' +
          '<td class="cell-actions"><button class="btn btn-quiet btn-sm" data-open="' + esc(p._id) + '">Open</button></td>' +
        '</tr>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Detail modal
     ------------------------------------------------------------------ */

  function set(id, text) {
    document.getElementById(id).textContent = (text === null || text === undefined || text === "")
      ? "Not given" : text;
  }

  function fillAssign(current) {
    var sel = document.getElementById("pAssign");
    sel.innerHTML = '<option value="">Nobody yet</option>' + staff.map(function (s) {
      return '<option value="' + esc(s._id) + '">' + esc(s.name) + '</option>';
    }).join("");

    /* The API sends back the assignee's name, so match on that. */
    var match = staff.filter(function (s) { return s.name === current; })[0];
    sel.value = match ? match._id : "";
  }

  function draft(p, statusValue) {
    var me = CSStore.session.get() || {};
    var hello = "Dear " + (p.contactName || "Sir/Madam") + ",\n\n";
    var sign = "\n\nWarm regards,\n" + (me.name || "The CareSphere team") + "\nCareSphere Foundation";
    var body;

    if (statusValue === "active") {
      body = "Thank you for reaching out on behalf of " + p.institutionName + ". We're glad to confirm " +
             "that we'd like to work with you. We'll be in touch shortly to agree on the next steps " +
             "and a start date.";
    } else if (statusValue === "declined") {
      body = "Thank you for your interest in partnering with CareSphere on behalf of " + p.institutionName +
             ". Unfortunately we aren't able to take this forward at the moment. We'll keep your details " +
             "and would be happy to talk again in future.";
    } else {
      body = "Thank you for your partnership request on behalf of " + p.institutionName + ". " +
             "We'd like to learn a little more about what you have in mind. Could you let us know a " +
             "good time for a short call?";
    }

    return {
      subject: "Your partnership request with CareSphere",
      body: hello + body + sign
    };
  }

  function updateReplyLink() {
    var p = byId(openId);
    if (!p) return;
    var d = draft(p, document.getElementById("pStatus").value);
    var link = document.getElementById("pReply");

    if (p.email) {
      link.href = "https://mail.google.com/mail/?view=cm&fs=1" +
        "&to=" + encodeURIComponent(p.email) +
        "&su=" + encodeURIComponent(d.subject) +
        "&body=" + encodeURIComponent(d.body);
      link.removeAttribute("aria-disabled");
      link.style.pointerEvents = "";
      link.style.opacity = "";
    } else {
      link.removeAttribute("href");
      link.setAttribute("aria-disabled", "true");
      link.style.pointerEvents = "none";
      link.style.opacity = "0.5";
    }
  }

  function open(id) {
    var p = byId(id);
    if (!p) return;
    openId = id;

    document.getElementById("pName").textContent = p.institutionName;
    document.getElementById("pMeta").textContent =
      (STATUS_LABEL[p.status] || p.status) + " · received " + CSAdmin.fmtDate(p.receivedAt);

    set("pType", TYPES[p.type] || p.type);
    set("pLocation", p.location);
    set("pContact", p.contactName);
    set("pRole", p.contactRole);
    set("pEmail", p.email);
    set("pPhone", p.phone);
    set("pChildren", p.childCount);
    set("pReceived", CSAdmin.fmtDate(p.receivedAt));
    set("pMessage", p.message);

    fillAssign(p.assignedTo);
    document.getElementById("pStatus").value = p.status;
    document.getElementById("pNotes").value = p.notes || "";

    updateReplyLink();
    CSAdmin.openModal("partnerModal");
  }

  function save(newStatus, message) {
    var p = byId(openId);
    if (!p) return;

    var changes = {
      status: newStatus || document.getElementById("pStatus").value,
      assignedTo: document.getElementById("pAssign").value || null,
      notes: document.getElementById("pNotes").value.trim()
    };

    CSStore.updateById("partnerships", p._id, changes).then(function () {
      CSAdmin.closeModal("partnerModal");
      CSAdmin.toast(message || "Saved", "good");
      CSAdmin.refreshBadges();
      load();
    }).catch(function (err) {
      CSAdmin.toast((err && err.detail) || "That didn't save. Try again.", "warn");
    });
  }

  document.getElementById("savePartner").addEventListener("click", function () { save(null, "Saved"); });

  document.getElementById("acceptPartner").addEventListener("click", function () {
    var p = byId(openId);
    save("active", p.institutionName + " is now an active partner");
  });

  document.getElementById("declinePartner").addEventListener("click", function () {
    var p = byId(openId);
    if (!window.confirm("Decline the request from " + p.institutionName + "?")) return;
    save("declined", "Request declined");
  });

  document.getElementById("pStatus").addEventListener("change", updateReplyLink);

  document.getElementById("pCopyDraft").addEventListener("click", function () {
    var p = byId(openId);
    var d = draft(p, document.getElementById("pStatus").value);
    var text = "Subject: " + d.subject + "\n\n" + d.body;

    function done() { CSAdmin.toast("Draft copied", "good"); }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { window.prompt("Copy this:", text); });
    } else {
      window.prompt("Copy this:", text);
    }
  });

  /* ------------------------------------------------------------------ */

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

  loadStaff().then(load);

})();
