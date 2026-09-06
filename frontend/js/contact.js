/* ==========================================================================
   CareSphere — Contact form

   Replaces the fake submission with a real write. A visitor's message goes
   into the messages collection, which is exactly what admin-messages.html
   reads, so it turns up in the inbox as "New".

   This file doesn't assume your markup. It finds the form and its fields by
   looking at types and at id/name attributes, so it should work with the
   contact page you already have. If it can't find something it says so in
   the console rather than failing silently.

   To use it, add these two lines at the end of contact.html, just before
   </body>, and delete whatever currently handles the submit:

       <script src="../js/store.js"></script>
       <script src="../js/contact.js"></script>
   ========================================================================== */

(function () {
  "use strict";

  if (typeof CSStore === "undefined") {
    console.warn("contact.js: store.js has to load first. Check the script order.");
    return;
  }

  /* ------------------------------------------------------------------
     Find the form and its fields
     ------------------------------------------------------------------ */

  function looksLike(el, words) {
    var hay = ((el.id || "") + " " + (el.name || "") + " " +
               (el.getAttribute("placeholder") || "")).toLowerCase();
    return words.some(function (w) { return hay.indexOf(w) !== -1; });
  }

  var form = document.querySelector("#contactForm, form[data-contact], form");

  if (!form) {
    console.warn("contact.js: no form found on this page.");
    return;
  }

  var inputs   = Array.prototype.slice.call(form.querySelectorAll("input, textarea, select"));
  var textFields = inputs.filter(function (el) {
    return el.type !== "hidden" && el.type !== "submit" && el.type !== "button";
  });

  function pick(test) {
    for (var i = 0; i < textFields.length; i++) {
      if (test(textFields[i])) return textFields[i];
    }
    return null;
  }

  var F = {};

  F.email = pick(function (el) { return el.type === "email"; }) ||
            pick(function (el) { return looksLike(el, ["email", "mail"]); });

  F.message = pick(function (el) { return el.tagName === "TEXTAREA"; });

  F.subject = pick(function (el) { return looksLike(el, ["subject", "topic", "regarding"]); });

  F.name = pick(function (el) {
    return el !== F.email && el !== F.subject && el !== F.message &&
           looksLike(el, ["name", "fullname"]);
  }) || pick(function (el) {
    return el !== F.email && el !== F.subject && el !== F.message && el.type === "text";
  });

  F.phone = pick(function (el) {
    return el.type === "tel" || looksLike(el, ["phone", "mobile", "contact number"]);
  });

  if (!F.name || !F.email || !F.message) {
    console.warn("contact.js: could not find the name, email or message field.",
                 "Give them ids of contactName, contactEmail and contactMessage and reload.");
    return;
  }

  /* ------------------------------------------------------------------
     Errors — created on the fly so no extra CSS is needed
     ------------------------------------------------------------------ */

  var CORAL = "#D97A6C";

  function slotFor(field) {
    var existing = field.parentNode.querySelector("[data-cs-error]");
    if (existing) return existing;

    var slot = document.createElement("span");
    slot.setAttribute("data-cs-error", "");
    slot.style.cssText = "display:block;margin-top:5px;min-height:15px;" +
                         "color:" + CORAL + ";font-size:12px;line-height:1.4";
    field.parentNode.insertBefore(slot, field.nextSibling);
    return slot;
  }

  function fail(field, message) {
    field.style.borderColor = CORAL;
    slotFor(field).textContent = message;
  }

  function clearErrors() {
    textFields.forEach(function (el) {
      el.style.borderColor = "";
      var slot = el.parentNode.querySelector("[data-cs-error]");
      if (slot) slot.textContent = "";
    });
  }

  /* ------------------------------------------------------------------
     Confirmation panel
     ------------------------------------------------------------------ */

  function showSent(name) {
    var panel = document.createElement("div");
    panel.setAttribute("role", "status");
    panel.style.cssText =
      "padding:22px 24px;border:1px solid rgba(38,65,94,.13);" +
      "border-left:3px solid #B7E0FF;border-radius:14px;" +
      "background:#fff;box-shadow:0 8px 24px rgba(38,65,94,.07);" +
      "font-family:inherit";

    panel.innerHTML =
      '<h3 style="margin:0 0 6px;color:#26415E;font-size:17px;font-weight:600">' +
        'Thanks, ' + esc(name.split(" ")[0]) + ' \u2014 that\'s with us' +
      '</h3>' +
      '<p style="margin:0 0 16px;color:#6b7280;font-size:13.5px;line-height:1.6">' +
        'Someone from the office will read it and get back to you, usually within ' +
        'two working days. If it\'s urgent, please ring us instead.' +
      '</p>' +
      '<button type="button" style="padding:9px 18px;border:1px solid rgba(38,65,94,.24);' +
        'border-radius:9px;background:#fff;color:#26415E;font-family:inherit;' +
        'font-size:13px;font-weight:500;cursor:pointer">Send another message</button>';

    form.style.display = "none";
    form.parentNode.insertBefore(panel, form);

    panel.querySelector("button").addEventListener("click", function () {
      panel.remove();
      form.reset();
      clearErrors();
      form.style.display = "";
      F.name.focus();
    });

    panel.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ------------------------------------------------------------------
     Validation
     ------------------------------------------------------------------ */

  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

  function validate() {
    clearErrors();
    var first = null;

    function bad(field, msg) {
      fail(field, msg);
      first = first || field;
    }

    if (F.name.value.trim().length < 2) {
      bad(F.name, "Please tell us your name.");
    }

    if (!F.email.value.trim()) {
      bad(F.email, "We need an email address to reply to.");
    } else if (!isEmail(F.email.value.trim())) {
      bad(F.email, "That doesn't look like an email address.");
    }

    if (F.phone && F.phone.value.trim() && !/^[0-9+\-\s()]{8,20}$/.test(F.phone.value.trim())) {
      bad(F.phone, "That doesn't look like a phone number.");
    }

    if (F.subject && F.subject.value.trim().length < 3) {
      bad(F.subject, "What's this about?");
    }

    if (F.message.value.trim().length < 15) {
      bad(F.message, "Tell us a bit more so we can help properly.");
    }

    if (first) {
      first.focus();
      first.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    return !first;
  }

  /* ------------------------------------------------------------------
     Submit
     ------------------------------------------------------------------ */

  function send() {
    if (!validate()) return;

    var button = form.querySelector('button[type="submit"], input[type="submit"], button');
    var label  = button ? (button.textContent || button.value) : "";

    if (button) {
      button.disabled = true;
      if (button.tagName === "BUTTON") button.textContent = "Sending\u2026";
      else button.value = "Sending\u2026";
    }

    var name = F.name.value.trim();

    var body = F.message.value.trim();
    if (F.phone && F.phone.value.trim()) {
      body += "\n\nPhone: " + F.phone.value.trim();
    }

    CSStore.insert("messages", {
      name:       name,
      email:      F.email.value.trim(),
      subject:    F.subject ? F.subject.value.trim() : "Message from the contact form",
      body:       body,
      receivedAt: new Date().toISOString().slice(0, 10),
      status:     "new",
      assignedTo: "",
      notes:      ""
    }).then(function () {
      showSent(name);
    }).catch(function (err) {
      console.error("contact.js: could not save the message.", err);

      if (button) {
        button.disabled = false;
        if (button.tagName === "BUTTON") button.textContent = label;
        else button.value = label;
      }

      fail(F.message, "Something went wrong sending that. Please try again, or ring the office.");
    });
  }

  /* Take over the submit rather than letting the page reload */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    send();
  });

  /* Some markup has a plain button that isn't type=submit */
  var button = form.querySelector('button[type="submit"], input[type="submit"], button');
  if (button && button.type !== "submit") {
    button.addEventListener("click", function (e) {
      e.preventDefault();
      send();
    });
  }

  /* Native validation bubbles would fight with the inline messages */
  form.setAttribute("novalidate", "novalidate");

})();
