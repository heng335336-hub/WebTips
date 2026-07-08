document.addEventListener("DOMContentLoaded", () => {

  const EDIT_PASSCODE = "HengLim";

  const STORAGE_KEY = "cardCatalogGuides_v1";
  const EDIT_SESSION_KEY = "cardCatalogEditUnlocked";

  const DEFAULT_GUIDES = [
    {
      id: 1,
      title: "Open the Run Dialog",
      category: "shortcuts",
      tags: "windows, run, dialog, keyboard, shortcut",
      summary: "Jump straight to launching an app, folder, or command without touching the mouse.",
      steps: ["Press Win + R", "Type a command, e.g. notepad or %temp%", "Press Enter"],
      note: "Tip: \\\\server\\share also works here for jumping to a network path."
    },
    {
      id: 2,
      title: "Lock Your Screen Instantly",
      category: "shortcuts",
      tags: "windows, lock, screen, keyboard, security",
      summary: "Step away from your desk without leaving your session exposed.",
      steps: ["Press Win + L", "Your screen locks immediately, apps keep running in the background"],
      note: "Works even mid-download or mid-render — nothing gets interrupted."
    },
    {
      id: 3,
      title: "How to Build Something (Starter Flow)",
      category: "build",
      tags: "project, setup, scaffolding, workflow",
      summary: "A generic scaffold for kicking off any new build — swap in your own steps as the project takes shape.",
      steps: [
        "Define the goal in one sentence — what does \"done\" look like?",
        "List the smallest working version you could ship today",
        "Set up the folder / repo and install core dependencies",
        "Build the smallest version end-to-end before polishing anything",
        "Test it, note what broke, repeat"
      ],
      note: "Duplicate this card and replace the steps with your actual build log."
    },
    {
      id: 4,
      title: "Reopen a Closed Tab",
      category: "tips",
      tags: "browser, tabs, productivity",
      summary: "Closed the wrong tab? Bring it right back without digging through history.",
      steps: ["Press Ctrl + Shift + T", "Repeat to keep restoring further back, one tab at a time"],
      note: ""
    },
    {
      id: 5,
      title: "Undo the Last Git Commit (Keep Changes)",
      category: "tools",
      tags: "git, undo, mistake, commit",
      summary: "Made a commit too early? Undo it but keep every file change staged.",
      steps: [
        "Open your terminal in the repo folder",
        "Run git reset --soft HEAD~1",
        "Your changes are back in the staging area, ready to re-commit"
      ],
      note: "Use --mixed instead of --soft if you also want files unstaged."
    }
  ];

  /* ---------- State ---------- */
  let guides = loadGuides();
  let isEditMode = sessionStorage.getItem(EDIT_SESSION_KEY) === "true";
  let activeFilter = "all";
  let activeQuery = "";

  /* ---------- DOM refs ---------- */
  const cardGrid = document.getElementById("cardGrid");
  const emptyState = document.getElementById("emptyState");
  const searchInput = document.getElementById("searchInput");
  const filterButtons = document.getElementById("filterButtons");

  const unlockBtn = document.getElementById("unlockBtn");
  const lockBtn = document.getElementById("lockBtn");
  const addBtn = document.getElementById("addBtn");

  const passcodeOverlay = document.getElementById("passcodeOverlay");
  const passcodeForm = document.getElementById("passcodeForm");
  const passcodeInput = document.getElementById("passcodeInput");
  const passcodeError = document.getElementById("passcodeError");
  const closePasscodeBtn = document.getElementById("closePasscodeBtn");

  const editorOverlay = document.getElementById("editorOverlay");
  const editorForm = document.getElementById("editorForm");
  const editorTitle = document.getElementById("editorTitle");
  const closeEditorBtn = document.getElementById("closeEditorBtn");
  const cancelEditorBtn = document.getElementById("cancelEditorBtn");

  const editId = document.getElementById("editId");
  const editTitle = document.getElementById("editTitle");
  const editCategory = document.getElementById("editCategory");
  const editTags = document.getElementById("editTags");
  const editSummary = document.getElementById("editSummary");
  const editNote = document.getElementById("editNote");
  const stepsEditor = document.getElementById("stepsEditor");
  const addStepBtn = document.getElementById("addStepBtn");
  const categoryList = document.getElementById("categoryList");

  const toast = document.getElementById("toast");
  let toastTimer = null;

  /* ---------- Storage helpers ---------- */
  function loadGuides() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* fall through to defaults */ }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_GUIDES));
    return JSON.parse(JSON.stringify(DEFAULT_GUIDES));
  }
  function saveGuides() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(guides));
  }
  function nextId() {
    return guides.reduce((max, g) => Math.max(max, g.id), 0) + 1;
  }

  /* ---------- Toast ---------- */
  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
  }

  /* ---------- Escaping ---------- */
  function esc(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  /* Renders inline <kbd> for things like "Win + R" and <code> for
     inline `backticks`-free tokens is intentionally kept simple:
     we just escape everything for safety and let plain text show. */
  function formatStepText(text) {
    return esc(text);
  }

  /* ---------- Category label formatting ---------- */
  function labelFor(category) {
    const map = { shortcuts: "Shortcuts", build: "Build Guide", tips: "Tip", tools: "Tool" };
    if (map[category]) return map[category];
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  /* ---------- Render filter buttons ---------- */
  function renderFilters() {
    const categories = Array.from(new Set(guides.map((g) => g.category))).sort();
    const all = ["all", ...categories];

    filterButtons.innerHTML = all.map((cat) => {
      const label = cat === "all" ? "All" : labelFor(cat);
      const isActive = cat === activeFilter;
      return `<button class="filter-btn${isActive ? " active" : ""}" data-filter="${esc(cat)}" type="button">${esc(label)}</button>`;
    }).join("");

    filterButtons.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeFilter = btn.dataset.filter;
        renderFilters();
        renderCards();
      });
    });

    categoryList.innerHTML = categories.map((c) => `<option value="${esc(c)}">`).join("");
  }

  /* ---------- Render cards ---------- */
  function renderCards() {
    const query = activeQuery;
    const filtered = guides.filter((g) => {
      const matchesFilter = activeFilter === "all" || g.category === activeFilter;
      const haystack = `${g.title} ${g.summary} ${g.tags}`.toLowerCase();
      const matchesQuery = query === "" || haystack.includes(query);
      return matchesFilter && matchesQuery;
    });

    emptyState.hidden = filtered.length !== 0;

    cardGrid.innerHTML = filtered.map((g, index) => {
      const catNum = String(g.id).padStart(3, "0");
      const stepsHtml = g.steps.map((s, i) =>
        `<li><span class="step-num">${i + 1}</span><span>${formatStepText(s)}</span></li>`
      ).join("");
      const noteHtml = g.note ? `<p class="card-note">${esc(g.note)}</p>` : "";

      return `
        <article class="guide-card" data-id="${g.id}" style="animation-delay:${Math.min(index * 0.05, 0.4)}s">
          <div class="card-tab">GDE ${catNum}</div>
          <div class="card-controls">
            <button class="icon-btn edit-card-btn" type="button" title="Edit" aria-label="Edit entry">&#9998;</button>
            <button class="icon-btn danger delete-card-btn" type="button" title="Delete" aria-label="Delete entry">&#128465;</button>
          </div>
          <header class="card-head">
            <h2>${esc(g.title)}</h2>
            <span class="card-cat">${esc(labelFor(g.category))}</span>
          </header>
          <p class="card-summary">${esc(g.summary)}</p>
          <div class="card-steps">
            <ol>${stepsHtml}</ol>
            ${noteHtml}
          </div>
          <button class="card-toggle" type="button" aria-expanded="false">Show steps</button>
        </article>
      `;
    }).join("");

    // Wire up per-card interactions
    cardGrid.querySelectorAll(".guide-card").forEach((card) => {
      const id = Number(card.dataset.id);

      card.querySelector(".card-toggle").addEventListener("click", (e) => {
        const expanded = card.classList.toggle("expanded");
        e.target.textContent = expanded ? "Hide steps" : "Show steps";
        e.target.setAttribute("aria-expanded", String(expanded));
      });

      const editBtn = card.querySelector(".edit-card-btn");
      const deleteBtn = card.querySelector(".delete-card-btn");
      if (editBtn) editBtn.addEventListener("click", () => openEditor(id));
      if (deleteBtn) deleteBtn.addEventListener("click", () => deleteGuide(id));
    });
  }

  /* ---------- Search ---------- */
  searchInput.addEventListener("input", (e) => {
    activeQuery = e.target.value.trim().toLowerCase();
    renderCards();
  });

  /* ---------- Edit mode toggling ---------- */
  function applyEditModeUI() {
    document.body.classList.toggle("edit-mode", isEditMode);
    unlockBtn.hidden = isEditMode;
    lockBtn.hidden = !isEditMode;
    addBtn.hidden = !isEditMode;
  }
  applyEditModeUI();

  unlockBtn.addEventListener("click", () => {
    passcodeError.hidden = true;
    passcodeInput.value = "";
    passcodeOverlay.hidden = false;
    passcodeInput.focus();
  });

  closePasscodeBtn.addEventListener("click", () => { passcodeOverlay.hidden = true; });
  passcodeOverlay.addEventListener("click", (e) => { if (e.target === passcodeOverlay) passcodeOverlay.hidden = true; });

  passcodeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (passcodeInput.value === EDIT_PASSCODE) {
      isEditMode = true;
      sessionStorage.setItem(EDIT_SESSION_KEY, "true");
      applyEditModeUI();
      passcodeOverlay.hidden = true;
      showToast("Editing unlocked");
    } else {
      passcodeError.hidden = false;
    }
  });

  lockBtn.addEventListener("click", () => {
    isEditMode = false;
    sessionStorage.removeItem(EDIT_SESSION_KEY);
    applyEditModeUI();
    showToast("Editing locked");
  });

  /* ---------- Steps editor (dynamic rows) ---------- */
  function addStepRow(value = "") {
    const row = document.createElement("div");
    row.className = "step-row";
    row.innerHTML = `
      <input type="text" class="text-input step-input" placeholder="Describe this step" value="${esc(value)}">
      <button type="button" class="step-remove" aria-label="Remove step">&times;</button>
    `;
    row.querySelector(".step-remove").addEventListener("click", () => row.remove());
    stepsEditor.appendChild(row);
  }
  addStepBtn.addEventListener("click", () => addStepRow());

  /* ---------- Add / Edit modal ---------- */
  function openEditor(id = null) {
    editorForm.reset();
    stepsEditor.innerHTML = "";

    if (id) {
      const guide = guides.find((g) => g.id === id);
      if (!guide) return;
      editorTitle.textContent = "Edit entry";
      editId.value = guide.id;
      editTitle.value = guide.title;
      editCategory.value = guide.category;
      editTags.value = guide.tags;
      editSummary.value = guide.summary;
      editNote.value = guide.note || "";
      guide.steps.forEach((s) => addStepRow(s));
      if (guide.steps.length === 0) addStepRow();
    } else {
      editorTitle.textContent = "New entry";
      editId.value = "";
      addStepRow();
      addStepRow();
    }

    editorOverlay.hidden = false;
    editTitle.focus();
  }

  function closeEditor() { editorOverlay.hidden = true; }

  addBtn.addEventListener("click", () => openEditor());
  closeEditorBtn.addEventListener("click", closeEditor);
  cancelEditorBtn.addEventListener("click", closeEditor);
  editorOverlay.addEventListener("click", (e) => { if (e.target === editorOverlay) closeEditor(); });

  editorForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const steps = Array.from(stepsEditor.querySelectorAll(".step-input"))
      .map((input) => input.value.trim())
      .filter((v) => v.length > 0);

    const guideData = {
      title: editTitle.value.trim(),
      category: editCategory.value.trim().toLowerCase(),
      tags: editTags.value.trim(),
      summary: editSummary.value.trim(),
      steps,
      note: editNote.value.trim()
    };

    if (editId.value) {
      const id = Number(editId.value);
      const idx = guides.findIndex((g) => g.id === id);
      if (idx !== -1) guides[idx] = { ...guides[idx], ...guideData };
      showToast("Entry updated");
    } else {
      guides.push({ id: nextId(), ...guideData });
      showToast("Entry added");
    }

    saveGuides();
    renderFilters();
    renderCards();
    closeEditor();
  });

  function deleteGuide(id) {
    const guide = guides.find((g) => g.id === id);
    if (!guide) return;
    const ok = window.confirm(`Delete "${guide.title}"? This can't be undone.`);
    if (!ok) return;
    guides = guides.filter((g) => g.id !== id);
    saveGuides();
    renderFilters();
    renderCards();
    showToast("Entry deleted");
  }

  /* ---------- Escape key closes any open modal ---------- */
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!passcodeOverlay.hidden) passcodeOverlay.hidden = true;
    if (!editorOverlay.hidden) closeEditor();
  });

  /* ---------- Initial render ---------- */
  renderFilters();
  renderCards();
});