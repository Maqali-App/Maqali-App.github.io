// Initialize Firebase safely
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

// Run immediately when DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged((user) => {
    // Find status element (handles both class and id variations)
    const statusBox = document.getElementById("statusMessage") || document.querySelector(".status-bar") || document.querySelector("div[class*='status']");
    const roleBadge = document.getElementById("roleBadge") || document.querySelector("div[class*='Role']");

    if (user) {
      const email = user.email || "";
      const isEditor = email.startsWith("e-");

      if (statusBox) statusBox.innerText = "STATUS: Connected (" + email + ")";
      if (roleBadge) roleBadge.innerText = isEditor ? "Role: Editor (Full Access)" : "Role: Member (View-Only)";

      // Unlock fields if Editor
      document.querySelectorAll("input, select").forEach(el => el.disabled = !isEditor);
    } else {
      if (statusBox) statusBox.innerText = "STATUS: Read-Only Mode (Not Logged In)";
      if (roleBadge) roleBadge.innerText = "Role: Viewer (Read-Only)";

      // Lock all inputs in Read-Only mode
      document.querySelectorAll("input, select").forEach(el => el.disabled = true);
    }
  });
});
