/* ==========================================================
   CareSphere - forgot-password.js
   ----------------------------------------------------------
   Front-end only. Point the submit handler at your API when
   the backend is ready.
========================================================== */

(function () {

    "use strict";

    document.addEventListener("DOMContentLoaded", function () {

        var form = document.getElementById("resetForm");
        var email = document.getElementById("email");
        var message = document.getElementById("formMessage");

        if (!form) {
            return;
        }

        function say(text, ok) {

            if (!message) {
                return;
            }

            message.textContent = text;
            message.className = "form-message " + (ok ? "is-ok" : "is-error");

        }

        form.addEventListener("submit", function (e) {

            e.preventDefault();

            var value = email.value.trim();
            var pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (value === "") {
                say("Enter the email address on your account.", false);
                email.focus();
                return;
            }

            if (!pattern.test(value)) {
                say("That email address doesn't look right.", false);
                email.focus();
                return;
            }

            var button = form.querySelector('button[type="submit"]');

            button.textContent = "Sending...";
            button.disabled = true;

            window.setTimeout(function () {

                /* Deliberately vague: don't reveal whether an account
                   exists for a given address. */
                say(
                    "If that address has a CareSphere account, a reset link is on its way.",
                    true
                );

                button.textContent = "Send Reset Link";
                button.disabled = false;
                form.reset();

            }, 1000);

        });

    });

}());
