const authForm = document.getElementById("authForm");
const showLogin = document.getElementById("showLogin");
const showRegister = document.getElementById("showRegister");
const submitBtn = document.getElementById("submitBtn");
const statusEl = document.getElementById("status");
const downloadPanel = document.getElementById("downloadPanel");
const logoutBtn = document.getElementById("logoutBtn");
const keepSignedIn = document.getElementById("keepSignedIn");

let mode = "login";

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function updateMode(nextMode) {
  mode = nextMode;
  const isLogin = mode === "login";
  showLogin.classList.toggle("active", isLogin);
  showRegister.classList.toggle("active", !isLogin);
  submitBtn.textContent = isLogin ? "Login" : "Create account";
  setStatus("");
}

function setAuthenticatedUi(isAuthenticated, email = "") {
  downloadPanel.classList.toggle("hidden", !isAuthenticated);
  logoutBtn.classList.toggle("hidden", !isAuthenticated);
  authForm.classList.toggle("hidden", isAuthenticated);
  showLogin.classList.toggle("hidden", isAuthenticated);
  showRegister.classList.toggle("hidden", isAuthenticated);
  if (isAuthenticated) setStatus(`Logged in as ${email}`);
}

showLogin.addEventListener("click", () => updateMode("login"));
showRegister.addEventListener("click", () => updateMode("register"));

function setupRevealAnimations() {
  const els = Array.from(document.querySelectorAll(".reveal"));
  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      }
    },
    { root: null, threshold: 0.12 }
  );

  els.forEach((el) => io.observe(el));
}

function setupGridParallax() {
  const grid = document.querySelector(".background-grid");
  if (!grid) return;
  let raf = 0;
  window.addEventListener(
    "pointermove",
    (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const x = (e.clientX / window.innerWidth - 0.5) * 6;
        const y = (e.clientY / window.innerHeight - 0.5) * 6;
        grid.style.transform = `translate(${x}px, ${y}px)`;
      });
    },
    { passive: true }
  );
}

const STORAGE_KEY_USERS = "runtime.users.v1";
const STORAGE_KEY_SESSION = "runtime.session.v1";
const STORAGE_KEY_PERSIST = "runtime.persist.v1";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

function setUsers(users) {
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
}

function saveSession(email) {
  const shouldPersist = Boolean(keepSignedIn?.checked);
  const sessionPayload = JSON.stringify({ email, at: Date.now() });
  localStorage.setItem(STORAGE_KEY_PERSIST, JSON.stringify(shouldPersist));
  if (shouldPersist) {
    localStorage.setItem(STORAGE_KEY_SESSION, sessionPayload);
    sessionStorage.removeItem(STORAGE_KEY_SESSION);
  } else {
    sessionStorage.setItem(STORAGE_KEY_SESSION, sessionPayload);
    localStorage.removeItem(STORAGE_KEY_SESSION);
  }
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(authForm);
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    setStatus("Email and password are required.", true);
    return;
  }

  try {
    submitBtn.disabled = true;
    setStatus(mode === "login" ? "Logging in..." : "Creating account...");

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    const users = getUsers();
    const existing = users.find((u) => u.email === email);
    const passwordHash = await sha256(password);

    if (mode === "register") {
      if (existing) throw new Error("Account already exists on this device/browser.");
      users.push({ email, passwordHash, createdAt: new Date().toISOString() });
      setUsers(users);
    } else {
      if (!existing) throw new Error("Invalid email or password.");
      if (existing.passwordHash !== passwordHash) throw new Error("Invalid email or password.");
    }

    saveSession(email);
    setAuthenticatedUi(true, email);
  } catch (error) {
    setStatus(error.message || "Something went wrong.", true);
  } finally {
    submitBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  localStorage.removeItem(STORAGE_KEY_SESSION);
  sessionStorage.removeItem(STORAGE_KEY_SESSION);
  authForm.reset();
  updateMode("login");
  setAuthenticatedUi(false);
  authForm.classList.remove("hidden");
  showLogin.classList.remove("hidden");
  showRegister.classList.remove("hidden");
});

async function boot() {
  try {
    const persistedRaw = localStorage.getItem(STORAGE_KEY_PERSIST);
    const shouldPersist = persistedRaw ? JSON.parse(persistedRaw) : false;
    if (keepSignedIn) keepSignedIn.checked = Boolean(shouldPersist);
    const raw = shouldPersist
      ? localStorage.getItem(STORAGE_KEY_SESSION)
      : sessionStorage.getItem(STORAGE_KEY_SESSION);
    const session = raw ? JSON.parse(raw) : null;
    if (session?.email) setAuthenticatedUi(true, session.email);
  } catch (_err) {
    // ignore
  }
}

boot();

setupRevealAnimations();
setupGridParallax();

