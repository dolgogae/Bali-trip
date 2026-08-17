(function () {
  "use strict";

  const filters = Array.from(document.querySelectorAll("[data-filter]"));
  const days = Array.from(document.querySelectorAll(".day[data-tags]"));
  const emptyState = document.getElementById("filter-empty");
  const copyButton = document.getElementById("copy-itinerary");
  const printButton = document.getElementById("print-itinerary");
  const toast = document.getElementById("toast");
  let toastTimer;

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
