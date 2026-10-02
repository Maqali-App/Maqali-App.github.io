// ================================================================
// MAQALI.JS – Full version with history logging
// ================================================================

// ================================================================
// SECTION 1: FIREBASE CONFIGURATION
// ================================================================
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

// ================================================================
// SECTION 2: INITIALIZATION
// ================================================================
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

// ================================================================
// SECTION 3: LOADING STATE
// ================================================================
document.getElementById('statusBanner').innerText = "STATUS: Script loaded, initializing...";
document.body.classList.add('app-loading', 'no-tab-animation');

// ================================================================
// SECTION 4: ANONYMOUS SIGN-IN
// ================================================================
auth.signInAnonymously().catch(err => console.warn("Guest sign-in failed:", err));

// ================================================================
// SECTION 5: GLOBAL STATE
// ================================================================
let members = [];
let isEditor = false;
let activeUserId = "";
let activeUserRole = "viewer";
let isEditingExistingMember = false;

let pendingActionType = null;
let pendingTargetId = null;
let membersListener = null;
let inactivityTimer = null;

// ================================================================
// SECTION 6: CONSTANTS
// ================================================================
const DEFAULT_PASSWORD = "1234";
const EMAIL_DOMAIN = "@maqali.com";
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

// ================================================================
// SECTION 7: UTILITY FUNCTIONS
// ================================================================
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
  return id.charAt(0) + '-***';
}

// ================================================================
// SECTION 8: SESSION HELPERS
// ================================================================
function saveSession(userId, role, tab) {
  localStorage.setItem('maqali_active_user', userId);
  localStorage.setItem('maqali_active_role', role);
  if (tab) localStorage.setItem('maqali_active_tab', tab);
}

function clearSession() {
  localStorage.removeItem('maqali_active_user');
  localStorage.removeItem('maqali_active_role');
  localStorage.removeItem('maqali_active_tab');
}

function getStoredSession() {
  return {
    userId: localStorage.getItem('maqali_active_user'),
    role: localStorage.getItem('maqali_active_role'),
    tab: localStorage.getItem('maqali_active_tab')
  };
}

// ================================================================
// SECTION 9: INACTIVITY TIMER
// ================================================================
function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    if (activeUserId) {
      setViewerMode();
      closeModals();
      setStatus("Logged out due to inactivity.");
      clearSession();
      resetInactivityTimer();
    }
  }, INACTIVITY_TIMEOUT);
}

function stopInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = null;
}

// ================================================================
// SECTION 10: UI STATE FUNCTIONS
// ================================================================
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
  stopInactivityTimer();
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
  resetInactivityTimer();
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
  resetInactivityTimer();

  ['memberId', 'weeklyMemberId', 'loansMemberId'].forEach(fid => {
    const el = document.getElementById(fid);
    if (el) { el.value = memberId; el.readOnly = true; }
  });

  loadProfileForMember(memberId);
  loadWeeklyForMember(memberId);
  loadLoansForMember(memberId);
  renderMembers();
}

// ================================================================
// SECTION 11: TAB VISIBILITY & LOCKING
// ================================================================
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
      el.id !== 'historyBtn' &&
      !el.closest('.modal-overlay') &&
      !el.classList.contains('btn-close-modal')
    ) {
      el.disabled = true;
    }
  });
}

function unlockAllTabs() {
  document.querySelectorAll('input, select, button').forEach(el => {
    if (!el.closest('.modal-overlay')) el.disabled = false;
  });
  if (activeUserRole === "member") {
    ['memberId', 'weeklyMemberId', 'loansMemberId'].forEach(fid => {
      const f = document.getElementById(fid);
      if (f) { f.readOnly = true; f.disabled = false; }
    });
  }
}

function enableModalElements(modalId) {
  document.querySelectorAll(`#${modalId} input, #${modalId} select, #${modalId} button`)
    .forEach(el => { el.disabled = false; });
}

// ================================================================
// SECTION 12: MEMBERS LISTENER
// ================================================================
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

// ================================================================
// SECTION 13: LOGIN PROMPT OVERLAY
// ================================================================
function showLoginPrompt() {
  hideLoginPrompt();
  const overlay = document.createElement('div');
  overlay.id = 'loginPromptOverlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.75); display: flex; align-items: center;
    justify-content: center; z-index: 9999; padding: 15px;
  `;
  overlay.innerHTML = `
    <div style="background:#000028;border:1px solid #007AFF;border-radius:8px;padding:20px;text-align:center;max-width:340px;width:100%;color:#ffd700;font-size:14px;font-weight:bold;">
      <div style="margin-bottom:10px;">🔒 ACCESS RESTRICTED</div>
      <div style="font-size:12px;color:#aaa;margin-bottom:15px;">
        Please log in to view your data.<br>Contact an editor if you don't have an account.
      </div>
      <button id="loginPromptBtn" style="background:#007AFF;color:#fff;border:none;border-radius:4px;padding:10px 20px;font-size:12px;font-weight:bold;cursor:pointer;">
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

// ================================================================
// SECTION 14: AUTH STATE HANDLER
// ================================================================
auth.onAuthStateChanged(user => {
  if (user && user.isAnonymous) {
    const stored = getStoredSession();
    if (stored.userId && stored.role) {
      fetchMemberById(stored.userId).then(member => {
        if (member) {
          if (stored.role === 'editor' && member.isEditor) {
            applyEditorUI(member.id);
          } else if (stored.role === 'member' && !member.isEditor) {
            applyMemberUI(member.id);
          } else {
            clearSession();
            setViewerMode();
          }
          if (stored.tab) {
            const tabItem = Array.from(document.querySelectorAll('.tab-item'))
              .find(t => t.getAttribute('data-tab') === stored.tab);
            if (tabItem) switchToTab(tabItem);
          }
        } else {
          clearSession();
          setViewerMode();
        }
        document.body.classList.remove('no-tab-animation');
        document.body.classList.remove('app-loading');
      }).catch(() => {
        clearSession();
        setViewerMode();
        document.body.classList.remove('no-tab-animation');
        document.body.classList.remove('app-loading');
      });
    } else {
      setViewerMode();
      document.body.classList.remove('no-tab-animation');
      document.body.classList.remove('app-loading');
    }
  } else if (!user) {
    auth.signInAnonymously();
  }
});

// ================================================================
// SECTION 15: DATA HELPERS
// ================================================================
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

// ================================================================
// SECTION 15b: HISTORY LOGGER
// ================================================================
function logHistory(memberId, entry) {
  if (!memberId || !entry) return;
  const enriched = {
    type: entry.type || "unknown",
    amount: Number(entry.amount) || 0,
    week: entry.week || null,
    timestamp: Date.now(),
    by: entry.by || activeUserId || "system",
    description: entry.description || "",
    oldBalance: (entry.oldBalance === undefined) ? null : Number(entry.oldBalance),
    newBalance: (entry.newBalance === undefined) ? null : Number(entry.newBalance)
  };
  return db.ref(`members/${memberId}/history`).push(enriched);
}

// ================================================================
// SECTION 16: WEEKLY GRID BUILDER
// ================================================================
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

// ================================================================
// SECTION 17: CONNECTION LISTENER
// ================================================================
db.ref('.info/connected').on('value', (snap) => {
  if (snap.val() === true) setStatus("Connected to Cloud Database.");
  else setStatus("Connecting / Disconnected from Cloud Server...");
});

// ================================================================
// SECTION 18: TAB CLICK NAVIGATION
// ================================================================
document.querySelectorAll('.tab-item').forEach(item => {
  item.addEventListener('click', function () {
    if (activeUserRole === "viewer" && this.getAttribute('data-tab') !== 'Profile') {
      alert("Please log in to access this section.");
      return;
    }
    switchToTab(this);
    localStorage.setItem('maqali_active_tab', this.getAttribute('data-tab'));
  });
});

function switchToTab(tabItem) {
  document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  tabItem.classList.add('active');
  const tabName = tabItem.getAttribute('data-tab');
  document.getElementById('tab-' + tabName).classList.add('active');
}

// ================================================================
// SECTION 19: SWIPE NAVIGATION (strict)
// ================================================================
const tabContainer = document.getElementById('tabContainer');
let touchStartX = 0, touchStartY = 0, touchEndX = 0, touchEndY = 0, touchStartTime = 0;
let isPinchOrZoom = false;

if (tabContainer) {
  tabContainer.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) { isPinchOrZoom = true; return; }
    isPinchOrZoom = false;
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
    touchStartTime = Date.now();
  }, { passive: true });

  tabContainer.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) isPinchOrZoom = true;
  }, { passive: true });

  tabContainer.addEventListener('touchend', (e) => {
    if (isPinchOrZoom) { isPinchOrZoom = false; return; }
    if (e.touches.length > 0) return;
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
  }, { passive: true });
}

function handleSwipe() {
  const deltaX = touchEndX - touchStartX;
  const deltaY = touchEndY - touchStartY;
  const elapsed = Date.now() - touchStartTime;
  const velocity = Math.abs(deltaX) / elapsed;

  const mostlyHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 2;
  const longEnough = Math.abs(deltaX) > 150;
  const fastEnough = elapsed < 400;
  const highVelocity = velocity > 0.5;

  if (mostlyHorizontal && longEnough && fastEnough && highVelocity) {
    const visibleTabs = getVisibleTabs();
    if (visibleTabs.length === 0) return;
    const currentIndex = getCurrentTabIndex(visibleTabs);
    if (currentIndex === -1) return;
    let newIndex;
    if (deltaX < 0) newIndex = Math.min(currentIndex + 1, visibleTabs.length - 1);
    else newIndex = Math.max(currentIndex - 1, 0);
    if (newIndex !== currentIndex) {
      switchToTab(visibleTabs[newIndex]);
      localStorage.setItem('maqali_active_tab', visibleTabs[newIndex].getAttribute('data-tab'));
    }
  }
}

function getVisibleTabs() {
  return Array.from(document.querySelectorAll('.tab-item')).filter(t => t.style.display !== 'none');
}

function getCurrentTabIndex(visibleTabs) {
  const activeTab = document.querySelector('.tab-item.active');
  return visibleTabs.indexOf(activeTab);
}

// ================================================================
// SECTION 20: MODAL HELPERS
// ================================================================
function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}
document.querySelectorAll('.btn-close-modal').forEach(b => b.addEventListener('click', closeModals));

// ================================================================
// SECTION 21: PROFILE TAB HANDLERS
// ================================================================
document.getElementById('btnNewID').addEventListener('click', () => {
  if (!isEditor) return alert("Action Denied: Only Editors can create new IDs.");
  const role = document.getElementById('roleType').value;
  clearProfileForm();
  const idInput = document.getElementById('memberId');
  if (role === 'Editor') {
    const hasE001 = members.some(m => m.id && m.id.toUpperCase() === 'E-001');
    const hasE002 = members.some(m => m.id && m.id.toUpperCase() === 'E-002');
    if (!hasE001) idInput.value = 'E-001';
    else if (!hasE002) idInput.value = 'E-002';
    else { alert("Maximum Editor limit reached! Only E-001 and E-002 are allowed."); return; }
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
    if (!m) { alert(`Member ID '${id}' not found.`); return; }
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
  if (activeUserRole === "member") { await loadProfileForMember(activeUserId); return; }
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

  const password = passwordInput || (existingMember ? existingMember.password : DEFAULT_PASSWORD);

  const memberObj = {
    id: typedId,
    name,
    age: document.getElementById('age').value,
    phone: document.getElementById('phone').value,
    familyTies: document.getElementById('familyTies').value,
    isEditor: isEditorRole,
    email: `${typedId.toLowerCase()}${EMAIL_DOMAIN}`,
    uid: (existingMember && existingMember.uid) ? existingMember.uid : null,
    password,
    weeklyPayments: existingMember ? existingMember.weeklyPayments : new Array(50).fill(''),
    loanAmount: existingMember ? existingMember.loanAmount : 0,
    loanPaid: existingMember ? existingMember.loanPaid : 0
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

// ================================================================
// SECTION 22: LOGIN / LOGOUT
// ================================================================
document.getElementById('loginBtn').addEventListener('click', () => {
  if (activeUserId) {
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

document.getElementById('btnSubmitLogin').addEventListener('click', async () => {
  const id = document.getElementById('loginIdInput').value.trim().toUpperCase();
  const pass = document.getElementById('loginPassInput').value;
  if (!id) return alert("Please enter your Member ID.");
  const member = await fetchMemberById(id);
  if (!member) return alert("Member ID not found.");
  const storedPass = member.password || DEFAULT_PASSWORD;
  if (pass === storedPass) {
    if (member.isEditor) { applyEditorUI(member.id); saveSession(member.id, 'editor'); }
    else { applyMemberUI(member.id); saveSession(member.id, 'member'); }
    closeModals();
    setStatus(`Logged in as ${member.isEditor ? 'Editor' : 'Member'} ${member.id}`);
    resetInactivityTimer();
  } else {
    alert("Incorrect password.");
  }
});

// ================================================================
// SECTION 23: PASSWORD RECOVERY
// ================================================================
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
      if (!actualPin) throw new Error("Master PIN missing. Please set it in the database under system/masterPin.");
      if (String(actualPin) !== inputPin) throw new Error("Incorrect Master PIN!");
      return db.ref('members/' + id + '/password').set(newPass);
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
    .catch(err => { alert(err.message); });
});

// ================================================================
// SECTION 24: WEEKLY TAB HANDLERS (with history logging)
// ================================================================
async function loadWeeklyForMember(id) {
  let m = members.find(mem => mem.id && mem.id.toUpperCase() === id);
  if (!m) { m = await fetchMemberById(id); if (!m) return alert(`Member ID ${id} not found.`); }
  document.getElementById('weeklyMemberId').value = id;
  document.getElementById('weeklyMemberName').innerText = `Member: ${m.name || 'Unnamed'}`;
  const payments = getPaymentsArray(m.weeklyPayments);
  for (let i = 0; i < 50; i++) {
    const el = document.getElementById(`wk_${i}`);
    if (el) el.value = payments[i] !== undefined ? payments[i] : '';
  }
  setStatus(`Weekly grid loaded for ${id} (${m.name})`);
}

document.getElementById('btnLoadWeekly').addEventListener('click', async () => {
  if (activeUserRole === "member") { await loadWeeklyForMember(activeUserId); return; }
  const id = document.getElementById('weeklyMemberId').value.trim().toUpperCase();
  if (!id) return alert("Please enter a Member ID.");
  await loadWeeklyForMember(id);
});

document.getElementById('btnSavePayments').addEventListener('click', async () => {
  if (!isEditor) return alert("Editor permission required.");
  const id = document.getElementById('weeklyMemberId').value.trim().toUpperCase();
  if (!id) return alert("Enter Member ID first.");
  const m = members.find(mem => mem.id && mem.id.toUpperCase() === id);
  if (!m) return alert(`Member ID ${id} not found.`);

  const newPayments = [];
  for (let i = 0; i < 50; i++) {
    newPayments.push(document.getElementById(`wk_${i}`).value);
  }
  const oldPayments = getPaymentsArray(m.weeklyPayments);

  try {
    await db.ref(`members/${id}/weeklyPayments`).set(newPayments);

    // Log each changed week as a history entry
for (let i = 0; i < 50; i++) {
  const oldVal = oldPayments[i] === undefined ? "" : String(oldPayments[i]).trim();
  const newVal = newPayments[i] === undefined ? "" : String(newPayments[i]).trim();

  // Skip if unchanged
  if (oldVal === newVal) continue;

  // Skip if both are empty
  if (oldVal === "" && newVal === "") continue;

  const oldNum = parseFloat(oldVal) || 0;
  const newNum = parseFloat(newVal) || 0;

  // Choose wording based on sign
  let label = `Week ${i + 1} payment`;
  if (newNum < 0) label = `Week ${i + 1} adjustment`;
  else if (newNum === 0 && oldNum !== 0) label = `Week ${i + 1} cleared`;

  const amountText = newNum < 0
    ? `-₦${Math.abs(newNum).toLocaleString()}`
    : `₦${newNum.toLocaleString()}`;

  await logHistory(id, {
    type: "payment",
    amount: newNum,
    week: i + 1,
    description: `${label}: ${amountText}`,
    oldBalance: oldNum,
    newBalance: newNum
  });
}
  }
}
    alert("Weekly payments saved!");
    setStatus(`Weekly payments saved for ${id}`);
  } catch (err) {
    alert("Save failed: " + err.message);
  }
});

// ================================================================
// SECTION 25: LOANS TAB HANDLERS (with history logging)
// ================================================================
async function loadLoansForMember(id) {
  let m = members.find(mem => mem.id && mem.id.toUpperCase() === id);
  if (!m) { m = await fetchMemberById(id); if (!m) return alert(`Member ID ${id} not found.`); }
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
  if (activeUserRole === "member") { await loadLoansForMember(activeUserId); return; }
  const id = document.getElementById('loansMemberId').value.trim().toUpperCase();
  if (!id) return alert("Please enter a Member ID.");
  await loadLoansForMember(id);
});

document.getElementById('btnAddLoan').addEventListener('click', async () => {
  if (!isEditor) return alert("Editor permission required.");
  const id = document.getElementById('loansMemberId').value.trim().toUpperCase();
  const amt = parseFloat(document.getElementById('newLoanInput').value) || 0;
  if (!id || amt <= 0) return alert("Provide valid ID and loan amount.");
  const m = members.find(mem => mem.id && mem.id.toUpperCase() === id);
  if (!m) return alert(`Member ID ${id} not found.`);

  const currentLoan = parseFloat(m.loanAmount) || 0;
  const newLoan = currentLoan + amt;

  try {
    await db.ref(`members/${id}/loanAmount`).set(newLoan);
    await logHistory(id, {
      type: "loan",
      amount: amt,
      description: `Loan issued: ₦${amt.toLocaleString()}`,
      oldBalance: currentLoan,
      newBalance: newLoan
    });
    alert("Loan added!");
    document.getElementById('newLoanInput').value = '';
    setStatus(`Added ₦${amt} loan to ${id}`);
  } catch (err) {
    alert("Failed to add loan: " + err.message);
  }
});

document.getElementById('btnPayLoan').addEventListener('click', async () => {
  if (!isEditor) return alert("Editor permission required.");
  const id = document.getElementById('loansMemberId').value.trim().toUpperCase();
  const amt = parseFloat(document.getElementById('payLoanInput').value) || 0;
  if (!id || amt <= 0) return alert("Provide valid ID and payment amount.");
  const m = members.find(mem => mem.id && mem.id.toUpperCase() === id);
  if (!m) return alert(`Member ID ${id} not found.`);

  const currentPaid = parseFloat(m.loanPaid) || 0;
  const newPaid = currentPaid + amt;

  try {
    await db.ref(`members/${id}/loanPaid`).set(newPaid);
    await logHistory(id, {
      type: "repayment",
      amount: amt,
      description: `Loan repayment: ₦${amt.toLocaleString()}`,
      oldBalance: currentPaid,
      newBalance: newPaid
    });
    alert("Repayment recorded!");
    document.getElementById('payLoanInput').value = '';
    setStatus(`Recorded ₦${amt} repayment for ${id}`);
  } catch (err) {
    alert("Failed to record repayment: " + err.message);
  }
});

// ================================================================
// SECTION 26: MEMBERS LIST (SEARCH / DELETE / RESET)
// ================================================================
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

// ================================================================
// SECTION 27: CONFIRM MODAL HANDLER
// ================================================================
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
      document.getElementById('actionConfirmTitle').innerText = "CONFIRM DELETION";
      document.getElementById('actionConfirmMsg').innerText = `Are you sure you want to delete member ${m ? m.name : pendingTargetId} (${pendingTargetId})?`;
    } else if (pendingActionType === 'RESET_SINGLE') {
      const m = members.find(mem => mem.id && mem.id.toUpperCase() === pendingTargetId);
      document.getElementById('actionConfirmTitle').innerText = "CONFIRM MEMBER RESET";
      document.getElementById('actionConfirmMsg').innerText = `Are you sure you want to reset financial records for ${m ? m.name : pendingTargetId} (${pendingTargetId})?`;
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
    db.ref('members/' + pendingTargetId).remove().then(() => {
      alert(`Member ${pendingTargetId} deleted.`);
      setStatus(`Member ${pendingTargetId} deleted.`);
      closeModals(); resetPendingAction();
    }).catch(err => alert("Delete failed: " + err.message));

  } else if (pendingActionType === 'RESET_SINGLE') {
    if (!pendingTargetId) return;
    const updates = {};
    updates[`members/${pendingTargetId}/weeklyPayments`] = null;
    updates[`members/${pendingTargetId}/loanAmount`] = 0;
    updates[`members/${pendingTargetId}/loanPaid`] = 0;
    updates[`members/${pendingTargetId}/history`] = null;
    db.ref().update(updates).then(() => {
      alert(`Financial records for ${pendingTargetId} reset.`);
      setStatus(`Financial records for ${pendingTargetId} reset.`);
      closeModals(); resetPendingAction();
    }).catch(err => alert("Reset failed: " + err.message));

  } else if (pendingActionType === 'RESET_ALL') {
    const updates = {};
    members.forEach(m => {
      if (m.id) {
        updates[`${m.id}/weeklyPayments`] = null;
        updates[`${m.id}/loanAmount`] = 0;
        updates[`${m.id}/loanPaid`] = 0;
        updates[`${m.id}/history`] = null;
      }
    });
    db.ref('members').update(updates).then(() => {
      alert("All financial records reset.");
      setStatus("All members' financial records reset.");
      closeModals(); resetPendingAction();
    }).catch(err => alert("Global reset failed: " + err.message));

  } else if (pendingActionType === 'LOGOUT') {
    clearSession();
    stopInactivityTimer();
    setViewerMode();
    closeModals();
    resetPendingAction();
    setStatus("Logged out. Switched to Viewer Mode.");
  }
});

function resetPendingAction() {
  pendingActionType = null;
  pendingTargetId = null;
}

// ================================================================
// SECTION 28: RENDER MEMBERS & SUMMARY
// ================================================================
function renderMembers(filterQuery = '') {
  const container = document.getElementById('membersListContainer');
  if (!container) return;
  if (activeUserRole === "viewer") {
    container.innerHTML = `<div style="text-align:center;padding:20px;color:#aaa;font-size:12px;">Please log in to view members.</div>`;
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
    container.innerHTML = `<div style="text-align:center;padding:20px;color:#aaa;font-size:12px;">
      ${filterQuery ? `No members found matching "${filterQuery}".` : 'No members recorded.'}
    </div>`;
    return;
  }
  let html = '';
  listToRender.forEach(m => { html += createMemberCardHTML(m); });
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
          <span style="color:${m.isEditor ? '#28a745' : '#888'};font-size:10px;">${m.isEditor ? 'Editor' : 'Member'}</span>
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
  let totalSaved = 0, totalLoans = 0, totalRepaid = 0;
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

// ================================================================
// SECTION 29: HISTORY MODAL HANDLERS
// ================================================================
document.getElementById('historyBtn').addEventListener('click', () => {
  if (activeUserRole === "viewer") {
    alert("Please log in to view history.");
    return;
  }
  const editorControls = document.getElementById('historyEditorControls');
  if (isEditor) {
    editorControls.style.display = 'block';
    document.getElementById('historyMemberIdInput').value = '';
    document.getElementById('historyStatusMsg').innerText = 'Enter a Member ID and press Load.';
    document.getElementById('historyListContainer').innerHTML = '';
    document.getElementById('historyMemberName').innerText = '';
  } else {
    editorControls.style.display = 'none';
    loadHistoryForMember(activeUserId);
  }
  enableModalElements('modalHistory');
  document.getElementById('modalHistory').classList.add('active');
});

document.getElementById('btnLoadHistory').addEventListener('click', () => {
  if (!isEditor) return alert("Editors only.");
  const id = document.getElementById('historyMemberIdInput').value.trim().toUpperCase();
  if (!id) return alert("Please enter a Member ID.");
  loadHistoryForMember(id);
});

async function loadHistoryForMember(id) {
  const statusMsg = document.getElementById('historyStatusMsg');
  const nameTag = document.getElementById('historyMemberName');
  const container = document.getElementById('historyListContainer');

  statusMsg.innerText = "Loading...";
  nameTag.innerText = "";
  container.innerHTML = "";

  try {
    const memberSnap = await db.ref('members/' + id).once('value');
    if (!memberSnap.exists()) {
      statusMsg.innerText = `Error: ${id} does not exist.`;
      return;
    }
    const member = memberSnap.val();
    nameTag.innerText = `Member: ${member.name || 'Unnamed'} (${id})`;

    const histSnap = await db.ref('members/' + id + '/history').once('value');
    const hist = histSnap.val();

    if (!hist) {
      container.innerHTML = `<div class="history-empty">No transactions recorded yet.</div>`;
      statusMsg.innerText = "";
      return;
    }

    const entries = Object.values(hist).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    renderHistory(entries);
    statusMsg.innerText = `${entries.length} transaction(s).`;
  } catch (err) {
    console.error("History load error:", err);
    statusMsg.innerText = "Failed to load history.";
  }
}

function renderHistory(entries) {
  const container = document.getElementById('historyListContainer');
  if (!entries.length) {
    container.innerHTML = `<div class="history-empty">No transactions recorded yet.</div>`;
    return;
  }

  let html = '';
  entries.forEach(e => {
    const typeClass =
      e.type === 'payment'   ? 'history-type-payment'   :
      e.type === 'loan'      ? 'history-type-loan'      :
      e.type === 'repayment' ? 'history-type-repayment' : '';

    const typeLabel =
      e.type === 'payment'   ? 'Payment'   :
      e.type === 'loan'      ? 'Loan'      :
      e.type === 'repayment' ? 'Repayment' : 'Entry';

    const date = e.timestamp ? new Date(e.timestamp).toLocaleString() : '';
    const balanceLine = (e.oldBalance !== null && e.oldBalance !== undefined)
      ? `Balance: ₦${Number(e.oldBalance).toLocaleString()} → ₦${Number(e.newBalance).toLocaleString()}`
      : '';

    html += `
      <div class="history-card">
        <div class="${typeClass}">${typeLabel}: ${e.description || ''}</div>
        <div class="history-meta">By ${e.by || 'unknown'} · ${date}</div>
        ${balanceLine ? `<div class="history-meta">${balanceLine}</div>` : ''}
      </div>`;
  });
  container.innerHTML = html;
}

// ================================================================
// SECTION 30: ACTIVITY LISTENERS
// ================================================================
['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(eventType => {
  window.addEventListener(eventType, resetInactivityTimer, { passive: true });
});
