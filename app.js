// Function attached to your "Create & Save Account" button
async function handleCreateAndSaveAccount() {
  // Grab input values from your profile form
  const rawId = document.getElementById('memberIdInput').value.trim().toUpperCase();
  const name = document.getElementById('memberNameInput').value.trim();
  const pass = document.getElementById('accountPassInput').value.trim();
  const role = document.getElementById('roleTypeSelect').value;

  if (!rawId || !pass) {
    alert("Please enter both a Member ID and a Password.");
    return;
  }

  if (pass.length < 6) {
    alert("Password must be at least 6 characters long.");
    return;
  }

  const userEmail = `${rawId.toLowerCase()}@maqali.app`;

  // 1. Save member details to Firebase Realtime Database using primary app
  try {
    await firebase.database().ref('users/' + rawId).set({
      memberId: rawId,
      name: name,
      role: role,
      updatedAt: new Date().toISOString()
    });

    // 2. Create Authentication login using a secondary app instance (keeps Editor logged in)
    let secondaryApp = firebase.apps.find(app => app.name === "Secondary") 
      || firebase.initializeApp(firebaseConfig, "Secondary");

    await secondaryApp.auth().createUserWithEmailAndPassword(userEmail, pass);
    await secondaryApp.auth().signOut();

    alert(`Success! Member ${rawId} profile saved and login created with password: ${pass}`);

  } catch (error) {
    // Handles case where database saved but auth already existed or failed
    if (error.code === 'auth/email-already-in-use') {
      alert(`Database saved, but Auth login for ${rawId} already exists in Firebase.`);
    } else {
      alert("Account creation notice: " + error.message);
    }
  }
}
