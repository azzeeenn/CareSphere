/* ==========================================================
   CareSphere - faq.js
   ----------------------------------------------------------
   You didn't send a faq.js, so this is one built against the
   markup in faq.html: accordion, category tabs, live search.
   If you already have one, keep yours - every id and class in
   the HTML is unchanged from what you sent.
========================================================== */

(function () {

    "use strict";

    var list = document.getElementById("faqList");
    var tabs = document.getElementById("faqTabs");
    var search = document.getElementById("faqSearch");
    var empty = document.getElementById("faqEmpty");
    var count = document.getElementById("faqCount");

    if (!list) {
        return;
    }

    var items = Array.prototype.slice.call(list.querySelectorAll(".faq-item"));
    var activeCat = "all";

    /* ======================================================
       ACCORDION
       Heights come from scrollHeight, so a long answer can't
       be clipped by a fixed max-height.
    ====================================================== */

    function closeItem(item) {

        item.classList.remove("open");

        var answer = item.querySelector(".faq-answer");
        var question = item.querySelector(".faq-question");

        if (answer) {
            answer.style.maxHeight = "0px";
        }

        if (question) {
            question.setAttribute("aria-expanded", "false");
        }

    }

    function openItem(item) {

        item.classList.add("open");

        var answer = item.querySelector(".faq-answer");
        var question = item.querySelector(".faq-question");

        if (answer) {
            answer.style.maxHeight = answer.scrollHeight + "px";
        }

        if (question) {
            question.setAttribute("aria-expanded", "true");
        }

    }

    items.forEach(function (item) {

        closeItem(item);

        var question = item.querySelector(".faq-question");

        if (!question) {
            return;
        }

        question.addEventListener("click", function () {

            var wasOpen = item.classList.contains("open");

            items.forEach(closeItem);

            if (!wasOpen) {
                openItem(item);
            }

        });

    });

    window.addEventListener("resize", function () {

        var open = list.querySelector(".faq-item.open .faq-answer");

        if (open) {
            open.style.maxHeight = open.scrollHeight + "px";
        }

    });

    /* ======================================================
       FILTER + SEARCH
    ====================================================== */

    function apply() {

        var term = (search ? search.value : "").trim().toLowerCase();
        var visible = 0;

        items.forEach(function (item) {

            var matchesCat = activeCat === "all" || item.dataset.cat === activeCat;
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

        if (empty) {
            empty.classList.toggle("show", visible === 0);
        }

        if (count) {
            count.textContent = visible === 0
                ? ""
                : "Showing " + visible + " question" + (visible === 1 ? "" : "s");
        }

    }

    if (tabs) {

        tabs.addEventListener("click", function (e) {

            var tab = e.target.closest(".faq-tab");

            if (!tab) {
                return;
            }

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

    apply();

}());
