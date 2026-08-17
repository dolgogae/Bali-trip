(function () {
  "use strict";

  const filters = Array.from(document.querySelectorAll("[data-filter]"));
  const days = Array.from(document.querySelectorAll(".day[data-tags]"));
  const emptyState = document.getElementById("filter-empty");
  const copyButton = document.getElementById("copy-itinerary");
  const printButton = document.getElementById("print-itinerary");
  const toast = document.getElementById("toast");
  let toastTimer;

  const mapNode = document.getElementById("trip-map");
  if (mapNode && window.L) {
    const map = window.L.map(mapNode, {
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: true
    });

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);
    window.L.control.zoom({ position: "bottomright" }).addTo(map);

    const bases = [
      { number: "1", name: "Kima Surf Camp", area: "Seminyak · 20—25 AUG", coords: [-8.6907, 115.1624] },
      { number: "2", name: "Aviator Bali", area: "Berawa · Canggu · 25—27 AUG", coords: [-8.6615, 115.1422] },
      { number: "3", name: "Mantra Wellness Center", area: "Uluwatu · 27—29 AUG", coords: [-8.8155, 115.1080] }
    ];
    const spots = [
      { name: "Ngurah Rai Airport", type: "AIRPORT", kind: "airport", coords: [-8.7482, 115.1672] },
      { name: "BYND Fitness Club", type: "WORKOUT · SAT", kind: "workout", coords: [-8.6342, 115.1443] },
      { name: "Body Factory Bali", type: "WORKOUT · SUN", kind: "workout", coords: [-8.6560, 115.1349] },
      { name: "Wanderlust Fitness Village", type: "WORKOUT · TUE", kind: "workout", coords: [-8.6417, 115.1563] },
      { name: "Pucuk Bali Gym", type: "WORKOUT · FRI 07:00", kind: "workout", coords: [-8.6512, 115.1354] },
      { name: "Flowerboy Run Club", type: "RUN CLUB · WED 06:00", kind: "workout", coords: [-8.6410, 115.1124] },
      { name: "Bambu Fitness Bali", type: "WORKOUT · SAT", kind: "workout", coords: [-8.8126, 115.1194] }
    ];

    function popup(type, name, detail) {
      return `<div class="map-popup"><span>${type}</span><strong>${name}</strong><small>${detail}</small></div>`;
    }
    function baseIcon(number) {
      return window.L.divIcon({
        className: "route-pin-wrap",
        html: `<span class="route-pin"><span>${number}</span></span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 30],
        popupAnchor: [0, -28]
      });
    }
    function spotIcon(kind) {
      return window.L.divIcon({
        className: "spot-pin-wrap",
        html: `<span class="spot-pin ${kind}"></span>`,
        iconSize: [15, 15],
        iconAnchor: [8, 8],
        popupAnchor: [0, -9]
      });
    }

    bases.forEach((base) => {
      window.L.marker(base.coords, { icon: baseIcon(base.number), zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup(popup(`BASE ${base.number}`, base.name, base.area));
    });
    spots.forEach((spot) => {
      window.L.marker(spot.coords, { icon: spotIcon(spot.kind) })
        .addTo(map)
        .bindPopup(popup(spot.type, spot.name, "대략적인 위치"));
    });

    const airport = spots.find((spot) => spot.kind === "airport");
    const lastStop = spots.find((spot) => spot.name === "Bambu Fitness Bali");
    const route = [airport.coords, ...bases.map((base) => base.coords), lastStop.coords, airport.coords];
    window.L.polyline(route, {
      color: "#f06442",
      weight: 3,
      opacity: 0.9,
      dashArray: "7 9",
      lineCap: "round"
    }).addTo(map);
    map.fitBounds(window.L.latLngBounds([...bases, ...spots].map((place) => place.coords)), {
      padding: [42, 42]
    });
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 1800);
  }

  filters.forEach((button) => {
    button.addEventListener("click", () => {
      const selected = button.dataset.filter;
      filters.forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });

      let visible = 0;
      days.forEach((day) => {
        const tags = day.dataset.tags.split(" ");
        const show = selected === "all" || tags.includes(selected);
        day.hidden = !show;
        if (show) visible += 1;
      });
      emptyState.hidden = visible !== 0;
    });
  });

  copyButton.addEventListener("click", async () => {
    const lines = ["발리 일정 · 2026.08.20—29", ""];
    days.forEach((day) => {
      const date = day.querySelector(".date-block");
      const title = day.querySelector("h3");
      const events = Array.from(day.querySelectorAll(".event p"));
      lines.push(`${date.querySelector("strong").textContent} AUG ${date.querySelector(".weekday").textContent} · ${title.textContent}`);
      events.forEach((event) => lines.push(`- ${event.textContent.trim()}`));
      lines.push("");
    });

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      showToast("일정을 클립보드에 복사했어요");
    } catch (error) {
      showToast("복사할 수 없어요. 인쇄 기능을 이용해 주세요");
    }
  });

  printButton.addEventListener("click", () => window.print());
})();
