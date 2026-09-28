/* ==========================================================================
   CareSphere — Data layer  (API version)
   Single source of truth for the public site, the volunteer pages and the
   admin panel. Every page talks to this file and never to the API directly.

   This replaces the localStorage version. The method signatures are
   identical, so pages that used the old store keep working:

       find("applications", { status: "pending" })
         before ->  read localStorage
         now    ->  GET /api/applications?status=pending

   What changed, and why:

     * Every call now hits the network, so failures are real. Methods
       reject with an Error carrying .status and .detail from the server.

     * Passwords are hashed in the database and can no longer be compared
       in the browser. Sign-in goes through CSStore.auth.login().
       See the note on login.html at the bottom of this file.

     * reset() cannot wipe a server database from a web page. Run
       `python seed.py` in the backend folder instead.

   Collection names below map 1:1 to API endpoints.
   ========================================================================== */

var CSStore = (function () {
  "use strict";

  /* Change this one line when the backend moves to a real server. */
  var API_BASE = "http://127.0.0.1:8000";

  var TOKEN_KEY = "caresphere_token";
  var SES_KEY   = "caresphere_session";

  /* ------------------------------------------------------------------
     Collection -> endpoint
     ------------------------------------------------------------------ */

  var ENDPOINTS = {
    users:         "/api/users",
    applications:  "/api/applications",
    events:        "/api/events",
    registrations: "/api/registrations",
    hours:         "/api/hours",
    certificates:  "/api/certificates",
    donations:     "/api/donations",
    messages:      "/api/messages",
    partnerships:  "/api/partnerships",
    testimonials:  "/api/testimonials",
    news:          "/api/news",
    gallery:       "/api/gallery",
    recognition:   "/api/recognition",
    faq:           "/api/faq",
    impact:        "/api/impact",
    settings:      "/api/settings",
    adminRequests: "/api/admin-requests"
  };

  /* Filters the API understands. Anything else in a query object is
     applied here in the browser after the response arrives, so old calls
     like find("events", { category: "Education", status: "published" })
     still return the right rows either way. */
  var SERVER_FILTERS = {
    applications:  ["status", "district"],
    events:        ["status", "district", "category"],
    registrations: ["eventId"],
    hours:         ["status"],
    certificates:  ["status"],
    donations:     ["status"],
    messages:      ["status"],
    partnerships:  ["status"],
    testimonials:  ["featured"],
    news:          ["status", "category"],
    gallery:       ["album", "district"],
    recognition:   ["type"],
    faq:           ["category"],
    users:         ["role"]
  };

  /* Collections whose status changes go to a /review sub-route rather
     than a plain PATCH, because reviewing records who did it and when. */
  var REVIEW_ROUTES = {
    applications: true,
    hours:        true,
    certificates: true
  };

  function endpointFor(collection) {
    var url = ENDPOINTS[collection];
    if (!url) throw new Error("CSStore: unknown collection '" + collection + "'");
    return url;
  }

  /* ------------------------------------------------------------------
     Token handling
     ------------------------------------------------------------------ */

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY); }
    catch (e) { return null; }
  }

  function setToken(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }

  /* Read the stored session from inside the module. Used to decide which
     endpoint an update belongs to — a volunteer editing their own
     application goes somewhere different from an admin reviewing it. */
  function readSession() {
    try { return JSON.parse(localStorage.getItem(SES_KEY)); }
    catch (e) { return null; }
  }

  function isStaff() {
    var user = readSession();
    return !!(user && (user.role === "admin" || user.role === "super_admin"));
  }

  /* ------------------------------------------------------------------
     The one function every method goes through
     ------------------------------------------------------------------ */

  function request(method, path, body) {
    var headers = { "Content-Type": "application/json" };
    var token = getToken();
    if (token) headers.Authorization = "Bearer " + token;

    var options = { method: method, headers: headers };
    if (body !== undefined) options.body = JSON.stringify(body);

    return fetch(API_BASE + path, options).then(function (response) {

      /* 204 means success with nothing to return, e.g. a delete. */
      if (response.status === 204) return null;

      return response.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }

        if (response.ok) return data;

        /* An expired or invalid token: clear the stale session so the
           page guard sends the user to sign in again rather than
           looping on failed requests. */
        if (response.status === 401) {
          setToken(null);
          try { localStorage.removeItem(SES_KEY); } catch (e) {}
        }

        var detail = (data && data.detail) || response.statusText;
        if (Array.isArray(detail)) {
          /* FastAPI validation errors arrive as a list. Show the first
             in plain language rather than dumping the whole structure. */
          detail = detail.map(function (d) {
            var field = (d.loc || []).slice(-1)[0];
            return field ? field + ": " + d.msg : d.msg;
          }).join(", ");
        }

        var err = new Error(detail || "Request failed");
        err.status = response.status;
        err.detail = detail;
        throw err;
      });
    });
  }

  /* ------------------------------------------------------------------
     File uploads

     Separate from request() because the body is FormData, not JSON. The
     browser must set Content-Type itself so it can include the multipart
     boundary — setting it by hand produces a request the server cannot
     parse.
     ------------------------------------------------------------------ */

  function upload(path, file, filename) {
    var headers = {};
    var token = getToken();
    if (token) headers.Authorization = "Bearer " + token;

    var form = new FormData();
    if (filename) form.append("file", file, filename);
    else form.append("file", file);

    return fetch(API_BASE + path, {
      method: "POST",
      headers: headers,
      body: form
    }).then(function (response) {
      return response.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }

        if (response.ok) return data;

        if (response.status === 401) {
          setToken(null);
          try { localStorage.removeItem(SES_KEY); } catch (e) {}
        }

        var detail = (data && data.detail) || response.statusText;
        if (Array.isArray(detail)) {
          detail = detail.map(function (d) { return d.msg; }).join(", ");
        }

        var err = new Error(detail || "Upload failed");
        err.status = response.status;
        err.detail = detail;
        throw err;
      });
    });
  }

  /* ------------------------------------------------------------------
     Query helpers
     ------------------------------------------------------------------ */

  function buildQuery(collection, query) {
    if (!query) return { search: "", leftover: null };

    var allowed = SERVER_FILTERS[collection] || [];
    var parts = [];
    var leftover = null;

    Object.keys(query).forEach(function (key) {
      var value = query[key];

      /* Arrays mean "any of these", which the API does not take as a
         query string. Filter those here instead. */
      if (allowed.indexOf(key) !== -1 && !Array.isArray(value)) {
        parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
      } else {
        leftover = leftover || {};
        leftover[key] = value;
      }
    });

    return {
      search: parts.length ? "?" + parts.join("&") : "",
      leftover: leftover
    };
  }

  function matches(doc, query) {
    return Object.keys(query || {}).every(function (k) {
      var want = query[k];
      if (Array.isArray(want)) return want.indexOf(doc[k]) !== -1;
      return doc[k] === want;
    });
  }

  /* ------------------------------------------------------------------
     Public API — same shape as the localStorage version
     ------------------------------------------------------------------ */

  return {

    /** find("applications", { status: "pending" }) -> Promise<Array> */
    find: function (collection, query) {
      var built = buildQuery(collection, query);

      return request("GET", endpointFor(collection) + built.search)
        .then(function (rows) {
          /* settings is a single object; the old store held it in a
             one-item array, so keep that shape. */
          if (!Array.isArray(rows)) rows = rows ? [rows] : [];
          if (built.leftover) {
            rows = rows.filter(function (d) { return matches(d, built.leftover); });
          }
          return rows;
        });
    },

    /** findById("events", "1") -> Promise<Object|null> */
    findById: function (collection, id) {
      if (collection === "settings") {
        return request("GET", "/api/settings");
      }
      return request("GET", endpointFor(collection) + "/" + id)
        .catch(function (err) {
          if (err.status === 404) return null;
          throw err;
        });
    },

    /** count("applications", { status: "pending" }) -> Promise<Number> */
    count: function (collection, query) {
      return this.find(collection, query).then(function (rows) {
        return rows.length;
      });
    },

    /** insert("events", { title: "..." }) -> Promise<Object> */
    insert: function (collection, doc) {
      return request("POST", endpointFor(collection), doc);
    },

    /** updateById("applications", "1", { status: "approved" })
     *
     *  Where an update goes depends on who is making it:
     *
     *    applications, a volunteer  -> PATCH /api/applications/me
     *        Editing their own form and sending it back for review. The
     *        id is ignored; the server works out whose it is from the
     *        token, so nobody can edit someone else's application by
     *        passing a different id.
     *
     *    applications, hours, certificates, an admin with a status change
     *                               -> PATCH .../{id}/review
     *        Reviewing. This is what records who decided and when.
     *
     *    everything else            -> PATCH .../{id}
     */
    updateById: function (collection, id, changes) {
      if (collection === "settings") {
        return request("PATCH", "/api/settings", changes);
      }

      if (collection === "applications" && !isStaff()) {
        return request("PATCH", "/api/applications/me", changes);
      }

      if (REVIEW_ROUTES[collection] && changes && changes.status) {
        var review = { status: changes.status };
        if (changes.note !== undefined) review.note = changes.note;
        return request("PATCH", endpointFor(collection) + "/" + id + "/review", review);
      }

      return request("PATCH", endpointFor(collection) + "/" + id, changes);
    },

    /** removeById("gallery", "1") -> Promise<Boolean> */
    removeById: function (collection, id) {
      return request("DELETE", endpointFor(collection) + "/" + id)
        .then(function () { return true; })
        .catch(function (err) {
          if (err.status === 404) return false;
          throw err;
        });
    },

    /* --- Authentication --------------------------------------------
       New. The old store compared plaintext passwords in the browser,
       which is no longer possible or desirable — the database stores
       bcrypt hashes and the users list is restricted to super admins. */

    auth: {

      /** login(email, password) -> Promise<user> */
      login: function (email, password) {
        return request("POST", "/api/auth/login", {
          email: email,
          password: password
        }).then(function (data) {
          setToken(data.token);
          try { localStorage.setItem(SES_KEY, JSON.stringify(data.user)); } catch (e) {}
          return data.user;
        });
      },

      /** Public volunteer sign-up. Always creates a volunteer. */
      register: function (name, email, password) {
        return request("POST", "/api/auth/register", {
          name: name,
          email: email,
          password: password
        }).then(function (data) {
          setToken(data.token);
          try { localStorage.setItem(SES_KEY, JSON.stringify(data.user)); } catch (e) {}
          return data.user;
        });
      },

      /** Confirms the stored token is still valid. Use on page load for
       *  anything sensitive — a deactivated account fails here.
       *
       *  Merges rather than replaces. Pages add their own keys to the
       *  session (applicationStatus, applicationId), and overwriting the
       *  whole object would drop them — which sends a page guard looking
       *  for applicationStatus straight back to the login screen. */
      me: function () {
        return request("GET", "/api/auth/me").then(function (user) {
          try {
            var stored = JSON.parse(localStorage.getItem(SES_KEY)) || {};
            Object.keys(user).forEach(function (k) { stored[k] = user[k]; });
            localStorage.setItem(SES_KEY, JSON.stringify(stored));
          } catch (e) {}
          return user;
        });
      },

      changePassword: function (currentPassword, newPassword) {
        return request("POST", "/api/auth/change-password", {
          currentPassword: currentPassword,
          newPassword: newPassword
        });
      },

      logout: function () {
        setToken(null);
        try {
          localStorage.removeItem(SES_KEY);
          sessionStorage.removeItem(SES_KEY);
        } catch (e) {}
      }
    },

    /* --- Session ----------------------------------------------------
       Unchanged interface, so page guards keep working. Still
       localStorage rather than sessionStorage, so a page opened in a new
       tab is still signed in. */

    session: {
      set: function (user) {
        try { localStorage.setItem(SES_KEY, JSON.stringify(user)); } catch (e) {}
        return user;
      },
      get: function () {
        try { return JSON.parse(localStorage.getItem(SES_KEY)); }
        catch (e) { return null; }
      },
      clear: function () {
        setToken(null);
        try {
          localStorage.removeItem(SES_KEY);
          sessionStorage.removeItem(SES_KEY);
        } catch (e) {}
      }
    },

    /* --- Convenience methods for the newer endpoints ----------------- */

    /** The volunteer's own application, or null if they have not applied. */
    myApplication: function () {
      return request("GET", "/api/applications/me").catch(function (err) {
        if (err.status === 404) return null;
        throw err;
      });
    },

    /* --- File uploads ------------------------------------------------
       These use FormData rather than JSON, so they bypass request() —
       the browser has to set Content-Type itself to include the
       multipart boundary. Setting it by hand breaks the upload. */

    /** Attach a file to a certificate request.
     *  file may be a File from an <input>, or a Blob plus a name. */
    uploadCertificateProof: function (certificateId, file, filename) {
      return upload(
        "/api/certificates/" + certificateId + "/proofs",
        file,
        filename
      );
    },

    /** Files already attached to a request. */
    certificateProofs: function (certificateId) {
      return request("GET", "/api/certificates/" + certificateId + "/proofs");
    },

    /** Turn a stored file path into a URL the browser can actually load.
     *
     *  Uploaded files live on the API server, but the pages are served
     *  by Live Server on a different port. A bare "/uploads/..." would
     *  be looked up on the page's own origin and 404, so the API's host
     *  has to be put back on the front.
     *
     *      fileUrl("uploads/proofs/abc.jpg")
     *      fileUrl("/uploads/proofs/abc.jpg")
     *        -> "http://127.0.0.1:8000/uploads/proofs/abc.jpg"
     *
     *  Full URLs and data URLs are passed through untouched, so this is
     *  safe to call on anything.
     */
    fileUrl: function (path) {
      if (!path) return "";
      if (/^(https?:|data:|blob:)/i.test(path)) return path;
      return API_BASE + (path.charAt(0) === "/" ? path : "/" + path);
    },

    /** Upload a gallery or news image. Admins only.
     *  Returns { path, url, originalName } — send path as imagePath. */
    uploadImage: function (file, folder, filename) {
      return upload(
        "/api/uploads/image?folder=" + encodeURIComponent(folder || "gallery"),
        file,
        filename
      );
    },

    /** Update your own application and send it back for review. Only
     *  works while it is pending or more_info. */
    resubmitApplication: function (form) {
      return request("PATCH", "/api/applications/me", form);
    },

    /** { verified, pending, entries } for the signed-in volunteer. */
    myHoursSummary: function () {
      return request("GET", "/api/hours/summary/me");
    },

    /** Sign up for an event. */
    registerForEvent: function (eventId) {
      return request("POST", "/api/registrations", { eventId: eventId });
    },

    /** Donation totals for the dashboard. Super admin only. */
    donationSummary: function () {
      return request("GET", "/api/donations/summary");
    },

    /** Admins available in an assignee dropdown. */
    staff: function () {
      return request("GET", "/api/users/staff");
    },

    /* --- Becoming an admin -------------------------------------------
       Every rule is checked by the server; these just call it. */

    promotion: {
      /** The current eligibility bar. */
      rules: function () {
        return request("GET", "/api/admin-requests/rules");
      },
      /** Super admin: change the bar. */
      updateRules: function (changes) {
        return request("PATCH", "/api/admin-requests/rules", changes);
      },
      /** Volunteer: the 7-rule checklist with their real numbers. */
      myEligibility: function () {
        return request("GET", "/api/admin-requests/eligibility/me");
      },
      /** Volunteer: their own requests and outcomes. */
      mine: function () {
        return request("GET", "/api/admin-requests/me");
      },
      /** Volunteer: send a request. Refused by the server if not eligible. */
      apply: function (form) {
        return request("POST", "/api/admin-requests", form);
      },
      /** Admin: every request, each with the volunteer's live record. */
      list: function () {
        return request("GET", "/api/admin-requests");
      },
      /** Admin: vouch for a request. */
      endorse: function (id, comment) {
        return request("POST", "/api/admin-requests/" + id + "/endorse", { comment: comment });
      },
      /** Super admin: record the interview. */
      interview: function (id, notes) {
        return request("PATCH", "/api/admin-requests/" + id + "/interview", { notes: notes });
      },
      /** Super admin: approve or reject. */
      review: function (id, status, note) {
        return request("PATCH", "/api/admin-requests/" + id + "/review", { status: status, note: note || "" });
      }
    },

    /* --- Reference lists ---------------------------------------------
       These were hardcoded arrays. They are now tables, so an admin can
       add a seventh district without anyone editing code.

       The arrays below stay as an immediate fallback so existing
       synchronous code does not break, and are refreshed from the API
       as soon as it answers. Prefer the async versions in new code. */

    districts: ["Bengaluru Urban", "Mysuru", "Mandya", "Kolar", "Hassan", "Tumakuru"],
    categories: ["Education", "Healthcare", "Green Cover"],

    loadDistricts: function () {
      var self = this;
      return request("GET", "/api/districts").then(function (rows) {
        self.districts = rows.map(function (d) { return d.name; });
        return self.districts;
      });
    },

    loadCategories: function () {
      var self = this;
      return request("GET", "/api/categories").then(function (rows) {
        self.categories = rows.map(function (c) { return c.name; });
        return self.categories;
      });
    },

    /* Certificate types now come from the backend, so the rules the
       server enforces and the text the form shows cannot drift apart. */
    certificateTypes: [
      { id: "hours",          label: "Volunteering hours certificate",
        blurb: "States the total hours you've given, verified by an organiser.",
        needs: "verifiedHours" },
      { id: "participation",  label: "Event participation certificate",
        blurb: "Confirms you took part in one particular event.",
        needs: "event" },
      { id: "recommendation", label: "Letter of recommendation",
        blurb: "A written reference for a job or course application.",
        needs: "reference" },
      { id: "completion",     label: "Service completion certificate",
        blurb: "For college or internship records covering your whole time with us.",
        needs: "verifiedHours" }
    ],

    loadCertificateTypes: function () {
      var self = this;
      return request("GET", "/api/certificates/types").then(function (rows) {
        self.certificateTypes = rows;
        return rows;
      });
    },

    /* --- Utilities ---------------------------------------------------- */

    /** Is the API reachable? Useful for a friendly "backend is not
     *  running" message instead of a wall of console errors. */
    health: function () {
      return request("GET", "/api/health")
        .then(function () { return true; })
        .catch(function () { return false; });
    },

    /** The old reset() wiped localStorage. A web page cannot and should
     *  not wipe a server database, so this only clears the local session
     *  and tells you what to run instead. */
    reset: function () {
      this.session.clear();
      console.info(
        "CSStore.reset(): signed out locally. To reload demo data, run " +
        "`python seed.py` in the backend folder."
      );
      return Promise.resolve(true);
    }
  };

})();

/* ==========================================================================
   ONE PAGE NEEDS CHANGING: login.html

   The old sign-in did something like this:

       CSStore.find("users", { email: email }).then(function (rows) {
         if (rows[0] && rows[0].password === password) {
           CSStore.session.set(rows[0]);
           location.href = "dashboard.html";
         }
       });

   That cannot work now. Passwords are stored as bcrypt hashes, and the
   users list is restricted to super admins, so the lookup would fail even
   before the comparison. Replace it with:

       CSStore.auth.login(email, password)
         .then(function (user) {
           location.href = user.role === "volunteer"
             ? "dashboard.html"
             : "../adminside/frontend/html/admin-dashboard.html";
         })
         .catch(function (err) {
           showError(err.detail);        // "Incorrect email or password"
         });

   auth.login stores the token and the session itself, so any
   session.set() call after it is redundant.

   Sign-out should call CSStore.auth.logout() rather than session.clear()
   alone, so the token is discarded too. (session.clear() now does this
   as well, so existing calls are safe.)
   ========================================================================== */
