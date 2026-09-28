/* ==========================================================================
   CareSphere: Subscribers
   Newsletter sign-ups. Any admin can see the list and switch someone
   off or on; only a Super Admin can remove an entry completely.
   ========================================================================== */

(function () {
  "use strict";

  if (!CSAdmin.init()) return;

  var esc  = CSAdmin.esc;
  var all  = [];
  var term = "";

  var rowsEl  = document.getElementById("rows");
  var emptyEl = document.getElementById("emptyState");

  function load() {
    return CSStore.find("subscribers").then(function (rows) {
      all = rows;
      render();
    }).catch(function (err) {
      CSAdmin.toast((err && err.detail) || "Couldn't load subscribers", "warn");
    });
  }

  function render() {
    var active = all.filter(function (s) { return s.active; }).length;
    document.getElementById("summaryRow").innerHTML =
      '<div class="summary-chip"><b>' + active + '</b><span>active</span></div>' +
      '<div class="summary-chip"><b>' + (all.length - active) + '</b><span>switched off</span></div>';

    var list = all.filter(function (s) {
      return !term || s.email.toLowerCase().indexOf(term) !== -1;
    });

    if (!list.length) {
      rowsEl.innerHTML = "";
      emptyEl.hidden = false;
      document.getElementById("emptyTitle").textContent = term ? "No matches" : "No subscribers yet";
      document.getElementById("emptyBody").textContent = term
        ? "Try a different search."
        : "Sign-ups from the “Stay Updated” box on the site appear here.";
      return;
    }

    emptyEl.hidden = true;
    rowsEl.innerHTML = list.map(function (s) {
      return '' +
        '<tr>' +
          '<td><span class="cell-primary">' + esc(s.email) + '</span></td>' +
          '<td>' + esc(CSAdmin.fmtDate(s.subscribedAt)) + '</td>' +
          '<td><span class="sub-pill ' + (s.active ? "is-on" : "is-off") + '">' +
              (s.active ? "Active" : "Switched off") + '</span></td>' +
          '<td class="cell-actions">' +
            '<button class="btn btn-quiet btn-sm" data-toggle="' + esc(s._id) + '">' +
              (s.active ? "Switch off" : "Switch on") + '</button> ' +
            (CSAdmin.isSuper()
              ? '<button class="btn btn-danger btn-sm" data-del="' + esc(s._id) + '">Remove</button>'
              : '') +
          '</td>' +
        '</tr>';
    }).join("");
  }

  rowsEl.addEventListener("click", function (e) {
    var t = e.target.closest("[data-toggle]");
    var d = e.target.closest("[data-del]");

    if (t) {
      var s = all.filter(function (x) { return x._id === t.getAttribute("data-toggle"); })[0];
      CSStore.updateById("subscribers", s._id, { active: !s.active }).then(function () {
        CSAdmin.toast(s.active ? "Switched off" : "Switched back on", "good");
        load();
      }).catch(function (err) {
        CSAdmin.toast((err && err.detail) || "That didn't save", "warn");
      });
    }

    if (d) {
      var row = all.filter(function (x) { return x._id === d.getAttribute("data-del"); })[0];
      if (!window.confirm("Remove " + row.email + " completely? This can't be undone.")) return;
      CSStore.removeById("subscribers", row._id).then(function () {
        CSAdmin.toast("Removed", "warn");
        load();
      });
    }
  });

  /* For pasting into an email's BCC line. */
  document.getElementById("copyEmails").addEventListener("click", function () {
    var emails = all.filter(function (s) { return s.active; })
                    .map(function (s) { return s.email; }).join(", ");
    if (!emails) { CSAdmin.toast("No active subscribers to copy", "warn"); return; }

    function done() { CSAdmin.toast("Copied. Paste into the BCC line of your email.", "good"); }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(emails).then(done, function () { window.prompt("Copy these:", emails); });
    } else {
      window.prompt("Copy these:", emails);
    }
  });

  var typing;
  document.getElementById("searchBox").addEventListener("input", function () {
    var v = this.value.trim().toLowerCase();
    clearTimeout(typing);
    typing = setTimeout(function () { term = v; render(); }, 160);
  });

  load();

})();
