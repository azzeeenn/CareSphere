/* ==========================================================================
   CareSphere — Volunteer dashboard

   Guarded: reaching this page at all means an admin approved the
   application. If the session says otherwise, auth.js sends them back.
   ========================================================================== */

(function () {
  "use strict";

  var user = CSAuth.require("volunteer", "login.html");
  if (!user) return;

  /* An approved session is the only one allowed past here */
  if (user.applicationStatus !== "approved") {
    window.location.replace("login.html");
    return;
  }

  CSVol.buildNav();

  document.getElementById("signOut").addEventListener("click", function () {
    CSAuth.signOut("login.html");
  });

  var esc = CSAuth.esc;

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return iso || "—";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  function dayPart(iso) {
    var d = new Date(iso);
    return {
      day:   d.toLocaleDateString("en-IN", { day: "numeric" }),
      month: d.toLocaleDateString("en-IN", { month: "short" })
    };
  }

  function time(iso) {
    var d = new Date(iso);
    return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  }

  function catClass(c) {
    return c === "Education" ? "is-education" : c === "Healthcare" ? "is-healthcare" : "is-green";
  }

  /* ------------------------------------------------------------------ */

  var hour = new Date().getHours();
  var part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  document.getElementById("greeting").textContent = part + ", " + user.name.split(" ")[0];

  Promise.all([
    CSStore.find("registrations", { userId: user._id }),
    CSStore.find("events"),
    CSStore.find("hours", { userId: user._id }),
    CSStore.findById("applications", user.applicationId)
  ]).then(function (r) {

    var myRegs = r[0], events = r[1], myHours = r[2], app = r[3];
    var now = new Date();

    var eventById = {};
    events.forEach(function (e) { eventById[e._id] = e; });

    var active = myRegs.filter(function (g) { return g.status !== "cancelled"; });

    /* ---- Stats ---- */

    var verified = myHours.filter(function (h) { return h.status === "verified"; })
                          .reduce(function (s, h) { return s + h.hours; }, 0);
    var pending  = myHours.filter(function (h) { return h.status === "pending"; })
                          .reduce(function (s, h) { return s + h.hours; }, 0);

    document.getElementById("statEvents").textContent  = active.length;
    document.getElementById("statHours").textContent   = verified;
    document.getElementById("statPending").textContent = pending;

    if (app) {
      document.getElementById("statSince").textContent = fmtDate(app.reviewedAt);
      document.getElementById("noteSince").textContent = app.district;
      document.getElementById("subline").textContent =
        app.interest + " · " + app.district + " · " + app.availability.toLowerCase();
    }

    /* ---- Coming up ---- */

    var upcoming = active
      .map(function (g) { return { reg: g, event: eventById[g.eventId] }; })
      .filter(function (x) {
        return x.event && new Date(x.event.startsAt) >= now && x.event.status === "published";
      })
      .sort(function (a, b) { return new Date(a.event.startsAt) - new Date(b.event.startsAt); });

    var list = document.getElementById("upcomingList");

    if (!upcoming.length) {
      list.innerHTML =
        '<div class="vol-empty">' +
          '<h3>Nothing in your diary yet</h3>' +
          '<p>Join an event below and it will show up here.</p>' +
        '</div>';
    } else {
      list.innerHTML = upcoming.slice(0, 4).map(function (x) {
        var d = dayPart(x.event.startsAt);
        return '' +
          '<article class="vol-card">' +
            '<span class="vol-date"><b>' + d.day + '</b><span>' + d.month + '</span></span>' +
            '<span class="vol-card-body">' +
              '<h3>' + esc(x.event.title) + '</h3>' +
              '<p>' + esc(x.event.venue) + ' · ' + time(x.event.startsAt) + '</p>' +
            '</span>' +
            '<span class="vol-badge is-' + x.reg.status + '">' +
              (x.reg.status === "confirmed" ? "Confirmed" : "On the waiting list") +
            '</span>' +
          '</article>';
      }).join("");
    }

    /* ---- Open to join ---- */

    var joined = {};
    active.forEach(function (g) { joined[g.eventId] = true; });

    var open = events.filter(function (e) {
      return e.status === "published" &&
             new Date(e.startsAt) >= now &&
             !joined[e._id];
    }).sort(function (a, b) { return new Date(a.startsAt) - new Date(b.startsAt); });

    var openList = document.getElementById("openList");

    if (!open.length) {
      openList.innerHTML =
        '<div class="vol-empty">' +
          '<h3>No open events right now</h3>' +
          '<p>New ones are added as districts confirm their plans. Check back soon.</p>' +
        '</div>';
    } else {
      openList.innerHTML = open.slice(0, 4).map(function (e) {
        var d = dayPart(e.startsAt);
        var left = e.capacity - e.registered;
        return '' +
          '<article class="vol-card">' +
            '<span class="vol-date"><b>' + d.day + '</b><span>' + d.month + '</span></span>' +
            '<span class="vol-card-body">' +
              '<h3>' + esc(e.title) + '</h3>' +
              '<p>' + esc(e.venue) + ' · ' + esc(e.district) + ' · ' +
                 (left > 0 ? left + " places left" : "Full, waiting list only") + '</p>' +
            '</span>' +
            '<span class="tag ' + catClass(e.category) + '">' + esc(e.category) + '</span>' +
            '<a class="btn btn-primary" href="volunteer-my-events.html">View</a>' +
          '</article>';
      }).join("");
    }

  });

})();
