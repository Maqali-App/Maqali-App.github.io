// Function attached to your "Create & Save Account" button
async function handleCreateAndSaveAccount() {
  const rawId = document.getElementById('memberIdInput')?.value.trim().toUpperCase() || "";
  const name = document.getElementById('memberNameInput')?.value.trim() || "";
  const pass = document.getElementById('accountPassInput')?.value.trim() || "";
  const role = document.getElementById('roleTypeSelect')?.value || "Normal Member";

  if (!rawId || !pass) return alert("Please enter both a Member ID and a Password.");
  if (pass.length < 6) return alert("Password must be at least 6 characters long.");

  const userEmail = `${rawId.toLowerCase()}@maqali.app`;

  try {
    // 1. Save member details to Firebase Realtime Database
    await firebase.database().ref('users/' + rawId).set({
      memberId: rawId,
      name: name,
      role: role,
      updatedAt: new Date().toISOString()
    });

    // 2. Create Authentication login using secondary app instance (keeps Editor logged in)
    let secondaryApp = firebase.apps.find(app => app.name === "Secondary") 
      || firebase.initializeApp(window.firebaseConfig, "Secondary");

    await secondaryApp.auth().createUserWithEmailAndPassword(userEmail, pass);
    await secondaryApp.auth().signOut();

    alert(`Success! Member ${rawId} saved with password: ${pass}`);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      alert(`Database saved, but Auth login for ${rawId} already exists.`);
    } else {
      alert("Account creation notice: " + error.message);
    }
  }
}
