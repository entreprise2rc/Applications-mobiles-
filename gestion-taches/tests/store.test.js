// Tests unitaires de la couche de données : node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert");
const { createStore, query, stats, dueStatus } = require("../store.js");

function memoryStorage() {
  const data = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = String(v)) };
}

test("ajout, persistance et rechargement", () => {
  const storage = memoryStorage();
  const s = createStore(storage);
  const t = s.add({ title: "  Acheter du pain  ", priority: "haute", category: "Courses" });
  assert.strictEqual(t.title, "Acheter du pain");
  assert.strictEqual(t.done, false);
  const reloaded = createStore(storage);
  assert.strictEqual(reloaded.all().length, 1);
  assert.deepStrictEqual(reloaded.categories(), ["Courses"]);
});

test("titre obligatoire et valeurs invalides normalisées", () => {
  const s = createStore(memoryStorage());
  assert.throws(() => s.add({ title: "   " }));
  const t = s.add({ title: "x", priority: "urgent", dueDate: "demain" });
  assert.strictEqual(t.priority, "moyenne");
  assert.strictEqual(t.dueDate, "");
});

test("basculer, modifier, supprimer et restaurer", () => {
  const s = createStore(memoryStorage());
  const a = s.add({ title: "A" });
  s.add({ title: "B" });
  assert.strictEqual(s.toggle(a.id).done, true);
  assert.ok(s.get(a.id).completedAt);
  s.update(a.id, { title: "A modifiée" });
  assert.strictEqual(s.get(a.id).title, "A modifiée");
  const removed = s.remove(a.id);
  assert.strictEqual(s.all().length, 1);
  s.restore(removed.task, removed.index);
  assert.strictEqual(s.all()[removed.index].id, a.id);
  assert.strictEqual(s.clearCompleted(), 1);
  assert.strictEqual(s.all().length, 1);
});

test("stockage corrompu ignoré", () => {
  const storage = memoryStorage();
  storage.setItem("gestion-taches:v1", "{pas du json");
  assert.deepStrictEqual(createStore(storage).all(), []);
});

test("filtres, recherche et tri", () => {
  const now = new Date(2026, 10, 2, 12);
  const mk = (o) => ({ notes: "", category: "", dueDate: "", priority: "moyenne", done: false, createdAt: "2026-01-01", ...o });
  const tasks = [
    mk({ id: "1", title: "Rapport", dueDate: "2026-11-05", priority: "basse", category: "Travail" }),
    mk({ id: "2", title: "Médecin", dueDate: "2026-11-01", priority: "haute" }),
    mk({ id: "3", title: "Sport", dueDate: "2026-11-02", done: true }),
    mk({ id: "4", title: "Lire", createdAt: "2026-02-01" }),
  ];
  const ids = (opts) => query(tasks, opts, now).map((t) => t.id);
  assert.deepStrictEqual(ids({}), ["2", "1", "4", "3"]);
  assert.deepStrictEqual(ids({ filter: "actives" }), ["2", "1", "4"]);
  assert.deepStrictEqual(ids({ filter: "aujourdhui" }), ["2"]);
  assert.deepStrictEqual(ids({ filter: "terminees" }), ["3"]);
  assert.deepStrictEqual(ids({ search: "MÉDECIN" }), ["2"]);
  assert.deepStrictEqual(ids({ category: "Travail" }), ["1"]);
  assert.deepStrictEqual(ids({ sort: "priorite" }), ["2", "4", "1", "3"]);
  assert.deepStrictEqual(ids({ sort: "recentes" }), ["4", "1", "2", "3"]);

  assert.deepStrictEqual(stats(tasks, now), { total: 4, done: 1, active: 3, overdue: 1, percent: 25 });
  assert.strictEqual(dueStatus(tasks[1], now), "en-retard");
  assert.strictEqual(dueStatus(mk({ dueDate: "2026-11-02" }), now), "aujourdhui");
  assert.strictEqual(dueStatus(tasks[0], now), "a-venir");
});
