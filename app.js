// Tab Switching System
document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tab-item");
  const tabContents = document.querySelectorAll(".tab-content");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetTab = tab.getAttribute("data-tab");

      tabs.forEach(t => t.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));

      tab.classList.add("active");
      const activeContent = document.getElementById(`tab-${targetTab}`);
      if (activeContent) activeContent.classList.add("active");
    });
  });

  // Render 50 Weeks Grid
  buildWeeklyGrid();

  // Attach Profile Save Handler
  const saveBtn = document.getElementById("btnSaveMember");
  if (saveBtn) {
    saveBtn.addEventListener("click", handleCreateAndSaveAccount);
  }
});

// Render 50 Input Boxes for Weekly Contributions
function buildWeeklyGrid() {
  const container = document.getElementById("grid50");
  if (!container) return;
  container.innerHTML = "";

  for (let i = 1; i <= 50; i++) {
    const cell = document.createElement("div");
    cell.className = "grid-cell";
    cell.innerHTML = `
      <span class="grid-label">Wk ${i}</span>
      <input type="number" class="grid-input" id="wkInput_${i}" placeholder="0">
    `;
    container.appendChild(cell);
  }
}

// Account Creation Handler
async function handleCreateAndSaveAccount() {
  const rawId = (document.getElementById('memberId')?.value || "").trim().toUpperCase();
  const name = (document.getElementById('name')?.value || "").trim();
  const age = (document.getElementById('age')?.value || "").trim();
  const phone = (document.getElementById('phone')?.value || "").trim();
  const familyTies = (document.getElementById('familyTies')?.value || "").trim();
  const pass = (document.getElementById('memberPassword')?.value || "").trim();
  const role = document.getElementById('roleType')?.value || "Member";

  if (!rawId || !pass) return alert("Please enter both a Member ID and Password.");
  if (pass.length < 6) return alert("Password must be at least 6 characters long.");

  const userEmail = `${rawId.toLowerCase()}@maqali.app`;

  try {
    await firebase.database().ref('users/' + rawId).update({
      memberId: rawId,
      name: name,
      age: age,
      phone: phone,
      familyTies: familyTies,
      role: role,
      updatedAt: new Date().toISOString()
    });

    const currentConfig = firebase.app().options;
    let secondaryApp = firebase.apps.find(app => app.name === "Secondary") || firebase.initializeApp(currentConfig, "Secondary");

    await secondaryApp.auth().createUserWithEmailAndPassword(userEmail, pass);
    await secondaryApp.auth().signOut();

    alert(`Success! Member ${rawId} created/updated successfully.`);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      alert(`Database saved, but Auth credentials for ${rawId} already exist.`);
    } else {
      alert("Account creation notice: " + error.message);
    }
  }
}
