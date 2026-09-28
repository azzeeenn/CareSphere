/* ==========================================================
   CareSphere - faq.js

   The questions used to be eight blocks written into
   faq.html, so nothing an admin did on the FAQ page ever
   showed up here. They now come from /api/faq.

   Two things worth knowing:

   The order is the one the arrow buttons set in the admin
   panel. The API sends it as "order"; the column behind it
   is display_order.

   The category tabs are built from the categories actually
   present in the data. They used to be hardcoded as
   Volunteering / Donations / Schools & Partners / General,
   while the admin dropdown offered Programmes instead of
   Schools & Partners — so a Programmes question had no tab
   to appear under. Building them from the data means the two
   sides can't drift apart again.
========================================================== */

(function () {

    "use strict";

    var list   = document.getElementById("faqList");
    var tabs   = document.getElementById("faqTabs");
    var search = document.getElementById("faqSearch");
    var empty  = document.getElementById("faqEmpty");
    var count  = document.getElementById("faqCount");

    if (!list) return;

    var items     = [];
    var activeCat = "all";

    function esc(str) {
        var div = document.createElement("div");
        div.textContent = str == null ? "" : str;
        return div.innerHTML;
    }

    /* ======================================================
       BUILD FROM THE API
    ====================================================== */

    function buildTabs(categories) {

        var buttons = ['<button class="faq-tab active" data-cat="all" aria-pressed="true">All</button>'];

        categories.forEach(function (c) {
            buttons.push(
                '<button class="faq-tab" data-cat="' + esc(c) + '" aria-pressed="false">' +
                esc(c) + '</button>'
            );
        });

        tabs.innerHTML = buttons.join("");
    }

    function buildList(rows) {

        list.innerHTML = rows.map(function (q) {

            var category = q.category || "General";

            return '' +
                '<div class="faq-item" data-cat="' + esc(category) + '">' +

                    '<button class="faq-question" aria-expanded="false">' +
                        '<span>' +
                            '<span class="faq-cat">' + esc(category.toUpperCase()) + '</span>' +
                            esc(q.question) +
                        '</span>' +
                        '<span class="faq-icon"><i class="fa-solid fa-plus" aria-hidden="true"></i></span>' +
                    '</button>' +

                    '<div class="faq-answer">' +
                        '<div class="faq-answer-inner">' + esc(q.answer) + '</div>' +
                    '</div>' +

                '</div>';

        }).join("");

        items = Array.prototype.slice.call(list.querySelectorAll(".faq-item"));
    }

    /* ======================================================
       ACCORDION

       Heights come from scrollHeight, so a long answer can't
       be clipped by a fixed max-height.
    ====================================================== */

    function closeItem(item) {

        item.classList.remove("open");

        var answer   = item.querySelector(".faq-answer");
        var question = item.querySelector(".faq-question");

        if (answer)   answer.style.maxHeight = "0px";
        if (question) question.setAttribute("aria-expanded", "false");
    }

    function openItem(item) {

        item.classList.add("open");

        var answer   = item.querySelector(".faq-answer");
        var question = item.querySelector(".faq-question");

        if (answer)   answer.style.maxHeight = answer.scrollHeight + "px";
        if (question) question.setAttribute("aria-expanded", "true");
    }

    function wireAccordion() {

        items.forEach(function (item) {

            closeItem(item);

            var question = item.querySelector(".faq-question");
            if (!question) return;

            question.addEventListener("click", function () {

                var wasOpen = item.classList.contains("open");

                items.forEach(closeItem);

                if (!wasOpen) openItem(item);
            });

        });
    }

    window.addEventListener("resize", function () {

        var open = list.querySelector(".faq-item.open .faq-answer");

        if (open) open.style.maxHeight = open.scrollHeight + "px";
    });

    /* ======================================================
       FILTER + SEARCH
    ====================================================== */

    function apply() {

        var term    = (search ? search.value : "").trim().toLowerCase();
        var visible = 0;

        items.forEach(function (item) {

            var matchesCat  = activeCat === "all" || item.dataset.cat === activeCat;
            var matchesTerm = term === "" ||
                item.textContent.toLowerCase().indexOf(term) !== -1;

            if (matchesCat && matchesTerm) {
                item.classList.remove("hidden");
                visible++;
            } else {
                item.classList.add("hidden");
                closeItem(item);
            }

        });

        if (empty) empty.classList.toggle("show", visible === 0);

        if (count) {
            count.textContent = visible === 0
                ? ""
                : "Showing " + visible + " question" + (visible === 1 ? "" : "s");
        }
    }

    if (tabs) {

        tabs.addEventListener("click", function (e) {

            var tab = e.target.closest(".faq-tab");
            if (!tab) return;

            tabs.querySelectorAll(".faq-tab").forEach(function (t) {
                t.classList.remove("active");
                t.setAttribute("aria-pressed", "false");
            });

            tab.classList.add("active");
            tab.setAttribute("aria-pressed", "true");

            activeCat = tab.dataset.cat;
            apply();
        });

    }

    if (search) {

        search.addEventListener("input", apply);

        search.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
                search.value = "";
                apply();
            }
        });

    }

    /* ======================================================
       LOAD
    ====================================================== */

    CSStore.find("faq")
        .then(function (rows) {

            /* The admin arrow buttons set this. A missing order sinks to
               the bottom rather than breaking the sort. */
            rows.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

            var seen = [];
            rows.forEach(function (q) {
                var c = q.category || "General";
                if (seen.indexOf(c) === -1) seen.push(c);
            });

            buildTabs(seen);
            buildList(rows);
            wireAccordion();
            apply();

            if (!rows.length && empty) {
                empty.classList.add("show");
            }
        })
        .catch(function (err) {
            console.error("FAQ failed to load:", err);
            if (empty) {
                empty.textContent = "The questions can't be loaded right now. Please try again shortly.";
                empty.classList.add("show");
            }
        });

}());
