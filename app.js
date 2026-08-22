// Global State Storage
let currentProfileId = "";
let currentWeeklyId = "";
let currentLoansId = "";

document.addEventListener("DOMContentLoaded", () => {
  // 1. Tab Switching System
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

      // Auto-refresh summary or member list when switching tabs
      if (targetTab === "Members") loadMembersList();
      if (targetTab === "Summary") loadGeneralSummary();
    });
  });

  // 2. Render 50 Weeks Grid
  buildWeeklyGrid();

  // 3. Attach Event Listeners
  document.getElementById("btnSaveMember")?.addEventListener("click", handleCreateAndSaveAccount);
  document.getElementById("btnLoadProfile")?.addEventListener("click", loadProfileData);
  document.getElementById("btnNewID")?.addEventListener("click", generateNewID);
  
  document.getElementById("btnLoadWeekly")?.addEventListener("click", loadWeeklyData);
  document.getElementById("btnSavePayments")?.addEventListener("click", saveWeeklyPayments);

  document.getElementById("btnLoadLoans")?.addEventListener("click", loadLoansData);
  document.getElementById("btnAddLoan")?.addEventListener("click", handleAddLoan);
  document.getElementById("btnPayLoan")?.addEventListener("click", handlePayLoan);

  document.getElementById("btnSearchMember")?.addEventListener("click", () => {
    const searchVal = document.getElementById("searchMemberId")?.value.trim().toUpperCase();
    loadMembersList(searchVal);
  });

  document.getElementById("btnGeneralReset")?.addEventListener("click", handleGeneralReset);
});

// --- WEEKLY GRID RENDER ---
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

// --- PROFILE TAB LOGIC ---
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

    alert(`Success! Account ${rawId} created/updated.`);
    loadProfileData();
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      alert(`Database saved successfully for ${rawId}.`);
      loadProfileData();
    } else {
      alert("Account creation notice: " + error.message);
    }
  }
}

function generateNewID() {
  firebase.database().ref('users').once('value').then(snapshot => {
    const users = snapshot.val() || {};
    let highestNum = 0;

    Object.keys(users).forEach(id => {
      if (id.startsWith("M-")) {
        const num = parseInt(id.replace("M-", ""), 10);
        if (!isNaN(num) && num > highestNum) highestNum = num;
      }
    });

    const newNum = String(highestNum + 1).padStart(3, '0');
    const newId = `M-${newNum}`;

    document.getElementById("memberId").value = newId;
    document.getElementById("name").value = "";
    document.getElementById("age").value = "";
    document.getElementById("phone").value = "";
    document.getElementById("familyTies").value = "";
    document.getElementById("memberPassword").value = "";
    
    resetProfileSummary();
    alert(`Generated New Member ID: ${newId}`);
  });
}

function loadProfileData() {
  const id = (document.getElementById("memberId")?.value || "").trim().toUpperCase();
  if (!id) return alert("Please enter a Member ID.");

  currentProfileId = id;

  firebase.database().ref('users/' + id).once('value').then(snapshot => {
    const data = snapshot.val();
    if (!data) return alert(`No member found with ID: ${id}`);

    document.getElementById("name").value = data.name || "";
    document.getElementById("age").value = data.age || "";
    document.getElementById("phone").value = data.phone || "";
    document.getElementById("familyTies").value = data.familyTies || "";
    document.getElementById("roleType").value = data.role || "Member";

    // Calculate Summary Stats
    const weeks = data.weeksPaid || {};
    let totalSaved = 0;
    let weeksCount = 0;

    Object.values(weeks).forEach(amt => {
      const val = parseFloat(amt) || 0;
      if (val > 0) {
        totalSaved += val;
        weeksCount++;
      }
    });

    const loanAmount = parseFloat(data.loanAmount) || 0;
    const loanPaid = parseFloat(data.loanPaid) || 0;
    const loanBalance = Math.max(0, loanAmount - loanPaid);
    const netBalance = totalSaved - loanBalance;

    document.getElementById("profWeeksPaid").innerText = weeksCount;
    document.getElementById("profAmountSaved").innerText = `₦${totalSaved.toLocaleString()}`;
    document.getElementById("profLoanAmount").innerText = `₦${loanAmount.toLocaleString()}`;
    document.getElementById("profLoanPaid").innerText = `₦${loanPaid.toLocaleString()}`;
    document.getElementById("profLoanBalance").innerText = `₦${loanBalance.toLocaleString()}`;
    document.getElementById("profNetBalance").innerText = `₦${netBalance.toLocaleString()}`;
  });
}

function resetProfileSummary() {
  document.getElementById("profWeeksPaid").innerText = "0";
  document.getElementById("profAmountSaved").innerText = "₦0";
  document.getElementById("profLoanAmount").innerText = "₦0";
  document.getElementById("profLoanPaid").innerText = "₦0";
  document.getElementById("profLoanBalance").innerText = "₦0";
  document.getElementById("profNetBalance").innerText = "₦0";
}

// --- WEEKLY PAYMENTS LOGIC ---
function loadWeeklyData() {
  const id = (document.getElementById("weeklyMemberId")?.value || "").trim().toUpperCase();
  if (!id) return alert("Please enter a Member ID.");

  currentWeeklyId = id;

  firebase.database().ref('users/' + id).once('value').then(snapshot => {
    const data = snapshot.val();
    if (!data) return alert(`No record found for ID: ${id}`);

    document.getElementById("weeklyMemberName").innerText = `Member: ${data.name || "N/A"}`;

    const weeks = data.weeksPaid || {};
    for (let i = 1; i <= 50; i++) {
      const input = document.getElementById(`wkInput_${i}`);
      if (input) input.value = weeks[`wk_${i}`] || "";
    }
  });
}

function saveWeeklyPayments() {
  if (!currentWeeklyId) return alert("Please load a Member ID first.");

  const updates = {};
  for (let i = 1; i <= 50; i++) {
    const val = document.getElementById(`wkInput_${i}`)?.value || 0;
    updates[`wk_${i}`] = parseFloat(val) || 0;
  }

  firebase.database().ref(`users/${currentWeeklyId}/weeksPaid`).set(updates)
    .then(() => alert(`Weekly payments saved for ${currentWeeklyId}!`))
    .catch(err => alert("Error saving payments: " + err.message));
}

// --- LOANS LOGIC ---
function loadLoansData() {
  const id = (document.getElementById("loansMemberId")?.value || "").trim().toUpperCase();
  if (!id) return alert("Please enter a Member ID.");

  currentLoansId = id;

  firebase.database().ref('users/' + id).once('value').then(snapshot => {
    const data = snapshot.val();
    if (!data) return alert(`No record found for ID: ${id}`);

    document.getElementById("loansMemberName").innerText = `Member: ${data.name || "N/A"}`;

    const loanTotal = parseFloat(data.loanAmount) || 0;
    const loanPaid = parseFloat(data.loanPaid) || 0;
    const balance = Math.max(0, loanTotal - loanPaid);

    document.getElementById("loanTotalVal").innerText = `₦${loanTotal.toLocaleString()}`;
    document.getElementById("loanPaidVal").innerText = `₦${loanPaid.toLocaleString()}`;
    document.getElementById("loanBalVal").innerText = `₦${balance.toLocaleString()}`;
  });
}

function handleAddLoan() {
  if (!currentLoansId) return alert("Please load a Member ID first.");
  const amt = parseFloat(document.getElementById("newLoanInput")?.value) || 0;
  if (amt <= 0) return alert("Please enter a valid loan amount.");

  firebase.database().ref(`users/${currentLoansId}`).once('value').then(snapshot => {
    const currentLoan = parseFloat(snapshot.val()?.loanAmount) || 0;
    const newTotal = currentLoan + amt;

    firebase.database().ref(`users/${currentLoansId}`).update({ loanAmount: newTotal })
      .then(() => {
        alert(`Added ₦${amt.toLocaleString()} loan to ${currentLoansId}`);
        document.getElementById("newLoanInput").value = "";
        loadLoansData();
      });
  });
}

function handlePayLoan() {
  if (!currentLoansId) return alert("Please load a Member ID first.");
  const amt = parseFloat(document.getElementById("payLoanInput")?.value) || 0;
  if (amt <= 0) return alert("Please enter a valid repayment amount.");

  firebase.database().ref(`users/${currentLoansId}`).once('value').then(snapshot => {
    const currentPaid = parseFloat(snapshot.val()?.loanPaid) || 0;
    const newTotalPaid = currentPaid + amt;

    firebase.database().ref(`users/${currentLoansId}`).update({ loanPaid: newTotalPaid })
      .then(() => {
        alert(`Recorded repayment of ₦${amt.toLocaleString()} for ${currentLoansId}`);
        document.getElementById("payLoanInput").value = "";
        loadLoansData();
      });
  });
}

// --- MEMBERS LIST & RESET LOGIC ---
function loadMembersList(filterId = "") {
  const container = document.getElementById("membersListContainer");
  if (!container) return;

  container.innerHTML = "<div style='text-align:center; padding:10px; color:#aaa;'>Loading members...</div>";

  firebase.database().ref('users').once('value').then(snapshot => {
    const users = snapshot.val() || {};
    container.innerHTML = "";

    const userKeys = Object.keys(users).filter(k => !filterId || k.includes(filterId));

    if (userKeys.length === 0) {
      container.innerHTML = "<div style='text-align:center; padding:10px; color:#aaa;'>No matching members found.</div>";
      return;
    }

    userKeys.forEach(key => {
      const u = users[key];
      const card = document.createElement("div");
      card.className = "member-card";

      const weeks = u.weeksPaid || {};
      let totalSaved = 0;
      Object.values(weeks).forEach(amt => totalSaved += (parseFloat(amt) || 0));

      const loanAmt = parseFloat(u.loanAmount) || 0;
      const loanPaid = parseFloat(u.loanPaid) || 0;
      const loanBal = Math.max(0, loanAmt - loanPaid);

      card.innerHTML = `
        <div>
          <div class="member-header"><span>${u.memberId || key}</span> - <span>${u.name || "N/A"}</span></div>
          <div style="color: #aaa;">Phone: ${u.phone || "N/A"} | Role: ${u.role || "Member"}</div>
          <div style="margin-top: 4px; color: #ffd700;">Saved: ₦${totalSaved.toLocaleString()} | Loan Bal: ₦${loanBal.toLocaleString()}</div>
        </div>
      `;
      container.appendChild(card);
    });
  });
}

function handleGeneralReset() {
  const confirmReset = confirm("WARNING: Are you sure you want to reset all members' financial data (Weekly Savings, Loans, and Repayments)?");
  if (!confirmReset) return;

  const pin = prompt("Enter Admin PIN to confirm reset:");
  if (!pin) return;

  firebase.database().ref('settings/adminResetPin').once('value').then(snapshot => {
    const masterPin = snapshot.val() || "1234";
    if (pin.trim() !== masterPin.toString()) return alert("Invalid PIN. Reset aborted.");

    firebase.database().ref('users').once('value').then(snapshot => {
      const users = snapshot.val() || {};
      const updates = {};

      Object.keys(users).forEach(id => {
        updates[`users/${id}/weeksPaid`] = null;
        updates[`users/${id}/loanAmount`] = 0;
        updates[`users/${id}/loanPaid`] = 0;
      });

      firebase.database().ref().update(updates).then(() => {
        alert("All financial records have been reset.");
        loadMembersList();
      });
    });
  });
}

// --- GENERAL SUMMARY TAB LOGIC ---
function loadGeneralSummary() {
  firebase.database().ref('users').once('value').then(snapshot => {
    const users = snapshot.val() || {};
    let totalSaved = 0;
    let totalLoans = 0;
    let totalRepaid = 0;
    let memberCount = 0;

    Object.values(users).forEach(u => {
      memberCount++;
      const weeks = u.weeksPaid || {};
      Object.values(weeks).forEach(amt => totalSaved += (parseFloat(amt) || 0));

      totalLoans += (parseFloat(u.loanAmount) || 0);
      totalRepaid += (parseFloat(u.loanPaid) || 0);
    });

    const totalLoanBal = Math.max(0, totalLoans - totalRepaid);
    const grandNet = totalSaved - totalLoanBal;

    document.getElementById("sumTotalSaved").innerText = `₦${totalSaved.toLocaleString()}`;
    document.getElementById("sumTotalLoans").innerText = `₦${totalLoans.toLocaleString()}`;
    document.getElementById("sumTotalRepaid").innerText = `₦${totalRepaid.toLocaleString()}`;
    document.getElementById("sumTotalLoanBal").innerText = `₦${totalLoanBal.toLocaleString()}`;
    document.getElementById("sumGrandNet").innerText = `₦${grandNet.toLocaleString()}`;
    document.getElementById("sumTotalMembers").innerText = memberCount;
  });
}
