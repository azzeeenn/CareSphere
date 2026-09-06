/* ==========================================================================
   CareSphere — Events

   This is the CRUD pattern the other content pages reuse: list, filter,
   modal form with inline validation, delete behind a confirmation.
   ========================================================================== */

(function () {
  "use strict";

  CSAdmin.init();

  var all      = [];
  var status   = "all";
  var category = "all";
  var district = "all";
  var term     = "";
  var editId   = null;
  var deleteId = null;

  var rowsEl    = document.getElementById("rows");
  var emptyEl   = document.getElementById("emptyState");
  var summaryEl = document.getElementById("summaryRow");

  var LABEL = {
    draft:     { text: "Draft",     cls: "is-draft"     },
    published: { text: "Published", cls: "is-published" },
    completed: { text: "Completed", cls: "is-completed" },
    cancelled: { text: "Cancelled", cls: "is-cancelled" }
  };

  /* ------------------------------------------------------------------
     Load + filter
     ------------------------------------------------------------------ */

  function load() {
    return CSStore.find("events").then(function (docs) {
      all = docs.sort(function (a, b) {
        return new Date(b.startsAt) - new Date(a.startsAt);
      });
      render();
    });
  }

  function visible() {
    return all.filter(function (e) {
      if (status   !== "all" && e.status   !== status)   return false;
      if (category !== "all" && e.category !== category) return false;
      if (district !== "all" && e.district !== district) return false;
      if (!term) return true;
      return (e.title + " " + e.venue).toLowerCase().indexOf(term) !== -1;
    });
  }

  /* ------------------------------------------------------------------
     Render
     ------------------------------------------------------------------ */

  function renderSummary() {
    var now = new Date();
    var upcoming = all.filter(function (e) {
      return e.status === "published" && new Date(e.startsAt) >= now;
    }).length;
    var drafts = all.filter(function (e) { return e.status === "draft"; }).length;
    var seats  = all.reduce(function (sum, e) {
      return e.status === "published" ? sum + (e.capacity - e.registered) : sum;
    }, 0);

    summaryEl.innerHTML =
      '<div class="summary-chip"><b>' + upcoming + '</b><span>upcoming</span></div>' +
      '<div class="summary-chip"><b>' + drafts   + '</b><span>drafts</span></div>' +
      '<div class="summary-chip"><b>' + all.length + '</b><span>total</span></div>' +
      '<div class="summary-chip' + (seats === 0 ? " is-hot" : "") + '"><b>' + seats + '</b><span>open places</span></div>';
  }

  function render() {
    renderSummary();

    var list = visible();
    var esc  = CSAdmin.esc;

    if (!list.length) {
      rowsEl.innerHTML = "";
      emptyEl.hidden = false;
      var filtered = term || status !== "all" || category !== "all" || district !== "all";
      document.getElementById("emptyTitle").textContent = filtered ? "No matches" : "No events yet";
      document.getElementById("emptyBody").textContent = filtered
        ? "Try a different search or clear the filters."
        : "Create your first event and publish it when the details are confirmed.";
      return;
    }

    emptyEl.hidden = true;

    rowsEl.innerHTML = list.map(function (e) {
      var badge = LABEL[e.status] || LABEL.draft;
      var cat = e.category === "Education"  ? "is-education"
              : e.category === "Healthcare" ? "is-healthcare" : "is-green";
      var full = e.registered >= e.capacity;

      return '' +
        '<tr>' +
          '<td>' +
            '<span class="cell-primary">' + esc(e.title) + '</span>' +
            '<span class="cell-sub">' + esc(e.venue) + '</span>' +
          '</td>' +
          '<td><span class="tag ' + cat + '">' + esc(e.category) + '</span></td>' +
          '<td>' + esc(e.district) + '</td>' +
          '<td>' + CSAdmin.fmtDateTime(e.startsAt) + '</td>' +
          '<td>' +
            '<span class="cell-primary">' + e.registered + ' / ' + e.capacity + '</span>' +
            '<span class="cell-sub">' + (full ? "Full" : (e.capacity - e.registered) + " places left") + '</span>' +
          '</td>' +
          '<td><span class="status-badge ' + badge.cls + '">' + badge.text + '</span></td>' +
          '<td class="cell-actions">' +
            '<button class="btn btn-quiet btn-sm" data-edit="' + e._id + '">Edit</button> ' +
            (CSAdmin.isSuper()
              ? '<button class="btn btn-danger btn-sm" data-del="' + e._id + '">Delete</button>'
              : '') +
          '</td>' +
        '</tr>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Form
     ------------------------------------------------------------------ */

  var F = {
    title:       document.getElementById("fTitle"),
    category:    document.getElementById("fCategory"),
    district:    document.getElementById("fDistrict"),
    venue:       document.getElementById("fVenue"),
    startsAt:    document.getElementById("fStart"),
    endsAt:      document.getElementById("fEnd"),
    capacity:    document.getElementById("fCapacity"),
    status:      document.getElementById("fStatus"),
    description: document.getElementById("fDescription")
  };

  function clearErrors() {
    document.querySelectorAll("#formModal .field").forEach(function (f) {
      f.classList.remove("has-error");
    });
    document.querySelectorAll("#formModal .error").forEach(function (e) {
      e.textContent = "";
    });
  }

  function fail(key, message) {
    var input = F[key];
    input.closest(".field").classList.add("has-error");
    var slot = document.querySelector('[data-error="' + input.id + '"]');
    if (slot) slot.textContent = message;
  }

  /* Inline validation, not native HTML5 — same approach as the public forms */
  function validate() {
    clearErrors();
    var ok = true, first = null;

    function bad(key, msg) {
      fail(key, msg);
      if (!first) first = F[key];
      ok = false;
    }

    if (F.title.value.trim().length < 4)       bad("title", "Give the event a title of at least 4 characters.");
    if (!F.venue.value.trim())                 bad("venue", "Where is it happening?");
    if (!F.startsAt.value)                     bad("startsAt", "Pick a start date and time.");
    if (!F.endsAt.value)                       bad("endsAt", "Pick an end date and time.");

    if (F.startsAt.value && F.endsAt.value &&
        new Date(F.endsAt.value) <= new Date(F.startsAt.value)) {
      bad("endsAt", "The end time has to be after the start time.");
    }

    var cap = parseInt(F.capacity.value, 10);
    if (!cap || cap < 1)                       bad("capacity", "Enter how many volunteers you need.");

    if (editId) {
      var current = all.filter(function (e) { return e._id === editId; })[0];
      if (current && cap && cap < current.registered) {
        bad("capacity", current.registered + " volunteers have already registered. Capacity cannot go below that.");
      }
    }

    if (F.description.value.trim().length < 15) bad("description", "Write a sentence or two so volunteers know what to expect.");

    if (first) first.focus();
    return ok;
  }

  function openForm(id) {
    editId = id || null;
    clearErrors();

    document.getElementById("formTitle").textContent = editId ? "Edit event" : "New event";
    document.getElementById("saveEvent").textContent = editId ? "Save changes" : "Create event";

    if (editId) {
      var e = all.filter(function (x) { return x._id === editId; })[0];
      F.title.value       = e.title;
      F.category.value    = e.category;
      F.district.value    = e.district;
      F.venue.value       = e.venue;
      F.startsAt.value    = e.startsAt;
      F.endsAt.value      = e.endsAt;
      F.capacity.value    = e.capacity;
      F.status.value      = e.status;
      F.description.value = e.description;
    } else {
      F.title.value = F.venue.value = F.startsAt.value = F.endsAt.value = "";
      F.capacity.value = "";
      F.description.value = "";
      F.category.selectedIndex = 0;
      F.district.selectedIndex = 0;
      F.status.value = "draft";
    }

    CSAdmin.openModal("formModal");
  }

  document.getElementById("saveEvent").addEventListener("click", function () {
    if (!validate()) return;

    var payload = {
      title:       F.title.value.trim(),
      category:    F.category.value,
      district:    F.district.value,
      venue:       F.venue.value.trim(),
      startsAt:    F.startsAt.value,
      endsAt:      F.endsAt.value,
      capacity:    parseInt(F.capacity.value, 10),
      status:      F.status.value,
      description: F.description.value.trim()
    };

    var work = editId
      ? CSStore.updateById("events", editId, payload)
      : CSStore.insert("events", Object.assign(payload, {
          registered: 0,
          createdAt: CSAdmin.today()
        }));

    work.then(function () {
      CSAdmin.closeModal("formModal");
      CSAdmin.toast(editId ? "Event updated" : "Event created", "good");
      load();
    });
  });

  /* ------------------------------------------------------------------
     Delete
     ------------------------------------------------------------------ */

  function askDelete(id) {
    var e = all.filter(function (x) { return x._id === id; })[0];
    if (!e) return;
    deleteId = id;

    document.getElementById("deleteTitle").textContent = "Delete \u201C" + e.title + "\u201D?";
    document.getElementById("deleteBody").textContent = e.registered > 0
      ? e.registered + " volunteers have registered. They will lose their place and will not be told automatically."
      : "This cannot be undone.";

    CSAdmin.openModal("deleteModal");
  }

  document.getElementById("confirmDelete").addEventListener("click", function () {
    if (!CSAdmin.isSuper()) {
      CSAdmin.closeModal("deleteModal");
      CSAdmin.toast("Only a Super Admin can delete", "warn");
      return;
    }
    CSStore.removeById("events", deleteId).then(function () {
      CSAdmin.closeModal("deleteModal");
      CSAdmin.toast("Event deleted", "warn");
      load();
    });
  });

  /* ------------------------------------------------------------------
     Events
     ------------------------------------------------------------------ */

  document.getElementById("newEvent").addEventListener("click", function () { openForm(null); });

  rowsEl.addEventListener("click", function (e) {
    var edit = e.target.closest("[data-edit]");
    var del  = e.target.closest("[data-del]");
    if (edit) openForm(edit.getAttribute("data-edit"));
    if (del)  askDelete(del.getAttribute("data-del"));
  });

  document.getElementById("statusFilter").addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    this.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("is-on"); });
    chip.classList.add("is-on");
    status = chip.getAttribute("data-status");
    render();
  });

  document.getElementById("categoryFilter").addEventListener("change", function () {
    category = this.value; render();
  });

  document.getElementById("districtFilter").addEventListener("change", function () {
    district = this.value; render();
  });

  var typing;
  document.getElementById("searchBox").addEventListener("input", function () {
    var v = this.value.trim().toLowerCase();
    clearTimeout(typing);
    typing = setTimeout(function () { term = v; render(); }, 160);
  });

  /* ------------------------------------------------------------------
     Boot — fill the dropdowns from the data layer
     ------------------------------------------------------------------ */

  function options(list) {
    return list.map(function (v) {
      return '<option value="' + CSAdmin.esc(v) + '">' + CSAdmin.esc(v) + '</option>';
    }).join("");
  }

  F.category.innerHTML = options(CSStore.categories);
  F.district.innerHTML = options(CSStore.districts);

  document.getElementById("categoryFilter").innerHTML =
    '<option value="all">All categories</option>' + options(CSStore.categories);
  document.getElementById("districtFilter").innerHTML =
    '<option value="all">All districts</option>' + options(CSStore.districts);

  load();

})();
