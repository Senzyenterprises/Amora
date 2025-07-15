// ✅ HANDLE LOGIN
document.getElementById('loginForm')?.addEventListener('submit', function (e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;

    if (!email || !password) {
        return alert("Please enter both email and password.");
    }

    firebase.auth().signInWithEmailAndPassword(email, password)
        .then(cred => {
            const uid = cred.user.uid;
            return firebase.firestore().collection("users").doc(uid).get();
        })
        .then(doc => {
            if (doc.exists) {
                const userData = doc.data();
                localStorage.setItem("amora_user", JSON.stringify(userData));

                if (userData.quizCompleted) {
                    window.location.replace("profile.html");
                } else {
                    window.location.replace("match.html");
                }
            } else {
                alert("No user data found.");
            }
        })
        .catch(err => {
            console.error("Login error:", err); // Keep this for full error object for debugging

            let message = "Login failed. Please try again."; // Default generic message

            // Attempt to parse the inner message if the code is 'auth/internal-error'
            if (err.code === "auth/internal-error" && err.message) {
                try {
                    const innerError = JSON.parse(err.message);
                    if (innerError.error && innerError.error.message) {
                        const specificMessage = innerError.error.message;

                        // Map specific backend messages to user-friendly ones
                        if (specificMessage === "INVALID_LOGIN_CREDENTIALS") {
                            message = "Incorrect email or password."; // Use a combined message for security
                        } else if (specificMessage.includes("EMAIL_NOT_FOUND")) {
                            // While 'auth/user-not-found' is a direct code, sometimes it's wrapped.
                            message = "No account found with this email.";
                        } else {
                            // Fallback for other internal error messages if they appear
                            message = "An unexpected error occurred. Please try again.";
                        }
                    }
                } catch (parseError) {
                    console.warn("Could not parse Firebase internal error message:", parseError);
                    // Fallback if the message isn't valid JSON
                    message = "An unexpected error occurred. Please try again.";
                }
            } else {
                // Handle other standard Firebase Auth error codes that are not wrapped
                switch (err.code) {
                    case "auth/wrong-password":
                        // This case is unlikely to be hit if 'INVALID_LOGIN_CREDENTIALS' is always wrapped
                        message = "Incorrect password. Please try again.";
                        break;
                    case "auth/user-not-found":
                        message = "No account found with this email.";
                        break;
                    case "auth/invalid-email":
                        message = "Invalid email format.";
                        break;
                    default:
                        // Fallback for any other unhandled codes
                        message = err.message || "An unknown error occurred. Please try again.";
                        break;
                }
            }

            alert(message);
        });
});

// ✅ MODIFIED SIGNUP LOGIC
document.getElementById('signupForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();

    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('password').value;
    const gender = document.getElementById('signupGender').value;
    const interest = document.getElementById('signupInterest').value;
    const age = parseInt(document.getElementById('age').value, 10);
    const country = document.getElementById('countrySelect').value;
    const profileImageInput = document.getElementById('profileImage');
    const formError = document.getElementById("formError");
    const registrationDate = new Date().toISOString();

    // Clear previous error message
    formError.textContent = "";
    formError.style.display = "none";

    if (isNaN(age) || age < 18) {
        formError.textContent = "🚫 You must be at least 18 years old to register.";
        formError.style.display = "block";
        formError.scrollIntoView({ behavior: "smooth" });
        return;
    }

    try {
        // 1. Create User Authentication
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;

        // 2. Handle Profile Image Upload (Asynchronously)
        let profileImage = "images/icons/default_avatar.jpg"; // Default image
        if (profileImageInput && profileImageInput.files.length > 0) {
            const file = profileImageInput.files[0];
            const reader = new FileReader();

            // Wait for the file to be read
            profileImage = await new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        // 3. Save User Data to Firestore
        await firebase.firestore().collection("users").doc(uid).set({
            name,
            email,
            gender,
            interest,
            age,
            country,
            profileImage, // This will now be the data URL or default
            registrationDate,
            messagesSent: 0,
            quizCompleted: false // Assuming new users haven't completed the quiz
        });

        alert("Signup successful!");
        // Redirect after everything is successfully saved
        window.location.replace("match.html");

    } catch (err) {
        console.error("Signup error:", err);
        let errorMessage = "Something went wrong. Please try again.";

        // Provide more specific feedback for common Firebase Auth errors
        switch (err.code) {
            case "auth/email-already-in-use":
                errorMessage = "This email is already registered. Please login or use a different email.";
                break;
            case "auth/invalid-email":
                errorMessage = "Please enter a valid email address.";
                break;
            case "auth/weak-password":
                errorMessage = "Password should be at least 6 characters.";
                break;
            case "auth/operation-not-allowed":
                errorMessage = "Email/password sign-up is not enabled. Contact support."; // Check Firebase Auth settings
                break;
            default:
                errorMessage = err.message || errorMessage; // Fallback to Firebase's message or generic
        }

        formError.textContent = "🚫 " + errorMessage;
        formError.style.display = "block";
        formError.scrollIntoView({ behavior: "smooth" });
    }
});

// ✅ Reset password (your previous corrected code)
// ... (Your existing forgotPasswordLink, backToLoginBtn, sendResetLinkBtn event listeners) ...

// ⏳ Countdown function (your existing code)
// ... (Your existing startCountdown function) ...

// Ensure togglePassword and loginForm event listeners are defined if they are in this same login.js file
// Example (from your HTML, move to this JS if not already here):
/*
document.getElementById("togglePassword")?.addEventListener("click", function () {
    const loginPassword = document.getElementById("loginPassword");
    const type = loginPassword.type === "password" ? "text" : "password";
    loginPassword.type = type;
    this.textContent = type === "password" ? "👁️" : "🙈";
});
*/

// ✅ HANDLE LOGIN (Rest of your login logic remains unchanged)
// ... (Your existing loginForm event listener code) ...

// Reset password //
document.getElementById("forgotPasswordLink").addEventListener("click", function (e) {
    e.preventDefault();
    // Hide login elements
    document.querySelector("form").style.display = "none"; // This targets loginForm
    // Be more specific if you have multiple forms: document.getElementById("loginForm").style.display = "none";
    document.querySelector("h1").style.display = "none"; // Targets the <h1>Welcome Back</h1>
    document.querySelector("p").style.display = "none"; // Targets <p>Login to continue...</p>
    // This also targets <p class="forgot-text">, consider a more specific selector if issues arise
    document.getElementById("forgotPasswordLink").style.display = "none";

    // Show reset section
    document.getElementById("resetSection").style.display = "block";
    // Clear any previous messages when opening the reset section
    document.getElementById("resetMessage").textContent = "";
    document.getElementById("countdownTimer").style.display = "none";
});

document.getElementById("backToLoginBtn").addEventListener("click", function () {
    // Show login elements
    document.querySelector("form").style.display = "block";
    document.querySelector("h1").style.display = "block";
    document.querySelector("p").style.display = "block";
    document.getElementById("forgotPasswordLink").style.display = "block";

    // Hide reset section
    document.getElementById("resetSection").style.display = "none";

    // Clear reset section fields/messages
    document.getElementById("resetMessage").textContent = "";
    document.getElementById("countdownTimer").style.display = "none";
    document.getElementById("resetEmail").value = ""; // Clear the email input field
});

// ✅ MODIFIED PASSWORD RESET LOGIC
document.getElementById("sendResetLinkBtn").addEventListener("click", function () {
    const email = document.getElementById("resetEmail").value.trim();
    const resetMessage = document.getElementById("resetMessage");
    const countdownTimer = document.getElementById("countdownTimer");

    // Clear previous messages
    resetMessage.textContent = "";
    resetMessage.className = "message"; // Resetting class to remove error/success styling

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        resetMessage.textContent = "Please enter a valid email address.";
        resetMessage.classList.add("error");
        return;
    }

    // --- CRUCIAL CHANGE HERE ---
    // Instead of checking if the email exists, directly attempt to send the reset email.
    // Firebase's backend will handle whether an actual email is sent (if the account exists).
    // The front-end message should always be generic for security reasons (Email Enumeration Protection).
    firebase.auth().sendPasswordResetEmail(email)
        .then(() => {
            // Success response (even if email doesn't exist, due to security)
            console.log("Password reset email process initiated for:", email);
            resetMessage.textContent = "✅ If an account with that email exists, a password reset link has been sent to your inbox.";
            resetMessage.classList.add("success");

            // Start countdown only if the email was successfully processed by Firebase
            countdownTimer.style.display = "block";
            // Set expiryTime to 1 hour from now for the countdown
            startCountdown(Date.now() + 60 * 60 * 1000);
        })
        .catch((error) => {
            // This 'catch' block will typically only be hit for client-side errors
            // (e.g., network issues, invalid API key, disabled auth method, etc.),
            // NOT for `auth/user-not-found` if enumeration protection is active.
            console.error("Error sending password reset email:", error);
            // Provide a generic error message to the user for security.
            let errorMessage = "❌ Failed to send reset email. Please try again later.";

            // You can still provide more specific feedback for certain errors if they occur before enumeration protection kicks in
            // For instance, if the email format is invalid from Firebase's perspective, or auth is not enabled.
            if (error.code === "auth/invalid-email") {
                errorMessage = "Invalid email format provided.";
            } else if (error.code === "auth/unauthorized-domain") {
                errorMessage = "Email sending not authorized from this domain.";
            }
            // Avoid `auth/user-not-found` specific messages here for security.

            resetMessage.textContent = errorMessage;
            resetMessage.classList.add("error");
        });
});

// ⏳ Countdown function (remains unchanged, ensuring it's in this file or imported)
function startCountdown(expiryTime) {
    const countdownTimer = document.getElementById("countdownTimer");
    // Ensure countdownTimer element is available before using it
    if (!countdownTimer) {
        console.error("Countdown timer element not found!");
        return;
    }

    // Clear any existing interval to prevent multiple timers running
    if (countdownTimer.dataset.intervalId) {
        clearInterval(parseInt(countdownTimer.dataset.intervalId));
    }

    const interval = setInterval(() => {
        const now = Date.now();
        const diff = expiryTime - now;

        if (diff <= 0) {
            clearInterval(interval);
            countdownTimer.textContent = "⏰ Link expired. You can request a new one.";
            // Optionally, you might want to re-enable the send button here or change its text
        } else {
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            countdownTimer.textContent = `Resend in ${minutes}m ${seconds}s`; // Changed for clarity
        }
    }, 1000);
    countdownTimer.dataset.intervalId = interval.toString(); // Store interval ID to clear it later
}

// Ensure togglePassword and loginForm event listeners are defined if they are in this same login.js file
// Example (from your HTML, move to this JS if not already here):
/*
document.getElementById("togglePassword")?.addEventListener("click", function () {
    const loginPassword = document.getElementById("loginPassword");
    const type = loginPassword.type === "password" ? "text" : "password";
    loginPassword.type = type;
    this.textContent = type === "password" ? "👁️" : "🙈";
});
*/