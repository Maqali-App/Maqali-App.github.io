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

firebase.initializeApp(firebaseConfig);

if (firebase.database.INTERNAL && firebase.database.INTERNAL.forceLongPolling) {
  firebase.database.INTERNAL.forceLongPolling();
}

const db = firebase.database();
firebase.auth().signInAnonymously();

let members = [];
let isEditor = false;
let activeEditorId = "";
let isEditingExistingMember = false;

let pendingActionType = null;
let pendingTargetId = null;

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

function applyEditorUI(editorId) {
  isEditor = true;
  activeEditorId = editorId;
  document.getElementById('roleBadge').innerText = `Role: Editor (${editorId})`;
  document.getElementById('roleBadge').style.background = "#28a745";
  document.getElementById('loginBtn').innerText = "Logout";
}

function restoreSession() {
  const savedEditorId = localStorage.getItem('activeEditorId');
  if (savedEditorId) {
    applyEditorUI(savedEditorId);
    setStatus(`Session restored as Editor ${savedEditorId}`);
  }
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
  document.getElementById('profWeeksPaid').innerText = '0';
  document.getElementById('profAmountSaved').innerText = '₦0';
  document.getElementById('profLoanAmount').innerText = '₦0';
  document.getElementById('profLoanPaid').innerText = '₦0';
  document.getElementById('profLoanBalance').innerText = '₦0';
  document.getElementById('profNetBalance').innerText = '₦0';
}

const grid = document.getElementById('grid50');
for (let i = 0; i < 50; i++) {
  grid.innerHTML += `
    <div class="grid-cell">
      <span class="grid-label">Wk ${i + 1}</span>
      <input type="number" class="grid-input" id="wk_${i}">
    </div>`;
}

db.ref('.info/connected').on('value', (snap) => {
  if (snap.val() === true) {
    setStatus("Connected to Cloud Database.");
  } else {
    setStatus("Connecting / Disconnected from Cloud Server...");
  }
});

db.ref('members').on('value', (snapshot) => {
  const data = snapshot.val();
  members = data ? Object.values(data) : [];
  renderMembers();
  renderSummary();
  restoreSession();
}, (error) => {
  setStatus("Database Error: " + error.message);
});

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

document.getElementById('btnNewID').addEventListener('click', () => {
  clearProfileForm();
  const role = document.getElementById('roleType').value;
  const idInput = document.getElementById('memberId');
  
  if (role === 'Editor') {
    const hasE001 = members.some(m => m.id && m.id.toUpperCase() === 'E-001');
    const hasE002 = members.some(m => m.id && m.id.toUpperCase() === 'E-002');

    if (!hasE001) {
      idInput.value = 'E-001';
    } else if (!hasE002) {
      idInput.value = 'E-002';
    } else {
      alert("Maximum Editor limit reached! Only E-001 and E-002 are allowed.");
      return;
    }
  } else {
    const maxNum = getHighestIDNumber(members, 'M-');
    idInput.value = formatID('M-', maxNum + 1);
  }

  idInput.readOnly = true;
  isEditingExistingMember = false;
  setStatus("Generated New ID: " + idInput.value);
});

document.getElementById('btnLoadProfile').addEventListener('click', () => {
  const inputId = document.getElementById('memberId').value.trim().toUpperCase();
  if (!inputId) return alert("Please enter a Member ID to load!");

  let m = members.find(mem => mem.id && mem.id.toUpperCase() === inputId);
  if (!m) {
    alert(`Member ID '${inputId}' not found in database.`);
    return;
  }

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

document.getElementById('btnSaveMember').addEventListener('click', async () => {
  if (!isEditor) return alert("Action Denied: You must be logged in as an Editor.");

  const typedId = document.getElementById('memberId').value.trim().toUpperCase();
  const name = document.getElementById('name').value.trim();

  if (!typedId || !name) {
    alert("Please enter both Member ID and Name.");
    return;
  }

  if (!typedId.startsWith('M-') && !typedId.startsWith('E-')) {
    return alert("Security Alert: Invalid ID format! IDs must start with 'M-' or 'E-' (e.g. M-001 or E-001). Custom numbers are not permitted.");
  }

  if (typedId.startsWith('E-') && typedId !== 'E-001' && typedId !== 'E-002') {
    return alert("Invalid Editor ID. Only E-001 and E-002 are allowed.");
  }

  const existingMember = members.find(m => m.id && m.id.toUpperCase() === typedId);

  if (!existingMember) {
    const prefix = typedId.startsWith('E-') ? 'E-' : 'M-';

    const maxNum = getHighestIDNumber(members, prefix);
    const expectedNextId = formatID(prefix, maxNum + 1);

    if (typedId !== expectedNextId) {
      alert(`Invalid Sequence! You cannot skip IDs.\nThe next required sequential ID is: ${expectedNextId}`);
      return;
    }
  }

  const isEditorRole = document.getElementById('roleType').value === 'Editor';
  let existing = existingMember || {};

  const memberObj = {
    id: typedId,
    name: name,
    age: document.getElementById('age').value,
    phone: document.getElementById('phone').value,
    familyTies: document.getElementById('familyTies').value,
    isEditor: isEditorRole,
    password: existing.password || "",
    weeklyPayments: existing.weeklyPayments || new Array(50).fill(''),
    loanAmount: existing.loanAmount || 0,
    loanPaid: existing.loanPaid || 0
  };

  try {
    await db.ref('members/' + typedId).set(memberObj);
    alert(`Member ${typedId} saved successfully!`);
    clearProfileForm();
    setStatus(`Member ${typedId} saved.`);
  } catch (error) {
    console.error("Error saving member:", error);
    alert("Failed to save member: " + error.message);
  }
});

document.getElementById('loginBtn').addEventListener('click', () => {
  if (isEditor) {
    isEditor = false;
    activeEditorId = "";
    localStorage.removeItem('activeEditorId');
    document.getElementById('roleBadge').innerText = "Role: Viewer (Read-Only)";
    document.getElementById('roleBadge').style.background = "#333366";
    document.getElementById('loginBtn').innerText = "Editor Login";
    setStatus("Logged out. Switched to Viewer Mode.");
  } else {
    document.getElementById('modalLogin').classList.add('active');
  }
});

document.getElementById('btnSubmitLogin').addEventListener('click', () => {
  const id = document.getElementById('loginIdInput').value.trim().toUpperCase();
  const pass = document.getElementById('loginPassInput').value;

  if (id !== 'E-001' && id !== 'E-002') {
    return alert("Access Denied: Only Editor IDs E-001 and E-002 are valid.");
  }

  db.ref('members/' + id).once('value').then(snap => {
    const editorData = snap.val();
    if (!editorData || !editorData.password) {
      return alert("Editor profile not found or password missing.");
    }

    if (editorData.password === pass) {
      localStorage.setItem('activeEditorId', id);
      applyEditorUI(id);
      closeModals();
      setStatus(`Logged in as Editor ${id}`);
    } else {
      alert("Incorrect Password!");
    }
  });
});

document.getElementById('btnOpenReset').addEventListener('click', () => {
  closeModals();
  document.getElementById('modalReset').classList.add('active');
});

document.getElementById('btnVerifyReset').addEventListener('click', () => {
  const id = document.getElementById('resetIdInput').value.trim().toUpperCase();
  if (id !== 'E-001' && id !== 'E-002') {
    document.getElementById('resetStatusMsg').innerText = "Error: Editor ID must be E-001 or E-002";
    return;
  }

  db.ref('members/' + id).once('value').then(snap => {
    if (!snap.exists()) {
      document.getElementById('resetStatusMsg').innerText = `Error: ${id} does not exist in database yet.`;
      document.getElementById('resetFields').style.display = 'none';
      return;
    }
    document.getElementById('resetStatusMsg').innerText = `Editor ID ${id} verified. Enter Master PIN below.`;
    document.getElementById('resetFields').style.display = 'block';
  });
});

document.getElementById('btnSubmitReset').addEventListener('click', () => {
  const id = document.getElementById('resetIdInput').value.trim().toUpperCase();
  const inputPin = document.getElementById('resetMasterPin').value.trim();
  const p1 = document.getElementById('resetNewPass').value;
  const p2 = document.getElementById('resetVerPass').value;

  if (!id) return alert("Please enter an Editor ID.");
  if (!inputPin) return alert("Admin Master PIN is required.");
  if (!p1 || p1 !== p2) return alert("New passwords do not match.");

  db.ref('system/masterPin').once('value')
    .then(snap => {
      const actualPin = snap.val();
      if (!actualPin) throw new Error("masterPin is missing in database under 'system/masterPin'.");
      if (String(actualPin) !== inputPin) throw new Error("Access Denied: Incorrect Master PIN!");
      return db.ref('members/' + id).once('value');
    })
    .then(memberSnap => {
      if (!memberSnap.exists()) throw new Error("Editor ID '" + id + "' was not found.");
      return db.ref('members/' + id + '/password').set(p1);
    })
    .then(() => {
      alert(`Password for Editor ${id} updated successfully!`);
      document.getElementById('resetIdInput').value = '';
      document.getElementById('resetMasterPin').value = '';
      document.getElementById('resetNewPass').value = '';
      document.getElementById('resetVerPass').value = '';
      document.getElementById('resetFields').style.display = 'none';
      document.getElementById('resetStatusMsg').innerText = '';
      closeModals();
    })
    .catch(err => alert(err.message));
});

document.getElementById('btnLoadWeekly').addEventListener('click', () => {
  const id = document.getElementById('weeklyMemberId').value.trim().toUpperCase();
  const nameTag = document.getElementById('weeklyMemberName');

  if (!id) {
    nameTag.innerText = '';
    return alert("Please enter a Member ID.");
  }

  const m = members.find(mem => mem.id && mem.id.toUpperCase() === id);
  if (!m) {
    nameTag.innerText = '';
    return alert(`Member ID ${id} not found.`);
  }

  nameTag.innerText = `Member: ${m.name || 'Unnamed'}`;

  const payments = getPaymentsArray(m.weeklyPayments);
  for (let i = 0; i < 50; i++) {
    document.getElementById(`wk_${i}`).value = payments[i] !== undefined ? payments[i] : '';
  }
  setStatus(`Weekly grid loaded for ${id} (${m.name})`);
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
    .then(() => {
      alert("Weekly payments saved!");
      setStatus(`Weekly payments saved for ${id}`);
    })
    .catch(err => alert("Save failed: " + err.message));
});

document.getElementById('btnLoadLoans').addEventListener('click', () => {
  const id = document.getElementById('loansMemberId').value.trim().toUpperCase();
  const nameTag = document.getElementById('loansMemberName');

  if (!id) {
    nameTag.innerText = '';
    return alert("Please enter a Member ID.");
  }

  const m = members.find(mem => mem.id && mem.id.toUpperCase() === id);
  if (!m) {
    nameTag.innerText = '';
    return alert(`Member ID ${id} not found.`);
  }

  nameTag.innerText = `Member: ${m.name || 'Unnamed'}`;

  const lAmt = parseFloat(m.loanAmount) || 0;
  const lPaid = parseFloat(m.loanPaid) || 0;
  const lBal = Math.max(0, lAmt - lPaid);

  document.getElementById('loanTotalVal').innerText = `₦${lAmt.toLocaleString()}`;
  document.getElementById('loanPaidVal').innerText = `₦${lPaid.toLocaleString()}`;
  document.getElementById('loanBalVal').innerText = `₦${lBal.toLocaleString()}`;
  setStatus(`Loan details loaded for ${id} (${m.name})`);
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
    setStatus(`Added ₦${amt} loan to ${id}`);
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
    setStatus(`Recorded ₦${amt} repayment for ${id}`);
  });
});

document.getElementById('btnSearchMember').addEventListener('click', () => {
  const query = document.getElementById('searchMemberId').value.trim();
  renderMembers(query);
});

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
    if (!actualPin) throw new Error("masterPin missing in database under 'system/masterPin'.");
    if (String(actualPin) !== inputPin) throw new Error("Incorrect Master PIN!");

    closeModals();

    if (pendingActionType === 'DELETE') {
      const m = members.find(mem => mem.id && mem.id.toUpperCase() === pendingTargetId);
      const name = m ? m.name : pendingTargetId;
      document.getElementById('actionConfirmTitle').innerText = "CONFIRM DELETION";
      document.getElementById('actionConfirmMsg').innerText = `Are you sure you want to delete member ${name} (${pendingTargetId})? This action cannot be undone.`;
    } else if (pendingActionType === 'RESET_SINGLE') {
      const m = members.find(mem => mem.id && mem.id.toUpperCase() === pendingTargetId);
      const name = m ? m.name : pendingTargetId;
      document.getElementById('actionConfirmTitle').innerText = "CONFIRM MEMBER RESET";
      document.getElementById('actionConfirmMsg').innerText = `Are you sure you want to reset all financial records (weekly payments & loans) for member ${name} (${pendingTargetId})?`;
    } else if (pendingActionType === 'RESET_ALL') {
      document.getElementById('actionConfirmTitle').innerText = "CONFIRM RESET ALL MEMBERS";
      document.getElementById('actionConfirmMsg').innerText = "DANGER: Are you sure you want to reset ALL financial records (weekly payments & loans) for ALL members in the system? This action cannot be undone!";
    }

    document.getElementById('modalActionConfirm').classList.add('active');
  }).catch(err => alert(err.message));
});

document.getElementById('btnExecuteAction').addEventListener('click', () => {
  if (pendingActionType === 'DELETE') {
    if (!pendingTargetId) return;
    db.ref('members/' + pendingTargetId).remove().then(() => {
      alert(`Member ${pendingTargetId} deleted successfully.`);
      setStatus(`Member ${pendingTargetId} deleted.`);
      closeModals();
      resetPendingAction();
    }).catch(err => alert("Delete failed: " + err.message));

  } else if (pendingActionType === 'RESET_SINGLE') {
    if (!pendingTargetId) return;
    
    const updates = {};
    updates[`members/${pendingTargetId}/weeklyPayments`] = null;
    updates[`members/${pendingTargetId}/loanAmount`] = 0;
    updates[`members/${pendingTargetId}/loanPaid`] = 0;

    db.ref().update(updates).then(() => {
      alert(`Financial records for member ${pendingTargetId} reset successfully.`);
      setStatus(`Financial records for ${pendingTargetId} reset.`);
      closeModals();
      resetPendingAction();
    }).catch(err => alert("Reset failed: " + err.message));

  } else if (pendingActionType === 'RESET_ALL') {
    const updates = {};
    members.forEach(m => {
      if (m.id) {
        updates[`${m.id}/weeklyPayments`] = null;
        updates[`${m.id}/loanAmount`] = 0;
        updates[`${m.id}/loanPaid`] = 0;
      }
    });

    db.ref('members').update(updates).then(() => {
      alert("All financial records for all members have been reset.");
      setStatus("All members' financial records reset.");
      closeModals();
      resetPendingAction();
    }).catch(err => alert("Global reset failed: " + err.message));
  }
});

function resetPendingAction() {
  pendingActionType = null;
  pendingTargetId = null;
}

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
    container.innerHTML = `<div style="text-align:center; padding:20px; color:#aaa; font-size:12px;">
      ${filterQuery ? `No members found matching "${filterQuery}".` : 'No members recorded.'}
    </div>`;
    return;
  }

  let html = '';
  listToRender.forEach(m => {
    const payments = getPaymentsArray(m.weeklyPayments);
    const amountSaved = payments.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    const lAmt = parseFloat(m.loanAmount) || 0;
    const lPaid = parseFloat(m.loanPaid) || 0;
    const lBal = Math.max(0, lAmt - lPaid);

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
            Loan Bal: <b style="color:#ff6b6b;">₦${lBal.toLocaleString()}</b>
          </div>
        </div>
        <div class="card-actions">
          <button class="icon-action-btn delete-btn" onclick="initiateDeleteMember('${m.id}')" title="Delete Member">
            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
          <button class="icon-action-btn reset-btn" onclick="initiateResetMember('${m.id}')" title="Reset Member Financials">
            <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-8z"/></svg>
          </button>
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

function renderSummary() {
  let totalSaved = 0;
  let totalLoans = 0;
  let totalRepaid = 0;

  members.forEach(m => {
    const payments = getPaymentsArray(m.weeklyPayments);
    totalSaved += payments.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    totalLoans += parseFloat(m.loanAmount) || 0;
    totalRepaid += parseFloat(m.loanPaid) || 0;
  });

  const totalLoanBal = Math.max(0, totalLoans - totalRepaid);
  const grandNet = totalSaved - totalLoanBal;

  document.getElementById('sumTotalSaved').innerText = `₦${totalSaved.toLocaleString()}`;
  document.getElementById('sumTotalLoans').innerText = `₦${totalLoans.toLocaleString()}`;
  document.getElementById('sumTotalRepaid').innerText = `₦${totalRepaid.toLocaleString()}`;
  document.getElementById('sumTotalLoanBal').innerText = `₦${totalLoanBal.toLocaleString()}`;
  document.getElementById('sumGrandNet').innerText = `₦${grandNet.toLocaleString()}`;
  document.getElementById('sumTotalMembers').innerText = members.length;
}
