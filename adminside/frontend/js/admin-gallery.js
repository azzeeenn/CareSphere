/* ==========================================================================
   CareSphere — Gallery

   There is no file server yet, so an uploaded photo is read in the browser,
   scaled down on a canvas and kept as a data URL. Without the downscale a
   handful of phone photos would blow past the storage limit.

   When the backend arrives this changes shape: POST the file, keep the URL
   the server returns, and drop the canvas step entirely.
   ========================================================================== */

(function () {
  "use strict";

  CSAdmin.init();

  var MAX_EDGE  = 1000;   // longest side, in pixels, after downscaling
  var QUALITY   = 0.72;   // JPEG quality
  var MAX_INPUT = 8 * 1024 * 1024;

  var all      = [];
  var album    = "all";
  var district = "all";
  var term     = "";
  var editId   = null;
  var deleteId = null;
  var imageData = "";     // data URL currently held in the form

  var gridEl    = document.getElementById("grid");
  var emptyWrap = document.getElementById("emptyWrap");
  var summaryEl = document.getElementById("summaryRow");

  var ALBUMS = ["Education", "Healthcare", "Green Cover", "Events"];

  /* ------------------------------------------------------------------ */

  function load() {
    return CSStore.find("gallery").then(function (docs) {
      all = docs.sort(function (a, b) {
        return new Date(b.uploadedAt) - new Date(a.uploadedAt);
      });
      render();
    });
  }

  function visible() {
    return all.filter(function (g) {
      if (album    !== "all" && g.album    !== album)    return false;
      if (district !== "all" && g.district !== district) return false;
      if (!term) return true;
      return g.caption.toLowerCase().indexOf(term) !== -1;
    });
  }

  /* ------------------------------------------------------------------ */

  function renderSummary() {
    var counts = {};
    all.forEach(function (g) { counts[g.album] = (counts[g.album] || 0) + 1; });

    var chips = '<div class="summary-chip"><b>' + all.length + '</b><span>photos</span></div>';
    ALBUMS.forEach(function (a) {
      if (counts[a]) {
        chips += '<div class="summary-chip"><b>' + counts[a] + '</b><span>' +
                 CSAdmin.esc(a.toLowerCase()) + '</span></div>';
      }
    });
    summaryEl.innerHTML = chips;
  }

  function render() {
    renderSummary();

    var list = visible();
    var esc  = CSAdmin.esc;

    if (!list.length) {
      gridEl.innerHTML = "";
      emptyWrap.hidden = false;
      var filtered = term || album !== "all" || district !== "all";
      document.getElementById("emptyTitle").textContent = filtered ? "No matches" : "No photos yet";
      document.getElementById("emptyBody").textContent = filtered
        ? "Try a different search or clear the filters."
        : "Add your first photo and give it a caption.";
      return;
    }

    emptyWrap.hidden = true;

    gridEl.innerHTML = list.map(function (g) {
      var frame = g.image
        ? '<img src="' + g.image + '" alt="' + esc(g.caption) + '">'
        : '<span class="photo-placeholder">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m4 17 5-5 4.5 4.5L17 13l3 3"/></svg>' +
          '</span>';

      return '' +
        '<article class="photo-card">' +
          '<div class="photo-frame">' +
            frame +
            '<span class="photo-album">' + esc(g.album) + '</span>' +
          '</div>' +
          '<div class="photo-body">' +
            '<span class="photo-caption">' + esc(g.caption) + '</span>' +
            '<span class="photo-meta">' + esc(g.district) + ' · ' + CSAdmin.fmtDate(g.uploadedAt) + '</span>' +
          '</div>' +
          '<div class="photo-foot">' +
            '<button class="btn btn-quiet btn-sm" data-edit="' + g._id + '">Edit</button>' +
            (CSAdmin.isSuper()
              ? '<button class="btn btn-danger btn-sm" data-del="' + g._id + '">Delete</button>'
              : '') +
          '</div>' +
        '</article>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Reading and downscaling a chosen file
     ------------------------------------------------------------------ */

  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();

      reader.onerror = function () { reject(new Error("Could not read that file.")); };

      reader.onload = function () {
        var img = new Image();

        img.onerror = function () { reject(new Error("That file is not a readable image.")); };

        img.onload = function () {
          var w = img.width, h = img.height;
          var scale = Math.min(1, MAX_EDGE / Math.max(w, h));

          var canvas = document.createElement("canvas");
          canvas.width  = Math.round(w * scale);
          canvas.height = Math.round(h * scale);

          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          resolve({
            data: canvas.toDataURL("image/jpeg", QUALITY),
            from: w + "\u00D7" + h,
            to:   canvas.width + "\u00D7" + canvas.height
          });
        };

        img.src = reader.result;
      };

      reader.readAsDataURL(file);
    });
  }

  function handleFile(file) {
    var err = document.getElementById("fileError");
    err.textContent = "";

    if (!file) return;

    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      err.textContent = "Choose a JPG, PNG or WebP image.";
      return;
    }

    if (file.size > MAX_INPUT) {
      err.textContent = "That file is larger than 8 MB. Pick a smaller one.";
      return;
    }

    document.getElementById("dropHint").textContent = "Processing\u2026";

    shrink(file).then(function (out) {
      imageData = out.data;

      document.getElementById("previewImg").src = out.data;
      document.getElementById("previewField").hidden = false;
      document.getElementById("previewNote").textContent =
        "Resized from " + out.from + " to " + out.to + " to keep the page quick.";
      document.getElementById("dropHint").textContent = file.name;

    }).catch(function (e) {
      err.textContent = e.message;
      document.getElementById("dropHint").textContent = "Nothing selected yet";
    });
  }

  var dropzone = document.getElementById("dropzone");

  document.getElementById("fileInput").addEventListener("change", function () {
    handleFile(this.files[0]);
  });

  ["dragenter", "dragover"].forEach(function (ev) {
    dropzone.addEventListener(ev, function (e) {
      e.preventDefault();
      dropzone.classList.add("is-over");
    });
  });

  ["dragleave", "drop"].forEach(function (ev) {
    dropzone.addEventListener(ev, function (e) {
      e.preventDefault();
      dropzone.classList.remove("is-over");
    });
  });

  dropzone.addEventListener("drop", function (e) {
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  /* ------------------------------------------------------------------
     Form
     ------------------------------------------------------------------ */

  function openForm(id) {
    editId = id || null;
    imageData = "";

    document.getElementById("fileError").textContent = "";
    document.getElementById("gCaptionError").textContent = "";
    document.getElementById("gCaption").closest(".field").classList.remove("has-error");
    document.getElementById("fileInput").value = "";
    document.getElementById("dropHint").textContent = "Nothing selected yet";
    document.getElementById("previewField").hidden = true;

    document.getElementById("formTitle").textContent = editId ? "Edit photo" : "Add photo";
    document.getElementById("savePhoto").textContent = editId ? "Save changes" : "Add photo";

    if (editId) {
      var g = all.filter(function (x) { return x._id === editId; })[0];
      document.getElementById("gCaption").value  = g.caption;
      document.getElementById("gAlbum").value    = g.album;
      document.getElementById("gDistrict").value = g.district;

      if (g.image) {
        imageData = g.image;
        document.getElementById("previewImg").src = g.image;
        document.getElementById("previewField").hidden = false;
        document.getElementById("previewNote").textContent =
          "Choose a new file to replace this one.";
      }
    } else {
      document.getElementById("gCaption").value = "";
      document.getElementById("gAlbum").selectedIndex = 0;
      document.getElementById("gDistrict").selectedIndex = 0;
    }

    CSAdmin.openModal("formModal");
  }

  document.getElementById("savePhoto").addEventListener("click", function () {
    var caption = document.getElementById("gCaption");
    var ok = true;

    if (caption.value.trim().length < 4) {
      caption.closest(".field").classList.add("has-error");
      document.getElementById("gCaptionError").textContent =
        "Write a caption so people know what they're looking at.";
      ok = false;
    } else {
      caption.closest(".field").classList.remove("has-error");
      document.getElementById("gCaptionError").textContent = "";
    }

    if (!editId && !imageData) {
      document.getElementById("fileError").textContent = "Choose a photo first.";
      ok = false;
    }

    if (!ok) return;

    var payload = {
      caption:  caption.value.trim(),
      album:    document.getElementById("gAlbum").value,
      district: document.getElementById("gDistrict").value,
      image:    imageData
    };

    var work = editId
      ? CSStore.updateById("gallery", editId, payload)
      : CSStore.insert("gallery", Object.assign(payload, { uploadedAt: CSAdmin.today() }));

    work.then(function () {
      CSAdmin.closeModal("formModal");
      CSAdmin.toast(editId ? "Photo updated" : "Photo added", "good");
      load();
    }).catch(function () {
      CSAdmin.toast("Could not save — storage may be full", "warn");
    });
  });

  /* ------------------------------------------------------------------
     Delete
     ------------------------------------------------------------------ */

  document.getElementById("confirmDelete").addEventListener("click", function () {
    if (!CSAdmin.isSuper()) {
      CSAdmin.closeModal("deleteModal");
      CSAdmin.toast("Only a Super Admin can delete", "warn");
      return;
    }
    CSStore.removeById("gallery", deleteId).then(function () {
      CSAdmin.closeModal("deleteModal");
      CSAdmin.toast("Photo deleted", "warn");
      load();
    });
  });

  /* ------------------------------------------------------------------ */

  document.getElementById("newPhoto").addEventListener("click", function () { openForm(null); });

  gridEl.addEventListener("click", function (e) {
    var edit = e.target.closest("[data-edit]");
    var del  = e.target.closest("[data-del]");

    if (edit) openForm(edit.getAttribute("data-edit"));

    if (del) {
      deleteId = del.getAttribute("data-del");
      var g = all.filter(function (x) { return x._id === deleteId; })[0];
      document.getElementById("deleteTitle").textContent = "Delete this photo?";
      document.getElementById("deleteBody").textContent =
        "\u201C" + g.caption + "\u201D will be removed from the gallery page.";
      CSAdmin.openModal("deleteModal");
    }
  });

  document.getElementById("albumFilter").addEventListener("change", function () {
    album = this.value; render();
  });

  document.getElementById("districtFilter").addEventListener("change", function () {
    district = this.value; render();
  });

  var typing;
  document.getElementById("searchBox").addEventListener("input", function () {
    var v = this.value.trim().toLowerCase();
    clearTimeout(typing);
    typing = setTimeout(function () { term = v; render(); }, 160);
  });

  /* ------------------------------------------------------------------ */

  function options(list) {
    return list.map(function (v) {
      return '<option value="' + CSAdmin.esc(v) + '">' + CSAdmin.esc(v) + '</option>';
    }).join("");
  }

  document.getElementById("gDistrict").innerHTML = options(CSStore.districts);
  document.getElementById("albumFilter").innerHTML =
    '<option value="all">All albums</option>' + options(ALBUMS);
  document.getElementById("districtFilter").innerHTML =
    '<option value="all">All districts</option>' + options(CSStore.districts);

  load();

})();
