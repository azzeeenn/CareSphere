/* ==========================================================================
   CareSphere — Admin Home
   Every number on this page is read from CSStore, so it stays in step with
   whatever the volunteer pages and the other admin pages have written.
   ========================================================================== */

(function () {
  "use strict";

  var user = CSAdmin.init();

  /* ---- Greeting -------------------------------------------------------- */

  var hour = new Date().getHours();
  var part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  document.getElementById("greetingLine").textContent = part + ", " + user.name;
  /* "Admin Home" at the top is the page name, the same for everyone.
     The line under the greeting says which role this person actually
     has, so it is obvious straight away. */
  document.getElementById("todayLine").textContent =
    new Date().toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    }) + " \u00B7 Signed in as " + (user.role === "super_admin" ? "Super Admin" : "Admin");

  /* ---- Counts ---------------------------------------------------------- */

  function paint(key, value) {
    document.querySelectorAll('[data-stat="' + key + '"]').forEach(function (el) {
      el.textContent = value;
    });
  }

  Promise.all([
    CSStore.find("applications"),
    CSStore.find("events"),
    CSStore.find("messages"),
    CSStore.find("users"),
    CSStore.find("hours"),
    CSStore.find("news"),
    CSStore.find("testimonials"),
    CSStore.find("recognition"),
    CSStore.find("faq"),
    CSStore.find("donations"),
    CSStore.find("impact"),
    CSStore.find("certificates")
  ]).then(function (r) {

    var apps = r[0], events = r[1], messages = r[2], users = r[3],
        hours = r[4], news = r[5], testimonials = r[6],
        recognition = r[7], faq = r[8], donations = r[9], impact = r[10],
        certificates = r[11];

    function by(list, key, value) {
      return list.filter(function (d) { return d[key] === value; });
    }

    var pending  = by(apps, "status", "pending");
    var upcoming = events.filter(function (e) {
      return e.status === "published" && new Date(e.startsAt) >= new Date();
    });
    var unread   = by(messages, "status", "new");

    paint("applications",     pending.length);
    paint("events",           upcoming.length);
    paint("messages",         unread.length);
    paint("volunteers",       users.filter(function (u) { return u.role === "volunteer" && u.active; }).length);
    paint("hours",            by(hours, "status", "pending").length);
    paint("newsDrafts",       by(news, "status", "draft").length);
    paint("testimonials",     by(testimonials, "status", "pending").length);
    paint("recognition",      recognition.length);
    paint("faq",              faq.length);
    paint("donationsPending", by(donations, "status", "pending").length);
    paint("impact",           impact.length);
    paint("certificates",     by(certificates, "status", "pending").length);

    /* Next upcoming event, shown under the events stat */
    var note = document.querySelector('[data-stat-note="events"]');
    if (note && upcoming.length) {
      var next = upcoming.slice().sort(function (a, b) {
        return new Date(a.startsAt) - new Date(b.startsAt);
      })[0];
      note.textContent = "Next: " + next.title;
    }

    /* Attention strip — only when something is actually waiting */
    var strip = document.getElementById("attentionStrip");
    if (pending.length) {
      var oldest = pending.slice().sort(function (a, b) {
        return new Date(a.submittedAt) - new Date(b.submittedAt);
      })[0];

      document.getElementById("attentionTitle").textContent =
        pending.length === 1
          ? "1 volunteer application is waiting for review"
          : pending.length + " volunteer applications are waiting for review";

      document.getElementById("attentionSub").textContent =
        "The oldest was submitted " + CSAdmin.daysAgo(oldest.submittedAt) + ".";

      strip.hidden = false;
    }
  });

})();
