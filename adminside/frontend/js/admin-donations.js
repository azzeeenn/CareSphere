/* ==========================================================================
   CareSphere — Donations

   Amounts are deliberately not editable. Once a figure is recorded the
   only way to change it is to delete the entry and record it again, which
   leaves the mistake visible rather than silently rewritten. That's the
   normal expectation for anything financial.
   ========================================================================== */

(function () {
  "use strict";

  CSAdmin.init();

  var all      = [];
  var status   = "all";
  var purpose  = "all";
  var term     = "";
  var openId   = null;
  var deleteId = null;

  var rowsEl    = document.getElementById("rows");
  var emptyEl   = document.getElementById("emptyState");
  var summaryEl = document.getElementById("summaryRow");

  var PURPOSES = ["General", "Education", "Healthcare", "Green Cover"];

  var F = {
    donor:   document.getElementById("dDonor"),
    amount:  document.getElementById("dAmount"),
    mode:    document.getElementById("dMode"),
    purpose: document.getElementById("dPurpose"),
    date:    document.getElementById("dDate")
  };

  /* ------------------------------------------------------------------
     Money formatting — Indian grouping
     ------------------------------------------------------------------ */

  function rupees(n) {
    return "\u20B9" + Number(n).toLocaleString("en-IN");
  }

  function short(n) {
    if (n >= 10000000) return "\u20B9" + (n / 10000000).toFixed(1).replace(/\.0$/, "") + "Cr";
    if (n >= 100000)   return "\u20B9" + (n / 100000).toFixed(1).replace(/\.0$/, "") + "L";
    if (n >= 1000)     return "\u20B9" + (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return "\u20B9" + n;
  }

  /* ------------------------------------------------------------------ */

  function load() {
    return CSStore.find("donations").then(function (docs) {
      all = docs.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
      render();
    });
  }

  function visible() {
    return all.filter(function (d) {
      if (status  !== "all" && d.status  !== status)  return false;
      if (purpose !== "all" && d.purpose !== purpose) return false;
      if (!term) return true;
      return (d.donor + " " + d.receiptNo).toLowerCase().indexOf(term) !== -1;
    });
  }

  /* ------------------------------------------------------------------ */

  function renderSummary() {
    var now = new Date();
    var thisMonth = all.filter(function (d) {
      var x = new Date(d.date);
      return x.getMonth() === now.getMonth() && x.getFullYear() === now.getFullYear();
    }).reduce(function (s, d) { return s + d.amount; }, 0);

    var total   = all.reduce(function (s, d) { return s + d.amount; }, 0);
    var pending = all.filter(function (d) { return d.status === "pending"; });
    var awaiting = pending.reduce(function (s, d) { return s + d.amount; }, 0);

    summaryEl.innerHTML =
      '<div class="summary-chip"><b>' + short(thisMonth) + '</b><span>this month</span></div>' +
      '<div class="summary-chip"><b>' + short(total) + '</b><span>all time</span></div>' +
      '<div class="summary-chip' + (pending.length ? " is-hot" : "") + '"><b>' +
        pending.length + '</b><span>to verify</span></div>' +
      '<div class="summary-chip"><b>' + short(awaiting) + '</b><span>unverified value</span></div>';
  }

  function render() {
    renderSummary();

    var list = visible();
    var esc  = CSAdmin.esc;

    if (!list.length) {
      rowsEl.innerHTML = "";
      emptyEl.hidden = false;
      var filtered = term || status !== "all" || purpose !== "all";
      document.getElementById("emptyTitle").textContent = filtered ? "No matches" : "Nothing recorded yet";
      document.getElementById("emptyBody").textContent = filtered
        ? "Try a different search or clear the filters."
        : "Record a donation to start the ledger.";
      return;
    }

    emptyEl.hidden = true;

    rowsEl.innerHTML = list.map(function (d) {
      var cat = d.purpose === "Education"  ? "is-education"
              : d.purpose === "Healthcare" ? "is-healthcare"
              : d.purpose === "Green Cover" ? "is-green" : "";

      return '' +
        '<tr>' +
          '<td><span class="cell-primary">' + esc(d.donor) + '</span></td>' +
          '<td><span class="cell-primary">' + rupees(d.amount) + '</span></td>' +
          '<td>' + esc(d.mode) + '</td>' +
          '<td><span class="tag ' + cat + '">' + esc(d.purpose) + '</span></td>' +
          '<td>' + CSAdmin.fmtDate(d.date) + '</td>' +
          '<td>' + (d.receiptNo
            ? esc(d.receiptNo)
            : '<span style="color:var(--cs-muted)">Not issued</span>') + '</td>' +
          '<td><span class="status-badge ' +
              (d.status === "verified" ? "is-approved" : "is-pending") + '">' +
              (d.status === "verified" ? "Verified" : "To verify") + '</span></td>' +
          '<td class="cell-actions">' +
            (d.status === "pending"
              ? '<button class="btn btn-primary btn-sm" data-verify="' + d._id + '">Verify</button> '
              : '') +
            '<button class="btn btn-danger btn-sm" data-del="' + d._id + '">Delete</button>' +
          '</td>' +
        '</tr>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Record
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

    if (F.donor.value.trim().length < 2) bad("donor", "Who gave this? Use \u201CAnonymous\u201D if they'd rather not be named.");

    var amount = parseInt(F.amount.value, 10);
    if (!amount || amount < 1) bad("amount", "Enter the amount in rupees.");
    else if (amount > 100000000) bad("amount", "That's over 10 crore. Check the figure.");

    if (!F.date.value) bad("date", "When was it received?");
    else if (new Date(F.date.value) > new Date()) bad("date", "That date is in the future.");

    if (first) first.focus();
    return ok;
  }

  document.getElementById("newDonation").addEventListener("click", function () {
    clearErrors();
    F.donor.value = "";
    F.amount.value = "";
    F.mode.selectedIndex = 0;
    F.purpose.selectedIndex = 0;
    F.date.value = CSAdmin.today();
    CSAdmin.openModal("formModal");
  });

  document.getElementById("saveDonation").addEventListener("click", function () {
    if (!validate()) return;

    CSStore.insert("donations", {
      donor:     F.donor.value.trim(),
      amount:    parseInt(F.amount.value, 10),
      mode:      F.mode.value,
      purpose:   F.purpose.value,
      date:      F.date.value,
      status:    "pending",
      receiptNo: ""
    }).then(function () {
      CSAdmin.closeModal("formModal");
      CSAdmin.toast("Donation recorded", "good");
      load();
    });
  });

  /* ------------------------------------------------------------------
     Verify — suggest the next receipt number in sequence
     ------------------------------------------------------------------ */

  function nextReceipt() {
    var year = new Date().getFullYear();
    var prefix = "CS-" + year + "-";

    var used = all
      .map(function (d) { return d.receiptNo; })
      .filter(function (r) { return r && r.indexOf(prefix) === 0; })
      .map(function (r) { return parseInt(r.slice(prefix.length), 10); })
      .filter(function (n) { return !isNaN(n); });

    var next = used.length ? Math.max.apply(null, used) + 1 : 1;
    return prefix + String(next).padStart(4, "0");
  }

  function openVerify(id) {
    var d = all.filter(function (x) { return x._id === id; })[0];
    if (!d) return;
    openId = id;

    document.getElementById("verifySub").textContent =
      d.donor + " \u00B7 " + rupees(d.amount) + " \u00B7 " + CSAdmin.fmtDate(d.date);

    var box = document.getElementById("vReceipt");
    box.value = nextReceipt();
    box.closest(".field").classList.remove("has-error");
    document.getElementById("vReceiptError").textContent = "";

    CSAdmin.openModal("verifyModal");
  }

  document.getElementById("confirmVerify").addEventListener("click", function () {
    var box   = document.getElementById("vReceipt");
    var value = box.value.trim();

    if (value.length < 3) {
      box.closest(".field").classList.add("has-error");
      document.getElementById("vReceiptError").textContent = "Enter a receipt number.";
      box.focus();
      return;
    }

    var clash = all.some(function (d) {
      return d._id !== openId && d.receiptNo === value;
    });

    if (clash) {
      box.closest(".field").classList.add("has-error");
      document.getElementById("vReceiptError").textContent =
        "That receipt number is already used on another entry.";
      box.focus();
      return;
    }

    CSStore.updateById("donations", openId, {
      status: "verified",
      receiptNo: value
    }).then(function () {
      CSAdmin.closeModal("verifyModal");
      CSAdmin.toast("Verified, receipt " + value, "good");
      load();
    });
  });

  /* ------------------------------------------------------------------
     Delete
     ------------------------------------------------------------------ */

  document.getElementById("confirmDelete").addEventListener("click", function () {
    CSStore.removeById("donations", deleteId).then(function () {
      CSAdmin.closeModal("deleteModal");
      CSAdmin.toast("Entry deleted", "warn");
      load();
    });
  });

  /* ------------------------------------------------------------------
     CSV export
     ------------------------------------------------------------------ */

  function csvCell(v) {
    var s = String(v == null ? "" : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  document.getElementById("exportCsv").addEventListener("click", function () {
    var list = visible();

    if (!list.length) {
      CSAdmin.toast("Nothing to export with these filters", "warn");
      return;
    }

    var head = ["Date", "Donor", "Amount", "Mode", "Purpose", "Receipt", "Status"];
    var body = list.map(function (d) {
      return [d.date, d.donor, d.amount, d.mode, d.purpose, d.receiptNo, d.status]
        .map(csvCell).join(",");
    });

    var csv  = head.join(",") + "\n" + body.join("\n");
    var blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    var url  = URL.createObjectURL(blob);

    var a = document.createElement("a");
    a.href = url;
    a.download = "caresphere-donations-" + CSAdmin.today() + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    CSAdmin.toast(list.length + " rows exported", "good");
  });

  /* ------------------------------------------------------------------
     Events
     ------------------------------------------------------------------ */

  rowsEl.addEventListener("click", function (e) {
    var v = e.target.closest("[data-verify]");
    var d = e.target.closest("[data-del]");

    if (v) openVerify(v.getAttribute("data-verify"));

    if (d) {
      deleteId = d.getAttribute("data-del");
      var rec = all.filter(function (x) { return x._id === deleteId; })[0];
      document.getElementById("deleteTitle").textContent =
        "Delete " + rupees(rec.amount) + " from " + rec.donor + "?";
      CSAdmin.openModal("deleteModal");
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

  document.getElementById("purposeFilter").addEventListener("change", function () {
    purpose = this.value; render();
  });

  var typing;
  document.getElementById("searchBox").addEventListener("input", function () {
    var v = this.value.trim().toLowerCase();
    clearTimeout(typing);
    typing = setTimeout(function () { term = v; render(); }, 160);
  });

  /* ------------------------------------------------------------------ */

  document.getElementById("purposeFilter").innerHTML =
    '<option value="all">All purposes</option>' +
    PURPOSES.map(function (p) { return '<option value="' + p + '">' + p + '</option>'; }).join("");

  load();

})();
