/* ==========================================================================
   CareSphere — Volunteer area helpers
   Guard, top-bar wiring, formatting and toasts. Loaded by every volunteer
   page before its own script.
   ========================================================================== */

var CSVol = (function () {
  "use strict";


  /* ------------------------------------------------------------------
     Top-bar navigation

     Built here rather than copied into each page, so adding a section
     means editing this one list.
     ------------------------------------------------------------------ */

  var NAV = [
    { file: "volunteer-dashboard.html",       label: "Dashboard" },
    { file: "volunteer-my-events.html",       label: "My events" },
    { file: "volunteer-my-hours.html",        label: "My hours" },
    { file: "volunteer-my-certificates.html", label: "Certificates" },
    { file: "volunteer-share-story.html",     label: "My story" },
    { file: "volunteer-become-admin.html",    label: "Become an admin" },
    { file: "volunteer-my-profile.html",      label: "My profile" }
  ];

  function buildNav() {
    var host = document.querySelector(".vol-nav");
    if (!host) return;

    var here = window.location.pathname.split("/").pop() || "volunteer-dashboard.html";

    host.innerHTML = NAV.map(function (item) {
      return '<a href="' + item.file + '"' +
             (item.file === here ? ' class="is-active"' : '') +
             '>' + CSAuth.esc(item.label) + '</a>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Guard — an approved session, or you don't belong here
     ------------------------------------------------------------------ */

  function start() {
    var user = CSAuth.require("volunteer", "login.html");
    if (!user) return null;

    if (user.applicationStatus !== "approved") {
      window.location.replace("login.html");
      return null;
    }

    buildNav();

    var out = document.getElementById("signOut");
    if (out) out.addEventListener("click", function () {
      CSAuth.signOut("login.html");
    });

    return user;
  }

  /* ------------------------------------------------------------------
     Formatting
     ------------------------------------------------------------------ */

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return iso || "\u2014";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  function fmtTime(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  }

  function dayPart(iso) {
    var d = new Date(iso);
    return {
      day:   d.toLocaleDateString("en-IN", { day: "numeric" }),
      month: d.toLocaleDateString("en-IN", { month: "short" })
    };
  }

  function catClass(c) {
    return c === "Education"  ? "is-education"
         : c === "Healthcare" ? "is-healthcare"
         : "is-green";
  }

  /* ------------------------------------------------------------------
     Toast
     ------------------------------------------------------------------ */

  function toast(message, tone) {
    var host = document.getElementById("volToastHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "volToastHost";
      host.className = "vol-toast-host";
      document.body.appendChild(host);
    }

    var el = document.createElement("div");
    el.className = "vol-toast" + (tone ? " is-" + tone : "");
    el.setAttribute("role", "status");
    el.textContent = message;
    host.appendChild(el);

    requestAnimationFrame(function () { el.classList.add("is-in"); });
    setTimeout(function () {
      el.classList.remove("is-in");
      setTimeout(function () { el.remove(); }, 260);
    }, 2800);
  }

  /* ------------------------------------------------------------------
     Empty state markup
     ------------------------------------------------------------------ */

  function empty(title, body, action) {
    return '<div class="vol-empty">' +
             '<h3>' + CSAuth.esc(title) + '</h3>' +
             '<p>' + CSAuth.esc(body) + '</p>' +
             (action || "") +
           '</div>';
  }

  return {
    start: start,
    buildNav: buildNav,
    fmtDate: fmtDate,
    fmtTime: fmtTime,
    dayPart: dayPart,
    catClass: catClass,
    toast: toast,
    empty: empty,
    esc: CSAuth.esc
  };

})();
