const activeRealVersionId = 'r-1779874252541';
const r_version_id = 'r-1779874252541';
const matchesBudget = false;
const matchesReal = activeRealVersionId && r_version_id === activeRealVersionId;
console.log("matchesReal:", matchesReal);
console.log("condition (!matchesBudget && !matchesReal):", (!matchesBudget && !matchesReal));
