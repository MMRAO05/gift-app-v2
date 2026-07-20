// ===== CONFIGURATION =====
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : '/api';

console.log('🔗 API_URL:', API_URL);

let photosData = [];
let state = { name: '', shortLine: '', letter: '', passkey: '8274', photos: [], giftId: null };
let enteredPass = '';
let currentGiftData = null;

// ===== CURSOR GLOW =====
const cursorGlow = document.getElementById('cursorGlow');
if (cursorGlow) {
    document.addEventListener('mousemove', (e) => {
        cursorGlow.style.left = e.clientX + 'px';
        cursorGlow.style.top = e.clientY + 'px';
    });
}

// ===== CONFETTI =====
function launchConfetti(count = 80) {
    const container = document.getElementById('confettiContainer');
    if (!container) return;
    const colors = ['#c9a86c', '#c0395e', '#e8b4c4', '#f1c40f', '#2ecc71', '#3498db'];
    for (let i = 0; i < count; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.cssText = `
            position: absolute;
            left: ${Math.random() * 100}%;
            width: ${Math.random() * 8 + 4}px;
            height: ${Math.random() * 8 + 4}px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
            animation: confettiFall ${Math.random() * 2 + 1.5}s linear forwards;
            opacity: 0;
        `;
        container.appendChild(piece);
        setTimeout(() => piece.remove(), 4000);
    }
}

// ===== SCREENS =====
const screens = ['box-screen', 'flower-screen', 'note-screen', 'pass-screen', 'unlock-screen', 'photo-screen', 'letter-screen', 'share-screen', 'setup'];

function goTo(id) {
    screens.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.remove('active');
    });
    const target = document.getElementById(id);
    if (target) target.classList.add('active');

    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        if (['box-screen', 'flower-screen', 'note-screen', 'pass-screen', 'unlock-screen', 'photo-screen', 'letter-screen'].includes(id)) {
            progressBar.style.display = 'flex';
            const dots = document.querySelectorAll('.progress-dot');
            const steps = ['box-screen', 'flower-screen', 'note-screen', 'pass-screen', 'photo-screen', 'letter-screen'];
            const currentStep = steps.indexOf(id);
            dots.forEach((dot, index) => {
                dot.classList.remove('active', 'done');
                if (index < currentStep) dot.classList.add('done');
                if (index === currentStep) dot.classList.add('active');
            });
        } else {
            progressBar.style.display = 'none';
        }
    }

    if (id === 'unlock-screen') {
        launchConfetti(100);
    }
}

// ===== URL CHECK =====
const urlParams = new URLSearchParams(window.location.search);
const giftIdParam = urlParams.get('id');
if (giftIdParam) {
    console.log('Loading gift from URL:', giftIdParam);
    const setup = document.getElementById('setup');
    if (setup) setup.classList.remove('active');
    loadGift(giftIdParam);
}

// ============================================
// ===== PHOTO UPLOAD =====
// ============================================

const photoInput = document.getElementById('photoInput');
const photoPreview = document.getElementById('photoPreview');
const uploadBtn = document.getElementById('uploadBtn');
const photoCount = document.getElementById('photoCount');

if (uploadBtn) {
    uploadBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('📁 Upload button clicked');
        if (photoInput) photoInput.click();
    });
}

if (photoInput) {
    photoInput.addEventListener('change', function(e) {
        console.log('📸 File input changed');
        const files = this.files;
        if (!files || files.length === 0) return;
        
        console.log('📸 Selected ' + files.length + ' file(s)');
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;
            if (photosData.length >= 12) break;
            
            const reader = new FileReader();
            reader.onload = function(ev) {
                const dataUrl = ev.target.result;
                photosData.push(dataUrl);
                
                if (photoPreview) {
                    const img = document.createElement('img');
                    img.src = dataUrl;
                    img.className = 'photo-thumb';
                    img.style.cssText = 'width:48px;height:48px;object-fit:cover;border-radius:10px;border:1px solid rgba(255,255,255,0.1);';
                    photoPreview.appendChild(img);
                }
                
                if (photoCount) {
                    photoCount.textContent = '📸 ' + photosData.length + ' photo(s) added';
                }
            };
            reader.readAsDataURL(file);
        }
        this.value = '';
    });
}

// ============================================
// ===== CREATE GIFT =====
// ============================================

const startBtn = document.getElementById('startBtn');
if (startBtn) {
    startBtn.addEventListener('click', async function() {
        const btn = this;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span style="display:inline-block;width:20px;height:20px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;margin-right:8px;vertical-align:middle;"></span> Creating...';
        btn.disabled = true;
        
        console.log('🚀 Creating gift...');

        try {
            const name = document.getElementById('herName')?.value.trim() || 'my love';
            const shortLine = document.getElementById('shortLine')?.value.trim() || 'In your smile, I found my peace.';
            const letter = document.getElementById('letterText')?.value.trim() || 'You mean the world to me.';
            const pk = document.getElementById('passkey')?.value.trim() || '8274';
            const passkey = /^\d{4}$/.test(pk) ? pk : '8274';

            const payload = { name, shortLine, letter, passkey, photos: photosData };

            const response = await fetch(`${API_URL}/gift`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to create gift');
            }

            state.giftId = data.giftId;
            state.name = name;
            state.shortLine = shortLine;
            state.letter = letter;
            state.passkey = passkey;
            state.photos = photosData;

            const shareUrl = window.location.origin + window.location.pathname + '?id=' + data.giftId;
            
            const shareInput = document.getElementById('shareLinkInput');
            if (shareInput) shareInput.value = shareUrl;
            
            const setup = document.getElementById('setup');
            if (setup) setup.classList.remove('active');
            
            goTo('share-screen');
            console.log('✅ Gift created! ID:', data.giftId);

        } catch (error) {
            alert('❌ Error: ' + error.message);
            console.error('Create gift error:', error);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

// ===== SHARE FUNCTIONS =====
const copyBtn = document.getElementById('copyLinkBtn');
if (copyBtn) {
    copyBtn.addEventListener('click', function() {
        const input = document.getElementById('shareLinkInput');
        if (!input) return;
        input.select();
        navigator.clipboard.writeText(input.value).then(() => {
            this.textContent = '✓ Copied!';
            this.classList.add('copied');
            setTimeout(() => {
                this.textContent = 'Copy';
                this.classList.remove('copied');
            }, 2000);
        }).catch(() => {
            document.execCommand('copy');
            alert('Link copied!');
        });
    });
}

const whatsappBtn = document.getElementById('whatsappBtn');
if (whatsappBtn) {
    whatsappBtn.addEventListener('click', () => {
        const link = document.getElementById('shareLinkInput')?.value || '';
        window.open(`https://wa.me/?text=${encodeURIComponent('✨ A special gift for you! ' + link)}`, '_blank');
    });
}

const emailBtn = document.getElementById('emailBtn');
if (emailBtn) {
    emailBtn.addEventListener('click', () => {
        const link = document.getElementById('shareLinkInput')?.value || '';
        window.location.href = `mailto:?subject=A Gift For You&body=✨ A special gift for you! ${link}`;
    });
}

const continueGiftBtn = document.getElementById('continueGiftBtn');
if (continueGiftBtn) {
    continueGiftBtn.addEventListener('click', () => {
        if (state.giftId) loadGift(state.giftId);
    });
}

// ===== LOAD GIFT =====
async function loadGift(giftId) {
    try {
        console.log('📥 Loading gift:', giftId);
        const response = await fetch(`${API_URL}/gift/${giftId}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                alert('Gift not found. It may have expired.');
                goTo('setup');
                return;
            }
            throw new Error('Failed to load gift');
        }

        const data = await response.json();
        currentGiftData = data;

        const nameDisplay = document.getElementById('toNameDisplay');
        if (nameDisplay) nameDisplay.textContent = 'For you, ' + data.name;
        
        const noteLine = document.getElementById('noteLine');
        if (noteLine && data.shortLine) {
            noteLine.innerHTML = data.shortLine;
        }
        
        const salutation = document.getElementById('salutation');
        if (salutation) salutation.textContent = 'To My Dearest ' + data.name + ',';
        
        const letterBody = document.getElementById('letterBody');
        if (letterBody) letterBody.textContent = data.letter || 'You mean the world to me.';

        const grid = document.getElementById('photoGrid');
        if (grid) {
            grid.innerHTML = '';
            if (!data.photos || data.photos.length === 0) {
                grid.innerHTML = '<div class="no-photos">Every memory with you is a photo I want to keep</div>';
            } else {
                data.photos.forEach((src) => {
                    const div = document.createElement('div');
                    div.className = 'polaroid';
                    div.style.setProperty('--r', (Math.random() * 8 - 4) + 'deg');
                    const img = document.createElement('img');
                    img.src = src;
                    div.appendChild(img);
                    grid.appendChild(div);
                });
            }
        }

        goTo('box-screen');

    } catch (error) {
        alert('❌ Failed to load gift: ' + error.message);
        console.error('Load gift error:', error);
    }
}

// ===== GIFT BOX =====
const giftBox = document.getElementById('giftBox');
if (giftBox) {
    giftBox.addEventListener('click', function() {
        if (this.classList.contains('opened')) return;
        this.classList.add('opened');
        console.log('🎁 Box opened');
        setTimeout(() => goTo('flower-screen'), 900);
        launchConfetti(30);
    });
}

// ===== FLOWER AUTO ADVANCE =====
const flowerScreen = document.getElementById('flower-screen');
if (flowerScreen) {
    const observer = new MutationObserver(() => {
        if (flowerScreen.classList.contains('active')) {
            console.log('🌸 Flower screen - auto advancing');
            setTimeout(() => goTo('note-screen'), 2800);
        }
    });
    observer.observe(flowerScreen, { attributes: true, attributeFilter: ['class'] });
}

// ===== PASSKEY =====
const toPassBtn = document.getElementById('toPassBtn');
if (toPassBtn) {
    toPassBtn.addEventListener('click', () => {
        goTo('pass-screen');
        enteredPass = '';
        updatePassDots();
    });
}

const passDotsEls = document.querySelectorAll('#passDots span');
const passError = document.getElementById('passError');

function updatePassDots() {
    passDotsEls.forEach((el, i) => {
        if (el) el.classList.toggle('filled', i < enteredPass.length);
    });
}

const keypad = document.getElementById('keypad');
if (keypad) {
    keypad.addEventListener('click', async function(e) {
        const btn = e.target.closest('button');
        if (!btn) return;
        const k = btn.dataset.k;
        if (passError) passError.textContent = '';

        if (k === 'clear') { enteredPass = ''; updatePassDots(); return; }
        if (k === 'back') { enteredPass = enteredPass.slice(0, -1); updatePassDots(); return; }
        if (enteredPass.length >= 4) return;

        enteredPass += k;
        updatePassDots();

        if (enteredPass.length === 4) {
            try {
                const response = await fetch(`${API_URL}/gift/${currentGiftData?.id}/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ passkey: enteredPass })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    goTo('unlock-screen');
                    setTimeout(() => goTo('photo-screen'), 1500);
                } else {
                    if (passError) passError.textContent = data.error || 'Incorrect passkey';
                    enteredPass = '';
                    updatePassDots();
                    setTimeout(() => { if (passError) passError.textContent = ''; }, 1000);
                }
            } catch (error) {
                if (passError) passError.textContent = 'Error verifying passkey';
                enteredPass = '';
                updatePassDots();
            }
        }
    });
}

// ===== LETTER & RESTART =====
const toLetterBtn = document.getElementById('toLetterBtn');
if (toLetterBtn) {
    toLetterBtn.addEventListener('click', () => goTo('letter-screen'));
}

const restartBtn = document.getElementById('restartBtn');
if (restartBtn) {
    restartBtn.addEventListener('click', () => {
        screens.forEach(s => {
            const el = document.getElementById(s);
            if (el) el.classList.remove('active');
        });
        const box = document.getElementById('giftBox');
        if (box) box.classList.remove('opened');
        const setup = document.getElementById('setup');
        if (setup) setup.classList.add('active');
        const progressBar = document.getElementById('progressBar');
        if (progressBar) progressBar.style.display = 'none';
        photosData = [];
        if (photoPreview) photoPreview.innerHTML = '';
        if (photoCount) photoCount.textContent = '📸 No photos added yet';
        const shareInput = document.getElementById('shareLinkInput');
        if (shareInput) shareInput.value = '';
    });
}

// ===== KEYBOARD SUPPORT =====
document.addEventListener('keydown', (e) => {
    const passScreen = document.getElementById('pass-screen');
    if (!passScreen || !passScreen.classList.contains('active')) return;
    if (e.key >= '0' && e.key <= '9') {
        const btn = document.querySelector(`[data-k="${e.key}"]`);
        if (btn) btn.click();
    }
    if (e.key === 'Backspace') {
        const btn = document.querySelector('[data-k="back"]');
        if (btn) btn.click();
    }
    if (e.key === 'Escape') {
        const btn = document.querySelector('[data-k="clear"]');
        if (btn) btn.click();
    }
});

// ===== BUILD ROSE =====
function buildRose() {
    const roseWrap = document.getElementById('roseWrap');
    if (!roseWrap) return;
    const petalCount = 10;
    for (let i = 0; i < petalCount; i++) {
        const p = document.createElement('div');
        p.className = 'petal';
        const angle = (360 / petalCount) * i;
        p.style.cssText = `
            position: absolute;
            left: 50%;
            top: 50%;
            width: 70px;
            height: 100px;
            background: linear-gradient(160deg, #f0b7c4, #b5395c);
            border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
            transform-origin: 50% 100%;
            opacity: 0.92;
            transform: translate(-50%, -100%) rotate(${angle}deg);
            animation: bloomIn 1s ease ${i * 0.05}s backwards;
            box-shadow: inset 0 0 12px rgba(138,37,64,0.3);
        `;
        roseWrap.appendChild(p);
    }
    const centerDot = document.createElement('div');
    centerDot.style.cssText = 'position:absolute;left:50%;top:50%;width:34px;height:34px;background:#7a1f38;border-radius:50%;transform:translate(-50%,-50%);box-shadow:inset 0 0 10px rgba(0,0,0,.3);';
    roseWrap.appendChild(centerDot);
}
buildRose();

console.log('✅ Gift App loaded successfully!');
console.log('📸 Click "+ Add photos" button to select images');
console.log('🌐 API_URL:', API_URL);