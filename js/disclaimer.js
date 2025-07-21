// Reusable Demo Site Disclaimer Modal Logic
// This script dynamically loads the disclaimer.html and handles its display.

document.addEventListener('DOMContentLoaded', () => {
    // Determine the path to disclaimer.html relative to the current HTML file.
    // Assuming disclaimer.html is in 'assets/' and this script is in 'assets/js/'
    const modalHtmlPath = '../disclaimer.html'; 

    // Function to load HTML content dynamically
    async function loadDisclaimerModal() {
        try {
            const response = await fetch(modalHtmlPath);
            if (!response.ok) {
                console.error(`Failed to load disclaimer.html: HTTP status ${response.status}`);
                return; // Exit if fetch fails
            }
            const html = await response.text();
            document.body.insertAdjacentHTML('beforeend', html); // Insert at the end of body

            // Get elements after they are loaded into the DOM
            const disclaimerModalOverlay = document.getElementById('globalDemoDisclaimerModalOverlay');
            const acceptDisclaimerBtn = document.getElementById('acceptGlobalDemoDisclaimerBtn');

            if (disclaimerModalOverlay && acceptDisclaimerBtn) {
                // Check if the user has already accepted the disclaimer in this session
                // Using a unique session storage key for 'senzyenterprises' domain
                const hasAcceptedDisclaimer = sessionStorage.getItem('senzy_demo_disclaimer_accepted');

                if (!hasAcceptedDisclaimer) {
                    // Show the modal if not accepted
                    // Use a small timeout to ensure the DOM has rendered and CSS transitions apply smoothly
                    setTimeout(() => {
                        disclaimerModalOverlay.classList.add('active');
                        document.body.style.overflow = 'hidden'; // Prevent scrolling
                    }, 100);
                } else {
                    // If already accepted, ensure it's hidden and removed from flow
                    disclaimerModalOverlay.style.display = 'none';
                    // Optionally, remove the element from DOM to clean up memory
                    disclaimerModalOverlay.remove(); 
                }

                // Add event listener to the accept button
                acceptDisclaimerBtn.addEventListener('click', () => {
                    sessionStorage.setItem('senzy_demo_disclaimer_accepted', 'true'); // Mark as accepted
                    disclaimerModalOverlay.classList.remove('active');
                    document.body.style.overflow = ''; // Re-enable scrolling
                    // Give time for CSS transition to complete before removing from DOM
                    setTimeout(() => {
                        disclaimerModalOverlay.style.display = 'none';
                        disclaimerModalOverlay.remove(); // Remove from DOM
                    }, 300); 
                });
            } else {
                console.error("Disclaimer modal elements not found after loading HTML.");
            }

        } catch (error) {
            console.error("Error loading or processing disclaimer modal:", error);
        }
    }

    loadDisclaimerModal(); // Call the function to load the modal when DOM is ready
});
