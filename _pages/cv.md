---
layout: single
title: "CV"
permalink: /cv/
---

<div class="cv-page">
  <div class="cv-switcher" role="group" aria-label="CV language switcher">
    <button
      class="btn cv-switcher__button is-active"
      type="button"
      data-cv-target="/assets/cv/CV.pdf"
      data-cv-title="English CV PDF preview"
      aria-pressed="true">
      English CV
    </button>
    <button
      class="btn cv-switcher__button"
      type="button"
      data-cv-target="/assets/cv/cv%E4%B8%AD%E6%96%87.pdf"
      data-cv-title="Chinese CV PDF preview"
      aria-pressed="false">
      中文简历
    </button>
    <a class="cv-switcher__link" href="/assets/cv/CV.pdf" target="_blank" rel="noopener">
      Open English PDF
    </a>
    <a class="cv-switcher__link" href="/assets/cv/cv%E4%B8%AD%E6%96%87.pdf" target="_blank" rel="noopener">
      打开中文版 PDF
    </a>
  </div>

  <div class="cv-embed">
    <iframe
      class="cv-embed__frame"
      src="/assets/cv/CV.pdf"
      title="English CV PDF preview"
      loading="lazy">
    </iframe>
    <p class="cv-embed__fallback">
      Your browser does not support PDFs.
      <a href="/assets/cv/CV.pdf" target="_blank" rel="noopener">Open the English CV</a>
      or
      <a href="/assets/cv/cv%E4%B8%AD%E6%96%87.pdf" target="_blank" rel="noopener">open the Chinese CV</a>.
    </p>
  </div>
</div>

<script>
  (function () {
    var cvPage = document.querySelector(".cv-page");

    if (!cvPage) {
      return;
    }

    var frame = cvPage.querySelector(".cv-embed__frame");
    var buttons = cvPage.querySelectorAll(".cv-switcher__button");

    function activateButton(activeButton) {
      var target = activeButton.getAttribute("data-cv-target");
      var title = activeButton.getAttribute("data-cv-title");

      frame.setAttribute("src", target);
      frame.setAttribute("title", title);

      Array.prototype.forEach.call(buttons, function (button) {
        var isActive = button === activeButton;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    Array.prototype.forEach.call(buttons, function (button) {
      button.addEventListener("click", function () {
        activateButton(button);
      });
    });
  })();
</script>
