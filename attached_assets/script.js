import { createHeader, initializeHeader } from '../components/header.js';
import { getAuthToken } from '../utils/auth.js';
import { ErrorHandler } from '../utils/errorHandler.js';

const VALID_UNITS = [
  'ΓΔΑΕΦΚ',
  'ΔΑΕΦΚ-ΑΚ', 'ΔΑΕΦΚ-ΚΕ', 'ΔΑΕΦΚ-ΒΕ', 'ΔΑΕΦΚ-ΔΕ',
  'ΤΑΕΦΚ ΧΑΛΚΙΔΙΚΗΣ', 'ΤΑΕΦΚ ΘΕΣΣΑΛΙΑΣ',
  'ΤΑΕΦΚ-ΑΑ', 'ΤΑΕΦΚ-ΔΑ', 'ΤΑΕΦΚ ΧΑΝΙΩΝ', 'ΤΑΕΦΚ ΗΡΑΚΛΕΙΟΥ'
];

class UserManagement {
  constructor() {
    this.addUserForm = document.getElementById('addUserForm');
    this.usersTable = document.getElementById('usersTable');
    this.refreshBtn = document.getElementById('refreshBtn');
    this.unitGrid = document.querySelector('.unit-grid');
  }

  async init() {
    try {
      await initializeHeader();
      await this.verifyAuth();
      await this.loadUnits();
      await this.fetchUsers();
      this.setupEventListeners();
    } catch (error) {
      console.error('Initialization error:', error);
      ErrorHandler.showError(error.message);
    }
  }

  async verifyAuth() {
    const token = await getAuthToken();
    if (!token) {
      window.location.href = '/index.html';
      return;
    }

    const response = await fetch('/auth/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Authentication verification failed');
    }

    const data = await response.json();
    if (!data?.valid || !data?.user || data.user.role !== 'admin') {
      window.location.href = '/dashboard/index.html';
    }
  }

  async loadUnits() {
    if (!this.unitGrid) return;

    this.unitGrid.innerHTML = VALID_UNITS.map(unit => `
      <label class="unit-checkbox">
        <input type="checkbox" name="units" value="${unit}" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
        <span class="ml-2 text-sm text-gray-700">${unit}</span>
      </label>
    `).join('');
  }

  async fetchUsers() {
    const token = await getAuthToken();
    const response = await fetch('/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }

    const users = await response.json();
    await this.updateTable(users);
  }

  async updateTable(users) {
    const tbody = this.usersTable?.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = users.map(user => `
      <tr>
        <td class="px-6 py-4">${user.name}</td>
        <td class="px-6 py-4">${user.email}</td>
        <td class="px-6 py-4">${user.role}</td>
        <td class="px-6 py-4">
          <div class="flex flex-wrap gap-1 max-w-md">
            ${Array.isArray(user.units) && user.units.length > 0 
              ? user.units.map(unit => 
                  `<span class="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full whitespace-nowrap">${unit}</span>`
                ).join('') 
              : '<span class="text-gray-400 text-sm">No units assigned</span>'}
          </div>
        </td>
        <td class="px-6 py-4 flex space-x-2">
          <button data-userid="${user.id}" class="edit-btn text-indigo-600 hover:text-indigo-900">
            <i class="fas fa-edit"></i>
          </button>
          <button data-userid="${user.id}" class="delete-btn text-red-600 hover:text-red-900">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  setupEventListeners() {
    this.addUserForm?.addEventListener('submit', this.handleFormSubmit.bind(this));
    this.usersTable?.addEventListener('click', this.handleTableActions.bind(this));
    this.refreshBtn?.addEventListener('click', () => this.fetchUsers());
  }

  async handleFormSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    try {
      const token = await getAuthToken();
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          password: formData.get('password'),
          role: formData.get('role'),
          units: Array.from(formData.getAll('units'))
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add user');
      }

      event.target.reset();
      await this.fetchUsers();
      ErrorHandler.showSuccess('User added successfully');
    } catch (error) {
      console.error('Error adding user:', error);
      ErrorHandler.showError(error.message);
    }
  }

  async handleTableActions(event) {
    const button = event.target.closest('button');
    if (!button) return;

    const userId = button.dataset.userid;
    if (!userId) return;

    if (button.classList.contains('edit-btn')) {
      window.location.href = `/useradd/edit.html?id=${userId}`;
    } else if (button.classList.contains('delete-btn')) {
      await this.handleDeleteUser(userId);
    }
  }

  async handleDeleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const token = await getAuthToken();
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete user');
      }

      await this.fetchUsers();
      ErrorHandler.showSuccess('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      ErrorHandler.showError(error.message);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const userManagement = new UserManagement();
  userManagement.init();
});