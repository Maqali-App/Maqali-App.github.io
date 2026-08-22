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

// Universal Auth Guard
auth.onAuthStateChanged((user) => {
  const isLoginPage = window.location.pathname.endsWith("login.html");

  // NEVER disable inputs if we are on login.html!
  if (isLoginPage) return;

  const statusBox = document.getElementById("statusMessage") || document.querySelector(".status-bar");
  const roleBadge = document.getElementById("roleBadge");

  if (user) {
    const email = user.email || "";
    const isEditor = email.startsWith("e-");

    if (statusBox) statusBox.innerText = "STATUS: Connected (" + email + ")";
    if (roleBadge) roleBadge.innerText = isEditor ? "Role: Editor (Full Access)" : "Role: Member (View-Only)";

    // Only enable dashboard inputs if Editor
    document.querySelectorAll(".main-dashboard input, .main-dashboard select").forEach(el => el.disabled = !isEditor);
  } else {
    if (statusBox) statusBox.innerText = "STATUS: Read-Only Mode (Not Logged In)";
    if (roleBadge) roleBadge.innerText = "Role: Viewer (Read-Only)";

    // Lock dashboard inputs for unauthenticated viewers
    document.querySelectorAll(".main-dashboard input, .main-dashboard select").forEach(el => el.disabled = true);
  }
});
