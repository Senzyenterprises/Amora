
// DOM Elements
const pendingList = document.getElementById('pending-list');
const activeChatList = document.getElementById('active-chat-list');
const chatPartnerPic = document.getElementById('chat-partner-pic');
const chatPartnerName = document.getElementById('chat-partner-name');
const typingIndicator = document.getElementById('typing-indicator');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');
const logoutBtn = document.getElementById('logout-btn');
const sidebar = document.querySelector('.sidebar');
const menuToggleBtn = document.getElementById('menu-toggle');
const sidebarToggleBtn = document.getElementById('sidebar-toggle');
const chatInputArea = document.querySelector('.chat-input-area');


// --- Global Variables //
let currentChatId = 'ai-chat'; // Default to AI chat
let currentUser;
let messagesUnsubscribe = null;
let typingTimeout;
let typingUnsubscribe = null;


// AI Chatbot
const aiResponses = {
    greetings: [
        "Hello! I'm Amora, your friendly AI assistant. How can I help you find your perfect match today?",
        "Welcome to Amora! I'm here to guide you on your journey to find love.",
        "Hi there! I'm Amora. Let's find you a meaningful connection.",
        "Greetings! Amora here, ready to assist you in your search for companionship.",
        "Nice to meet you! I'm Amora, your guide to discovering wonderful connections."
    ],
    encouragement: [
        "Finding the right person takes time. Don't give up!",
        "Every conversation is a new opportunity. Stay positive!",
        "You're one step closer to finding your match. Keep going!",
        "You're doing great! The perfect person could be just around the corner.",
        "Keep shining! Your ideal match is out there.",
        "Patience is key in matters of the heart. You've got this!",
        "Don't lose hope! Every profile view is a step forward.",
        "Believe in yourself and the process. Great things are coming!",
        "Your journey to love is unique and beautiful. Embrace it!"
    ],
    default: [
        "That's interesting! Tell me more.",
        "I'm here to help. What's on your mind?",
        "Let's talk about what you're looking for in a partner.",
        "I understand. Could you tell me more about what you're feeling?",
        "What aspects of a relationship are most important to you?",
        "I'm listening. What else can I assist you with?",
        "That's a good point. How can I help you explore that further?"
    ]
};

function getAIResponse(message) {
    const lowerCaseMessage = message.toLowerCase();
    if (lowerCaseMessage.includes('hello') || lowerCaseMessage.includes('hi')) {
        return aiResponses.greetings[Math.floor(Math.random() * aiResponses.greetings.length)];
    } else if (lowerCaseMessage.includes('sad') || lowerCaseMessage.includes('discouraged')) {
        return aiResponses.encouragement[Math.floor(Math.random() * aiResponses.encouragement.length)];
    } else {
        return aiResponses.default[Math.floor(Math.random() * aiResponses.default.length)];
    }
}

function displayMessage(message) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message");
    const isMyMessage = currentUser && message.senderId === currentUser.uid;

    if (isMyMessage) {
        messageElement.classList.add("sent");
    } else {
        messageElement.classList.add("received");
    }

    let timestampDate;
    if (message.timestamp && typeof message.timestamp.toDate === 'function') {
        timestampDate = message.timestamp.toDate();
    } else if (message.timestamp && typeof message.timestamp.seconds === 'number') {
        timestampDate = new Date(message.timestamp.seconds * 1000);
    } else {
        timestampDate = new Date(); // Fallback to current time if timestamp is invalid
    }

    // --- START MODIFIED CODE ---

    // 1. Create the timestamp element
    const timestampSpan = document.createElement('span');
    timestampSpan.classList.add('timestamp'); // Use 'timestamp' class as per CSS
    timestampSpan.textContent = timestampDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 2. Create the message bubble element
    const bubbleDiv = document.createElement('div');
    bubbleDiv.classList.add('bubble');

    // 3. Create the message text element (optional, can directly use textContent on bubbleDiv if no other inner elements)
    const messageTextSpan = document.createElement('span');
    messageTextSpan.classList.add('message-text');
    messageTextSpan.textContent = message.text;
    bubbleDiv.appendChild(messageTextSpan); // Append text to the bubble

    // 4. Append elements to messageElement in the correct order for flexbox
    // For sent messages, the bubble should appear first in HTML to be on the right
    // For received messages, the timestamp should appear first in HTML to be on the left
    if (isMyMessage) { // This is a 'sent' message
        messageElement.appendChild(bubbleDiv);
        messageElement.appendChild(timestampSpan);
    } else { // This is a 'received' message
        messageElement.appendChild(timestampSpan);
        messageElement.appendChild(bubbleDiv);
    }

    // --- END MODIFIED CODE ---

    chatMessages.appendChild(messageElement);
    // Auto-scroll to the bottom of the chat
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setTypingStatus(isTyping) {
    if (currentChatId === 'ai-chat' || !currentUser) return;
    
    const typingUpdate = {};
    typingUpdate[`typing.${currentUser.uid}`] = isTyping;

    firestore.collection('chats').doc(currentChatId).update(typingUpdate);

    if (isTyping) {
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            setTypingStatus(false);
        }, 3000);
    }
}

async function findOrCreateChat(user1Id, user2Id) {
    // Sort participant UIDs to ensure consistent querying (e.g., ['a', 'b'] is always the same as ['b', 'a'])
    const participants = [user1Id, user2Id].sort();

    const chatsRef = firestore.collection("chats");

    // Query for an existing chat document that includes these two participants
    const existingChatQuery = await chatsRef
        .where("participants", "==", participants)
        .limit(1) // Expecting only one chat between a given pair of users
        .get();

    if (!existingChatQuery.empty) {
        // If a chat document is found, return its ID and data
        const chatDoc = existingChatQuery.docs[0];
        console.log("Existing chat found:", chatDoc.id);
        return { chatId: chatDoc.id, chatData: chatDoc.data() };
    } else {
        // If no existing chat is found, create a new one
        console.log("No existing chat, creating new one...");
        const newChatData = {
            participants: participants,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessage: "", // Initialize with an empty last message
            lastMessageTimestamp: null,
            status: 'active' // New chats initiated via "Chat Now" are typically active immediately
        };
        const newChatRef = await chatsRef.add(newChatData); // Add the new chat document
        console.log("New chat created with ID:", newChatRef.id);
        return { chatId: newChatRef.id, chatData: newChatData };
    }
}

function loadMessages(chatId) {
    // 1. Unsubscribe from previous chat's messages to avoid memory leaks
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
        console.log("Unsubscribed from previous messages listener.");
    }

    // 2. Clear current messages from the display only when switching chats or initiating a new load
    // This is crucial: the actual clearing must happen *before* the new listener is set up.
    chatMessages.innerHTML = '';

    // 3. Handle AI chat separately
    if (chatId === 'ai-chat') {
        chatPartnerName.textContent = "Amora AI";
        chatPartnerPic.src = "images/icons/ai_avatar.jpg";
        // Display initial AI message
        const aiMessage = {
            text: "Hello! I'm Amora, your friendly AI assistant. How can I help you?",
            senderId: 'ai',
            timestamp: { seconds: Date.now() / 1000, nanoseconds: 0 } // Ensure displayMessage can handle this
        };
        displayMessage(aiMessage);
        // No Firestore listener for AI chat
        return;
    }

    // 4. Set up the Firestore listener for the current chat's messages
    let lastDate = null; // To handle date separators in chat
    messagesUnsubscribe = firestore.collection('chats').doc(chatId).collection('messages')
        .orderBy('timestamp', 'asc') // CRITICAL: Order by timestamp
        .onSnapshot(snapshot => {
            // This logic needs to differentiate between initial load and real-time updates.
            // A common pattern is to re-render the *entire* chat content on *every* snapshot
            // if efficiency is not a critical concern, or manage docChanges carefully.
            // Given your current `displayMessage` appends, clearing for every snapshot
            // and re-adding from the full snapshot.docs is the safest.

            chatMessages.innerHTML = ''; // **Clear messages for every snapshot change**
                                        // This ensures the view is always consistent with the DB
                                        // and prevents duplicates, though it might cause a slight flicker.
                                        // For true real-time append without flicker, you'd track
                                        // `change.type` and update specific elements. But this is simpler to start.

            lastDate = null; // Reset lastDate for new snapshot processing

            snapshot.docs.forEach(doc => { // Iterate through all documents in the snapshot
                const message = doc.data();
                if (!message.timestamp) {
                    console.warn("Message missing timestamp:", message);
                    return; // Skip messages without a timestamp
                }

                const timestampDate = message.timestamp.toDate ? message.timestamp.toDate() : new Date(message.timestamp.seconds * 1000);
                const messageDate = timestampDate.toLocaleDateString();

                if (messageDate !== lastDate) {
                    const dateElement = document.createElement('div');
                    dateElement.className = 'message-date';
                    dateElement.textContent = timestampDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                    chatMessages.appendChild(dateElement);
                    lastDate = messageDate;
                }
                displayMessage(message); // This function appends the message
            });

            // 5. Scroll to the bottom after messages are loaded/added
            chatMessages.scrollTop = chatMessages.scrollHeight;

        }, error => {
            console.error("Error loading messages:", error);
            chatMessages.innerHTML = `<p class="error-message">Could not load messages. ${error.message}</p>`;
        });
}

function displayPendingChat(chat, chatId) {
    console.log("Attempting to display pending chat:", chatId, chat);
    // ... your existing code ...
    pendingList.appendChild(chatItem); // This is the line that adds it
    console.log("Chat item appended to pendingList:", chatItem);
    // ... rest of your code
}

function displayActiveChat(chat, chatId) {
    // 1. Identify the other user in the chat
    const otherUserId = chat.participants.find(id => id !== currentUser.uid); // <-- ADD THIS LINE!
    if (!otherUserId) {
        console.warn("Could not find other participant in chat:", chatId, chat.participants, "for current user:", currentUser.uid);
        return; // Return if we can't identify the other user
    }

    // 2. Fetch the other user's profile information
    firestore.collection('users').doc(otherUserId).get().then(doc => {
        if (!doc.exists) {
            console.warn("User profile not found for chat participant:", otherUserId);
            // Fallback to display a generic "Unknown User" chat item
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            chatItem.dataset.chatId = chatId;
            chatItem.innerHTML = `
                <img src="images/icons/default_avatar.jpg" alt="Unknown User" class="profile-pic">
                <div class="chat-info">
                    <p class="chat-name">Unknown User</p>
                    <p class="last-message">${chat.lastMessage || '...'}</p>
                </div>
                <span class="chat-timestamp">Error user profile</span>
            `;
            activeChatList.appendChild(chatItem);

            chatItem.addEventListener('click', () => {
                currentChatId = chatId;
                loadMessages(chatId);
                chatPartnerName.textContent = "Unknown User";
                chatPartnerPic.src = 'images/icons/default_avatar.jpg';
                chatPartnerPic.alt = "Unknown User";
                document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
                chatItem.classList.add('active');
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                }
            });
            return; // Exit after displaying fallback
        }
        const user = doc.data(); // This 'user' object should contain name and profilePic

        // 3. Create the chat list item
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.chatId = chatId;
        chatItem.innerHTML = `
            <img src="${user.profilePic || 'images/icons/default_avatar.jpg'}" alt="${user.name}" class="profile-pic">
            <div class="chat-info">
                <p class="chat-name">${user.name}</p>
                <p class="last-message">${chat.lastMessage || 'No messages yet.'}</p>
            </div>
            <span class="chat-timestamp">${chat.timestamp ? new Date(chat.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
        `;
        activeChatList.appendChild(chatItem);
        console.log("Chat item appended to activeChatList:", chatItem); // Your log
        console.log("User data fetched for active chat:", user.name, user.profilePic); // Your log

        // 4. Add click listener to activate the chat in the main view
        chatItem.addEventListener('click', () => {
            currentChatId = chatId; // Set the global active chat ID
            loadMessages(chatId); // Load messages for this chat

            // Update main chat header with the selected user's info
            chatPartnerName.textContent = user.name;
            chatPartnerPic.src = user.profilePic || 'images/icons/default_avatar.jpg';
            chatPartnerPic.alt = user.name;

            // Manage active styling
            document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
            chatItem.classList.add('active');

            // Close sidebar on mobile
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }
        });
    }).catch(error => {
        console.error("Error fetching user data for chat list item:", error);
        // Fallback: Still display a chat item but with generic info
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.chatId = chatId;
        chatItem.innerHTML = `
            <img src="images/icons/default_avatar.jpg" alt="Unknown User" class="profile-pic">
            <div class="chat-info">
                <p class="chat-name">Unknown User</p>
                <p class="last-message">${chat.lastMessage || '...'}</p>
            </div>
            <span class="chat-timestamp">Error loading user</span>
        `;
        activeChatList.appendChild(chatItem);
        chatItem.addEventListener('click', () => { /* basic click logic */
            currentChatId = chatId;
            loadMessages(chatId);
            chatPartnerName.textContent = "Unknown User";
            chatPartnerPic.src = 'images/icons/default_avatar.jpg';
            chatPartnerPic.alt = "Unknown User";
            document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
            chatItem.classList.add('active');
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }
        });
    });
}

function loadChats() {
    // Unsubscribe from any previous chat list listener
    // This isn't strictly necessary if loadChats is only called once on auth state change
    // but it's good practice if it could be called from other places too.
    // let chatListUnsubscribe = null; // Assuming this is a global variable declared at the top

    // if (chatListUnsubscribe) {
    //     chatListUnsubscribe();
    // }

    firestore.collection('chats')
        .where('participants', 'array-contains', currentUser.uid)
        // Order by timestamp to show most recent chats at the top
        .orderBy('timestamp', 'desc')
        .onSnapshot(snapshot => {
            // Keep a reference to the AI chat item if it exists in activeChatList
            const aiChatItem = activeChatList.querySelector('.ai-chat-item');

            // --- CRITICAL CHANGE: Clear both lists BEFORE processing the new snapshot ---
            // This ensures no old, stale chat items remain if a chat status changes
            // or a chat is removed from the database.
            pendingList.innerHTML = '';
            activeChatList.innerHTML = '';

            // Re-append the AI chat item if it was found
            if (aiChatItem) {
                activeChatList.appendChild(aiChatItem);
            }

            snapshot.docChanges().forEach(change => {
                const chat = change.doc.data();
                const chatId = change.doc.id;

                if (!chat.participants) {
                    console.warn("Chat document missing participants array:", chatId);
                    return;
                }

                // Handle 'added' and 'modified' changes
                if (change.type === 'added' || change.type === 'modified') {
                    // Check if the chat is already in the DOM (either active or pending list)
                    // If it exists, remove it first to re-add with updated data/status
                    let existingActive = activeChatList.querySelector(`[data-chat-id="${chatId}"]`);
                    let existingPending = pendingList.querySelector(`[data-chat-id="${chatId}"]`);

                    if (existingActive) existingActive.remove();
                    if (existingPending) existingPending.remove();

                    if (chat.status === 'pending') {
                        displayPendingChat(chat, chatId);
                    } else if (chat.status === 'active') {
                        displayActiveChat(chat, chatId);
                    }
                } else if (change.type === 'removed') {
                    // Handle chat removal from the database
                    const removedActive = activeChatList.querySelector(`[data-chat-id="${chatId}"]`);
                    const removedPending = pendingList.querySelector(`[data-chat-id="${chatId}"]`);
                    if (removedActive) removedActive.remove();
                    if (removedPending) removedPending.remove();
                }
            });

            // After all changes are processed, ensure the currently selected chat is active
            document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active')); // Clear all active states

            if (currentChatId === 'ai-chat' && aiChatItem) {
                aiChatItem.classList.add('active');
            } else {
                const currentActiveItem = activeChatList.querySelector(`[data-chat-id="${currentChatId}"]`);
                if (currentActiveItem) {
                    currentActiveItem.classList.add('active');
                    // --- CRITICAL FOR HEADER UPDATE ON REFRESH/LOGIN ---
                    // If the current chat is not AI, and it's found in the active list,
                    // also update the header based on its data.
                    // You'll need to fetch the 'user' data for this.
                    const otherUserId = snapshot.docs.find(doc => doc.id === currentChatId)?.data()?.participants.find(id => id !== currentUser.uid);
                    if (otherUserId) {
                        firestore.collection('users').doc(otherUserId).get().then(doc => {
                            if (doc.exists) {
                                const user = doc.data();
                                chatPartnerName.textContent = user.name || "Unknown User";
                                chatPartnerPic.src = user.profilePic || 'images/icons/default_avatar.jpg';
                                chatPartnerPic.alt = user.name || "Chat Partner";
                            }
                        }).catch(error => {
                            console.error("Error updating header for active chat:", error);
                        });
                    }
                }
            }
        }, error => {
            console.error("Error loading chat list:", error);
            // Optionally display an error message to the user
        });
}

function listenForTyping(chatId) {
    if (typingUnsubscribe) {
        typingUnsubscribe();
    }
    if (chatId === 'ai-chat') {
        typingIndicator.textContent = '';
        return;
    }
    typingUnsubscribe = firestore.collection('chats').doc(chatId).onSnapshot(doc => {
        if (!doc.exists) return;
        const data = doc.data();
        const typingUsers = data.typing || {};
        const otherUserId = Object.keys(typingUsers).find(id => id !== currentUser?.uid && typingUsers[id]);
        
        if (otherUserId) {
            firestore.collection('users').doc(otherUserId).get().then(userDoc => {
                if (userDoc.exists) {
                    typingIndicator.textContent = `${userDoc.data().name} is typing...`;
                }
            });
        } else {
            typingIndicator.textContent = '';
        }
    });
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (text === '') return;

    // tempId and setTypingStatus might be for local UI feedback; keep them if needed
    const tempId = `temp_${Date.now()}`;
    messageInput.value = ''; // Input is cleared here
    setTypingStatus(false); // Assuming you have this function

    // --- IMPORTANT: ADD BLUR AND SCROLL HERE FOR ALL MESSAGE SEND PATHS ---
    // These actions are critical for iOS layout behavior after keyboard dismissal.
    messageInput.blur(); // Hide the virtual keyboard
    chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to bottom

    if (currentChatId === 'ai-chat') {
        const userMessage = { text, senderId: currentUser.uid, timestamp: new Date() };
        displayMessage(userMessage); // Display user's message immediately

        setTimeout(() => {
            const aiMessageText = getAIResponse(text); // Assuming you have this function
            const aiMessage = { text: aiMessageText, senderId: 'ai', timestamp: new Date() };
            displayMessage(aiMessage); // Display AI's response
        }, 1000);
        return; // Exit if it's the AI chat
    }

    // --- Core Fix for Non-AI Chats ---
    // Instead of directly displaying, rely on the loadMessages listener
    // to pick up the change from Firestore.
    const message = {
        text,
        senderId: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    firestore.collection('chats').doc(currentChatId).collection('messages').add(message)
        .then(() => {
            console.log("Message sent successfully to Firestore.");
            // No need to call displayMessage here for non-AI chats
            // The onSnapshot listener in loadMessages will handle displaying it

            // You might want to re-run the scroll-to-bottom here as well,
            // in case the Firestore update causes a slight delay or reflow.
            // chatMessages.scrollTop = chatMessages.scrollHeight; // Optional: re-scroll after successful Firebase add
        })
        .catch(error => {
            console.error("Error sending message to Firestore:", error);
            // Optionally, display an error to the user
        });

    // Update the parent chat document with the last message
    firestore.collection('chats').doc(currentChatId).update({
        lastMessage: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        console.log("Chat last message updated successfully.");
    }).catch(error => {
        console.error("Error updating chat's last message:", error);
    });
}

// Authentication
auth.onAuthStateChanged(async user => {
    if (user) {
        currentUser = user;
        console.log("User is signed in:", currentUser.email);

        const urlParams = new URLSearchParams(window.location.search);
        const targetUid = urlParams.get('chatWith');

        // Check if a specific chat partner was requested and it's not the current user
        if (targetUid && targetUid !== currentUser.uid) {
            console.log("Initiating direct chat with user:", targetUid);

            try {
                const targetUserDoc = await firestore.collection("users").doc(targetUid).get();

                // Remove any 'active' styling from other chat items in the sidebar
                document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));

                // Find or create the chat between the current user and the target user
                const chatResult = await findOrCreateChat(currentUser.uid, targetUid);
                currentChatId = chatResult.chatId; // Set the global currentChatId to the new/found chat

                // Load chats into the sidebar first, so the new chat item can be active
                // This is crucial for Problem 1.
                loadChats(); // This will trigger the onSnapshot and update the sidebar

                // Now load messages for this specific chat
                loadMessages(currentChatId);

                // Update chat header UI *after* the chat is confirmed/created
                if (targetUserDoc.exists) {
                    const targetUserData = targetUserDoc.data();
                    chatPartnerName.textContent = targetUserData.name || "Unknown User";
                    chatPartnerPic.src = targetUserData.profilePic || "images/icons/default_avatar.jpg";
                    chatPartnerPic.alt = targetUserData.name || "Chat Partner";
                } else {
                    console.warn("Target user profile not found for UID:", targetUid);
                    chatPartnerName.textContent = "User Not Found";
                    chatPartnerPic.src = "images/icons/default_avatar.jpg"; // Default fallback
                }

                // Clean up the URL parameter. This prevents the direct chat from re-initiating
                // if the user refreshes the page while on chat.html.
                window.history.replaceState({}, document.title, window.location.pathname);

            } catch (error) {
                console.error("Error setting up direct chat:", error);
                chatMessages.innerHTML = `<p class="error-message">Error loading chat: ${error.message}. Please try again later.</p>`;
                loadChats(); // Fallback: load existing chats even if direct chat fails
            }
        } else {
            // This is the original path: if no 'chatWith' parameter, or if the user clicks on AI chat,
            // then load all existing chats (or the default AI chat if no real chats yet).
            console.log("No specific chat target, loading all existing chats.");
            loadChats(); // Load all existing chats in the sidebar
            loadMessages(currentChatId); // Load the default 'ai-chat' or previously selected chat
        }

    } else {
        console.log("No user is signed in, redirecting to login.html");
        window.location.href = 'login.html';
    }
});

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    } else {
        setTypingStatus(true);
    }
});

logoutBtn.addEventListener('click', () => {
    // The global logout function from firebase.js will handle redirection
    if(window.logout) {
        window.logout();
    } else {
        auth.signOut();
    }
});

// Emoji picker
const emojis = [
    '😀', '😂', '🥲', '🤔', '😢', '😡', '👍', '👎', '❤️', '💔', '😊', '😎', '🥳', '🎉', '👋', '🙏',
    // ... and thousands more!
    // Just a small sample of other common categories:
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', // Animals
    '🍎', '🍊', '🍓', '🍇', '🍉', '🍕', '🍔', '🍟', '🌮', '🍣', // Food
    '⚽', '🏀', '🏈', '⚾', '🎾', '🎳', '🎯', '🎮', '🎲', '🎭', // Activities
    '🚗', '🚕', '🚌', '🚆', '✈️', '🚢', '🚀', '🏡', '🏢', '🌉', // Travel & Places
    '⏰', '💡', '📱', '💻', '📷', '📹', '📚', '💰', '💎', '🔑', // Objects
    '💯', '✅', '❌', '❓', '❗', '♻️', '✨', '⭐', '🎵', '🎶', // Symbols
    '🇦🇷', '🇧🇷', '🇨🇳', '🇩🇪', '🇪🇸', '🇫🇷', '🇬🇧', '🇮🇳', '🇯🇵', '🇳🇬'  // Flags (many, many more)
];
emojis.forEach(emoji => {
    const emojiElement = document.createElement('span');
    emojiElement.textContent = emoji;
    emojiElement.style.cursor = 'pointer';
    emojiElement.style.padding = '5px';
    emojiElement.style.fontSize = '20px';
    emojiElement.addEventListener('click', () => {
        messageInput.value += emoji;
        // After selecting an emoji, hide the picker
        emojiPicker.classList.remove('open'); // Use classList.remove
    });
    emojiPicker.appendChild(emojiElement);
});

// --- Function to position the emoji picker ---
function positionEmojiPicker() {
    emojiPicker.style.position = 'fixed'; // It is now fixed relative to the viewport
    emojiPicker.style.top = 'auto';
    emojiPicker.style.right = 'auto';
    emojiPicker.style.transform = 'none'; // Reset transform initially

    // Get the bounding rectangle of the chat input area
    const chatInputAreaRect = chatInputArea.getBoundingClientRect(); // Still needed for bottom anchor

    if (window.innerWidth <= 768) {
        // --- Mobile Positioning ---
        const gapAboveInputArea = 10;
        const calculatedBottom = window.innerHeight - chatInputAreaRect.top + gapAboveInputArea;

        emojiPicker.style.bottom = `${calculatedBottom}px`;
        emojiPicker.style.left = '50%';
        emojiPicker.style.transform = 'translateX(-50%)';
        emojiPicker.style.width = '90%';
        emojiPicker.style.maxWidth = '300px';

        // Simplified max-height for mobile:
        // Max height is the space from its calculated bottom up to a safe margin from the top
        const dynamicMaxHeight = window.innerHeight - calculatedBottom - 20; // 20px for top safety margin
        emojiPicker.style.maxHeight = `${dynamicMaxHeight}px`;

    } else {
        // --- Desktop Positioning ---
        const btnRect = emojiBtn.getBoundingClientRect();
        const pickerRect = emojiPicker.getBoundingClientRect();

        const gapFromBtnToPickerBottom = 10;
        const calculatedBottom = window.innerHeight - btnRect.top + gapFromBtnToPickerBottom;
        emojiPicker.style.bottom = `${calculatedBottom}px`;

        let leftPosition = btnRect.left;
        if (leftPosition + pickerRect.width > window.innerWidth - 10) {
            leftPosition = window.innerWidth - pickerRect.width - 10;
        }
        if (leftPosition < 10) {
            leftPosition = 10;
        }
        emojiPicker.style.left = `${leftPosition}px`;

        emojiPicker.style.width = '320px';
        emojiPicker.style.maxWidth = 'none';
        emojiPicker.style.maxHeight = '250px';
    }
}


emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent clicks on body from immediately closing it

    emojiPicker.classList.toggle('open');

    if (emojiPicker.classList.contains('open')) {
        positionEmojiPicker();
    }
});

document.addEventListener('click', (e) => {
    // Check if the click was outside both the emoji button and the picker itself
    // and also ensures click on a specific emoji within the picker doesn't re-trigger.
    if (!emojiBtn.contains(e.target) && !emojiPicker.contains(e.target)) {
        emojiPicker.classList.remove('open');
    }
});

// --- Optional: Re-position on window resize to keep it aligned ---
window.addEventListener('resize', () => {
    // If emoji picker is open, re-position it (your existing logic)
    if (typeof emojiPicker !== 'undefined' && emojiPicker.classList.contains('open')) {
        positionEmojiPicker();
    }

    // CRITICAL: Re-scroll the chat messages to the bottom whenever the viewport size changes.
    // This helps adjust for keyboard appearance/disappearance and general layout shifts on mobile.
    if (typeof chatMessages !== 'undefined' && chatMessages) { // Added typeof check for robustness
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});

// Sidebar toggle for mobile
menuToggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
});

sidebarToggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
});

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    // Click listener for AI chat
    const aiChatItem = document.querySelector('.ai-chat-item');
    if (aiChatItem) {
        aiChatItem.addEventListener('click', () => {
            currentChatId = 'ai-chat';
            loadMessages('ai-chat');
            document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
            aiChatItem.classList.add('active');
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }
        });
    }

    // Initial message load for AI
    loadMessages(currentChatId);
    listenForTyping(currentChatId); // Start listening on the default chat
});
