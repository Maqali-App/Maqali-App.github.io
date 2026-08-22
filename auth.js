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

      applyAccessPermissions({ isEditor: isEditor, isLoggedIn: true });
    } else {
      if (statusBox) statusBox.innerText = "STATUS: Read-Only (Please Log In)";
      if (roleBadge) roleBadge.innerText = "Role: Viewer (Read-Only)";

      if (authBtn) {
        authBtn.innerText = "Login";
        authBtn.style.backgroundColor = "#2563eb";
        authBtn.onclick = () => window.location.href = "login.html";
      }

      applyAccessPermissions({ isEditor: false, isLoggedIn: false });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateUI);
  } else {
    updateUI();
  }
});

function applyAccessPermissions({ isEditor, isLoggedIn }) {
  // 1. Manage Form Inputs (Unlocked only for Editor)
  document.querySelectorAll("input, select, textarea").forEach(el => {
    if (isEditor) {
      el.disabled = false;
      el.removeAttribute("disabled");
      el.removeAttribute("readonly");
      el.style.pointerEvents = "auto";
      el.style.opacity = "1";
    } else {
      el.disabled = true;
      el.setAttribute("disabled", "true");
      el.style.pointerEvents = "none";
      el.style.opacity = "0.6";
    }
  });

  // 2. Manage Navigation Tabs (Unlocked for ANY logged-in user)
  const navTabs = document.querySelectorAll(".tab-btn, .nav-item, footer button, nav button, footer a, nav a, .bottom-nav button");
  navTabs.forEach(tab => {
    if (isLoggedIn) {
      tab.style.pointerEvents = "auto";
      tab.style.opacity = "1";
      tab.removeAttribute("disabled");
    } else {
      tab.style.pointerEvents = "none";
      tab.style.opacity = "0.4";
    }
  });

  // 3. Manage Action Buttons (Load, New ID, Create & Save) - Unlocked for Editor
  const actionBtns = document.querySelectorAll("button:not(#authBtn), .action-btn, .save-btn, #btnSaveMember");
  actionBtns.forEach(btn => {
    // Skip bottom navigation buttons from being hidden
    if (btn.classList.contains("tab-btn") || btn.classList.contains("nav-item")) return;

    if (isEditor) {
      btn.disabled = false;
      btn.removeAttribute("disabled");
      btn.style.display = "inline-block";
      btn.style.pointerEvents = "auto";
      btn.style.opacity = "1";
    } else {
      btn.disabled = true;
      btn.style.display = "none";
      btn.style.pointerEvents = "none";
      btn.style.opacity = "0.5";
    }
  });
}