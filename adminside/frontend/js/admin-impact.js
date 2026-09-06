/* ==========================================================================
   CareSphere — Impact Numbers

   These figures are entered by hand and go straight onto the public site
   with nobody reviewing them, so there are two safeguards: a confirmation
   when a number moves by more than half, and a cross-check against what
   the system can count for itself.
   ========================================================================== */

(function () {
  "use strict";

  CSAdmin.init();

  var all      = [];
  var editId   = null;
  var deleteId = null;
  var pending  = null;   // change waiting on the big-change confirmation

  var rowsEl  = document.getElementById("rows");
  var emptyEl = document.getElementById("emptyState");

  var labelEl = document.getElementById("iLabel");
  var valueEl = document.getElementById("iValue");

  /* ------------------------------------------------------------------ */

  function load() {
    return CSStore.find("impact").then(function (docs) {
      all = docs;
      render();
      renderCrossCheck();
    });
  }

  function render() {
    var esc = CSAdmin.esc;

    if (!all.length) {
      rowsEl.innerHTML = "";
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;

    rowsEl.innerHTML = all.map(function (f) {
      return '' +
        '<tr>' +
          '<td><span class="cell-primary">' + esc(f.label) + '</span></td>' +
          '<td><span class="value-lead">' + Number(f.value).toLocaleString("en-IN") + '</span></td>' +
          '<td>' + CSAdmin.fmtDate(f.updatedAt) +
            '<span class="cell-sub">' + CSAdmin.daysAgo(f.updatedAt) + '</span></td>' +
          '<td class="cell-actions">' +
            '<button class="btn btn-quiet btn-sm" data-edit="' + f._id + '">Edit</button>' +
          '</td>' +
        '</tr>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Cross-check — what the system can count on its own
     ------------------------------------------------------------------ */

  function renderCrossCheck() {
    Promise.all([
      CSStore.find("users", { role: "volunteer" }),
      CSStore.find("events"),
      CSStore.find("hours", { status: "verified" })
    ]).then(function (r) {
      var volunteers = r[0].filter(function (u) { return u.active; }).length;

      var camps = r[1].filter(function (e) {
        return e.status === "completed" && e.category === "Healthcare";
      }).length;

      var districts = {};
      r[1].forEach(function (e) { districts[e.district] = 1; });

      var hours = r[2].reduce(function (s, h) { return s + h.hours; }, 0);

      function stated(label) {
        var f = all.filter(function (x) {
          return x.label.toLowerCase().indexOf(label) !== -1;
        })[0];
        return f ? f.value : null;
      }

      function line(title, counted, statedValue, unit) {
        var note;
        if (statedValue === null) {
          note = "No matching figure on the list above.";
        } else if (statedValue === counted) {
          note = "Matches the figure you've published.";
        } else {
          var diff = statedValue - counted;
          note = "You've published " + statedValue.toLocaleString("en-IN") +
                 " \u2014 " + Math.abs(diff).toLocaleString("en-IN") +
                 (diff > 0 ? " more" : " fewer") + " than the site can account for.";
        }

        return '<div class="detail full">' +
                 '<dt>' + title + '</dt>' +
                 '<dd><b style="color:var(--cs-navy)">' +
                   counted.toLocaleString("en-IN") + (unit ? " " + unit : "") +
                 '</b> recorded in the system. ' + CSAdmin.esc(note) + '</dd>' +
               '</div>';
      }

      document.getElementById("crossCheck").innerHTML =
        line("Active volunteers", volunteers, stated("volunteer")) +
        line("Health camps completed", camps, stated("camp")) +
        line("Districts with events", Object.keys(districts).length, stated("district")) +
        '<div class="detail full">' +
          '<dt>Verified volunteer hours</dt>' +
          '<dd><b style="color:var(--cs-navy)">' + hours.toLocaleString("en-IN") +
          ' hrs</b> verified so far. Not currently published as a figure.</dd>' +
        '</div>';
    });
  }

  /* ------------------------------------------------------------------
     Form
     ------------------------------------------------------------------ */

  function clearErrors() {
    [labelEl, valueEl].forEach(function (el) {
      el.closest(".field").classList.remove("has-error");
    });
    document.getElementById("iLabelError").textContent = "";
    document.getElementById("iValueError").textContent = "";
  }

  function openForm(id) {
    editId = id || null;
    clearErrors();

    var f = editId ? all.filter(function (x) { return x._id === editId; })[0] : null;

    document.getElementById("formTitle").textContent = f ? "Update figure" : "New figure";
    document.getElementById("formSub").textContent = f
      ? "Last changed " + CSAdmin.fmtDate(f.updatedAt)
      : "This will appear alongside the others on the site.";

    document.getElementById("saveFigure").textContent = f ? "Save changes" : "Add figure";
    document.getElementById("deleteFigure").hidden = !f;

    labelEl.value = f ? f.label : "";
    valueEl.value = f ? f.value : "";

    document.getElementById("iValueHint").textContent = f
      ? "Currently published as " + Number(f.value).toLocaleString("en-IN") + "."
      : "Whole numbers only.";

    CSAdmin.openModal("formModal");
  }

  function validate() {
    clearErrors();
    var ok = true, first = null;

    if (labelEl.value.trim().length < 3) {
      labelEl.closest(".field").classList.add("has-error");
      document.getElementById("iLabelError").textContent = "Give this figure a name.";
      first = labelEl;
      ok = false;
    }

    var value = parseInt(valueEl.value, 10);
    if (isNaN(value) || value < 0) {
      valueEl.closest(".field").classList.add("has-error");
      document.getElementById("iValueError").textContent = "Enter a whole number, zero or more.";
      first = first || valueEl;
      ok = false;
    }

    if (first) first.focus();
    return ok;
  }

  /* A figure moving by more than half is usually a typo, so ask first */
  function isBigChange(oldValue, newValue) {
    if (!oldValue) return false;
    return Math.abs(newValue - oldValue) / oldValue > 0.5;
  }

  function commit(payload) {
    var work = editId
      ? CSStore.updateById("impact", editId, payload)
      : CSStore.insert("impact", payload);

    return work.then(function () {
      CSAdmin.closeModal("formModal");
      CSAdmin.closeModal("confirmModal");
      CSAdmin.toast(editId ? "Figure updated on the site" : "Figure added", "good");
      load();
    });
  }

  document.getElementById("saveFigure").addEventListener("click", function () {
    if (!validate()) return;

    var payload = {
      label:     labelEl.value.trim(),
      value:     parseInt(valueEl.value, 10),
      updatedAt: CSAdmin.today()
    };

    if (editId) {
      var current = all.filter(function (x) { return x._id === editId; })[0];

      if (isBigChange(current.value, payload.value)) {
        pending = payload;

        var direction = payload.value > current.value ? "up" : "down";
        document.getElementById("confirmBody").textContent =
          current.label + " goes " + direction + " from " +
          current.value.toLocaleString("en-IN") + " to " +
          payload.value.toLocaleString("en-IN") +
          ". That's more than half its current value, so it's worth a second look.";

        CSAdmin.closeModal("formModal");
        CSAdmin.openModal("confirmModal");
        return;
      }
    }

    commit(payload);
  });

  document.getElementById("confirmBig").addEventListener("click", function () {
    if (pending) commit(pending);
    pending = null;
  });

  document.getElementById("deleteFigure").addEventListener("click", function () {
    if (!editId) return;
    CSStore.removeById("impact", editId).then(function () {
      CSAdmin.closeModal("formModal");
      CSAdmin.toast("Figure removed from the site", "warn");
      load();
    });
  });

  /* ------------------------------------------------------------------ */

  document.getElementById("newFigure").addEventListener("click", function () { openForm(null); });

  rowsEl.addEventListener("click", function (e) {
    var edit = e.target.closest("[data-edit]");
    if (edit) openForm(edit.getAttribute("data-edit"));
  });

  load();

})();
