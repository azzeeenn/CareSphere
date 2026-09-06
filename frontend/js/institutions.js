/* ==========================================================
   CareSphere - institutions.js
   ----------------------------------------------------------
   Smooth scrolling and the nav live in site.js.

   The partnership form posts to POST /api/partnerships through
   CSStore. The server sets the received date and starts every
   request at status "new", so it lands in the admin
   partnerships queue for an organiser to work through.
========================================================== */

document.addEventListener("DOMContentLoaded", function () {

    if (window.CareSphere) {

        window.CareSphere.reveal(
            ".benefit-card, .type-card, .process-card, .story-card",
            { threshold: 0.15 }
        );

    }

});

/* ==========================
   PARTNERSHIP FORM
========================== */

const instForm = document.getElementById("instForm");

if (instForm) {

    const statusLine = document.createElement("p");
    statusLine.className = "form-message";
    statusLine.setAttribute("role", "status");
    statusLine.setAttribute("aria-live", "polite");
    instForm.appendChild(statusLine);

    function showStatus(text, ok) {

        statusLine.textContent = text;
        statusLine.className = "form-message " + (ok ? "is-ok" : "is-error");

    }

    instForm.addEventListener("submit", function (e) {

        e.preventDefault();

        const name          = document.getElementById("instName").value.trim();
        const type          = document.getElementById("instType").value;
        const contactName   = document.getElementById("contactName").value.trim();
        const contactRole   = document.getElementById("contactRole").value.trim();
        const email         = document.getElementById("contactEmail").value.trim();
        const phone         = document.getElementById("contactPhone").value.trim();
        const location      = document.getElementById("instLocation").value.trim();
        const childCountRaw = document.getElementById("childCount").value;
        const message       = document.getElementById("instMessage").value.trim();

        /* --- Validation ------------------------------------------- */

        if (!name || !type || !contactName || !email || !phone || !location) {

            showStatus("Fill in every required field before sending.", false);
            return;

        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {

            showStatus("That email address doesn't look right.", false);
            return;

        }

        if (phone.replace(/\D/g, "").length < 10) {

            showStatus("Enter a phone number we can actually reach you on.", false);
            return;

        }

        /* --- Submit ------------------------------------------------ */

        const button = instForm.querySelector('button[type="submit"]');
        const originalText = button.textContent;

        button.textContent = "Submitting...";
        button.disabled = true;

        const record = {
            institutionName: name,
            type: type,
            contactName: contactName,
            contactRole: contactRole || "",
            email: email,
            phone: phone,
            location: location,
            childCount: childCountRaw ? parseInt(childCountRaw, 10) : null,
            message: message || ""
        };

        CSStore.insert("partnerships", record)

            .then(function () {

                showStatus(
                    "Thank you, " + contactName + ". Your request for " + name +
                    " is in - our team replies within 2-3 working days.",
                    true
                );

                instForm.reset();

            })

            .catch(function (err) {

                console.error("Partnership submission failed:", err);

                showStatus(
                    "That didn't send. Try again, or email partnerships@caresphere.org " +
                    "and we'll pick it up from there.",
                    false
                );

            })

            .finally(function () {

                button.textContent = originalText;
                button.disabled = false;

            });

    });

}
