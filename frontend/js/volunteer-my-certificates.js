/* ==========================================================================
   CareSphere — My certificates

   A certificate has to be backed by something the organisation can stand
   behind, so each type checks what it needs before the request can be sent:

     hours / completion  -> verified hours on record
     participation       -> an event actually attended
     recommendation      -> a named reference

   Photos are optional supporting evidence. They're scaled down in the
   browser exactly as the gallery does, since there's no file server yet.
   ========================================================================== */

(function () {
  "use strict";

  var user = CSVol.start();
  if (!user) return;

  var MAX_PHOTOS = 3;
  var MAX_EDGE   = 900;
  var QUALITY    = 0.7;
  var MAX_INPUT  = 8 * 1024 * 1024;

  var types    = CSStore.certificateTypes;
  var chosen   = types[0].id;
  var proof    = [];
  var mine     = [];
  var attended = [];
  var verified = 0;
  var esc      = CSVol.esc;

  var listEl = document.getElementById("list");

  var LABEL = {
    pending:  "Awaiting review",
    approved: "Issued",
    rejected: "Not issued"
  };

  var BADGE = {
    pending:  "is-pending",
    approved: "is-verified",
    rejected: "is-rejected"
  };

  /* ------------------------------------------------------------------
     Load
     ------------------------------------------------------------------ */

  function load() {
    return Promise.all([
      CSStore.find("certificates", { userId: user._id }),
      CSStore.find("hours", { userId: user._id }),
      CSStore.find("registrations", { userId: user._id }),
      CSStore.find("events")
    ]).then(function (r) {
      mine = r[0].sort(function (a, b) {
        return new Date(b.requestedAt) - new Date(a.requestedAt);
      });

      verified = r[1].filter(function (h) { return h.status === "verified"; })
                     .reduce(function (s, h) { return s + h.hours; }, 0);

      var joined = {};
      r[2].filter(function (g) { return g.status !== "cancelled"; })
          .forEach(function (g) { joined[g.eventId] = true; });

      var now = new Date();
      attended = r[3].filter(function (e) {
        return joined[e._id] && new Date(e.startsAt) < now;
      }).sort(function (a, b) { return new Date(b.startsAt) - new Date(a.startsAt); });

      renderStats();
      renderTypes();
      renderExtras();
      renderList();
    });
  }

  function renderStats() {
    function n(s) { return mine.filter(function (c) { return c.status === s; }).length; }
    document.getElementById("statIssued").textContent  = n("approved");
    document.getElementById("statPending").textContent = n("pending");
    document.getElementById("statHours").textContent   = verified;
    document.getElementById("statEvents").textContent  = attended.length;
  }

  /* ------------------------------------------------------------------
     Type chooser
     ------------------------------------------------------------------ */

  function renderTypes() {
    document.getElementById("typeList").innerHTML = types.map(function (t) {
      return '' +
        '<label class="type-option' + (t.id === chosen ? " is-on" : "") + '">' +
          '<input type="radio" name="certType" value="' + esc(t.id) + '"' +
            (t.id === chosen ? " checked" : "") + '>' +
          '<span>' +
            '<b>' + esc(t.label) + '</b>' +
            '<span>' + esc(t.blurb) + '</span>' +
          '</span>' +
        '</label>';
    }).join("");
  }

  /* Extra fields depend on what the chosen type has to be backed by */
  function renderExtras() {
    var type = types.filter(function (t) { return t.id === chosen; })[0];
    var host = document.getElementById("typeExtras");

    if (type.needs === "event") {
      if (!attended.length) {
        host.innerHTML =
          '<div class="vol-empty" style="padding:26px 20px">' +
            '<h3>No events to certify yet</h3>' +
            '<p style="margin-bottom:0">You can ask for this once you\'ve attended an event.</p>' +
          '</div>';
        return;
      }

      host.innerHTML =
        '<div class="field full">' +
          '<label for="cEvent">Which event</label>' +
          '<select id="cEvent">' +
            attended.map(function (e) {
              return '<option value="' + esc(e._id) + '">' +
                       esc(e.title) + " \u2014 " + CSVol.fmtDate(e.startsAt) +
                     '</option>';
            }).join("") +
          '</select>' +
          '<span class="error"></span>' +
        '</div>';
      return;
    }

    if (type.needs === "reference") {
      host.innerHTML =
        '<p style="margin:0 0 14px;color:var(--cs-muted);font-size:12.5px">' +
          'Give us someone who has seen your work and is happy to be contacted.' +
        '</p>' +
        '<div class="vol-form">' +
          '<div class="field">' +
            '<label for="cRefName">Reference name</label>' +
            '<input type="text" id="cRefName" placeholder="Ramesh Naik">' +
            '<span class="error"></span>' +
          '</div>' +
          '<div class="field">' +
            '<label for="cRefRole">Their role</label>' +
            '<input type="text" id="cRefRole" placeholder="Headmaster, Hassan">' +
            '<span class="error"></span>' +
          '</div>' +
          '<div class="field full">' +
            '<label for="cRefPhone">Their phone number</label>' +
            '<input type="tel" id="cRefPhone" placeholder="94800 21134">' +
            '<span class="error"></span>' +
          '</div>' +
        '</div>';
      return;
    }

    /* hours and completion both rest on verified hours */
    host.innerHTML = verified > 0
      ? '<div class="vol-empty" style="padding:18px 20px;text-align:left;border-style:solid">' +
          '<h3 style="margin-bottom:3px">' + verified + ' hours on record</h3>' +
          '<p style="margin-bottom:0">That\'s the figure the certificate will state. ' +
            'Anything you\'ve logged but not had verified yet won\'t be counted.</p>' +
        '</div>'
      : '<div class="vol-empty" style="padding:26px 20px">' +
          '<h3>No verified hours yet</h3>' +
          '<p style="margin-bottom:0">Log your hours and wait for an organiser to check them, ' +
            'then you can ask for this certificate.</p>' +
        '</div>';
  }

  document.getElementById("typeList").addEventListener("change", function (e) {
    if (!e.target.matches('input[name="certType"]')) return;
    chosen = e.target.value;
    renderTypes();
    renderExtras();
  });

  /* ------------------------------------------------------------------
     Photo proof
     ------------------------------------------------------------------ */

  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("Could not read that file.")); };

      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("That file isn't a readable image.")); };

        img.onload = function () {
          var scale  = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
          var canvas = document.createElement("canvas");
          canvas.width  = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);

          /* A data URL for the thumbnail, and a Blob for the upload.
             The Blob is what actually goes to the server — a data URL
             would be sent as text and rejected. */
          canvas.toBlob(function (blob) {
            if (!blob) { reject(new Error("Could not process that image.")); return; }
            resolve({
              preview: canvas.toDataURL("image/jpeg", QUALITY),
              blob: blob,
              name: (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg"
            });
          }, "image/jpeg", QUALITY);
        };

        img.src = reader.result;
      };

      reader.readAsDataURL(file);
    });
  }

  function renderProof() {
    document.getElementById("proofStrip").innerHTML = proof.map(function (item, i) {
      return '<span class="proof-thumb">' +
               '<img src="' + item.preview + '" alt="Proof photo ' + (i + 1) + '">' +
               '<button class="proof-drop" type="button" data-drop="' + i + '" ' +
                 'aria-label="Remove photo ' + (i + 1) + '">&times;</button>' +
             '</span>';
    }).join("");

    document.getElementById("proofHint").textContent = proof.length
      ? proof.length + " of " + MAX_PHOTOS + " added"
      : "Photos of you at the event, or a signed attendance slip";
  }

  function handleFile(file) {
    var err = document.getElementById("proofError");
    err.textContent = "";
    if (!file) return;

    if (proof.length >= MAX_PHOTOS) {
      err.textContent = "That's the maximum of " + MAX_PHOTOS + " photos.";
      return;
    }

    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      err.textContent = "Choose a JPG, PNG or WebP image.";
      return;
    }

    if (file.size > MAX_INPUT) {
      err.textContent = "That file is over 8 MB. Pick a smaller one.";
      return;
    }

    shrink(file).then(function (data) {
      proof.push(data);
      renderProof();
    }).catch(function (e) {
      err.textContent = e.message;
    });
  }

  var zone = document.getElementById("proofZone");

  document.getElementById("proofInput").addEventListener("change", function () {
    handleFile(this.files[0]);
    this.value = "";
  });

  ["dragenter", "dragover"].forEach(function (ev) {
    zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add("is-over"); });
  });

  ["dragleave", "drop"].forEach(function (ev) {
    zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove("is-over"); });
  });

  zone.addEventListener("drop", function (e) {
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  document.getElementById("proofStrip").addEventListener("click", function (e) {
    var drop = e.target.closest("[data-drop]");
    if (!drop) return;
    proof.splice(parseInt(drop.getAttribute("data-drop"), 10), 1);
    renderProof();
  });

  /* ------------------------------------------------------------------
     Submit
     ------------------------------------------------------------------ */

  function validate() {
    CSAuth.clearErrors(document.getElementById("requestPanel"));
    var type  = types.filter(function (t) { return t.id === chosen; })[0];
    var first = null;

    function bad(el, msg) {
      CSAuth.fail(el, msg);
      first = first || el;
    }

    if (type.needs === "verifiedHours" && verified <= 0) {
      CSVol.toast("You need verified hours before asking for this one", "warn");
      return false;
    }

    if (type.needs === "event" && !attended.length) {
      CSVol.toast("Attend an event first, then you can ask for this", "warn");
      return false;
    }

    if (type.needs === "reference") {
      var refName  = document.getElementById("cRefName");
      var refRole  = document.getElementById("cRefRole");
      var refPhone = document.getElementById("cRefPhone");

      if (refName.value.trim().length < 2) bad(refName, "Who should we speak to?");
      if (!refRole.value.trim())           bad(refRole, "What's their role?");

      if (!refPhone.value.trim())                     bad(refPhone, "Add their phone number.");
      else if (!CSAuth.isPhone(refPhone.value))       bad(refPhone, "That doesn't look like a phone number.");
    }

    var purpose = document.getElementById("cPurpose");
    if (purpose.value.trim().length < 15) {
      bad(purpose, "Tell us what it's for, in a sentence or two.");
    }

    /* One open request per type at a time */
    var openSame = mine.filter(function (c) {
      return c.type === chosen && c.status === "pending";
    })[0];

    if (openSame) {
      CSVol.toast("You already have a request of this type being reviewed", "warn");
      return false;
    }

    if (first) {
      first.focus();
      first.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    return !first;
  }

  document.getElementById("submitRequest").addEventListener("click", function () {
    if (!validate()) return;

    var btn = this;
    btn.disabled = true;
    btn.textContent = "Sending\u2026";

    var eventPicker = document.getElementById("cEvent");
    var chosenEvent = eventPicker
      ? attended.filter(function (e) { return e._id === eventPicker.value; })[0]
      : null;

    var refName  = document.getElementById("cRefName");
    var refRole  = document.getElementById("cRefRole");
    var refPhone = document.getElementById("cRefPhone");

    CSStore.insert("certificates", {
      type:    chosen,
      purpose: document.getElementById("cPurpose").value.trim(),

      eventId: chosenEvent ? chosenEvent._id : null,

      referenceName:  refName  ? refName.value.trim()  : "",
      referenceRole:  refRole  ? refRole.value.trim()  : "",
      referencePhone: refPhone ? refPhone.value.trim() : ""
    }).then(function (created) {

      /* The request exists now, so the photos have something to attach
         to. They go up one at a time rather than in parallel, so a
         failure part-way through is easy to report accurately. */
      if (!proof.length) return created;

      btn.textContent = "Uploading photos\u2026";

      return proof.reduce(function (chain, item) {
        return chain.then(function () {
          return CSStore.uploadCertificateProof(created._id, item.blob, item.name);
        });
      }, Promise.resolve()).then(function () {
        return created;
      }).catch(function (err) {
        /* The request itself went through, so say so rather than making
           it look as though nothing was sent. */
        CSVol.toast(
          "Request sent, but a photo didn't upload: " + (err.detail || "unknown error"),
          "warn"
        );
        return created;
      });

    }).then(function () {
      document.getElementById("cPurpose").value = "";
      proof = [];
      renderProof();
      btn.disabled = false;
      btn.textContent = "Send request";
      CSVol.toast("Request sent. An organiser will look at it shortly.", "good");
      load();
    }).catch(function (err) {
      btn.disabled = false;
      btn.textContent = "Send request";
      CSVol.toast(err.detail || "Couldn't send that request", "warn");
    });
  });

  /* ------------------------------------------------------------------
     History
     ------------------------------------------------------------------ */

  function typeLabel(id) {
    var t = types.filter(function (x) { return x.id === id; })[0];
    return t ? t.label : id;
  }

  function renderList() {
    if (!mine.length) {
      listEl.innerHTML = CSVol.empty(
        "No requests yet",
        "Certificates you ask for will be listed here with their status."
      );
      return;
    }

    listEl.innerHTML = mine.map(function (c) {
      var d = CSVol.dayPart(c.requestedAt);

      var line = c.eventTitle ? esc(c.eventTitle) : "Requested " + CSVol.fmtDate(c.requestedAt);

      if (c.status === "approved" && c.certificateNo) {
        line = '<span class="cert-no">' + esc(c.certificateNo) + '</span> \u00B7 issued ' +
               CSVol.fmtDate(c.issuedAt);
      } else if (c.status === "rejected" && c.note) {
        line = esc(c.note);
      }

      return '' +
        '<article class="vol-card">' +
          '<span class="vol-date"><b>' + d.day + '</b><span>' + d.month + '</span></span>' +
          '<span class="vol-card-body">' +
            '<h3>' + esc(typeLabel(c.type)) + '</h3>' +
            '<p>' + line +
              (c.proof && c.proof.length
                ? ' \u00B7 ' + c.proof.length + (c.proof.length === 1 ? ' photo' : ' photos')
                : '') +
            '</p>' +
          '</span>' +
          '<span class="vol-badge ' + BADGE[c.status] + '">' + LABEL[c.status] + '</span>' +
          (c.status === "approved"
            ? '<a class="btn btn-primary" href="certificate.html?id=' +
                encodeURIComponent(c._id) + '">Download</a>'
            : '') +
        '</article>';
    }).join("");
  }

  load();

})();
