/* ==========================================================================
   CareSphere — Recognition

   Straight CRUD over one table with two kinds of entry:

     Recognition — a volunteer, shown in the Hall of Fame on
                   recognition.html
     Award       — something CareSphere won, shown on the
                   impact dashboard

   Partner used to be a third kind. It was dropped, so old
   Partner rows are simply never listed here. The database
   still allows the value, so nothing had to be migrated.
   ========================================================================== */

(function () {
  "use strict";

  CSAdmin.init();

  var all      = [];
  var type     = "Recognition";
  var term     = "";
  var editId   = null;
  var deleteId = null;

  var rowsEl    = document.getElementById("rows");
  var emptyEl   = document.getElementById("emptyState");
  var summaryEl = document.getElementById("summaryRow");

  var F = {
    title: document.getElementById("rTitle"),
    body:  document.getElementById("rBody"),
    year:  document.getElementById("rYear"),
    type:  document.getElementById("rType")
  };

  /* ------------------------------------------------------------------ */

  function load() {
    return CSStore.find("recognition").then(function (docs) {
      all = docs.sort(function (a, b) { return b.year - a.year; });
      render();
    });
  }

  function visible() {
    return all.filter(function (r) {
      if (r.type !== "Recognition" && r.type !== "Award") return false;
      if (type !== "all" && r.type !== type) return false;
      if (!term) return true;
      return (r.title + " " + r.body).toLowerCase().indexOf(term) !== -1;
    });
  }

  /* ------------------------------------------------------------------ */

  function render() {
    var people = all.filter(function (r) { return r.type === "Recognition"; }).length;
    var awards = all.filter(function (r) { return r.type === "Award"; }).length;
    var years  = all.map(function (r) { return r.year; }).filter(Boolean);
    var latest = years.length ? Math.max.apply(null, years) : "\u2014";

    summaryEl.innerHTML =
      '<div class="summary-chip"><b>' + people + '</b><span>on the Hall of Fame</span></div>' +
      '<div class="summary-chip"><b>' + awards + '</b><span>awards</span></div>' +
      '<div class="summary-chip"><b>' + latest + '</b><span>most recent</span></div>';

    var list = visible();
    var esc  = CSAdmin.esc;

    if (!list.length) {
      rowsEl.innerHTML = "";
      emptyEl.hidden = false;
      document.getElementById("emptyTitle").textContent = term ? "No matches" : "Nothing here yet";
      document.getElementById("emptyBody").textContent = term
        ? "Try a different search."
        : (type === "Award"
            ? "Add an award CareSphere has received."
            : "Add a volunteer to the Hall of Fame.");
      return;
    }

    emptyEl.hidden = true;

    rowsEl.innerHTML = list.map(function (r) {
      return '' +
        '<tr>' +
          '<td><span class="cell-primary">' + esc(r.title) + '</span></td>' +
          '<td>' + esc(r.body) + '</td>' +
          '<td>' + r.year + '</td>' +
          '<td><span class="tag ' + (r.type === "Award" ? "is-green" : "is-education") + '">' +
              (r.type === "Award" ? "Award" : "Volunteer") + '</span></td>' +
          '<td class="cell-actions">' +
            '<button class="btn btn-quiet btn-sm" data-edit="' + r._id + '">Edit</button> ' +
            (CSAdmin.isSuper()
              ? '<button class="btn btn-danger btn-sm" data-del="' + r._id + '">Delete</button>'
              : '') +
          '</td>' +
        '</tr>';
    }).join("");
  }

  /* ------------------------------------------------------------------ */

  function clearErrors() {
    ["rTitle", "rBody", "rYear"].forEach(function (id) {
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

    if (F.title.value.trim().length < 3) bad("rTitle", "Who is this? Add a name or a title.");
    if (!F.body.value.trim())            bad("rBody", "One line on what they did, or who gave the award.");

    var year = parseInt(F.year.value, 10);
    var now  = new Date().getFullYear();
    if (!year || year < 1990 || year > now + 1) {
      bad("rYear", "Enter a year between 1990 and " + (now + 1) + ".");
    }

    if (first) first.focus();
    return ok;
  }

  function openForm(id) {
    editId = id || null;
    clearErrors();

    document.getElementById("formTitle").textContent = editId ? "Edit entry" : "New entry";
    document.getElementById("saveEntry").textContent = editId ? "Save changes" : "Add entry";

    if (editId) {
      var r = all.filter(function (x) { return x._id === editId; })[0];
      F.title.value = r.title;
      F.body.value  = r.body;
      F.year.value  = r.year;
      F.type.value  = r.type;
    } else {
      F.title.value = F.body.value = "";
      F.year.value  = new Date().getFullYear();
      F.type.value  = "Recognition";
    }

    CSAdmin.openModal("formModal");
  }

  document.getElementById("saveEntry").addEventListener("click", function () {
    if (!validate()) return;

    var payload = {
      title: F.title.value.trim(),
      body:  F.body.value.trim(),
      year:  parseInt(F.year.value, 10),
      type:  F.type.value
    };

    var work = editId
      ? CSStore.updateById("recognition", editId, payload)
      : CSStore.insert("recognition", payload);

    work.then(function () {
      CSAdmin.closeModal("formModal");
      CSAdmin.toast(editId ? "Entry updated" : "Entry added", "good");

      /* Otherwise adding an award while the Volunteers chip is on looks
         like nothing happened. */
      if (type !== "all" && type !== payload.type) {
        var bar  = document.getElementById("typeFilter");
        var chip = bar.querySelector('[data-type="' + payload.type + '"]');
        if (chip) {
          bar.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("is-on"); });
          chip.classList.add("is-on");
          type = payload.type;
        }
      }

      load();
    }).catch(function (err) {
      CSAdmin.toast((err && err.message) || "That didn't save. Try again.", "warn");
    });
  });

  document.getElementById("confirmDelete").addEventListener("click", function () {
    if (!CSAdmin.isSuper()) {
      CSAdmin.closeModal("deleteModal");
      CSAdmin.toast("Only a Super Admin can delete", "warn");
      return;
    }
    CSStore.removeById("recognition", deleteId).then(function () {
      CSAdmin.closeModal("deleteModal");
      CSAdmin.toast("Entry deleted", "warn");
      load();
    });
  });

  /* ------------------------------------------------------------------ */

  document.getElementById("newEntry").addEventListener("click", function () { openForm(null); });

  rowsEl.addEventListener("click", function (e) {
    var edit = e.target.closest("[data-edit]");
    var del  = e.target.closest("[data-del]");

    if (edit) openForm(edit.getAttribute("data-edit"));

    if (del) {
      deleteId = del.getAttribute("data-del");
      var r = all.filter(function (x) { return x._id === deleteId; })[0];
      document.getElementById("deleteTitle").textContent = "Delete \u201C" + r.title + "\u201D?";
      CSAdmin.openModal("deleteModal");
    }
  });

  document.getElementById("typeFilter").addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    this.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("is-on"); });
    chip.classList.add("is-on");
    type = chip.getAttribute("data-type");
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
