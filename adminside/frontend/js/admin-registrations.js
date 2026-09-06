/* ==========================================================================
   CareSphere — Event registrations

   The roster an organiser actually needs on the day: who is coming, how to
   reach them, and a sheet to print and tick off.

   Phone numbers live on the application record rather than the account, so
   this page joins registrations to users to applications to get them.

   The event a page opens on comes from ?event=evt_001 in the URL, which is
   how the Events table links through.
   ========================================================================== */

(function () {
  "use strict";

  CSAdmin.init();

  var events   = [];
  var event    = null;
  var roster   = [];   // registrations for this event, joined with contact details
  var contacts = {};   // userId -> { phone, email, district }
  var status   = "active";
  var term     = "";
  var removeId = null;

  var rowsEl    = document.getElementById("rows");
  var emptyEl   = document.getElementById("emptyState");
  var summaryEl = document.getElementById("summaryRow");
  var pickerEl  = document.getElementById("eventPicker");
  var esc       = CSAdmin.esc;

  var LABEL = {
    confirmed:  { text: "Going",        cls: "is-approved" },
    waitlisted: { text: "Waiting list", cls: "is-pending"  },
    cancelled:  { text: "Cancelled",    cls: "is-draft"    }
  };

  /* ------------------------------------------------------------------
     Which event are we looking at
     ------------------------------------------------------------------ */

  function eventIdFromUrl() {
    var match = window.location.search.match(/[?&]event=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setUrl(id) {
    var url = window.location.pathname + "?event=" + encodeURIComponent(id);
    window.history.replaceState({}, "", url);
  }

  /* ------------------------------------------------------------------
     Load
     ------------------------------------------------------------------ */

  function boot() {
    return Promise.all([
      CSStore.find("events"),
      CSStore.find("users", { role: "volunteer" }),
      CSStore.find("applications", { status: "approved" })
    ]).then(function (r) {
      events = r[0].sort(function (a, b) {
        return new Date(b.startsAt) - new Date(a.startsAt);
      });

      var appByUser = {};
      r[2].forEach(function (a) { appByUser[a.userId] = a; });

      r[1].forEach(function (u) {
        var app = appByUser[u._id];
        contacts[u._id] = {
          name:     u.name,
          email:    u.email,
          active:   u.active,
          phone:    app ? app.phone : "",
          district: app ? app.district : "",
          approved: !!app
        };
      });

      if (!events.length) {
        pickerEl.innerHTML = '<option>No events yet</option>';
        emptyEl.hidden = false;
        return;
      }

      pickerEl.innerHTML = events.map(function (e) {
        return '<option value="' + esc(e._id) + '">' +
                 esc(e.title) + " \u2014 " + CSAdmin.fmtDate(e.startsAt) +
               '</option>';
      }).join("");

      var wanted = eventIdFromUrl();
      var exists = wanted && events.some(function (e) { return e._id === wanted; });

      pickerEl.value = exists ? wanted : events[0]._id;
      return select(pickerEl.value);
    });
  }

  function select(eventId) {
    setUrl(eventId);

    return Promise.all([
      CSStore.findById("events", eventId),
      CSStore.find("registrations", { eventId: eventId })
    ]).then(function (r) {
      event = r[0];

      roster = r[1].map(function (g) {
        var c = contacts[g.userId] || {};
        return {
          _id:      g._id,
          userId:   g.userId,
          name:     c.name || g.name,
          email:    c.email || "",
          phone:    c.phone || "",
          district: c.district || "",
          active:   c.active !== false,
          status:   g.status,
          registeredAt: g.registeredAt
        };
      }).sort(function (a, b) {
        /* Confirmed first, then the waiting list in the order they joined */
        var rank = { confirmed: 0, waitlisted: 1, cancelled: 2 };
        if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
        return new Date(a.registeredAt) - new Date(b.registeredAt);
      });

      renderHead();
      render();
    });
  }

  /* ------------------------------------------------------------------
     Event summary
     ------------------------------------------------------------------ */

  function renderHead() {
    if (!event) return;

    var d = new Date(event.startsAt);
    var confirmed = roster.filter(function (p) { return p.status === "confirmed"; }).length;
    var waiting   = roster.filter(function (p) { return p.status === "waitlisted"; }).length;
    var pct       = Math.min(100, Math.round((confirmed / event.capacity) * 100));
    var left      = event.capacity - confirmed;

    var cat = event.category === "Education"  ? "is-education"
            : event.category === "Healthcare" ? "is-healthcare" : "is-green";

    var stateCls = event.status === "published" ? "is-published"
                 : event.status === "draft"     ? "is-draft"
                 : event.status === "completed" ? "is-completed" : "is-cancelled";

    document.getElementById("rosterHead").innerHTML =
      '<span class="roster-date">' +
        '<b>' + d.toLocaleDateString("en-IN", { day: "numeric" }) + '</b>' +
        '<span>' + d.toLocaleDateString("en-IN", { month: "short" }) + '</span>' +
      '</span>' +
      '<span class="roster-info">' +
        '<h2>' + esc(event.title) + '</h2>' +
        '<p>' + esc(event.venue) + ' \u00B7 ' + esc(event.district) + ' \u00B7 ' +
           CSAdmin.fmtDateTime(event.startsAt) + '</p>' +
        '<span class="roster-tags">' +
          '<span class="tag ' + cat + '">' + esc(event.category) + '</span>' +
          '<span class="status-badge ' + stateCls + '">' +
            event.status.charAt(0).toUpperCase() + event.status.slice(1) + '</span>' +
        '</span>' +
      '</span>' +
      '<span class="capacity">' +
        '<span class="capacity-top">' +
          '<b>' + confirmed + ' / ' + event.capacity + '</b>' +
          '<span>places filled</span>' +
        '</span>' +
        '<span class="capacity-bar">' +
          '<span class="capacity-fill' + (left <= 0 ? " is-full" : "") +
            '" style="width:' + pct + '%"></span>' +
        '</span>' +
        '<span class="capacity-note' + (left <= 0 ? " is-hot" : "") + '">' +
          (left > 0
            ? left + (left === 1 ? " place still open" : " places still open")
            : "Full" + (waiting ? " \u00B7 " + waiting + " waiting" : "")) +
        '</span>' +
      '</span>';

    document.getElementById("rosterHead").hidden = false;

    document.getElementById("printFoot").textContent =
      "CareSphere \u00B7 " + event.title + " \u00B7 " +
      CSAdmin.fmtDateTime(event.startsAt) + " \u00B7 " + event.venue +
      " \u00B7 printed " + CSAdmin.fmtDate(CSAdmin.today());
  }

  /* ------------------------------------------------------------------
     Roster
     ------------------------------------------------------------------ */

  function visible() {
    return roster.filter(function (p) {
      if (status === "active"     && p.status !== "confirmed")  return false;
      if (status === "waitlisted" && p.status !== "waitlisted") return false;
      if (status === "cancelled"  && p.status !== "cancelled")  return false;
      if (!term) return true;
      return p.name.toLowerCase().indexOf(term) !== -1;
    });
  }

  function render() {
    var confirmed = roster.filter(function (p) { return p.status === "confirmed"; }).length;
    var waiting   = roster.filter(function (p) { return p.status === "waitlisted"; }).length;
    var gone      = roster.filter(function (p) { return p.status === "cancelled"; }).length;
    var districts = {};
    roster.forEach(function (p) { if (p.status === "confirmed") districts[p.district] = 1; });

    summaryEl.innerHTML =
      '<div class="summary-chip"><b>' + confirmed + '</b><span>going</span></div>' +
      '<div class="summary-chip' + (waiting ? " is-hot" : "") + '"><b>' + waiting + '</b><span>waiting</span></div>' +
      '<div class="summary-chip"><b>' + gone + '</b><span>cancelled</span></div>' +
      '<div class="summary-chip"><b>' + Object.keys(districts).length + '</b><span>districts</span></div>';

    var list = visible();

    if (!list.length) {
      rowsEl.innerHTML = "";
      emptyEl.hidden = false;
      document.getElementById("emptyTitle").textContent =
        term ? "No matches" : roster.length ? "Nobody in this list" : "Nobody signed up yet";
      document.getElementById("emptyBody").textContent =
        term ? "Try a different name."
             : roster.length ? "Switch tabs to see the others."
             : "Volunteers who join this event will appear here.";
      return;
    }

    emptyEl.hidden = true;

    rowsEl.innerHTML = list.map(function (p, i) {
      var badge = LABEL[p.status] || LABEL.confirmed;

      var actions = "";
      if (p.status === "confirmed") {
        actions =
          '<button class="btn btn-ghost btn-sm" data-move="' + p._id + '" data-to="waitlisted">To waiting list</button> ' +
          '<button class="btn btn-danger btn-sm" data-remove="' + p._id + '">Remove</button>';
      } else if (p.status === "waitlisted") {
        actions =
          '<button class="btn btn-primary btn-sm" data-move="' + p._id + '" data-to="confirmed">Give a place</button> ' +
          '<button class="btn btn-danger btn-sm" data-remove="' + p._id + '">Remove</button>';
      } else {
        actions =
          '<button class="btn btn-quiet btn-sm" data-move="' + p._id + '" data-to="confirmed">Put back on</button>';
      }

      return '' +
        '<tr>' +
          '<td class="row-num">' + (i + 1) + '</td>' +
          '<td>' +
            '<span class="avatar-cell">' +
              '<span class="avatar-sm">' + esc(p.name.charAt(0)) + '</span>' +
              '<span>' +
                '<span class="cell-primary">' + esc(p.name) +
                  (!p.active ? ' <span class="tag">Deactivated</span>' : '') +
                '</span>' +
                '<span class="contact-line"><a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a></span>' +
              '</span>' +
            '</span>' +
          '</td>' +
          '<td>' + (p.phone
            ? '<a class="contact-line" style="margin:0" href="tel:' + esc(p.phone.replace(/\s/g, "")) + '">' + esc(p.phone) + '</a>'
            : '<span style="color:var(--cs-muted)">\u2014</span>') + '</td>' +
          '<td>' + esc(p.district || "\u2014") + '</td>' +
          '<td>' + CSAdmin.fmtDate(p.registeredAt) + '</td>' +
          '<td><span class="status-badge ' + badge.cls + '">' + badge.text + '</span></td>' +
          '<td class="sign-cell"></td>' +
          '<td class="cell-actions no-print">' + actions + '</td>' +
        '</tr>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Keeping the count on the event honest

     The events table shows registered / capacity, so any status change
     here has to rewrite that number. Recounting from the registrations
     is safer than adding and subtracting as we go.
     ------------------------------------------------------------------ */

  function recount(eventId) {
    return CSStore.find("registrations", { eventId: eventId, status: "confirmed" })
      .then(function (confirmed) {
        return CSStore.updateById("events", eventId, { registered: confirmed.length });
      });
  }

  function move(regId, to) {
    var person = roster.filter(function (p) { return p._id === regId; })[0];
    if (!person) return;

    var confirmed = roster.filter(function (p) { return p.status === "confirmed"; }).length;

    if (to === "confirmed" && person.status !== "confirmed" && confirmed >= event.capacity) {
      CSAdmin.toast("The event is full. Raise the capacity first, or move someone off.", "warn");
      return;
    }

    CSStore.updateById("registrations", regId, { status: to })
      .then(function () { return recount(event._id); })
      .then(function () {
        CSAdmin.toast(
          to === "confirmed"  ? person.name + " has a place" :
          to === "waitlisted" ? person.name + " moved to the waiting list"
                              : person.name + " taken off",
          to === "confirmed" ? "good" : "warn"
        );
        return select(event._id);
      });
  }

  /* ------------------------------------------------------------------
     Add someone by hand
     ------------------------------------------------------------------ */

  function openAdd() {
    var already = {};
    roster.forEach(function (p) {
      if (p.status !== "cancelled") already[p.userId] = true;
    });

    var choices = Object.keys(contacts).filter(function (id) {
      return contacts[id].approved && contacts[id].active && !already[id];
    }).sort(function (a, b) {
      return contacts[a].name.localeCompare(contacts[b].name);
    });

    var picker = document.getElementById("addPicker");
    var confirm = document.getElementById("confirmAdd");

    document.getElementById("addError").textContent = "";
    picker.closest(".field").classList.remove("has-error");

    if (!choices.length) {
      picker.innerHTML = '<option>Nobody available</option>';
      picker.disabled = true;
      confirm.disabled = true;
      document.getElementById("addHint").textContent =
        "Every approved volunteer is already on this event.";
    } else {
      picker.disabled = false;
      confirm.disabled = false;
      picker.innerHTML = choices.map(function (id) {
        var c = contacts[id];
        return '<option value="' + esc(id) + '">' +
                 esc(c.name) + " \u2014 " + esc(c.district) +
               '</option>';
      }).join("");

      var confirmed = roster.filter(function (p) { return p.status === "confirmed"; }).length;
      document.getElementById("addHint").textContent = confirmed >= event.capacity
        ? "The event is full, so they'll go onto the waiting list."
        : "They'll be given a place straight away.";
    }

    CSAdmin.openModal("addModal");
  }

  document.getElementById("confirmAdd").addEventListener("click", function () {
    var userId = document.getElementById("addPicker").value;
    var c = contacts[userId];
    if (!c) return;

    var confirmed = roster.filter(function (p) { return p.status === "confirmed"; }).length;
    var newStatus = confirmed < event.capacity ? "confirmed" : "waitlisted";

    /* If they cancelled earlier, reuse that record rather than adding a second */
    var previous = roster.filter(function (p) {
      return p.userId === userId && p.status === "cancelled";
    })[0];

    var work = previous
      ? CSStore.updateById("registrations", previous._id, {
          status: newStatus, registeredAt: CSAdmin.today()
        })
      : CSStore.insert("registrations", {
          eventId: event._id,
          userId: userId,
          name: c.name,
          status: newStatus,
          registeredAt: CSAdmin.today()
        });

    work.then(function () { return recount(event._id); })
        .then(function () {
          CSAdmin.closeModal("addModal");
          CSAdmin.toast(
            newStatus === "confirmed"
              ? c.name + " added to the event"
              : c.name + " added to the waiting list",
            "good"
          );
          return select(event._id);
        });
  });

  /* ------------------------------------------------------------------
     Remove
     ------------------------------------------------------------------ */

  document.getElementById("confirmRemove").addEventListener("click", function () {
    CSAdmin.closeModal("removeModal");
    move(removeId, "cancelled");
  });

  /* ------------------------------------------------------------------
     Export
     ------------------------------------------------------------------ */

  function csvCell(v) {
    var s = String(v == null ? "" : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  document.getElementById("exportCsv").addEventListener("click", function () {
    var list = visible();

    if (!list.length) {
      CSAdmin.toast("Nothing to export with these filters", "warn");
      return;
    }

    var head = ["Name", "Email", "Phone", "District", "Signed up", "Status"];
    var body = list.map(function (p) {
      return [p.name, p.email, p.phone, p.district, p.registeredAt, p.status]
        .map(csvCell).join(",");
    });

    var csv  = head.join(",") + "\n" + body.join("\n");
    var blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    var url  = URL.createObjectURL(blob);
    var name = event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    var a = document.createElement("a");
    a.href = url;
    a.download = "roster-" + name + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    CSAdmin.toast(list.length + " rows exported", "good");
  });

  document.getElementById("printSheet").addEventListener("click", function () {
    window.print();
  });

  /* ------------------------------------------------------------------
     Events
     ------------------------------------------------------------------ */

  pickerEl.addEventListener("change", function () { select(this.value); });

  document.getElementById("addPerson").addEventListener("click", openAdd);

  rowsEl.addEventListener("click", function (e) {
    var mv = e.target.closest("[data-move]");
    var rm = e.target.closest("[data-remove]");

    if (mv) move(mv.getAttribute("data-move"), mv.getAttribute("data-to"));

    if (rm) {
      removeId = rm.getAttribute("data-remove");
      var p = roster.filter(function (x) { return x._id === removeId; })[0];
      document.getElementById("removeTitle").textContent = "Take " + p.name + " off this event?";
      document.getElementById("removeBody").textContent = p.status === "confirmed"
        ? "Their place frees up, but they won't be told automatically. Give them a ring."
        : "They'll come off the waiting list.";
      CSAdmin.openModal("removeModal");
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

  var typing;
  document.getElementById("searchBox").addEventListener("input", function () {
    var v = this.value.trim().toLowerCase();
    clearTimeout(typing);
    typing = setTimeout(function () { term = v; render(); }, 160);
  });

  boot();

})();
