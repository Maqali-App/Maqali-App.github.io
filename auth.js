// Initialize Firebase
const firebaseConfig = {
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
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();

document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged((user) => {
    const isLoginPage = window.location.pathname.endsWith("login.html");

    // 1. On Login Page logic
    if (isLoginPage) {
      if (user) window.location.href = "index.html"; // Redirect to main index if already logged in
      return;
    }

    // 2. On Main Dashboard (index.html) logic
    const statusBox = document.getElementById("statusMessage") || document.querySelector(".status-bar");
    const roleBadge = document.getElementById("roleBadge") || document.querySelector(".role-badge");

    if (user) {
      const email = user.email || "";
      const isEditor = email.startsWith("e-");

      if (statusBox) statusBox.innerText = "STATUS: Connected (" + email + ")";
      
      if (isEditor) {
        if (roleBadge) roleBadge.innerText = "Role: Editor (Full Access)";
        // Editor: Unlock all tabs, inputs, and save buttons
        toggleUIState({ inputsLocked: false, tabsLocked: false, showSaveBtns: true });
      } else {
        if (roleBadge) roleBadge.innerText = "Role: Member (View-Only)";
        // Normal Member: Unlock navigation tabs, but keep inputs/save buttons locked
        toggleUIState({ inputsLocked: true, tabsLocked: false, showSaveBtns: false });
      }
    } else {
      // Unauthenticated Visitor landing directly on index.html
      if (statusBox) statusBox.innerText = "STATUS: Read-Only (Please Log In)";
      if (roleBadge) roleBadge.innerText = "Role: Viewer (Read-Only)";

      // Unauthenticated: Lock EVERYTHING (Inputs, Action Buttons, and Navigation Tabs)
      toggleUIState({ inputsLocked: true, tabsLocked: true, showSaveBtns: false });
    }
  });
});

// Utility function to enforce lock states
function toggleUIState({ inputsLocked, tabsLocked, showSaveBtns }) {
  // Lock or unlock input elements and select dropdowns
  document.querySelectorAll("input, select").forEach(el => {
    el.disabled = inputsLocked;
  });

  // Lock or unlock navigation tabs (bottom menu / top navbar)
  document.querySelectorAll(".tab-btn, .nav-item, footer a, nav a").forEach(el => {
    if (tabsLocked) {
      el.style.pointerEvents = "none";
      el.style.opacity = "0.5";
    } else {
      el.style.pointerEvents = "auto";
      el.style.opacity = "1";
    }
  });

  // Hide or show save/edit action buttons
  document.querySelectorAll(".save-btn, .action-btn, #btnSaveMember").forEach(el => {
    el.style.display = showSaveBtns ? "inline-block" : "none";
  });
}
