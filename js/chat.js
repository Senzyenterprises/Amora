
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

function displayMessage(message, messageId = null) { // Added messageId parameter
    const messageElement = document.createElement("div");
    messageElement.classList.add("message");

    if (messageId) {
        messageElement.dataset.messageId = messageId; // CRITICAL: Add this for updates/removals
    }

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
        console.warn("Message has invalid timestamp, using current time:", message);
    }

    // 1. Create the timestamp element
    const timestampSpan = document.createElement('span');
    timestampSpan.classList.add('timestamp');
    timestampSpan.textContent = timestampDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 2. Create the message bubble element
    const bubbleDiv = document.createElement('div');
    bubbleDiv.classList.add('bubble');

    // 3. Create the message text element
    const messageTextSpan = document.createElement('span');
    messageTextSpan.classList.add('message-text');
    messageTextSpan.textContent = message.text;
    bubbleDiv.appendChild(messageTextSpan);

    // 4. Append elements to messageElement in the correct order for flexbox
    if (isMyMessage) { // This is a 'sent' message
        messageElement.appendChild(bubbleDiv);
        messageElement.appendChild(timestampSpan);
    } else { // This is a 'received' message
        messageElement.appendChild(timestampSpan);
        messageElement.appendChild(bubbleDiv);
    }

    chatMessages.appendChild(messageElement);
    // Auto-scroll to the bottom of the chat (This will be done by loadMessages now, for efficiency)
    // chatMessages.scrollTop = chatMessages.scrollHeight; // REMOVE this line from displayMessage
}

function setTypingStatus(isTyping) {
    if (currentChatId === 'ai-chat' || !currentUser) return;

    // 👇👇👇 ADD THIS CHECK 👇👇👇
    if (!currentChatId) {
        console.warn("Cannot set typing status: currentChatId is null or undefined.");
        return;
    }
    // 👆👆👆 ADD THIS CHECK 👆👆👆

    const typingUpdate = {};
    typingUpdate[`typing.${currentUser.uid}`] = isTyping;

    firestore.collection('chats').doc(currentChatId).update(typingUpdate)
        .catch(error => {
            console.error("Error updating typing status:", error);
        });

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
    // CRITICAL: Ensure chatId is valid at the very beginning
    if (!chatId) {
        console.error("loadMessages called with invalid chatId:", chatId);
        chatMessages.innerHTML = '<div style="text-align:center; padding: 20px; color: #888;">Cannot load messages: Invalid chat ID.</div>';
        chatPartnerName.textContent = "Error";
        chatPartnerPic.src = 'images/icons/default_avatar.jpg';
        if (messagesUnsubscribe) messagesUnsubscribe(); // Unsubscribe if there was an old listener
        currentChatId = null; // Ensure global state is consistent
        return;
    }

    // 1. Unsubscribe from previous chat's messages to avoid memory leaks
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
        console.log("Unsubscribed from previous messages listener.");
    }

    currentChatId = chatId; // Ensure currentChatId is updated globally

    // 2. Set a loading indicator immediately when a chat is selected
    chatMessages.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">Loading messages...</div>';

    // 3. Handle AI chat separately
    if (chatId === 'ai-chat') {
        chatPartnerName.textContent = "Amora AI";
        chatPartnerPic.src = "images/icons/ai_avatar.jpg";
        chatMessages.innerHTML = ''; // Clear loading, then add AI specific content
        const aiMessage = {
            text: "Hello! I'm Amora, your friendly AI assistant. How can I help you?",
            senderId: 'ai',
            timestamp: { seconds: Date.now() / 1000, nanoseconds: 0 }
        };
        displayMessage(aiMessage); // Call your displayMessage function
        chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to bottom for AI
        return; // No Firestore listener for AI chat
    }

    // 4. Set up the Firestore listener for the current chat's messages
    let lastDateForSeparator = null; // Used for initial full render to manage date separators
    messagesUnsubscribe = firestore.collection('chats').doc(chatId).collection('messages')
        .orderBy('timestamp', 'asc') // CRITICAL: Order messages by timestamp
        .onSnapshot(snapshot => {
            // Check if this is the very first time messages are loaded for this chat, or if a full refresh is needed
            // A simple check is if chatMessages is currently showing the "Loading messages..." text.
            let isFirstLoadOfChat = chatMessages.innerHTML.includes('Loading messages...');
            // Also, if the snapshot contains only 'added' changes and all existing elements are gone,
            // it's safer to re-render everything.

            if (isFirstLoadOfChat || snapshot.docChanges().some(change => change.type === 'removed' || change.type === 'modified')) {
                // If it's the initial load OR if there are removals/modifications (requiring a full rebuild for simplicity)
                chatMessages.innerHTML = ''; // Clear ALL messages and separators
                lastDateForSeparator = null; // Reset for new full render

                snapshot.docs.forEach(doc => {
                    const message = doc.data();
                    const messageId = doc.id;
                    if (!message.timestamp) { console.warn("Message missing timestamp:", message); return; }

                    const timestampDate = message.timestamp.toDate ? message.timestamp.toDate() : new Date(message.timestamp.seconds * 1000);
                    const messageDate = timestampDate.toLocaleDateString();

                    if (messageDate !== lastDateForSeparator) {
                        const dateElement = document.createElement('div');
                        dateElement.className = 'message-date';
                        dateElement.textContent = timestampDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                        dateElement.dataset.messageDate = messageDate; // Store for comparison later
                        chatMessages.appendChild(dateElement);
                        lastDateForSeparator = messageDate;
                    }
                    displayMessage(message, messageId); // Pass messageId
                });
            } else {
                // For subsequent updates where only new messages are added, append them
                snapshot.docChanges().forEach(change => {
                    if (change.type === "added") {
                        const message = change.doc.data();
                        const messageId = change.doc.id;
                        if (!message.timestamp) { console.warn("Message missing timestamp:", message); return; }

                        // Check for date separator for new messages
                        const timestampDate = message.timestamp.toDate ? message.timestamp.toDate() : new Date(message.timestamp.seconds * 1000);
                        const messageDate = timestampDate.toLocaleDateString();

                        // Find the last message's date to decide if a new date separator is needed
                        const lastMessageElement = chatMessages.querySelector('.message:last-of-type');
                        const lastDisplayedMessageDate = lastMessageElement ? (lastMessageElement.previousElementSibling?.dataset?.messageDate || lastMessageElement.dataset?.messageDate) : null;
                        // This logic can be tricky; simpler to just check if `lastDateForSeparator` needs update
                        // or if the new message's date is different from the last displayed message's date.
                        // For robust date separators with incremental updates, you might need a more complex
                        // DOM insertion logic (e.g., insertBefore based on timestamp).
                        // For now, let's use a simpler heuristic for appended messages:
                        if (messageDate !== lastDateForSeparator && messageDate !== lastDisplayedMessageDate) {
                            const dateElement = document.createElement('div');
                            dateElement.className = 'message-date';
                            dateElement.textContent = timestampDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                            dateElement.dataset.messageDate = messageDate;
                            chatMessages.appendChild(dateElement);
                            lastDateForSeparator = messageDate; // Update last date seen
                        }

                        displayMessage(message, messageId); // Append the new message
                    }
                    // For modified/removed, the full refresh handles it, or you'd add specific logic here:
                    // else if (change.type === "modified") { ... update existing message by messageId ... }
                    // else if (change.type === "removed") { ... remove message by messageId ... }
                });
            }

            // 5. Scroll to the bottom after messages are loaded/added
            chatMessages.scrollTop = chatMessages.scrollHeight;

        }, error => {
            console.error("Error loading messages:", error);
            chatMessages.innerHTML = `<p class="error-message">Could not load messages. ${error.message}</p>`;
        });

    // Update header for this specific chat (always fetch to ensure it's correct)
    firestore.collection('chats').doc(chatId).get().then(chatDoc => {
        if (chatDoc.exists) {
            const chatData = chatDoc.data();
            if (chatData && chatData.participants) {
                const otherUserId = chatData.participants.find(id => id !== currentUser.uid);
                if (otherUserId) { // Ensure otherUserId is valid
                    firestore.collection('users').doc(otherUserId).get().then(userDoc => {
                        if (userDoc.exists) {
                            const user = userDoc.data();
                            chatPartnerName.textContent = user.name || "Unknown User";
                            chatPartnerPic.src = user.profilePic || 'images/icons/default_avatar.jpg';
                            chatPartnerPic.alt = user.name || "Chat Partner";
                        } else {
                            console.warn("User document not found for otherUserId:", otherUserId);
                            chatPartnerName.textContent = "User Not Found";
                            chatPartnerPic.src = 'images/icons/default_avatar.jpg';
                        }
                    }).catch(error => console.error("Error fetching chat partner user data for header in loadMessages:", error));
                } else {
                    console.warn("Could not determine otherUserId for chat:", chatId, chatData);
                    chatPartnerName.textContent = "Chat Partner Missing";
                    chatPartnerPic.src = 'images/icons/default_avatar.jpg';
                }
            } else {
                console.warn("Chat data or participants missing for chat:", chatId);
                chatPartnerName.textContent = "Invalid Chat";
                chatPartnerPic.src = 'images/icons/default_avatar.jpg';
            }
        } else {
            console.warn("Chat document not found for ID:", chatId);
            chatPartnerName.textContent = "Chat Not Found";
            chatPartnerPic.src = 'images/icons/default_avatar.jpg';
        }
    }).catch(error => console.error("Error fetching chat document for header in loadMessages:", error));
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
    firestore.collection('chats')
        .where('participants', 'array-contains', currentUser.uid)
        .orderBy('timestamp', 'desc') // Order by most recent chat activity
        .onSnapshot(snapshot => {
            // Store the ID of the chat that was active *before* the list gets rebuilt.
            const previouslySelectedChatId = currentChatId;

            // --- CRITICAL: Clear both lists completely before processing the new snapshot ---
            pendingList.innerHTML = '';
            activeChatList.innerHTML = '';

            // --- RE-ADD AMORA AI CHAT ITEM FIRST ---
            const amoraAiChatItem = document.createElement('div');
            amoraAiChatItem.className = 'chat-item ai-chat-item'; // Make sure your CSS targets these classes
            amoraAiChatItem.dataset.chatId = 'ai-chat';
            amoraAiChatItem.innerHTML = `
                <img src="images/icons/ai_avatar.jpg" alt="Amora AI" class="profile-pic">
                <div class="chat-info">
                    <span class="chat-name">Amora AI</span>
                    <span class="last-message">Your smart companion</span>
                </div>
            `;
            // Attach the click handler for the AI chat item
            amoraAiChatItem.addEventListener('click', () => {
                document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
                amoraAiChatItem.classList.add('active');
                currentChatId = 'ai-chat'; // Update global state
                loadMessages('ai-chat');
            });
            activeChatList.appendChild(amoraAiChatItem);

            // --- Iterate through ALL Firestore docs in the snapshot for other chats ---
            snapshot.docs.forEach(doc => {
                const chat = doc.data();
                const chatId = doc.id;

                if (!chat.participants) {
                    console.warn("Chat document missing participants array:", chatId);
                    return;
                }

                if (chat.status === 'pending') {
                    displayPendingChat(chat, chatId);
                } else if (chat.status === 'active') {
                    displayActiveChat(chat, chatId);
                }
            });

            // After all chat items have been (re)appended to the lists:
            // 1. Clear active state from all other chat items
            document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));

 // 2. Re-apply the active class to the chat that was previously selected (if it still exists)
            //    and ensure its messages are loaded in the main chat area.
            if (previouslySelectedChatId) {
                if (previouslySelectedChatId === 'ai-chat') {
                    amoraAiChatItem.classList.add('active'); // Re-activate the Amora AI chat item
                    loadMessages('ai-chat'); // Explicitly load AI chat messages
                } else {
                    const currentActiveItem = activeChatList.querySelector(`[data-chat-id="${previouslySelectedChatId}"]`);
                    if (currentActiveItem) {
                        currentActiveItem.classList.add('active'); // Set active class
                        // 👇👇👇 THIS IS THE FIX 👇👇👇
                        loadMessages(previouslySelectedChatId); // Should be previouslySelectedChatId, not previouslySelectedId

                        // Header update logic for the re-selected chat
                        const chatDataForHeader = snapshot.docs.find(doc => doc.id === previouslySelectedChatId)?.data(); // Also fix here
                        if (chatDataForHeader && chatDataForHeader.participants) {
                            const otherUserId = chatDataForHeader.participants.find(id => id !== currentUser.uid);
                            if (otherUserId) {
                                firestore.collection('users').doc(otherUserId).get().then(userDoc => {
                                    if (userDoc.exists) {
                                        const user = userDoc.data();
                                        chatPartnerName.textContent = user.name || "Unknown User";
                                        chatPartnerPic.src = user.profilePic || 'images/icons/default_avatar.jpg';
                                        chatPartnerPic.alt = user.name || "Chat Partner";
                                    } else {
                                        console.warn("User document not found for otherUserId in loadChats header update:", otherUserId);
                                        chatPartnerName.textContent = "User Not Found";
                                        chatPartnerPic.src = 'images/icons/default_avatar.jpg';
                                    }
                                }).catch(error => {
                                    console.error("Error fetching user data for header in loadChats:", error);
                                });
                            } else {
                                console.warn("Could not determine otherUserId for chat in loadChats header update:", previouslySelectedChatId, chatDataForHeader); // And here
                                chatPartnerName.textContent = "Chat Partner Missing";
                                chatPartnerPic.src = 'images/icons/default_avatar.jpg';
                            }
                        } else {
                            console.warn("Chat data or participants missing for chat in loadChats header update:", previouslySelectedChatId); // And here
                            chatPartnerName.textContent = "Invalid Chat";
                            chatPartnerPic.src = 'images/icons/default_avatar.jpg';
                        }
                    } else {
                        // If the previously selected chat no longer exists (e.g., deleted or status changed)
                        chatMessages.innerHTML = '<div style="text-align:center; padding: 20px; color: #888;">Chat not found or ended. Please select another chat.</div>';
                        chatPartnerName.textContent = "Select Chat";
                        chatPartnerPic.src = 'images/icons/default_avatar.jpg';
                        currentChatId = null; // Clear the global currentChatId
                        if (messagesUnsubscribe) {
                            messagesUnsubscribe(); // Unsubscribe from the old chat's messages
                        }
                    }
                }
            } else {
                // This block runs on initial page load if no chat is pre-selected.
                // It should default to selecting Amora AI.
                amoraAiChatItem.classList.add('active');
                currentChatId = 'ai-chat';
                loadMessages('ai-chat');
                console.log("No previous chat selected, defaulted to Amora AI.");
            }

        }, error => {
            console.error("Error loading chat list:", error);
            // Optionally display a user-friendly error message
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

document.addEventListener('click', (event) => {
    // Check if the click was on a chat item in the sidebar
    const chatItem = event.target.closest('.chat-item');

    if (chatItem) {
        const chatId = chatItem.dataset.chatId;
        if (chatId) {
            // Remove 'active' class from all other chat items
            document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
            // Add 'active' class to the clicked item
            chatItem.classList.add('active');

            currentChatId = chatId; // Update the global variable
            loadMessages(chatId);   // Load the messages for the selected chat
        }
    }

    // Your existing emoji picker close logic:
    // Make sure 'emojiBtn' and 'emojiPicker' are globally accessible
    if (emojiBtn && emojiPicker) { // Add null checks for safety
        if (!emojiBtn.contains(event.target) && !emojiPicker.contains(event.target)) {
            emojiPicker.classList.remove('open');
        }
    }
});

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
