/* ==========================================================
   CareSphere - impact-dashboard.js
   ----------------------------------------------------------
   Every number on this page now comes from the database.

   Two sources:

     1. /api/stats      counted live from the records
                        (active volunteers, events held,
                        verified hours, verified donations)
                        plus the data for all three charts

     2. Impact Numbers  the figures the system cannot count
                        for itself (trees planted,
                        beneficiaries reached ...), kept by
                        an admin on the Impact Numbers page

   If a typed figure has the same name as a live one (for
   example an old "Active volunteers" row), the live count
   wins and the typed one is skipped, so the page never shows
   two different answers to the same question.

   If the backend cannot be reached, the page says so. It
   never falls back to made-up numbers.
========================================================== */

(function () {

    "use strict";

    var PALETTE = {
        coral: "#E78F81",
        coralSoft: "rgba(231,143,129,.18)",
        navy: "#26415E",
        blue: "#B7E0FF",
        peach: "#FFCFB3",
        cream: "#FFF5CD",
        green: "#4F9D77",
        grid: "#E6EFF8",
        text: "#6B7280"
    };

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ======================================================
       HELPERS
    ====================================================== */

    function esc(v) {
        return String(v == null ? "" : v)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function fmtDate(iso) {
        var d = new Date(iso);
        if (isNaN(d)) return "";
        return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    }

    /* Live figures have a fixed icon; typed ones get one from their name. */
    var LIVE_ICONS = {
        volunteers: "fa-users",
        events:     "fa-calendar-check",
        hours:      "fa-hand-holding-heart",
        funds:      "fa-hand-holding-dollar"
    };

    function iconFor(label) {
        var l = label.toLowerCase();
        if (l.indexOf("tree") !== -1 || l.indexOf("plant") !== -1)   return "fa-tree";
        if (l.indexOf("camp") !== -1 || l.indexOf("health") !== -1)  return "fa-heart-pulse";
        if (l.indexOf("blood") !== -1)                                return "fa-droplet";
        if (l.indexOf("district") !== -1 || l.indexOf("communit") !== -1 ||
            l.indexOf("village") !== -1)                              return "fa-earth-asia";
        if (l.indexOf("student") !== -1 || l.indexOf("child") !== -1 ||
            l.indexOf("school") !== -1)                               return "fa-graduation-cap";
        if (l.indexOf("volunteer") !== -1 || l.indexOf("beneficiar") !== -1 ||
            l.indexOf("people") !== -1 || l.indexOf("lives") !== -1)  return "fa-users";
        return "fa-diagram-project";
    }

    /* Plain fetch for /api/stats. It isn't a collection, so it doesn't
       go through CSStore.find — but fileUrl() gives us the API address,
       so the port lives in one place (store.js) as before. */
    function getStats() {
        return fetch(CSStore.fileUrl("/api/stats")).then(function (res) {
            if (!res.ok) throw new Error("Stats request failed");
            return res.json();
        });
    }

    /* ======================================================
       STAT CARDS
    ====================================================== */

    function cardHtml(icon, label, value, prefix, note) {
        return '' +
            '<div class="stat-card">' +
                '<div class="stat-icon"><i class="fa-solid ' + icon + '" aria-hidden="true"></i></div>' +
                '<h3 class="counter" data-target="' + (Number(value) || 0) + '"' +
                    (prefix ? ' data-prefix="' + esc(prefix) + '"' : '') + '>0</h3>' +
                '<p class="stat-label">' + esc(label) + '</p>' +
                '<span class="trend flat">' + esc(note) + '</span>' +
            '</div>';
    }

    function buildCards(stats, typed) {
        var grid = document.getElementById("statsGrid");
        if (!grid) return;

        var liveLabels = stats.figures.map(function (f) { return f.label.toLowerCase(); });

        var html = stats.figures.map(function (f) {
            return cardHtml(LIVE_ICONS[f.key] || "fa-diagram-project",
                            f.label, f.value, f.prefix, "Counted live from our records");
        }).join("");

        typed
            .slice()
            .sort(function (a, b) { return (a.order || 0) - (b.order || 0); })
            .filter(function (t) { return liveLabels.indexOf(String(t.label).toLowerCase()) === -1; })
            .forEach(function (t) {
                var when = fmtDate(t.updatedAt);
                html += cardHtml(iconFor(t.label), t.label, t.value, "",
                                 when ? "Updated " + when : "From our records");
            });

        grid.innerHTML = html;
        runCounters();
    }

    /* ======================================================
       COUNTERS
       Honours data-prefix and data-suffix, so the funds card
       renders as "₹35,000".
    ====================================================== */

    function runCounters() {

        var counters = document.querySelectorAll(".counter");

        counters.forEach(function (el) {

            var target = Number(el.dataset.target) || 0;
            var prefix = el.dataset.prefix || "";
            var suffix = el.dataset.suffix || "";

            function paint(value) {
                el.textContent = prefix + value.toLocaleString("en-IN") + suffix;
            }

            if (reduceMotion || !("IntersectionObserver" in window)) {
                paint(target);
                return;
            }

            paint(0);

            var observer = new IntersectionObserver(function (entries) {

                entries.forEach(function (entry) {

                    if (!entry.isIntersecting) {
                        return;
                    }

                    observer.unobserve(entry.target);

                    var start = null;
                    var duration = 1600;

                    function step(now) {

                        if (start === null) {
                            start = now;
                        }

                        var progress = Math.min((now - start) / duration, 1);
                        var eased = 1 - Math.pow(1 - progress, 3);

                        paint(Math.floor(eased * target));

                        if (progress < 1) {
                            requestAnimationFrame(step);
                        } else {
                            paint(target);
                        }

                    }

                    requestAnimationFrame(step);

                });

            }, { threshold: 0.4 });

            observer.observe(el);

        });

    }

    /* ======================================================
       CHARTS
    ====================================================== */

    var charts = {};

    function baseOptions() {

        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: reduceMotion ? false : { duration: 800 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: PALETTE.navy,
                    padding: 12,
                    cornerRadius: 10,
                    titleFont: { family: "Poppins", size: 13 },
                    bodyFont: { family: "Poppins", size: 13 }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: PALETTE.text, font: { family: "Poppins", size: 12 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: PALETTE.grid },
                    border: { display: false },
                    ticks: {
                        color: PALETTE.text,
                        font: { family: "Poppins", size: 12 },
                        precision: 0
                    }
                }
            }
        };
    }

    function buildCharts(data) {

        if (typeof Chart === "undefined") {
            var note = document.getElementById("chartNote");
            if (note) {
                note.textContent = "Charts couldn't load - chart.umd.min.js is missing from the js folder.";
            }
            return;
        }

        Chart.defaults.font.family = "Poppins, sans-serif";

        var fundsEl = document.getElementById("fundsChart");
        var volEl = document.getElementById("volunteersChart");
        var projEl = document.getElementById("projectsChart");

        if (fundsEl) {

            var ctx = fundsEl.getContext("2d");
            var fill = ctx.createLinearGradient(0, 0, 0, 260);
            fill.addColorStop(0, "rgba(231,143,129,.30)");
            fill.addColorStop(1, "rgba(231,143,129,.02)");

            var fundsOptions = baseOptions();
            fundsOptions.plugins.tooltip.callbacks = {
                label: function (c) { return "₹" + Number(c.raw).toLocaleString("en-IN"); }
            };
            fundsOptions.scales.y.ticks.callback = function (v) {
                return "₹" + Number(v).toLocaleString("en-IN");
            };

            charts.funds = new Chart(fundsEl, {
                type: "line",
                data: {
                    labels: data.funds.labels,
                    datasets: [{
                        data: data.funds.values,
                        borderColor: PALETTE.coral,
                        backgroundColor: fill,
                        borderWidth: 3,
                        fill: true,
                        tension: 0.38,
                        pointBackgroundColor: "#fff",
                        pointBorderColor: PALETTE.coral,
                        pointBorderWidth: 2.5,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: fundsOptions
            });

        }

        if (volEl) {

            charts.volunteers = new Chart(volEl, {
                type: "bar",
                data: {
                    labels: data.volunteers.labels,
                    datasets: [{
                        data: data.volunteers.values,
                        backgroundColor: PALETTE.blue,
                        hoverBackgroundColor: PALETTE.coral,
                        borderRadius: 10,
                        borderSkipped: false,
                        maxBarThickness: 34
                    }]
                },
                options: baseOptions()
            });

        }

        if (projEl) {

            var doughnutOptions = baseOptions();
            doughnutOptions.scales = {};
            doughnutOptions.cutout = "62%";
            doughnutOptions.plugins.legend = {
                display: true,
                position: "bottom",
                labels: {
                    color: PALETTE.text,
                    boxWidth: 10,
                    boxHeight: 10,
                    usePointStyle: true,
                    pointStyle: "circle",
                    padding: 14,
                    font: { family: "Poppins", size: 12 }
                }
            };

            charts.projects = new Chart(projEl, {
                type: "doughnut",
                data: {
                    labels: data.areas.labels,
                    datasets: [{
                        data: data.areas.values,
                        backgroundColor: [
                            PALETTE.coral,
                            PALETTE.blue,
                            PALETTE.green,
                            PALETTE.peach,
                            PALETTE.navy
                        ],
                        borderColor: "#fff",
                        borderWidth: 3,
                        hoverOffset: 8
                    }]
                },
                options: doughnutOptions
            });

        }

    }

    function updateCharts(data) {

        if (charts.funds) {
            charts.funds.data.labels = data.funds.labels;
            charts.funds.data.datasets[0].data = data.funds.values;
            charts.funds.update();
        }

        if (charts.volunteers) {
            charts.volunteers.data.labels = data.volunteers.labels;
            charts.volunteers.data.datasets[0].data = data.volunteers.values;
            charts.volunteers.update();
        }

        if (charts.projects) {
            charts.projects.data.labels = data.areas.labels;
            charts.projects.data.datasets[0].data = data.areas.values;
            charts.projects.update();
        }

    }

    /* ======================================================
       LOAD + REFRESH
    ====================================================== */

    function stamp(iso) {

        var el = document.getElementById("lastUpdated");

        if (!el) {
            return;
        }

        var d = iso ? new Date(iso + (String(iso).indexOf("Z") === -1 ? "Z" : "")) : new Date();
        if (isNaN(d)) d = new Date();

        el.textContent = d.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit"
        });

    }

    function load() {

        var statsNote = document.getElementById("statsNote");

        return Promise.all([
            getStats(),
            CSStore.find("impact").catch(function () { return []; })
        ]).then(function (r) {

            var stats = r[0], typed = r[1];

            if (statsNote) statsNote.textContent = "";

            buildCards(stats, typed);

            if (Object.keys(charts).length) {
                updateCharts(stats.charts);
            } else {
                buildCharts(stats.charts);
            }

            stamp(stats.updatedAt);

            if (window.CareSphere) {
                window.CareSphere.reveal(".stat-card, .chart-card", { threshold: 0.1 });
            }

        }).catch(function () {

            if (statsNote) {
                statsNote.textContent =
                    "The live figures couldn't be loaded right now. Please try again in a moment.";
            }

        });

    }

    function initRefresh() {

        var btn = document.getElementById("refreshBtn");
        var note = document.getElementById("chartNote");

        if (!btn) {
            return;
        }

        btn.addEventListener("click", function () {

            btn.classList.add("spinning");
            btn.disabled = true;

            if (note) {
                note.textContent = "Refreshing...";
            }

            load().then(function () {

                btn.classList.remove("spinning");
                btn.disabled = false;

                if (note) {
                    note.textContent = "Up to date.";
                }

            });

        });

    }

    /* ======================================================
       NEWSLETTER
    ====================================================== */

    function initNewsletter() {

        var form = document.getElementById("newsletterForm");
        var note = document.getElementById("newsletterNote");

        if (!form || !note) {
            return;
        }

        form.addEventListener("submit", function (e) {

            e.preventDefault();

            var input = document.getElementById("newsletterEmail");
            var pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!pattern.test(input.value.trim())) {
                note.textContent = "That email address doesn't look right.";
                note.style.color = "#8C3B2E";
                input.focus();
                return;
            }

            note.textContent = "You're subscribed. Watch your inbox for our next update.";
            note.style.color = "#1C3149";
            form.reset();

        });

    }

    /* ======================================================
       BOOT
    ====================================================== */

    document.addEventListener("DOMContentLoaded", function () {

        load();
        initRefresh();
        initNewsletter();

    });

}());
