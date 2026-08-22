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

// Run Auth Listener IMMEDIATELY (Do not wait for DOMContentLoaded wrapper)
auth.onAuthStateChanged((user) => {
  const isLoginPage = window.location.pathname.endsWith("login.html");
  if (isLoginPage) return;

  // Execute UI updates once DOM elements exist
  const updateUI = () => {
    // Search for any element containing status or role text
    const statusBox = document.getElementById("statusMessage") || document.getElementById("statusText") || document.querySelector(".status-bar");
    const roleBadge = document.getElementById("roleBadge") || document.querySelector(".role-badge");

    if (user) {
      const email = user.email || "";
      const isEditor = email.startsWith("e-");

      if (statusBox) statusBox.innerText = "STATUS: Connected (" + email + ")";
      if (roleBadge) roleBadge.innerText = isEditor ? "Role: Editor (Full Access)" : "Role: Member (View-Only)";

      toggleUIState({ inputsLocked: !isEditor, tabsLocked: false, showSaveBtns: isEditor });
    } else {
      if (statusBox) statusBox.innerText = "STATUS: Read-Only (Please Log In)";
      if (roleBadge) roleBadge.innerText = "Role: Viewer (Read-Only)";

      toggleUIState({ inputsLocked: true, tabsLocked: true, showSaveBtns: false });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateUI);
  } else {
    updateUI();
  }
});

function toggleUIState({ inputsLocked, tabsLocked, showSaveBtns }) {
  document.querySelectorAll("input, select").forEach(el => el.disabled = inputsLocked);
  
  document.querySelectorAll(".tab-btn, .nav-item").forEach(el => {
    el.style.pointerEvents = tabsLocked ? "none" : "auto";
    el.style.opacity = tabsLocked ? "0.5" : "1";
  });

  document.querySelectorAll(".save-btn, .action-btn, #btnSaveMember").forEach(el => {
    el.style.display = showSaveBtns ? "inline-block" : "none";
  });
}
