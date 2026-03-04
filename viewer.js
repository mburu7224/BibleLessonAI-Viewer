import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  getDocs,
  orderBy,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

// Viewer-local config to avoid cross-file/module path issues on static hosting.
const firebaseConfig = {
  apiKey: "AIzaSyD_AnGX-RO7zfM_rCBopJmdv3BOVE4V-_o",
  authDomain: "media-app-a702b.firebaseapp.com",
  projectId: "media-app-a702b",
  storageBucket: "media-app-a702b.firebasestorage.app",
  messagingSenderId: "60484045851",
  appId: "1:60484045851:web:f1bb588c2d5edc177ffcbe",
  measurementId: "G-LPBXF7MLWF"
};

const appSettings = {
  projectsCollection: "BibleLessonSlides",
  liveCollection: "BibleLessonSlides",
  defaultThemeId: 1
};

const TEST_ADMIN_KEY = "NewRuiruMediaKey2025!";

const THEMES = {
  1: "theme-1",
  2: "theme-2",
  3: "theme-3"
};

const fallbackProject = {
  id: "demo-public-project",
  mainTopic: "TRIALS",
  lessonDate: "February 27, 2021",
  creatorId: "demo",
  isPublic: true,
  themeId: 1,
  pptxUrl: "",
  slides: [
    {
      type: "question",
      question: "What may the followers of Yahshua expect in this world?",
      answer: "John 16:33",
      notes: "Remind audience about courage in tribulations.",
      themeId: 1
    },
    {
      type: "memoryVerse",
      question: "Memory Verse",
      answer: "James 1:12",
      notes: "Blessed is the one who perseveres under trial.",
      themeId: 1
    },
    {
      type: "note",
      question: "Application",
      answer: "Faith grows through testing.",
      notes: "Invite short testimonies.",
      themeId: 1
    }
  ]
};

const state = {
  projects: [],
  project: null,
  currentSlideIndex: 0,
  mode: "audience",
  liveUnsubscribe: null,
  timerInterval: null,
  timerSeconds: 0
};

const refs = {
  connectionStatus: document.getElementById("connectionStatus"),
  projectList: document.getElementById("projectList"),
  displayMode: document.getElementById("displayMode"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  slideCard: document.getElementById("slideCard"),
  mainTopic: document.getElementById("mainTopic"),
  subtopicBlock: document.getElementById("subtopicBlock"),
  subtopic: document.getElementById("subtopic"),
  lessonDate: document.getElementById("lessonDate"),
  slideBody: document.getElementById("slideBody"),
  slideCounter: document.getElementById("slideCounter"),
  presenterPanel: document.getElementById("presenterPanel"),
  nextPreview: document.getElementById("nextPreview"),
  presenterNotes: document.getElementById("presenterNotes"),
  timerDisplay: document.getElementById("timerDisplay"),
  timerToggleBtn: document.getElementById("timerToggleBtn")
};

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

initialize();

async function initialize() {
  bindGlobalErrorLogging();

  try {
    console.info("[Viewer] Booting", {
      host: window.location.host,
      path: window.location.pathname,
      projectsCollection: appSettings.projectsCollection
    });
    bindEvents();
    await loadPublicProjects();
    applyModeUI();
  } catch (error) {
    logFirebaseError("initialize", error);
    refs.connectionStatus.textContent = "Viewer failed to initialize. Check browser console logs.";
  }
}

function bindEvents() {
  refs.prevBtn.addEventListener("click", () => stepSlide(-1));
  refs.nextBtn.addEventListener("click", () => stepSlide(1));
  refs.displayMode.addEventListener("change", handleModeChange);
  refs.downloadBtn.addEventListener("click", handleDownload);
  refs.timerToggleBtn.addEventListener("click", toggleTimer);
}

async function loadPublicProjects() {
  refs.connectionStatus.textContent = "Loading saved projects...";

  try {
    const projectsRef = collection(db, appSettings.projectsCollection);
    let snapshot;

    // Ordered query for all saved projects.
    // If indexes are not configured yet, fallback query below keeps setup friction low.
    try {
      const q = query(projectsRef, orderBy("createdAt", "desc"));
      snapshot = await getDocs(q);
    } catch {
      snapshot = await getDocs(projectsRef);
    }

    state.projects = snapshot.docs.map((projectDoc) => ({
      id: projectDoc.id,
      ...projectDoc.data()
    }));

    if (!state.projects.length) {
      state.projects = [fallbackProject];
      refs.connectionStatus.textContent = "No saved projects found in Firestore. Showing demo data.";
    } else {
      refs.connectionStatus.textContent = `Loaded ${state.projects.length} saved project(s).`;
    }
  } catch (error) {
    logFirebaseError("loadPublicProjects", error);
    state.projects = [fallbackProject];
    const code = error?.code ? ` (${error.code})` : "";
    refs.connectionStatus.textContent = `Firestore unavailable${code}. Showing demo data.`;
    showConnectionHints(error);
  }

  renderProjectList();

  if (state.projects[0]) {
    selectProject(state.projects[0].id);
  }
}

function renderProjectList() {
  refs.projectList.innerHTML = "";

  state.projects.forEach((project) => {
    const li = document.createElement("li");
    li.className = `project-item ${state.project?.id === project.id ? "active" : ""}`;
    li.innerHTML = `
      <h4>${escapeHtml(project.mainTopic || "Untitled Topic")}</h4>
      <p>${escapeHtml(project.lessonDate || "No date")}</p>
      <p>${(project.slides || []).length} slides</p>
    `;
    li.addEventListener("click", () => selectProject(project.id));
    refs.projectList.appendChild(li);
  });
}

function selectProject(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) {
    return;
  }

  state.project = project;
  state.currentSlideIndex = 0;
  renderProjectList();
  renderSlide();
  updateDownloadState();
  setupLiveMode();
}

function renderSlide() {
  if (!state.project) {
    return;
  }

  const slides = state.project.slides || [];
  const slide = slides[state.currentSlideIndex] || {
    type: "note",
    question: "No slide data",
    answer: "",
    notes: ""
  };

  const mainTopic = state.project.mainTopic || "Untitled Topic";
  const lessonDate = state.project.lessonDate || "No date";
  const subtopic = state.project.subtopic || "";

  refs.mainTopic.textContent = mainTopic;
  refs.subtopic.textContent = subtopic || "-";
  refs.lessonDate.textContent = lessonDate;
  refs.subtopicBlock.classList.toggle("subtopic-hidden", !subtopic);

  refs.slideCounter.textContent = `Slide ${Math.min(state.currentSlideIndex + 1, slides.length)} / ${slides.length}`;

  const themeId = slide.themeId || state.project.themeId || appSettings.defaultThemeId;
  refs.slideCard.className = `slide-card ${THEMES[themeId] || THEMES[1]}`;
  refs.slideCard.classList.toggle("title-mode", slide.type === "title");
  refs.slideBody.innerHTML = buildSlideBodyMarkup(slide, state.currentSlideIndex);

  refs.prevBtn.disabled = state.currentSlideIndex <= 0;
  refs.nextBtn.disabled = state.currentSlideIndex >= slides.length - 1;

  renderPresenterMeta();
}

function buildSlideBodyMarkup(slide, index) {
  const type = slide.type || "question";

  if (type === "title") {
    return `
      <div class="title-body">
        <div>
          <h1 class="title-topic">${escapeHtml(slide.question || state.project.mainTopic || "Untitled Topic")}</h1>
          <p class="title-date">${escapeHtml(slide.answer || state.project.lessonDate || "No date")}</p>
        </div>
      </div>
    `;
  }

  if (type === "scriptureMemory") {
    const scriptureReading = slide.scriptureReading || splitTwin(slide.answer).scripture || "";
    const memoryVerse = slide.memoryVerse || splitTwin(slide.answer).memory || "";
    return `
      <div class="question-wrap">
        <div class="question-number">SM</div>
        <div class="question-box">
          <span class="type-pill">SCRIPTURE + MEMORY</span>
          <h2>Scripture Reading and Memory Verse</h2>
        </div>
      </div>
      <div class="twin-grid">
        ${scriptureReading ? `
          <div class="info-box">
            <strong>Scripture Reading</strong>
            <p>${escapeHtml(scriptureReading)}</p>
          </div>
        ` : ""}
        ${memoryVerse ? `
          <div class="info-box">
            <strong>Memory Verse</strong>
            <p>${escapeHtml(memoryVerse)}</p>
          </div>
        ` : ""}
      </div>
    `;
  }

  if (type === "note") {
    return `
      <div class="note-box">
        <span class="type-pill">NOTE</span>
        <p>${escapeHtml(slide.notes || "No note content.")}</p>
      </div>
    `;
  }

  const qNumber = slide.questionNumber ? `Q${slide.questionNumber}` : `Q${index + 1}`;
  return `
    <div class="question-wrap">
      <div class="question-number">${escapeHtml(qNumber)}</div>
      <div class="question-box">
        <span class="type-pill">QUESTION</span>
        <h2>${escapeHtml(slide.question || "No question")}</h2>
      </div>
    </div>
    <div class="info-box">
      <strong>Answer</strong>
      <p>${escapeHtml(slide.answer || "No answer provided.")}</p>
    </div>
    ${slide.notes ? `
      <div class="info-box">
        <strong>Notes</strong>
        <p>${escapeHtml(slide.notes)}</p>
      </div>
    ` : ""}
  `;
}

function splitTwin(value = "") {
  const parts = String(value).split("|").map((part) => part.trim()).filter(Boolean);
  return {
    scripture: parts[0] || "",
    memory: parts[1] || ""
  };
}

function renderPresenterMeta() {
  if (!state.project) {
    return;
  }

  const slides = state.project.slides || [];
  const current = slides[state.currentSlideIndex] || {};
  const next = slides[state.currentSlideIndex + 1];

  refs.nextPreview.textContent = next ? `${next.type}: ${next.question}` : "No next slide";
  refs.presenterNotes.textContent = current.notes || "No notes";
}

function stepSlide(delta) {
  if (!state.project) {
    return;
  }

  const maxIndex = Math.max(0, (state.project.slides || []).length - 1);
  const nextIndex = Math.min(maxIndex, Math.max(0, state.currentSlideIndex + delta));
  if (nextIndex === state.currentSlideIndex) {
    return;
  }

  state.currentSlideIndex = nextIndex;
  renderSlide();

  if (state.mode === "presenter") {
    publishLiveSlideIndex();
  }
}

function handleModeChange() {
  state.mode = refs.displayMode.value;
  applyModeUI();
  setupLiveMode();
}

function applyModeUI() {
  refs.presenterPanel.classList.toggle("hidden", state.mode !== "presenter");
}

function setupLiveMode() {
  if (state.liveUnsubscribe) {
    state.liveUnsubscribe();
    state.liveUnsubscribe = null;
  }

  if (!state.project) {
    return;
  }

  const liveDocRef = doc(db, appSettings.liveCollection, state.project.id);

  if (state.mode === "audience") {
    state.liveUnsubscribe = onSnapshot(liveDocRef, (snapshot) => {
      const liveData = snapshot.data();
      if (!liveData || typeof liveData.currentSlideIndex !== "number") {
        return;
      }

      if (liveData.currentSlideIndex !== state.currentSlideIndex) {
        state.currentSlideIndex = liveData.currentSlideIndex;
        renderSlide();
      }
    });
    return;
  }

  publishLiveSlideIndex();
}

async function publishLiveSlideIndex() {
  if (!state.project || state.mode !== "presenter") {
    return;
  }

  try {
    await setDoc(
      doc(db, appSettings.liveCollection, state.project.id),
      {
        adminKey: TEST_ADMIN_KEY,
        currentSlideIndex: state.currentSlideIndex,
        presenterId: "viewer-presenter",
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (error) {
    logFirebaseError("publishLiveSlideIndex", error);
  }
}

function updateDownloadState() {
  const hasPptx = Boolean(state.project?.pptxUrl);
  refs.downloadBtn.disabled = !hasPptx;
}

function handleDownload() {
  if (!state.project?.pptxUrl) {
    return;
  }
  window.open(state.project.pptxUrl, "_blank", "noopener,noreferrer");
}

function toggleTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    refs.timerToggleBtn.textContent = "Start Timer";
    return;
  }

  refs.timerToggleBtn.textContent = "Pause Timer";
  state.timerInterval = window.setInterval(() => {
    state.timerSeconds += 1;
    const minutes = String(Math.floor(state.timerSeconds / 60)).padStart(2, "0");
    const seconds = String(state.timerSeconds % 60).padStart(2, "0");
    refs.timerDisplay.textContent = `${minutes}:${seconds}`;
  }, 1000);
}

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function bindGlobalErrorLogging() {
  window.addEventListener("error", (event) => {
    console.error("[Viewer][window.error]", event.error || event.message || event);
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("[Viewer][unhandledrejection]", event.reason);
  });
}

function logFirebaseError(context, error) {
  console.error(`[Viewer][${context}]`, {
    host: window.location.host,
    origin: window.location.origin,
    pathname: window.location.pathname,
    projectId: firebaseConfig.projectId,
    collection: appSettings.projectsCollection,
    code: error?.code,
    message: error?.message,
    stack: error?.stack,
    fullError: error
  });
}

function showConnectionHints(error) {
  const code = error?.code || "";
  if (code === "permission-denied") {
    console.error(
      "[Viewer][hint] Firestore rules denied reads. Ensure Firestore Rules allow read on /BibleLessonSlides/{document}."
    );
    return;
  }

  if (code === "failed-precondition") {
    console.error(
      "[Viewer][hint] Firestore index/precondition issue. Check Firebase console error link and create required index."
    );
    return;
  }

  if (String(error?.message || "").toLowerCase().includes("api key")) {
    console.error(
      "[Viewer][hint] API key restriction likely blocks this deployed domain. Add your GitHub Pages domain in Google Cloud API key HTTP referrers."
    );
    return;
  }

  console.error(
    "[Viewer][hint] Check: deployed domain path, Firestore rules publish state, and App Check enforcement settings."
  );
}
