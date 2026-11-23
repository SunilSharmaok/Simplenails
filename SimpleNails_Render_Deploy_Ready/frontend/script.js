 let currentAmount = 0;
let formLocked = false;
let fileUploaded = false;
let isSubmitting = false;
let uploadcareWidget;
let user = null;
let currentSubmissionId = null;

const firebaseConfig = {
    apiKey: "AIzaSyAt2J1jxFlWRcCSRresEoSjwIG_RUnICVY",
    authDomain: "simplenails-editingweb.firebaseapp.com",
    projectId: "simplenails-editingweb",
    storageBucket: "simplenails-editingweb.firebasestorage.app",
    messagingSenderId: "918586763270",
    appId: "1:918586763270:web:42a0be9e573e82706bfb87",
    measurementId: "G-LSD7FQ1G43"
};

let auth = null;
let db = null; // Firestore is accessed only by the Express backend.

function initializeFirebase() {
    try {
        if (typeof firebase === 'undefined') {
            console.error('Firebase SDK not loaded');
            return false;
        }

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        auth = firebase.auth();
        db = null; // No direct browser Firestore access.

        console.log('Firebase initialized successfully');
        return true;
    } catch (error) {
        console.error('Firebase initialization error:', error);
        return false;
    }
}

document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM loaded, initializing app...');

    // Initialize Firebase first
    const firebaseInitialized = initializeFirebase();

    if (!firebaseInitialized) {
        console.error('Failed to initialize Firebase. Check Firebase SDK loading.');
        showAlert('Warning', 'Firebase initialization failed. Some features may not work.', 'warning');
    }

    // Initialize other components
    initParticles();
    initMobileMenu();
    initFirebaseAuth();
    initFormSteps();
    initFileUpload();
    initPaymentMethods();
    initFAQ();
    initBackToTop();
    initScrollAnimations();
    initContactForm();

    // Initialize counter animation
    const projectCounter = document.getElementById('project-counter');
    if (projectCounter) {
        animateCounter(projectCounter, 5000);
    }

    console.log('App initialized');
});

// Particle Background
function initParticles() {
    if (typeof particlesJS !== 'undefined') {
        particlesJS('particles-js', {
            "particles": {
                "number": {
                    "value": 80,
                    "density": {
                        "enable": true,
                        "value_area": 800
                    }
                },
                "color": {
                    "value": "#4895ef"
                },
                "shape": {
                    "type": "circle"
                },
                "opacity": {
                    "value": 0.5,
                    "random": false
                },
                "size": {
                    "value": 3,
                    "random": true
                },
                "line_linked": {
                    "enable": true,
                    "distance": 150,
                    "color": "#4895ef",
                    "opacity": 0.4,
                    "width": 1
                },
                "move": {
                    "enable": true,
                    "speed": 2,
                    "direction": "none",
                    "random": false,
                    "straight": false,
                    "out_mode": "out",
                    "bounce": false
                }
            },
            "interactivity": {
                "detect_on": "canvas",
                "events": {
                    "onhover": {
                        "enable": true,
                        "mode": "grab"
                    },
                    "onclick": {
                        "enable": true,
                        "mode": "push"
                    },
                    "resize": true
                }
            }
        });
    }
}

// Mobile Menu Toggle
function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobile-menu');
    const nav = document.getElementById('main-nav');
    const body = document.body;

    if (mobileMenuBtn && nav) {
        // Toggle menu
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            nav.classList.toggle('active');
            mobileMenuBtn.classList.toggle('active');
            body.classList.toggle('menu-open');
        });

        // Close menu when clicking on nav links
        document.querySelectorAll('nav a').forEach(link => {
            link.addEventListener('click', (e) => {
                if (link.closest('.mobile-login')) {
                    return;
                }

                nav.classList.remove('active');
                mobileMenuBtn.classList.remove('active');
                body.classList.remove('menu-open');
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (nav.classList.contains('active') &&
                !nav.contains(e.target) &&
                !mobileMenuBtn.contains(e.target)) {
                nav.classList.remove('active');
                mobileMenuBtn.classList.remove('active');
                body.classList.remove('menu-open');
            }
        });

        // Close menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && nav.classList.contains('active')) {
                nav.classList.remove('active');
                mobileMenuBtn.classList.remove('active');
                body.classList.remove('menu-open');
            }
        });

        // Close menu on scroll
        window.addEventListener('scroll', () => {
            if (nav.classList.contains('active')) {
                nav.classList.remove('active');
                mobileMenuBtn.classList.remove('active');
                body.classList.remove('menu-open');
            }
        });
    }
}

// Firebase Authentication
function initFirebaseAuth() {
    if (!auth) {
        console.error('Firebase auth not initialized');
        return;
    }

    // Keep authentication separate from optional backend/database operations.
    // A profile-sync failure should not be reported as a Google login failure.
    auth.onAuthStateChanged((firebaseUser) => {
        console.log('Auth state changed:', firebaseUser ? 'User logged in' : 'No user');

        if (firebaseUser) {
            updateUserProfile(firebaseUser);
            updateFormAccessibility();
            saveUserToFirestore(firebaseUser).catch(error => {
                console.error('Signed in, but unable to save user profile to API:', error);
            });
            loadUserSubmissions(firebaseUser.uid).catch(error => {
                console.error('Signed in, but unable to load submissions:', error);
            });
        } else {
            updateFormAccessibility();
            renderFirebaseGoogleButton();
            loadUserSubmissions();
        }
    });
}

function renderFirebaseGoogleButton() {
    const containers = [
        'desktop-login-container',
        'mobile-login-container',
        'login-overlay-container'
    ];

    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            // Only show button if user is not logged in
            if (!auth || !auth.currentUser) {
                let buttonStyle = `
                    background: white;
                    color: #757575;
                    border: 1px solid #ddd;
                    border-radius: 50px;
                    padding: 0.6rem 1.2rem;
                    font-weight: 600;
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    white-space: nowrap;
                `;

                // Add mobile-specific styles
                if (containerId === 'mobile-login-container' || containerId === 'login-overlay-container') {
                    buttonStyle += `
                        width: 100%;
                        justify-content: center;
                        padding: 0.8rem 1.5rem;
                        font-size: 0.9rem;
                    `;
                }

                container.innerHTML = `
                    <button class="firebase-google-btn" onclick="handleFirebaseGoogleSignIn()" 
                        style="${buttonStyle}"
                        onmouseover="this.style.background='#f8f8f8'; this.style.boxShadow='0 4px 8px rgba(0, 0, 0, 0.15)'"
                        onmouseout="this.style.background='white'; this.style.boxShadow='0 2px 4px rgba(0, 0, 0, 0.1)'"
                    >
                        <i class="fab fa-google" style="color: #4285F4; font-size: 1rem;"></i> Sign in with Google
                    </button>
                `;

                // For login overlay container, add margin
                if (containerId === 'login-overlay-container') {
                    container.style.marginTop = '1.5rem';
                }
            }
        }
    });
}

async function handleFirebaseGoogleSignIn() {
    if (!auth) {
        showAlert('Google Sign-In Unavailable', 'Firebase Authentication did not load. Check browser Console for blocked Firebase scripts.', 'error');
        return;
    }

    let signedInUser;
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');
        const result = await auth.signInWithPopup(provider);
        signedInUser = result.user;
    } catch (error) {
        console.error('Firebase Google Sign-In failed:', error.code, error.message, error);
        const messages = {
            'auth/unauthorized-domain': 'This website address is not authorized in Firebase. Add the exact domain in Firebase Console > Authentication > Settings > Authorized domains.',
            'auth/operation-not-allowed': 'Google sign-in is not enabled. Enable Google in Firebase Console > Authentication > Sign-in method.',
            'auth/popup-blocked': 'Your browser blocked the sign-in popup. Allow popups for this site and try again.',
            'auth/popup-closed-by-user': 'The Google sign-in popup was closed before sign-in finished.',
            'auth/cancelled-popup-request': 'The login attempt was cancelled. Please try again.',
            'auth/network-request-failed': 'Firebase could not connect to Google. Check your internet connection, VPN, or browser blocking settings.',
            'auth/invalid-api-key': 'Firebase web API key is invalid. Verify the key in Firebase Project Settings.',
            'auth/too-many-requests': 'Too many sign-in requests. Try again later.',
            'auth/internal-error': 'Google Authentication returned an internal error. Check browser Console for details.'
        };
        const details = messages[error.code] || error.message || 'Could not complete Google sign-in.';
        const codeSuffix = error.code ? ` (Error: ${error.code})` : '';
        showAlert('Google Sign-In Failed', details + codeSuffix, 'error');
        return;
    }

    // Authentication has succeeded at this point. Backend sync is handled
    // separately in onAuthStateChanged so API errors cannot masquerade as login errors.
    console.log('Google sign-in successful:', signedInUser.email);
    updateUserProfile(signedInUser);
    updateFormAccessibility();
    showAlert('Success!', `Welcome, ${signedInUser.displayName || 'User'}!`, 'success');
}

async function saveUserToFirestore(user) {
    try {
        await apiRequest('/users/me', {
            method: 'POST',
            body: {
                displayName: user.displayName || '',
                photoURL: user.photoURL || ''
            }
        });
    } catch (error) {
        console.error('Error syncing user profile:', error);
        throw error;
    }
}

async function updateUserProfile(user) {
    const desktopContainer = document.getElementById('desktop-login-container');
    const mobileContainer = document.getElementById('mobile-login-container');
    const overlayContainer = document.getElementById('login-overlay-container');

    const profileHTML = `
        <div class="user-profile">
            <img src="${user.photoURL || 'https://via.placeholder.com/40/4361ee/ffffff?text=U'}" 
                 alt="${user.displayName || 'User'}" 
                 class="user-avatar"
                 onerror="this.src='https://via.placeholder.com/40/4361ee/ffffff?text=U'">
            <div class="user-info">
                <span class="user-name">${user.displayName || 'User'}</span>
            </div>
            <div class="logout-popup">
                <button class="logout-btn" onclick="handleFirebaseLogout()">
                    <i class="fas fa-sign-out-alt"></i> Sign Out
                </button>
            </div>
        </div>
    `;

    // Update all containers
    if (desktopContainer) desktopContainer.innerHTML = profileHTML;
    if (mobileContainer) mobileContainer.innerHTML = profileHTML;
    if (overlayContainer) overlayContainer.innerHTML = '';
}

async function handleFirebaseLogout() {
    try {
        if (!auth) {
            console.error('Auth not initialized');
            return;
        }

        await auth.signOut();
        console.log('User signed out');

        // Clear all containers
        const containers = [
            'desktop-login-container',
            'mobile-login-container',
            'login-overlay-container'
        ];

        containers.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container) container.innerHTML = '';
        });

        // Re-render Google buttons
        renderFirebaseGoogleButton();

        updateFormAccessibility();
        loadUserSubmissions();

        showAlert('Signed Out', 'You have been successfully signed out.', 'success');

    } catch (error) {
        console.error('Logout Error:', error);
        showAlert('Error', 'Failed to sign out. Please try again.', 'error');
    }
}

function updateFormAccessibility() {
    const overlay = document.getElementById('login-required-overlay');
    const form = document.getElementById('projectForm');
    const isLoggedIn = auth && auth.currentUser;

    console.log('Update form accessibility - logged in:', isLoggedIn);

    if (isLoggedIn) {
        // User is logged in
        if (overlay) overlay.classList.add('hidden');
        if (form) form.classList.remove('form-disabled');
        enableFormFields();
    } else {
        // User is not logged in
        if (overlay) overlay.classList.remove('hidden');
        if (form) form.classList.add('form-disabled');
        disableFormFields();

        // Render Google button in overlay
        const overlayContainer = document.getElementById('login-overlay-container');
        if (overlayContainer && overlayContainer.innerHTML === '') {
            renderFirebaseGoogleButton();
        }
    }
}

function disableFormFields() {
    const formFields = document.querySelectorAll('#projectForm input, #projectForm select, #projectForm textarea, #projectForm button');

    formFields.forEach(field => {
        if (!field.classList.contains('login-required-exempt')) {
            field.disabled = true;
            field.style.pointerEvents = 'none';
            field.style.opacity = '0.6';
        }
    });

    // Disable uploadcare widget
    if (uploadcareWidget?.input) {
        uploadcareWidget.input.disabled = true;
    }
}

function enableFormFields() {
    const formFields = document.querySelectorAll('#projectForm input, #projectForm select, #projectForm textarea, #projectForm button');

    formFields.forEach(field => {
        field.disabled = false;
        field.style.pointerEvents = 'auto';
        field.style.opacity = '1';
    });

    // Enable uploadcare widget
    if (uploadcareWidget?.input) {
        uploadcareWidget.input.disabled = false;
    }
}

// Generate unique project ID
function generateProjectId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 5);
    return `SN-${timestamp}-${randomStr}`.toUpperCase();
}

// Form Step Navigation with Login Check
function initFormSteps() {
    document.querySelectorAll('.next-step').forEach(button => {
        button.addEventListener('click', function () {
            // Check if user is logged in
            if (!auth || !auth.currentUser) {
                showLoginRequiredPopup();
                return;
            }

            const currentStep = document.querySelector('.form-step.active');
            const nextStepId = this.getAttribute('data-next');
            const nextStep = document.querySelector(`.form-step[data-step="${nextStepId}"]`);

            if (validateStep(currentStep.getAttribute('data-step'))) {
                currentStep.classList.remove('active');
                nextStep.classList.add('active');
                updateProgressSteps(nextStepId);

                if (nextStepId === '3') {
                    updateReviewSection();
                    initCancelForm();
                }

                nextStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    document.querySelectorAll('.prev-step').forEach(button => {
        button.addEventListener('click', function () {
            const currentStep = document.querySelector('.form-step.active');
            const prevStepId = this.getAttribute('data-prev');
            const prevStep = document.querySelector(`.form-step[data-step="${prevStepId}"]`);

            currentStep.classList.remove('active');
            prevStep.classList.add('active');
            updateProgressSteps(prevStepId);
            prevStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    document.getElementById('cancel-form-btn')?.addEventListener('click', function () {
        Swal.fire({
            title: 'Cancel Form?',
            text: 'Are you sure you want to clear all entered information?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ff0000',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, clear it!'
        }).then((result) => {
            if (result.isConfirmed) {
                resetForm();
            }
        });
    });

    document.getElementById("serviceField")?.addEventListener("change", function () {
        if (formLocked) return;
        document.getElementById("service_hidden").value = this.value;
    });

    document.getElementById("editingPreferences")?.addEventListener("change", function () {
        if (formLocked) return;

        const value = this.value;
        if (value.includes("Basic")) currentAmount = 100;
        else if (value.includes("Full")) currentAmount = 1000;
        else if (value.includes("Custom")) currentAmount = 2000;

        document.getElementById("editing_preferences_hidden").value = value;
        updateAmountDisplay();
    });
}

// Add cancel form functionality for step 3
function initCancelForm() {
    const step3Navigation = document.querySelector('.form-step[data-step="3"] .form-navigation');
    if (step3Navigation && !step3Navigation.querySelector('#cancel-step3-btn')) {
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'btn btn-outline';
        cancelButton.id = 'cancel-step3-btn';
        cancelButton.innerHTML = '<i class="fas fa-times"></i> Cancel Form';

        cancelButton.addEventListener('click', function () {
            Swal.fire({
                title: 'Cancel Form?',
                text: 'Are you sure you want to cancel and clear all entered information?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ff0000',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Yes, cancel it!',
                cancelButtonText: 'No, keep it'
            }).then((result) => {
                if (result.isConfirmed) {
                    resetForm();
                    showAlert('Form Cancelled', 'Your form has been cancelled and all data has been cleared.', 'info');
                }
            });
        });

        step3Navigation.appendChild(cancelButton);
    }
}

function resetForm() {
    document.getElementById('projectForm').reset();
    uploadcareWidget?.value(null);
    currentAmount = 0;
    currentSubmissionId = null;
    updateAmountDisplay();

    document.querySelectorAll('.form-step').forEach(step => {
        step.classList.remove('active');
    });
    document.querySelector('.form-step[data-step="1"]').classList.add('active');
    updateProgressSteps('1');
}

function validateStep(stepId) {
    if (stepId === '1') {
        const requiredFields = ['name', 'email', 'mobile', 'service', 'editingPreferences', 'message'];
        for (const field of requiredFields) {
            const element = document.getElementById(field === 'editingPreferences' ? 'editingPreferences' : `${field}Field`);
            if (!element.value.trim()) {
                showAlert('Missing Information', `Please fill in the ${field.replace(/([A-Z])/g, ' $1').toLowerCase()} field`, 'warning');
                element.focus();
                return false;
            }
        }

        const email = document.getElementById('emailField').value;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showAlert('Invalid Email', 'Please enter a valid email address', 'warning');
            document.getElementById('emailField').focus();
            return false;
        }

        const mobile = document.getElementById('mobileField').value;
        if (!/^\d{10}$/.test(mobile)) {
            showAlert('Invalid Mobile', 'Please enter a valid 10-digit mobile number', 'warning');
            document.getElementById('mobileField').focus();
            return false;
        }

        return true;
    } else if (stepId === '2') {
        const files = uploadcareWidget?.value();
        if (!files && !document.getElementById('file_hidden').value) {
            showAlert('Files Required', 'Please upload at least one file to continue', 'warning');
            return false;
        }
        return true;
    }
    return true;
}

function updateProgressSteps(activeStep) {
    const progressFill = document.querySelector('.progress-fill');
    const progressPercentage = ((activeStep - 1) / 2) * 100;
    if (progressFill) {
        progressFill.style.width = `${progressPercentage}%`;
    }

    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active');
        if (parseInt(step.getAttribute('data-step')) <= parseInt(activeStep)) {
            step.classList.add('active');
        }
    });
}

function updateAmountDisplay() {
    const amountDisplay = document.getElementById('pay-amount');
    if (amountDisplay) {
        amountDisplay.textContent = currentAmount / 100;
    }
}

// File Upload Handling
function initFileUpload() {
    if (typeof uploadcare !== 'undefined') {
        uploadcareWidget = uploadcare.Widget('[role=uploadcare-uploader]');

        uploadcareWidget.onUploadComplete(function (fileInfo) {
            if (fileInfo) {
                document.getElementById('file_hidden').value = fileInfo.cdnUrl;
                updateFilePreviews([fileInfo]);
            }
        });

        uploadcareWidget.onChange(function (fileGroup) {
            if (fileGroup) {
                fileGroup.files().done(function (files) {
                    updateFilePreviews(files);
                });
            } else {
                document.getElementById('file_hidden').value = '';
                const previewsContainer = document.getElementById('file-previews');
                if (previewsContainer) {
                    previewsContainer.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-file-upload"></i>
                            <p>No files selected yet</p>
                        </div>
                    `;
                }
            }
        });
    }

    document.getElementById('paste-url-btn')?.addEventListener('click', async function () {
        if (!auth || !auth.currentUser) {
            showLoginRequiredPopup();
            return;
        }

        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                try {
                    new URL(text);
                    uploadcareWidget?.value(text);
                    showAlert('URL Added', 'The URL from your clipboard has been added', 'success');
                } catch (e) {
                    showAlert('Invalid URL', 'The text in your clipboard is not a valid URL', 'error');
                }
            } else {
                showAlert('No URL Found', 'Your clipboard does not contain a URL', 'warning');
            }
        } catch (err) {
            showAlert('Clipboard Access Denied', 'Please paste the URL manually', 'error');
        }
    });
}

function updateFilePreviews(files) {
    const previewsContainer = document.getElementById('file-previews');
    if (!previewsContainer) return;

    if (files.length === 0) {
        previewsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-file-upload"></i>
                <p>No files selected yet</p>
            </div>
        `;
        return;
    }

    previewsContainer.innerHTML = '';

    files.forEach(file => {
        const preview = document.createElement('div');
        preview.className = 'file-preview';

        const isImage = file.name.match(/\.(jpg|jpeg|png|gif)$/i);
        const fileSize = (file.size / 1024).toFixed(1);

        preview.innerHTML = `
            ${isImage ? `<img src="${file.cdnUrl}" alt="${file.name}">` : `<i class="fas fa-file-alt" style="font-size:3rem;color:rgba(255,255,255,0.5);margin:10px 0;"></i>`}
            <div class="file-name">${file.name}</div>
            <div class="file-size">${fileSize} KB</div>
            <div class="remove-file" data-url="${file.cdnUrl}">
                <i class="fas fa-times"></i>
            </div>
        `;

        previewsContainer.appendChild(preview);
    });

    document.querySelectorAll('.remove-file').forEach(button => {
        button.addEventListener('click', function () {
            const url = this.getAttribute('data-url');
            removeFileFromWidget(url);
        });
    });
}

function removeFileFromWidget(url) {
    const files = uploadcareWidget?.value();
    if (files) {
        files.remove(uploadcare.FileFrom('uploaded', { cdnUrl: url }));
    }
}

// Update Review Section with Project ID
function updateReviewSection() {
    const previewProjectId = generateProjectId();

    // Update all review fields
    const fields = {
        'review-name': 'nameField',
        'review-email': 'emailField',
        'review-mobile': 'mobileField',
        'review-message': 'messageField',
        'review-service': 'serviceField',
        'review-editing': 'editingPreferences'
    };

    for (const [reviewId, fieldId] of Object.entries(fields)) {
        const element = document.getElementById(reviewId);
        const fieldElement = document.getElementById(fieldId);
        if (element && fieldElement) {
            element.textContent = fieldElement.value || 'Not selected';
        }
    }

    const filesCount = uploadcareWidget?.value()?.files().length ||
        (document.getElementById('file_hidden').value ? 1 : 0);
    const reviewFiles = document.getElementById('review-files');
    if (reviewFiles) {
        reviewFiles.textContent = `${filesCount} file${filesCount !== 1 ? 's' : ''}`;
    }

    const amount = currentAmount / 100;
    const reviewTotal = document.getElementById('review-total');
    const payAmount = document.getElementById('pay-amount');

    if (reviewTotal) reviewTotal.textContent = `₹${amount}`;
    if (payAmount) payAmount.textContent = amount;

    // Add project ID to review section
    let projectIdRow = document.getElementById('review-project-id');
    if (!projectIdRow) {
        const summaryCard = document.querySelector('.summary-card');
        if (summaryCard) {
            const firstRow = summaryCard.querySelector('.summary-row');
            if (firstRow) {
                const projectIdHtml = `
                    <div class="summary-row">
                        <span>Project ID:</span>
                        <span id="review-project-id">${previewProjectId}</span>
                    </div>
                `;
                firstRow.insertAdjacentHTML('beforebegin', projectIdHtml);
            }
        }
    } else {
        projectIdRow.textContent = previewProjectId;
    }
}

// Payment Method Selection
function initPaymentMethods() {
    document.getElementById('pay-submit-btn')?.addEventListener('click', function () {
        if (!auth || !auth.currentUser) {
            showLoginRequiredPopup();
            return;
        }

        startRazorpayPayment();
    });
}

window.startRazorpayPayment = async function () {
    if (formLocked) return;
    if (!document.getElementById('terms-agreement')?.checked) {
        showAlert('Terms Required', 'You must agree to the Terms & Conditions to proceed', 'warning');
        return;
    }
    try {
        const currentUser = auth?.currentUser;
        if (!currentUser) throw new Error('Please sign in before submitting your project.');
        const name = document.getElementById('nameField').value.trim();
        const email = document.getElementById('emailField').value.trim();
        const mobile = document.getElementById('mobileField').value.trim();
        const service = document.getElementById('service_hidden').value;
        const editingPref = document.getElementById('editing_preferences_hidden').value;
        const message = document.getElementById('messageField').value.trim();
        const fileUrl = document.getElementById('file_hidden').value || '';
        if (!name || !email || !mobile || !service || !editingPref || !message) throw new Error('Please fill out all required fields before payment.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
        if (!/^\d{10}$/.test(mobile)) throw new Error('Please enter a valid 10-digit mobile number.');
        if (!uploadcareWidget?.value() && !fileUrl) throw new Error('Please upload at least one file before payment.');
        currentSubmissionId = generateProjectId();
        const order = await apiRequest('/payments/create-order', {
            method: 'POST',
            body: { projectId: currentSubmissionId, editingPreferences: editingPref }
        });
        const options = {
            key: order.keyId,
            amount: order.amount,
            currency: order.currency,
            name: 'SimpleNails',
            description: 'Project Payment',
            order_id: order.orderId,
            prefill: { name, email, contact: mobile },
            theme: { color: '#00bbff' },
            handler: async function (paymentResponse) {
                try {
                    lockFormFields();
                    Swal.fire({ title: 'Processing...', text: 'Verifying payment and submitting your project', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                    const payload = {
                        projectId: currentSubmissionId, name, email, mobile, service,
                        editingPreferences: editingPref, message, fileUrl,
                        payment: paymentResponse
                    };
                    await apiRequest('/submissions', { method: 'POST', body: payload });
                    Swal.fire({
                        title: 'Success!',
                        html: `<div style="text-align:center"><i class="fas fa-check-circle" style="color:#4CAF50;font-size:4rem;margin-bottom:20px"></i><h3>Project Submitted Successfully!</h3><p><strong>Project ID:</strong> ${currentSubmissionId}</p><p><strong>Payment ID:</strong> ${paymentResponse.razorpay_payment_id}</p><p style="color:#4CAF50;margin-top:20px"><i class="fas fa-envelope"></i> Confirmation email will be sent if email service is configured.</p></div>`,
                        icon: 'success', confirmButtonText: 'View Submissions'
                    }).then(() => { resetForm(); unlockFormFields(); window.location.href = 'submissions.html'; });
                } catch (error) {
                    console.error('Submission error:', error);
                    Swal.fire({ title: 'Submission Error', text: error.message || 'Unable to submit project.', icon: 'error', confirmButtonText: 'Try Again' });
                    unlockFormFields();
                }
            },
            modal: { ondismiss: () => showAlert('Payment Cancelled', 'You cancelled the payment process', 'warning') }
        };
        const razorpay = new Razorpay(options);
        razorpay.on('payment.failed', response => showAlert('Payment Failed', response.error?.description || 'Payment could not be completed', 'error'));
        razorpay.open();
    } catch (error) {
        showAlert('Error', error.message || 'Unable to start payment.', 'error');
    }
};



// Form Submission Functions
function lockFormFields() {
    formLocked = true;
    ['nameField', 'emailField', 'mobileField', 'messageField'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.readOnly = true;
    });

    ['serviceField', 'editingPreferences'].forEach(id => {
        const select = document.getElementById(id);
        if (select) select.disabled = true;
    });

    if (uploadcareWidget?.input) {
        uploadcareWidget.input.disabled = true;
    }

    const nda = document.getElementById('nda');
    if (nda) nda.disabled = true;
}

function unlockFormFields() {
    formLocked = false;
    ['nameField', 'emailField', 'mobileField', 'messageField'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.readOnly = false;
    });

    ['serviceField', 'editingPreferences'].forEach(id => {
        const select = document.getElementById(id);
        if (select) select.disabled = false;
    });

    if (uploadcareWidget?.input) {
        uploadcareWidget.input.disabled = false;
    }

    const nda = document.getElementById('nda');
    if (nda) nda.disabled = false;
}

async function saveSubmissionToFirestore(formData, paymentId) {
    throw new Error('Submissions must be created through the verified payment API.');
}



// Updated loadUserSubmissions function with editing status
async function loadUserSubmissions(userId = null) {
    const submissionHistory = document.querySelector('.submission-history');
    if (!submissionHistory) return;
    if (!auth?.currentUser) { renderFirebaseGoogleButton(); return; }
    try {
        showLoadingState();
        document.getElementById('login-required-overlay')?.classList.add('hidden');
        const result = await apiRequest('/submissions');
        const submissions = (result.submissions || []).map(item => ({
            ...item,
            editing_status: item.editing_status || 'pending',
            timestamp: item.created_at ? new Date(item.created_at) : new Date()
        })).sort((a,b) => b.timestamp - a.timestamp);
        if (!submissions.length) { showEmptyState(); hideSubmissionUI(); return; }
        updateSubmissionStats(submissions);
        renderSubmissions(submissions);
    } catch (error) {
        console.error('Unable to load submissions:', error);
        showErrorState(error);
    }
}



function showLoadingState() {
    const submissionHistory = document.querySelector('.submission-history');
    if (!submissionHistory) return;

    submissionHistory.innerHTML = `
        <div class="no-submissions loading">
            <div class="loading-spinner">
                <div class="spinner-circle"></div>
            </div>
            <h3>Loading your submissions</h3>
            <p>Please wait while we fetch your project history</p>
        </div>
    `;
}

function showEmptyState() {
    const submissionHistory = document.querySelector('.submission-history');
    if (!submissionHistory) return;

    submissionHistory.innerHTML = `
        <div class="no-submissions empty">
            <div class="empty-icon">
                <i class="fas fa-folder-open"></i>
            </div>
            <h3>No Submissions Yet</h3>
            <p>You haven't submitted any projects yet. Start your first project to see it here!</p>
            <a href="project.html" class="primary-btn">
                <i class="fas fa-file-upload"></i> Start Your First Project
            </a>
        </div>
    `;
}

function showErrorState(error) {
    const submissionHistory = document.querySelector('.submission-history');
    if (!submissionHistory) return;

    let errorMessage = 'Unable to load your submissions. Please try again later.';

    if (error.code === 'permission-denied') {
        errorMessage = 'Permission denied. Make sure Firestore rules are properly configured.';
    } else if (error.code === 'unavailable') {
        errorMessage = 'Network error. Please check your internet connection.';
    }

    submissionHistory.innerHTML = `
        <div class="no-submissions error">
            <div class="error-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h3>Unable to Load Submissions</h3>
            <p id="error-message">${errorMessage}</p>
            <button class="primary-btn" id="retry-load">
                <i class="fas fa-redo"></i> Try Again
            </button>
        </div>
    `;

    document.getElementById('retry-load').addEventListener('click', () => {
        loadUserSubmissions();
    });
}

function updateSubmissionStats(submissions) {
    const statsContainer = document.querySelector('.submission-stats');
    const viewToggle = document.querySelector('.view-toggle');

    if (statsContainer) {
        statsContainer.style.display = 'flex';

        // Calculate stats based on editing_status
        let pending = 0;
        let inProgress = 0;
        let completed = 0;
        
        submissions.forEach(submission => {
            const editingStatus = (submission.editing_status || 'pending').toLowerCase();
            
            switch (editingStatus) {
                case 'completed':
                    completed++;
                    break;
                case 'in progress':
                case 'progress':
                case 'processing':
                case 'editing':
                    inProgress++;
                    break;
                default: // pending, submitted, etc.
                    pending++;
                    break;
            }
        });

        const total = submissions.length;
        const active = pending + inProgress; // Both pending and in-progress are active

        // Update the DOM elements
        document.getElementById('total-submissions').textContent = total;
        document.getElementById('active-projects').textContent = active;
        document.getElementById('completed-projects').textContent = completed;

        // Optionally, you could also update the labels to reflect editing status
        // Or add new elements for more detailed breakdown
    }

    if (viewToggle) {
        viewToggle.style.display = 'flex';
    }
}

function hideSubmissionUI() {
    const statsContainer = document.querySelector('.submission-stats');
    const viewToggle = document.querySelector('.view-toggle');
    const pagination = document.querySelector('.pagination');

    if (statsContainer) statsContainer.style.display = 'none';
    if (viewToggle) viewToggle.style.display = 'none';
    if (pagination) pagination.style.display = 'none';
}

function renderSubmissions(submissions) {
    const submissionHistory = document.querySelector('.submission-history');
    if (!submissionHistory) return;

    // Clear loading state
    submissionHistory.innerHTML = '';

    // Create list view
    const listView = document.createElement('div');
    listView.className = 'submissions-list-view';
    listView.id = 'submissions-list';
    listView.style.display = 'none';

    // Create grid view
    const gridView = document.createElement('div');
    gridView.className = 'submissions-grid-view';
    gridView.id = 'submissions-grid';
    gridView.style.display = 'none';

    // Build list view content
    listView.innerHTML = `
        <div class="list-header">
            <div class="header-item project-id">PROJECT ID</div>
            <div class="header-item service">SERVICE</div>
            <div class="header-item status">STATUS</div>
            <div class="header-item editing-status">EDITING STATUS</div>
            <div class="header-item date">DATE</div>
            <div class="header-item actions">ACTIONS</div>
        </div>
        <div class="list-items" id="list-items"></div>
    `;

    // Build list items
    const listItemsContainer = listView.querySelector('#list-items');
    submissions.forEach(submission => {
        const listItem = createListItem(submission);
        listItemsContainer.appendChild(listItem);
    });

    // Build grid items
    submissions.forEach(submission => {
        const gridCard = createGridCard(submission);
        gridView.appendChild(gridCard);
    });

    // Add both views to the page
    submissionHistory.appendChild(listView);
    submissionHistory.appendChild(gridView);

    // Show list view by default
    showView('list');
}

function getStatusInfo(status) {
    const statusText = (status || 'pending').toLowerCase();

    switch (statusText) {
        case 'completed':
        case 'submitted':
            return { text: 'Submitted', class: 'submitted' };
        case 'in progress':
        case 'processing':
            return { text: 'In Progress', class: 'pending' };
        case 'failed':
        case 'error':
            return { text: 'Failed', class: 'failed' };
        default:
            return { text: 'Pending', class: 'pending' };
    }
}

function getEditingStatusInfo(status) {
    const statusText = (status || 'pending').toLowerCase();

    switch (statusText) {
        case 'completed':
            return { text: 'Completed', class: 'completed' };
        case 'in progress':
        case 'processing':
            return { text: 'In Progress', class: 'in-progress' };
        case 'editing':
            return { text: 'Editing', class: 'editing' };
        case 'failed':
        case 'error':
            return { text: 'Failed', class: 'failed' };
        default:
            return { text: 'Pending', class: 'pending' };
    }
}

function createListItem(submission) {
    const item = document.createElement('div');
    item.className = 'list-item';

    const date = formatDate(submission.timestamp);
    const status = getStatusInfo(submission.status);
    const editingStatus = getEditingStatusInfo(submission.editing_status);

    // Check if edited files exist
    const hasEditedFiles = submission.edited_files && submission.edited_files.length > 0;

    item.innerHTML = `
        <div class="project-id" data-label="Project ID">${submission.project_id || 'N/A'}</div>
        <div class="service" data-label="Service">${submission.service || 'N/A'}</div>
        <div class="status ${status.class}" data-label="Status">${status.text}</div>
        <div class="editing-status ${editingStatus.class}" data-label="Editing Status">${editingStatus.text}</div>
        <div class="date" data-label="Date">${date}</div>
        <div class="actions" data-label="Actions">
            <button class="action-btn view-details" title="View Details" onclick="showSubmissionDetails('${submission.id}')">
                <i class="fas fa-eye"></i>
            </button>
            ${hasEditedFiles ? `
            <button class="file-link" title="Download Edited Files" onclick="downloadEditedFiles('${submission.id}')">
                <i class="fas fa-download"></i>
            </button>
            ` : ''}
        </div>
    `;

    return item;
}

function createGridCard(submission) {
    const card = document.createElement('div');
    card.className = 'grid-card';

    const date = formatDate(submission.timestamp);
    const status = getStatusInfo(submission.status);
    const editingStatus = getEditingStatusInfo(submission.editing_status);

    // Check if edited files exist
    const hasEditedFiles = submission.edited_files && submission.edited_files.length > 0;

    card.innerHTML = `
        <div class="grid-card-header">
            <div class="grid-card-id">${submission.project_id || 'N/A'}</div>
            <div class="grid-card-date">${date}</div>
        </div>
        
        <div class="grid-card-content">
            <div class="grid-detail">
                <div class="grid-detail-label">Service:</div>
                <div class="grid-detail-value">${submission.service || 'N/A'}</div>
            </div>
            <div class="grid-detail">
                <div class="grid-detail-label">Uploading Status:</div>
                <div class="grid-detail-value">
                    <span class="status-badge ${status.class}">${status.text}</span>
                </div>
            </div>
            <div class="grid-detail">
                <div class="grid-detail-label">Editing Status:</div>
                <div class="grid-detail-value">
                    <span class="status-badge ${editingStatus.class}">${editingStatus.text}</span>
                </div>
            </div>
            <div class="grid-detail">
                <div class="grid-detail-label">Editing Level:</div>
                <div class="grid-detail-value">${submission.editing_preferences || 'N/A'}</div>
            </div>
            <div class="grid-detail">
                <div class="grid-detail-label">Submitted:</div>
                <div class="grid-detail-value">${date}</div>
            </div>
        </div>
        
        ${hasEditedFiles ? `
        <div class="edited-file-section" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
            <div class="grid-detail">
                <div class="grid-detail-label">Edited Files:</div>
                <div class="grid-detail-value">
                    <button onclick="downloadEditedFiles('${submission.id}')" class="file-link">
                        <i class="fas fa-download"></i> Download Edited Files (${submission.edited_files.length})
                    </button>
                </div>
            </div>
        </div>
        ` : ''}
        
        <div class="grid-card-actions">
            <button class="action-btn view-details" onclick="showSubmissionDetails('${submission.id}')">
                <i class="fas fa-eye"></i> View Details
            </button>
        </div>
    `;

    return card;
}

// New function to download edited files
async function downloadEditedFiles(submissionId) {
    try {
        const result = await apiRequest(`/submissions/${encodeURIComponent(submissionId)}`);
        const submission = result.submission;
        if (!submission) { showAlert('Error', 'Submission not found', 'error'); return; }

        if (!submission.edited_files || submission.edited_files.length === 0) {
            showAlert('No Files', 'No edited files available yet', 'warning');
            return;
        }

        // Open files in new tabs for download
        submission.edited_files.forEach((file, index) => {
            window.open(file.url, '_blank');
        });

        // Or create a zip download (more advanced)
        if (submission.edited_files.length > 1) {
            showAlert('Files Ready', `${submission.edited_files.length} files opened for download. Check your downloads folder.`, 'success');
        }

    } catch (error) {
        console.error('Error downloading files:', error);
        showAlert('Error', 'Failed to download files', 'error');
    }
}

function formatDate(date) {
    if (!date) return 'N/A';

    const d = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now - d);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return 'Today, ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Yesterday, ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } else {
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
}

function initViewToggle() {
    const viewButtons = document.querySelectorAll('.view-btn');

    viewButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active button
            viewButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Show selected view
            const view = button.getAttribute('data-view');
            showView(view);
        });
    });
}

function showView(view) {
    const listView = document.getElementById('submissions-list');
    const gridView = document.getElementById('submissions-grid');

    if (view === 'list') {
        listView.style.display = 'block';
        gridView.style.display = 'none';
    } else {
        listView.style.display = 'none';
        gridView.style.display = 'grid';
    }
}

function initPagination(submissions) {
    const pagination = document.querySelector('.pagination');
    if (!pagination) return;

    const itemsPerPage = 10;
    const totalPages = Math.ceil(submissions.length / itemsPerPage);

    if (totalPages > 1) {
        pagination.style.display = 'flex';

        const currentPageEl = document.getElementById('current-page');
        const totalPagesEl = document.getElementById('total-pages');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');

        currentPageEl.textContent = '1';
        totalPagesEl.textContent = totalPages;

        let currentPage = 1;

        function updatePagination() {
            currentPageEl.textContent = currentPage;
            prevBtn.disabled = currentPage === 1;
            nextBtn.disabled = currentPage === totalPages;

            // Update displayed submissions based on current page
            const start = (currentPage - 1) * itemsPerPage;
            const end = start + itemsPerPage;
            const pageSubmissions = submissions.slice(start, end);

            // Re-render current view with page submissions
            renderPageSubmissions(pageSubmissions);
        }

        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                updatePagination();
            }
        });

        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                updatePagination();
            }
        });

        updatePagination();
    }
}

function renderPageSubmissions(submissions) {
    const listItemsContainer = document.getElementById('list-items');
    const gridView = document.getElementById('submissions-grid');

    if (listItemsContainer) {
        listItemsContainer.innerHTML = '';
        submissions.forEach(submission => {
            const listItem = createListItem(submission);
            listItemsContainer.appendChild(listItem);
        });
    }

    if (gridView) {
        gridView.innerHTML = '';
        submissions.forEach(submission => {
            const gridCard = createGridCard(submission);
            gridView.appendChild(gridCard);
        });
    }
}

// Modal for submission details
async function showSubmissionDetails(submissionId) {
    try {
        // Fetch submission details from Firestore
        const result = await apiRequest(`/submissions/${encodeURIComponent(submissionId)}`);
        const submission = result.submission;
        if (!submission) { showAlert('Error', 'Submission not found', 'error'); return; }

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'details-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Project Details</h3>
                    <button class="close-modal" onclick="closeDetailsModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-details">
                    <div class="modal-detail">
                        <div class="modal-detail-label">Project ID:</div>
                        <div class="modal-detail-value">${submission.project_id || 'N/A'}</div>
                    </div>

                    ${submission.payment_id ? `
                    <div class="modal-detail">
                        <div class="modal-detail-label">Payment ID:</div>
                        <div class="modal-detail-value">${submission.payment_id}</div>
                    </div>
                    ` : ''}
                    
                    <div class="modal-detail">
                        <div class="modal-detail-label">Name:</div>
                        <div class="modal-detail-value">${submission.name || 'N/A'}</div>
                    </div>
                    
                    <div class="modal-detail">
                        <div class="modal-detail-label">Email:</div>
                        <div class="modal-detail-value">${submission.email || 'N/A'}</div>
                    </div>
                    
                    <div class="modal-detail">
                        <div class="modal-detail-label">Mobile:</div>
                        <div class="modal-detail-value">${submission.mobile || 'N/A'}</div>
                    </div>
                    
                    <div class="modal-detail">
                        <div class="modal-detail-label">Service:</div>
                        <div class="modal-detail-value">${submission.service || 'N/A'}</div>
                    </div>
                    
                    <div class="modal-detail">
                        <div class="modal-detail-label">Editing Level:</div>
                        <div class="modal-detail-value">${submission.editing_preferences || 'N/A'}</div>
                    </div>

                    ${submission.nda ? `
                    <div class="modal-detail">
                        <div class="modal-detail-label">NDA Requested:</div>
                        <div class="modal-detail-value">Yes</div>
                    </div>
                    ` : ''}

                    <div class="modal-detail">
                        <div class="modal-detail-label">Project Instructions:</div>
                        <div class="modal-detail-value">${submission.message || 'No instructions provided'}</div>
                    </div>

                    <div class="modal-detail">
                        <div class="modal-detail-label">Submitted On:</div>
                        <div class="modal-detail-value">${submission.created_at ? formatDate(submission.created_at) : formatDate(submission.timestamp)}</div>
</div>

                    <div class="modal-detail">
                        <div class="modal-detail-label">Upload Status:</div>
                        <div class="modal-detail-value status ${getStatusInfo(submission.status).class}">
                            ${getStatusInfo(submission.status).text}
                        </div>
                    </div>
                    
                    <div class="modal-detail">
                        <div class="modal-detail-label">Editing Status:</div>
                        <div class="modal-detail-value status ${getEditingStatusInfo(submission.editing_status).class}">
                            ${getEditingStatusInfo(submission.editing_status).text}
                        </div>
                    </div>
                    
                    ${submission.file ? `
                    <div class="modal-detail">
                        <div class="modal-detail-label">Original Files:</div>
                        <div class="modal-detail-value">
                            <a href="${submission.file}" target="_blank" style="color: var(--accent);">
                                <i class="fas fa-external-link-alt"></i> View Original Files
                            </a>
                        </div>
                    </div>
                    ` : ''}

                    <div class="modal-detail">
                        <div class="modal-detail-label">Edited File:</div>
                        <div class="modal-detail-value">
                            <div class="grid-detail-value">
                                  <button onclick="downloadEditedFiles('${submission.id}')" class="file-link">
                                       <i class="fas fa-download"></i> Download Edited Files (${submission.edited_files.length})
                                  </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Preserve the original modal design, but show every successfully uploaded
        // file and attached cloud link rather than only the first file.
        const originalAttachments = [
            ...(Array.isArray(submission.files) ? submission.files.map(f => ({url: f.url, title: f.name || 'Uploaded file'})) : []),
            ...(Array.isArray(submission.links) ? submission.links.map(f => ({url: f.url, title: f.label || 'Cloud link'})) : [])
        ];
        if (originalAttachments.length) {
            const originalRow = Array.from(modal.querySelectorAll('.modal-detail')).find(row =>
                row.querySelector('.modal-detail-label')?.textContent.trim() === 'Original Files:');
            const row = originalRow || document.createElement('div');
            row.className = 'modal-detail';
            if (!originalRow) {
                const label = document.createElement('div'); label.className = 'modal-detail-label'; label.textContent = 'Original Files:';
                row.append(label);
                modal.querySelector('.modal-details')?.append(row);
            }
            let value = row.querySelector('.modal-detail-value');
            if (!value) { value = document.createElement('div'); value.className = 'modal-detail-value'; row.append(value); }
            value.replaceChildren();
            for (const attachment of originalAttachments) {
                try {
                    const url = new URL(attachment.url);
                    if (url.protocol !== 'https:') continue;
                    const anchor = document.createElement('a');
                    anchor.href = url.href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
                    anchor.style.color = 'var(--accent)'; anchor.textContent = attachment.title;
                    const line = document.createElement('div'); line.style.marginBottom = '6px';
                    line.append(anchor); value.append(line);
                } catch { /* Ignore malformed historical links. */ }
            }
        }

        document.body.appendChild(modal);

        // Show modal with animation
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);

        // Close on escape key
        document.addEventListener('keydown', function closeOnEscape(e) {
            if (e.key === 'Escape') {
                closeDetailsModal();
                document.removeEventListener('keydown', closeOnEscape);
            }
        });

    } catch (error) {
        console.error('Error showing submission details:', error);
        showAlert('Error', 'Could not load submission details', 'error');
    }
}

function closeDetailsModal() {
    const modal = document.querySelector('.details-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// Back to Top Button
function initBackToTop() {
    const backToTopButton = document.getElementById('backToTop');
    if (!backToTopButton) return;

    window.addEventListener('scroll', function () {
        if (window.pageYOffset > 300) {
            backToTopButton.classList.add('active');
        } else {
            backToTopButton.classList.remove('active');
        }
    });

    backToTopButton.addEventListener('click', function () {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// Scroll Animations
function initScrollAnimations() {
    const animateOnScroll = function () {
        const elements = document.querySelectorAll('.animated');
        const windowHeight = window.innerHeight;

        elements.forEach(element => {
            const elementPosition = element.getBoundingClientRect().top;
            const elementVisible = 150;

            if (elementPosition < windowHeight - elementVisible) {
                element.classList.add('fadeIn');
            }
        });
    };

    window.addEventListener('scroll', animateOnScroll);
    animateOnScroll();
}

// Counter Animation
function animateCounter(element, target, duration = 2000) {
    if (!element) return;

    const start = 0;
    const increment = target / (duration / 16);
    let current = start;
    const counter = setInterval(() => {
        current += increment;
        if (current >= target) {
            clearInterval(counter);
            current = target;
        }
        element.textContent = Math.floor(current).toLocaleString();
    }, 16);
}

// Alert Helper
function showAlert(title, text, icon) {
    Swal.fire({
        title,
        text,
        icon,
        confirmButtonColor: '#00bbff'
    });
}

function showLoginRequiredPopup() {
    showAlert('Login Required', 'Please log in to continue with your project submission.', 'warning');
}

// Smooth scrolling for anchor links
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });

                history.pushState(null, null, targetId);
            }
        });
    });
});

// FAQ Functionality
function initFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');

        question.addEventListener('click', () => {
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });

            item.classList.toggle('active');
        });
    });
}

// Contact Form Handler
function initContactForm() {
    const contactForm = document.getElementById('contactForm');
    if (!contactForm) return;

    contactForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const formData = new FormData(this);
        const name = formData.get('name');
        const email = formData.get('email');
        const subject = formData.get('subject');
        const message = formData.get('message');

        try {
            await apiRequest('/contact', {
                method: 'POST',
                body: { name, email, subject, message }
            });
            showAlert('Message Sent!', 'Thank you for contacting us. We will get back to you soon.', 'success');
            contactForm.reset();

        } catch (error) {
            console.error('Contact form error:', error);
            showAlert('Error', 'Failed to send message. Please try again or contact us directly.', 'error');
        }
    });
}

// Policy Modal Functionality
function showPolicy(type) {
    const modal = document.createElement('div');
    modal.className = 'policy-modal';
    modal.style.display = 'block';

    let policyContent = '';
    let policyTitle = '';

    switch (type) {
        case 'privacy':
            policyTitle = 'Privacy Policy';
            policyContent = getPrivacyPolicyContent();
            break;
        case 'terms':
            policyTitle = 'Terms & Conditions';
            policyContent = getTermsContent();
            break;
        case 'cancellation':
            policyTitle = 'Cancellation & Refund Policy';
            policyContent = getCancellationContent();
            break;
        case 'shipping':
            policyTitle = 'Shipping & Delivery Policy';
            policyContent = getShippingContent();
            break;
        default:
            policyTitle = 'Policy';
            policyContent = '<p>Policy content not available.</p>';
    }

    modal.innerHTML = `
        <div class="policy-content">
            <button class="close-policy" onclick="this.closest('.policy-modal').remove()">
                <i class="fas fa-times"></i>
            </button>
            <h2>${policyTitle}</h2>
            ${policyContent}
        </div>
    `;

    modal.addEventListener('click', function (e) {
        if (e.target === modal) {
            modal.remove();
        }
    });

    document.body.appendChild(modal);

    const closeOnEscape = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', closeOnEscape);
        }
    };
    document.addEventListener('keydown', closeOnEscape);
}

// Policy Content Functions
function getPrivacyPolicyContent() {
    return `
        <h3>Information We Collect</h3>
        <p>We collect information that you provide directly to us, including:</p>
        <ul>
            <li>Name and contact information</li>
            <li>Project details and requirements</li>
            <li>Payment information</li>
            <li>Communication records</li>
        </ul>
        
        <h3>How We Use Your Information</h3>
        <p>We use the information we collect to:</p>
        <ul>
            <li>Provide and maintain our services</li>
            <li>Process your transactions</li>
            <li>Communicate with you about your projects</li>
            <li>Improve our services</li>
        </ul>
        
        <h3>Data Security</h3>
        <p>We implement appropriate security measures to protect your personal information. All data is stored securely in Firebase with encryption.</p>
        
        <h3>Information Sharing</h3>
        <p>We do not sell, trade, or rent your personal information to third parties. We may share information only with your consent or as required by law.</p>
        
        <p><em>Last updated: January 2025</em></p>
    `;
}

function getTermsContent() {
    return `
        <h3>Acceptance of Terms</h3>
        <p>By using SimpleNails services, you agree to be bound by these Terms and Conditions. If you disagree with any part, you may not access our services.</p>
        
        <h3>Services Description</h3>
        <p>SimpleNails provides professional photo editing services including but not limited to:</p>
        <ul>
            <li>Photo retouching and enhancement</li>
            <li>Background removal and replacement</li>
            <li>Color correction and grading</li>
            <li>Creative design services</li>
        </ul>
        
        <h3>User Responsibilities</h3>
        <p>You agree to:</p>
        <ul>
            <li>Provide accurate project information</li>
            <li>Respect intellectual property rights</li>
            <li>Not upload inappropriate or illegal content</li>
            <li>Make timely payments for services rendered</li>
        </ul>
        
        <h3>Intellectual Property</h3>
        <p>You retain all rights to your original images. We claim no ownership of your content. Edited images are delivered as per project agreement.</p>
        
        <h3>Limitation of Liability</h3>
        <p>SimpleNails shall not be liable for any indirect, incidental, special, consequential or punitive damages resulting from your use of our services.</p>
        
        <p><em>Last updated: January 2025</em></p>
    `;
}

function getCancellationContent() {
    return `
        <h3>Cancellation Policy</h3>
        <p>You may cancel your project at any time before we begin editing. Cancellation requests must be made in writing via email.</p>
        
        <h3>Refund Policy</h3>
        <p>Refunds are provided under the following conditions:</p>
        <ul>
            <li><strong>Full refund:</strong> If we are unable to start your project</li>
            <li><strong>Partial refund:</strong> If project is partially completed</li>
            <li><strong>No refund:</strong> After project completion and delivery</li>
        </ul>
        
        <h3>Refund Process</h3>
        <p>Refund requests will be processed within 7-10 business days. The refund will be credited to the original payment method.</p>
        
        <h3>Quality Issues</h3>
        <p>If you're not satisfied with the quality, we offer free revisions. If we cannot meet your expectations after revisions, a refund may be issued.</p>
        
        <p><em>Last updated: January 2025</em></p>
    `;
}

function getShippingContent() {
    return `
        <h3>Delivery Timeline</h3>
        <p>We strive to deliver all projects within the promised timeframe:</p>
        <ul>
            <li><strong>Basic Editing:</strong> 24-48 hours</li>
            <li><strong>Pro Editing:</strong> 12-24 hours</li>
            <li><strong>Custom Projects:</strong> As discussed</li>
        </ul>
        
        <h3>Delivery Method</h3>
        <p>All edited files are delivered electronically via:</p>
        <ul>
            <li>Email attachment</li>
            <li>Cloud storage link</li>
            <li>Direct download from our platform</li>
        </ul>
        
        <h3>File Formats</h3>
        <p>We deliver in your preferred format (JPG, PNG, PSD, etc.) while maintaining the highest quality possible.</p>
        
        <h3>Rush Delivery</h3>
        <p>Expedited delivery is available for an additional fee. Contact us for rush service pricing.</p>
        
        <h3>Quality Assurance</h3>
        <p>All deliverables undergo quality checks before being sent to ensure they meet our standards and your requirements.</p>
        
        <p><em>Last updated: January 2025</em></p>
    `;
}

// Confirmation emails are sent by the Express backend after payment verification.
