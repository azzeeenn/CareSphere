/* ==========================================================
   CareSphere - programs.js
========================================================== */

(function () {

    "use strict";

    document.addEventListener("DOMContentLoaded", function () {

        if (!window.CareSphere) {
            return;
        }

        /* Counters read their own text ("15K+", "850+"), so the
           K suffix is preserved rather than parsed away. */
        window.CareSphere.countUp(".impact-card h2");

        window.CareSphere.reveal(
            ".program-card, .category-card, .story-card, .help-card",
            { threshold: 0.12 }
        );

    });

}());
