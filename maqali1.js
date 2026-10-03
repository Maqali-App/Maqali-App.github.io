
// ================================================================
// MAQALI1.JS — Security Questions, Password Reset, Editor Approvals
// Loaded AFTER maqali.js (uses db, auth, helpers from that file)
// ================================================================

// ---- Constants ----
const SQ_QUESTIONS = [
  "What is your husband's / wife's name?",
  "How many children do you wish to have?",
  "What's your favorite thing about Hajia Fatimah?"
];
const SQ_MAX_FAILS = 3;
const OTP_EXPIRY_MS = 5 * 60 * 1000;

// ---- State for the current reset session ----
let sqCurrentMemberId = null;
let sqCurrentMemberName = "";
let sqFailCount = 0;
let sqApprovalListener = null;

// ---- Utilities ----
function normAns(s) {
  return String(s || "").trim().toLowerCase();
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function fmtTime(ms) {
  return new Date(ms).toLocaleString();
}

// ---- Fetch any editor's phone (for WhatsApp fallback) ----
async function getEditorPhone() {
  try {
    const snap = await db.ref('members').once('value');
    const all = snap.val() || {};
    for (const id in all) {
      const m = all[id];
      if (m && m.isEditor && m.phone) return { id, phone: m.phone, name: m.name || id };
    }
  } catch (err) {}
  return null;
}

// ================================================================
// ON USER READY — called from maqali.js after login
// ================================================================
async function onUserReady(userId, role) {
  const reqBtn = document.getElementById('resetReqBtn');
  if (reqBtn) reqBtn.style.display = (role === 'editor') ? 'inline-block' : 'none';

  if (role === 'editor') {
    startEditorRequestsListener();
  } else {
    stopEditorRequestsListener();
  }

  try {
    const snap = await db.ref('members/' + userId + '/securityQuestions').once('value');
    if (!snap.exists()) {
      openSetupQuestions(userId);
    }
  } catch (err) {
    console.error("Security check failed:", err);
  }
}

// ================================================================
// SETUP SECURITY QUESTIONS (blocking modal on first login)
// ================================================================
function openSetupQuestions(userId) {
  document.getElementById('setupSq1').value = '';
  document.getElementById('setupSq2').value = '';
  document.getElementById('setupSq3').value = '';
  document.getElementById('setupQuestionsStatus').innerText = '';
  enableModalElements('modalSetupQuestions');
  document.getElementById('modalSetupQuestions').classList.add('active');
  document.getElementById('modalSetupQuestions').dataset.userId = userId;
}

document.getElementById('btnSaveQuestions').addEventListener('click', async () => {
  const userId = document.getElementById('modalSetupQuestions').dataset.userId;
  const a1 = normAns(document.getElementById('setupSq1').value);
  const a2 = normAns(document.getElementById('setupSq2').value);
  const a3 = normAns(document.getElementById('setupSq3').value);

  if (!a1 || !a2 || !a3) {
    document.getElementById('setupQuestionsStatus').innerText = "Please answer all 3 questions.";
    return;
  }

  try {
    await db.ref('members/' + userId + '/securityQuestions').set({
      a1, a2, a3, setAt: Date.now()
    });
    document.getElementById('modalSetupQuestions').classList.remove('active');
    setStatus("Security questions saved.");
  } catch (err) {
    document.getElementById('setupQuestionsStatus').innerText = "Save failed: " + err.message;
  }
});

// ================================================================
// RESET BLOCK HELPERS
// ================================================================
function clearResetBlocks() {
  document.getElementById('resetQuestionsBlock').style.display = 'none';
  document.getElementById('resetWhatsappBlock').style.display = 'none';
  document.getElementById('resetNewPasswordBlock').style.display = 'none';
  document.getElementById('resetOtpNotice').style.display = 'none';
  document.getElementById('resetOtpField').style.display = 'none';
  document.getElementById('resetQuestionsMsg').innerText = '';
  document.getElementById('resetPendingMsg').innerText = '';
}

document.getElementById('btnVerifyReset').addEventListener('click', async () => {
  const id = document.getElementById('resetIdInput').value.trim().toUpperCase();
  if (!id) return;

  clearResetBlocks();
  sqCurrentMemberId = id;
  sqFailCount = 0;

  try {
    const snap = await db.ref('members/' + id).once('value');
    if (!snap.exists()) return;

    const member = snap.val();
    sqCurrentMemberName = member.name || id;

    if (!member.securityQuestions) {
      document.getElementById('resetStatusMsg').innerText =
        "No security questions on file. Please contact an editor.";
      document.getElementById('resetWhatsappBlock').style.display = 'block';
      return;
    }

    document.getElementById('resetQuestionsBlock').style.display = 'block';
    document.getElementById('resetStatusMsg').innerText =
      `Member ${id} verified. Please answer your security questions.`;
  } catch (err) {
    console.error("Reset load error:", err);
  }
});

// ================================================================
// VERIFY SECURITY ANSWERS
// ================================================================
document.getElementById('btnVerifyAnswers').addEventListener('click', async () => {
  if (!sqCurrentMemberId) return;

  const a1 = normAns(document.getElementById('resetSq1').value);
  const a2 = normAns(document.getElementById('resetSq2').value);
  const a3 = normAns(document.getElementById('resetSq3').value);

  if (!a1 || !a2 || !a3) {
    document.getElementById('resetQuestionsMsg').innerText = "Please answer all 3 questions.";
    return;
  }

  try {
    const snap = await db.ref('members/' + sqCurrentMemberId + '/securityQuestions').once('value');
    const stored = snap.val() || {};
    const correct =
      normAns(stored.a1) === a1 &&
      normAns(stored.a2) === a2 &&
      normAns(stored.a3) === a3;

    if (correct) {
      document.getElementById('resetQuestionsMsg').innerText = "";
      document.getElementById('resetQuestionsBlock').style.display = 'none';
      document.getElementById('resetNewPasswordBlock').style.display = 'block';
      document.getElementById('resetStatusMsg').innerText = "Answers verified. Set a new password.";
    } else {
      sqFailCount++;
      if (sqFailCount >= SQ_MAX_FAILS) {
        document.getElementById('resetQuestionsBlock').style.display = 'none';
        document.getElementById('resetWhatsappBlock').style.display = 'block';
      } else {
        document.getElementById('resetQuestionsMsg').innerText =
          `Incorrect answers. Attempt ${sqFailCount}/${SQ_MAX_FAILS}.`;
      }
    }
  } catch (err) {
    document.getElementById('resetQuestionsMsg').innerText = "Verification failed: " + err.message;
  }
});

// ================================================================
// WHATSAPP FALLBACK
// ================================================================
document.getElementById('btnRequestApproval').addEventListener('click', async () => {
  if (!sqCurrentMemberId) return;

  const editor = await getEditorPhone();
  if (!editor) {
    document.getElementById('resetPendingMsg').innerText =
      "No editor phone on file. Please contact an editor directly.";
    return;
  }

  try {
    await db.ref('resetRequests/' + sqCurrentMemberId).set({
      memberId: sqCurrentMemberId,
      memberName: sqCurrentMemberName,
      status: 'pending',
      requestedAt: Date.now(),
      approvedAt: null,
      otp: null
    });
  } catch (err) {
    document.getElementById('resetPendingMsg').innerText = "Request failed: " + err.message;
    return;
  }

  const msg = `Password reset request for ${sqCurrentMemberId} (${sqCurrentMemberName}). Please open the app to approve.`;
  const waUrl = `https://wa.me/${editor.phone.replace(/[^0-9]/g,'')}?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, '_blank');

  document.getElementById('resetPendingMsg').innerText =
    "Request sent. Waiting for editor approval...";

  startApprovalListener();
});

// ================================================================
// APPROVAL LISTENER (member side)
// ================================================================
function startApprovalListener() {
  stopApprovalListener();
  if (!sqCurrentMemberId) return;

  sqApprovalListener = db.ref('resetRequests/' + sqCurrentMemberId).on('value', snap => {
    const req = snap.val();
    if (!req) return;

    if (req.status === 'approved' && req.otp) {
      const elapsed = Date.now() - (req.approvedAt || 0);
      if (elapsed > OTP_EXPIRY_MS) {
        document.getElementById('resetPendingMsg').innerText = "OTP expired. Please request again.";
        return;
      }
      document.getElementById('resetWhatsappBlock').style.display = 'none';
      document.getElementById('resetNewPasswordBlock').style.display = 'block';
      document.getElementById('resetOtpNotice').style.display = 'block';
      document.getElementById('resetOtpField').style.display = 'block';
      document.getElementById('resetOtpValue').innerText = req.otp;
      document.getElementById('resetStatusMsg').innerText = "Approved. Enter the OTP shown below.";
    } else if (req.status === 'denied') {
      document.getElementById('resetPendingMsg').innerText = "Request denied by editor.";
    }
  });
}

function stopApprovalListener() {
  if (sqApprovalListener && sqCurrentMemberId) {
    db.ref('resetRequests/' + sqCurrentMemberId).off('value', sqApprovalListener);
    sqApprovalListener = null;
  }
}

// ================================================================
// FINAL PASSWORD SUBMIT
// ================================================================
document.getElementById('btnSubmitReset').addEventListener('click', async () => {
  if (!sqCurrentMemberId) return;

  const otpField = document.getElementById('resetOtpField');
  const otpRequired = otpField.style.display !== 'none';
  const otpInput = document.getElementById('resetOtpInput').value.trim();

  const p1 = document.getElementById('resetNewPass').value;
  const p2 = document.getElementById('resetVerPass').value;

  if (otpRequired) {
    const snap = await db.ref('resetRequests/' + sqCurrentMemberId + '/otp').once('value');
    const storedOtp = String(snap.val() || '');
    if (otpInput !== storedOtp) {
      alert("Incorrect OTP.");
      return;
    }
  }

  if (!p1 || p1 !== p2) {
    alert("New passwords do not match.");
    return;
  }

  try {
    await db.ref('members/' + sqCurrentMemberId + '/password').set(p1);
    await db.ref('resetRequests/' + sqCurrentMemberId).remove();

    alert(`Password for ${sqCurrentMemberId} updated successfully!`);
    closeModals();
    sqCurrentMemberId = null;
    sqCurrentMemberName = "";
    sqFailCount = 0;
    stopApprovalListener();
  } catch (err) {
    alert("Failed to update password: " + err.message);
  }
});

// ================================================================
// EDITOR SIDE — Requests button, listener, panel
// ================================================================
let editorReqListener = null;

function startEditorRequestsListener() {
  stopEditorRequestsListener();
  editorReqListener = db.ref('resetRequests').on('value', snap => {
    const reqs = snap.val() || {};
    const pending = Object.values(reqs).filter(r => r.status === 'pending');
    const badge = document.getElementById('resetReqBadge');
    if (!badge) return;
    if (pending.length > 0) {
      badge.style.display = 'inline-block';
      badge.innerText = pending.length;
    } else {
      badge.style.display = 'none';
    }
  });
}

function stopEditorRequestsListener() {
  if (editorReqListener) {
    db.ref('resetRequests').off('value', editorReqListener);
    editorReqListener = null;
  }
}

document.getElementById('resetReqBtn').addEventListener('click', () => {
  renderResetRequests();
  enableModalElements('modalResetRequests');
  document.getElementById('modalResetRequests').classList.add('active');
});

async function renderResetRequests() {
  const container = document.getElementById('resetRequestsContainer');
  container.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa;">Loading...</div>';

  try {
    const snap = await db.ref('resetRequests').once('value');
    const reqs = snap.val() || {};
    const list = Object.values(reqs).sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));

    if (list.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa;">No pending requests.</div>';
      return;
    }

    let html = '';
    list.forEach(r => {
      const statusColor =
        r.status === 'pending' ? '#ffd700' :
        r.status === 'approved' ? '#51cf66' : '#ff6b6b';
      const actions = r.status === 'pending' ? `
        <button class="action-btn save-btn" style="flex:1;font-size:12px;" onclick="approveResetRequest('${r.memberId}')">Approve</button>
        <button class="action-btn" style="flex:1;font-size:12px;background:#dc3545;" onclick="denyResetRequest('${r.memberId}')">Deny</button>
      ` : '';

      html += `
        <div class="history-card">
          <div style="font-weight:bold;color:#ffd700;font-size:15px;">${r.memberName || ''} (${r.memberId})</div>
          <div style="font-size:13px;margin-top:4px;">Status: <span style="color:${statusColor};">${r.status.toUpperCase()}</span></div>
          <div style="font-size:12px;color:#aaa;margin-top:4px;">Requested: ${fmtTime(r.requestedAt)}</div>
          <div style="display:flex;gap:6px;margin-top:10px;">${actions}</div>
        </div>`;
    });
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:#ff6b6b;">Failed to load.</div>';
  }
}

window.approveResetRequest = async function(memberId) {
  const otp = generateOTP();
  try {
    await db.ref('resetRequests/' + memberId).update({
      status: 'approved',
      otp: otp,
      approvedAt: Date.now()
    });
    alert(`Approved. OTP for ${memberId}: ${otp}\n\nGive this OTP to the member.`);
    renderResetRequests();
  } catch (err) {
    alert("Failed to approve: " + err.message);
  }
};

window.denyResetRequest = async function(memberId) {
  try {
    await db.ref('resetRequests/' + memberId).update({
      status: 'denied',
      approvedAt: Date.now()
    });
    renderResetRequests();
  } catch (err) {
    alert("Failed to deny: " + err.message);
  }
};

// ================================================================
// CLEANUP
// ================================================================
document.querySelectorAll('.btn-close-modal').forEach(b => {
  b.addEventListener('click', () => {
    stopApprovalListener();
    sqCurrentMemberId = null;
    sqFailCount = 0;
  });
});
