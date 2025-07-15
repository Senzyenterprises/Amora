document.addEventListener("DOMContentLoaded", () => {
    const quizForm = document.getElementById("quizForm");
    const loadingOverlay = document.getElementById("loadingOverlay");
    const loadingMessage = document.getElementById("loadingMessage");
    const noMatchModal = document.getElementById("noMatchModal");
    const closeNoMatchModalBtn = document.getElementById("closeNoMatchModal");

    // --- Back button override: force go to login ---
    window.history.pushState(null, "", window.location.href);
    window.onpopstate = () => {
        if (confirm("Go back to login page?")) {
            window.location.href = "login.html";
        } else {
            window.history.pushState(null, "", window.location.href); // lock it again
        }
    };

    // --- Firebase Auth State Listener ---
    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) {
            // User is not logged in, redirect to login page
            return window.location.href = "login.html";
        }

        const uid = user.uid;
        const usersRef = firebase.firestore().collection("users");
        const quizAnswersRef = firebase.firestore().collection("quizAnswers");

       // --- Check if quiz already completed AND if not explicitly retaking ---
        const userDoc = await usersRef.doc(uid).get();
        const urlParams = new URLSearchParams(window.location.search);
        const isRetaking = urlParams.get('retake') === 'true'; // Check for ?retake=true

        if (userDoc.exists && userDoc.data().quizCompleted && !isRetaking) {
            // If quiz is completed AND we are NOT explicitly retaking,
            // then redirect to profile.html
            return window.location.href = "profile.html";
        }
        // If quiz is NOT completed, OR if isRetaking is true, allow to stay on match.html

        // --- Handle quiz submission ---
        quizForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            // Show loading overlay
            loadingOverlay.classList.add("show");
            loadingMessage.textContent = "Saving your answers...";

            const form = new FormData(quizForm);
            const userQuizData = {
                gender: form.get("gender"),
                lookingFor: form.get("lookingFor"),
                ageRange: form.get("ageRange"),
                goal: form.get("goal"),
                trait: form.get("trait"),
                dateIdea: form.get("dateIdea"),
                timestamp: new Date().toISOString(),
                userId: uid // Store the user ID with quiz data for easier lookup
            };

            try {
                // 1. Save quiz data
                await quizAnswersRef.doc(uid).set(userQuizData);

                // 2. Update user profile to mark quiz completed
                await usersRef.doc(uid).update({
                    quizCompleted: true
                });

                // Optional: Save locally (if discover.html needs immediate access)
                localStorage.setItem("amora_quiz_answers", JSON.stringify(userQuizData));

                // Change loading message
                loadingMessage.textContent = "Finding your perfect match...";

                // 3. Find a match
                await findAndRedirectOrShowNoMatch(uid, userQuizData);

            } catch (err) {
                console.error("Error during quiz submission or match finding:", err);
                alert("Something went wrong. Please try again.");
                loadingOverlay.classList.remove("show"); // Hide loading on error
            }
        });
    });

   // --- Match Finding Logic ---
async function findAndRedirectOrShowNoMatch(currentUid, currentUserQuizData) {
    // Give a short delay for "Finding your match..." message to be seen
    await new Promise(resolve => setTimeout(resolve, 1500));

    const quizAnswersRef = firebase.firestore().collection("quizAnswers");
    let matchedUser = null; // Will store the UID of the matched user

    try {
        // Fetch all other users' quiz answers
        const snapshot = await quizAnswersRef.get();
        const allQuizAnswers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Simple Matching Algorithm:
        // Find a user who matches at least 3 common criteria out of 5:
        // Mutual Gender/Preference, Age Range, Relationship Goal, Personality Trait, First Date Idea.

        const potentialMatches = allQuizAnswers.filter(otherUserQuiz => {
            // Exclude current user and users who haven't completed the quiz or don't have enough data
            if (otherUserQuiz.id === currentUid || !otherUserQuiz.gender || !otherUserQuiz.lookingFor || !otherUserQuiz.ageRange || !otherUserQuiz.goal || !otherUserQuiz.trait || !otherUserQuiz.dateIdea) {
                return false; // Ensure all required fields exist for comparison
            }

            let commonCriteria = 0;

            // 1. Mutual Gender Preference (A is looking for B, B is looking for A)
            const currentUserPrefersOtherGender = currentUserQuizData.lookingFor === "Any" || currentUserQuizData.lookingFor === otherUserQuiz.gender;
            const otherUserPrefersCurrentGender = otherUserQuiz.lookingFor === "Any" || otherUserQuiz.lookingFor === currentUserQuizData.gender;

            if (currentUserPrefersOtherGender && otherUserPrefersCurrentGender) {
                commonCriteria++;
            }

            // 2. Age Range Match
            if (currentUserQuizData.ageRange === otherUserQuiz.ageRange) {
                commonCriteria++;
            }

            // 3. Relationship Goal Match
            if (currentUserQuizData.goal === otherUserQuiz.goal) {
                commonCriteria++;
            }

            // 4. Personality Trait Match
            if (currentUserQuizData.trait === otherUserQuiz.trait) {
                commonCriteria++;
            }

            // 5. First Date Idea Match
            if (currentUserQuizData.dateIdea === otherUserQuiz.dateIdea) {
                commonCriteria++;
            }
            
            // Define your match threshold (e.g., 3 out of 5 common criteria)
            return commonCriteria >= 3; // At least 3 common points for a "match"
        });

        // ... rest of your match.js logic (if/else for potentialMatches.length > 0) ...
        // (This part with localStorage.setItem("amora_match_found", "true"); etc., is correct from previous response)
        
        if (potentialMatches.length > 0) {
            // For simplicity, pick the first potential match.
            matchedUser = potentialMatches[0].id;
            console.log("Match found:", matchedUser);

            // --- Store the specific matched UID and the general flag ---
            localStorage.setItem("amora_match_found", "true");
            localStorage.setItem("amora_match_found_uid", matchedUser); // Store the UID
            window.location.href = "discover.html";

        } else {
            // --- No match found ---
            console.log("No immediate match found.");
            loadingOverlay.classList.remove("show"); // Hide loading
            noMatchModal.classList.add("show"); // Show no match modal
            // Clear any lingering match flags if no match found
            localStorage.removeItem("amora_match_found");
            localStorage.removeItem("amora_match_found_uid");
        }
        
    } catch (error) {
        console.error("Error fetching or finding matches:", error);
        alert("Failed to find matches. Please try again.");
        loadingOverlay.classList.remove("show"); // Hide loading on error
    }
}

    // --- Close "No Match" Modal ---
    closeNoMatchModalBtn.addEventListener("click", () => {
        noMatchModal.classList.remove("show");
    });
});