/* ==========================================================================
   CareSphere — Auth

   Sign-in is gated on two things: the password, and the application
   record. A volunteer only gets through once an admin has set that
   application to "approved".

   What changed from the localStorage version:

     * The password is no longer compared here. It cannot be — the
       database stores a bcrypt hash, and the browser never sees it.
       CSStore.auth.login() posts the credentials and the server decides.

     * The users list is no longer readable from the browser. Only a
       super admin can fetch it, which is the correct answer to "why was
       every account's details sitting in front-end code".

   The comment that used to sit here said this was simulated access
   control and that real enforcement had to happen server-side. That is
   now true: every rule below is also enforced by the API, so a volunteer
   who edits their own session in devtools gets a 403 from the server
   rather than access. This file decides what the user is *shown*; the
   backend decides what they can *do*.

   The public interface is unchanged, so every page that calls
   CSAuth.require(), CSAuth.current() or CSAuth.signIn() keeps working.
   ========================================================================== */

var CSAuth = (function () {
  "use strict";

  /* ------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------ */

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

  function isPhone(v) { return /^[0-9+\-\s]{8,15}$/.test(v.trim()); }

  /* Field-level error handling, matching the public site's approach */

  function fail(input, message) {
    var wrap = input.closest(".field");
    wrap.classList.add("has-error");
    var slot = wrap.querySelector(".error");
    if (slot) slot.textContent = message;
  }

  function clearErrors(scope) {
    (scope || document).querySelectorAll(".field").forEach(function (f) {
      f.classList.remove("has-error");
    });
    (scope || document).querySelectorAll(".error").forEach(function (e) {
      e.textContent = "";
    });
  }

  /* ------------------------------------------------------------------
     Notice panel
     ------------------------------------------------------------------ */

  var ICON = {
    wait: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 1.9"/>',
    stop: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/>',
    good: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-4.8"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>'
  };

  function notice(tone, title, body) {
    var el = document.getElementById("notice");
    if (!el) return;

    el.className = "notice is-" + tone;
    el.innerHTML =
      '<span class="notice-icon">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
        'stroke-linecap="round" stroke-linejoin="round">' + (ICON[tone] || ICON.info) + '</svg>' +
      '</span>' +
      '<span><strong>' + esc(title) + '</strong><span>' + esc(body) + '</span></span>';
    el.hidden = false;
  }

  function hideNotice() {
    var el = document.getElementById("notice");
    if (el) el.hidden = true;
  }

  /* ------------------------------------------------------------------
     Session
     ------------------------------------------------------------------ */

  function current() { return CSStore.session.get(); }

  function signOut(redirect) {
    /* auth.logout() discards the token as well as the session. Leaving a
       valid token behind would mean a "signed out" browser could still
       call the API. */
    CSStore.auth.logout();
    window.location.href = redirect || "login.html";
  }

  /* Guard a page. Returns the session user, or redirects away.

     Still synchronous, so existing page guards keep working unchanged.
     It checks the stored session only — the real check happens when the
     page's first API call is either honoured or refused with a 403. */
  function require(role, loginPath) {
    var user = current();
    if (!user) {
      window.location.replace(loginPath || "login.html");
      return null;
    }
    if (role === "admin" && user.role !== "admin" && user.role !== "super_admin") {
      window.location.replace(loginPath || "login.html");
      return null;
    }
    if (role === "volunteer" && user.role !== "volunteer") {
      window.location.replace(loginPath || "login.html");
      return null;
    }
    return user;
  }

  /* Optional stronger guard for sensitive pages. Confirms with the server
     that the token is still valid and the account is still active, which
     catches a deactivated user who still has an old session in their
     browser. Use where it matters; require() is fine elsewhere. */
  function requireVerified(role, loginPath) {
    var user = require(role, loginPath);
    if (!user) return Promise.resolve(null);

    return CSStore.auth.me().then(function (fresh) {
      /* Role may have changed since sign-in. */
      var stored = CSStore.session.get() || {};
      CSStore.session.set(Object.assign({}, stored, fresh));

      if (role === "admin" && fresh.role !== "admin" && fresh.role !== "super_admin") {
        window.location.replace(loginPath || "login.html");
        return null;
      }
      if (role === "volunteer" && fresh.role !== "volunteer") {
        window.location.replace(loginPath || "login.html");
        return null;
      }
      return CSStore.session.get();
    }).catch(function () {
      window.location.replace(loginPath || "login.html");
      return null;
    });
  }

  /* ------------------------------------------------------------------
     Sign in
     ------------------------------------------------------------------ */

  /*
     Volunteer status decides everything:

       no application -> send them to the application form
       pending        -> blocked, "under review"
       more_info      -> blocked, shows what the admin asked for
       rejected       -> blocked, shows the reason
       approved       -> in

     Where a volunteer is blocked outright (pending, rejected) the token
     is discarded, so a refused sign-in leaves nothing usable behind. In
     the more_info case the token is kept, because the whole point is to
     let them go back and update the application.
  */

  function mergeSession(extra) {
    var stored = CSStore.session.get() || {};
    return CSStore.session.set(Object.assign({}, stored, extra));
  }

  function signIn(email, password, wantRole) {

    return CSStore.auth.login(email, password).then(function (user) {

      var isAdmin = user.role === "admin" || user.role === "super_admin";

      /* The dropdown has to agree with the account. A mismatch means we
         discard the token we just received — the sign-in is refused, so
         nothing should be left signed in. */
      if (wantRole === "volunteer" && isAdmin) {
        CSStore.auth.logout();
        return { ok: false, tone: "stop", title: "That's an admin account",
                 body: "Switch the dropdown to Admin to sign in with it." };
      }
      if (wantRole !== "volunteer" && !isAdmin) {
        CSStore.auth.logout();
        return { ok: false, tone: "stop", title: "That's a volunteer account",
                 body: "Switch the dropdown to Volunteer to sign in with it." };
      }
      if (wantRole === "super_admin" && user.role !== "super_admin") {
        CSStore.auth.logout();
        return { ok: false, tone: "stop", title: "Not a Super Admin account",
                 body: "This account has Admin access. Choose Admin instead." };
      }
      /* The reverse was missing: a Super Admin could pick "Admin" and get
         in anyway. The dropdown must match the account exactly, so the
         role someone signs in with is always the role they really have. */
      if (wantRole === "admin" && user.role === "super_admin") {
        CSStore.auth.logout();
        return { ok: false, tone: "stop", title: "That's a Super Admin account",
                 body: "Switch the dropdown to Super Admin to sign in with it." };
      }

      /* Admins go straight through. The session was already stored by
         CSStore.auth.login(). */
      if (isAdmin) {
        return { ok: true, role: "admin" };
      }

      /* Volunteers are gated on their application. */
      return CSStore.myApplication().then(function (app) {

        if (!app) {
          mergeSession({ applicationStatus: "not_submitted" });
          return { ok: true, role: "application" };
        }

        if (app.status === "pending") {
          CSStore.auth.logout();
          return { ok: false, tone: "wait", title: "Your application is being reviewed",
                   body: "Submitted " + app.submittedAt + ". We usually reply within three working days." };
        }

        if (app.status === "more_info") {
          mergeSession({ applicationStatus: "more_info", applicationId: app._id });
          return { ok: false, tone: "wait", title: "We need a little more from you",
                   body: app.note, resume: true };
        }

        if (app.status === "rejected") {
          var reason = app.note || "Get in touch with the office if you'd like to know more.";
          CSStore.auth.logout();
          return { ok: false, tone: "stop", title: "This application wasn't taken forward",
                   body: reason };
        }

        mergeSession({ applicationStatus: "approved", applicationId: app._id });
        return { ok: true, role: "volunteer" };
      });

    }).catch(function (err) {

      /* The server refused. Turn its status code into the same shaped
         result the rest of this function returns, so login.html does not
         need to know the difference between a wrong password and a
         network failure. */

      if (err.status === 401) {
        return { ok: false, tone: "stop", title: "Those details don't match",
                 body: "Check the email address and password and try again." };
      }

      if (err.status === 403) {
        return { ok: false, tone: "stop", title: "This account is deactivated",
                 body: "Get in touch with the foundation office if you think that's wrong." };
      }

      if (err.status === 422) {
        return { ok: false, tone: "stop", title: "Check those details",
                 body: err.detail || "That email address doesn't look right." };
      }

      /* No status at all means fetch itself failed — usually the API is
         not running. Worth saying plainly rather than "unknown error". */
      if (!err.status) {
        return { ok: false, tone: "stop", title: "Can't reach the server",
                 body: "The CareSphere service isn't responding. If you're running this locally, check the backend is started." };
      }

      return { ok: false, tone: "stop", title: "Something went wrong",
               body: err.detail || "Please try again in a moment." };
    });
  }

  /* ------------------------------------------------------------------
     Register
     ------------------------------------------------------------------ */

  function register(name, email, password) {
    return CSStore.auth.register(name, email, password)
      .then(function (user) {
        /* A new account has no application yet. */
        mergeSession({ applicationStatus: "not_submitted" });
        return { ok: true, user: user };
      })
      .catch(function (err) {
        if (err.status === 409) {
          return { ok: false, message: "There's already an account with this email address." };
        }
        if (err.status === 422) {
          return { ok: false, message: err.detail || "Check the details and try again." };
        }
        if (!err.status) {
          return { ok: false, message: "Can't reach the server. Check the backend is running." };
        }
        return { ok: false, message: err.detail || "Something went wrong. Please try again." };
      });
  }

  /* ------------------------------------------------------------------
     Application submission and resubmission
     ------------------------------------------------------------------ */

  /* Sends the application form. Creates one the first time; updates it
     when the volunteer is coming back after a more_info request, which
     returns it to the review queue. */

  function submitApplication(form) {
    return CSStore.myApplication().then(function (existing) {
      return existing
        ? CSStore.resubmitApplication(form)   /* PATCH, back to pending */
        : CSStore.insert("applications", form);
    }).then(function (app) {
      mergeSession({ applicationStatus: app.status, applicationId: app._id });
      return { ok: true, application: app };
    }).catch(function (err) {
      return { ok: false, message: err.detail || "Could not save your application." };
    });
  }

  /* ------------------------------------------------------------------ */

  return {
    signIn: signIn,
    register: register,
    submitApplication: submitApplication,
    signOut: signOut,
    require: require,
    requireVerified: requireVerified,
    current: current,
    notice: notice,
    hideNotice: hideNotice,
    fail: fail,
    clearErrors: clearErrors,
    isEmail: isEmail,
    isPhone: isPhone,
    esc: esc,
    today: today
  };

})();
