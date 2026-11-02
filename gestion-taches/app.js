// Interface utilisateur : relie la couche de données (store.js) au DOM.
(function () {
  "use strict";

  const { createStore, query, stats, dueStatus, todayISO } = window.TaskStore;
  const store = createStore(safeStorage());
  const $ = (sel) => document.querySelector(sel);

  const PREFS_KEY = "gestion-taches:prefs";
  const state = Object.assign(
    { filter: "toutes", search: "", category: "", sort: "echeance", theme: "" },
    readPrefs()
  );

  const els = {
    list: $("#task-list"),
    empty: $("#empty-state"),
    emptyText: $("#empty-text"),
    clearCompleted: $("#clear-completed"),
    search: $("#search"),
    categoryFilter: $("#category-filter"),
    sort: $("#sort"),
    dialog: $("#task-dialog"),
    form: $("#task-form"),
    dialogTitle: $("#dialog-title"),
    deleteBtn: $("#delete-btn"),
    datalist: $("#category-options"),
    toast: $("#toast"),
    toastText: $("#toast-text"),
    toastAction: $("#toast-action"),
  };

  let editingId = null;
  let toastTimer = null;
  let toastUndo = null;

  // ---------- Utilitaires ----------
  function safeStorage() {
    try {
      const k = "__test__";
      localStorage.setItem(k, k);
      localStorage.removeItem(k);
      return localStorage;
    } catch (e) {
      return null;
    }
  }

  function readPrefs() {
    try {
      return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function savePrefs() {
    try {
      const { sort, theme } = state;
      localStorage.setItem(PREFS_KEY, JSON.stringify({ sort, theme }));
    } catch (e) {}
  }

  function formatDue(iso) {
    const today = todayISO();
    const tomorrow = todayISO(new Date(Date.now() + 86400000));
    const yesterday = todayISO(new Date(Date.now() - 86400000));
    if (iso === today) return "Aujourd'hui";
    if (iso === tomorrow) return "Demain";
    if (iso === yesterday) return "Hier";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: y !== new Date().getFullYear() ? "numeric" : undefined,
    });
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k === "html") node.innerHTML = v; // uniquement pour des icônes statiques
      else node.setAttribute(k, v);
    }
    children.forEach((c) => c && node.appendChild(c));
    return node;
  }

  const CHECK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';

  // ---------- Rendu ----------
  function renderTask(task) {
    const status = dueStatus(task);
    const meta = el("div", { class: "task-meta" }, [
      task.dueDate
        ? el("span", {
            class: "tag due " + status,
            text: (status === "en-retard" ? "En retard · " : "") + formatDue(task.dueDate),
          })
        : null,
      task.category ? el("span", { class: "tag", text: task.category }) : null,
    ]);

    return el("li", { class: "task" + (task.done ? " done" : ""), "data-id": task.id, "data-priority": task.priority }, [
      el("button", {
        class: "check",
        "data-action": "toggle",
        "aria-label": (task.done ? "Marquer comme à faire : " : "Marquer comme terminée : ") + task.title,
        "aria-pressed": String(task.done),
        html: CHECK_ICON,
      }),
      el("button", { class: "task-body", "data-action": "edit", "aria-label": "Modifier : " + task.title }, [
        el("div", { class: "task-title", text: task.title }),
        task.notes ? el("div", { class: "task-notes", text: task.notes }) : null,
        meta.childNodes.length ? meta : null,
      ]),
    ]);
  }

  function renderStats() {
    const s = stats(store.all());
    $("#stat-active").textContent = s.active;
    $("#stat-done").textContent = s.done;
    $("#stat-overdue").textContent = s.overdue;
    $("#progress-percent").textContent = s.percent + "%";
    $("#progress-ring").style.setProperty("--p", s.percent);
    els.clearCompleted.hidden = s.done === 0;
  }

  function renderCategories() {
    const cats = store.categories();
    if (state.category && !cats.includes(state.category)) state.category = "";

    els.categoryFilter.replaceChildren(
      el("option", { value: "", text: "Toutes les catégories" }),
      ...cats.map((c) => el("option", { value: c, text: c }))
    );
    els.categoryFilter.value = state.category;
    els.categoryFilter.hidden = cats.length === 0;
    els.datalist.replaceChildren(...cats.map((c) => el("option", { value: c })));
  }

  function render() {
    renderCategories();
    const tasks = query(store.all(), state);
    els.list.replaceChildren(...tasks.map(renderTask));

    els.empty.hidden = tasks.length > 0;
    if (!tasks.length) {
      els.emptyText.textContent = store.all().length === 0
        ? "Aucune tâche pour le moment. Appuyez sur + pour commencer."
        : state.search
          ? "Aucune tâche ne correspond à votre recherche."
          : {
              actives: "Bravo, tout est fait ! 🎉",
              aujourdhui: "Rien de prévu pour aujourd'hui.",
              terminees: "Aucune tâche terminée.",
            }[state.filter] || "Aucune tâche dans cette vue.";
    }

    document.querySelectorAll(".filters button").forEach((b) => {
      b.setAttribute("aria-selected", String(b.dataset.filter === state.filter));
    });
    renderStats();
  }

  // ---------- Dialogue d'édition ----------
  function openDialog(task) {
    editingId = task ? task.id : null;
    els.form.reset();
    els.dialogTitle.textContent = task ? "Modifier la tâche" : "Nouvelle tâche";
    els.deleteBtn.hidden = !task;
    if (task) {
      els.form.elements.title.value = task.title;
      els.form.elements.notes.value = task.notes;
      els.form.elements.dueDate.value = task.dueDate;
      els.form.elements.category.value = task.category;
      els.form.querySelector(`input[name="priority"][value="${task.priority}"]`).checked = true;
    } else if (state.filter === "aujourdhui") {
      els.form.elements.dueDate.value = todayISO();
    }
    if (!task && state.category) els.form.elements.category.value = state.category;
    els.dialog.showModal();
    els.form.elements.title.focus();
  }

  function closeDialog() {
    els.dialog.close();
    editingId = null;
  }

  // ---------- Notification avec annulation ----------
  function toast(message, undo) {
    clearTimeout(toastTimer);
    els.toastText.textContent = message;
    toastUndo = undo || null;
    els.toastAction.hidden = !undo;
    els.toast.hidden = false;
    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
      toastUndo = null;
    }, 4000);
  }

  function deleteTask(id) {
    const removed = store.remove(id);
    if (removed) toast("Tâche supprimée", () => store.restore(removed.task, removed.index));
  }

  // ---------- Événements ----------
  store.subscribe(render);

  $("#add-btn").addEventListener("click", () => openDialog(null));

  els.list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const id = btn.closest(".task").dataset.id;
    if (btn.dataset.action === "toggle") {
      const task = store.toggle(id);
      if (task && task.done && navigator.vibrate) navigator.vibrate(15);
    } else if (btn.dataset.action === "edit") {
      openDialog(store.get(id));
    }
  });

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(els.form));
    if (!data.title.trim()) {
      els.form.elements.title.focus();
      return;
    }
    if (editingId) store.update(editingId, data);
    else store.add(data);
    closeDialog();
  });

  $("#cancel-btn").addEventListener("click", closeDialog);
  els.deleteBtn.addEventListener("click", () => {
    const id = editingId;
    closeDialog();
    deleteTask(id);
  });
  // Fermer en touchant l'arrière-plan
  els.dialog.addEventListener("click", (e) => {
    if (e.target === els.dialog) closeDialog();
  });

  document.querySelector(".filters").addEventListener("click", (e) => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    state.filter = b.dataset.filter;
    render();
  });

  els.search.addEventListener("input", () => {
    state.search = els.search.value;
    render();
  });

  els.categoryFilter.addEventListener("change", () => {
    state.category = els.categoryFilter.value;
    render();
  });

  els.sort.addEventListener("change", () => {
    state.sort = els.sort.value;
    savePrefs();
    render();
  });

  els.clearCompleted.addEventListener("click", () => {
    const done = store.all().filter((t) => t.done).length;
    if (done && confirm(`Supprimer ${done} tâche(s) terminée(s) ?`)) {
      store.clearCompleted();
      toast(`${done} tâche(s) supprimée(s)`);
    }
  });

  els.toastAction.addEventListener("click", () => {
    if (toastUndo) toastUndo();
    toastUndo = null;
    els.toast.hidden = true;
  });

  // ---------- Thème ----------
  function applyTheme() {
    const dark = state.theme
      ? state.theme === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.querySelector('meta[name="theme-color"]').content = dark ? "#111218" : "#4f46e5";
  }
  $("#theme-toggle").addEventListener("click", () => {
    state.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    savePrefs();
    applyTheme();
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

  // ---------- Démarrage ----------
  $("#today-label").textContent = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  els.sort.value = state.sort;
  applyTheme();
  render();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
