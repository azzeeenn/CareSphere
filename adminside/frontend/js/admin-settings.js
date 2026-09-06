/* ==========================================================================
   CareSphere — Settings

   One record in the settings collection holds everything the footer and
   contact page read. Saved in two groups so a half-finished edit to the
   social links can't be lost by saving the address, and vice versa.
   ========================================================================== */

(function () {
  "use strict";

  CSAdmin.init();

  var record = null;

  var ORG    = ["sOrg", "sEmail", "sPhone", "sAddress"];
  var SOCIAL = ["sFacebook", "sInstagram", "sTwitter", "sLinkedin"];

  var FIELD_TO_KEY = {
    sOrg: "org", sEmail: "email", sPhone: "phone", sAddress: "address",
    sFacebook: "facebook", sInstagram: "instagram",
    sTwitter: "twitter", sLinkedin: "linkedin"
  };

  function el(id) { return document.getElementById(id); }

  /* ------------------------------------------------------------------ */

  function load() {
    return CSStore.find("settings").then(function (docs) {
      record = docs[0];
      if (!record) return;

      ORG.concat(SOCIAL).forEach(function (id) {
        el(id).value = record[FIELD_TO_KEY[id]] || "";
      });

      markClean("org");
      markClean("social");
      renderDataSummary();
    });
  }

  /* ------------------------------------------------------------------
     Dirty tracking, so the save state means something
     ------------------------------------------------------------------ */

  function isDirty(group) {
    var ids = group === "org" ? ORG : SOCIAL;
    return ids.some(function (id) {
      return el(id).value.trim() !== (record[FIELD_TO_KEY[id]] || "");
    });
  }

  function markClean(group) {
    el(group + "State").textContent = "";
  }

  function markDirty(group) {
    el(group + "State").textContent = isDirty(group) ? "Unsaved changes" : "";
  }

  ORG.forEach(function (id) {
    el(id).addEventListener("input", function () { markDirty("org"); });
  });

  SOCIAL.forEach(function (id) {
    el(id).addEventListener("input", function () { markDirty("social"); });
  });

  /* ------------------------------------------------------------------
     Validation
     ------------------------------------------------------------------ */

  function clear(ids) {
    ids.forEach(function (id) {
      el(id).closest(".field").classList.remove("has-error");
      el(id + "Error").textContent = "";
    });
  }

  function bad(id, msg, first) {
    el(id).closest(".field").classList.add("has-error");
    el(id + "Error").textContent = msg;
    return first || el(id);
  }

  function validateOrg() {
    clear(ORG);
    var first = null;

    if (el("sOrg").value.trim().length < 3) {
      first = bad("sOrg", "The organisation needs a name.", first);
    }

    var email = el("sEmail").value.trim();
    if (!email) {
      first = bad("sEmail", "Add an email address people can write to.", first);
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      first = bad("sEmail", "That doesn't look like an email address.", first);
    }

    var phone = el("sPhone").value.trim();
    if (!phone) {
      first = bad("sPhone", "Add a phone number.", first);
    } else if (!/^[0-9+\-\s()]{8,20}$/.test(phone)) {
      first = bad("sPhone", "That doesn't look like a phone number.", first);
    }

    if (el("sAddress").value.trim().length < 10) {
      first = bad("sAddress", "Write the full address, including the city and postcode.", first);
    }

    if (first) first.focus();
    return !first;
  }

  function validateSocial() {
    clear(SOCIAL);
    var first = null;

    SOCIAL.forEach(function (id) {
      var value = el(id).value.trim();
      if (!value) return;   /* empty is fine — the icon just won't show */

      if (!/^https?:\/\/.+\..+/.test(value)) {
        first = bad(id, "Paste the full web address, starting with https://", first);
      }
    });

    if (first) first.focus();
    return !first;
  }

  /* ------------------------------------------------------------------
     Save
     ------------------------------------------------------------------ */

  function save(group, ids) {
    var payload = {};
    ids.forEach(function (id) { payload[FIELD_TO_KEY[id]] = el(id).value.trim(); });

    return CSStore.updateById("settings", record._id, payload).then(function () {
      Object.keys(payload).forEach(function (k) { record[k] = payload[k]; });
      markClean(group);
      CSAdmin.toast(group === "org" ? "Contact details saved" : "Social links saved", "good");
    });
  }

  el("orgSave").addEventListener("click", function () {
    if (validateOrg()) save("org", ORG);
  });

  el("socialSave").addEventListener("click", function () {
    if (validateSocial()) save("social", SOCIAL);
  });

  el("orgReset").addEventListener("click", function () {
    clear(ORG);
    ORG.forEach(function (id) { el(id).value = record[FIELD_TO_KEY[id]] || ""; });
    markClean("org");
    CSAdmin.toast("Changes discarded");
  });

  el("socialReset").addEventListener("click", function () {
    clear(SOCIAL);
    SOCIAL.forEach(function (id) { el(id).value = record[FIELD_TO_KEY[id]] || ""; });
    markClean("social");
    CSAdmin.toast("Changes discarded");
  });

  /* ------------------------------------------------------------------
     What's currently stored
     ------------------------------------------------------------------ */

  function renderDataSummary() {
    var collections = [
      ["users", "accounts"],
      ["applications", "applications"],
      ["events", "events"],
      ["registrations", "registrations"],
      ["hours", "hour entries"],
      ["donations", "donations"],
      ["messages", "messages"],
      ["testimonials", "testimonials"],
      ["news", "news posts"],
      ["gallery", "photos"]
    ];

    Promise.all(collections.map(function (c) {
      return CSStore.count(c[0]);
    })).then(function (counts) {

      var parts = collections.map(function (c, i) {
        return counts[i] + " " + c[1];
      });

      el("dataSummary").innerHTML =
        '<div class="detail full">' +
          '<dt>Currently stored</dt>' +
          '<dd>' + CSAdmin.esc(parts.join(" \u00B7 ")) + '</dd>' +
        '</div>';
    });
  }

  /* ------------------------------------------------------------------
     Reset
     ------------------------------------------------------------------ */

  el("resetData").addEventListener("click", function () {
    var box = el("resetConfirm");
    box.value = "";
    box.closest(".field").classList.remove("has-error");
    el("resetError").textContent = "";
    CSAdmin.openModal("resetModal");
  });

  el("confirmReset").addEventListener("click", function () {
    var box = el("resetConfirm");

    if (box.value.trim().toUpperCase() !== "RESET") {
      box.closest(".field").classList.add("has-error");
      el("resetError").textContent = "Type RESET in capitals to confirm.";
      box.focus();
      return;
    }

    CSStore.reset().then(function () {
      CSStore.session.clear();
      window.location.replace("../../../frontend/html/login.html");
    });
  });

  /* Enter submits the reset confirmation */
  el("resetConfirm").addEventListener("keydown", function (e) {
    if (e.key === "Enter") el("confirmReset").click();
  });

  load();

})();
