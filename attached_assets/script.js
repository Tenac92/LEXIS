import { createHeader } from '../components/header.js';
import { createFAB } from '../components/fab.js';
import { getAuthToken } from '../utils/auth.js';
import { CsvUploadManager } from './managers/CsvUploadManager.js';

// Initialize with empty baseUrl since the API routes are relative
const csvUploadManager = new CsvUploadManager('');
import { TokenManager } from '../utils/tokenManager.js';
import { ErrorHandler } from '../utils/errorHandler.js';

class CatalogManager {
  constructor() {
    this.state = {
      filters: { search: '', unit: '' },
      page: 1,
      pageSize: 12,
      loading: false,
      hasMore: true,
      searchDebounce: null
    };
    this.api = {
      baseUrl: '/api/catalog',
      headers: { 'Content-Type': 'application/json' }
    };
  }

  async init() {
    await this.loadProjects();
    this.initEventListeners();
    this.setupFileUpload();
  }

  async fetchWithAuth(endpoint, options = {}) {
    const token = await getAuthToken();
    if (!token) {
      window.location.href = "../index.html";
      return null;
    }
    return fetch(endpoint, {
      headers: { 
        ...this.api.headers,
        'Authorization': `Bearer ${token}`,
        ...options.headers
      },
      ...options
    });
  }

  async loadProjects(reset = false, retryCount = 0) {
    if ((this.state.loading || (!this.state.hasMore && !reset)) && retryCount === 0) return;

    const MAX_RETRIES = 3;

    if (reset) {
      this.state.page = 1;
      this.state.hasMore = true;
      document.getElementById('catalogContainer').innerHTML = '';
    }

    this.toggleLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: this.state.page,
        limit: this.state.pageSize,
        ...this.state.filters
      });

      const response = await this.fetchWithAuth(`${this.api.baseUrl}?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch projects');

      const result = await response.json();
      this.renderProjects(result.data, TokenManager.getInstance().isUserAdmin());

      this.state.hasMore = this.state.page < result.pagination?.pages;
      this.state.page++;
    } catch (error) {
      ErrorHandler.handleApiError(error, 'Failed to load projects');
    } finally {
      this.toggleLoading(false);
    }
  }

  renderProjects(projects, isAdmin) {
    const container = document.getElementById('catalogContainer');
    if (projects.length === 0) {
      container.innerHTML = '<div class="text-center text-gray-500 py-8">No projects found</div>';
      return;
    }

    projects.forEach(project => {
      container.appendChild(this.createProjectCard(project, isAdmin));
    });
  }

  createProjectCard(project, isAdmin) {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 p-6 flex flex-col h-full';
    card.setAttribute('data-project-id', project.mis);
    card.setAttribute('data-budget', project.budget_na853);
    card.setAttribute('data-status', project.status);
    card.onclick = () => this.showProjectDetails(project);

    const getStatusClass = (status) => {
      switch (status) {
        case 'active':
          return 'bg-green-50 text-green-600';
        case 'pending':
          return 'bg-yellow-50 text-yellow-600';
        case 'completed':
          return 'bg-blue-50 text-blue-600';
        default:
          return 'bg-gray-50 text-gray-600';
      }
    };

    const statusClass = getStatusClass(project.status);
    const budgetValidation = project.budget_na853 > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600';

    card.innerHTML = `
      <div class="mb-4">
        <h3 class="text-lg font-bold text-gray-900 mb-2 line-clamp-2">${project.event_description || 'N/A'}</h3>
        <div class="flex items-center gap-2 flex-wrap">
          ${project.status === 'pending' ? 
            '<span class="px-3 py-1 rounded-full text-xs bg-amber-100 text-amber-800 font-medium">Αναμονή Χρηματοδότησης</span>' :
            project.status === 'pending_reallocation' ? 
            '<span class="px-3 py-1 rounded-full text-xs bg-purple-100 text-purple-800 font-medium">Αναμονή Ανακατανομής</span>' :
            `<span class="px-3 py-1 rounded-full text-xs ${statusClass} font-medium">
              ${project.status === 'active' ? 'Ενεργό' : 'Ανενεργό'}
            </span>`
          }
          <span class="text-sm font-semibold text-blue-600">
            ${this.formatCurrency(project.budget_na853)}
          </span>
          ${project.ethsia_pistosi ? 
            `<span class="text-sm text-gray-500">
              Ετήσια Πίστωση: ${this.formatCurrency(project.ethsia_pistosi)}
            </span>` : ''
          }
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2 mb-3">
        <div class="bg-gray-50 p-2 rounded">
          <div class="text-xs text-gray-500">MIS</div>
          <div class="font-medium">${project.mis || 'N/A'}</div>
        </div>
        <div class="bg-gray-50 p-2 rounded">
          <div class="text-xs text-gray-500">Region</div>
          <div class="font-medium">${project.region || 'N/A'}</div>
        </div>
      </div>
      ${isAdmin ? this.generateAdminControls(project.mis) : ''}
    `;

    return card;
  }

  generateAdminControls(mis) {
    return `
      <div class="flex justify-end gap-2 pt-3 border-t" onclick="event.stopPropagation();">
        <a href="edit.html?id=${mis}" class="px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded">
          <i class="fas fa-edit mr-1"></i> Edit
        </a>
        <button onclick="catalogManager.deleteProject('${mis}')" class="text-red-600 hover:text-red-800">
          <i class="fas fa-trash mr-1"></i> Delete
        </button>
      </div>
    `;
  }

  async deleteProject(mis) {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      const response = await this.fetchWithAuth(`${this.api.baseUrl}/${mis}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete project');

      await this.loadProjects(true);
      ErrorHandler.showSuccess('Project deleted successfully');
    } catch (error) {
      ErrorHandler.handleApiError(error, 'Failed to delete project');
    }
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  }

  toggleLoading(show) {
    this.state.loading = show;
    document.getElementById('loadingSpinner').classList.toggle('hidden', !show);
  }

  initEventListeners() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', this.handleSearchInput.bind(this));

    window.addEventListener('scroll', () => {
      if (this.state.hasMore && !this.state.loading && 
          window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        this.loadProjects();
      }
    });

    document.getElementById('exportButton')?.addEventListener('click', 
      () => this.exportProjects());
  }

  handleSearchInput(event) {
    clearTimeout(this.state.searchDebounce);
    this.state.searchDebounce = setTimeout(() => {
      const searchValue = event.target.value.trim();
      const statusValue = document.getElementById('statusFilter')?.value || '';
      const budgetValue = document.getElementById('budgetFilter')?.value || '';
      const sortValue = document.getElementById('sortFilter')?.value || 'date_desc';

      this.state.filters = {
        search: searchValue,
        status: statusValue,
        budget: budgetValue,
        sort: sortValue
      };

      // Save filters to localStorage
      localStorage.setItem('catalogFilters', JSON.stringify(this.state.filters));

      this.loadProjects(true);

      // Update URL for bookmarking
      const params = new URLSearchParams();
      Object.entries(this.state.filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
    }, 300);
  }

  setupFileUpload() {
    const uploadBtn = document.getElementById('uploadButton');
    const fileInput = document.getElementById('fileInput');

    if (!TokenManager.getInstance().isUserAdmin()) {
      uploadBtn?.classList.add('hidden');
      return;
    }

    uploadBtn?.addEventListener('click', () => fileInput.click());
    fileInput?.addEventListener('change', this.handleFileUpload.bind(this));
  }

  async handleFileUpload(event) {
    const file = event.target.files[0];
    const uploadManager = new CsvUploadManager(this.api.baseUrl);

    if (await uploadManager.handleFileUpload(file)) {
      setTimeout(() => window.location.reload(), 1500);
    }

    event.target.value = '';
  }

  async handleBulkUpdate() {
    try {
      const data = JSON.parse(document.getElementById('bulkUpdateData').value);
      const bulkManager = new BulkUpdateManager();
      await bulkManager.updateMultipleProjects(data);
      alert('Projects updated successfully');
      window.location.reload();
    } catch (error) {
      alert('Error updating projects: ' + error.message);
    }
  }

  async exportProjects() {
    try {
      const filters = {
        search: this.state.filters.search || '',
        unit: this.state.filters.unit || '',
        page: 1,
        limit: 1000
      };
      const queryParams = new URLSearchParams(filters);
      const response = await this.fetchWithAuth(`${this.api.baseUrl}/export?${queryParams}`, {
        headers: {
          'Accept': 'text/csv'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Export failed - no projects found');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `projects-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      ErrorHandler.handleApiError(error, 'Failed to export projects');
    }
  }

  showProjectDetails(project) {
    // Remove any existing dialog
    const existingDialog = document.querySelector('dialog');
    if (existingDialog) {
      existingDialog.remove();
    }

    const dialog = document.createElement('dialog');
    dialog.className = 'fixed inset-0 z-50 p-4 bg-white rounded-lg shadow-xl max-w-2xl mx-auto mt-20';
    
    const statusDisplay = project.status === 'pending' ? 'Αναμονή Χρηματοδότησης' :
                         project.status === 'pending_reallocation' ? 'Αναμονή Ανακατανομής' :
                         project.status === 'active' ? 'Ενεργό' : 'Ανενεργό';
    
    dialog.innerHTML = `
      <div class="flex flex-col h-full max-h-[80vh]">
        <div class="flex justify-between items-center mb-4 border-b pb-2">
          <h2 class="text-xl font-bold">Project Details</h2>
          <button class="text-gray-500 hover:text-gray-700" onclick="this.closest('dialog').close()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="space-y-4 overflow-y-auto flex-1 p-2">
          <div class="bg-gray-50 p-4 rounded-lg">
            <h3 class="font-semibold text-lg mb-2">Description</h3>
            <p class="text-gray-700 whitespace-pre-wrap">${project.event_description || 'N/A'}</p>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-gray-50 p-4 rounded-lg">
              <h3 class="font-semibold">MIS</h3>
              <p class="text-gray-700">${project.mis || 'N/A'}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-lg">
              <h3 class="font-semibold">Region</h3>
              <p class="text-gray-700">${project.region || 'N/A'}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-lg">
              <h3 class="font-semibold">Status</h3>
              <p class="text-gray-700">${statusDisplay}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-lg">
              <h3 class="font-semibold">Budget</h3>
              <p class="text-gray-700">${this.formatCurrency(project.budget_na853)}</p>
            </div>
            ${project.ethsia_pistosi ? `
            <div class="bg-gray-50 p-4 rounded-lg col-span-2">
              <h3 class="font-semibold">Annual Credit</h3>
              <p class="text-gray-700">${this.formatCurrency(project.ethsia_pistosi)}</p>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    
    // Ensure the dialog is properly initialized before showing
    requestAnimationFrame(() => {
      dialog.showModal();
    });

    // Close on backdrop click and escape key
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });
    
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') dialog.close();
    });
  }
}

const catalogManager = new CatalogManager();

document.addEventListener('DOMContentLoaded', async () => {
  const getStatusClass = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-50 text-green-600';
      case 'pending':
        return 'bg-yellow-50 text-yellow-600';
      case 'completed':
        return 'bg-blue-50 text-blue-600';
      default:
        return 'bg-gray-50 text-gray-600';
    }
  };
  try {
    document.body.appendChild(await createFAB());
    await catalogManager.init();
  } catch (error) {
    ErrorHandler.handleApiError(error, 'Failed to initialize catalog');
  }
});