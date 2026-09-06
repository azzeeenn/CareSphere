/* ==========================================================================
   CareSphere — Certificate document

   Opened as certificate.html?id=crt_001.

   The wording isn't stored anywhere. It's composed here from the records at
   the moment the certificate is opened: verified hours, the event attended,
   the district and area of work. That way what's on the paper always matches
   what the organisation can actually stand behind.

   Only an issued certificate renders. A pending or declined one shows a
   message instead, and a volunteer can only open their own.
   ========================================================================== */

(function () {
  "use strict";

  var stage = document.getElementById("stage");
  var esc   = CSAuth.esc;

  /* ------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------ */

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return iso || "";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  }

  function idFromUrl() {
    var m = window.location.search.match(/[?&]id=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function problem(title, body, link, label) {
    document.getElementById("docBar").hidden = true;
    document.getElementById("docHint").hidden = true;
    stage.innerHTML =
      '<div class="doc-problem">' +
        '<h1>' + esc(title) + '</h1>' +
        '<p>' + esc(body) + '</p>' +
        (link ? '<a class="doc-btn doc-btn-quiet" href="' + link + '">' + esc(label) + '</a>' : '') +
      '</div>';
  }

  /* ------------------------------------------------------------------
     Wording, one shape per type
     ------------------------------------------------------------------ */

  function compose(cert, facts) {
    var org = facts.org;

    if (cert.type === "hours") {
      return {
        kind: "Certificate of Volunteering Hours",
        lead: "This is to certify that",
        body: "has given <b>" + facts.verifiedHours + " hours</b> of voluntary service to " +
              "<b>" + esc(org) + "</b>, working in " + esc(facts.interest) +
              " across " + esc(facts.district) + " district. " +
              "These hours were recorded against attended programmes and verified by an organiser.",
        figures: [
          { value: facts.verifiedHours, label: "Hours verified" },
          { value: facts.eventsAttended, label: "Programmes attended" },
          { value: facts.district, label: "District" }
        ]
      };
    }

    if (cert.type === "participation") {
      return {
        kind: "Certificate of Participation",
        lead: "This is to certify that",
        body: "took part in <b>" + esc(cert.eventTitle) + "</b>, held at " +
              esc(facts.eventVenue) + ", " + esc(facts.eventDistrict) +
              ", on " + fmtDate(facts.eventDate) + ", as a volunteer with " +
              "<b>" + esc(org) + "</b>.",
        figures: [
          { value: facts.eventCategory, label: "Programme area" },
          { value: facts.eventDistrict, label: "District" },
          { value: facts.eventHours || "\u2014", label: "Hours on the day" }
        ]
      };
    }

    if (cert.type === "recommendation") {
      return {
        kind: "Letter of Recommendation",
        lead: "This letter is issued in respect of",
        body: "who has volunteered with <b>" + esc(org) + "</b> since " +
              fmtDate(facts.joinedAt) + ", contributing <b>" + facts.verifiedHours +
              " verified hours</b> across " + facts.eventsAttended +
              " programmes in " + esc(facts.district) + ". " +
              "Throughout this period they have been reliable, worked well alongside " +
              "our field teams, and represented the foundation with care. " +
              "We recommend them without reservation." +
              (cert.referenceName
                ? " A further reference is available from " + esc(cert.referenceName) +
                  ", " + esc(cert.referenceRole) + "."
                : ""),
        figures: [
          { value: facts.verifiedHours, label: "Hours verified" },
          { value: facts.eventsAttended, label: "Programmes attended" },
          { value: facts.interest, label: "Area of work" }
        ]
      };
    }

    /* completion */
    return {
      kind: "Certificate of Service Completion",
      lead: "This is to certify that",
      body: "has completed a period of voluntary service with <b>" + esc(org) + "</b>, " +
            "beginning " + fmtDate(facts.joinedAt) + " and contributing " +
            "<b>" + facts.verifiedHours + " verified hours</b> across " +
            facts.eventsAttended + " programmes in " + esc(facts.district) +
            ", within our " + esc(facts.interest) + " work.",
      figures: [
        { value: facts.verifiedHours, label: "Hours verified" },
        { value: facts.eventsAttended, label: "Programmes attended" },
        { value: fmtDate(facts.joinedAt).split(" ").slice(1).join(" "), label: "Serving since" }
      ]
    };
  }

  /* ------------------------------------------------------------------
     Render
     ------------------------------------------------------------------ */

  function render(cert, facts) {
    var text = compose(cert, facts);

    stage.innerHTML =
      '<article class="sheet">' +
        '<span class="corner tl"></span><span class="corner tr"></span>' +
        '<span class="corner bl"></span><span class="corner br"></span>' +
        '<span class="watermark"><span>CS</span></span>' +

        '<div class="sheet-inner">' +

          '<div class="doc-brand">' +
            '<span class="doc-mark"><img src="../logo.png" alt="" class="brand-logo"></span>' +
            '<span class="doc-org">' +
              '<b>' + esc(facts.org) + '</b>' +
              '<span>' + esc(facts.address) + '</span>' +
            '</span>' +
          '</div>' +

          '<h1 class="doc-kind">' + esc(text.kind) + '</h1>' +
          '<span class="doc-rule"></span>' +

          '<p class="doc-lead">' + esc(text.lead) + '</p>' +
          '<p class="doc-name">' + esc(cert.name) + '</p>' +
          '<span class="doc-underline"></span>' +

          '<p class="doc-body">' + text.body + '</p>' +

          '<div class="doc-figures">' +
            text.figures.map(function (f) {
              return '<span class="doc-figure">' +
                       '<b>' + esc(f.value) + '</b>' +
                       '<span>' + esc(f.label) + '</span>' +
                     '</span>';
            }).join("") +
          '</div>' +

          '<div class="doc-foot">' +

            '<span class="doc-sign">' +
              '<span class="line"></span>' +
              '<b>' + esc(facts.approverName) + '</b>' +
              '<span>' + esc(facts.approverTitle) + '</span>' +
            '</span>' +

            '<span class="doc-centre">' +
              '<span class="doc-seal">' +
                '<b>' + esc(facts.org.split(" ")[0].toUpperCase()) + '</b>' +
                '<span>VERIFIED</span>' +
              '</span>' +
              '<span class="doc-ref">' +
                '<b>' + esc(cert.certificateNo) + '</b>' +
                '<span>Issued ' + fmtDate(cert.issuedAt) + '</span>' +
              '</span>' +
            '</span>' +

            '<span class="doc-sign">' +
              '<span class="line"></span>' +
              '<b>' + esc(facts.directorName) + '</b>' +
              '<span>' + esc(facts.directorTitle) + '</span>' +
            '</span>' +

          '</div>' +

        '</div>' +
      '</article>';

    document.getElementById("docBar").hidden = false;
    document.getElementById("docHint").hidden = false;

    document.title = text.kind + " \u2014 " + cert.name;
  }

  /* ------------------------------------------------------------------
     Gather what the records support
     ------------------------------------------------------------------ */

  function build(cert) {
    return Promise.all([
      CSStore.find("applications", { userId: cert.userId }),
      CSStore.find("hours", { userId: cert.userId }),
      CSStore.find("registrations", { userId: cert.userId }),
      CSStore.find("events"),
      CSStore.find("settings")
    ]).then(function (r) {
      var app      = r[0][0];
      var hours    = r[1];
      var regs     = r[2].filter(function (g) { return g.status !== "cancelled"; });
      var events   = r[3];
      var settings = r[4][0] || {};

      var eventById = {};
      events.forEach(function (e) { eventById[e._id] = e; });

      var verified = hours.filter(function (h) { return h.status === "verified"; })
                          .reduce(function (s, h) { return s + h.hours; }, 0);

      var attended = regs.filter(function (g) {
        var e = eventById[g.eventId];
        return e && new Date(e.startsAt) < new Date();
      });

      var ev = cert.eventId ? eventById[cert.eventId] : null;

      var thisEventHours = hours.filter(function (h) {
        return h.eventId === cert.eventId && h.status === "verified";
      }).reduce(function (s, h) { return s + h.hours; }, 0);

      render(cert, {
        org:      settings.org || "CareSphere Foundation",
        address:  settings.address || "Jayanagar, Bengaluru",
        email:    cert.email,

        /* Fixed signatories, so every certificate reads the same */
        approverName:  "Saija",
        approverTitle: "Programme Coordinator",
        directorName:  "Sumaya",
        directorTitle: "Programme Director",

        verifiedHours:  verified,
        eventsAttended: attended.length,
        district:       app ? app.district : "Karnataka",
        interest:       app ? app.interest : "community",
        joinedAt:       app ? (app.reviewedAt || app.submittedAt) : cert.requestedAt,

        eventVenue:    ev ? ev.venue : "",
        eventDistrict: ev ? ev.district : "",
        eventDate:     ev ? ev.startsAt : "",
        eventCategory: ev ? ev.category : "",
        eventHours:    thisEventHours ? thisEventHours + " hrs" : ""
      });
    });
  }

  /* ------------------------------------------------------------------
     Boot — check it exists, is issued, and belongs to whoever's looking
     ------------------------------------------------------------------ */

  var id   = idFromUrl();
  var user = CSAuth.current();

  if (!user) {
    /* Remember where they were headed so login can return them here */
    try {
      localStorage.setItem("caresphere_return", window.location.href);
    } catch (e) {}

    problem("Please sign in first",
            "You need to be signed in to view a certificate. We'll bring you " +
            "straight back here afterwards.",
            "login.html", "Go to sign in");
    return;
  }

  var isAdmin = user.role === "admin" || user.role === "super_admin";

  if (isAdmin) {
    document.getElementById("backLink").href =
      "../../adminside/frontend/html/admin-certificates.html";
    document.getElementById("backLink").lastChild.textContent = " Back to certificates";
  }

  if (!id) {
    problem("No certificate specified",
            "Open a certificate from your list rather than typing the address directly.",
            "volunteer-my-certificates.html", "My certificates");
    return;
  }

  CSStore.findById("certificates", id).then(function (cert) {

    if (!cert) {
      problem("Certificate not found",
              "This certificate doesn't exist, or it's been removed.",
              "volunteer-my-certificates.html", "My certificates");
      return;
    }

    if (!isAdmin && cert.userId !== user._id) {
      problem("That isn't yours",
              "You can only open certificates issued to you.",
              "volunteer-my-certificates.html", "My certificates");
      return;
    }

    if (cert.status !== "approved") {
      problem(
        cert.status === "pending" ? "Still being reviewed" : "This wasn't issued",
        cert.status === "pending"
          ? "An organiser is looking at your request. The certificate appears here once it's approved."
          : (cert.note || "This request wasn't taken forward."),
        "volunteer-my-certificates.html", "My certificates"
      );
      return;
    }

    return build(cert);
  });

  document.getElementById("downloadBtn").addEventListener("click", function () {
    window.print();
  });

})();
