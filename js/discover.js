document.addEventListener("DOMContentLoaded", async () => {
    // UI elements
    const matchResults = document.getElementById("matchResults");
    const matchSummary = document.getElementById("match-summary");
    const congratulationsModal = document.getElementById("congratulationsModal");
    const closeCongratulationsModalBtn = document.getElementById("closeCongratulationsModal");
    const matchSound = document.getElementById("matchSound");
    const retakeQuizBtn = document.getElementById("retakeQuizBtn"); // NEW
    const noMatchesFoundDiv = document.getElementById("noMatchesFound"); // NEW

    // --- Check for match success flag and trigger popup/sound ---
    // This flag is typically set by match.js if an initial match was found
    const matchFoundFlag = localStorage.getItem("amora_match_found");

    if (matchFoundFlag === "true") {
        if (congratulationsModal) {
            congratulationsModal.classList.add("show");
            matchSummary.textContent = "You've got new matches!"; // Updated message for multiple matches
        }
        matchSound.play().catch(e => console.warn("Audio autoplay blocked or error:", e));
        localStorage.removeItem("amora_match_found"); // Clear the flag
    } else {
        matchSummary.textContent = "Loading your personalized matches...";
    }

    // Close congratulations modal
    if (closeCongratulationsModalBtn) {
        closeCongratulationsModalBtn.addEventListener("click", () => {
            congratulationsModal.classList.remove("show");
            matchSound.pause();
            matchSound.currentTime = 0; // Reset sound for next time
        });
    }

    // --- Retake Quiz Button Logic ---
   if (retakeQuizBtn) {
    retakeQuizBtn.addEventListener("click", () => {
        // Add a query parameter to indicate a "retake" intent
        window.location.href = "match.html?retake=true";
    });
}

    // --- Firebase Authentication and Data Fetching ---
    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) {
            return window.location.href = "login.html"; // Redirect if not logged in
        }

        const uid = user.uid;
        const usersRef = firebase.firestore().collection("users");
        const quizAnswersRef = firebase.firestore().collection("quizAnswers");

        // 1. Get current user's quiz answers and profile
        const currentUserQuizDoc = await quizAnswersRef.doc(uid).get();
        const currentUserQuizData = currentUserQuizDoc.exists ? currentUserQuizDoc.data() : null;

        const currentUserProfileDoc = await usersRef.doc(uid).get();
        const currentUserProfileData = currentUserProfileDoc.exists ? currentUserProfileDoc.data() : null;

        if (!currentUserQuizData || !currentUserProfileData) {
            matchSummary.textContent = "Please complete your profile and quiz first!";
            matchResults.innerHTML = `<p class="info-message">It looks like your profile or quiz data is incomplete. <a href="match.html">Take the quiz now</a> or update your profile.</p>`;
            if (retakeQuizBtn) retakeQuizBtn.style.display = 'block'; // Show retake if quiz not done
            return; // Stop execution
        }

        // Display current user's card
        const userImage = currentUserProfileData.profileImage || "images/icons/default_avatar.jpg";
        const userName = currentUserProfileData.name || "You";
        const userTraits = `Looking for ${currentUserQuizData.lookingFor}, interested in ${currentUserQuizData.trait}`; // You can expand these traits

        const userCard = document.createElement("div");
        userCard.className = "match-card user-card";
        userCard.innerHTML = `
            <img src="${userImage}" alt="${userName}" />
            <h3>${userName} (You)</h3>
            <p>${userTraits}</p>
        `;
        matchResults.appendChild(userCard);

        // --- Core Matching Logic: Find ALL compatible users ---
       // Create and append the separator
            const separator = document.createElement('hr');
            separator.className = 'match-separator';
            matchResults.appendChild(separator);

            // Create and append the heading for potential connections
            const connectionsHeading = document.createElement('h2');
            connectionsHeading.textContent = 'Potential Connections:';
            connectionsHeading.className = 'potential-connections-heading'; // Add this class for specific styling
            matchResults.appendChild(connectionsHeading);

            // --- Core Matching Logic: Find ALL compatible users ---
            let foundMatchesCount = 0;

        try {
            // Fetch ALL other users' quiz answers
            const allQuizDocs = await quizAnswersRef.get();
            const allQuizAnswers = allQuizDocs.docs.map(doc => ({ id: doc.id, data: doc.data() }));

            for (const otherUserQuiz of allQuizAnswers) {
                const otherUid = otherUserQuiz.id;

                // Skip current user and any incomplete quiz data
                if (otherUid === uid || !otherUserQuiz.data || !otherUserQuiz.data.lookingFor || !otherUserQuiz.data.trait) {
                    continue;
                }

                // --- Implement your detailed matching criteria here ---
                let commonTraits = 0;

                // Example comparisons (adjust these field names to match your actual quiz questions)
                // Ensure mutual preference: your gender matches what they're looking for, AND vice versa
                if (currentUserQuizData.gender === otherUserQuiz.data.lookingFor &&
                    otherUserQuiz.data.gender === currentUserQuizData.lookingFor) {
                    commonTraits++;
                }
                // Age range compatibility (can be refined for overlapping ranges)
                if (currentUserQuizData.ageRange === otherUserQuiz.data.ageRange) {
                    commonTraits++;
                }
                // Shared personality trait preference
                if (currentUserQuizData.trait === otherUserQuiz.data.trait) {
                    commonTraits++;
                }
                // Shared date idea preference
                if (currentUserQuizData.dateIdea === otherUserQuiz.data.dateIdea) {
                    commonTraits++;
                }
                // Example for interests (if interests is an array)
                // if (currentUserQuizData.interests && otherUserQuiz.data.interests && Array.isArray(currentUserQuizData.interests) && Array.isArray(otherUserQuiz.data.interests)) {
                //     const commonInterestCount = currentUserQuizData.interests.filter(item => otherUserQuiz.data.interests.includes(item)).length;
                //     if (commonInterestCount > 0) commonTraits++; // Increment if there's at least one common interest
                // }


                // If 3 or more traits are common, display them as a match
                if (commonTraits >= 3) {
                    const matchedUserDoc = await usersRef.doc(otherUid).get();
                    if (matchedUserDoc.exists) {
                        const matchedUserData = matchedUserDoc.data();
                        const personName = `${matchedUserData.name}, ${matchedUserData.age}`;
                        const personImage = matchedUserData.profileImage || "images/icons/default_avatar.jpg";
                        const personTraits = `Likes ${otherUserQuiz.data.dateIdea}, seeks ${otherUserQuiz.data.trait}`; // Example traits from quiz

                        const card = document.createElement("div");
                        card.className = "match-card";
                        card.innerHTML = `
                            <img src="${personImage}" alt="${personName}" />
                            <h3>${personName}</h3>
                            <p>${personTraits}</p>
                            <p class="common-traits-count"><strong>${commonTraits} common interests!</strong></p>
                            <button class="chat-button" data-uid="${otherUid}">Chat Now!</button>
                        `;
                        matchResults.appendChild(card);
                        foundMatchesCount++;
                    }
                }
            }

            if (foundMatchesCount === 0) {
                matchSummary.textContent = "No matches found based on your preferences.";
                if (noMatchesFoundDiv) noMatchesFoundDiv.style.display = 'block'; // Show "No Matches" message
            } else {
                matchSummary.textContent = `You've found ${foundMatchesCount} potential matches!`;
            }
            // Always show the retake quiz button here, regardless of matches found
            if (retakeQuizBtn) retakeQuizBtn.style.display = 'block';

        } catch (error) {
            console.error("Error finding matches:", error);
            matchSummary.textContent = "An error occurred while loading matches.";
            if (retakeQuizBtn) retakeQuizBtn.style.display = 'block';
        }

        // Add event listener for chat buttons dynamically
        matchResults.addEventListener('click', (event) => {
            if (event.target.classList.contains('chat-button')) {
                const targetUid = event.target.dataset.uid;
                // Redirect to chat.html, passing the target UID
                window.location.href = `chat.html?chatWith=${targetUid}`;
            }
        });
    });
});