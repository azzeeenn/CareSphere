/* ==========================================================================
   CareSphere — News & Updates

   Publishing stamps publishedAt on the way out, so the news page can sort
   by it without needing to know anything about drafts.
   ========================================================================== */

(function () {
  "use strict";

  CSAdmin.init();

  var all      = [];
  var status   = "all";
  var category = "all";
  var term     = "";
  var editId   = null;
  var deleteId = null;

  var rowsEl    = document.getElementById("rows");
  var emptyEl   = document.getElementById("emptyState");
  var summaryEl = document.getElementById("summaryRow");

  var F = {
    title:    document.getElementById("nTitle"),
    category: document.getElementById("nCategory"),
    status:   document.getElementById("nStatus"),
    excerpt:  document.getElementById("nExcerpt"),
    body:     document.getElementById("nBody"),
    pinned:   document.getElementById("nPinned")
  };

  /* ------------------------------------------------------------------ */

  function load() {
    return CSStore.find("news").then(function (docs) {
      all = docs.sort(function (a, b) {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt);
      });
      render();
    });
  }

  function visible() {
    return all.filter(function (n) {
      if (status   !== "all" && n.status   !== status)   return false;
      if (category !== "all" && n.category !== category) return false;
      if (!term) return true;
      return (n.title + " " + n.excerpt).toLowerCase().indexOf(term) !== -1;
    });
  }

  /* ------------------------------------------------------------------ */

  function renderSummary() {
    function n(s) { return all.filter(function (x) { return x.status === s; }).length; }
    var pinned = all.filter(function (x) { return x.pinned && x.status === "published"; }).length;

    summaryEl.innerHTML =
      '<div class="summary-chip"><b>' + n("published") + '</b><span>live</span></div>' +
      '<div class="summary-chip' + (n("draft") ? " is-hot" : "") + '"><b>' + n("draft") + '</b><span>drafts</span></div>' +
      '<div class="summary-chip"><b>' + pinned + '</b><span>pinned</span></div>' +
      '<div class="summary-chip"><b>' + all.length + '</b><span>total</span></div>';
  }

  function render() {
    renderSummary();

    var list = visible();
    var esc  = CSAdmin.esc;

    if (!list.length) {
      rowsEl.innerHTML = "";
      emptyEl.hidden = false;
      var filtered = term || status !== "all" || category !== "all";
      document.getElementById("emptyTitle").textContent = filtered ? "No matches" : "No posts yet";
      document.getElementById("emptyBody").textContent = filtered
        ? "Try a different search or clear the filters."
        : "Write your first update and publish it when it's ready.";
      return;
    }

    emptyEl.hidden = true;

    rowsEl.innerHTML = list.map(function (n) {
      var cat = n.category === "Education"  ? "is-education"
              : n.category === "Healthcare" ? "is-healthcare"
              : n.category === "Green Cover" ? "is-green" : "";

      return '' +
        '<tr>' +
          '<td style="max-width:380px">' +
            '<span class="cell-primary">' +
              (n.pinned && n.status === "published" ? '\u2191 ' : '') + esc(n.title) +
            '</span>' +
            '<span class="cell-sub">' + esc(n.excerpt) + '</span>' +
          '</td>' +
          '<td><span class="tag ' + cat + '">' + esc(n.category) + '</span></td>' +
          '<td>' + (n.publishedAt ? CSAdmin.fmtDate(n.publishedAt) : '<span style="color:var(--cs-muted)">Not yet</span>') + '</td>' +
          '<td><span class="status-badge ' + (n.status === "published" ? "is-published" : "is-draft") + '">' +
              (n.status === "published" ? "Published" : "Draft") + '</span></td>' +
          '<td class="cell-actions">' +
            (n.status === "draft"
              ? '<button class="btn btn-primary btn-sm" data-publish="' + n._id + '">Publish</button> '
              : '<button class="btn btn-ghost btn-sm" data-unpublish="' + n._id + '">Unpublish</button> ') +
            '<button class="btn btn-quiet btn-sm" data-edit="' + n._id + '">Edit</button> ' +
            (CSAdmin.isSuper()
              ? '<button class="btn btn-danger btn-sm" data-del="' + n._id + '">Delete</button>'
              : '') +
          '</td>' +
        '</tr>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Form
     ------------------------------------------------------------------ */

  function clearErrors() {
    document.querySelectorAll("#formModal .field").forEach(function (f) { f.classList.remove("has-error"); });
    document.querySelectorAll("#formModal .error").forEach(function (e) { e.textContent = ""; });
  }

  function validate() {
    clearErrors();
    var ok = true, first = null;

    function bad(key, msg) {
      var el = F[key];
      el.closest(".field").classList.add("has-error");
      var slot = document.querySelector('[data-error="' + el.id + '"]');
      if (slot) slot.textContent = msg;
      if (!first) first = el;
      ok = false;
    }

    if (F.title.value.trim().length < 6)    bad("title", "Give the post a title of at least 6 characters.");
    if (F.excerpt.value.trim().length < 20) bad("excerpt", "Write a summary of at least a sentence — this is what people see on the listing.");
    if (F.status.value === "published" && F.body.value.trim().length < 40) {
      bad("body", "A published post needs more than this. Save it as a draft if you're not finished.");
    }

    if (first) first.focus();
    return ok;
  }

  function openForm(id) {
    editId = id || null;
    clearErrors();

    document.getElementById("formTitle").textContent = editId ? "Edit post" : "New post";
    document.getElementById("savePost").textContent  = editId ? "Save changes" : "Create post";

    if (editId) {
      var n = all.filter(function (x) { return x._id === editId; })[0];
      F.title.value    = n.title;
      F.category.value = n.category;
      F.status.value   = n.status;
      F.excerpt.value  = n.excerpt;
      F.body.value     = n.body || "";
      F.pinned.value   = n.pinned ? "yes" : "no";
    } else {
      F.title.value = F.excerpt.value = F.body.value = "";
      F.category.value = "General";
      F.status.value   = "draft";
      F.pinned.value   = "no";
    }

    CSAdmin.openModal("formModal");
  }

  document.getElementById("savePost").addEventListener("click", function () {
    if (!validate()) return;

    var wasPublished = editId
      ? all.filter(function (x) { return x._id === editId; })[0].publishedAt
      : "";

    var payload = {
      title:    F.title.value.trim(),
      category: F.category.value,
      status:   F.status.value,
      excerpt:  F.excerpt.value.trim(),
      body:     F.body.value.trim(),
      pinned:   F.pinned.value === "yes",
      /* Stamp the publish date the first time it goes live, then keep it */
      publishedAt: F.status.value === "published"
        ? (wasPublished || CSAdmin.today())
        : ""
    };

    var work = editId
      ? CSStore.updateById("news", editId, payload)
      : CSStore.insert("news", Object.assign(payload, { createdAt: CSAdmin.today() }));

    work.then(function () {
      CSAdmin.closeModal("formModal");
      CSAdmin.toast(
        F.status.value === "published" ? "Post is live on the news page" : "Draft saved",
        "good"
      );
      load();
    });
  });

  /* ------------------------------------------------------------------
     Delete
     ------------------------------------------------------------------ */

  function askDelete(id) {
    var n = all.filter(function (x) { return x._id === id; })[0];
    if (!n) return;
    deleteId = id;

    document.getElementById("deleteTitle").textContent = "Delete \u201C" + n.title + "\u201D?";
    document.getElementById("deleteBody").textContent = n.status === "published"
      ? "This post is live. Deleting removes it from the news page immediately."
      : "This cannot be undone.";

    CSAdmin.openModal("deleteModal");
  }

  document.getElementById("confirmDelete").addEventListener("click", function () {
    if (!CSAdmin.isSuper()) {
      CSAdmin.closeModal("deleteModal");
      CSAdmin.toast("Only a Super Admin can delete", "warn");
      return;
    }
    CSStore.removeById("news", deleteId).then(function () {
      CSAdmin.closeModal("deleteModal");
      CSAdmin.toast("Post deleted", "warn");
      load();
    });
  });

  /* ------------------------------------------------------------------
     Events
     ------------------------------------------------------------------ */

  document.getElementById("newPost").addEventListener("click", function () { openForm(null); });

  rowsEl.addEventListener("click", function (e) {
    var edit = e.target.closest("[data-edit]");
    var del  = e.target.closest("[data-del]");
    var pub  = e.target.closest("[data-publish]");
    var un   = e.target.closest("[data-unpublish]");

    if (edit) openForm(edit.getAttribute("data-edit"));
    if (del)  askDelete(del.getAttribute("data-del"));

    if (pub) {
      var id = pub.getAttribute("data-publish");
      var n  = all.filter(function (x) { return x._id === id; })[0];

      if ((n.body || "").trim().length < 40) {
        CSAdmin.toast("Add the full text before publishing this one", "warn");
        openForm(id);
        return;
      }

      CSStore.updateById("news", id, {
        status: "published",
        publishedAt: n.publishedAt || CSAdmin.today()
      }).then(function () {
        CSAdmin.toast("Published", "good");
        load();
      });
    }

    if (un) {
      CSStore.updateById("news", un.getAttribute("data-unpublish"), {
        status: "draft", pinned: false
      }).then(function () {
        CSAdmin.toast("Taken off the news page", "warn");
        load();
      });
    }
  });

  document.getElementById("statusFilter").addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    this.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("is-on"); });
    chip.classList.add("is-on");
    status = chip.getAttribute("data-status");
    render();
  });

  document.getElementById("categoryFilter").addEventListener("change", function () {
    category = this.value; render();
  });

  var typing;
  document.getElementById("searchBox").addEventListener("input", function () {
    var v = this.value.trim().toLowerCase();
    clearTimeout(typing);
    typing = setTimeout(function () { term = v; render(); }, 160);
  });

  /* ------------------------------------------------------------------ */

  document.getElementById("categoryFilter").innerHTML =
    '<option value="all">All categories</option>' +
    ["Education", "Healthcare", "Green Cover", "General"].map(function (c) {
      return '<option value="' + c + '">' + c + '</option>';
    }).join("");

  load();

})();
