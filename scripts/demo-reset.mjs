// Removes everything the demo seed created (accounts, suppliers, categories,
// jobs, and their activity). Safe to run any time; leaves your real data alone.
import { db, loadState, clearState, cleanup } from "./demo-lib.mjs";

const s = db();

// Cleans by tracked state AND by markers (DEMO-* jobs, demo-named suppliers,
// demo-numbered users) — so it works even if the state file is missing.
console.log("Removing demo data…");
await cleanup(s, loadState());
clearState();
console.log("Done. All demo accounts, suppliers, categories, and jobs have been removed.");
