/* ==========================================================================
   CareSphere — Recognition

   Two kinds of entry in one table:

     Recognition — a volunteer, shown in the Hall of Fame on
                   recognition.html
     Award       — something CareSphere won, shown on the
                   impact dashboard

   Volunteer entries are PICKED, not typed:
     1. the volunteer comes from the approved applications
     2. the event comes from that volunteer's VERIFIED hours only
   so a made-up name or an event they never worked cannot get in.
   The server checks the same thing again, so the rule holds even if
   someone skips this page and calls the API directly.

   Awards stay as typed text — they come from outside organisations,
   so there is nothing in our database to pick them from.

   Partner used to be a third kind. It was dropped, so old Partner rows
   are simply never listed here.
   ========================================================================== */

(function () {
  "use strict";

  CSAdmin.init();

  var all      = [];
  var type     = "Recognition";
  var term     = "";
  var editId   = null;
  var deleteId = null;

  /* Picker data, built once on load */
  var volunteers = [];   /* [{ id, name, district }]                        */
  var workByUser = {};   /* userId -> [{ eventId, title, hours, year }]     */
  var lastAuto   = "";   /* last text we filled in, so we never overwrite
                            something the admin typed themselves           */

  var rowsEl    = document.getElementById("rows");
  var emptyEl   = document.getElementById("emptyState");
  var summaryEl = document.getElementById("summaryRow");

  var F = {
    type:      document.getElementById("rType"),
    volunteer: document.getElementById("rVolunteer"),
    event:     document.getElementById("rEvent"),
    title:     document.getElementById("rTitle"),
    body:      document.getElementById("rBody"),
    bodyLabel: document.getElementById("rBodyLabel"),
    year:      document.getElementById("rYear")
  };

  var esc = CSAdmin.esc;

  /* ------------------------------------------------------------------
     Loading
     ------------------------------------------------------------------ */

  function load() {
    return CSStore.find("recognition").then(function (docs) {
      all = docs.sort(function (a, b) { return b.year - a.year; });
      render();
    });
  }

  /* Approved volunteers + their verified hours, grouped by event. */
  function loadPickers() {
    return Promise.all([
      CSStore.find("applications", { status: "approved" }),
      CSStore.find("hours", { status: "verified" }),
      CSStore.find("events")
    ]).then(function (r) {
      var apps = r[0], hours = r[1], events = r[2];

      var eventYear = {};
      events.forEach(function (e) {
        var d = new Date(e.startsAt);
        if (!isNaN(d)) eventYear[e._id] = d.getFullYear();
      });

      workByUser = {};
      hours.forEach(function (h) {
        if (!h.eventId) return;                  /* hours not tied to an event */
        var list = workByUser[h.userId] || (workByUser[h.userId] = []);
        var item = list.filter(function (x) { return x.eventId === h.eventId; })[0];
        if (!item) {
          var logged = new Date(h.loggedAt);
          item = {
            eventId: h.eventId,
            title:   h.eventTitle || "Event",
            hours:   0,
            year:    eventYear[h.eventId] || (isNaN(logged) ? null : logged.getFullYear())
          };
          list.push(item);
        }
        item.hours += Number(h.hours) || 0;
      });

      volunteers = apps.map(function (a) {
        return { id: a.userId, name: a.name || "Volunteer", district: a.district || "" };
      }).sort(function (a, b) { return a.name.localeCompare(b.name); });

      fillVolunteerSelect();
    }).catch(function () {
      F.volunteer.innerHTML = '<option value="">Could not load volunteers</option>';
    });
  }

  function totalHours(uid) {
    return (workByUser[uid] || []).reduce(function (s, w) { return s + w.hours; }, 0);
  }

  function fmtHours(n) {
    return (Math.round(n * 10) / 10) + (n === 1 ? " hour" : " hours");
  }

  /* ------------------------------------------------------------------
     Pickers
     ------------------------------------------------------------------ */

  function fillVolunteerSelect() {
    if (!volunteers.length) {
      F.volunteer.innerHTML = '<option value="">No approved volunteers yet</option>';
      return;
    }
    F.volunteer.innerHTML =
      '<option value="">Choose a volunteer</option>' +
      volunteers.map(function (v) {
        return '<option value="' + esc(v.id) + '">' +
          esc(v.name) + (v.district ? " · " + esc(v.district) : "") +
          " · " + fmtHours(totalHours(v.id)) + " verified" +
          '</option>';
      }).join("");
  }

  function fillEventSelect(uid, selected) {
    var work = uid ? (workByUser[uid] || []) : [];

    if (!uid) {
      F.event.innerHTML = '<option value="">Pick a volunteer first</option>';
      F.event.disabled = true;
      return;
    }

    F.event.disabled = false;
    F.event.innerHTML =
      '<option value="">All their work (' + fmtHours(totalHours(uid)) + ')</option>' +
      work.map(function (w) {
        return '<option value="' + esc(w.eventId) + '">' +
          esc(w.title) + " · " + fmtHours(w.hours) +
          '</option>';
      }).join("");

    F.event.value = selected || "";
    /* An old link to an event with no verified hours falls back to "all". */
    if (F.event.value !== (selected || "")) F.event.value = "";
  }

  /* Suggest a line for "What they did" and the year. Only replaces the
     text if the admin hasn't typed their own. */
  function autoFill() {
    var uid = F.volunteer.value;
    if (!uid) return;

    var text, year;
    var work = workByUser[uid] || [];

    if (F.event.value) {
      var w = work.filter(function (x) { return x.eventId === F.event.value; })[0];
      text = w.title + " · " + fmtHours(w.hours) + " verified";
      year = w.year;
    } else if (work.length) {
      text = fmtHours(totalHours(uid)) + " verified across " +
             work.length + (work.length === 1 ? " event" : " events");
    } else {
      text = "";
    }

    if (!F.body.value.trim() || F.body.value === lastAuto) {
      F.body.value = text;
      lastAuto = text;
    }
    if (year) F.year.value = year;
  }

  F.volunteer.addEventListener("change", function () {
    fillEventSelect(this.value, "");
    autoFill();
  });

  F.event.addEventListener("change", autoFill);

  /* ------------------------------------------------------------------
     Show the right fields for the chosen type
     ------------------------------------------------------------------ */

  function show(id, on) {
    document.getElementById(id).style.display = on ? "" : "none";
  }

  function applyType() {
    var isVolunteer = F.type.value === "Recognition";
    show("volunteerField", isVolunteer);
    show("eventField", isVolunteer);
    show("titleField", !isVolunteer);

    F.bodyLabel.textContent = isVolunteer ? "What they did" : "Who gave the award";
    F.body.placeholder = isVolunteer
      ? "Fills in when you pick an event"
      : "Dept. of Social Welfare";
    clearErrors();
  }

  F.type.addEventListener("change", applyType);

  /* ------------------------------------------------------------------
     Table
     ------------------------------------------------------------------ */

  function visible() {
    return all.filter(function (r) {
      if (r.type !== "Recognition" && r.type !== "Award") return false;
      if (type !== "all" && r.type !== type) return false;
      if (!term) return true;
      return (r.title + " " + r.body).toLowerCase().indexOf(term) !== -1;
    });
  }

  function render() {
    var people = all.filter(function (r) { return r.type === "Recognition"; }).length;
    var awards = all.filter(function (r) { return r.type === "Award"; }).length;
    var years  = all.map(function (r) { return r.year; }).filter(Boolean);
    var latest = years.length ? Math.max.apply(null, years) : "—";

    summaryEl.innerHTML =
      '<div class="summary-chip"><b>' + people + '</b><span>on the Hall of Fame</span></div>' +
      '<div class="summary-chip"><b>' + awards + '</b><span>awards</span></div>' +
      '<div class="summary-chip"><b>' + latest + '</b><span>most recent</span></div>';

    var list = visible();

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
      /* Older volunteer entries made before the pickers have no link.
         Flag them so they can be fixed by editing. */
      var unlinked = r.type === "Recognition" && !r.userId
        ? ' <span class="tag" title="Typed in by hand. Edit it and pick the volunteer.">Not linked</span>'
        : "";

      return '' +
        '<tr>' +
          '<td><span class="cell-primary">' + esc(r.title) + '</span>' + unlinked + '</td>' +
          '<td>' + esc(r.body) + '</td>' +
          '<td>' + (r.year || "—") + '</td>' +
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

  /* ------------------------------------------------------------------
     Form
     ------------------------------------------------------------------ */

  var FIELD_IDS = ["rVolunteer", "rEvent", "rTitle", "rBody", "rYear"];

  function clearErrors() {
    FIELD_IDS.forEach(function (id) {
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

    if (F.type.value === "Recognition") {
      if (!F.volunteer.value) bad("rVolunteer", "Pick the volunteer from the list.");
    } else {
      if (F.title.value.trim().length < 3) bad("rTitle", "Add the award title.");
    }

    if (!F.body.value.trim()) {
      bad("rBody", F.type.value === "Recognition"
        ? "One line on what they did."
        : "Who gave the award?");
    }

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
    lastAuto = "";

    document.getElementById("formTitle").textContent = editId ? "Edit entry" : "New entry";
    document.getElementById("saveEntry").textContent = editId ? "Save changes" : "Add entry";

    if (editId) {
      var r = all.filter(function (x) { return x._id === editId; })[0];
      F.type.value      = r.type;
      F.volunteer.value = r.userId || "";
      fillEventSelect(r.userId || "", r.eventId || "");
      F.title.value     = r.type === "Award" ? r.title : "";
      F.body.value      = r.body || "";
      F.year.value      = r.year || new Date().getFullYear();
    } else {
      F.type.value      = type === "Award" ? "Award" : "Recognition";
      F.volunteer.value = "";
      fillEventSelect("", "");
      F.title.value = F.body.value = "";
      F.year.value  = new Date().getFullYear();
    }

    applyType();
    CSAdmin.openModal("formModal");
  }

  document.getElementById("saveEntry").addEventListener("click", function () {
    if (!validate()) return;

    var isVolunteer = F.type.value === "Recognition";

    var payload = {
      type:    F.type.value,
      body:    F.body.value.trim(),
      year:    parseInt(F.year.value, 10),
      /* The server fills in the volunteer's name itself. */
      title:   isVolunteer ? null : F.title.value.trim(),
      userId:  isVolunteer ? F.volunteer.value : null,
      eventId: isVolunteer ? (F.event.value || null) : null
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

  /* ------------------------------------------------------------------
     Wiring
     ------------------------------------------------------------------ */

  document.getElementById("newEntry").addEventListener("click", function () { openForm(null); });

  rowsEl.addEventListener("click", function (e) {
    var edit = e.target.closest("[data-edit]");
    var del  = e.target.closest("[data-del]");

    if (edit) openForm(edit.getAttribute("data-edit"));

    if (del) {
      deleteId = del.getAttribute("data-del");
      var r = all.filter(function (x) { return x._id === deleteId; })[0];
      document.getElementById("deleteTitle").textContent = "Delete “" + r.title + "”?";
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
  loadPickers();

})();
