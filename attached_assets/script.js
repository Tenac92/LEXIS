import { showLoading, hideLoading } from './components/LoadingSpinner.js';
import { ErrorHandler } from './utils/errorHandler.js';
import { isValidEmail, isValidPassword } from './utils/validation.js';
import { StateManager } from './utils/StateManager.js';
import { initAuth } from './utils/auth.js';
import { TokenManager } from './utils/tokenManager.js';

document.addEventListener("DOMContentLoaded", async () => {
  initAuth();
  const loginForm = document.getElementById("loginForm");
  const loginMessage = document.getElementById("loginMessage");
  const stateManager = new StateManager({ 
    initialState: {
      isLoading: false,
      isAuthenticated: false
    }
  });

  stateManager.subscribe((state) => {
    const spinner = document.getElementById("loadingSpinner");
    if (spinner) {
      spinner.classList.toggle("hidden", !state.isLoading);
    }
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {
      if (!isValidEmail(email)) {
        ErrorHandler.showError("Please enter a valid email address");
        return;
      }
      if (!isValidPassword(password)) {
        ErrorHandler.showError("Password must be at least 6 characters long");
        return;
      }

      loginMessage.textContent = "Logging in...";
      loginMessage.className = "mt-4 text-center text-sm text-blue-600";

      // Display the loading spinner
      showLoading(document.body);

      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(),
          password: password
        }),
        credentials: 'include'
      });

      const data = await response.json();

      // Hide the loading spinner
      hideLoading();

      if (!response.ok) {
        console.error('Login failed:', data);
        throw new Error(data.message || "Login failed");
      }

      if (!data.token || !data.user) {
        throw new Error("Invalid server response: missing token or user data");
      }

      const tokenManager = TokenManager.getInstance();
      await tokenManager.clearToken(); // Clear any existing tokens first

      // Store token first
      tokenManager.setToken(data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Then validate and schedule refresh
      try {
        const payload = tokenManager.parseToken(data.token);
        if (!payload) {
          throw new Error("Could not parse token");
        }

        // Default to 1 hour expiration if not present
        const expiration = payload.exp || Math.floor(Date.now() / 1000) + 3600;
        tokenManager.scheduleTokenRefresh(expiration);
      } catch (error) {
        console.error("Token validation error:", error);
        tokenManager.clearToken();
        localStorage.removeItem("user");
        throw new Error("Invalid authentication token");
      }
      window.location.href = "/dashboard/index.html";
    } catch (error) {
      console.error("Login error:", error);
      loginMessage.textContent = error.message || "Authentication failed";
      loginMessage.className = "mt-4 text-center text-sm text-red-600";
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
    }
  });
});