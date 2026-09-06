/* ==========================================================================
   CareSphere — Messages

   Opening a message moves it off "new" automatically, which keeps the
   unread count on the home page honest.
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

    document.getElementById("mReply").href =
      "mailto:" + encodeURIComponent(m.email) +
      "?subject=" + encodeURIComponent("Re: " + m.subject);

    CSAdmin.openModal("messageModal");
  }

  document.getElementById("saveMessage").addEventListener("click", function () {
    CSStore.updateById("messages", openId, {
      assignedTo: document.getElementById("mAssign").value,
      status:     document.getElementById("mStatus").value,
      notes:      document.getElementById("mNotes").value.trim()
    }).then(function () {
      CSAdmin.closeModal("messageModal");
      CSAdmin.toast("Message updated", "good");
      load();
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
