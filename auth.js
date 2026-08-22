// Centralized Navigation Guard
auth.onAuthStateChanged((user) => {
  const path = window.location.pathname;
  const isLoginPage = path.endsWith("login.html");

  if (user) {
    // If logged in and on the login page, go to main dashboard
    if (isLoginPage) {
      window.location.href = "index.html";
    }
  } else {
    // If logged out and NOT on the login page, go to login page
    if (!isLoginPage) {
      window.location.href = "login.html";
    }
  }
});
