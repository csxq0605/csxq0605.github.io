---
layout: single
title: "CV"
permalink: /cv/
---

<style>
  .cv-page {
    max-width: 1120px;
    margin: 0 auto;
    padding: 0.5rem 0 1.5rem;
  }

  .cv-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }

  .cv-switcher {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .cv-switcher__button {
    appearance: none;
    border: 1px solid #d0d7de;
    background: #f6f8fa;
    color: #24292f;
    border-radius: 999px;
    padding: 0.7rem 1.15rem;
    font-size: 0.95rem;
    line-height: 1;
    cursor: pointer;
    transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  }

  .cv-switcher__button:hover,
  .cv-switcher__button:focus,
  .cv-switcher__button.is-active {
    background: #224b8d;
    border-color: #224b8d;
    color: #fff;
    outline: none;
  }

  .cv-toolbar__link {
    font-size: 0.95rem;
    white-space: nowrap;
  }

  .cv-embed {
    width: 100%;
    height: min(88vh, 1180px);
    min-height: 900px;
    border: 1px solid #d8dee4;
    border-radius: 18px;
    overflow: hidden;
    background: #fff;
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
  }

  .cv-embed__frame {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    background: #fff;
  }

  .cv-note {
    margin-top: 0.75rem;
    color: #57606a;
    font-size: 0.92rem;
  }

  @media (max-width: 767px) {
    .cv-page {
      padding-top: 0;
    }

    .cv-embed {
      min-height: 72vh;
      height: 72vh;
      border-radius: 14px;
    }

    .cv-toolbar__link {
      white-space: normal;
    }
  }
</style>

<div class="cv-page">
  <div class="cv-toolbar">
    <div class="cv-switcher" role="group" aria-label="CV language switcher">
      <button
        class="cv-switcher__button is-active"
        type="button"
        data-cv-target="/assets/cv/CV.pdf#view=FitH"
        data-cv-download="/assets/cv/CV.pdf"
        data-cv-title="English CV PDF preview"
        data-cv-open-label="Open English PDF in a new tab"
        aria-pressed="true">
        English CV
      </button>
      <button
        class="cv-switcher__button"
        type="button"
        data-cv-target="/assets/cv/cv%E4%B8%AD%E6%96%87.pdf#view=FitH"
        data-cv-download="/assets/cv/cv%E4%B8%AD%E6%96%87.pdf"
        data-cv-title="Chinese CV PDF preview"
        data-cv-open-label="在新标签页打开中文版 PDF"
        aria-pressed="false">
        中文简历
      </button>
    </div>

    <a
      class="cv-toolbar__link"
      id="cv-open-link"
      href="/assets/cv/CV.pdf"
      target="_blank"
      rel="noopener">
      Open English PDF in a new tab
    </a>
  </div>

  <div class="cv-embed">
    <iframe
      class="cv-embed__frame"
      src="/assets/cv/CV.pdf#view=FitH"
      title="English CV PDF preview"
      loading="lazy"
      width="100%"
      height="100%">
    </iframe>
  </div>
  <p class="cv-note">If the embedded preview looks odd in your browser, use the link on the right to open the current PDF directly.</p>
</div>

<script>
  (function () {
    var cvPage = document.querySelector(".cv-page");

    if (!cvPage) {
      return;
    }

    var frame = cvPage.querySelector(".cv-embed__frame");
    var buttons = cvPage.querySelectorAll(".cv-switcher__button");
    var openLink = cvPage.querySelector("#cv-open-link");

    function activateButton(activeButton) {
      var target = activeButton.getAttribute("data-cv-target");
      var downloadTarget = activeButton.getAttribute("data-cv-download");
      var title = activeButton.getAttribute("data-cv-title");
      var openLabel = activeButton.getAttribute("data-cv-open-label");

      frame.setAttribute("src", target);
      frame.setAttribute("title", title);
      openLink.setAttribute("href", downloadTarget);
      openLink.textContent = openLabel;

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
