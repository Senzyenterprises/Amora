# 💘 Amora – A Global Dating & Compatibility Platform

Amora is a modern matchmaking and dating web platform that connects users across the globe through a compatibility-based quiz. Users register, complete a quiz to find ideal matches, and connect via chat — all within a smooth and elegant experience.

## 🌐 Live Site
[Visit Amora](https://your-deployed-link-here.com)

---

## 📌 Features

- 🔐 **Firebase Authentication** (Email/Password)
- 📝 **User Registration & Login**
- 💖 **Compatibility Quiz**
- 🧠 **Match Discovery System**
- 📬 **Password Reset (with Countdown + Expiry)**
- 👤 **User Profiles (Edit + View)**
- 💬 **Private Messaging with Safety Reminder**
- 📦 **Firestore Database Integration**
- 📱 **Responsive UI/UX with Smooth Transitions**
- 🌍 **Global Access — Anyone Can Join**

---

## 🛠 Tech Stack

- **HTML5** / **CSS3** / **JavaScript (ES6+)**
- **Firebase v8 (Auth + Firestore)**
- **Firestore Database**
- **LocalStorage** for user session handling
- **Modular file structure** (`auth.js`, `match.js`, etc.)
- **Responsive layout** using media queries and mobile-first design

---

## 🧪 Compatibility Quiz Flow

1. After signing up or logging in, users must take a quiz via `match.html`.
2. Answers are saved to Firestore under `quizAnswers/{user.uid}`.
3. Quiz includes preferences like gender, age range, goal, personality trait, and first date idea.
4. Based on this data, `discover.html` shows ideal matches.
5. If no match is found, the app gently tells users: "We'll notify you when a match is found."

---

## 🔄 Password Reset Flow

- Click **Forgot Password?**
- Enter your email
- If valid:
  - Green message: "Reset link sent"
  - 1-hour countdown starts
- If invalid or email is unregistered:
  - Red error messages show specifically what went wrong
- After resetting via email, users are redirected to login with a success message

---

## 📁 File Structure

Amora/
│
├── index.html
├── login.html
├── signup.html
├── match.html
├── discover.html
├── profile.html
├── chat.html
│
├── css/
│ ├── style.css
│ ├── match.css
│ └── auth.css
│
├── js/
│ ├── auth.js
│ ├── match.js
│ └── firebase.js
│
├── images/
│ └── logo/
│ └── Amora_logo.png
│
└── firebase/
└── firebase.js


---

## 📌 What I Learned

- 🔥 Working deeply with **Firebase Authentication** and **Firestore**
- 🧠 Structuring user logic and redirect flows based on login state
- 👁 Handling conditional routing (e.g., redirect to quiz if not completed)
- 💬 Implementing real-time interaction structure for chats
- ⚠️ Building **secure password reset** systems with validation and expiration logic

---

## 💡 What I’d Do Differently

- Move to **Firebase Modular v9+** for performance and better tree-shaking
- Integrate **chat message encryption**
- Add **push notifications** for new matches or messages
- Implement user blocking/reporting and moderation tools

---

## 🔗 Useful Links

- [Firebase Documentation](https://firebase.google.com/docs)
- [Font: Poppins](https://fonts.google.com/specimen/Poppins)

---

## 🙌 Final Words

Amora is more than just a dating platform — it's a passion project designed to show what's possible with vanilla HTML, CSS, and JavaScript plus Firebase. Every interaction is built to feel personal and safe.

Thanks for checking it out 💘

---

