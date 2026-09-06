/* ==========================================================================
   CareSphere — Share your story  (volunteer testimonial submission)

   Posts to the same public POST /api/testimonials endpoint the contact
   side uses. The server always saves it as pending with featured false,
   so nothing a volunteer writes can reach the site without an organiser
   approving it on the admin testimonials page.

   One wrinkle worth knowing about:

     GET /api/testimonials returns approved rows only to anyone who is
     not staff, and the testimonials table has no user_id — it was built
     for parents and beneficiaries, who have no accounts. So a volunteer
     cannot ask the API for their own pending submission.

   The status panel below works around that. A published story is found
   by matching the name against the approved list, which is real data
   from the server. A story still awaiting review is remembered in this
   browser instead, keyed by the volunteer's email.
   ========================================================================== */

(function () {
  "use strict";

  var user = CSVol.start();
  if (!user) return;

  var SENT_KEY = "caresphere_story_sent";
  var MIN_BODY = 20;

  var F = {
    name: document.getElementById("sName"),
    role: document.getElementById("sRole"),
    body: document.getElementById("sBody")
  };

  var countEl  = document.getElementById("bodyCount");
  var panelEl  = document.getElementById("formPanel");
  var statusEl = document.getElementById("statusList");

  /* ------------------------------------------------------------------
     The local "I sent one" note

     Stored per email so two accounts sharing a browser don't see each
     other's pending story.
     ------------------------------------------------------------------ */

  function readSent() {
    try {
      var all = JSON.parse(localStorage.getItem(SENT_KEY) || "{}");
      return all[user.email] || null;
    } catch (e) {
      return null;
    }
  }

  function writeSent(record) {
    try {
      var all = JSON.parse(localStorage.getItem(SENT_KEY) || "{}");
      if (record) all[user.email] = record;
      else delete all[user.email];
      localStorage.setItem(SENT_KEY, JSON.stringify(all));
    } catch (e) {}
  }

  /* ------------------------------------------------------------------
     Prefill

     Name comes from the session. The district comes from their approved
     application, so the role line reads "Volunteer, Mandya" without them
     having to remember what they wrote months ago.
     ------------------------------------------------------------------ */

  function prefill() {
    F.name.value = user.name || "";

    return CSStore.myApplication().then(function (app) {
      var district = app && (app.district || app.districtName);
      F.role.value = district ? "Volunteer, " + district : "Volunteer";
    }).catch(function () {
      F.role.value = "Volunteer";
    });
  }

  /* ------------------------------------------------------------------
     Validation
     ------------------------------------------------------------------ */

  function clearErrors() {
    ["sName", "sRole", "sBody"].forEach(function (id) {
      var field = document.getElementById(id).closest(".field");
      field.classList.remove("has-error");
      field.querySelector(".error").textContent = "";
    });
  }

  function validate() {
    clearErrors();
    var first = null;

    function bad(id, message) {
      var el    = document.getElementById(id);
      var field = el.closest(".field");
      field.classList.add("has-error");
      field.querySelector(".error").textContent = message;
      if (!first) first = el;
    }

    if (F.name.value.trim().length < 2) {
      bad("sName", "Add the name you want shown.");
    }
    if (!F.role.value.trim()) {
      bad("sRole", "Add your role and district, for example: Volunteer, Mandya.");
    }
    if (F.body.value.trim().length < MIN_BODY) {
      bad("sBody", "A little more, please — at least " + MIN_BODY + " characters.");
    }

    if (first) { first.focus(); return false; }
    return true;
  }

  /* ------------------------------------------------------------------
     Status panel
     ------------------------------------------------------------------ */

  function card(dateIso, title, line, badgeText, badgeClass) {
    var d = CSVol.dayPart(dateIso);
    return '<div class="vol-card">' +
             '<span class="vol-date"><b>' + d.day + '</b><span>' + d.month + '</span></span>' +
             '<div class="vol-card-body">' +
               '<h3>' + CSVol.esc(title) + '</h3>' +
               '<p>' + CSVol.esc(line) + '</p>' +
             '</div>' +
             '<span class="vol-badge ' + badgeClass + '">' + badgeText + '</span>' +
           '</div>';
  }

  function renderStatus() {
    /* Approved stories are public, so this call works without staff
       rights. Anything matching this volunteer's name is theirs. */
    return CSStore.find("testimonials").then(function (rows) {
      var name = (user.name || "").trim().toLowerCase();

      var mine = rows.filter(function (t) {
        return (t.name || "").trim().toLowerCase() === name;
      }).sort(function (a, b) {
        return new Date(b.submittedAt || b.submitted_at) -
               new Date(a.submittedAt || a.submitted_at);
      });

      var html = mine.map(function (t) {
        var when = t.submittedAt || t.submitted_at;
        return card(
          when,
          "Your story is live on the site",
          "Published " + CSVol.fmtDate(when) +
            (t.featured ? " · featured on the homepage" : ""),
          "Live", "is-verified"
        );
      });

      /* A pending one only exists in this browser's note. Drop the note
         once the story has actually been published, so it isn't listed
         twice. */
      var sent = readSent();

      if (sent && mine.length) {
        writeSent(null);
      } else if (sent) {
        html.unshift(card(
          sent.at,
          "Story sent for review",
          "An organiser will read it before it goes on the site.",
          "Awaiting review", "is-pending"
        ));
      }

      statusEl.innerHTML = html.length
        ? html.join("")
        : CSVol.empty(
            "Nothing yet",
            "Write your story above and it will show up here once it's sent."
          );

      /* One story at a time keeps the public page from filling up with
         the same person. They can still write another once the first
         has been dealt with. */
      panelEl.hidden = !!readSent();
    }).catch(function () {
      statusEl.innerHTML = CSVol.empty(
        "Can't load this right now",
        "Refresh the page, or check the backend is running."
      );
    });
  }

  /* ------------------------------------------------------------------
     Submit
     ------------------------------------------------------------------ */

  document.getElementById("submitStory").addEventListener("click", function () {
    if (!validate()) return;

    var button = this;
    button.disabled = true;
    button.textContent = "Sending\u2026";

    CSStore.insert("testimonials", {
      name: F.name.value.trim(),
      role: F.role.value.trim(),
      body: F.body.value.trim()
    }).then(function () {
      writeSent({ at: new Date().toISOString() });
      F.body.value = "";
      countEl.textContent = "0";
      CSVol.toast("Thank you — your story has been sent for review", "good");
      return renderStatus();
    }).catch(function (err) {
      CSVol.toast(err.message || "That didn't send. Try again.", "warn");
    }).then(function () {
      button.disabled = false;
      button.textContent = "Send my story";
    });
  });

  F.body.addEventListener("input", function () {
    countEl.textContent = this.value.length;
  });

  /* ------------------------------------------------------------------ */

  prefill().then(renderStatus);

})();
