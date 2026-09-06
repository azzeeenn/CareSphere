/* ==========================================================================
   CareSphere — Partnerships

   Requests from the public "Partner With Us" form.

   Three things worth knowing before you read on:

   1. Saving used to make a row look like it had been deleted. The list
      only draws rows matching the selected chip, so changing a request
      from New to Contacted dropped it out of a New-filtered list. It now
      moves the chip to follow the record.

   2. Accept and Decline are explicit buttons, matching how applications,
      hours, certificates and testimonials are reviewed. The dropdown is
      still there for the in-between step.

   3. Draft in Gmail opens Gmail's compose window in a new tab with the
      address, subject and body already filled in, worded for wherever
      the request has got to. Nothing is sent by the server — a person
      still reads it and presses send.

      This used to be a mailto: link, which needs a mail app registered
      on the machine. On a laptop with no default mail client Windows
      just asks which app to use and then opens an empty browser tab, so
      the draft never appeared. A plain https URL has no such problem.
   ========================================================================== */

(function () {
  "use strict";

  CSAdmin.init();

  var all    = [];
  var admins = [];
  var status = "new";
  var term   = "";
  var openId = null;

  var rowsEl    = document.getElementById("rows");
  var emptyEl   = document.getElementById("emptyState");
  var summaryEl = document.getElementById("summaryRow");

  var LABEL = {
    new:       { text: "New",       cls: "is-new"      },
    contacted: { text: "Contacted", cls: "is-progress" },
    active:    { text: "Active",    cls: "is-resolved" },
    declined:  { text: "Declined",  cls: "is-off"      }
  };

  /* These are the five the database CheckConstraint allows. "other" was
     listed here before and is not one of them, so anything picking it was
     rejected by Postgres. */
  var TYPE = {
    "school":           "School",
    "college":          "College / University",
    "community-center": "Community / Care Centre",
    "ngo":              "NGO / Other",
    "corporate":        "Corporate"
  };

  /* Who is signed in, for the sign-off on drafted emails. */
  function myName() {
    try {
      var me = CSAuth.current();
      return (me && me.name) || "The CareSphere team";
    } catch (e) {
      return "The CareSphere team";
    }
  }

  /* ------------------------------------------------------------------ */

  function load() {
    return Promise.all([
      CSStore.find("partnerships"),
      CSStore.find("users")
    ]).then(function (r) {

      all = r[0].sort(function (a, b) {
        return new Date(b.receivedAt) - new Date(a.receivedAt);
      });

      admins = r[1].filter(function (u) {
        return (u.role === "admin" || u.role === "super_admin") && u.active;
      });

      document.getElementById("pAssign").innerHTML =
        '<option value="">Nobody yet</option>' +
        admins.map(function (u) {
          return '<option value="' + CSAdmin.esc(u.name) + '">' + CSAdmin.esc(u.name) + '</option>';
        }).join("");

      render();
      CSAdmin.refreshBadges();
    });
  }

  function visible() {
    return all.filter(function (p) {
      if (status !== "all" && p.status !== status) return false;
      if (!term) return true;
      return (p.institutionName + " " + p.contactName + " " +
              p.location + " " + p.email).toLowerCase().indexOf(term) !== -1;
    });
  }

  /* Move the chip to wherever the record just went, so saving never looks
     like deleting. Nothing to do if the list already shows everything. */
  function followFilter(newStatus) {
    if (status === "all" || status === newStatus) return;

    var bar  = document.getElementById("statusFilter");
    var chip = bar.querySelector('[data-status="' + newStatus + '"]');
    if (!chip) return;

    bar.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("is-on"); });
    chip.classList.add("is-on");
    status = newStatus;
  }

  /* ------------------------------------------------------------------ */

  function renderSummary() {
    function n(s) { return all.filter(function (p) { return p.status === s; }).length; }
    var unassigned = all.filter(function (p) {
      return p.status !== "declined" && p.status !== "active" && !p.assignedTo;
    }).length;

    summaryEl.innerHTML =
      '<div class="summary-chip is-hot"><b>' + n("new") + '</b><span>new</span></div>' +
      '<div class="summary-chip"><b>' + n("contacted") + '</b><span>contacted</span></div>' +
      '<div class="summary-chip"><b>' + unassigned + '</b><span>unassigned</span></div>' +
      '<div class="summary-chip"><b>' + n("active") + '</b><span>active partners</span></div>';
  }

  function render() {
    renderSummary();

    var list = visible();
    var esc  = CSAdmin.esc;

    if (!list.length) {
      rowsEl.innerHTML = "";
      emptyEl.hidden = false;
      document.getElementById("emptyTitle").textContent = term ? "No matches" : "Nothing here";
      document.getElementById("emptyBody").textContent = term
        ? "Try a different search."
        : "No requests with this status. Try another chip, or All.";
      return;
    }

    emptyEl.hidden = true;

    rowsEl.innerHTML = list.map(function (p) {
      var badge = LABEL[p.status] || LABEL.new;

      return '' +
        '<tr>' +
          '<td>' +
            '<span class="avatar-cell">' +
              '<span class="avatar-sm">' + esc(p.institutionName.charAt(0)) + '</span>' +
              '<span>' +
                '<span class="cell-primary">' + esc(p.institutionName) + '</span>' +
                '<span class="cell-sub">' + esc(TYPE[p.type] || p.type) + ' &middot; ' + esc(p.location) + '</span>' +
              '</span>' +
            '</span>' +
          '</td>' +
          '<td>' +
            '<span class="cell-primary">' + esc(p.contactName) + '</span>' +
            '<span class="cell-sub">' + esc(p.contactRole || p.email) + '</span>' +
          '</td>' +
          '<td>' + CSAdmin.fmtDate(p.receivedAt) +
            '<span class="cell-sub">' + CSAdmin.daysAgo(p.receivedAt) + '</span></td>' +
          '<td>' + (p.childCount ? esc(String(p.childCount)) : '<span style="color:var(--cs-muted)">Not given</span>') + '</td>' +
          '<td>' + (p.assignedTo ? esc(p.assignedTo) : '<span style="color:var(--cs-muted)">Nobody</span>') + '</td>' +
          '<td><span class="status-badge ' + badge.cls + '">' + badge.text + '</span></td>' +
          '<td class="cell-actions">' +
            '<button class="btn btn-quiet btn-sm" data-open="' + p._id + '">Open</button>' +
          '</td>' +
        '</tr>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Email drafts

     There is no mail server behind CareSphere, so this builds a mailto
     link with the subject and body filled in. The admin's own mail app
     opens, they read the draft, edit anything they want and send it.
     ------------------------------------------------------------------ */

  function draftFor(p, forStatus) {
    var who  = p.contactName || "Sir or Madam";
    var inst = p.institutionName;
    var sign = "Warm regards,\n" + myName() + "\nCareSphere Foundation";

    if (forStatus === "active") {
      return {
        subject: "CareSphere partnership with " + inst + " — confirmed",
        body:
          "Dear " + who + ",\n\n" +
          "I'm glad to confirm that CareSphere Foundation would like to go " +
          "ahead with a partnership with " + inst + ".\n\n" +
          "Our suggested next steps:\n\n" +
          "1. A short planning call to agree which programmes suit your students " +
          "and what the schedule looks like.\n" +
          "2. We share the volunteers assigned to you and their availability.\n" +
          "3. We sign a simple memorandum of understanding covering safeguarding " +
          "and who to contact on each side.\n\n" +
          "Could you let me know two or three times that suit you over the next " +
          "week and I'll set up the call?\n\n" + sign
      };
    }

    if (forStatus === "declined") {
      return {
        subject: "CareSphere partnership — " + inst,
        body:
          "Dear " + who + ",\n\n" +
          "Thank you for your interest in working with CareSphere Foundation, " +
          "and for the time you took to write to us about " + inst + ".\n\n" +
          "After looking at your request we aren't able to take it forward at " +
          "the moment. This is almost always about how many volunteers we have " +
          "available in a particular district rather than anything to do with " +
          "your institution.\n\n" +
          "We'll keep your details on file and will get in touch if that " +
          "changes. Please do write to us again next term.\n\n" + sign
      };
    }

    /* new or contacted — the first approach */
    return {
      subject: "CareSphere partnership — " + inst,
      body:
        "Dear " + who + ",\n\n" +
        "Thank you for getting in touch about a partnership between " + inst +
        " and CareSphere Foundation.\n\n" +
        "We've received your request and would like to arrange a short call to " +
        "understand what you're hoping for and where we can be useful.\n\n" +
        "Could you let me know a couple of times that suit you this week?\n\n" +
        sign
    };
  }

  function refreshReplyLink() {
    var p = all.filter(function (x) { return x._id === openId; })[0];
    if (!p) return;

    var draft = draftFor(p, document.getElementById("pStatus").value);

    document.getElementById("pReply").href =
      "https://mail.google.com/mail/?view=cm&fs=1" +
      "&to="   + encodeURIComponent(p.email || "") +
      "&su="   + encodeURIComponent(draft.subject) +
      "&body=" + encodeURIComponent(draft.body);

    /* Kept as a fallback for anyone who does have a mail app set up, and
       so the draft can be pasted somewhere else if Gmail isn't the tool. */
    lastDraft = draft;
    lastEmail = p.email || "";
  }

  var lastDraft = null;
  var lastEmail = "";

  /* Copies the whole draft, address included, for pasting into whatever
     mail client the office actually uses. */
  function copyDraft() {
    if (!lastDraft) return;

    var text = "To: " + lastEmail + "\n" +
               "Subject: " + lastDraft.subject + "\n\n" +
               lastDraft.body;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        CSAdmin.toast("Draft copied", "good");
      }).catch(function () {
        CSAdmin.toast("Couldn't copy. Select the text manually.", "warn");
      });
      return;
    }

    CSAdmin.toast("Copying isn't available in this browser.", "warn");
  }

  document.getElementById("pCopyDraft").addEventListener("click", copyDraft);

  /* ------------------------------------------------------------------
     Modal
     ------------------------------------------------------------------ */

  function openPartner(id) {
    var p = all.filter(function (x) { return x._id === id; })[0];
    if (!p) return;
    openId = id;

    function set(elId, value) {
      document.getElementById(elId).textContent = value || "\u2014";
    }

    document.getElementById("pName").textContent = p.institutionName;
    document.getElementById("pMeta").textContent =
      (TYPE[p.type] || p.type) + " \u00b7 " + p.location + " \u00b7 " + CSAdmin.fmtDate(p.receivedAt);

    set("pType",     TYPE[p.type] || p.type);
    set("pLocation", p.location);
    set("pContact",  p.contactName);
    set("pRole",     p.contactRole);
    set("pEmail",    p.email);
    set("pPhone",    p.phone);
    set("pChildren", p.childCount ? String(p.childCount) : "");
    set("pReceived", CSAdmin.fmtDate(p.receivedAt));
    set("pMessage",  p.message || "They didn't leave a message.");

    document.getElementById("pAssign").value = p.assignedTo || "";
    document.getElementById("pStatus").value = p.status === "new" ? "contacted" : p.status;
    document.getElementById("pNotes").value  = p.notes || "";

    /* Accepting something already active, or declining something already
       declined, is just noise. */
    document.getElementById("acceptPartner").hidden  = p.status === "active";
    document.getElementById("declinePartner").hidden = p.status === "declined";

    refreshReplyLink();
    CSAdmin.openModal("partnerModal");
  }

  /* ------------------------------------------------------------------
     Saving
     ------------------------------------------------------------------ */

  var footButtons = ["savePartner", "acceptPartner", "declinePartner"];

  function busy(on) {
    footButtons.forEach(function (id) {
      document.getElementById(id).disabled = on;
    });
  }

  function commit(newStatus, message) {
    busy(true);

    CSStore.updateById("partnerships", openId, {
      assignedTo: document.getElementById("pAssign").value,
      status:     newStatus,
      notes:      document.getElementById("pNotes").value.trim()
    }).then(function () {
      CSAdmin.closeModal("partnerModal");
      CSAdmin.toast(message, newStatus === "declined" ? "warn" : "good");
      followFilter(newStatus);
      return load();
    }).catch(function (err) {
      CSAdmin.toast((err && err.message) || "That didn't save. Try again.", "warn");
    }).then(function () {
      busy(false);
    });
  }

  function nameOf(id) {
    var p = all.filter(function (x) { return x._id === id; })[0];
    return p ? p.institutionName : "This request";
  }

  document.getElementById("savePartner").addEventListener("click", function () {
    var next = document.getElementById("pStatus").value;
    commit(next, "Saved \u00b7 now showing " + (LABEL[next] || LABEL.new).text);
  });

  document.getElementById("acceptPartner").addEventListener("click", function () {
    commit("active", nameOf(openId) + " is now an active partner");
  });

  document.getElementById("declinePartner").addEventListener("click", function () {
    if (!confirm("Decline the request from " + nameOf(openId) + "?")) return;
    commit("declined", "Request declined");
  });

  /* The draft has to match whatever the admin has just chosen. */
  document.getElementById("pStatus").addEventListener("change", refreshReplyLink);

  /* ------------------------------------------------------------------ */

  rowsEl.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-open]");
    if (btn) openPartner(btn.getAttribute("data-open"));
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
