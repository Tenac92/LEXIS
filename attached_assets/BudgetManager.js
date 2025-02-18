import { API } from "../../utils/api.js";
import { getAuthToken } from "../../utils/auth.js";
import { ErrorHandler } from "../../utils/errorHandler.js";

export class BudgetManager {
  constructor(modal) {
    this.modal = modal;
    this.validateCache = new Map();
    this.initialized = false;
  }

  initialize(modal) {
    if (modal) {
      this.modal = modal;
      this.initialized = true;
      return true;
    }
    return false;
  }

  async loadBudgetData(mis) {
    try {
      const token = await getAuthToken();
      if (!mis?.toString().trim()) {
        throw new Error("Invalid project selection");
      }

      const response = await fetch(`/api/budget/${mis}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const budgetData = await response.json();
      if (budgetData.status === "error") {
        throw new Error(budgetData.message);
      }

      return {
        budgetAmount: parseFloat(budgetData.user_view) || 0,
        ethsiaPistosi: parseFloat(budgetData.ethsia_pistosi) || 0,
        budgetData
      };
    } catch (error) {
      console.error("Error loading budget data:", error);
      ErrorHandler.showError("Failed to load budget data");
      return null;
    }
  }

  async validateBudgetAmount(amount, mis) {
    try {
      // Validate inputs
      if (!mis?.toString().trim()) {
        throw new Error("Invalid budget code");
      }

      const parsedAmount = parseFloat(amount);
      if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Amount must be a positive number");
      }

      // Check cache
      const cacheKey = `${mis}-${parsedAmount}`;
      if (this.validateCache.has(cacheKey)) {
        return this.validateCache.get(cacheKey);
      }

      // Update UI
      if (!this.modal) {
        throw new Error("Modal not initialized");
      }

      const container = this.modal?.querySelector(".budget-indicators");
      if (container) {
        container.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Validating budget...</div>';
      }

      // Validate budget
      const response = await fetch(`/api/budget/${mis}/validate-amount`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify({ amount: parsedAmount }),
      });

      if (!response.ok) {
        throw new Error("Budget validation failed");
      }

      const data = await response.json();
      const currentBudget = parseFloat(data.currentBudget) || 0;

      // Send admin notification if amount exceeds budget
      if (parsedAmount > currentBudget) {
        try {
          const notificationData = {
            type: 'reallocation',
            mis,
            amount: parsedAmount,
            current_budget: currentBudget,
            ethsia_pistosi: data.ethsiaPistosi || 0,
            timestamp: new Date().toISOString()
          };

          console.log('Sending admin notification:', notificationData);
          
          const notifyResponse = await fetch('/api/budget/notify-admin', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${await getAuthToken()}`,
            },
            body: JSON.stringify(notificationData)
          });

          if (!notifyResponse.ok) {
            console.error('Admin notification failed:', await notifyResponse.text());
          }
        } catch (notifyError) {
          console.error('Admin notification error:', notifyError);
          // Continue execution even if notification fails
        }
      }

      // Cache and return result
      const result = {
        isValid: data.isValid,
        message: data.message,
        currentBudget,
        requiresNotification: parsedAmount > currentBudget
      };

      this.validateCache.set(cacheKey, result);
      return result;

    } catch (error) {
      console.error("Budget validation error:", error);
      ErrorHandler.showError(error.message);
      return {
        isValid: false,
        message: error.message,
        requiresNotification: false
      };
    }
  }

  updateBudgetIndicators(amount, budgetData) {
    if (!this.modal) {
      return;
    }

    let container = this.modal.querySelector(".budget-indicators");
    if (!container) {
      container = document.createElement('div');
      container.className = 'budget-indicators';
      const contentArea = this.modal.querySelector('.modal-content');
      if (contentArea) {
        contentArea.insertBefore(container, contentArea.firstChild);
      } else {
        return;
      }
    }

    // Get current trimester (1-4)
    const currentDate = new Date();
    const currentTrimester = Math.floor(currentDate.getMonth() / 3) + 1;
    const trimesterField = `q${currentTrimester}`;
    const trimesterBudget = parseFloat(budgetData[trimesterField]) || 0;

    // Calculate percentages and values
    const userView = parseFloat(budgetData?.user_view) || 0;
    const ethsiaPistosi = parseFloat(budgetData?.ethsia_pistosi) || 0;
    const percentageUsed = (amount / userView) * 100;
    const ethsiaPercentage = ethsiaPistosi > 0 ? (amount / ethsiaPistosi) * 100 : 0;
    const trimesterPercentage = trimesterBudget > 0 ? (amount / trimesterBudget) * 100 : 0;

    container.innerHTML = `
      <div class="budget-indicator-item">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-blue-100/50 flex items-center justify-center">
              <i class="fas fa-wallet text-blue-600"></i>
            </div>
            <span class="text-sm font-medium text-gray-600">Διαθέσιμο Υπόλοιπο</span>
          </div>
          <div class="text-lg font-bold text-blue-600">€${userView.toLocaleString()}</div>
        </div>
        <div class="space-y-2">
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">Χρήση</span>
            <span class="font-medium ${percentageUsed > 80 ? 'text-red-600' : 'text-gray-700'}">${percentageUsed.toFixed(1)}%</span>
          </div>
          <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div class="h-full ${percentageUsed > 80 ? 'bg-red-500' : 'bg-blue-500'} rounded-full transition-all duration-500" 
                 style="width: ${Math.min(percentageUsed, 100)}%"></div>
          </div>
        </div>
      </div>
      </div>
    `;
  }
}