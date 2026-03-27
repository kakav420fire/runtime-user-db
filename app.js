const authForm = document.getElementById("authForm");
const showLogin = document.getElementById("showLogin");
const showRegister = document.getElementById("showRegister");
const submitBtn = document.getElementById("submitBtn");
const statusEl = document.getElementById("status");
const downloadPanel = document.getElementById("downloadPanel");
const logoutBtn = document.getElementById("logoutBtn");

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

const STORAGE_KEY_USERS = "runtime.users.v1";
const STORAGE_KEY_SESSION = "runtime.session.v1";

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

    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({ email, at: Date.now() }));
    setAuthenticatedUi(true, email);
  } catch (error) {
    setStatus(error.message || "Something went wrong.", true);
  } finally {
    submitBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  localStorage.removeItem(STORAGE_KEY_SESSION);
  authForm.reset();
  updateMode("login");
  setAuthenticatedUi(false);
  authForm.classList.remove("hidden");
  showLogin.classList.remove("hidden");
  showRegister.classList.remove("hidden");
});

async function boot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSION);
    const session = raw ? JSON.parse(raw) : null;
    if (session?.email) setAuthenticatedUi(true, session.email);
  } catch (_err) {
    // ignore
  }
}

boot();

