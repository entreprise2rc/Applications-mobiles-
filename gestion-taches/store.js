// Couche de données : logique pure de gestion des tâches, sans dépendance au DOM.
(function (global) {
  "use strict";

  const STORAGE_KEY = "gestion-taches:v1";
  const PRIORITIES = { haute: 0, moyenne: 1, basse: 2 };

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function todayISO(now = new Date()) {
    const d = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 10);
  }

  function createStore(storage) {
    let tasks = load();
    const listeners = new Set();

    function load() {
      try {
        const raw = storage && storage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }

    function save() {
      try {
        storage && storage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      } catch (e) {
        /* stockage indisponible : on continue en mémoire */
      }
      listeners.forEach((fn) => fn(tasks));
    }

    function normalize(data) {
      const title = String(data.title || "").trim();
      if (!title) throw new Error("Le titre est obligatoire.");
      return {
        title: title.slice(0, 200),
        notes: String(data.notes || "").trim().slice(0, 2000),
        priority: PRIORITIES.hasOwnProperty(data.priority) ? data.priority : "moyenne",
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(data.dueDate || "") ? data.dueDate : "",
        category: String(data.category || "").trim().slice(0, 40),
      };
    }

    return {
      all() {
        return tasks.slice();
      },
      get(id) {
        return tasks.find((t) => t.id === id) || null;
      },
      add(data) {
        const task = {
          id: uid(),
          ...normalize(data),
          done: false,
          createdAt: new Date().toISOString(),
          completedAt: null,
        };
        tasks.unshift(task);
        save();
        return task;
      },
      update(id, data) {
        const task = tasks.find((t) => t.id === id);
        if (!task) return null;
        Object.assign(task, normalize({ ...task, ...data }));
        save();
        return task;
      },
      toggle(id) {
        const task = tasks.find((t) => t.id === id);
        if (!task) return null;
        task.done = !task.done;
        task.completedAt = task.done ? new Date().toISOString() : null;
        save();
        return task;
      },
      remove(id) {
        const index = tasks.findIndex((t) => t.id === id);
        if (index === -1) return null;
        const [removed] = tasks.splice(index, 1);
        save();
        return { task: removed, index };
      },
      restore(task, index) {
        tasks.splice(Math.min(index, tasks.length), 0, task);
        save();
      },
      clearCompleted() {
        const count = tasks.filter((t) => t.done).length;
        tasks = tasks.filter((t) => !t.done);
        save();
        return count;
      },
      categories() {
        return [...new Set(tasks.map((t) => t.category).filter(Boolean))].sort((a, b) =>
          a.localeCompare(b, "fr")
        );
      },
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    };
  }

  /**
   * Filtre et trie une liste de tâches.
   * filter : "toutes" | "actives" | "aujourdhui" | "terminees"
   * sort   : "echeance" | "priorite" | "recentes"
   */
  function query(tasks, { filter = "toutes", search = "", category = "", sort = "echeance" } = {}, now = new Date()) {
    const today = todayISO(now);
    const q = search.trim().toLocaleLowerCase("fr");

    const result = tasks.filter((t) => {
      if (filter === "actives" && t.done) return false;
      if (filter === "terminees" && !t.done) return false;
      if (filter === "aujourdhui" && (t.done || !t.dueDate || t.dueDate > today)) return false;
      if (category && t.category !== category) return false;
      if (q && !(t.title + " " + t.notes + " " + t.category).toLocaleLowerCase("fr").includes(q)) return false;
      return true;
    });

    const byDue = (a, b) => (a.dueDate || "9999") .localeCompare(b.dueDate || "9999");
    const byPrio = (a, b) => PRIORITIES[a.priority] - PRIORITIES[b.priority];
    const byRecent = (a, b) => b.createdAt.localeCompare(a.createdAt);

    result.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1; // tâches terminées en bas
      if (sort === "priorite") return byPrio(a, b) || byDue(a, b) || byRecent(a, b);
      if (sort === "recentes") return byRecent(a, b);
      return byDue(a, b) || byPrio(a, b) || byRecent(a, b);
    });
    return result;
  }

  function stats(tasks, now = new Date()) {
    const today = todayISO(now);
    const total = tasks.length;
    const done = tasks.filter((t) => t.done).length;
    const overdue = tasks.filter((t) => !t.done && t.dueDate && t.dueDate < today).length;
    return { total, done, active: total - done, overdue, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  function dueStatus(task, now = new Date()) {
    if (!task.dueDate || task.done) return "";
    const today = todayISO(now);
    if (task.dueDate < today) return "en-retard";
    if (task.dueDate === today) return "aujourdhui";
    return "a-venir";
  }

  const api = { createStore, query, stats, dueStatus, todayISO, PRIORITIES, STORAGE_KEY };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.TaskStore = api;
})(typeof window !== "undefined" ? window : globalThis);
