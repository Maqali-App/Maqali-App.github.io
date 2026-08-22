// auth.js
firebase.auth().onAuthStateChanged((user) => {
  const currentPage = window.location.pathname.split("/").pop();

  if (user) {
    // User is logged in
    if (currentPage === "login.html" || currentPage === "") {
      window.location.href = "index.html";
    }
  } else {
    // User is logged out
    if (currentPage !== "login.html") {
      window.location.href = "login.html";
    }
  }
});
