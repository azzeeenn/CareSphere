/* ==========================================================================
   CareSphere — FAQ

   Order is stored as a number on each record. Moving an item swaps its
   order value with its neighbour, which keeps the sequence stable no
   matter how the list is filtered on screen.
   ========================================================================== */

(function () {
  "use strict";

  CSAdmin.init();

  var all      = [];
  var category = "all";
  var term     = "";
  var editId   = null;
  var deleteId = null;

  var rowsEl    = document.getElementById("rows");
  var emptyEl   = document.getElementById("emptyState");
  var summaryEl = document.getElementById("summaryRow");

  var CATEGORIES = ["Volunteering", "Donations", "Programmes", "General"];

  var F = {
    question: document.getElementById("qQuestion"),
    answer:   document.getElementById("qAnswer"),
    category: document.getElementById("qCategory")
  };

  /* ------------------------------------------------------------------ */

  function load() {
    return CSStore.find("faq").then(function (docs) {
      all = docs.sort(function (a, b) { return a.order - b.order; });
      render();
    });
  }

  function visible() {
    return all.filter(function (q) {
      if (category !== "all" && q.category !== category) return false;
      if (!term) return true;
      return (q.question + " " + q.answer).toLowerCase().indexOf(term) !== -1;
    });
  }

  function trim(text, n) {
    return text.length > n ? text.slice(0, n).trim() + "\u2026" : text;
  }

  /* ------------------------------------------------------------------ */

  function render() {
    var counts = {};
    all.forEach(function (q) { counts[q.category] = (counts[q.category] || 0) + 1; });

    var chips = '<div class="summary-chip"><b>' + all.length + '</b><span>questions</span></div>';
    CATEGORIES.forEach(function (c) {
      if (counts[c]) {
        chips += '<div class="summary-chip"><b>' + counts[c] + '</b><span>' +
                 CSAdmin.esc(c.toLowerCase()) + '</span></div>';
      }
    });
    summaryEl.innerHTML = chips;

    var list = visible();
    var esc  = CSAdmin.esc;

    if (!list.length) {
      rowsEl.innerHTML = "";
      emptyEl.hidden = false;
      var filtered = term || category !== "all";
      document.getElementById("emptyTitle").textContent = filtered ? "No matches" : "No questions yet";
      document.getElementById("emptyBody").textContent = filtered
        ? "Try a different search or clear the filter."
        : "Add the questions people ask you most often.";
      return;
    }

    emptyEl.hidden = true;

    /* Arrows are disabled at the ends of the full list, not the filtered one */
    rowsEl.innerHTML = list.map(function (q) {
      var index = all.findIndex(function (x) { return x._id === q._id; });
      var isFirst = index === 0;
      var isLast  = index === all.length - 1;

      return '' +
        '<tr>' +
          '<td>' +
            '<button class="btn btn-ghost btn-sm" data-up="' + q._id + '"' +
              (isFirst ? ' disabled style="opacity:.35;cursor:default"' : '') +
              ' aria-label="Move up">\u2191</button> ' +
            '<button class="btn btn-ghost btn-sm" data-down="' + q._id + '"' +
              (isLast ? ' disabled style="opacity:.35;cursor:default"' : '') +
              ' aria-label="Move down">\u2193</button>' +
          '</td>' +
          '<td style="max-width:430px">' +
            '<span class="cell-primary">' + esc(q.question) + '</span>' +
            '<span class="cell-sub">' + esc(trim(q.answer, 110)) + '</span>' +
          '</td>' +
          '<td><span class="tag">' + esc(q.category) + '</span></td>' +
          '<td class="cell-actions">' +
            '<button class="btn btn-quiet btn-sm" data-edit="' + q._id + '">Edit</button> ' +
            (CSAdmin.isSuper()
              ? '<button class="btn btn-danger btn-sm" data-del="' + q._id + '">Delete</button>'
              : '') +
          '</td>' +
        '</tr>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Reorder — swap order values with the neighbour
     ------------------------------------------------------------------ */

  function move(id, direction) {
    var index = all.findIndex(function (x) { return x._id === id; });
    var swapWith = index + direction;
    if (index < 0 || swapWith < 0 || swapWith >= all.length) return;

    var a = all[index];
    var b = all[swapWith];

    Promise.all([
      CSStore.updateById("faq", a._id, { order: b.order }),
      CSStore.updateById("faq", b._id, { order: a.order })
    ]).then(load);
  }

  /* ------------------------------------------------------------------ */

  function clearErrors() {
    ["qQuestion", "qAnswer"].forEach(function (id) {
      document.getElementById(id).closest(".field").classList.remove("has-error");
      document.getElementById(id + "Error").textContent = "";
    });
  }

  function validate() {
    clearErrors();
    var ok = true, first = null;

    function bad(id, msg) {
      var el = document.getElementById(id);
      el.closest(".field").classList.add("has-error");
      document.getElementById(id + "Error").textContent = msg;
      if (!first) first = el;
      ok = false;
    }

    if (F.question.value.trim().length < 8) bad("qQuestion", "Write the question as someone would actually ask it.");
    if (F.answer.value.trim().length < 15)  bad("qAnswer", "The answer is too short to be useful.");

    if (first) first.focus();
    return ok;
  }

  function openForm(id) {
    editId = id || null;
    clearErrors();

    document.getElementById("formTitle").textContent = editId ? "Edit question" : "New question";
    document.getElementById("saveFaq").textContent   = editId ? "Save changes" : "Add question";

    if (editId) {
      var q = all.filter(function (x) { return x._id === editId; })[0];
      F.question.value = q.question;
      F.answer.value   = q.answer;
      F.category.value = q.category;
    } else {
      F.question.value = F.answer.value = "";
      F.category.value = "Volunteering";
    }

    CSAdmin.openModal("formModal");
  }

  document.getElementById("saveFaq").addEventListener("click", function () {
    if (!validate()) return;

    var payload = {
      question: F.question.value.trim(),
      answer:   F.answer.value.trim(),
      category: F.category.value
    };

    var nextOrder = all.length
      ? Math.max.apply(null, all.map(function (q) { return q.order; })) + 1
      : 1;

    var work = editId
      ? CSStore.updateById("faq", editId, payload)
      : CSStore.insert("faq", Object.assign(payload, { order: nextOrder }));

    work.then(function () {
      CSAdmin.closeModal("formModal");
      CSAdmin.toast(editId ? "Question updated" : "Question added", "good");
      load();
    });
  });

  document.getElementById("confirmDelete").addEventListener("click", function () {
    if (!CSAdmin.isSuper()) {
      CSAdmin.closeModal("deleteModal");
      CSAdmin.toast("Only a Super Admin can delete", "warn");
      return;
    }
    CSStore.removeById("faq", deleteId).then(function () {
      CSAdmin.closeModal("deleteModal");
      CSAdmin.toast("Question deleted", "warn");
      load();
    });
  });

  /* ------------------------------------------------------------------ */

  document.getElementById("newFaq").addEventListener("click", function () { openForm(null); });

  rowsEl.addEventListener("click", function (e) {
    var up   = e.target.closest("[data-up]");
    var down = e.target.closest("[data-down]");
    var edit = e.target.closest("[data-edit]");
    var del  = e.target.closest("[data-del]");

    if (up   && !up.disabled)   move(up.getAttribute("data-up"), -1);
    if (down && !down.disabled) move(down.getAttribute("data-down"), 1);
    if (edit) openForm(edit.getAttribute("data-edit"));

    if (del) {
      deleteId = del.getAttribute("data-del");
      var q = all.filter(function (x) { return x._id === deleteId; })[0];
      document.getElementById("deleteBody").textContent =
        "\u201C" + q.question + "\u201D will be removed from the FAQ page.";
      CSAdmin.openModal("deleteModal");
    }
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
    CATEGORIES.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join("");

  load();

})();
