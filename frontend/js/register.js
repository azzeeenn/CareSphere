/* ==========================================================
   CareSphere - register.js
   ----------------------------------------------------------
   Front-end only. Replace the fake delay in the submit handler
   with a real fetch() to your API when the backend is ready.
========================================================== */

(function () {

    "use strict";

    document.addEventListener("DOMContentLoaded", function () {

        var form = document.getElementById("registerForm");
        var name = document.getElementById("name");
        var email = document.getElementById("email");
        var password = document.getElementById("password");
        var confirmPassword = document.getElementById("confirmPassword");
        var toggle = document.getElementById("togglePassword");
        var google = document.querySelector(".google");
        var message = document.getElementById("formMessage");
        var terms = form ? form.querySelector('.remember input[type="checkbox"]') : null;

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

        /* ==================================================
           SHOW / HIDE PASSWORD
        ================================================== */

        if (toggle && password && confirmPassword) {

            toggle.addEventListener("click", function () {

                var hidden = password.type === "password";
                var type = hidden ? "text" : "password";

                password.type = type;
                confirmPassword.type = type;

                toggle.innerHTML = hidden
                    ? '<i class="fa-solid fa-eye-slash"></i>'
                    : '<i class="fa-solid fa-eye"></i>';

                toggle.setAttribute(
                    "aria-label",
                    hidden ? "Hide password" : "Show password"
                );

            });

        }

        /* ==================================================
           SUBMIT
        ================================================== */

        form.addEventListener("submit", function (e) {

            e.preventDefault();

            var pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (name.value.trim() === "") {
                say("Enter your full name.", false);
                name.focus();
                return;
            }

            if (!pattern.test(email.value.trim())) {
                say("Enter a valid email address.", false);
                email.focus();
                return;
            }

            if (password.value.length < 8) {
                say("Use at least 8 characters for your password.", false);
                password.focus();
                return;
            }

            if (password.value !== confirmPassword.value) {
                say("Those passwords don't match.", false);
                confirmPassword.focus();
                return;
            }

            if (terms && !terms.checked) {
                say("Accept the Terms & Conditions to continue.", false);
                terms.focus();
                return;
            }

            var button = form.querySelector('button[type="submit"]');

            button.textContent = "Creating account...";
            button.disabled = true;

            say("Account created. Taking you to sign in...", true);

            window.setTimeout(function () {
                window.location.href = "login.html";
            }, 1400);

        });

        /* ==================================================
           GOOGLE BUTTON (UI ONLY FOR NOW)
        ================================================== */

        if (google) {

            google.addEventListener("click", function () {
                say("Google sign-in isn't connected yet. Use the form above.", false);
            });

        }

    });

}());
