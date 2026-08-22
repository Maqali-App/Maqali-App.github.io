// Force HTTPS long-polling for database connection stability
if (firebase.database.INTERNAL && firebase.database.INTERNAL.forceLongPolling) {
  firebase.database.INTERNAL.forceLongPolling();
}

const db = firebase.database();

let members = [];
let isEditor = false;
let currentUserId = "";
let isEditingExistingMember = false;

let pendingActionType = null;
let pendingTargetId = null;

// Helper Functions
function getHighestIDNumber(memberList, prefix) {
  let maxNum = 0;
  memberList.forEach(member => {
    if (member.id && member.id.startsWith(prefix)) {
      const numPart = parseInt(member.id.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  });
  return maxNum;
}

function formatID(prefix, number) {
  return prefix + String(number).padStart(3, '0');
}

function setStatus(msg) {
  document.getElementById('statusBanner').innerText = "STATUS: " + msg;
}

function getPaymentsArray(raw) {
  if (!raw) return new Array(50).fill('');
  if (Array.isArray(raw)) return raw;
  const arr = new Array(50).fill('');
  Object.keys(raw).forEach(k => {
    const idx = parseInt(k, 10);
    if (!isNaN(idx) && idx < 50) arr[idx] = raw[k];
  });
  return arr;
}

function clearProfileForm() {
  const idInput = document.getElementById('memberId');
  idInput.value = '';
  idInput.readOnly = false;
  isEditingExistingMember = false;

  document.getElementById('name').value = '';
  document.getElementById('age').value = '';
  document.getElementById('phone').value = '';
  document.getElementById('familyTies').value = '';
  document.getElementById('roleType').value = 'Member';
  document.getElementById('memberPassword').value = '';
  document.getElementById('profWeeksPaid').innerText = '0';
  document.getElementById('profAmountSaved').innerText = '₦0';
  document.getElementById('profLoanAmount').innerText = '₦0';
  document.getElementById('profLoanPaid').innerText = '₦0';
  document.getElementById('profLoanBalance').innerText = '₦0';
  document.getElementById('profNetBalance').innerText = '₦0';
}

// Generate 50-Week Grid Inputs
const grid = document.getElementById('grid50');
if (grid) {
  for (let i = 0; i < 50; i++) {
    grid.innerHTML += `
      <div class="grid-cell">
        <span class="grid-label">Wk ${i + 1}</span>
        <input type="number" class="grid-input" id="wk_${i}">
      </div>`;
  }
}

// Monitor Authentication State on Main Dashboard Page
auth.onAuthStateChanged((user) => {
  if (user && user.email) {
    const userEmailPrefix = user.email.split('@')[0].toUpperCase();
    currentUserId = userEmailPrefix;
    isEditor = userEmailPrefix.startsWith('E-');

    if (isEditor) {
      document.getElementById('roleBadge').innerText = `Role: Editor (${currentUserId})`;
      document.getElementById('roleBadge').style.background = "#28a745";
    } else {
      document.getElementById('roleBadge').innerText = `Role: Member (${currentUserId})`;
      document.getElementById('roleBadge').style.background = "#333366";
    }

    setStatus(`Signed in as ${currentUserId}`);
    attachDatabaseListener();
  } else {
    // Unauthenticated access: Kick user back to login.html page
    window.location.href = "login.html";
  }
});

function attachDatabaseListener() {
  db.ref('members').on('value', (snapshot) => {
    const data = snapshot.val();
    members = data ? Object.values(data) : [];
    renderMembers();
    renderSummary();
  }, (error) => {
    setStatus("Database Error: " + error.message);
  });
}

// Sign Out Event Listener
document.getElementById('logoutBtn').addEventListener('click', () => {
  auth.signOut().then(() => {
    window.location.href = "login.html";
  });
});

// Tab Switcher
document.querySelectorAll('.tab-item').forEach(item => {
  item.addEventListener('click', function() {
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    this.classList.add('active');
    const tabName = this.getAttribute('data-tab');
    document.getElementById('tab-' + tabName).classList.add('active');
  });
});

function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}
document.querySelectorAll('.btn-close-modal').forEach(b => b.addEventListener('click', closeModals));

// Generate New Sequential ID
document.getElementById('btnNewID').addEventListener('click', () => {
  clearProfileForm();
  const role = document.getElementById('roleType').value;
  const idInput = document.getElementById('memberId');
  
  if (role === 'Editor') {
    const hasE001 = members.some(m => m.id && m.id.toUpperCase() === 'E-001');
    const hasE002 = members.some(m => m.id && m.id.toUpperCase() === 'E-002');

    if (!hasE001) idInput.value = 'E-001';
    else if (!hasE002) idInput.value = 'E-002';
    else return alert("Maximum Editor limit reached! Only E-001 and E-002 are allowed.");
  } else {
    const maxNum = getHighestIDNumber(members, 'M-');
    idInput.value = formatID('M-', maxNum + 1);
  }

  idInput.readOnly = true;
  isEditingExistingMember = false;
  setStatus("Generated ID: " + idInput.value);
});

// Load Member Profile
document.getElementById('btnLoadProfile').addEventListener('click', () => {
  const inputId = document.getElementById('memberId').value.trim().toUpperCase();
  if (!inputId) return alert("Enter Member ID to load!");

  let m = members.find(mem => mem.id && mem.id.toUpperCase() === inputId);
  if (!m) return alert(`Member ID '${inputId}' not found.`);

  document.getElementById('name').value = m.name || '';
  document.getElementById('age').value = m.age || '';
  document.getElementById('phone').value = m.phone || '';
  document.getElementById('familyTies').value = m.familyTies || '';
  document.getElementById('roleType').value = m.isEditor ? 'Editor' : 'Member';

  const payments = getPaymentsArray(m.weeklyPayments);
  const wPaid = payments.filter(val => val !== "" && val !== null && !isNaN(val)).length;
  const amountSaved = payments.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  const lAmt = parseFloat(m.loanAmount) || 0;
  const lPaid = parseFloat(m.loanPaid) || 0;
  const lBal = Math.max(0, lAmt - lPaid);
  const netBal = amountSaved - lBal;

  document.getElementById('profWeeksPaid').innerText = wPaid;
  document.getElementById('profAmountSaved').innerText = `₦${amountSaved.toLocaleString()}`;
  document.getElementById('profLoanAmount').innerText = `₦${lAmt.toLocaleString()}`;
  document.getElementById('profLoanPaid').innerText = `₦${lPaid.toLocaleString()}`;
  document.getElementById('profLoanBalance').innerText = `₦${lBal.toLocaleString()}`;
  document.getElementById('profNetBalance').innerText = `₦${netBal.toLocaleString()}`;

  document.getElementById('memberId').value = inputId;
  document.getElementById('memberId').readOnly = true;
  isEditingExistingMember = true;

  setStatus(`Loaded Member ${inputId}`);
});

// Save Member Info & Register Authentication
document.getElementById('btnSaveMember').addEventListener('click', async () => {
  if (!isEditor) return alert("Action Denied: Editor permissions required.");

  const typedId = document.getElementById('memberId').value.trim().toUpperCase();
  const name = document.getElementById('name').value.trim();
  const pass = document.getElementById('memberPassword').value;

  if (!typedId || !name) return alert("Please enter both Member ID and Name.");

  const isEditorRole = document.getElementById('roleType').value === 'Editor';
  const existingMember = members.find(m => m.id && m.id.toUpperCase() === typedId);

  if (!existingMember && !pass) {
    return alert("A password is required to create a new account for this member.");
  }

  const memberObj = {
    id: typedId,
    name: name,
    age: document.getElementById('age').value,
    phone: document.getElementById('phone').value,
    familyTies: document.getElementById('familyTies').value,
    isEditor: isEditorRole,
    weeklyPayments: (existingMember && existingMember.weeklyPayments) || new Array(50).fill(''),
    loanAmount: (existingMember && existingMember.loanAmount) || 0,
    loanPaid: (existingMember && existingMember.loanPaid) || 0
  };

  try {
    if (!existingMember) {
      const userEmail = typedId.toLowerCase() + "@maqali.app";
      await auth.createUserWithEmailAndPassword(userEmail, pass);
    }

    await db.ref('members/' + typedId).set(memberObj);
    alert(`Member ${typedId} saved successfully!`);
    clearProfileForm();
    setStatus(`Member ${typedId} updated.`);
  } catch (error) {
    alert("Operation failed: " + error.message);
  }
});

// Load & Save Payments
document.getElementById('btnLoadWeekly').addEventListener('click', () => {
  const id = document.getElementById('weeklyMemberId').value.trim().toUpperCase();
  const nameTag = document.getElementById('weeklyMemberName');
  if (!id) return alert("Enter Member ID.");

  const m = members.find(mem => mem.id && mem.id.toUpperCase() === id);
  if (!m) return alert(`Member ID ${id} not found.`);

  nameTag.innerText = `Member: ${m.name || 'Unnamed'}`;
  const payments = getPaymentsArray(m.weeklyPayments);
  for (let i = 0; i < 50; i++) {
    document.getElementById(`wk_${i}`).value = payments[i] !== undefined ? payments[i] : '';
  }
});

document.getElementById('btnSavePayments').addEventListener('click', () => {
  if (!isEditor) return alert("Editor permission required.");
  const id = document.getElementById('weeklyMemberId').value.trim().toUpperCase();
  if (!id) return alert("Enter Member ID first.");

  const payments = [];
  for (let i = 0; i < 50; i++) {
    payments.push(document.getElementById(`wk_${i}`).value);
  }

  db.ref(`members/${id}/weeklyPayments`).set(payments)
    .then(() => alert("Weekly payments saved!"))
    .catch(err => alert("Save failed: " + err.message));
});

// Loans Management
document.getElementById('btnLoadLoans').addEventListener('click', () => {
  const id = document.getElementById('loansMemberId').value.trim().toUpperCase();
  const nameTag = document.getElementById('loansMemberName');
  if (!id) return alert("Enter Member ID.");

  const m = members.find(mem => mem.id && mem.id.toUpperCase() === id);
  if (!m) return alert(`Member ID ${id} not found.`);

  nameTag.innerText = `Member: ${m.name || 'Unnamed'}`;
  const lAmt = parseFloat(m.loanAmount) || 0;
  const lPaid = parseFloat(m.loanPaid) || 0;

  document.getElementById('loanTotalVal').innerText = `₦${lAmt.toLocaleString()}`;
  document.getElementById('loanPaidVal').innerText = `₦${lPaid.toLocaleString()}`;
  document.getElementById('loanBalVal').innerText = `₦${Math.max(0, lAmt - lPaid).toLocaleString()}`;
});

document.getElementById('btnAddLoan').addEventListener('click', () => {
  if (!isEditor) return alert("Editor permission required.");
  const id = document.getElementById('loansMemberId').value.trim().toUpperCase();
  const amt = parseFloat(document.getElementById('newLoanInput').value) || 0;
  if (!id || amt <= 0) return alert("Provide valid ID and loan amount.");

  const m = members.find(mem => mem.id && mem.id.toUpperCase() === id) || {};
  const current = parseFloat(m.loanAmount) || 0;

  db.ref(`members/${id}/loanAmount`).set(current + amt).then(() => {
    alert("Loan added!");
    document.getElementById('newLoanInput').value = '';
  });
});

document.getElementById('btnPayLoan').addEventListener('click', () => {
  if (!isEditor) return alert("Editor permission required.");
  const id = document.getElementById('loansMemberId').value.trim().toUpperCase();
  const amt = parseFloat(document.getElementById('payLoanInput').value) || 0;
  if (!id || amt <= 0) return alert("Provide valid ID and payment amount.");

  const m = members.find(mem => mem.id && mem.id.toUpperCase() === id) || {};
  const current = parseFloat(m.loanPaid) || 0;

  db.ref(`members/${id}/loanPaid`).set(current + amt).then(() => {
    alert("Repayment recorded!");
    document.getElementById('payLoanInput').value = '';
  });
});

// Member Deletion and Admin PIN Verification
function initiateDeleteMember(id) {
  if (!isEditor) return alert("Action Denied: Only Editors can delete members.");
  pendingActionType = 'DELETE';
  pendingTargetId = id;
  document.getElementById('securityPinInput').value = '';
  document.getElementById('securityPinSubTitle').innerText = `Enter Admin PIN to delete member ${id}`;
  document.getElementById('modalSecurityPin').classList.add('active');
}

function initiateResetMember(id) {
  if (!isEditor) return alert("Action Denied: Only Editors can reset financial records.");
  pendingActionType = 'RESET_SINGLE';
  pendingTargetId = id;
  document.getElementById('securityPinInput').value = '';
  document.getElementById('securityPinSubTitle').innerText = `Enter Admin PIN to reset financial records for member ${id}`;
  document.getElementById('modalSecurityPin').classList.add('active');
}

document.getElementById('btnGeneralReset').addEventListener('click', () => {
  if (!isEditor) return alert("Action Denied: Only Editors can reset financial records.");
  pendingActionType = 'RESET_ALL';
  pendingTargetId = null;
  document.getElementById('securityPinInput').value = '';
  document.getElementById('securityPinSubTitle').innerText = "Enter Admin PIN to reset financial records for ALL members";
  document.getElementById('modalSecurityPin').classList.add('active');
});

document.getElementById('btnVerifySecurityPin').addEventListener('click', () => {
  const inputPin = document.getElementById('securityPinInput').value.trim();
  if (!inputPin) return alert("Please enter Admin Security PIN.");

  db.ref('system/masterPin').once('value').then(snap => {
    const actualPin = snap.val();
    if (!actualPin || String(actualPin) !== inputPin) throw new Error("Incorrect Master PIN!");

    closeModals();

    if (pendingActionType === 'DELETE') {
      document.getElementById('actionConfirmTitle').innerText = "CONFIRM DELETION";
      document.getElementById('actionConfirmMsg').innerText = `Delete member ${pendingTargetId}? This action cannot be undone.`;
    } else if (pendingActionType === 'RESET_SINGLE') {
      document.getElementById('actionConfirmTitle').innerText = "CONFIRM MEMBER RESET";
      document.getElementById('actionConfirmMsg').innerText = `Reset financial records for ${pendingTargetId}?`;
    } else if (pendingActionType === 'RESET_ALL') {
      document.getElementById('actionConfirmTitle').innerText = "CONFIRM RESET ALL MEMBERS";
      document.getElementById('actionConfirmMsg').innerText = "Reset financial records for ALL members?";
    }

    document.getElementById('modalActionConfirm').classList.add('active');
  }).catch(err => alert(err.message));
});

document.getElementById('btnExecuteAction').addEventListener('click', () => {
  if (pendingActionType === 'DELETE') {
    db.ref('members/' + pendingTargetId).remove().then(() => {
      alert(`Member ${pendingTargetId} deleted successfully.`);
      closeModals();
    });
  } else if (pendingActionType === 'RESET_SINGLE') {
    const updates = {};
    updates[`members/${pendingTargetId}/weeklyPayments`] = null;
    updates[`members/${pendingTargetId}/loanAmount`] = 0;
    updates[`members/${pendingTargetId}/loanPaid`] = 0;
    db.ref().update(updates).then(() => {
      alert(`Records for ${pendingTargetId} reset.`);
      closeModals();
    });
  } else if (pendingActionType === 'RESET_ALL') {
    const updates = {};
    members.forEach(m => {
      if (m.id) {
        updates[`members/${m.id}/weeklyPayments`] = null;
        updates[`members/${m.id}/loanAmount`] = 0;
        updates[`members/${m.id}/loanPaid`] = 0;
      }
    });
    db.ref().update(updates).then(() => {
      alert("All records reset.");
      closeModals();
    });
  }
});

// Render UI Components
document.getElementById('btnSearchMember').addEventListener('click', () => {
  renderMembers(document.getElementById('searchMemberId').value.trim());
});

function renderMembers(filterQuery = '') {
  const container = document.getElementById('membersListContainer');
  if (!container) return;

  let listToRender = members;
  if (filterQuery) {
    const q = filterQuery.trim().toUpperCase();
    listToRender = members.filter(m => 
      (m.id && m.id.toUpperCase().includes(q)) || 
      (m.name && m.name.toUpperCase().includes(q))
    );
  }

  if (listToRender.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:20px; color:#aaa; font-size:12px;">No members found.</div>`;
    return;
  }

  let html = '';
  listToRender.forEach(m => {
    const payments = getPaymentsArray(m.weeklyPayments);
    const amountSaved = payments.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    const lAmt = parseFloat(m.loanAmount) || 0;
    const lPaid = parseFloat(m.loanPaid) || 0;

    html += `
      <div class="member-card">
        <div class="member-info">
          <div class="member-header">
            <span>${m.name || 'Unnamed'} (${m.id || 'N/A'})</span>
            <span style="color:${m.isEditor ? '#28a745' : '#888'}; font-size: 10px;">${m.isEditor ? 'Editor' : 'Member'}</span>
          </div>
          <div>Phone: ${m.phone || 'N/A'} | Ties: ${m.familyTies || 'N/A'}</div>
          <div style="margin-top:4px;">
            Saved: <b style="color:#51cf66;">₦${amountSaved.toLocaleString()}</b> | 
            Loan Bal: <b style="color:#ff6b6b;">₦${Math.max(0, lAmt - lPaid).toLocaleString()}</b>
          </div>
        </div>
        <div class="card-actions">
          <button class="icon-action-btn delete-btn" onclick="initiateDeleteMember('${m.id}')" title="Delete Member">
            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
          <button class="icon-action-btn reset-btn" onclick="initiateResetMember('${m.id}')" title="Reset Member Financials">
            <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
          </button>
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

function renderSummary() {
  let totalSaved = 0, totalLoans = 0, totalRepaid = 0;

  members.forEach(m => {
    const payments = getPaymentsArray(m.weeklyPayments);
    totalSaved += payments.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    totalLoans += parseFloat(m.loanAmount) || 0;
    totalRepaid += parseFloat(m.loanPaid) || 0;
  });

  const totalLoanBal = Math.max(0, totalLoans - totalRepaid);

  document.getElementById('sumTotalSaved').innerText = `₦${totalSaved.toLocaleString()}`;
  document.getElementById('sumTotalLoans').innerText = `₦${totalLoans.toLocaleString()}`;
  document.getElementById('sumTotalRepaid').innerText = `₦${totalRepaid.toLocaleString()}`;
  document.getElementById('sumTotalLoanBal').innerText = `₦${totalLoanBal.toLocaleString()}`;
  document.getElementById('sumGrandNet').innerText = `₦${(totalSaved - totalLoanBal).toLocaleString()}`;
  document.getElementById('sumTotalMembers').innerText = members.length;
}
