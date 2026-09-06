/* ==========================================================================
   CareSphere — Admin Users

   Two things this page has to prevent, because either would lock everyone
   out of the panel permanently:

     - deactivating or demoting the last active Super Admin
     - deactivating your own account while you're signed into it

   Both are checked before the write, not after.
   ========================================================================== */

(function () {
  "use strict";

  var me = CSAdmin.init();
  if (!me) return;

  /* Admins can reach this URL directly. Turn them away. */
  if (me.role !== "super_admin") {
    CSAdmin.toast("Only a Super Admin can open that page", "warn");
    setTimeout(function () { window.location.replace("admin-home.html"); }, 900);
    return;
  }

  var all      = [];
  var editId   = null;
  var resetId  = null;
  var stateId  = null;

  var rowsEl    = document.getElementById("rows");
  var summaryEl = document.getElementById("summaryRow");

  var F = {
    name:     document.getElementById("uName"),
    email:    document.getElementById("uEmail"),
    role:     document.getElementById("uRole"),
    password: document.getElementById("uPassword")
  };

  var LEVEL = { admin: "Admin", super_admin: "Super Admin" };

  /* ------------------------------------------------------------------ */

  function load() {
    return CSStore.find("users").then(function (docs) {
      all = docs.filter(function (u) {
        return u.role === "admin" || u.role === "super_admin";
      }).sort(function (a, b) {
        if (a.role !== b.role) return a.role === "super_admin" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      render();
    });
  }

  function activeSupers() {
    return all.filter(function (u) { return u.role === "super_admin" && u.active; });
  }

  function isLastSuper(id) {
    var supers = activeSupers();
    return supers.length === 1 && supers[0]._id === id;
  }

  /* ------------------------------------------------------------------ */

  function render() {
    var esc = CSAdmin.esc;

    var active = all.filter(function (u) { return u.active; }).length;

    summaryEl.innerHTML =
      '<div class="summary-chip"><b>' + active + '</b><span>active</span></div>' +
      '<div class="summary-chip"><b>' + activeSupers().length + '</b><span>super admins</span></div>' +
      '<div class="summary-chip"><b>' + (all.length - active) + '</b><span>deactivated</span></div>';

    rowsEl.innerHTML = all.map(function (u) {
      var isMe   = u._id === me._id;
      var locked = isLastSuper(u._id);

      var actions =
        '<button class="btn btn-quiet btn-sm" data-edit="' + u._id + '">Edit</button> ' +
        '<button class="btn btn-ghost btn-sm" data-reset="' + u._id + '">Reset password</button>';

      if (!isMe && !locked) {
        actions += u.active
          ? ' <button class="btn btn-danger btn-sm" data-state="' + u._id + '">Deactivate</button>'
          : ' <button class="btn btn-primary btn-sm" data-state="' + u._id + '">Reactivate</button>';
      }

      return '' +
        '<tr>' +
          '<td>' +
            '<span class="avatar-cell">' +
              '<span class="avatar-sm">' + esc(u.name.charAt(0)) + '</span>' +
              '<span>' +
                '<span class="cell-primary">' + esc(u.name) +
                  (isMe ? ' <span class="tag">You</span>' : '') +
                '</span>' +
                '<span class="cell-sub">' + esc(u.email) + '</span>' +
              '</span>' +
            '</span>' +
          '</td>' +
          '<td><span class="tag ' + (u.role === "super_admin" ? "is-healthcare" : "is-education") + '">' +
              LEVEL[u.role] + '</span>' +
              (locked ? '<span class="cell-sub">Last Super Admin \u2014 protected</span>' : '') +
          '</td>' +
          '<td>' + CSAdmin.fmtDate(u.createdAt) + '</td>' +
          '<td><span class="status-badge ' + (u.active ? "is-approved" : "is-draft") + '">' +
              (u.active ? "Active" : "Deactivated") + '</span></td>' +
          '<td class="cell-actions">' + actions + '</td>' +
        '</tr>';
    }).join("");
  }

  /* ------------------------------------------------------------------
     Add / edit
     ------------------------------------------------------------------ */

  function clearErrors() {
    ["uName", "uEmail", "uRole", "uPassword"].forEach(function (id) {
      document.getElementById(id).closest(".field").classList.remove("has-error");
      document.getElementById(id + "Error").textContent = "";
    });
  }

  function suggestPassword() {
    var words = ["mysuru", "kolar", "hassan", "mandya", "tumakuru", "jayanagar"];
    return words[Math.floor(Math.random() * words.length)] +
           Math.floor(1000 + Math.random() * 9000);
  }

  function openForm(id) {
    editId = id || null;
    clearErrors();

    var u = editId ? all.filter(function (x) { return x._id === editId; })[0] : null;

    document.getElementById("formTitle").textContent = u ? "Edit admin" : "Add an admin";
    document.getElementById("formSub").textContent = u
      ? "Changing the access level takes effect the next time they sign in."
      : "They can sign in as soon as you save.";
    document.getElementById("saveAdmin").textContent = u ? "Save changes" : "Add admin";
    document.getElementById("passwordField").hidden = !!u;

    F.name.value  = u ? u.name : "";
    F.email.value = u ? u.email : "";
    F.role.value  = u ? u.role : "admin";
    F.password.value = u ? "" : suggestPassword();

    CSAdmin.openModal("formModal");
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

    if (F.name.value.trim().length < 2) bad("uName", "Who is this account for?");

    var email = F.email.value.trim();
    if (!email) {
      bad("uEmail", "Enter their email address.");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      bad("uEmail", "That doesn't look like an email address.");
    } else {
      var clash = all.concat([]).some(function (u) {
        return u._id !== editId && u.email.toLowerCase() === email.toLowerCase();
      });
      if (clash) bad("uEmail", "An account with this email already exists.");
    }

    if (!editId && F.password.value.length < 8) {
      bad("uPassword", "Use at least 8 characters.");
    }

    /* Don't let the only Super Admin demote themselves */
    if (editId && F.role.value === "admin" && isLastSuper(editId)) {
      bad("uRole", "This is the only active Super Admin. Promote someone else first.");
    }

    if (first) first.focus();
    return ok;
  }

  document.getElementById("saveAdmin").addEventListener("click", function () {
    if (!validate()) return;

    var payload = {
      name:  F.name.value.trim(),
      email: F.email.value.trim(),
      role:  F.role.value
    };

    var work;

    if (editId) {
      work = CSStore.updateById("users", editId, payload);
    } else {
      work = CSStore.insert("users", Object.assign(payload, {
        password:  F.password.value,
        active:    true,
        createdAt: CSAdmin.today()
      }));
    }

    work.then(function () {
      CSAdmin.closeModal("formModal");

      /* If you changed your own name, the sidebar should agree */
      if (editId === me._id) {
        CSStore.session.set(Object.assign({}, me, {
          name: payload.name, email: payload.email, role: payload.role
        }));
      }

      CSAdmin.toast(editId ? "Account updated" : payload.name + " can now sign in", "good");
      load();
    });
  });

  /* ------------------------------------------------------------------
     Reset password
     ------------------------------------------------------------------ */

  function openReset(id) {
    var u = all.filter(function (x) { return x._id === id; })[0];
    if (!u) return;
    resetId = id;

    document.getElementById("resetSub").textContent = u.name + " \u00B7 " + u.email;

    var box = document.getElementById("rPassword");
    box.value = suggestPassword();
    box.closest(".field").classList.remove("has-error");
    document.getElementById("rPasswordError").textContent = "";

    CSAdmin.openModal("resetModal");
  }

  document.getElementById("confirmReset").addEventListener("click", function () {
    var box = document.getElementById("rPassword");

    if (box.value.length < 8) {
      box.closest(".field").classList.add("has-error");
      document.getElementById("rPasswordError").textContent = "Use at least 8 characters.";
      box.focus();
      return;
    }

    var u = all.filter(function (x) { return x._id === resetId; })[0];

    CSStore.updateById("users", resetId, { password: box.value }).then(function () {
      CSAdmin.closeModal("resetModal");
      CSAdmin.toast("Password reset for " + u.name, "good");
    });
  });

  /* ------------------------------------------------------------------
     Deactivate / reactivate
     ------------------------------------------------------------------ */

  function openState(id) {
    var u = all.filter(function (x) { return x._id === id; })[0];
    if (!u) return;
    stateId = id;

    document.getElementById("stateTitle").textContent = u.active
      ? "Deactivate " + u.name + "?"
      : "Reactivate " + u.name + "?";

    document.getElementById("stateBody").textContent = u.active
      ? "They won't be able to sign in. Their account stays on this list and you can turn it back on later."
      : "They'll be able to sign in again with their existing password.";

    var btn = document.getElementById("confirmState");
    btn.textContent = u.active ? "Deactivate" : "Reactivate";
    btn.className = u.active ? "btn btn-danger" : "btn btn-primary";

    CSAdmin.openModal("stateModal");
  }

  document.getElementById("confirmState").addEventListener("click", function () {
    var u = all.filter(function (x) { return x._id === stateId; })[0];

    /* Belt and braces — the button is hidden in these cases anyway */
    if (stateId === me._id) {
      CSAdmin.closeModal("stateModal");
      CSAdmin.toast("You can't deactivate the account you're signed into", "warn");
      return;
    }

    if (u.active && isLastSuper(stateId)) {
      CSAdmin.closeModal("stateModal");
      CSAdmin.toast("That's the only active Super Admin", "warn");
      return;
    }

    CSStore.updateById("users", stateId, { active: !u.active }).then(function () {
      CSAdmin.closeModal("stateModal");
      CSAdmin.toast(
        u.active ? u.name + " can no longer sign in" : u.name + " can sign in again",
        u.active ? "warn" : "good"
      );
      load();
    });
  });

  /* ------------------------------------------------------------------ */

  document.getElementById("newAdmin").addEventListener("click", function () { openForm(null); });

  rowsEl.addEventListener("click", function (e) {
    var edit  = e.target.closest("[data-edit]");
    var reset = e.target.closest("[data-reset]");
    var state = e.target.closest("[data-state]");

    if (edit)  openForm(edit.getAttribute("data-edit"));
    if (reset) openReset(reset.getAttribute("data-reset"));
    if (state) openState(state.getAttribute("data-state"));
  });

  load();

})();
