/* ==========================================================
   CareSphere - events.js
========================================================== */

(function () {

    "use strict";

    document.addEventListener("DOMContentLoaded", function () {

        if (window.CareSphere) {

            window.CareSphere.countUp(".stat-card h2");

            window.CareSphere.reveal(
                ".event-card, .benefit-card, .testimonial-card, .timeline-item",
                { threshold: 0.15 }
            );

        }

        /* ==================================================
           EVENT REGISTRATION
           Sends people to the sign-up page instead of showing
           an alert about a backend that isn't wired up yet.
        ================================================== */

        document
            .querySelectorAll(".event-content button")
            .forEach(function (button) {

                button.addEventListener("click", function () {
                    window.location.href = "register.html";
                });

            });

    });

}());
