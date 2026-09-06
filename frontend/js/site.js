/* ==========================================================
   CareSphere - site.js
   ----------------------------------------------------------
   Shared behaviour for every page:

     - mobile menu toggle
     - marks the current page in the nav automatically
     - smooth scrolling for in-page anchors
     - FAQ accordion
     - scroll reveal
     - number counters

   Load it on every page, before the page-specific script:

     <script src="../js/site.js"></script>
     <script src="../js/programs.js"></script>

   Every block checks that its elements exist first, so a page
   that has no FAQ (or no counters) simply skips that block.
========================================================== */

(function () {

    "use strict";

    var reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    /* ======================================================
       MOBILE MENU
    ====================================================== */

    function initMobileMenu() {

        var toggle = document.getElementById("navToggle");
        var menu = document.getElementById("mobileMenu");

        if (!toggle || !menu) {
            return;
        }

        function closeMenu() {
            menu.classList.remove("open");
            toggle.setAttribute("aria-expanded", "false");
            toggle.setAttribute("aria-label", "Open menu");
        }

        toggle.addEventListener("click", function () {

            var isOpen = menu.classList.toggle("open");

            toggle.setAttribute("aria-expanded", String(isOpen));
            toggle.setAttribute(
                "aria-label",
                isOpen ? "Close menu" : "Open menu"
            );

            /* reveal whichever group holds the current page */
            if (isOpen) {

                var current = menu.querySelector(".mobile-group-panel a.active");

                if (current) {

                    var panel = current.closest(".mobile-group-panel");
                    var groupToggle = panel.parentElement
                        .querySelector(".mobile-group-toggle");

                    panel.style.maxHeight = panel.scrollHeight + "px";

                    if (groupToggle) {
                        groupToggle.setAttribute("aria-expanded", "true");
                    }

                }

            }

        });

        menu.querySelectorAll("a").forEach(function (link) {
            link.addEventListener("click", closeMenu);
        });

        /* accordion groups - one section open at a time */
        var groups = menu.querySelectorAll(".mobile-group");

        groups.forEach(function (group) {

            var toggle = group.querySelector(".mobile-group-toggle");
            var panel = group.querySelector(".mobile-group-panel");

            if (!toggle || !panel) {
                return;
            }

            toggle.addEventListener("click", function () {

                var wasOpen = toggle.getAttribute("aria-expanded") === "true";

                groups.forEach(function (other) {
                    var t = other.querySelector(".mobile-group-toggle");
                    var pnl = other.querySelector(".mobile-group-panel");
                    if (t) { t.setAttribute("aria-expanded", "false"); }
                    if (pnl) { pnl.style.maxHeight = "0px"; }
                });

                if (!wasOpen) {
                    toggle.setAttribute("aria-expanded", "true");
                    panel.style.maxHeight = panel.scrollHeight + "px";
                }

            });

        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && menu.classList.contains("open")) {
                closeMenu();
                toggle.focus();
            }
        });

        window.addEventListener("resize", function () {
            if (window.innerWidth > 1020) {
                closeMenu();
            }
        });

    }

    /* ======================================================
       DESKTOP DROPDOWNS
       Hover to preview, click or keyboard to pin open. Closing
       on Escape and on outside click keeps it keyboard-usable.
    ====================================================== */

    function initDropdowns() {

        var items = document.querySelectorAll(".site-header .has-dropdown");

        if (!items.length) {
            return;
        }

        function closeAll(except) {

            items.forEach(function (item) {

                if (item === except) {
                    return;
                }

                item.classList.remove("open");

                var toggle = item.querySelector(".dropdown-toggle");

                if (toggle) {
                    toggle.setAttribute("aria-expanded", "false");
                }

            });

        }

        items.forEach(function (item) {

            var toggle = item.querySelector(".dropdown-toggle");

            if (!toggle) {
                return;
            }

            item.addEventListener("mouseenter", function () {
                if (window.innerWidth > 1020) {
                    closeAll(item);
                    item.classList.add("open");
                    toggle.setAttribute("aria-expanded", "true");
                }
            });

            item.addEventListener("mouseleave", function () {
                if (window.innerWidth > 1020) {
                    item.classList.remove("open");
                    toggle.setAttribute("aria-expanded", "false");
                }
            });

            toggle.addEventListener("click", function (e) {

                e.stopPropagation();

                var isOpen = item.classList.contains("open");

                closeAll();

                if (!isOpen) {
                    item.classList.add("open");
                    toggle.setAttribute("aria-expanded", "true");
                } else {
                    toggle.setAttribute("aria-expanded", "false");
                }

            });

        });

        document.addEventListener("click", function () {
            closeAll();
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
                closeAll();
            }
        });

    }

    /* ======================================================
       ACTIVE NAV LINK
       Highlights whichever nav link matches the current file,
       so no page can ever get it wrong by hand.
    ====================================================== */

    function initActiveLink() {

        var here = window.location.pathname.split("/").pop() || "index.html";

        document
            .querySelectorAll(".site-header .nav-links a, .site-header .dropdown a, .mobile-menu a")
            .forEach(function (link) {

                var target = link.getAttribute("href");

                if (!target) {
                    return;
                }

                target = target.split("#")[0];

                if (target === here) {

                    link.classList.add("active");
                    link.setAttribute("aria-current", "page");

                    /* light up the parent dropdown too, so people can
                       see which section they are in */
                    var parent = link.closest(".has-dropdown");

                    if (parent) {
                        var toggle = parent.querySelector(".dropdown-toggle");
                        if (toggle) {
                            toggle.classList.add("active");
                        }
                    }

                } else {
                    link.classList.remove("active");
                    link.removeAttribute("aria-current");
                }

            });

    }

    /* ======================================================
       SMOOTH ANCHOR SCROLL
       Offset by the fixed header so headings aren't hidden.
    ====================================================== */

    function initAnchorScroll() {

        var header = document.querySelector(".site-header");
        var offset = header ? header.offsetHeight + 10 : 0;

        document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {

            anchor.addEventListener("click", function (e) {

                var id = this.getAttribute("href");

                if (!id || id === "#") {
                    return;
                }

                var target = document.querySelector(id);

                if (!target) {
                    return;
                }

                e.preventDefault();

                var top =
                    target.getBoundingClientRect().top +
                    window.pageYOffset -
                    offset;

                window.scrollTo({
                    top: top,
                    behavior: reduceMotion ? "auto" : "smooth"
                });

            });

        });

    }

    /* ======================================================
       FAQ ACCORDION
    ====================================================== */

    function initFaq() {

        var items = document.querySelectorAll(".faq-item");

        if (!items.length) {
            return;
        }

        items.forEach(function (item) {

            var question = item.querySelector(".faq-question");
            var answer = item.querySelector(".faq-answer");

            if (!question || !answer) {
                return;
            }

            answer.style.maxHeight = "0px";
            question.setAttribute("aria-expanded", "false");

            question.addEventListener("click", function () {

                var isOpen = item.classList.contains("active");

                /* Close every panel first - one open at a time. */
                items.forEach(function (other) {

                    other.classList.remove("active");

                    var otherAnswer = other.querySelector(".faq-answer");
                    var otherQuestion = other.querySelector(".faq-question");

                    if (otherAnswer) {
                        otherAnswer.style.maxHeight = "0px";
                    }

                    if (otherQuestion) {
                        otherQuestion.setAttribute("aria-expanded", "false");
                    }

                });

                if (!isOpen) {
                    item.classList.add("active");
                    /* scrollHeight, so long answers are never clipped */
                    answer.style.maxHeight = answer.scrollHeight + "px";
                    question.setAttribute("aria-expanded", "true");
                }

            });

        });

        /* Keep the open panel the right height if the text reflows. */
        window.addEventListener("resize", function () {

            var open = document.querySelector(".faq-item.active .faq-answer");

            if (open) {
                open.style.maxHeight = open.scrollHeight + "px";
            }

        });

    }

    /* ======================================================
       SCROLL REVEAL
       Usage from a page script:  CareSphere.reveal(".event-card")
    ====================================================== */

    function reveal(selector, options) {

        var items = document.querySelectorAll(selector);

        if (!items.length) {
            return;
        }

        if (reduceMotion || !("IntersectionObserver" in window)) {
            return;
        }

        var settings = options || {};
        var distance = settings.distance || "30px";
        var duration = settings.duration || ".6s";

        var observer = new IntersectionObserver(
            function (entries) {

                entries.forEach(function (entry) {

                    if (!entry.isIntersecting) {
                        return;
                    }

                    entry.target.style.opacity = "1";
                    entry.target.style.transform = "none";

                    observer.unobserve(entry.target);

                });

            },
            { threshold: settings.threshold || 0.15 }
        );

        items.forEach(function (item) {

            item.style.opacity = "0";
            item.style.transform = "translateY(" + distance + ")";
            item.style.transition =
                "opacity " + duration + " ease, transform " + duration + " ease";

            observer.observe(item);

        });

    }

    /* ======================================================
       COUNTERS
       Works with either <h2 class="counter" data-target="5000">
       or plain text like "15K+" / "850+".
    ====================================================== */

    function countUp(selector) {

        var counters = document.querySelectorAll(selector);

        if (!counters.length) {
            return;
        }

        counters.forEach(function (counter) {

            var raw = counter.dataset.target || counter.textContent;
            var digits = String(raw).replace(/[^0-9]/g, "");

            if (!digits) {
                return;
            }

            var target = parseInt(digits, 10);

            /* Suffix such as "K+" or "+", taken from the original text. */
            var suffix = counter.dataset.target
                ? "+"
                : String(raw).replace(/[0-9\s]/g, "");

            counter.dataset.finalText = target.toLocaleString() + suffix;

            if (reduceMotion || !("IntersectionObserver" in window)) {
                counter.textContent = counter.dataset.finalText;
                return;
            }

            counter.textContent = "0" + suffix;

            var observer = new IntersectionObserver(
                function (entries) {

                    entries.forEach(function (entry) {

                        if (!entry.isIntersecting) {
                            return;
                        }

                        observer.unobserve(entry.target);

                        var start = null;
                        var duration = 1600;

                        function step(timestamp) {

                            if (start === null) {
                                start = timestamp;
                            }

                            var progress = Math.min(
                                (timestamp - start) / duration,
                                1
                            );

                            /* ease-out so it settles rather than stops dead */
                            var eased = 1 - Math.pow(1 - progress, 3);
                            var value = Math.floor(eased * target);

                            entry.target.textContent =
                                value.toLocaleString() + suffix;

                            if (progress < 1) {
                                requestAnimationFrame(step);
                            } else {
                                entry.target.textContent =
                                    entry.target.dataset.finalText;
                            }

                        }

                        requestAnimationFrame(step);

                    });

                },
                { threshold: 0.4 }
            );

            observer.observe(counter);

        });

    }

    /* ======================================================
       PUBLIC API + BOOT
    ====================================================== */

    window.CareSphere = {
        reveal: reveal,
        countUp: countUp
    };

    document.addEventListener("DOMContentLoaded", function () {

        initMobileMenu();
        initDropdowns();
        initActiveLink();
        initAnchorScroll();
        initFaq();

    });

}());
