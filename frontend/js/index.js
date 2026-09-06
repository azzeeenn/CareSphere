/* ==========================================================
   CareSphere - index.js  (home page only)
   ----------------------------------------------------------
   Nav, mobile menu, anchor scrolling and the FAQ accordion all
   live in site.js now. This file only handles what is unique
   to the home page.

   The old scroll handler that recoloured the navbar has been
   removed: the header is solid white on every page now, and
   that code also set colour on .logo, which could never win
   against the colours .logo i / .logo span set in CSS.
========================================================== */

(function () {

    "use strict";

    document.addEventListener("DOMContentLoaded", function () {

        /* ==================================================
           COUNTERS + SCROLL REVEAL
        ================================================== */

        if (window.CareSphere) {

            window.CareSphere.countUp(".counter");

            window.CareSphere.reveal(
                ".program-card, .event-card, .news-card, .testimonial-card",
                { threshold: 0.12 }
            );

        }

        /* ==================================================
           EVENT REGISTRATION BUTTONS
        ================================================== */

        document
            .querySelectorAll(".event-content button")
            .forEach(function (button) {

                button.addEventListener("click", function () {
                    window.location.href = "register.html";
                });

            });

        /* ==================================================
           NEWSLETTER
        ================================================== */

        var newsletter = document.getElementById("newsletterForm");
        var note = document.getElementById("newsletterNote");

        function showNote(message, ok) {

            if (!note) {
                return;
            }

            note.textContent = message;
            note.style.color = ok ? "#2FBF71" : "#D3675A";

        }

        if (newsletter) {

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

                showNote(
                    "You're subscribed. Watch your inbox for our next update.",
                    true
                );

                newsletter.reset();

            });

        }

    });

}());
