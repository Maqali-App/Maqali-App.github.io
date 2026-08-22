// Global Firebase Configuration
window.firebaseConfig = {
  apiKey: "AIzaSyAs1A-I-TgTLPxthSxa0D4e-R6pmsk70FU",
  authDomain: "maqali-app-83b95.firebaseapp.com",
  databaseURL: "https://maqali-app-83b95-default-rtdb.firebaseio.com",
  projectId: "maqali-app-83b95",
  storageBucket: "maqali-app-83b95.firebasestorage.app",
  messagingSenderId: "458036803827",
  appId: "1:458036803827:web:a7d2f61d1256fdfca21f86",
  measurementId: "G-RE6DXYQ0RL"
};

if (!firebase.apps.length) {
  firebase.initializeApp(window.firebaseConfig);
}

const auth = firebase.auth();

auth.onAuthStateChanged((user) => {
  const isLoginPage = window.location.pathname.endsWith("login.html");
  if (isLoginPage) return;

  const updateUI = () => {
    const statusBox = document.getElementById("statusBanner") || document.getElementById("statusMessage") || document.querySelector(".status-bar");
    const roleBadge = document.getElementById("roleBadge") || document.querySelector(".role-badge");
    const authBtn = document.getElementById("authBtn") || document.querySelector(".top-bar button, header button");

    if (user) {
      const email = (user.email || "").toLowerCase();
      const isEditor = email.startsWith("e-") || email.includes("editor");

      if (statusBox) statusBox.innerText = "STATUS: Connected (" + user.email + ")";
      if (roleBadge) roleBadge.innerText = isEditor ? "Role: Editor (Full Access)" : "Role: Member (View-Only)";

      if (authBtn) {
        authBtn.innerText = "Sign Out";
        authBtn.style.backgroundColor = "#dc2626";
        authBtn.onclick = () => auth.signOut().then(() => window.location.reload());
      }

      applyGlobalAccess(isEditor, true);
    } else {
      if (statusBox) statusBox.innerText = "STATUS: Read-Only (Please Log In)";
      if (roleBadge) roleBadge.innerText = "Role: Viewer (Read-Only)";

      if (authBtn) {
        authBtn.innerText = "Login";
        authBtn.style.backgroundColor = "#2563eb";
        authBtn.onclick = () => window.location.href = "login.html";
      }

      applyGlobalAccess(false, false);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateUI);
  } else {
    updateUI();
  }
});

function applyGlobalAccess(isEditor, isLoggedIn) {
  // Toggle CSS indicator classes on <body>
  document.body.classList.toggle("is-editor", isEditor);
  document.body.classList.toggle("is-logged-in", isLoggedIn);

  // Strip all hardcoded disabled / readonly attributes
  document.querySelectorAll("input, select, textarea, button").forEach(el => {
    if (el.id === "authBtn") return;

    if (isEditor) {
      el.removeAttribute("disabled");
      el.removeAttribute("readonly");
      el.disabled = false;
    } else {
      // Keep nav tabs functional if logged in as Member
      if (isLoggedIn && (el.classList.contains("tab-btn") || el.classList.contains("nav-item"))) {
        el.removeAttribute("disabled");
        el.disabled = false;
      } else {
        el.setAttribute("disabled", "true");
        el.disabled = true;
      }
    }
  });
}
