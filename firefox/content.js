/**
 * oHRis - Différentiel cumulé
 * Content script injecté sur https://ohris.ut-capitole.fr/fr/time/sheet/*
 *
 * Parcourt les lignes tr.work de la feuille de temps, lit la cellule
 * "Différentiel" (dernier td de chaque ligne), additionne les minutes
 * signées, et affiche un bandeau fixe avec le total. Colore aussi
 * chaque cellule journalière en vert/rouge.
 */

(function () {
  "use strict";

  const BANNER_ID = "ohris-diff-banner";
  const BANNER_TEXT_ID = "ohris-diff-banner-text";
  const EXIT_BUTTON_ID = "ohris-exit-time-btn";
  const OBSERVED_FLAG = "ohrisDiffObserved";
  // Bonus quotidien crédité automatiquement, à déduire du temps restant à faire.
  const DAILY_BONUS_MINUTES = 30;

  /**
   * Convertit une chaîne du type "7h13", "- 0h17", "0h22" ou "" en minutes signées.
   * Retourne 0 si la chaîne est vide, absente, ou non reconnue.
   */
  function parseHoursToMinutes(str) {
    if (!str) return 0;
    const trimmed = str.trim();
    if (trimmed === "") return 0;

    const isNegative = trimmed.includes("-");
    const match = trimmed.match(/(\d+)\s*h\s*(\d+)/i);
    if (!match) return 0;

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;

    const total = hours * 60 + minutes;
    return isNegative ? -total : total;
  }

  /**
   * Reconvertit un total signé de minutes en chaîne "+2h05" / "-1h45" / "+0h00".
   */
  function formatMinutes(totalMinutes) {
    const sign = totalMinutes < 0 ? "-" : "+";
    const abs = Math.abs(totalMinutes);
    const hours = Math.floor(abs / 60);
    const minutes = abs % 60;
    const minutesStr = String(minutes).padStart(2, "0");
    return `${sign}${hours}h${minutesStr}`;
  }

  /**
   * Convertit une heure "HH:MM" ou "HH:MM:SS" (valeur d'un input[type=time],
   * qui inclut les secondes si l'attribut step le permet) en minutes depuis minuit.
   */
  function timeStrToMinutes(str) {
    const match = (str || "").match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return null;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }

  /**
   * Reconvertit des minutes depuis minuit en chaîne "HH:MM".
   */
  function minutesToTimeStr(totalMinutes) {
    const normalized = ((totalMinutes % 1440) + 1440) % 1440;
    const hours = Math.floor(normalized / 60);
    const minutes = normalized % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  /**
   * Formate la date du jour en français, ex. "21 juillet 2026".
   */
  function getTodayFrenchLabel() {
    return new Date().toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  /**
   * Formate la date du jour en "AAAA-MM-JJ" (heure locale, pas d'UTC)
   * pour matcher l'id des lignes tr.work (td-AAAA-MM-JJ).
   */
  function getTodayIsoDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Récupère la cellule "Différentiel" d'une ligne (dernier td).
   */
  function getDiffCell(row) {
    const cells = row.querySelectorAll("td");
    if (!cells.length) return null;
    return cells[cells.length - 1];
  }

  /**
   * Colore une cellule différentiel selon son signe.
   */
  function colorDiffCell(cell, minutes, rawText) {
    cell.classList.remove("ohris-diff-positive", "ohris-diff-negative");
    if (!rawText || rawText.trim() === "") return;
    if (minutes < 0) {
      cell.classList.add("ohris-diff-negative");
    } else {
      cell.classList.add("ohris-diff-positive");
    }
  }

  /**
   * Crée (si nécessaire) et met à jour le bandeau fixe affichant le total,
   * avec un bouton pour calculer l'heure de sortie visant 0 de différentiel cumulé.
   */
  function updateBanner(totalMinutes) {
    let banner = document.getElementById(BANNER_ID);
    if (!banner) {
      banner = document.createElement("div");
      banner.id = BANNER_ID;

      const text = document.createElement("span");
      text.id = BANNER_TEXT_ID;
      banner.appendChild(text);

      const button = document.createElement("button");
      button.id = EXIT_BUTTON_ID;
      button.type = "button";
      button.textContent = "Heure de sortie pour 0h00 →";
      button.addEventListener("click", onExitButtonClick);
      banner.appendChild(button);

      document.body.appendChild(banner);
    }

    const text = document.getElementById(BANNER_TEXT_ID);
    text.textContent = `Différentiel cumulé : ${formatMinutes(totalMinutes)}`;

    banner.classList.remove("ohris-diff-positive", "ohris-diff-negative");
    banner.classList.add(totalMinutes < 0 ? "ohris-diff-negative" : "ohris-diff-positive");
  }

  /**
   * Somme les différentiels de tous les tr.work SAUF celui d'aujourd'hui
   * (son différentiel n'est pas fiable tant que la journée n'est pas terminée).
   */
  function getCumulativeDiffExcludingToday() {
    const todayRowId = `td-${getTodayIsoDate()}`;
    const rows = document.querySelectorAll("tr.work");
    let total = 0;

    rows.forEach((row) => {
      if (row.id === todayRowId) return;
      const cell = getDiffCell(row);
      if (!cell) return;
      total += parseHoursToMinutes(cell.textContent || "");
    });

    return total;
  }

  /**
   * Récupère le Théorique (en minutes) du jour en cours depuis la ligne tr.work
   * correspondante (lien a.theoricalColumn). Retourne null si la ligne/le lien
   * n'est pas trouvé (ex. jour non travaillé).
   */
  function getTodayTheoreticalMinutes() {
    const todayRowId = `td-${getTodayIsoDate()}`;
    const row = document.getElementById(todayRowId);
    if (!row) return null;

    const link = row.querySelector("a.theoricalColumn");
    if (!link) return null;

    return parseHoursToMinutes(link.textContent || "");
  }

  /**
   * Ouvre le modal "Contrôle des pointages - [date du jour]", attend son
   * affichage, lit les input[type=time], referme le modal sans rien modifier,
   * et retourne le tableau des heures pointées ("HH:MM") dans l'ordre.
   * Retourne null si le lien ou le modal n'est pas trouvé.
   */
  async function readTodayPunches() {
    const label = getTodayFrenchLabel();
    const expectedTitle = `Contrôle des pointages - ${label}`;

    const link = [...document.querySelectorAll("a")].find(
      (a) => (a.getAttribute("title") || "") === expectedTitle
    );
    if (!link) return null;

    link.click();

    const modal = await waitForVisibleModal();
    if (!modal) return null;

    try {
      const inputs = await waitForPunchInputs(modal);
      const times = [...inputs]
        .map((input) => input.value)
        .filter((value) => timeStrToMinutes(value) !== null);
      return times;
    } finally {
      closeModal(modal);
    }
  }

  /**
   * Attend qu'un .modal devienne visible (display: block), jusqu'à ~4s.
   */
  function waitForVisibleModal() {
    return new Promise((resolve) => {
      const maxAttempts = 20;
      let attempts = 0;

      const check = () => {
        const modal = [...document.querySelectorAll(".modal")].find(
          (m) => getComputedStyle(m).display === "block"
        );
        if (modal) {
          resolve(modal);
          return;
        }
        attempts += 1;
        if (attempts >= maxAttempts) {
          resolve(null);
          return;
        }
        setTimeout(check, 200);
      };

      check();
    });
  }

  /**
   * Le tableau des pointages (#punch_manage_punches_tbody) est peuplé en AJAX
   * après l'affichage du modal. Attend que les input[type=time] soient présents
   * dans le DOM, jusqu'à ~4s, avant de les lire.
   */
  function waitForPunchInputs(modal) {
    const scopedSelector = "#punch_manage_punches_tbody input[type=\"time\"]";
    const fallbackSelector = 'input[type="time"]';

    return new Promise((resolve) => {
      const maxAttempts = 20;
      let attempts = 0;

      const check = () => {
        const scoped = modal.querySelectorAll(scopedSelector);
        if (scoped.length > 0) {
          resolve(scoped);
          return;
        }

        attempts += 1;
        if (attempts >= maxAttempts) {
          resolve(modal.querySelectorAll(fallbackSelector));
          return;
        }
        setTimeout(check, 200);
      };

      check();
    });
  }

  /**
   * Referme un modal ouvert en cliquant son bouton "Fermer", sans rien enregistrer.
   */
  function closeModal(modal) {
    const closeButton = [...modal.querySelectorAll("button")].find(
      (btn) => (btn.textContent || "").trim() === "Fermer"
    );
    if (closeButton) {
      closeButton.click();
    }
  }

  /**
   * À partir de la liste des pointages du jour ("HH:MM" dans l'ordre),
   * calcule le temps déjà travaillé aujourd'hui (paires entrée/sortie complètes)
   * et, si une session est en cours (nombre de pointages impair), l'heure
   * de reprise de cette session (dernier pointage).
   */
  function analyzePunches(punchStrings) {
    const punchMinutes = punchStrings.map(timeStrToMinutes);
    let alreadyWorkedMinutes = 0;

    for (let i = 0; i + 1 < punchMinutes.length; i += 2) {
      alreadyWorkedMinutes += punchMinutes[i + 1] - punchMinutes[i];
    }

    const isSessionOpen = punchMinutes.length % 2 === 1;
    const openSessionStart = isSessionOpen ? punchMinutes[punchMinutes.length - 1] : null;

    return { alreadyWorkedMinutes, isSessionOpen, openSessionStart };
  }

  /**
   * Gère le clic sur "Heure de sortie pour 0h00 →" : lit les pointages du jour
   * via le modal, calcule l'heure de sortie visant un différentiel cumulé à 0,
   * et l'affiche dans le bandeau.
   */
  async function onExitButtonClick() {
    const button = document.getElementById(EXIT_BUTTON_ID);
    const text = document.getElementById(BANNER_TEXT_ID);
    if (!button || !text) return;

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Calcul en cours…";

    try {
      const punches = await readTodayPunches();

      if (!punches) {
        text.textContent += " — impossible d'ouvrir le contrôle des pointages du jour.";
        return;
      }

      const theoreticalMinutes = getTodayTheoreticalMinutes();
      if (theoreticalMinutes === null) {
        text.textContent += " — Théorique du jour introuvable.";
        return;
      }

      if (punches.length === 0) {
        text.textContent += " — aucun pointage trouvé aujourd'hui.";
        return;
      }

      const { alreadyWorkedMinutes, isSessionOpen, openSessionStart } = analyzePunches(punches);

      if (!isSessionOpen) {
        text.textContent += " — nombre de pointages pair : dernière session déjà clôturée (pause ou fin de journée), pas de sortie attendue pour l'instant.";
        return;
      }

      const otherDaysDiff = getCumulativeDiffExcludingToday();
      const neededWorkedToday = theoreticalMinutes - otherDaysDiff;
      const remainingMinutes = neededWorkedToday - alreadyWorkedMinutes - DAILY_BONUS_MINUTES;
      const exitMinutes = openSessionStart + remainingMinutes;

      text.textContent += ` — sortie pour 0h00 cumulé : ${minutesToTimeStr(exitMinutes)}`;
    } catch (err) {
      text.textContent += " — erreur lors du calcul (voir la console).";
      console.error("[oHRis Différentiel] Erreur calcul heure de sortie :", err);
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }

  /**
   * Calcule le différentiel cumulé à partir des lignes tr.work et met à jour le DOM.
   * N'affiche/ne modifie rien si aucune ligne n'est trouvée.
   */
  function computeAndRender() {
    const rows = document.querySelectorAll("tr.work");
    if (!rows.length) return;

    let total = 0;

    rows.forEach((row) => {
      const cell = getDiffCell(row);
      if (!cell) return;

      const rawText = cell.textContent || "";
      const minutes = parseHoursToMinutes(rawText);

      colorDiffCell(cell, minutes, rawText);
      total += minutes;
    });

    updateBanner(total);
  }

  /**
   * Met en place un MutationObserver sur le tableau pour recalculer
   * automatiquement lorsque le contenu change (chargement asynchrone).
   */
  function observeTable() {
    const table = document.querySelector("table");
    if (!table) return false;

    if (table.dataset[OBSERVED_FLAG] === "true") return true;
    table.dataset[OBSERVED_FLAG] = "true";

    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(computeAndRender, 150);
    });

    observer.observe(table, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return true;
  }

  /**
   * Initialisation : tente immédiatement, puis réessaie tant que le tableau
   * n'est pas encore présent (chargement asynchrone de la page oHRis).
   */
  function init() {
    computeAndRender();
    const observed = observeTable();

    if (!observed) {
      // Le tableau n'est pas encore dans le DOM : on réessaie périodiquement
      // pendant un temps limité, sans jamais casser la page.
      let attempts = 0;
      const maxAttempts = 40; // ~20s à 500ms d'intervalle
      const retryInterval = setInterval(() => {
        attempts += 1;
        computeAndRender();
        if (observeTable() || attempts >= maxAttempts) {
          clearInterval(retryInterval);
        }
      }, 500);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
