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

if (typeof firebase !== "undefined" && !firebase.apps.length) {
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

      unlockUI({ isEditor: isEditor, isLoggedIn: true });
    } else {
      if (statusBox) statusBox.innerText = "STATUS: Read-Only (Please Log In)";
      if (roleBadge) roleBadge.innerText = "Role: Viewer (Read-Only)";

      if (authBtn) {
        authBtn.innerText = "Login";
        authBtn.style.backgroundColor = "#2563eb";
        authBtn.onclick = () => window.location.href = "login.html";
      }

      unlockUI({ isEditor: false, isLoggedIn: false });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateUI);
  } else {
    updateUI();
  }
});

function unlockUI({ isEditor, isLoggedIn }) {
  // 1. Force body class
  document.body.classList.toggle("editor-active", isEditor);

  // 2. Unlock ALL input, select, textarea elements for Editors
  const inputs = document.getElementsByTagName("input");
  const selects = document.getElementsByTagName("select");
  const textareas = document.getElementsByTagName("textarea");

  const formControls = [...inputs, ...selects, ...textareas];
  formControls.forEach(el => {
    if (isEditor) {
      el.disabled = false;
      el.readOnly = false;
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

  // 3. Unlock ALL buttons and links across the entire app
  const buttons = document.getElementsByTagName("button");
  const links = document.getElementsByTagName("a");
  const allClickables = [...buttons, ...links];

  allClickables.forEach(btn => {
    if (btn.id === "authBtn") return;

    // Check if element is a navigation item
    const isNav = btn.closest("nav") || btn.closest("footer") || btn.classList.contains("tab-btn") || btn.classList.contains("nav-item");

    if (isNav) {
      // Navigation is unlocked for ANY logged-in user
      btn.disabled = !isLoggedIn;
      btn.style.pointerEvents = isLoggedIn ? "auto" : "none";
      btn.style.opacity = isLoggedIn ? "1" : "0.4";
      if (isLoggedIn) btn.removeAttribute("disabled");
    } else {
      // Form action buttons (Load, New ID, Create & Save) unlocked ONLY for Editors
      btn.disabled = !isEditor;
      btn.style.display = isEditor ? "inline-block" : "none";
      btn.style.pointerEvents = isEditor ? "auto" : "none";
      btn.style.opacity = isEditor ? "1" : "0.5";
      if (isEditor) btn.removeAttribute("disabled");
    }
  });
}
