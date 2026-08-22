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
const db = firebase.database();

// Universal Role Guard & State Manager
auth.onAuthStateChanged((user) => {
  const isLoginPage = window.location.pathname.endsWith("login.html");

  if (user) {
    if (isLoginPage) {
      window.location.href = "index.html";
    } else {
      applyUserPermissions(user);
    }
  } else {
    // Unauthenticated: Stay on index.html in Read-Only mode
    applyReadOnlyMode();
  }
});

// Lock Interface for Unauthenticated Visitors
function applyReadOnlyMode() {
  const roleBadge = document.getElementById("roleBadge");
  if (roleBadge) roleBadge.innerText = "Role: Viewer (Read-Only)";

  // Disable forms and inputs
  document.querySelectorAll("input, select").forEach(el => el.disabled = true);
  document.querySelectorAll(".save-btn, .action-btn").forEach(el => el.style.display = "none");
}

// Grant Permissions Based on Role
function applyUserPermissions(user) {
  const email = user.email || "";
  const isEditor = email.startsWith("e-");

  const roleBadge = document.getElementById("roleBadge");
  if (roleBadge) {
    roleBadge.innerText = isEditor ? "Role: Editor (Full Access)" : "Role: Member (View-Only)";
  }

  if (isEditor) {
    document.querySelectorAll("input, select").forEach(el => el.disabled = false);
    document.querySelectorAll(".save-btn, .action-btn").forEach(el => el.style.display = "inline-block");
  } else {
    document.querySelectorAll("input, select").forEach(el => el.disabled = true);
    document.querySelectorAll(".save-btn, .action-btn").forEach(el => el.style.display = "none");
  }
}

// Admin PIN Password Reset Function
async function resetPasswordWithPin(memberId, newPassword, enteredPin) {
  try {
    const pinSnapshot = await db.ref("settings/adminResetPin").once("value");
    const masterPin = pinSnapshot.val() || "1234"; // Default fallback PIN

    if (enteredPin !== masterPin) {
      alert("Invalid Admin Reset PIN. Please check with your Admin.");
      return;
    }

    // Call Cloud/Backend or Secondary process to update password
    alert("PIN Verified! Contact Editor to finalize credential sync or use secondary updater.");
  } catch (err) {
    alert("Reset Error: " + err.message);
  }
}
