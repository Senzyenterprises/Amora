document.addEventListener('DOMContentLoaded', () => {
    const adminLoginForm = document.getElementById('adminLoginForm');
    const adminEmailInput = document.getElementById('adminEmail');
    const adminPasswordInput = document.getElementById('adminPassword');
    const adminLoginError = document.getElementById('adminLoginError');

    // Ensure Firebase is initialized
    // This check should already be in your firebase/firebase.js, but good to ensure
    if (!firebase.apps.length) {
        // You might want to display an error or handle this case if firebaseConfig is not loaded.
        console.error("Firebase has not been initialized. Check firebase/firebase.js.");
        adminLoginError.textContent = "Application error: Firebase not configured.";
        adminLoginError.style.display = 'block';
        return; // Stop execution if Firebase isn't ready
    }

    // Get Firestore instance (after firebase app is initialized)
    const db = firebase.firestore();

    adminLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent default form submission

        const email = adminEmailInput.value;
        const password = adminPasswordInput.value;

        adminLoginError.textContent = ''; // Clear previous errors
        adminLoginError.style.display = 'none'; // Hide error message

        try {
            // 1. Authenticate with Firebase
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            if (user) {
                // 2. Check Admin Role in Firestore
                // We'll look for a document in a 'users' collection
                // where the document ID is the user's UID and it has role: 'admin'
                const userDoc = await db.collection('users').doc(user.uid).get();

                if (userDoc.exists && userDoc.data().role === 'admin') {
                    // 3. User is an admin, redirect to dashboard
                    window.location.href = 'admin-dashboard.html';
                } else {
                    // 4. User is authenticated, but not an admin
                    // Log them out immediately to prevent unauthorized access
                    await firebase.auth().signOut();
                    adminLoginError.textContent = 'Access Denied: You do not have administrator privileges.';
                    adminLoginError.style.display = 'block';
                }
            }
        } catch (error) {
            // Handle Firebase authentication errors
            let errorMessage = 'An unknown error occurred. Please try again.';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                errorMessage = 'Invalid email or password.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Please enter a valid email address.';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = 'Network error. Please check your internet connection.';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Too many login attempts. Please try again later.';
            } else {
                console.error("Admin Login Error:", error);
            }
            adminLoginError.textContent = errorMessage;
            adminLoginError.style.display = 'block';
        }
    });
});