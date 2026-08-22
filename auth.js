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
  const path = window.location.pathname.toLowerCase();
  const isLoginPage = path.endsWith("login.html") || path.endsWith("/login");
  
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
  document.body.classList.toggle("editor-active", isEditor);
  document.body.classList.toggle("is-logged-in", isLoggedIn);

  const formControls = Array.from(document.querySelectorAll("input, select, textarea"));
  formControls.forEach(el => {
    const isSearchInput = el.id.toLowerCase().includes("id") || el.classList.contains("id-input-part");

    if (isEditor || isSearchInput) {
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
      el.style.opacity = "0.7";
    }
  });

  const tabItems = Array.from(document.querySelectorAll(".tab-item, .tab-bar div, nav div"));
  tabItems.forEach(tab => {
    tab.style.pointerEvents = isLoggedIn ? "auto" : "none";
    tab.style.opacity = isLoggedIn ? "1" : "0.4";
    tab.style.cursor = isLoggedIn ? "pointer" : "default";
  });

  const buttons = Array.from(document.querySelectorAll("button, a"));
  buttons.forEach(btn => {
    if (btn.id === "authBtn") return;

    const isLoadBtn = btn.classList.contains("load-btn-part") || btn.id.toLowerCase().includes("load") || btn.id.toLowerCase().includes("search");
    const isNav = btn.closest(".tab-bar") || btn.closest("nav") || btn.classList.contains("tab-item");

    if (isNav || isLoadBtn) {
      btn.disabled = !isLoggedIn;
      btn.style.pointerEvents = isLoggedIn ? "auto" : "none";
      btn.style.opacity = isLoggedIn ? "1" : "0.5";
      if (isLoggedIn) btn.removeAttribute("disabled");
    } else {
      btn.disabled = !isEditor;
      btn.style.display = isEditor ? "inline-block" : "none";
      btn.style.pointerEvents = isEditor ? "auto" : "none";
      btn.style.opacity = isEditor ? "1" : "0.5";
      if (isEditor) btn.removeAttribute("disabled");
    }
  });
}
