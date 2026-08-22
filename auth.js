// Initialize Firebase App
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

// Centralized Navigation Guard
auth.onAuthStateChanged((user) => {
  const currentPage = window.location.pathname.split("/").pop();

  if (user) {
    // If logged in and sitting on login page, send to index
    if (currentPage === "login.html" || currentPage === "") {
      window.location.href = "index.html";
    }
  } else {
    // If logged out and trying to access main dashboard, send to login
    if (currentPage !== "login.html") {
      window.location.href = "login.html";
    }
  }
});
