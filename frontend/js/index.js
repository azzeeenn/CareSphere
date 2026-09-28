/* ==========================================================
   CareSphere - index.js  (home page only)
   ----------------------------------------------------------
   Nav, mobile menu, anchor scrolling and the FAQ accordion all
   live in site.js. This file handles what is unique to the
   home page.

   Every section below used to be typed straight into the HTML.
   They now come from the database, so the home page always
   agrees with the rest of the site:

     Impact numbers  /api/stats + Impact Numbers  (same as the
                     Impact Dashboard)
     Events          upcoming published events; if none are
                     coming up, the most recent ones held
     Testimonials    stories an admin has approved, featured
                     ones first
     News            the latest published articles, pinned first

   If the backend can't be reached, each section says so rather
   than falling back to made-up content.
========================================================== */

(function () {

    "use strict";

    function esc(v) {
        return String(v == null ? "" : v)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function longDate(iso) {
        var d = new Date(iso);
        if (isNaN(d)) return "";
        return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    }

    function emptyNote(text) {
        return '<p class="home-empty">' + esc(text) + '</p>';
    }

    var OFFLINE = "This section couldn't load right now. Please refresh in a moment.";

    /* Pictures from the project's images folder, chosen by programme
       area. Events have no photo of their own. */
    function eventImage(e) {
        var t = (e.title || "").toLowerCase();
        if (t.indexOf("blood") !== -1)   return "../images/blood%20donation%20camp.jpg";
        if (e.category === "Healthcare") return "../images/medical%20camp%20rural.jpg";
        if (e.category === "Green Cover") return "../images/planting%20saplings.jpg";
        return "../images/outdoor%20teaching%20children.jpg";
    }

    function newsImage(n) {
        if (n.imagePath) return CSStore.fileUrl(n.imagePath);
        if (n.category === "Green Cover") return "../images/community%20cleanup%20drive.jpg";
        if (n.category === "Healthcare")  return "../images/health%20checkup%20queue.jpg";
        return "../images/large%20volunteer%20group.jpg";
    }

    function reveal(selector) {
        if (window.CareSphere && window.CareSphere.reveal) {
            window.CareSphere.reveal(selector, { threshold: 0.12 });
        }
    }

    /* ==================================================
       IMPACT NUMBERS
       Three live counts, plus the first figure an admin
       keeps that the system can't count itself.
    ================================================== */

    function loadImpact() {

        var host = document.getElementById("homeImpact");
        if (!host) return;

        Promise.all([
            fetch(CSStore.fileUrl("/api/stats")).then(function (r) {
                if (!r.ok) throw new Error("stats");
                return r.json();
            }),
            CSStore.find("impact").catch(function () { return []; })
        ]).then(function (res) {

            var live = res[0].figures;
            var typed = res[1].slice().sort(function (a, b) {
                return (a.order || 0) - (b.order || 0);
            });

            var liveLabels = live.map(function (f) { return f.label.toLowerCase(); });

            var picks = live.filter(function (f) {
                return f.key === "volunteers" || f.key === "events" || f.key === "hours";
            });

            var extra = typed.filter(function (t) {
                return liveLabels.indexOf(String(t.label).toLowerCase()) === -1;
            })[0];

            if (extra) picks.push({ label: extra.label, value: extra.value });

            host.innerHTML = picks.map(function (f) {
                return '' +
                    '<div class="impact-card">' +
                        '<h2 class="counter" data-target="' + (Number(f.value) || 0) + '">0</h2>' +
                        '<p>' + esc(f.label) + '</p>' +
                    '</div>';
            }).join("");

            if (window.CareSphere && window.CareSphere.countUp) {
                window.CareSphere.countUp("#homeImpact .counter");
            } else {
                host.querySelectorAll(".counter").forEach(function (el) {
                    el.textContent = Number(el.dataset.target).toLocaleString("en-IN");
                });
            }

        }).catch(function () {
            host.innerHTML = emptyNote(OFFLINE);
        });
    }

    /* ==================================================
       EVENTS
    ================================================== */

    function signedInVolunteer() {
        var u = CSStore.session.get();
        return u && u.role === "volunteer" && u.applicationStatus === "approved" ? u : null;
    }

    function loadEvents() {

        var host = document.getElementById("homeEvents");
        if (!host) return;

        CSStore.find("events").then(function (events) {

            var now = new Date();

            var upcoming = events.filter(function (e) {
                return e.status === "published" && new Date(e.startsAt) >= now;
            }).sort(function (a, b) {
                return new Date(a.startsAt) - new Date(b.startsAt);
            });

            var list = upcoming.slice(0, 3);
            var isPast = false;

            /* Nothing coming up: show what was recently held instead of
               an empty box, and say so in the heading. */
            if (!list.length) {
                isPast = true;
                list = events.filter(function (e) {
                    return (e.status === "completed" || e.status === "published") &&
                           new Date(e.startsAt) < now;
                }).sort(function (a, b) {
                    return new Date(b.startsAt) - new Date(a.startsAt);
                }).slice(0, 3);

                document.getElementById("eventsTag").textContent = "RECENT EVENTS";
                document.getElementById("eventsHeading").textContent = "What We've Been Up To";
            }

            if (!list.length) {
                host.innerHTML = emptyNote("No events to show yet. New ones will appear here as soon as they're published.");
                return;
            }

            host.innerHTML = list.map(function (e) {
                var full = e.capacity && e.registered >= e.capacity;
                var button = isPast
                    ? '<button type="button" disabled>Held on ' + esc(longDate(e.startsAt)) + '</button>'
                    : '<button type="button" data-event="' + esc(e._id) + '">' +
                          (full ? "Join the waitlist" : "Register") + '</button>';

                return '' +
                    '<div class="event-card">' +
                        '<img src="' + eventImage(e) + '" alt="">' +
                        '<div class="event-content">' +
                            '<span class="event-date">' + esc(longDate(e.startsAt)) + '</span>' +
                            '<h3>' + esc(e.title) + '</h3>' +
                            '<span class="event-meta">' +
                                esc([e.venue, e.district].filter(Boolean).join(", ")) +
                            '</span>' +
                            '<p>' + esc(e.description || "") + '</p>' +
                            button +
                        '</div>' +
                    '</div>';
            }).join("");

            reveal("#homeEvents .event-card");

        }).catch(function () {
            host.innerHTML = emptyNote(OFFLINE);
        });

        /* Register: a signed-in, approved volunteer is registered on the
           spot. Anyone else is sent to sign in, and brought back here. */
        host.addEventListener("click", function (ev) {
            var btn = ev.target.closest("[data-event]");
            if (!btn || btn.disabled) return;

            if (!signedInVolunteer()) {
                try { localStorage.setItem("caresphere_return", window.location.href); } catch (e) {}
                window.location.href = "login.html";
                return;
            }

            btn.disabled = true;
            btn.textContent = "Registering…";

            CSStore.registerForEvent(btn.getAttribute("data-event")).then(function (reg) {
                btn.textContent = reg && reg.status === "waitlisted"
                    ? "You're on the waitlist"
                    : "You're registered";
            }).catch(function (err) {
                if (err && err.status === 409) {
                    btn.textContent = "Already registered";
                } else {
                    btn.disabled = false;
                    btn.textContent = "Try again";
                    alert((err && err.detail) || "That didn't work. Please try again.");
                }
            });
        });
    }

    /* ==================================================
       TESTIMONIALS
       The public API only ever returns approved stories.
    ================================================== */

    function loadTestimonials() {

        var host = document.getElementById("homeTestimonials");
        if (!host) return;

        CSStore.find("testimonials").then(function (rows) {

            var list = rows.slice().sort(function (a, b) {
                if (a.featured !== b.featured) return a.featured ? -1 : 1;
                return new Date(b.submittedAt) - new Date(a.submittedAt);
            }).slice(0, 3);

            if (!list.length) {
                host.innerHTML = emptyNote("Stories from our volunteers will appear here once they've been reviewed.");
                return;
            }

            host.innerHTML = list.map(function (t) {
                var initial = (t.name || "?").trim().charAt(0).toUpperCase();
                return '' +
                    '<div class="testimonial-card">' +
                        '<span class="t-avatar" aria-hidden="true">' + esc(initial) + '</span>' +
                        '<p>“' + esc(t.body) + '”</p>' +
                        '<h4>' + esc(t.name) + '</h4>' +
                        '<span>' + esc(t.role || "") + '</span>' +
                    '</div>';
            }).join("");

            reveal("#homeTestimonials .testimonial-card");

        }).catch(function () {
            host.innerHTML = emptyNote(OFFLINE);
        });
    }

    /* ==================================================
       NEWS
       The public API only returns published articles, and
       already puts pinned ones first.
    ================================================== */

    function loadNews() {

        var host = document.getElementById("homeNews");
        if (!host) return;

        CSStore.find("news").then(function (rows) {

            var list = rows.slice(0, 3);

            if (!list.length) {
                host.innerHTML = emptyNote("News will appear here as soon as the first article is published.");
                return;
            }

            host.innerHTML = list.map(function (n) {
                return '' +
                    '<div class="news-card">' +
                        '<a class="news-link" href="news.html">' +
                            '<img src="' + esc(newsImage(n)) + '" alt="">' +
                            '<div class="news-content">' +
                                '<h3>' + esc(n.title) + '</h3>' +
                                '<p>' + esc(n.excerpt || "") + '</p>' +
                            '</div>' +
                        '</a>' +
                    '</div>';
            }).join("");

            reveal("#homeNews .news-card");

        }).catch(function () {
            host.innerHTML = emptyNote(OFFLINE);
        });
    }

    /* ==================================================
       NEWSLETTER
    ================================================== */

    function initNewsletter() {

        var newsletter = document.getElementById("newsletterForm");
        var note = document.getElementById("newsletterNote");

        function showNote(message, ok) {
            if (!note) return;
            note.textContent = message;
            note.style.color = ok ? "#2FBF71" : "#D3675A";
        }

        if (!newsletter) return;

        newsletter.addEventListener("submit", function (e) {

            e.preventDefault();

            var input = document.getElementById("newsletterEmail");
            var value = input.value.trim();
            var pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (value === "") {
                showNote("Enter an email address to subscribe.", false);
                input.focus();
                return;
            }

            if (!pattern.test(value)) {
                showNote("That email address doesn't look right.", false);
                input.focus();
                return;
            }

            var btn = newsletter.querySelector("button");
            btn.disabled = true;

            /* Saved in the database now, not just a message. */
            CSStore.subscribe(value).then(function (r) {
                showNote(r && r.status === "already"
                    ? "You're already on the list. Thanks for staying with us."
                    : "You're subscribed. Watch your inbox for our next update.", true);
                newsletter.reset();
            }).catch(function (err) {
                showNote(err && err.status === 422
                    ? "That email address doesn't look right."
                    : "That didn't go through. Please try again in a moment.", false);
            }).then(function () {
                btn.disabled = false;
            });
        });
    }

    /* ==================================================
       BOOT
    ================================================== */

    document.addEventListener("DOMContentLoaded", function () {

        reveal(".program-card");

        loadImpact();
        loadEvents();
        loadTestimonials();
        loadNews();
        initNewsletter();

    });

}());
