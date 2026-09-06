/* ==========================================================
   CareSphere - impact-dashboard.js
   ----------------------------------------------------------
   You didn't send an impact-dashboard.js, so this is one built
   against the markup in impact-dashboard.html: animated
   counters, three Chart.js charts, and the refresh button.
   If you already have one, keep yours - every id and class in
   the HTML is unchanged from what you sent.

   Figures are sample data. Swap fetchData() for a real API
   call when the backend is ready.
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
       COUNTERS
       Honours data-prefix and data-suffix, so the funds card
       renders as "₹182 L" rather than a bare number.
    ====================================================== */

    function runCounters() {

        var counters = document.querySelectorAll(".counter");

        if (!counters.length) {
            return;
        }

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
                    ticks: { color: PALETTE.text, font: { family: "Poppins", size: 12 } }
                }
            }
        };
    }

    function fetchData() {

        /* Replace with a real fetch() when the API exists. */
        return {
            funds: {
                labels: ["Feb", "Mar", "Apr", "May", "Jun", "Jul"],
                values: [96, 112, 128, 141, 165, 182]
            },
            volunteers: {
                labels: ["Q3 '25", "Q4 '25", "Q1 '26", "Q2 '26"],
                values: [3820, 4310, 5060, 5482]
            },
            projects: {
                labels: ["Education", "Healthcare", "Environment", "Community"],
                values: [14, 11, 13, 8]
            }
        };
    }

    function buildCharts() {

        if (typeof Chart === "undefined") {
            var note = document.getElementById("chartNote");
            if (note) {
                note.textContent = "Charts couldn't load - check your connection to the Chart.js CDN.";
            }
            return;
        }

        Chart.defaults.font.family = "Poppins, sans-serif";

        var data = fetchData();

        var fundsEl = document.getElementById("fundsChart");
        var volEl = document.getElementById("volunteersChart");
        var projEl = document.getElementById("projectsChart");

        if (fundsEl) {

            var ctx = fundsEl.getContext("2d");
            var fill = ctx.createLinearGradient(0, 0, 0, 260);
            fill.addColorStop(0, "rgba(231,143,129,.30)");
            fill.addColorStop(1, "rgba(231,143,129,.02)");

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
                options: baseOptions()
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
                    labels: data.projects.labels,
                    datasets: [{
                        data: data.projects.values,
                        backgroundColor: [
                            PALETTE.coral,
                            PALETTE.blue,
                            PALETTE.green,
                            PALETTE.peach
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

    /* ======================================================
       LAST UPDATED + REFRESH
    ====================================================== */

    function stamp() {

        var el = document.getElementById("lastUpdated");

        if (!el) {
            return;
        }

        el.textContent = new Date().toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit"
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

            window.setTimeout(function () {

                var data = fetchData();

                if (charts.funds) {
                    charts.funds.data.datasets[0].data = data.funds.values;
                    charts.funds.update();
                }

                if (charts.volunteers) {
                    charts.volunteers.data.datasets[0].data = data.volunteers.values;
                    charts.volunteers.update();
                }

                if (charts.projects) {
                    charts.projects.data.datasets[0].data = data.projects.values;
                    charts.projects.update();
                }

                stamp();

                btn.classList.remove("spinning");
                btn.disabled = false;

                if (note) {
                    note.textContent = "Up to date.";
                }

            }, 900);

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

        runCounters();
        buildCharts();
        stamp();
        initRefresh();
        initNewsletter();

        if (window.CareSphere) {
            window.CareSphere.reveal(".stat-card, .chart-card", { threshold: 0.1 });
        }

    });

}());
