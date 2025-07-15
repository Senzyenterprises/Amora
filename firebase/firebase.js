// firebase.js
// Your Firebase Project Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCA_dG4LfKzZYzUuG_esFn0XLjGzzvq1q8",
    authDomain: "amora-8cdcb.firebaseapp.com",
    projectId: "amora-8cdcb",
    storageBucket: "amora-8cdcb.appspot.com",
    messagingSenderId: "492440968557",
    appId: "1:492440968557:web:7a311da1231e4f6a84ce64",
    measurementId: "G-NWW86S1VXF"
};

// Initialize Firebase App
let app;
if (!firebase.apps.length) {
    app = firebase.initializeApp(firebaseConfig);
} else {
    app = firebase.app();
}

// Get references to Firebase services
const auth = firebase.auth();
const functions = firebase.functions();
const firestore = firebase.firestore();

// --- IMPORTANT: Connect to Emulators when running locally ---
// REMOVE OR COMMENT OUT THIS ENTIRE BLOCK TO CONNECT TO YOUR REAL FIREBASE CLOUD PROJECT
/*
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    console.log("Connecting to Firebase Emulators...");
    auth.useEmulator("http://127.0.0.1:9099");
    functions.useEmulator("http://127.0.0.1:5001");
    firestore.useEmulator("127.0.0.1", 8080);
}
*/
// --- END IMPORTANT EMULATOR SETUP ---

// Make 'auth', 'functions', and 'firestore' globally available
window.auth = auth;
window.functions = functions;
window.firestore = firestore;

// --- GLOBAL AUTHENTICATION CHECK AND REDIRECT LOGIC ---

// Pages that should only be accessible when logged OUT
const authPages = ['/login.html', '/register.html'];

// Pages that should only be accessible when logged IN
const protectedAppPages = ['/chat.html', '/discover.html', '/profile.html', '/dashboard.html'];

// Your public-facing landing page (can be viewed logged in or out)
// Special rule: if a user is logged in and navigates here, they get logged out.
const homepage = '/index.html'; // Adjust this if your actual homepage is different

auth.onAuthStateChanged(user => {
    const currentPath = window.location.pathname;

    // Check if the current page is an auth page
    const isOnAuthPage = authPages.some(path => currentPath.endsWith(path));

    // Check if the current page is a protected app page
    const isOnProtectedAppPage = protectedAppPages.some(path => currentPath.endsWith(path));

    // Check if the current page is the homepage
    const isOnHomepage = currentPath.endsWith(homepage);

    if (user) {
        // User is signed in.
        console.log("User is signed in:", user.email);

        // Rule 1: If logged in and on a login/register page, redirect to the main app page (e.g., chat.html)
        if (isOnAuthPage) {
            console.log("Logged-in user on auth page, redirecting to chat.html");
            window.location.replace('chat.html');
            return;
        }

        // Rule 2: If logged in and on the homepage (index.html), log out automatically
        if (isOnHomepage) {
            console.log("Logged-in user on homepage, logging out automatically.");
            auth.signOut()
                .then(() => {
                    console.log("Auto-logged out from homepage.");
                })
                .catch(error => {
                    console.error("Error during auto-logout from homepage:", error);
                });
            return;
        }

        // Rule 3: If logged in and on a protected app page, do nothing (allow access)
        // >>>>>>>>>>> DELETE THIS ENTIRE BLOCK <<<<<<<<<<<
        /*
        if (isOnProtectedAppPage) {
            console.log("Logged-in user on a protected app page.");
            if (typeof initializeChatApp !== 'undefined') {
                // initializeChatApp(user);
            } else {
                console.warn("initializeChatApp function not found. Ensure chat.js is loaded before firebase.js or initializeChatApp is globally accessible.");
            }
            return;
        }
        */
        // >>>>>>>>>>> END OF BLOCK TO DELETE <<<<<<<<<<<


        // Rule 4: If logged in and on any other non-auth, non-protected page (e.g., about.html), do nothing
        // This rule will now catch protected app pages as well, and simply allow access.
        console.log("Logged-in user on a public page (not auth, not homepage).");
        return; // Allow access to the page
        // The actual chat initialization will be handled by chat.js's onAuthStateChanged
    } else {
        // User is signed out.
        console.log("User is signed out.");

        // Rule 5: If signed out and on a protected app page, redirect to login page
        if (isOnProtectedAppPage) {
            console.log("Signed-out user on protected app page, redirecting to login.html");
            window.location.replace('login.html');
            return;
        }

        // Rule 6: If signed out and on a login/register page or homepage, do nothing (allow access)
        if (isOnAuthPage || isOnHomepage) {
            console.log("Signed-out user on auth page or homepage.");
            return;
        }

        // Rule 7: If signed out and on any other page (e.g., about.html), do nothing
        console.log("Signed-out user on a public page (not auth, not protected app, not homepage).");
    }
});

// Function to handle explicit logout
window.logout = async () => {
    try {
        await auth.signOut();
        console.log("User signed out explicitly.");
        // After explicit logout, always redirect to login.html
        window.location.replace("login.html");
    } catch (error) {
        console.error("Error signing out:", error);
    }
};

// Function to handle explicit logout
window.logout = async () => {
    try {
        await auth.signOut();
        console.log("User signed out explicitly.");
        // After explicit logout, always redirect to login.html
        window.location.replace("login.html");
    } catch (error) {
        console.error("Error signing out:", error);
    }
};