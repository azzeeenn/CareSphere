/* ==========================================================================
   CareSphere — Messages

   Opening a message moves it off "new" automatically, which keeps the
   unread count on the home page honest.

   Reply opens Gmail's compose window in a new tab with the address,
   subject and a draft already in place. It used to be a mailto: link,
   which needs a mail app registered on the machine — on a laptop with
   none, Windows shows an app picker and then nothing happens.
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
    new:         { text: "New",         cls: "is-new"      },
    in_progress: { text: "In progress", cls: "is-progress" },
    resolved:    { text: "Resolved",    cls: "is-resolved" }
  };

  /* ------------------------------------------------------------------ */

  function load() {
    return Promise.all([
      CSStore.find("messages"),
      CSStore.find("users")
    ]).then(function (r) {
      all = r[0].sort(function (a, b) {
        return new Date(b.receivedAt) - new Date(a.receivedAt);
      });

      admins = r[1].filter(function (u) {
        return (u.role === "admin" || u.role === "super_admin") && u.active;
      });

      document.getElementById("mAssign").innerHTML =
        '<option value="">Nobody yet</option>' +
        admins.map(function (u) {
          return '<option value="' + CSAdmin.esc(u.name) + '">' + CSAdmin.esc(u.name) + '</option>';
        }).join("");

      render();
      CSAdmin.refreshBadges();
    });
  }

  function visible() {
    return all.filter(function (m) {
      if (status !== "all" && m.status !== status) return false;
      if (!term) return true;
      return (m.name + " " + m.subject + " " + m.body).toLowerCase().indexOf(term) !== -1;
    });
  }

  function trim(text, n) {
    return text.length > n ? text.slice(0, n).trim() + "\u2026" : text;
  }

  /* ------------------------------------------------------------------ */

  function renderSummary() {
    function n(s) { return all.filter(function (m) { return m.status === s; }).length; }
    var unassigned = all.filter(function (m) {
      return m.status !== "resolved" && !m.assignedTo;
    }).length;

    summaryEl.innerHTML =
      '<div class="summary-chip is-hot"><b>' + n("new") + '</b><span>new</span></div>' +
      '<div class="summary-chip"><b>' + n("in_progress") + '</b><span>in progress</span></div>' +
      '<div class="summary-chip"><b>' + unassigned + '</b><span>unassigned</span></div>' +
      '<div class="summary-chip"><b>' + n("resolved") + '</b><span>resolved</span></div>';
  }

  function render() {
    renderSummary();

    var list = visible();
    var esc  = CSAdmin.esc;

    if (!list.length) {
      rowsEl.innerHTML = "";
      emptyEl.hidden = false;
      document.getElementById("emptyTitle").textContent = term ? "No matches" : "Inbox clear";
      document.getElementById("emptyBody").textContent = term
        ? "Try a different search."
        : "Nothing new from the contact form.";
      return;
    }

    emptyEl.hidden = true;

    rowsEl.innerHTML = list.map(function (m) {
      var badge = LABEL[m.status] || LABEL.new;

      return '' +
        '<tr>' +
          '<td>' +
            '<span class="avatar-cell">' +
              '<span class="avatar-sm">' + esc(m.name.charAt(0)) + '</span>' +
              '<span>' +
                '<span class="cell-primary">' + esc(m.name) + '</span>' +
                '<span class="cell-sub">' + esc(m.email) + '</span>' +
              '</span>' +
            '</span>' +
          '</td>' +
          '<td style="max-width:340px">' +
            '<span class="cell-primary">' + esc(m.subject) + '</span>' +
            '<span class="cell-sub">' + esc(trim(m.body, 90)) + '</span>' +
          '</td>' +
          '<td>' + CSAdmin.fmtDate(m.receivedAt) + '<span class="cell-sub">' + CSAdmin.daysAgo(m.receivedAt) + '</span></td>' +
          '<td>' + (m.assignedTo ? esc(m.assignedTo) : '<span style="color:var(--cs-muted)">Nobody</span>') + '</td>' +
          '<td><span class="status-badge ' + badge.cls + '">' + badge.text + '</span></td>' +
          '<td class="cell-actions">' +
            '<button class="btn btn-quiet btn-sm" data-open="' + m._id + '">Open</button>' +
          '</td>' +
        '</tr>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Modal
     ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------
     Reply drafts

     No mail server sits behind CareSphere, so this fills in Gmail's
     compose window and a person presses send. The original message is
     quoted underneath so the sender has the context.
     ------------------------------------------------------------------ */

  var lastDraft = null;
  var lastEmail = "";

  function myName() {
    try {
      var me = CSAuth.current();
      return (me && me.name) || "The CareSphere team";
    } catch (e) {
      return "The CareSphere team";
    }
  }

  function buildReply(m) {
    var subject = "Re: " + (m.subject || "Your message to CareSphere");

    var body =
      "Dear " + (m.name || "there") + ",\n\n" +
      "Thank you for getting in touch with CareSphere Foundation.\n\n" +
      "[ write your reply here ]\n\n" +
      "Warm regards,\n" + myName() + "\nCareSphere Foundation\n\n" +
      "-- your original message --\n" + (m.body || "");

    lastDraft = { subject: subject, body: body };
    lastEmail = m.email || "";

    var link = document.getElementById("mReply");
    link.textContent = "Reply in Gmail";
    link.target = "_blank";
    link.rel    = "noopener";
    link.href =
      "https://mail.google.com/mail/?view=cm&fs=1" +
      "&to="   + encodeURIComponent(lastEmail) +
      "&su="   + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);

    ensureCopyButton();
  }

  /* Added from here rather than the HTML so this is a one-file change.
     Useful on a machine that isn't signed into Gmail — paste it into
     whatever mail client is actually in front of you. */
  function ensureCopyButton() {
    if (document.getElementById("mCopyDraft")) return;

    var link = document.getElementById("mReply");
    var btn  = document.createElement("button");

    btn.id        = "mCopyDraft";
    btn.type      = "button";
    btn.className = link.className;
    btn.textContent = "Copy draft";

    btn.addEventListener("click", function () {
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
    });

    link.parentNode.insertBefore(btn, link.nextSibling);
  }

  function openMessage(id) {
    var m = all.filter(function (x) { return x._id === id; })[0];
    if (!m) return;
    openId = id;

    document.getElementById("msgSubject").textContent = m.subject;
    document.getElementById("msgMeta").textContent =
      m.name + " · " + m.email + " · " + CSAdmin.fmtDate(m.receivedAt);
    document.getElementById("msgBody").textContent = m.body;

    document.getElementById("mAssign").value = m.assignedTo || "";
    document.getElementById("mStatus").value = m.status === "new" ? "in_progress" : m.status;
    document.getElementById("mNotes").value  = m.notes || "";

    buildReply(m);

    CSAdmin.openModal("messageModal");
  }

  document.getElementById("saveMessage").addEventListener("click", function () {
    var next = document.getElementById("mStatus").value;

    CSStore.updateById("messages", openId, {
      assignedTo: document.getElementById("mAssign").value,
      status:     next,
      notes:      document.getElementById("mNotes").value.trim()
    }).then(function () {
      CSAdmin.closeModal("messageModal");
      CSAdmin.toast("Saved \u00b7 now showing " + (LABEL[next] || LABEL.new).text, "good");

      /* Without this the row leaves a New-filtered list and looks deleted. */
      if (status !== "all" && status !== next) {
        var bar  = document.getElementById("statusFilter");
        var chip = bar.querySelector('[data-status="' + next + '"]');
        if (chip) {
          bar.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("is-on"); });
          chip.classList.add("is-on");
          status = next;
        }
      }

      load();
    }).catch(function (err) {
      CSAdmin.toast((err && err.message) || "That didn't save. Try again.", "warn");
    });
  });

  /* ------------------------------------------------------------------ */

  rowsEl.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-open]");
    if (btn) openMessage(btn.getAttribute("data-open"));
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
