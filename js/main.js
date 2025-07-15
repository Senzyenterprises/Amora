// Scroll reveal navbar effect
let prevScrollPos = window.pageYOffset;
const navbar = document.querySelector('.navbar');

window.onscroll = () => {
  const currentScroll = window.pageYOffset;
  if (prevScrollPos > currentScroll) {
    navbar.style.top = "0";
  } else {
    navbar.style.top = "-80px";
  }
  prevScrollPos = currentScroll;
};

document.getElementById("quizForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const formData = new FormData(this);
  const quizAnswers = {};

  for (let [key, value] of formData.entries()) {
    quizAnswers[key] = value;
  }

  // Save to localStorage for now
  localStorage.setItem("amora_quiz_answers", JSON.stringify(quizAnswers));

  // Redirect to discover page
  window.location.href = "discover.html";
});
