/* ==========================================================================
   CareSphere — My events

   Registering has to keep two records in step: a row in registrations, and
   the running count on the event itself. The admin event list reads that
   count, so if they drift the two sides disagree about how full an event is.
   ========================================================================== */

(function () {
  "use strict";

  var user = CSVol.start();
  if (!user) return;

  var view   = "open";
  var events = [];
  var myRegs = [];

  var listEl = document.getElementById("list");
  var esc    = CSVol.esc;

  /* ------------------------------------------------------------------ */

  function load() {
    return Promise.all([
      CSStore.find("events"),
      CSStore.find("registrations", { userId: user._id })
    ]).then(function (r) {
      events = r[0];
      myRegs = r[1].filter(function (g) { return g.status !== "cancelled"; });
      render();
    });
  }

  function regFor(eventId) {
    return myRegs.filter(function (g) { return g.eventId === eventId; })[0] || null;
  }

  /* ------------------------------------------------------------------
     Which events belong in the current tab
     ------------------------------------------------------------------ */

  function visible() {
    var now = new Date();

    if (view === "open") {
      return events.filter(function (e) {
        return e.status === "published" &&
               new Date(e.startsAt) >= now &&
               !regFor(e._id);
      }).sort(function (a, b) { return new Date(a.startsAt) - new Date(b.startsAt); });
    }

    if (view === "mine") {
      return events.filter(function (e) {
        return regFor(e._id) && new Date(e.startsAt) >= now;
      }).sort(function (a, b) { return new Date(a.startsAt) - new Date(b.startsAt); });
    }

    /* past — anything I attended, plus completed events I was on */
    return events.filter(function (e) {
      return regFor(e._id) && new Date(e.startsAt) < now;
    }).sort(function (a, b) { return new Date(b.startsAt) - new Date(a.startsAt); });
  }

  /* ------------------------------------------------------------------
     Render
     ------------------------------------------------------------------ */

  function render() {
    var list = visible();

    if (!list.length) {
      listEl.innerHTML =
        view === "open" ? CSVol.empty(
          "No open events right now",
          "New ones are added as districts confirm their plans. Check back soon."
        ) :
        view === "mine" ? CSVol.empty(
          "You haven't joined anything yet",
          "Have a look at what's open and put your name down."
        ) : CSVol.empty(
          "Nothing behind you yet",
          "Events you attend will be listed here so you can log your hours."
        );
      return;
    }

    listEl.innerHTML = list.map(function (e) {
      var d    = CSVol.dayPart(e.startsAt);
      var reg  = regFor(e._id);
      var left = e.capacity - e.registered;
      var past = new Date(e.startsAt) < new Date();

      var meta = esc(e.venue) + " \u00B7 " + esc(e.district) + " \u00B7 " + CSVol.fmtTime(e.startsAt);

      var right;

      if (past) {
        right = '<a class="btn btn-quiet" href="volunteer-my-hours.html">Log hours</a>';
      } else if (reg) {
        right =
          '<span class="vol-badge is-' + reg.status + '">' +
            (reg.status === "confirmed" ? "Confirmed" : "Waiting list") +
          '</span>' +
          '<button class="btn btn-quiet" type="button" data-cancel="' + e._id + '">Cancel</button>';
      } else if (left > 0) {
        right = '<button class="btn btn-primary" type="button" data-join="' + e._id + '">Join</button>';
      } else {
        right = '<button class="btn btn-quiet" type="button" data-join="' + e._id + '">Join waiting list</button>';
      }

      return '' +
        '<article class="vol-card">' +
          '<span class="vol-date"><b>' + d.day + '</b><span>' + d.month + '</span></span>' +
          '<span class="vol-card-body">' +
            '<h3>' + esc(e.title) + '</h3>' +
            '<p>' + meta + (past ? "" : " \u00B7 " +
              (left > 0 ? left + " places left" : "Full")) + '</p>' +
          '</span>' +
          '<span class="tag ' + CSVol.catClass(e.category) + '">' + esc(e.category) + '</span>' +
          right +
        '</article>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Join
     ------------------------------------------------------------------ */

  function join(eventId) {
    /* Re-read the event rather than trusting what's on screen — an admin
       may have changed the capacity since this page loaded. */
    CSStore.findById("events", eventId).then(function (e) {
      if (!e) return;

      if (e.status !== "published") {
        CSVol.toast("That event isn't open any more", "warn");
        return load();
      }

      var status = e.registered < e.capacity ? "confirmed" : "waitlisted";

      return CSStore.insert("registrations", {
        eventId: eventId,
        userId: user._id,
        name: user.name,
        status: status,
        registeredAt: CSAuth.today()
      }).then(function () {
        /* Only a confirmed place takes up capacity */
        if (status === "confirmed") {
          return CSStore.updateById("events", eventId, { registered: e.registered + 1 });
        }
      }).then(function () {
        CSVol.toast(
          status === "confirmed"
            ? "You're going to " + e.title
            : "Added to the waiting list for " + e.title,
          status === "confirmed" ? "good" : null
        );
        load();
      });
    });
  }

  /* ------------------------------------------------------------------
     Cancel
     ------------------------------------------------------------------ */

  function cancel(eventId) {
    var reg = regFor(eventId);
    if (!reg) return;

    CSStore.findById("events", eventId).then(function (e) {

      return CSStore.updateById("registrations", reg._id, { status: "cancelled" })
        .then(function () {
          /* Giving up a confirmed place frees it for someone else */
          if (reg.status !== "confirmed" || !e) return;

          return CSStore.updateById("events", eventId, {
            registered: Math.max(0, e.registered - 1)
          }).then(function () {
            return promoteFromWaitlist(eventId, e.capacity, e.registered - 1);
          });
        })
        .then(function () {
          CSVol.toast("You've been taken off " + (e ? e.title : "that event"), "warn");
          load();
        });
    });
  }

  /* The longest-waiting person moves up when a place opens */
  function promoteFromWaitlist(eventId, capacity, currentCount) {
    if (currentCount >= capacity) return;

    return CSStore.find("registrations", { eventId: eventId, status: "waitlisted" })
      .then(function (waiting) {
        if (!waiting.length) return;

        var next = waiting.sort(function (a, b) {
          return new Date(a.registeredAt) - new Date(b.registeredAt);
        })[0];

        return CSStore.updateById("registrations", next._id, { status: "confirmed" })
          .then(function () {
            return CSStore.updateById("events", eventId, { registered: currentCount + 1 });
          });
      });
  }

  /* ------------------------------------------------------------------
     Events
     ------------------------------------------------------------------ */

  listEl.addEventListener("click", function (e) {
    var j = e.target.closest("[data-join]");
    var c = e.target.closest("[data-cancel]");
    if (j) join(j.getAttribute("data-join"));
    if (c) cancel(c.getAttribute("data-cancel"));
  });

  document.getElementById("filters").addEventListener("click", function (e) {
    var chip = e.target.closest(".vol-chip");
    if (!chip) return;
    this.querySelectorAll(".vol-chip").forEach(function (c) { c.classList.remove("is-on"); });
    chip.classList.add("is-on");
    view = chip.getAttribute("data-view");
    render();
  });

  load();

})();
