/* ==========================================================================
   CareSphere — Admin shell
   Renders the sidebar, runs the mobile drawer, gates Super Admin items and
   exposes helpers every admin page reuses.

   The nav lives in ONE array below. Adding a module means editing this
   file, not fifteen HTML files.

   Each page sets <body class="admin" data-page="events"> and the matching
   nav item is marked active automatically.
   ========================================================================== */

var CSAdmin = (function () {
  "use strict";

  /* ------------------------------------------------------------------
     Icons — inline SVG, no CDN
     ------------------------------------------------------------------ */

  var ICON = {
    home:      '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>',
    doc:       '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="m9 14 2 2 4-4"/>',
    people:    '<path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="3.2"/><path d="M22 20v-2a4 4 0 0 0-3-3.8"/><path d="M16 3.3a4 4 0 0 1 0 7.4"/>',
    clock:     '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 1.9"/>',
    calendar:  '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/>',
    news:      '<path d="M4 5h13a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2z"/><path d="M19 8h1.5A1.5 1.5 0 0 1 22 9.5V17a2 2 0 0 1-2 2"/><path d="M8 9h7M8 13h7M8 16h4"/>',
    image:     '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m4 17 5-5 4.5 4.5L17 13l3 3"/>',
    quote:     '<path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.4-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14.5h4"/>',
    trophy:    '<circle cx="12" cy="9" r="5.5"/><path d="m8.2 13.5-1.4 7 5.2-2.6 5.2 2.6-1.4-7"/>',
    help:      '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .9-1 1.6v.3"/><path d="M12 17h.01"/>',
    heart:     '<path d="M20.5 8.5 12 20 3.5 8.5A4.6 4.6 0 0 1 12 5.5a4.6 4.6 0 0 1 8.5 3z"/>',
    mail:      '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
    bars:      '<path d="M4 20V11M10 20V5M16 20v-6M22 20H2"/>',
    building:  '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7.5h2M13 7.5h2M9 11.5h2M13 11.5h2"/><path d="M10 21v-4h4v4"/>',
    certificate: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><circle cx="12" cy="13" r="2.4"/><path d="m10.4 15.2-.6 3.4 2.2-1.2 2.2 1.2-.6-3.4"/>',
    lock:      '<rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2"/>',
    gear:      '<circle cx="12" cy="12" r="3"/><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1z"/>'
  };

  function svg(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
           'stroke-linecap="round" stroke-linejoin="round">' + ICON[name] + '</svg>';
  }

  /* ------------------------------------------------------------------
     Nav configuration — the single place to add or rename a module
     badge: [collection, query]  ->  a live coral count
     ------------------------------------------------------------------ */

  var NAV = [
    { group: null, accent: null, items: [
      { page: "home", label: "Admin Home", href: "admin-home.html", icon: "home" }
    ]},

    { group: "People", accent: "people", items: [
      { page: "applications", label: "Applications",      href: "admin-volunteer-applications.html", icon: "doc",    badge: ["applications", { status: "pending" }] },
      { page: "volunteers",   label: "Volunteers",        href: "admin-volunteers.html",             icon: "people" },
      { page: "hours",        label: "Hours Verification", href: "admin-hours-verification.html",    icon: "clock",  badge: ["hours",        { status: "pending" }] },
      { page: "certificates", label: "Certificates",       href: "admin-certificates.html",          icon: "certificate", badge: ["certificates", { status: "pending" }] }
    ]},

    { group: "Content", accent: "content", items: [
      { page: "events",       label: "Events",            href: "admin-events.html",        icon: "calendar" },
      { page: "news",         label: "News & Updates",    href: "admin-news.html",          icon: "news"     },
      { page: "gallery",      label: "Gallery",           href: "admin-gallery.html",       icon: "image"    },
      { page: "testimonials", label: "Testimonials",      href: "admin-testimonials.html",  icon: "quote",   badge: ["testimonials", { status: "pending" }] },
      { page: "recognition",  label: "Recognition",       href: "admin-recognition.html",   icon: "trophy"   },
      { page: "faq",          label: "FAQ",               href: "admin-faq.html",           icon: "help"     }
    ]},

    { group: "Operations", accent: "ops", items: [
      { page: "donations",    label: "Donations",      href: "admin-donations.html",       icon: "heart", superOnly: true },
      { page: "messages",     label: "Messages",       href: "admin-messages.html",        icon: "mail",  badge: ["messages", { status: "new" }] },
      { page: "partnerships", label: "Partnerships",   href: "admin-partnerships.html",    icon: "building", badge: ["partnerships", { status: "new" }] },
      { page: "impact",       label: "Impact Numbers", href: "admin-impact-numbers.html",  icon: "bars", superOnly: true  },
      { page: "users",        label: "Admin Users",    href: "admin-users.html",           icon: "lock", superOnly: true },
      { page: "settings",     label: "Settings",       href: "admin-settings.html",        icon: "gear", superOnly: true  }
    ]}
  ];

  /* ------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------ */

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  function fmtDateTime(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + ", " +
           d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  }

  function daysAgo(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    var n = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (n <= 0) return "today";
    if (n === 1) return "yesterday";
    return n + " days ago";
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  /* ------------------------------------------------------------------
     Toast
     ------------------------------------------------------------------ */

  function toast(message, tone) {
    var host = document.getElementById("csToastHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "csToastHost";
      host.className = "toast-host";
      document.body.appendChild(host);
    }
    var el = document.createElement("div");
    el.className = "toast" + (tone ? " is-" + tone : "");
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
     Modal
     ------------------------------------------------------------------ */

  var lastFocused = null;

  function openModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    lastFocused = document.activeElement;
    m.classList.add("is-open");
    document.body.style.overflow = "hidden";
    var first = m.querySelector("[data-autofocus], .modal-close");
    if (first) first.focus();
  }

  function closeModal(id) {
    var m = id ? document.getElementById(id) : document.querySelector(".modal.is-open");
    if (!m) return;
    m.classList.remove("is-open");
    document.body.style.overflow = "";
    if (lastFocused) lastFocused.focus();
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  document.addEventListener("click", function (e) {
    if (e.target.classList && e.target.classList.contains("modal")) closeModal();
    if (e.target.closest && e.target.closest("[data-close-modal]")) closeModal();
  });

  /* ------------------------------------------------------------------
     Sidebar rendering
     ------------------------------------------------------------------ */

  var LOGIN = "../../../frontend/html/login.html";

  /* Admin pages are for admins. No session, or a volunteer session, and
     you go back to the sign-in page. Display-only enforcement — the real
     check has to live on the server. */
  function currentUser() {
    var user = CSStore.session.get();
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      window.location.replace(LOGIN);
      return null;
    }
    return user;
  }

  function renderSidebar(activePage, user) {
    var html = '' +
      '<div class="sidebar-brand">' +
        '<span class="brand-mark"><img src="../../../frontend/logo-badge.png" alt=""></span>' +
        '<span class="brand-text">' +
          '<span class="brand-name">CareSphere</span>' +
          '<span class="brand-sub">Admin</span>' +
        '</span>' +
      '</div>' +
      '<nav class="sidebar-nav">';

    NAV.forEach(function (block) {
      html += '<div class="nav-group"' + (block.accent ? ' data-group="' + block.accent + '"' : '') + '>';
      if (block.group) html += '<p class="nav-label">' + esc(block.group) + '</p>';

      block.items.forEach(function (it) {
        html += '<a class="nav-item' + (it.page === activePage ? " is-active" : "") + '"' +
                ' href="' + it.href + '"' +
                (it.superOnly ? ' data-superadmin' : '') + '>' +
                svg(it.icon) + esc(it.label) +
                (it.badge ? '<span class="nav-count" data-badge="' + it.page + '" hidden>0</span>' : '') +
                '</a>';
      });

      html += '</div>';
    });

    html += '</nav>' +
      '<div class="sidebar-foot">' +
        '<div class="user-chip">' +
          '<span class="user-avatar">' + esc(user.name.charAt(0).toUpperCase()) + '</span>' +
          '<span class="user-meta">' +
            '<span class="user-name">' + esc(user.name) + '</span>' +
            '<span class="user-role">' + (user.role === "super_admin" ? "Super Admin" : "Admin") + '</span>' +
          '</span>' +
        '</div>' +
        '<button class="btn-signout" type="button" id="signOut">Sign out</button>' +
      '</div>';

    document.getElementById("sidebar").innerHTML = html;
  }

  function isSuper() {
    var u = CSStore.session.get();
    return !!u && u.role === "super_admin";
  }

  /* Pages marked data-superonly turn a plain Admin away. Hiding the nav
     item isn't enough — anyone can type the URL. */
  function guardSuperOnly() {
    if (document.body.getAttribute("data-superonly") !== "true") return true;
    if (isSuper()) return true;

    toast("Only a Super Admin can open that page", "warn");
    setTimeout(function () { window.location.replace("admin-home.html"); }, 900);
    return false;
  }

  function applyRole(role) {
    var isSuper = role === "super_admin";
    document.querySelectorAll("[data-superadmin]").forEach(function (el) {
      el.style.display = isSuper ? "" : "none";
    });
  }

  function refreshBadges() {
    NAV.forEach(function (block) {
      block.items.forEach(function (it) {
        if (!it.badge) return;
        CSStore.count(it.badge[0], it.badge[1]).then(function (n) {
          var el = document.querySelector('[data-badge="' + it.page + '"]');
          if (!el) return;
          el.textContent = n;
          el.hidden = n === 0;
        });
      });
    });
  }

  /* ------------------------------------------------------------------
     Mobile drawer
     ------------------------------------------------------------------ */

  function wireDrawer() {
    var toggle  = document.getElementById("menuToggle");
    var sidebar = document.getElementById("sidebar");
    var scrim   = document.getElementById("scrim");
    if (!toggle || !scrim) return;

    function set(open) {
      sidebar.classList.toggle("is-open", open);
      toggle.classList.toggle("is-open", open);
      scrim.classList.toggle("is-visible", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.body.style.overflow = open ? "hidden" : "";
    }

    toggle.addEventListener("click", function () {
      set(!sidebar.classList.contains("is-open"));
    });
    scrim.addEventListener("click", function () { set(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && sidebar.classList.contains("is-open")) set(false);
    });
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */

  function init() {
    var user = currentUser();
    if (!user) return null;               /* redirecting away */
    var page = document.body.getAttribute("data-page") || "";

    renderSidebar(page, user);
    applyRole(user.role);

    if (!guardSuperOnly()) return null;

    refreshBadges();
    wireDrawer();

    var out = document.getElementById("signOut");
    if (out) out.addEventListener("click", function () {
      CSStore.session.clear();
      window.location.href = LOGIN;
    });

    return user;
  }

  return {
    init: init,
    user: currentUser,
    isSuper: isSuper,
    refreshBadges: refreshBadges,
    esc: esc,
    fmtDate: fmtDate,
    fmtDateTime: fmtDateTime,
    daysAgo: daysAgo,
    today: today,
    toast: toast,
    openModal: openModal,
    closeModal: closeModal,
    svg: svg
  };

})();