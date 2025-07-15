document.addEventListener('DOMContentLoaded', async () => {
    // --- Firebase Initialization and Authentication Check ---
    if (!firebase.apps.length) {
        console.error("Firebase has not been initialized. Check firebase/firebase.js.");
        alert("Application error: Firebase not configured. Please contact support.");
        window.location.href = 'admin-login.html'; // Redirect to login
        return;
    }

    const auth = firebase.auth();
    const db = firebase.firestore();
    const userTableBody = document.getElementById('userTableBody');
    const userSearchInput = document.getElementById('userSearch');
    const refreshUsersBtn = document.getElementById('refreshUsersBtn');
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');

    // Section management elements
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const dashboardSections = document.querySelectorAll('.dashboard-section');
    const currentSectionTitle = document.getElementById('currentSectionTitle');

    // Modals
    const confirmDeleteModal = document.getElementById('confirmDeleteModal');
    const userNameToDelete = document.getElementById('userNameToDelete');
    const cancelDeleteBtn = document.getElementById('cancelDelete');
    const confirmDeleteBtn = document.getElementById('confirmDelete');

    const confirmDeactivateModal = document.getElementById('confirmDeactivateModal');
    const userNameToDeactivate = document.getElementById('userNameToDeactivate');
    const actionTypeSpan = document.getElementById('actionType'); // To show "deactivate" or "activate"
    const cancelDeactivateBtn = document.getElementById('cancelDeactivate');
    const confirmDeactivateBtn = document.getElementById('confirmDeactivate');

    let allUsersData = []; // Store all user data for filtering/searching
    let userToDeleteId = null;
    let userToDeactivateId = null;
    let userToDeactivateStatus = null; // 'active' or 'inactive'

    // --- Admin Authentication Check on Load ---
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            // No user logged in, redirect to admin login
            window.location.href = 'admin-login.html';
            return;
        }

        // Check if the logged-in user has 'admin' role
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (!userDoc.exists || userDoc.data().role !== 'admin') {
                // User is logged in but not an admin, log them out and redirect
                await auth.signOut();
                alert('Access Denied: You do not have administrator privileges.');
                window.location.href = 'admin-login.html';
                return;
            }
            // If they are an admin, proceed to load data
            console.log('Admin user authenticated.');
            loadUsers(); // Load users once authenticated
        } catch (error) {
            console.error("Error checking admin role:", error);
            await auth.signOut();
            alert('Error verifying admin status. Please try again.');
            window.location.href = 'admin-login.html';
        }
    });

    // --- User Management Functions ---

    // Function to fetch and display users
    async function loadUsers() {
        userTableBody.innerHTML = '<tr><td colspan="9">Loading users...</td></tr>'; // Show loading message
        try {
            const usersSnapshot = await db.collection('users').get();
            allUsersData = []; // Reset stored data
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                userData.id = doc.id; // Add document ID (UID) for actions
                allUsersData.push(userData);
            });
            displayUsers(allUsersData); // Display all fetched users initially
        } catch (error) {
            console.error("Error fetching users:", error);
            userTableBody.innerHTML = '<tr><td colspan="9">Error loading users.</td></tr>';
            alert('Failed to load user data. Check console for details.');
        }
    }

    // Function to display users in the table (can be filtered)
    function displayUsers(usersToDisplay) {
        userTableBody.innerHTML = ''; // Clear existing rows
        if (usersToDisplay.length === 0) {
            userTableBody.innerHTML = '<tr><td colspan="9">No users found.</td></tr>';
            return;
        }

        usersToDisplay.forEach(user => {
            const row = userTableBody.insertRow();
            row.innerHTML = `
                <td>${user.name || 'N/A'}</td>
                <td>${user.email || 'N/A'}</td>
                <td>${user.gender || 'N/A'}</td>
                <td>${user.age || 'N/A'}</td>
                <td>${user.country || 'N/A'}</td>
                <td>${user.interest || 'N/A'}</td>
                <td>
                  ${user.registrationDate 
                      ? (typeof user.registrationDate.toDate === 'function' // Check if it's a Firestore Timestamp
                          ? new Date(user.registrationDate.toDate()).toLocaleDateString() 
                          : new Date(user.registrationDate).toLocaleDateString() // Fallback if it's a regular Date object or parsable string/number
                        ) 
                      : 'N/A'
                  }
              </td>
                <td><span class="user-status ${user.status === 'inactive' ? 'status-inactive' : 'status-active'}">${user.status || 'active'}</span></td>
                <td class="action-buttons">
                    <button class="view-button" data-uid="${user.id}"><i class="fas fa-eye"></i> View</button>
                    <button class="delete-button" data-uid="${user.id}" data-name="${user.fullName || user.email}"><i class="fas fa-trash-alt"></i> Delete</button>
                    <button class="${user.status === 'inactive' ? 'activate-button' : 'deactivate-button'}" 
                            data-uid="${user.id}" 
                            data-name="${user.fullName || user.email}"
                            data-status="${user.status || 'active'}">
                            <i class="fas ${user.status === 'inactive' ? 'fa-check-circle' : 'fa-ban'}"></i> 
                            ${user.status === 'inactive' ? 'Activate' : 'Deactivate'}
                    </button>
                </td>
            `;
        });

        // Attach event listeners to new buttons
        attachUserActionListeners();
    }

    // Function to attach listeners to action buttons
    function attachUserActionListeners() {
        document.querySelectorAll('.view-button').forEach(button => {
            button.onclick = (e) => viewUserProfile(e.currentTarget.dataset.uid);
        });
        document.querySelectorAll('.delete-button').forEach(button => {
            button.onclick = (e) => openDeleteModal(e.currentTarget.dataset.uid, e.currentTarget.dataset.name);
        });
        document.querySelectorAll('.deactivate-button, .activate-button').forEach(button => {
            button.onclick = (e) => openDeactivateModal(e.currentTarget.dataset.uid, e.currentTarget.dataset.name, e.currentTarget.dataset.status);
        });
    }

    // View Profile (Future Feature)
    function viewUserProfile(uid) {
        alert(`Viewing profile for user ID: ${uid}\n(Full profile view coming soon!)`);
        // Future: Redirect to a detailed user profile page or open a robust modal
    }

    // --- Delete User Functions ---
    function openDeleteModal(uid, name) {
        userToDeleteId = uid;
        userNameToDelete.textContent = name;
        confirmDeleteModal.classList.add('show');
    }

    cancelDeleteBtn.addEventListener('click', () => {
        confirmDeleteModal.classList.remove('show');
        userToDeleteId = null;
    });

    confirmDeleteBtn.addEventListener('click', async () => {
        if (!userToDeleteId) return;

        confirmDeleteModal.classList.remove('show'); // Hide modal immediately

        try {
            // Delete user's Firestore document
            await db.collection('users').doc(userToDeleteId).delete();

            // IMPORTANT NOTE: Deleting the Firestore document DOES NOT delete the user
            // from Firebase Authentication. For a complete permanent deletion of the user's
            // auth record, you MUST implement a Firebase Cloud Function that an admin triggers.
            // Client-side code cannot delete auth users directly for security reasons.
            // The Cloud Function would look something like: admin.auth().deleteUser(uid);

            alert(`User ${userNameToDelete.textContent} (ID: ${userToDeleteId}) Firestore data deleted.
            \nNOTE: For full account deletion, a Firebase Cloud Function is required.`);

            // Refresh the user list
            loadUsers();
        } catch (error) {
            console.error("Error deleting user Firestore data:", error);
            alert(`Failed to delete user ${userNameToDelete.textContent}. Please try again.\nCheck console for details.`);
        } finally {
            userToDeleteId = null;
        }
    });

    // --- Deactivate/Activate User Functions ---
    function openDeactivateModal(uid, name, currentStatus) {
        userToDeactivateId = uid;
        userToDeactivateStatus = currentStatus;
        userNameToDeactivate.textContent = name;
        actionTypeSpan.textContent = currentStatus === 'inactive' ? 'activate' : 'deactivate';
        confirmDeactivateModal.classList.add('show');
    }

    cancelDeactivateBtn.addEventListener('click', () => {
        confirmDeactivateModal.classList.remove('show');
        userToDeactivateId = null;
        userToDeactivateStatus = null;
    });

    confirmDeactivateBtn.addEventListener('click', async () => {
        if (!userToDeactivateId || !userToDeactivateStatus) return;

        confirmDeactivateModal.classList.remove('show'); // Hide modal immediately
        const newStatus = userToDeactivateStatus === 'active' ? 'inactive' : 'active';

        try {
            await db.collection('users').doc(userToDeactivateId).update({
                status: newStatus
            });
            alert(`User ${userNameToDeactivate.textContent}'s account has been ${newStatus}d.`);
            loadUsers(); // Refresh the user list to show updated status
        } catch (error) {
            console.error(`Error changing user status to ${newStatus}:`, error);
            alert(`Failed to ${newStatus} user ${userNameToDeactivate.textContent}'s account. Please try again.\nCheck console for details.`);
        } finally {
            userToDeactivateId = null;
            userToDeactivateStatus = null;
        }
    });

    // --- Search Functionality ---
    userSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredUsers = allUsersData.filter(user =>
            (user.fullName && user.fullName.toLowerCase().includes(searchTerm)) ||
            (user.email && user.email.toLowerCase().includes(searchTerm))
        );
        displayUsers(filteredUsers);
    });

    // --- Event Listeners ---
    refreshUsersBtn.addEventListener('click', loadUsers);

    adminLogoutBtn.addEventListener('click', async () => {
        try {
            await auth.signOut();
            window.location.href = 'admin-login.html'; // Redirect to admin login after logout
        } catch (error) {
            console.error("Error logging out:", error);
            alert("Logout failed. Please try again.");
        }
    });

    // --- Sidebar Navigation ---
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove 'active' from all nav items and hide all sections
            navItems.forEach(nav => nav.classList.remove('active'));
            dashboardSections.forEach(section => section.classList.remove('active'));

            // Add 'active' to clicked nav item and show corresponding section
            item.classList.add('active');
            const targetSectionId = item.dataset.section;
            const targetSection = document.getElementById(targetSectionId);
            if (targetSection) {
                targetSection.classList.add('active');
                currentSectionTitle.textContent = item.textContent.trim(); // Update header title
            }
        });
    });

    // Initial load for the first active section
    // (User Management is default active in HTML)
    // No need to call loadUsers here, as it's called after auth check
});