/* ==========================================================
   CareSphere - volunteer.js
   ----------------------------------------------------------
   The FAQ accordion, nav and smooth scrolling are handled by
   site.js. This file only adds the Volunteer page reveals.
========================================================== */

(function () {

    "use strict";

    document.addEventListener("DOMContentLoaded", function () {

        if (!window.CareSphere) {
            return;
        }

        window.CareSphere.reveal(
            ".why-card, .work-card, .benefit-card, .process-card, .testimonial-card",
            { threshold: 0.12 }
        );

    });

}());
