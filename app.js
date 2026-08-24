// APP.JS – Full version with self-healing editor records, direct member fetch, swipe navigation, privacy, logout confirmation

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
const db = firebase.database();
const auth = firebase.auth();

// Temporary anonymous sign-in for read access (guest)
auth.signInAnonymously().catch(err => console.warn("Guest sign-in failed:", err));

let members = [];
let isEditor = false;
let activeUserId = "";
let activeUserRole = "viewer";
let isEditingExistingMember = false;

let pendingActionType = null;
let pendingTargetId = null;
let membersListener = null;

const DEFAULT_PASSWORD = "1234";
const EMAIL_DOMAIN = "@maqali.com";

function getHighestIDNumber(memberList, prefix) {
  let maxNum = 0;
  memberList.forEach(member => {
    if (typeof member.id === 'string' && member.id.startsWith(prefix)) {
      const numPart = parseInt(member.id.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
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

function maskID(id) {
  if (!id) return 'N/A';
  const prefix = id.charAt(0);
  return prefix + '-***';
}

// ------------------- UI STATE MANAGEMENT -------------------
function setViewerMode() {
  isEditor = false;
  activeUserId = "";
  activeUserRole = "viewer";
  document.getElementById('roleBadge').innerText = "Role: Viewer (Not Logged In)";
  document.getElementById('roleBadge').style.background = "#333366";
  document.getElementById('loginBtn').innerText = "Member Login";
  
  updateTabsVisibility();
  lockAllTabs();
  showLoginPrompt();
  detachMembersListener();
  members = [];
  renderMembers();
  renderSummary();
  setStatus("Please log in to access your data.");
}

function applyEditorUI(editorId) {
  isEditor = true;
  activeUserId = editorId;
  activeUserRole = "editor";
  document.getElementById('roleBadge').innerText = `Role: Editor (${editorId})`;
  document.getElementById('roleBadge').style.background = "#28a745";
  document.getElementById('loginBtn').innerText = "Logout";
  
  updateTabsVisibility();
  unlockAllTabs();
  hideLoginPrompt();
  attachMembersListener();
}

function applyMemberUI(memberId) {
  isEditor = false;
  activeUserId = memberId;
  activeUserRole = "member";
  document.getElementById('roleBadge').innerText = `Role: Member (${memberId})`;
  document.getElementById('roleBadge').style.background = "#333366";
  document.getElementById('loginBtn').innerText = "Logout";
  
  updateTabsVisibility();
  unlockAllTabs();
  hideLoginPrompt();
  attachMembersListener();

  ['memberId', 'weeklyMemberId', 'loansMemberId'].forEach(fid => {
    const el = document.getElementById(fid);
    el.value = memberId;
    el.readOnly = true;
  });

  loadProfileForMember(memberId);
  loadWeeklyForMember(memberId);
  loadLoansForMember(memberId);
  renderMembers();
}

function updateTabsVisibility() {
  const tabItems = document.querySelectorAll('.tab-item');
  
  if (activeUserRole === "viewer") {
    tabItems.forEach(tab => {
      const tabName = tab.getAttribute('data-tab');
      tab.style.display = (tabName === 'Profile') ? "flex" : "none";
    });
  } else {
    tabItems.forEach(tab => tab.style.display = "flex");
  }
}

function lockAllTabs() {
  document.querySelectorAll('input, select, button').forEach(el => {
    if (
      el.id !== 'loginBtn' &&
      !el.closest('.modal-overlay') &&
      !el.classList.contains('btn-close-modal')
    ) {
      el.disabled = true;
    }
  });
}

function unlockAllTabs() {
  document.querySelectorAll('input, select, button').forEach(el => {
    if (!el.closest('.modal-overlay')) {
      el.disabled = false;
    }
  });

  if (activeUserRole === "member") {
    ['memberId', 'weeklyMemberId', 'loansMemberId'].forEach(fid => {
      const field = document.getElementById(fid);
      if (field) {
        field.readOnly = true;
        field.disabled = false;
      }
    });
  }
}

function enableModalElements(modalId) {
  document.querySelectorAll(`#${modalId} input, #${modalId} select, #${modalId} button`).forEach(el => {
    el.disabled = false;
  });
}

// ------------------- MEMBERS LISTENER MANAGEMENT -------------------
function attachMembersListener() {
  if (membersListener) return;
  membersListener = db.ref('members').on('value', (snapshot) => {
    const data = snapshot.val();
    members = data ? Object.values(data) : [];
    renderMembers();
    renderSummary();
  }, (error) => {
    setStatus("Database Error: " + error.message);
  });
}

function detachMembersListener() {
  if (membersListener) {
    db.ref('members').off('value', membersListener);
    membersListener = null;
  }
}

// ------------------- LOGIN PROMPT OVERLAY -------------------
function showLoginPrompt() {
  hideLoginPrompt();

  const overlay = document.createElement('div');
  overlay.id = 'loginPromptOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 15px;
  `;

  overlay.innerHTML = `
    <div style="
      background: #000028;
      border: 1px solid #007AFF;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      max-width: 340px;
      width: 100%;
      color: #ffd700;
      font-size: 14px;
      font-weight: bold;
    ">
      <div style="margin-bottom: 10px;">🔒 ACCESS RESTRICTED</div>
      <div style="font-size: 12px; color: #aaa; margin-bottom: 15px;">
        Please log in to view your data.<br>
        Contact an editor if you don't have an account.
      </div>
      <button id="loginPromptBtn" style="
        background: #007AFF;
        color: #fff;
        border: none;
        border-radius: 4px;
        padding: 10px 20px;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
      ">
        Login Now
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('loginPromptBtn').addEventListener('click', () => {
    enableModalElements('modalLogin');
    document.getElementById('modalLogin').classList.add('active');
  });
}

function hideLoginPrompt() {
  const overlay = document.getElementById('loginPromptOverlay');
  if (overlay) overlay.remove();
}

// ------------------- AUTH STATE HANDLER (self‑healing editor records) -------------------
auth.onAuthStateChanged(user => {
  if (user && user.isAnonymous) {
    // Guest user: allow reads but no members listener
    detachMembersListener();
    setViewerMode();
    return;
  }
  
  if (user) {
    // Email/password user
    const emailPrefix = user.email.split('@')[0].toUpperCase(); // e.g., "E-001"

    // Directly fetch the member record by derived ID
    db.ref('members/' + emailPrefix).once('value')
      .then(snap => {
        if (snap.exists()) {
          const member = snap.val();
          // Update uid if missing or mismatched
          if (!member.uid || member.uid !== user.uid) {
            db.ref('members/' + emailPrefix + '/uid').set(user.uid);
          }
          if (member.isEditor) {
            applyEditorUI(member.id);
          } else {
            applyMemberUI(member.id);
          }
          setStatus(`Logged in as ${member.isEditor ? 'Editor' : 'Member'} ${member.id}`);
        } else {
          // Member record missing: if it's an editor ID, create default record
          if (emailPrefix === 'E-001' || emailPrefix === 'E-002') {
            const defaultEditor = {
              id: emailPrefix,
              name: emailPrefix === 'E-001' ? 'Admin Editor' : 'Second Editor',
              age: '',
              phone: '',
              familyTies: '',
              isEditor: true,
              email: user.email,
              uid: user.uid,
              password: DEFAULT_PASSWORD,
              weeklyPayments: [],
              loanAmount: 0,
              loanPaid: 0
            };
            db.ref('members/' + emailPrefix).set(defaultEditor)
              .then(() => {
                applyEditorUI(emailPrefix);
                setStatus(`Editor account created and logged in as ${emailPrefix}`);
              });
          } else {
            auth.signOut();
            setViewerMode();
            setStatus("User not found. Please contact an editor.");
          }
        }
      })
      .catch(err => {
        console.error("Auth fetch error:", err);
        auth.signOut();
        setViewerMode();
      });
  } else {
    // No user (signed out completely) – sign in anonymously again
    detachMembersListener();
    setViewerMode();
    auth.signInAnonymously().catch(err => console.warn("Guest sign-in failed:", err));
  }
});

// ------------------- DATA HELPERS -------------------
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

// Helper to fetch member by ID directly from database (fallback)
async function fetchMemberById(id) {
  try {
    const snap = await db.ref('members/' + id).once('value');
    return snap.val();
  } catch (err) {
    console.error("Direct fetch error:", err);
    return null;
  }
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
  document.getElementById('password').value = '';
  document.getElementById('profWeeksPaid').innerText = '0';
  document.getElementById('profAmountSaved').innerText = '₦0';
  document.getElementById('profLoanAmount').innerText = '₦0';
  document.getElementById('profLoanPaid').innerText = '₦0';
  document.getElementById('profLoanBalance').innerText = '₦0';
  document.getElementById('profNetBalance').innerText = '₦0';
}

// ------------------- BUILD WEEKLY GRID -------------------
const grid = document.getElementById('grid50');
for (let i = 0; i < 50; i++) {
  grid.innerHTML += `
    <div class="grid-cell">
      <span class="grid-label">Wk ${i + 1}</span>
      <input type="number" class="grid-input" id="wk_${i}">
    </div>`;
}

// ------------------- CONNECTION LISTENER -------------------
db.ref('.info/connected').on('value', (snap) => {
  if (snap.val() === true) setStatus("Connected to Cloud Database.");
  else setStatus("Connecting / Disconnected from Cloud Server...");
});

// ------------------- SLIDING TABS (Click) -------------------
document.querySelectorAll('.tab-item').forEach(item => {
  item.addEventListener('click', function() {
    if (activeUserRole === "viewer" && this.getAttribute('data-tab') !== 'Profile') {
      alert("Please log in to access this section.");
      return;
    }
    switchToTab(this);
  });
});

function switchToTab(tabItem) {
  document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  tabItem.classList.add('active');
  const tabName = tabItem.getAttribute('data-tab');
  document.getElementById('tab-' + tabName).classList.add('active');
}

// ------------------- SWIPE NAVIGATION -------------------
const tabContainer = document.getElementById('tabContainer');
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

tabContainer.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

tabContainer.addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].screenX;
  touchEndY = e.changedTouches[0].screenY;
  handleSwipe();
}, { passive: true });

function handleSwipe() {
  const deltaX = touchEndX - touchStartX;
  const deltaY = touchEndY - touchStartY;

  if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
    const visibleTabs = getVisibleTabs();
    if (visibleTabs.length === 0) return;

    const currentIndex = getCurrentTabIndex(visibleTabs);
    if (currentIndex === -1) return;

    let newIndex;
    if (deltaX < 0) {
      newIndex = Math.min(currentIndex + 1, visibleTabs.length - 1);
    } else {
      newIndex = Math.max(currentIndex - 1, 0);
    }

    if (newIndex !== currentIndex) {
      switchToTab(visibleTabs[newIndex]);
    }
  }
}

function getVisibleTabs() {
  return Array.from(document.querySelectorAll('.tab-item')).filter(tab => {
    return tab.style.display !== 'none';
  });
}

function getCurrentTabIndex(visibleTabs) {
  const activeTab = document.querySelector('.tab-item.active');
  return visibleTabs.indexOf(activeTab);
}

function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}
document.querySelectorAll('.btn-close-modal').forEach(b => b.addEventListener('click', closeModals));

// ------------------- PROFILE TAB -------------------
document.getElementById('btnNewID').addEventListener('click', () => {
  if (!isEditor) return alert("Action Denied: Only Editors can create new IDs.");
  const role = document.getElementById('roleType').value;
  clearProfileForm();
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

async function loadProfileForMember(id) {
  let m = members.find(mem => mem.id && mem.id.toUpperCase() === id);
  if (!m) {
    m = await fetchMemberById(id);
    if (!m) {
      alert(`Member ID '${id}' not found.`);
      return;
    }
  }

  document.getElementById('name').value = m.name || '';
  document.getElementById('age').value = m.age || '';
  document.getElementById('phone').value = m.phone || '';
  document.getElementById('familyTies').value = m.familyTies || '';
  document.getElementById('roleType').value = m.isEditor ? 'Editor' : 'Member';
  document.getElementById('password').value = '';

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

  document.getElementById('memberId').value = id;
  document.getElementById('memberId').readOnly = true;
  isEditingExistingMember = true;
  setStatus(`Loaded Profile for ${id}`);
}

document.getElementById('btnLoadProfile').addEventListener('click', async () => {
  if (activeUserRole === "member") {
    await loadProfileForMember(activeUserId);
    return;
  }
  const inputId = document.getElementById('memberId').value.trim().toUpperCase();
  if (!inputId) return alert("Please enter a Member ID to load!");
  await loadProfileForMember(inputId);
});

document.getElementById('btnSaveMember').addEventListener('click', async () => {
  if (!isEditor) return alert("Action Denied: You must be logged in as an Editor.");

  const typedId = document.getElementById('memberId').value.trim().toUpperCase();
  const name = document.getElementById('name').value.trim();
  const passwordInput = document.getElementById('password').value.trim();

  if (!typedId || !name) return alert("Please enter both Member ID and Name.");
  if (!typedId.startsWith('M-') && !typedId.startsWith('E-')) 
    return alert("Security Alert: Invalid ID format! IDs must start with 'M-' or 'E-'.");

  if (typedId.startsWith('E-') && typedId !== 'E-001' && typedId !== 'E-002') 
    return alert("Invalid Editor ID. Only E-001 and E-002 are allowed.");

  const existingMember = members.find(m => m.id && m.id.toUpperCase() === typedId);
  if (!existingMember) {
    const prefix = typedId.startsWith('E-') ? 'E-' : 'M-';
    const maxNum = getHighestIDNumber(members, prefix);
    const expectedNextId = formatID(prefix, maxNum + 1);
    if (typedId !== expectedNextId) {
      alert(`Invalid Sequence! Next required ID is: ${expectedNextId}`);
      return;
    }
  }

  const isEditorRole = document.getElementById('roleType').value === 'Editor';
  if (typedId.startsWith('E-') && !isEditorRole) return alert("E- IDs must be Editor.");
  if (typedId.startsWith('M-') && isEditorRole) return alert("M- IDs cannot be Editor.");

  const email = `${typedId.toLowerCase()}${EMAIL_DOMAIN}`;
  const password = passwordInput || (existingMember ? existingMember.password : DEFAULT_PASSWORD);

  try {
    let uid = existingMember ? existingMember.uid : null;

    if (!existingMember) {
      const signupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`;
      const response = await fetch(signupUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: false })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to create auth user.');
      uid = data.localId;
    } else if (!existingMember.uid) {
      const signupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`;
      const response = await fetch(signupUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: false })
      });
      const data = await response.json();
      if (response.ok) uid = data.localId;
      else if (data.error?.message === 'EMAIL_EXISTS') console.warn(`Auth user already exists for ${email}.`);
    }

    const memberObj = {
      id: typedId,
      name,
      age: document.getElementById('age').value,
      phone: document.getElementById('phone').value,
      familyTies: document.getElementById('familyTies').value,
      isEditor: isEditorRole,
      email,
      uid,
      password,
      weeklyPayments: existingMember ? existingMember.weeklyPayments : new Array(50).fill(''),
      loanAmount: existingMember ? existingMember.loanAmount : 0,
      loanPaid: existingMember ? existingMember.loanPaid : 0
    };

    await db.ref('members/' + typedId).set(memberObj);
    alert(`Member ${typedId} saved successfully!`);
    clearProfileForm();
    setStatus(`Member ${typedId} saved.`);
  } catch (error) {
    console.error("Error saving member:", error);
    alert("Failed to save member: " + error.message);
  }
});

// ------------------- LOGIN / LOGOUT -------------------
document.getElementById('loginBtn').addEventListener('click', () => {
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    pendingActionType = 'LOGOUT';
    document.getElementById('actionConfirmTitle').innerText = "CONFIRM LOGOUT";
    document.getElementById('actionConfirmMsg').innerText = "Are you sure you want to log out?";
    enableModalElements('modalActionConfirm');
    document.getElementById('modalActionConfirm').classList.add('active');
  } else {
    enableModalElements('modalLogin');
    document.getElementById('modalLogin').classList.add('active');
  }
});

document.getElementById('btnSubmitLogin').addEventListener('click', () => {
  const id = document.getElementById('loginIdInput').value.trim().toUpperCase();
  const pass = document.getElementById('loginPassInput').value;
  if (!id) return alert("Please enter your Member ID.");

  const email = `${id.toLowerCase()}${EMAIL_DOMAIN}`;
  auth.signInWithEmailAndPassword(email, pass)
    .then(() => {
      closeModals();
      setStatus("Login successful.");
    })
    .catch(err => alert("Login failed: " + err.message));
});

// ------------------- PASSWORD RECOVERY -------------------
document.getElementById('btnOpenReset').addEventListener('click', () => {
  closeModals();
  enableModalElements('modalReset');
  document.getElementById('modalReset').classList.add('active');
});

document.getElementById('btnVerifyReset').addEventListener('click', () => {
  const id = document.getElementById('resetIdInput').value.trim().toUpperCase();
  if (!id) return alert("Please enter a Member ID.");
  db.ref('members/' + id).once('value').then(snap => {
    if (!snap.exists()) {
      document.getElementById('resetStatusMsg').innerText = `Error: ${id} does not exist.`;
      document.getElementById('resetFields').style.display = 'none';
      return;
    }
    document.getElementById('resetStatusMsg').innerText = `Member ID ${id} verified. Enter Master PIN below.`;
    document.getElementById('resetFields').style.display = 'block';
  }).catch(err => {
    console.error("Recovery load error:", err);
    alert("Failed to load member. Please try again.");
  });
});

document.getElementById('btnSubmitReset').addEventListener('click', () => {
  const id = document.getElementById('resetIdInput').value.trim().toUpperCase();
  const inputPin = document.getElementById('resetMasterPin').value.trim();
  const newPass = document.getElementById('resetNewPass').value;
  const verPass = document.getElementById('resetVerPass').value;
  if (!id || !inputPin) return alert("Please fill all fields.");
  if (newPass !== verPass) return alert("New passwords do not match.");

  db.ref('system/masterPin').once('value')
    .then(snap => {
      const actualPin = snap.val();
      if (!actualPin) throw new Error("Master PIN missing.");
      if (String(actualPin) !== inputPin) throw new Error("Incorrect Master PIN!");
      return db.ref('members/' + id).once('value');
    })
    .then(memberSnap => {
      if (!memberSnap.exists()) throw new Error("Member ID not found.");
      const member = memberSnap.val();
      const email = member.email || `${id.toLowerCase()}${EMAIL_DOMAIN}`;
      const oldPass = member.password || DEFAULT_PASSWORD;
      return auth.signOut()
        .then(() => auth.signInWithEmailAndPassword(email, oldPass))
        .then(userCredential => userCredential.user.updatePassword(newPass))
        .then(() => db.ref('members/' + id + '/password').set(newPass));
    })
    .then(() => {
      alert(`Password for ${id} updated successfully!`);
      document.getElementById('resetIdInput').value = '';
      document.getElementById('resetMasterPin').value = '';
      document.getElementById('resetNewPass').value = '';
      document.getElementById('resetVerPass').value = '';
      document.getElementById('resetFields').style.display = 'none';
      document.getElementById('resetStatusMsg').innerText = '';
      closeModals();
    })
    .catch(err => {
      alert(err.message);
    });
});

// ------------------- WEEKLY TAB -------------------
async function loadWeeklyForMember(id) {
  let m = members.find(mem => mem.id && mem.id.toUpperCase() === id);
  if (!m) {
    m = await fetchMemberById(id);
    if (!m) return alert(`Member ID ${id} not found.`);
  }
  document.getElementById('weeklyMemberId').value = id;
  document.getElementById('weeklyMemberName').innerText = `Member: ${m.name || 'Unnamed'}`;
  const payments = getPaymentsArray(m.weeklyPayments);
  for (let i = 0; i < 50; i++) {
    document.getElementById(`wk_${i}`).value = payments[i] !== undefined ? payments[i] : '';
  }
  setStatus(`Weekly grid loaded for ${id} (${m.name})`);
}

document.getElementById('btnLoadWeekly').addEventListener('click', async () => {
  if (activeUserRole === "member") {
    await loadWeeklyForMember(activeUserId);
    return;
  }
  const id = document.getElementById('weeklyMemberId').value.trim().toUpperCase();
  if (!id) return alert("Please enter a Member ID.");
  await loadWeeklyForMember(id);
});

document.getElementById('btnSavePayments').addEventListener('click', () => {
  if (!isEditor) return alert("Editor permission required.");
  const id = document.getElementById('weeklyMemberId').value.trim().toUpperCase();
  if (!id) return alert("Enter Member ID first.");
  const m = members.find(mem => mem.id && mem.id.toUpperCase() === id);
  if (!m) return alert(`Member ID ${id} not found.`);

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

// ------------------- LOANS TAB -------------------
async function loadLoansForMember(id) {
  let m = members.find(mem => mem.id && mem.id.toUpperCase() === id);
  if (!m) {
    m = await fetchMemberById(id);
    if (!m) return alert(`Member ID ${id} not found.`);
  }
  document.getElementById('loansMemberId').value = id;
  document.getElementById('loansMemberName').innerText = `Member: ${m.name || 'Unnamed'}`;
  const lAmt = parseFloat(m.loanAmount) || 0;
  const lPaid = parseFloat(m.loanPaid) || 0;
  const lBal = Math.max(0, lAmt - lPaid);
  document.getElementById('loanTotalVal').innerText = `₦${lAmt.toLocaleString()}`;
  document.getElementById('loanPaidVal').innerText = `₦${lPaid.toLocaleString()}`;
  document.getElementById('loanBalVal').innerText = `₦${lBal.toLocaleString()}`;
  setStatus(`Loan details loaded for ${id} (${m.name})`);
}

document.getElementById('btnLoadLoans').addEventListener('click', async () => {
  if (activeUserRole === "member") {
    await loadLoansForMember(activeUserId);
    return;
  }
  const id = document.getElementById('loansMemberId').value.trim().toUpperCase();
  if (!id) return alert("Please enter a Member ID.");
  await loadLoansForMember(id);
});

document.getElementById('btnAddLoan').addEventListener('click', () => {
  if (!isEditor) return alert("Editor permission required.");
  const id = document.getElementById('loansMemberId').value.trim().toUpperCase();
  const amt = parseFloat(document.getElementById('newLoanInput').value) || 0;
  if (!id || amt <= 0) return alert("Provide valid ID and loan amount.");
  const m = members.find(mem => mem.id && mem.id.toUpperCase() === id);
  if (!m) return alert(`Member ID ${id} not found.`);
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
  const m = members.find(mem => mem.id && mem.id.toUpperCase() === id);
  if (!m) return alert(`Member ID ${id} not found.`);
  const current = parseFloat(m.loanPaid) || 0;
  db.ref(`members/${id}/loanPaid`).set(current + amt).then(() => {
    alert("Repayment recorded!");
    document.getElementById('payLoanInput').value = '';
    setStatus(`Recorded ₦${amt} repayment for ${id}`);
  });
});

// ------------------- MEMBERS LIST (with privacy) -------------------
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
    if (!actualPin) throw new Error("masterPin missing in database.");
    if (String(actualPin) !== inputPin) throw new Error("Incorrect Master PIN!");
    closeModals();

    if (pendingActionType === 'DELETE') {
      const m = members.find(mem => mem.id && mem.id.toUpperCase() === pendingTargetId);
      const name = m ? m.name : pendingTargetId;
      document.getElementById('actionConfirmTitle').innerText = "CONFIRM DELETION";
      document.getElementById('actionConfirmMsg').innerText = `Are you sure you want to delete member ${name} (${pendingTargetId})?`;
    } else if (pendingActionType === 'RESET_SINGLE') {
      const m = members.find(mem => mem.id && mem.id.toUpperCase() === pendingTargetId);
      const name = m ? m.name : pendingTargetId;
      document.getElementById('actionConfirmTitle').innerText = "CONFIRM MEMBER RESET";
      document.getElementById('actionConfirmMsg').innerText = `Are you sure you want to reset financial records for ${name} (${pendingTargetId})?`;
    } else if (pendingActionType === 'RESET_ALL') {
      document.getElementById('actionConfirmTitle').innerText = "CONFIRM RESET ALL MEMBERS";
      document.getElementById('actionConfirmMsg').innerText = "DANGER: This will reset all financial records for ALL members. Continue?";
    }
    document.getElementById('modalActionConfirm').classList.add('active');
  }).catch(err => alert(err.message));
});

document.getElementById('btnExecuteAction').addEventListener('click', () => {
  if (pendingActionType === 'DELETE') {
    if (!pendingTargetId) return;
    db.ref('members/' + pendingTargetId).remove()
      .then(() => {
        alert(`Member ${pendingTargetId} deleted.`);
        setStatus(`Member ${pendingTargetId} deleted.`);
        closeModals();
        resetPendingAction();
      })
      .catch(err => alert("Delete failed: " + err.message));
  } else if (pendingActionType === 'RESET_SINGLE') {
    if (!pendingTargetId) return;
    const updates = {};
    updates[`members/${pendingTargetId}/weeklyPayments`] = null;
    updates[`members/${pendingTargetId}/loanAmount`] = 0;
    updates[`members/${pendingTargetId}/loanPaid`] = 0;
    db.ref().update(updates)
      .then(() => {
        alert(`Financial records for ${pendingTargetId} reset.`);
        setStatus(`Financial records for ${pendingTargetId} reset.`);
        closeModals();
        resetPendingAction();
      })
      .catch(err => alert("Reset failed: " + err.message));
  } else if (pendingActionType === 'RESET_ALL') {
    const updates = {};
    members.forEach(m => {
      if (m.id) {
        updates[`${m.id}/weeklyPayments`] = null;
        updates[`${m.id}/loanAmount`] = 0;
        updates[`${m.id}/loanPaid`] = 0;
      }
    });
    db.ref('members').update(updates)
      .then(() => {
        alert("All financial records reset.");
        setStatus("All members' financial records reset.");
        closeModals();
        resetPendingAction();
      })
      .catch(err => alert("Global reset failed: " + err.message));
  } else if (pendingActionType === 'LOGOUT') {
    auth.signOut().then(() => {
      setViewerMode();
      closeModals();
      resetPendingAction();
      setStatus("Logged out. Switched to Viewer Mode.");
      // Re-authenticate as guest to allow password recovery reads
      auth.signInAnonymously().catch(err => console.warn("Guest sign-in failed:", err));
    });
  }
});

function resetPendingAction() {
  pendingActionType = null;
  pendingTargetId = null;
}

// ------------------- RENDER MEMBERS & SUMMARY -------------------
function renderMembers(filterQuery = '') {
  const container = document.getElementById('membersListContainer');
  if (!container) return;

  if (activeUserRole === "viewer") {
    container.innerHTML = `<div style="text-align:center; padding:20px; color:#aaa; font-size:12px;">
      Please log in to view members.
    </div>`;
    return;
  }

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
    html += createMemberCardHTML(m);
  });
  container.innerHTML = html;
}

function createMemberCardHTML(m) {
  const payments = getPaymentsArray(m.weeklyPayments);
  const amountSaved = payments.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  const lAmt = parseFloat(m.loanAmount) || 0;
  const lPaid = parseFloat(m.loanPaid) || 0;
  const lBal = Math.max(0, lAmt - lPaid);

  const isOwnProfile = (activeUserId === m.id);
  const canSeeFullDetails = isEditor || isOwnProfile;
  
  const displayId = canSeeFullDetails ? m.id : maskID(m.id);
  const displayPhone = canSeeFullDetails ? (m.phone || 'N/A') : 'Hidden';

  const actionButtons = isEditor ? `
    <div class="card-actions">
      <button class="icon-action-btn delete-btn" onclick="initiateDeleteMember('${m.id}')" title="Delete Member">
        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </button>
      <button class="icon-action-btn reset-btn" onclick="initiateResetMember('${m.id}')" title="Reset Member Financials">
        <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-8z"/></svg>
      </button>
    </div>` : '';

  return `
    <div class="member-card">
      <div class="member-info">
        <div class="member-header">
          <span>${m.name || 'Unnamed'} (${displayId})</span>
          <span style="color:${m.isEditor ? '#28a745' : '#888'}; font-size: 10px;">${m.isEditor ? 'Editor' : 'Member'}</span>
        </div>
        <div>Phone: ${displayPhone} | Ties: ${m.familyTies || 'N/A'}</div>
        <div style="margin-top:4px;">
          Saved: <b style="color:#51cf66;">₦${amountSaved.toLocaleString()}</b> | 
          Loan Bal: <b style="color:#ff6b6b;">₦${lBal.toLocaleString()}</b>
        </div>
      </div>
      ${actionButtons}
    </div>`;
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
