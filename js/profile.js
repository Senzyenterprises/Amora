// profile.js

// Firebase services are available globally from firebase/firebase.js
// Do NOT re-declare them with const/let here.
// For example, 'auth' and 'firestore' should already be accessible.

// Prevent access if not logged in
// This part should ideally rely on Firebase's onAuthStateChanged listener
// rather than just localStorage for security and real-time auth status.
// For now, we'll keep the localStorage check but add a Firebase listener as well.

let currentUserData = null; // Store fetched user data from Firestore

// --- Firebase Auth State Listener ---
// This is the most reliable way to check login status and get user data.
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is logged in
        console.log("profile.js: User is logged in. UID:", user.uid);

        // Fetch user's full profile from Firestore
        try {
            const userDoc = await firestore.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                currentUserData = userDoc.data();
                // Merge Firebase Auth data (like email, displayName) with Firestore data
                currentUserData.email = user.email;
                currentUserData.name = currentUserData.name || user.displayName || 'User';
                currentUserData.uid = user.uid; // Store UID for consistency

                // Now that we have the full user data, render the profile
                renderProfileView();
                loadEditForm(); // Load form with current data
            } else {
                console.warn("No user profile found in Firestore for UID:", user.uid);
                // Handle case where Firestore profile might not exist (e.g., new user)
                // You might want to redirect them to a profile creation page or show a default.
                // For now, use basic auth info:
                currentUserData = {
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName || 'User',
                    profileImage: 'images/default_avatar.png',
                    registrationDate: new Date().toISOString(),
                    messagesSent: 0,
                    gender: '-',
                    interest: '-',
                    age: '-',
                    country: '-' // Add a default country
                };
                renderProfileView();
                loadEditForm();
            }
        } catch (error) {
            console.error("Error fetching user profile from Firestore:", error);
            // Fallback to basic user data from Auth if Firestore fails
            currentUserData = {
                uid: user.uid,
                email: user.email,
                name: user.displayName || 'User',
                profileImage: 'images/default_avatar.png',
                registrationDate: new Date().toISOString(),
                messagesSent: 0,
                gender: '-',
                interest: '-',
                age: '-',
                country: '-'
            };
            renderProfileView();
            loadEditForm();
        }

    } else {
        // User is not logged in, redirect to login page
        console.log("profile.js: User not logged in. Redirecting to login.html");
        window.location.replace('login.html');
    }
});


// Convert ISO date to readable format
function formatDate(iso) {
    if (!iso) return '-';
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Badge system based on messages sent (this would ideally come from Firestore)
function getUserBadge(msgCount) {
    if (msgCount >= 50) return '🌟 Professional';
    if (msgCount >= 10) return '✨ Enthusiast';
    return '🌟 Novice';
}

// Render profile view
function renderProfileView() {
    if (!currentUserData) {
        console.warn("renderProfileView called, but currentUserData is not set.");
        return;
    }

    document.getElementById('viewName').textContent = currentUserData.name || 'User';
    document.getElementById('viewEmail').textContent = currentUserData.email || '-';
    document.getElementById('viewGender').textContent = currentUserData.gender || '-';
    document.getElementById('viewInterest').textContent = currentUserData.interest || '-';
    document.getElementById('viewAge').textContent = currentUserData.age || '-';
    document.getElementById('viewRegistered').textContent = formatDate(currentUserData.registrationDate);
    document.getElementById('viewBadge').textContent = getUserBadge(currentUserData.messagesSent || 0);
    document.getElementById('profileImage').src = currentUserData.profileImage || 'images/default_avatar.png';
}

// Load user data into the edit form
function loadEditForm() {
    if (!currentUserData) {
        console.warn("loadEditForm called, but currentUserData is not set.");
        return;
    }
    document.getElementById('editName').value = currentUserData.name || '';
    document.getElementById('editEmail').value = currentUserData.email || '';
    document.getElementById('editGender').value = currentUserData.gender || '';
    document.getElementById('editInterest').value = currentUserData.interest || '';
    document.getElementById('editAge').value = currentUserData.age || '';
    // Email should ideally be read-only if Firebase email update is handled separately
    document.getElementById('editEmail').setAttribute('readonly', 'true');
    document.getElementById('editEmail').classList.add('readonly-input'); // Add a class for styling
}

// Click "Edit" → show form
document.getElementById('editProfileBtn')?.addEventListener('click', () => {
    document.getElementById('profileView').style.display = 'none';
    document.getElementById('editProfileForm').style.display = 'block';
    loadEditForm();
});

// Click "Cancel" → confirm and go back
document.getElementById('cancelEditBtn')?.addEventListener('click', () => {
    if (confirm("Cancel changes and return to your profile?")) {
        document.getElementById('editProfileForm').style.display = 'none';
        document.getElementById('profileView').style.display = 'block';
        renderProfileView(); // Re-render with original data in case user changed form but cancelled
    }
});

// Upload image
document.getElementById('changeImageBtn')?.addEventListener('click', () => {
    document.getElementById('uploadImage').click();
});

document.getElementById('uploadImage')?.addEventListener('change', async function () {
    const file = this.files[0];
    if (file && currentUserData) {
        try {
            // Upload to Firebase Storage
            const storageRef = firebase.storage().ref();
            const imageRef = storageRef.child(`profile_images/${currentUserData.uid}/${file.name}`);
            const snapshot = await imageRef.put(file);
            const downloadURL = await snapshot.ref.getDownloadURL();

            // Update profileImage in Firestore
            await firestore.collection('users').doc(currentUserData.uid).update({
                profileImage: downloadURL
            });

            // Update local data and UI
            currentUserData.profileImage = downloadURL;
            document.getElementById('profileImage').src = downloadURL;
            // No need to set localStorage here if relying primarily on Firestore for user data
            // localStorage.setItem('amora_user', JSON.stringify(currentUserData));
            alert("Profile image updated successfully!");
        } catch (error) {
            console.error("Error uploading image or updating profile:", error);
            alert("Failed to update profile image. Please try again.");
        }
    }
});

// Submit edit form
document.getElementById('editProfileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentUserData) {
        alert("User data not loaded. Please try again.");
        return;
    }

    const name = document.getElementById('editName').value.trim();
    const gender = document.getElementById('editGender').value;
    const interest = document.getElementById('editInterest').value;
    const age = parseInt(document.getElementById('editAge').value); // Convert to number

    const oldPw = document.getElementById('oldPassword').value;
    const newPw = document.getElementById('newPassword').value;
    const confirmPw = document.getElementById('confirmPassword').value;

    const passwordError = document.getElementById('passwordError');
    passwordError.textContent = '';

    // Update profile fields in Firestore
    const updates = {};
    if (name !== currentUserData.name) updates.name = name;
    if (gender !== currentUserData.gender) updates.gender = gender;
    if (interest !== currentUserData.interest) updates.interest = interest;
    if (age !== currentUserData.age && !isNaN(age)) updates.age = age;


    // Password change logic (requires re-authentication for security)
    if (newPw || confirmPw) {
        if (newPw !== confirmPw) {
            passwordError.textContent = "New passwords do not match.";
            return;
        }
        if (!oldPw) {
            passwordError.textContent = "Please enter your current password to change it.";
            return;
        }

        try {
            const user = auth.currentUser;
            const credential = firebase.auth.EmailAuthProvider.credential(user.email, oldPw);
            await user.reauthenticateWithCredential(credential);
            await user.updatePassword(newPw);
            alert("Password updated successfully!");
            // Clear password fields
            document.getElementById('oldPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } catch (error) {
            console.error("Error updating password:", error);
            if (error.code === 'auth/wrong-password') {
                passwordError.textContent = "Current password is incorrect.";
            } else if (error.code === 'auth/weak-password') {
                passwordError.textContent = "New password is too weak (min 6 characters).";
            } else if (error.code === 'auth/requires-recent-login') {
                passwordError.textContent = "Please log in again to update your password.";
                // Optionally redirect to login or force re-authentication
                await window.logout(); // Use your global logout if available
            } else {
                passwordError.textContent = `Error updating password: ${error.message}`;
            }
            return; // Stop form submission if password update failed
        }
    }

    if (Object.keys(updates).length > 0) {
        try {
            await firestore.collection('users').doc(currentUserData.uid).update(updates);
            // Update local data
            Object.assign(currentUserData, updates);
            alert("Profile updated!");
        } catch (error) {
            console.error("Error updating profile in Firestore:", error);
            alert("Failed to update profile. Please try again.");
            return; // Stop if profile update failed
        }
    } else {
        // Only show this if no profile fields were changed AND no password change was attempted
        if (!newPw && !oldPw && !confirmPw) {
            alert("No changes to save.");
        }
    }


    document.getElementById('editProfileForm').style.display = 'none';
    document.getElementById('profileView').style.display = 'block';
    renderProfileView();
});

// Logout
// *** THIS IS THE KEY CHANGE ***
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    if (confirm("Are you sure you want to logout?")) {
        console.log("Logout button clicked in profile.js.");
        if (window.logout) { // Check if the global logout function exists
            await window.logout(); // Call the global logout function from firebase.js
        } else {
            // Fallback if window.logout is not defined (shouldn't happen if firebase.js is loaded correctly)
            console.warn("window.logout() function not found. Performing local logout fallback.");
            await firebase.auth().signOut(); // Directly call Firebase signOut
            // Clear any local storage data that might conflict
            localStorage.removeItem('amora_user');
            window.location.replace('login.html');
        }
    }
});


// Initial render (will be called once currentUserData is available from onAuthStateChanged)
// renderProfileView(); // No need to call here, onAuthStateChanged will call it.

// Script for preventing back button cache (keep this in HTML or at the very end if moved to JS)
// It's generally better practice to put this within a DOMContentLoaded listener
// or similar if you move it to the JS file to ensure the script runs after the page loads.
document.addEventListener('DOMContentLoaded', () => {
    if (performance.navigation.type === 2) {
        location.reload(); // Force reload if user tries to go back from profile
    }
});