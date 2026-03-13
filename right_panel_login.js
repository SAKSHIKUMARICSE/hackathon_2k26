// ── STATE ──
    const state = {
      emailOtp: null, mobileOtp: null,
      emailVerified: false, mobileVerified: false,
    };
    const APP_ORIGIN = window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;

    // ── TAB SWITCH ──
    function switchTab(tab) {
      document.getElementById('loginView').classList.toggle('active', tab === 'login');
      document.getElementById('registerView').classList.toggle('active', tab === 'register');
      document.getElementById('loginTab').classList.toggle('active', tab === 'login');
      document.getElementById('registerTab').classList.toggle('active', tab === 'register');
    }

    // ── PASSWORD TOGGLE ──
    function togglePassword(inputId, btn) {
      const input = document.getElementById(inputId);
      const icon = btn.querySelector('i');
      if (input.type === 'password') {
        input.type = 'text';
        input.classList.add('pwd-field');
        icon.className = 'fa-regular fa-eye-slash';
      } else {
        input.type = 'password';
        input.classList.remove('pwd-field');
        icon.className = 'fa-regular fa-eye';
      }
    }

    // ── TOAST ──
    function showToast(msg, isError = false) {
      const t = document.getElementById('toast');
      const icon = t.querySelector('i');
      document.getElementById('toastMsg').textContent = msg;
      icon.className = isError ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-check';
      icon.style.color = isError ? '#f97316' : '#22c55e';
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 3500);
    }

    // ── LOADING BUTTON ──
    function setLoading(btn, loading) {
      if (loading) {
        btn.dataset.original = btn.innerHTML;
        btn.innerHTML = '<span class="btn-spinner"></span> Please wait…';
        btn.disabled = true;
      } else {
        btn.innerHTML = btn.dataset.original;
        btn.disabled = false;
      }
    }

    function buildApiUrl(url) {
      if (/^https?:\/\//i.test(url)) return url;
      return `${APP_ORIGIN}${url}`;
    }

    async function apiCall(url, method, body) {
      try {
        const res = await fetch(buildApiUrl(url), {
          method,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body)
        });

        const data = await res.json();
        return { ok: res.ok, data };
      } catch (err) {
        const msg = window.location.protocol === 'file:'
          ? 'Page file preview se open hai. App ko http://localhost:3000/login se kholo.'
          : 'Network error. npm run dev chalao aur http://localhost:3000/login se page kholo.';
        return { ok: false, data: { message: msg } };
      }
    }

    // ── GENERATE OTP ──
    function generateOTP() {
      return Math.floor(100000 + Math.random() * 900000).toString();
    }

    function getFullMobileNumber() {
      const code = document.getElementById('countryCode').value.trim();
      const mobile = document.getElementById('reg-mobile').value.replace(/\D/g, '');
      return `${code}${mobile}`;
    }

    // ── SEND OTP ──
    async function sendOTP(channel) {
      const isEmail = channel === 'email';
      const inputId = isEmail ? 'reg-email' : 'reg-mobile';
      const btnId   = isEmail ? 'sendEmailOtpBtn' : 'sendMobileOtpBtn';
      const inlineId = isEmail ? 'emailOtpInline' : 'mobileOtpInline';
      const val = document.getElementById(inputId).value.trim();

      // Validate
      if (isEmail && (!val || !val.includes('@'))) {
        showToast('Please enter a valid email first 📧', true); return;
      }
      if (!isEmail && (!val || val.length < 7)) {
        showToast('Please enter a valid mobile number first 📱', true); return;
      }

      const btn = document.getElementById(btnId);
      const prevHtml = btn.dataset.originalHtml || btn.innerHTML;
      btn.dataset.originalHtml = prevHtml;
      btn.disabled = true;
      btn.innerHTML = '<span class="btn-spinner"></span>';

      if (isEmail) {
        const { ok, data } = await apiCall('/api/auth/send-otp', 'POST', {
          type: 'email',
          value: val
        });

        if (!ok) {
          btn.disabled = false;
          btn.innerHTML = prevHtml;
          if (String(data.message || '').includes('Email service not configured')) {
            showToast('SMTP sender set nahi hai. .env me real Gmail aur App Password dalo, phir server restart karo.', true);
            return;
          }
          showToast(data.message || 'Email OTP send karne mein error', true);
          return;
        }

        if (data.demo_otp) {
          btn.disabled = false;
          btn.innerHTML = prevHtml;
          showToast('Server abhi demo OTP mode me chal raha hai. Server restart karo aur real SMTP email set karo.', true);
          return;
        }

        state.emailOtp = 'sent';
        state.emailVerified = false;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Sent';
        btn.style.background = '#22c55e';

        const inline = document.getElementById(inlineId);
        inline.classList.add('show');

        const badge = document.getElementById('emailVerified');
        badge.classList.remove('show');

        const prefix = 'eotp';
        for (let i = 0; i < 6; i++) {
          const b = document.getElementById(prefix + i);
          b.value = ''; b.classList.remove('filled', 'error');
        }

        showToast(data.message || `OTP sent to ${val}`);
        startTimer(channel);
        setTimeout(() => document.getElementById(prefix + '0').focus(), 100);
        return;
      }

      const fullMobile = getFullMobileNumber();
      const { ok, data } = await apiCall('/api/auth/send-otp', 'POST', {
        type: 'mobile',
        value: fullMobile
      });

      if (!ok) {
        btn.disabled = false;
        btn.innerHTML = prevHtml;
        showToast(data.message || 'Mobile OTP send karne mein error', true);
        return;
      }

      state.mobileOtp = 'sent';
      state.mobileVerified = false;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Sent';
      btn.style.background = '#22c55e';

      const inline = document.getElementById(inlineId);
      inline.classList.add('show');

      const badge = document.getElementById('mobileVerified');
      badge.classList.remove('show');

      const prefix = 'motp';
      for (let i = 0; i < 6; i++) {
        const b = document.getElementById(prefix + i);
        b.value = ''; b.classList.remove('filled', 'error');
      }

      const toastMessage = data.demo_otp
        ? `Mobile demo OTP: ${data.demo_otp}. Twilio keys add ho chuki hain to server restart karo: npm run dev.`
        : (data.message || `OTP sent to ${fullMobile}`);
      showToast(toastMessage);
      startTimer(channel);
      setTimeout(() => document.getElementById(prefix + '0').focus(), 100);
    }

    // ── TIMER ──
    function startTimer(channel) {
      const timerId  = channel === 'email' ? 'emailTimer' : 'mobileTimer';
      const resendId = channel === 'email' ? 'resendEmailBtn' : 'resendMobileBtn';
      const rb = document.getElementById(resendId);
      if (rb) rb.disabled = true;
      let seconds = 120;
      const interval = setInterval(() => {
        seconds--;
        const m = String(Math.floor(seconds / 60)).padStart(2, '0');
        const s = String(seconds % 60).padStart(2, '0');
        const el = document.getElementById(timerId);
        if (el) el.textContent = `${m}:${s}`;
        if (seconds <= 0) {
          clearInterval(interval);
          if (el) el.textContent = '00:00';
          if (rb) rb.disabled = false;
        }
      }, 1000);
    }

    // ── RESEND OTP ──
    async function resendOTP(channel) {
      const isEmail  = channel === 'email';
      const resendId = isEmail ? 'resendEmailBtn' : 'resendMobileBtn';
      const timerId  = isEmail ? 'emailTimer' : 'mobileTimer';
      const prefix   = isEmail ? 'eotp' : 'motp';

      document.getElementById(resendId).disabled = true;
      document.getElementById(timerId).textContent = '02:00';

      if (isEmail) { state.emailOtp = null; state.emailVerified = false; }
      else          { state.mobileOtp = null; state.mobileVerified = false; }

      for (let i = 0; i < 6; i++) {
        const b = document.getElementById(prefix + i);
        b.value = ''; b.classList.remove('filled', 'error');
      }
      const badge = document.getElementById(isEmail ? 'emailVerified' : 'mobileVerified');
      badge.classList.remove('show');

      await sendOTP(channel);
    }

    // ── OTP BOX INPUT ──
    function otpInput(el, prefix, idx) {
      el.value = el.value.replace(/\D/g, '').slice(-1);
      if (el.value) {
        el.classList.add('filled');
        if (idx < 5) document.getElementById(prefix + (idx + 1)).focus();
        else verifyOTP(prefix);
      } else {
        el.classList.remove('filled');
      }
    }
    function otpKeydown(e, el, prefix, idx) {
      if (e.key === 'Backspace' && !el.value && idx > 0)
        document.getElementById(prefix + (idx - 1)).focus();
    }

    // ── VERIFY OTP (auto on last digit) ──
    async function verifyOTP(prefix) {
      const channel = prefix === 'eotp' ? 'email' : 'mobile';
      const entered = Array.from({length:6}, (_,i) => document.getElementById(prefix+i).value).join('');

      if (channel === 'email') {
        const email = document.getElementById('reg-email').value.trim();
        const { ok, data } = await apiCall('/api/auth/verify-otp', 'POST', {
          type: 'email',
          value: email,
          otp: entered
        });

        if (ok) {
          state.emailVerified = true;
          document.getElementById('emailVerified').classList.add('show');
          setTimeout(() => document.getElementById('emailOtpInline').classList.remove('show'), 600);
          showToast(data.message || 'Email verified!');
          return;
        }

        for (let i = 0; i < 6; i++) {
          const b = document.getElementById(prefix + i);
          b.classList.add('error');
          setTimeout(() => b.classList.remove('error'), 500);
        }
        showToast(data.message || 'Wrong OTP. Try again.', true);
        setTimeout(() => {
          for (let i = 0; i < 6; i++) {
            const b = document.getElementById(prefix + i);
            b.value = ''; b.classList.remove('filled');
          }
          document.getElementById(prefix + '0').focus();
        }, 600);
        return;
      }

      const fullMobile = getFullMobileNumber();
      const { ok, data } = await apiCall('/api/auth/verify-otp', 'POST', {
        type: 'mobile',
        value: fullMobile,
        otp: entered
      });

      if (ok) {
        state.mobileVerified = true;
        document.getElementById('mobileVerified').classList.add('show');
        setTimeout(() => document.getElementById('mobileOtpInline').classList.remove('show'), 600);
        showToast(data.message || 'Mobile verified!');
        return;
      }

      for (let i = 0; i < 6; i++) {
        const b = document.getElementById(prefix + i);
        b.classList.add('error');
        setTimeout(() => b.classList.remove('error'), 500);
      }
      showToast(data.message || 'Wrong OTP. Try again.', true);
      setTimeout(() => {
        for (let i = 0; i < 6; i++) {
          const b = document.getElementById(prefix + i);
          b.value = ''; b.classList.remove('filled');
        }
        document.getElementById(prefix + '0').focus();
      }, 600);
    }

    // ── FINALIZE REGISTER ──
    async function finalizeRegister() {
      const u = document.getElementById('reg-username').value.trim();
      const e = document.getElementById('reg-email').value.trim();
      const m = document.getElementById('reg-mobile').value.trim();
      const p = document.getElementById('reg-password').value.trim();

      if (!u)                      { showToast('Please enter a username', true); return; }
      if (!e || !e.includes('@'))   { showToast('Please enter a valid email', true); return; }
      if (!m || m.length < 7)       { showToast('Please enter a valid mobile number', true); return; }
      if (!p || p.length < 8)       { showToast('Password must be at least 8 characters', true); return; }
      if (!state.emailOtp)          { showToast('Please send & verify your Email OTP 📧', true); return; }
      if (!state.mobileOtp)         { showToast('Please send & verify your Mobile OTP 📱', true); return; }
      if (!state.emailVerified)     { showToast('Please verify your Email OTP first 📧', true); document.getElementById('emailOtpInline').classList.add('show'); return; }
      if (!state.mobileVerified)    { showToast('Please verify your Mobile OTP first 📱', true); document.getElementById('mobileOtpInline').classList.add('show'); return; }

      const btn = document.getElementById('finalRegBtn');
      setLoading(btn, true);

      const code = document.getElementById('countryCode').value;
      const { ok, data } = await apiCall('/api/auth/register', 'POST', {
        username: u,
        email: e,
        mobile: code + m,
        password: p
      });

      setLoading(btn, false);

      if (!ok) {
        showToast(data.message || 'Registration failed', true);
        return;
      }

      showToast('Account created. Redirecting...');

      state.emailOtp = null;
      state.mobileOtp = null;
      state.emailVerified = false;
      state.mobileVerified = false;

      setTimeout(() => { window.location.href = `${APP_ORIGIN}/app`; }, 1200);
    }

    // ── LOGIN ──
    async function handleLogin() {
      const u = document.getElementById('login-username').value.trim();
      const p = document.getElementById('login-password').value.trim();
      if (!u || !p) { showToast('Please fill in all fields ⚠️', true); return; }

      const btn = document.querySelector('#loginView .submit-btn');
      setLoading(btn, true);

      const { ok, data } = await apiCall('/api/auth/login', 'POST', {
        username: u,
        password: p
      });

      setLoading(btn, false);

      if (!ok) {
        showToast(data.message || 'Invalid username or password', true);
        const card = document.querySelector('.auth-card');
        card.style.animation = 'shake 0.4s ease';
        setTimeout(() => card.style.animation = '', 400);
        return;
      }

      showToast('Login successful! Redirecting...');
      setTimeout(() => {
        document.querySelector('.auth-card').style.transition = 'all 0.6s ease';
        document.querySelector('.auth-card').style.transform = 'scale(0.98) translateY(10px)';
        document.querySelector('.auth-card').style.opacity = '0';
      }, 800);
      setTimeout(() => { window.location.href = `${APP_ORIGIN}/app`; }, 1400);
    }
//ANOJ RAWAT



// Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
// // TODO: Add SDKs for Firebase products that you want to use
// // https://firebase.google.com/docs/web/setup#available-libraries

// // Your web app's Firebase configuration
// // For Firebase JS SDK v7.20.0 and later, measurementId is optional
// const firebaseConfig = {
//   apiKey: "AIzaSyCl-3xZvBQ78C_2AF0jOQVLLXn1MucA6k4",
//   authDomain: "postobt-c0dd0.firebaseapp.com",
//   projectId: "postobt-c0dd0",
//   storageBucket: "postobt-c0dd0.firebasestorage.app",
//   messagingSenderId: "120640884660",
//   appId: "1:120640884660:web:c89496dbd0bc0a34c2ace1",
//   measurementId: "G-BB37DL7PR5"
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);



