/* ==========================================================
   CareSphere - about.js
   ----------------------------------------------------------
   The FAQ accordion, nav and smooth scrolling are handled by
   site.js. This file only adds the About page reveals.
========================================================== */

(function () {

    "use strict";

    document.addEventListener("DOMContentLoaded", function () {

        if (!window.CareSphere) {
            return;
        }

        window.CareSphere.reveal(
            ".mission-card, .value-card, .timeline-item, .team-card, .why-card",
            { threshold: 0.12 }
        );

        window.CareSphere.countUp(".stat h3");

    });

}());
