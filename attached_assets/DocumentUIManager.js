import { getAuthToken } from '../../utils/auth.js';
import { CreateDocumentModal } from './CreateDocumentModal.js';
import { TokenManager } from '../../utils/tokenManager.js';
import { ErrorHandler } from '../../utils/errorHandler.js';

// Use the proper RecipientManager implementation
import { RecipientManager } from './RecipientManager.js';


export class DocumentUIManager {
  constructor(mainManager) {
    this.mainManager = mainManager;
    this.state = {
      isInitialized: false,
      isLoading: false,
      debounceTimer: null,
      viewMode: this.mainManager?.state?.currentView || localStorage.getItem('viewMode') || 'grid',
      filters: this.getInitialFilters()
    };
    this.elements = {};
    this.recipientManager = new RecipientManager(this);

    // Make exportDocx globally available
    window.exportDocx = this.exportDocx.bind(this);
  }

  getInitialFilters() {
    const savedFilters = localStorage.getItem('documentFilters');
    return {
      user: '',
      status: 'all',
      unit: 'all',
      dateFrom: '',
      dateTo: '',
      amountFrom: '',
      amountTo: '',
      ...(savedFilters ? JSON.parse(savedFilters) : {})
    };
  }

  setupFilterContainer(container) {
    if (!container) return;

    // Setup container event delegation
    container.addEventListener('input', (event) => {
      const input = event.target;
      if (input.matches('input, select')) {
        this.handleFilterDebounce(event);
      }
    });

    container.addEventListener('change', (event) => {
      const input = event.target;
      if (input.matches('input[type="date"], select')) {
        this.handleFilterDebounce(event);
      }
    });
  }

  async initializeUI() {
    try {
      if (!this.mainManager) {
        console.warn('Main manager not initialized, continuing with limited functionality');
      }

      await this.cacheElements();
      this.setFilterValues();
      await this.loadUnits();
      await this.loadUsers();
      this.setupEventListeners();
      this.state.isInitialized = true;
      await this.loadDocuments();
      return true;
          } catch (error) {
      console.error('UI initialization failed:', error);
      this.showErrorMessage(error.message || 'Failed to initialize interface');
      return false;
    }
  }

  cacheElements() {
    const elements = [
      'documentsTable', 'loadingOverlay', 'errorMessage', 'errorText',
      'unitFilter', 'refreshButton', 'viewToggle', 'viewIcon',
      'userFilter', 'statusFilter', 'dateFrom', 'dateTo',
      'amountFrom', 'amountTo'
    ];

    let missingElements = [];
    elements.forEach(id => {
      const element = document.getElementById(id);
      if (!element) {
        missingElements.push(id);
      }
      this.elements[id] = element;
    });

    if (missingElements.length > 0) {
      // Clean up any elements that were found before throwing
      Object.keys(this.elements).forEach(key => {
        if (!this.elements[key]) {
          delete this.elements[key];
        }
      });
      throw new Error(`Required elements not found: ${missingElements.join(', ')}`);
    }
  }

  setFilterValues() {
    Object.entries(this.state.filters).forEach(([key, value]) => {
      const element = this.elements[`${key}Filter`] || this.elements[key];
      if (element) {
        element.value = value;
      }
    });
  }

  async loadUnits() {
    try {
      const tokenManager = TokenManager.getInstance();
      const token = await tokenManager.getToken();
      if (!token) throw new Error('Authentication required');

      const response = await fetch('/api/documents/units', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to load units');

      let units = await response.json();
      const user = getUserFromToken(); // Added to get user info

      // Filter units based on user role
      if (user && user.role !== 'admin' && user.units) {
        units = units.filter(unit => user.units.includes(unit));
      }

      if (this.elements.unitFilter) {
        this.elements.unitFilter.innerHTML = `
          <option value="all">Όλες οι Μονάδες</option>
          ${units.map(unit => `<option value="${unit}">${unit}</option>`).join('')}
        `;
      }
    } catch (error) {
      console.error('Units loading error:', error);
      this.showErrorMessage('Failed to load units');
    }
  }

  async loadDocuments() {
    const documentsTable = document.getElementById('documentsTable');
    if (!documentsTable) {
      console.warn('Documents table element not found');
      return;
    }

    // Cancel any ongoing loading
    if (this.state.isLoading) {
      if (this.currentRequest?.signal?.abort) {
        this.currentRequest.signal.abort();
      }
    }

    this.elements.documentsTable = documentsTable;

    try {
      this.setLoading(true);
      const tokenManager = TokenManager.getInstance();
      if (!tokenManager) {
        throw new Error('Token manager not initialized');
      }

      const token = await tokenManager.getToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const filters = {};
      Object.entries(this.state.filters).forEach(([key, value]) => {
        if (!value || value === 'all' || value === 'undefined' || value.toString().trim() === '') {
          return;
        }

        switch(key) {
          case 'dateFrom':
          case 'dateTo':
            try {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                filters[key] = date.toISOString().split('T')[0];
              }
            } catch(e) {
              console.error(`Invalid date for ${key}:`, value);
            }
            break;
          case 'amountFrom':
          case 'amountTo':
            const amount = parseFloat(value);
            if (!isNaN(amount) && amount >= 0 && amount <= Number.MAX_SAFE_INTEGER) {
              filters[key] = amount;
            } else {
              console.warn(`Invalid amount value for ${key}:`, value);
            }
            break;
          case 'user':
          case 'recipient':
          case 'afm':
            if (value.trim()) {
              filters[key] = value.trim();
            }
            break;
          default:
            filters[key] = value.toString().trim();
        }
      });
      const queryParams = new URLSearchParams(Object.entries(filters));

      const response = await fetch(`/api/documents/generated?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to load documents');
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        this.renderDocuments(data);
      } else if (data.data && Array.isArray(data.data)) {
        this.renderDocuments(data.data);
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (error) {
      console.error('Document loading failed:', error);
      this.showErrorMessage(error.message);
      this.renderError('Failed to load documents');
    } finally {
      this.setLoading(false);
    }
  }

  renderError(message) {
    if (this.elements.documentsTable) {
      this.elements.documentsTable.innerHTML = `
        <div class="col-span-full text-center py-8 text-red-600">
          <i class="fas fa-exclamation-circle mb-2"></i>
          <p>${message}</p>
        </div>`;
    }
  }

  renderDocuments(documents) {
    if (!this.elements.documentsTable) {
      console.error('Documents container not found');
      return;
    }

    if (!Array.isArray(documents)) {
      console.error('Invalid documents data:', documents);
      this.elements.documentsTable.innerHTML = '<div class="text-red-600 p-4">Error loading documents</div>';
      return;
    }

    if (!Array.isArray(documents)) {
      console.error('Invalid documents data:', documents);
      this.renderError('Error loading documents');
      return;
    }

    if (documents.length === 0) {
      const hasActiveFilters = Object.values(this.state.filters).some(value => 
        value && value !== 'all' && value !== ''
      );

      if (hasActiveFilters) {
        this.renderError('Δεν βρέθηκαν έγγραφα με τα επιλεγμένα φίλτρα');
      } else {
        this.renderError('Δεν υπάρχουν διαθέσιμα έγγραφα');
      }
      return;
    }

    const containerClass = this.state.viewMode === 'grid'
      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4'
      : 'flex flex-col gap-4 p-4 max-w-3xl mx-auto';

    this.elements.documentsTable.className = containerClass;
    const documentCards = documents.map(doc => this.createDocumentCard(doc)).join('');
    this.elements.documentsTable.innerHTML = documentCards;

    // Initialize card flipping
    const cards = this.elements.documentsTable.querySelectorAll('.document-card');
    cards.forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          card.classList.toggle('is-flipped');
        }
      });
    });
  }

  createDocumentCard(doc) {
    const statusClass = doc.status === 'completed'
      ? 'from-green-50 to-green-100 border-green-200'
      : 'from-yellow-50 to-yellow-100 border-yellow-200';

    const statusBadge = doc.status === 'completed'
      ? 'bg-green-100 text-green-800'
      : 'bg-yellow-100 text-yellow-800';

    return `
      <div class="document-card flip-card" onclick="this.classList.toggle('is-flipped')">
        <div class="flip-card-inner">
          <div class="flip-card-front">
            <div class="flex justify-between items-start mb-4">
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-900 mb-1">
                  ${doc.protocol_number_input ? `Protocol: ${doc.protocol_number_input}` : `DOC-${doc.id}`}
                </h3>
                <p class="text-sm text-gray-600">
                  Created: ${new Date(doc.created_at).toLocaleDateString()}
                </p>
              </div>
              <span class="text-sm px-3 py-1 rounded-full font-medium border ${
                doc.status === 'completed' ? 'border-green-500 text-green-700' : 'border-yellow-500 text-yellow-600'
              }">
                ${doc.status === 'completed' ? 'Completed' : 'Pending'}
              </span>
            </div>

            ${this.createDocumentCardContent(doc)}
            ${this.createDocumentCardActions(doc)}
          </div>
          ${this.createDocumentCardBack(doc, statusClass)}
        </div>
      </div>
    `;
  }

  createDocumentCardContent(doc) {
    return `
      <div class="space-y-6">
        <div class="flex items-center justify-between bg-white/60 rounded-lg p-4">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-blue-100 rounded-lg">
              <i class="fas fa-euro-sign text-blue-600"></i>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-600">Συνολικό Ποσό</p>
              <p class="text-lg font-semibold text-gray-900">${this.formatCurrency(doc.total_amount)}</p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-sm font-medium text-gray-600">Παραλήπτες</p>
            <p class="text-lg font-semibold text-gray-900">${doc.recipients?.length || 0}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="bg-white/60 rounded-lg p-4">
            <p class="text-sm font-medium text-gray-600">Μονάδα</p>
            <p class="text-base font-semibold text-gray-900 truncate" title="${doc.unit || 'N/A'}">${doc.unit || 'N/A'}</p>
          </div>
          <div class="bg-white/60 rounded-lg p-4">
            <p class="text-sm font-medium text-gray-600">NA853</p>
            <p class="text-base font-semibold text-gray-900 truncate" title="${doc.project_na853 || 'N/A'}">${doc.project_na853 || 'N/A'}</p>
          </div>
        </div>
      </div>
    `;
  }

  createDocumentCardActions(doc) {
    // Add click handler to stop event propagation
    document.addEventListener('click', (e) => {
      if (e.target.closest('.card-action-btn')) {
        e.stopPropagation();
      }
    }, true);

    const correctionInfo = doc.is_correction ? `
      <div class="mb-3 p-2 bg-yellow-50 rounded-md border border-yellow-200">
        <div class="text-sm text-yellow-700">
          <span class="font-medium">Correction of:</span>
          <span class="ml-1">Protocol ${doc.original_protocol_number || 'N/A'}</span>
        </div>
        <div class="text-xs text-yellow-600">
          Original Date: ${doc.original_protocol_date ? new Date(doc.original_protocol_date).toLocaleDateString() : 'N/A'}
        </div>
        ${doc.comments ? `<div class="text-xs text-yellow-600 mt-1">Reason: ${doc.comments}</div>` : ''}
      </div>
    ` : '';

    return `
      ${correctionInfo}
      <div class="flex justify-end gap-2">
        <button data-doc-id="${doc.id}" data-modal-type="recipient" class="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors">
          <i class="fas fa-edit mr-1"></i>Επεξεργασία
        </button>
        ${doc.status === 'completed' ? `
        <button data-doc-id="${doc.id}" data-modal-type="orthi" class="px-3 py-1.5 text-sm bg-yellow-50 text-yellow-600 rounded hover:bg-yellow-100 transition-colors">
          <i class="fas fa-sync mr-1"></i>Διόρθωση
        </button>` : ''}
        ${(!doc.protocol_number_input || doc.status !== 'completed') ? `
        <button data-doc-id="${doc.id}" data-modal-type="protocol" class="px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors">
          <i class="fas fa-file-alt mr-1"></i>Προσθήκη Πρωτοκόλλου
        </button>` : ''}
        <button onclick="exportDocx('${doc.id}')" class="px-3 py-1.5 text-sm bg-purple-50 text-purple-600 rounded hover:bg-purple-100 transition-colors">
          <i class="fas fa-file-word mr-1"></i>Εξαγωγή DOCX
        </button>
      </div>
    `;
  }

  async exportDocx(docId) {
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Authentication required');

      const response = await fetch(`/api/documents/generated/${docId}/export`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to export document');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document-${docId}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      this.showErrorMessage(error.message);
    }
  }

  createDocumentCardBack(doc, statusClass) {
    const statusBadge = doc.status === 'completed'
      ? 'bg-green-100 text-green-800'
      : 'bg-yellow-100 text-yellow-800';

    return `
      <div class="flip-card-back absolute w-full h-full backface-hidden bg-white/95 backdrop-blur-sm rounded-xl border border-gray-200/75 shadow-sm p-6 transform rotate-y-180">
        <div class="h-full flex flex-col">
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-lg font-bold text-gray-900">Recipients List</h4>
            <span class="text-sm text-gray-600 border border-gray-300 px-3 py-1 rounded-full">
              ${doc.recipients?.length || 0} Recipients
            </span>
          </div>
          <div class="flex-grow overflow-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            ${doc.recipients?.length ? doc.recipients.map(recipient => `
              <div class="mb-3 p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                <div class="flex justify-between items-start mb-2">
                  <div class="font-semibold text-gray-900">${recipient.lastname} ${recipient.firstname}</div>
                  <div class="text-sm font-medium text-blue-600">${this.formatCurrency(recipient.amount)}</div>
                </div>
                <div class="text-sm text-gray-600">
                  <span class="inline-block bg-gray-100 px-2 py-1 rounded">AFM: ${recipient.afm}</span>
                  ${recipient.installment ? `<span class="inline-block bg-gray-100 px-2 py-1 rounded ml-2">Installment: ${recipient.installment}</span>` : ''}
                </div>
              </div>
            `).join('') : '<p class="text-center text-gray-500 mt-4">No recipients added yet</p>'}
          </div>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    this.setupRefreshListener();
    this.setupViewToggleListener();
    this.setupModalListeners();
    this.setupCardFlipListeners();
    this.setupFilterIndicators();
    this.setupFilterToggle();
  }

  setupFilterToggle() {
    const toggleBtn = document.getElementById('toggleFilters');
    const filterContent = document.getElementById('filterContent');
    const chevron = toggleBtn?.querySelector('.fa-chevron-down');

    if (toggleBtn && filterContent) {
      toggleBtn.addEventListener('click', () => {
        filterContent.classList.toggle('hidden');
        filterContent.classList.toggle('show');
        chevron?.classList.toggle('rotate-180');
      });
    }
  }

  async loadDocuments() {
    try {
      this.setLoading(true);
      const token = await TokenManager.getInstance().getToken();

      if (!token) throw new Error('Authentication required');

      const response = await fetch('/api/documents/generated', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to load documents');

      const data = await response.json();
      this.renderDocuments(Array.isArray(data) ? data : data.data || []);
    } catch (error) {
      console.error('Document loading failed:', error);
      this.showErrorMessage(error.message);
    } finally {
      this.setLoading(false);
    }
  }

  setupCardFlipListeners() {
    this.elements.documentsTable?.addEventListener('click', (event) => {
      const card = event.target.closest('.document-card');
      if (card && !event.target.closest('button')) {
        card.classList.toggle('is-flipped');
      }
    });
  }

  async setupModalListeners() {
    this.elements.documentsTable?.addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-doc-id]');
      if (!button) return;

      const docId = button.dataset.docId;
      const modalType = button.dataset.modalType;

      if (docId && modalType && this.mainManager) {
        try {
          const manager = this.mainManager[`${modalType}Manager`];
          if (!manager) {
            throw new Error(`Modal manager ${modalType} not found`);
          }

          if (typeof manager.showModal !== 'function') {
            throw new Error(`Modal manager ${modalType} missing showModal method`);
          }

          if (modalType === 'recipient') {
            await this.recipientManager.editDocument(docId);
          } else {
            await manager.showModal(docId);
          }
          await this.loadDocuments(); // Refresh after modal action
        } catch (error) {
          console.error('Modal error:', error);
          this.showErrorMessage(error.message);
        }
      }
    });
  }

  setupRefreshListener() {
    this.elements.refreshButton?.addEventListener('click', async () => {
      try {
        this.setLoading(true);
        const token = await TokenManager.getInstance().getToken();
        if (!token) throw new Error('Authentication required');

        // Reset filters to initial state
        this.resetFilters();

        // Fetch fresh data from server
        const response = await fetch('/api/documents/generated', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error('Failed to refresh documents');
        }

        const documents = await response.json();
        this.renderDocuments(documents);
        this.showSuccessMessage('Documents refreshed successfully');
      } catch (error) {
        console.error('Refresh error:', error);
        this.showErrorMessage(error.message || 'Failed to refresh documents');
      } finally {
        this.setLoading(false);
      }
    });
  }

  showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-lg z-50';
    successDiv.innerHTML = `
      <div class="flex">
        <div class="flex-shrink-0">
          <i class="fas fa-check-circle"></i>
        </div>
        <div class="ml-3">
          <p class="text-sm">${message}</p>
        </div>
      </div>
    `;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 3000);
  }

  setupViewToggleListener() {
    this.elements.viewToggle?.addEventListener('click', () => {
      this.state.viewMode = this.state.viewMode === 'grid' ? 'list' : 'grid';
      localStorage.setItem('viewMode', this.state.viewMode);
      this.elements.viewIcon.className = `fas fa-${this.state.viewMode === 'grid' ? 'th-large' : 'list'}`;
      this.loadDocuments();
    });
  }

  async initializeFilters() {
    try {
      // Fetch and populate unit filter
      const response = await fetch('/api/documents/units', {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });

      if (response.ok) {
        const units = await response.json();
        const unitFilter = document.getElementById('unitFilter');
        if (unitFilter) {
          unitFilter.innerHTML = `
            <option value="all">All Units</option>
            ${units.map(unit => `<option value="${unit}">${unit}</option>`).join('')}
          `;
        }
      }
    } catch (error) {
      console.error('Failed to initialize filters:', error);
      this.showErrorMessage('Failed to load filter options');
    }
  }

  setupFilterHandlers(elements) {
    const handleFilterChange = () => {
      this.loadDocuments();
    };

    // Setup listeners for each filter type
    Object.entries(elements).forEach(([key, element]) => {
      if (!element) return;

      if (key.includes('amount')) {
        element.addEventListener('input', () => {
          const fromAmount = parseFloat(elements.amountFrom?.value || 0);
          const toAmount = parseFloat(elements.amountTo?.value || 0);

          if (toAmount && fromAmount > toAmount) {
            element.classList.add('border-red-500');
            this.showErrorMessage('Invalid amount range');
            return;
          }
          element.classList.remove('border-red-500');
          handleFilterChange();
        });
      } else if (key.includes('date')) {
        element.addEventListener('change', handleFilterChange);
      } else {
        element.addEventListener('input', handleFilterChange);
      }
    });

    // Add reset filters button
    const resetButton = document.createElement('button');
    resetButton.className = 'px-3 py-1.5 text-sm bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition-colors';
    resetButton.innerHTML = '<i class="fas fa-times mr-1"></i>Reset Filters';
    resetButton.onclick = () => this.resetFilters();
    if (this.elements.refreshButton?.parentNode) {
      this.elements.refreshButton.parentNode.insertBefore(resetButton, this.elements.refreshButton);
    }
  }

    setupFilterIndicators() {
    // Optimize performance with a single container styling
    const filterBar = document.querySelector('.filter-bar');
    if (filterBar) {
      filterBar.className = 'filter-bar bg-white p-4 rounded-xl shadow-md border border-gray-100 mb-6 transition-all';
      // Use event delegation for better performance
      filterBar.addEventListener('input', this.handleFilterDebounce.bind(this));
      filterBar.addEventListener('change', this.handleFilterDebounce.bind(this));
    }

    const filterInputs = {
      text: ['recipientFilter', 'afmFilter'],
      number: ['amountFrom', 'amountTo'],
      date: ['dateFrom', 'dateTo'],
      select: ['unitFilter', 'statusFilter', 'userFilter']
    };

    // Enhance input styling
    Object.values(filterInputs).flat().forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.className = 'w-full rounded-lg border-gray-200 bg-gray-50/50 px-4 py-2.5 text-gray-700 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200';
      }
    });

    const addFilterIndicator = (element) => {
      const indicator = document.createElement('span');
      indicator.className = 'absolute right-2 top-2 w-2 h-2 bg-blue-500 rounded-full hidden';
      element.parentNode.style.position = 'relative';
      element.parentNode.appendChild(indicator);
      return indicator;
    };

    // Enhanced filter validation
    const validateFilter = (type, value) => {
      switch (type) {
        case 'number':
          return !isNaN(value) && value >= 0;
        case 'date':
          return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
        default:
          return true;
      }
    };

    Object.entries(filterInputs).forEach(([type, ids]) => {
      ids.forEach(id => {
        const element = document.getElementById(id);
        if (!element) return;

        const indicator = addFilterIndicator(element);

        const handleFilterChange = () => {
          clearTimeout(this.state.debounceTimer);

          const value = element.value?.trim() || '';
          const key = id.replace('Filter', '').toLowerCase();

          // Special handling for numeric filters
          if (type === 'number' && value !== '') {
            const num = parseFloat(value);
            if (isNaN(num) || num < 0) {
              element.classList.add('border-red-500');
              return;
            }
          }

          element.classList.remove('border-red-500');
          indicator.classList.toggle('hidden', !value);

          this.state.debounceTimer = setTimeout(() => {
            this.state.filters[key] = value;
            localStorage.setItem('documentFilters', JSON.stringify(this.state.filters));
            this.loadDocuments();
          }, type === 'text' ? 500 : 0);
        };

        // Handle date range validation
        if (type === 'date') {
          element.addEventListener('change', () => {
            const fromDate = document.getElementById('dateFrom')?.value;
            const toDate = document.getElementById('dateTo')?.value;

            if (fromDate && toDate && fromDate > toDate) {
              element.classList.add('border-red-500');
              this.showErrorMessage('Invalid date range');
              return;
            }

            handleFilterChange();
          });
        } else if (type === 'number') {
          element.addEventListener('input', () => {
            const fromAmount = parseFloat(document.getElementById('amountFrom')?.value || 0);
            const toAmount = parseFloat(document.getElementById('amountTo')?.value || 0);

            if (fromAmount > toAmount && toAmount !== 0) {
              element.classList.add('border-red-500');
              this.showErrorMessage('Invalid amount range');
              return;
            }

            handleFilterChange();
          });
        } else {
          element.addEventListener(type === 'text' ? 'input' : 'change', handleFilterChange);
        }

        // Set initial indicator state
        indicator.classList.toggle('hidden', !element.value);
      });
    });
  }

  resetFilters() {
    this.state.filters = this.getInitialFilters();
    localStorage.removeItem('documentFilters');

    // Reset all filter inputs
    Object.values(this.elements).forEach(element => {
      if (element?.tagName === 'INPUT' || element?.tagName === 'SELECT') {
        element.value = '';
        element.classList.remove('border-red-500');
        const indicator = element.parentNode?.querySelector('.bg-blue-500');
        if (indicator) indicator.classList.add('hidden');
      }
    });

    this.loadDocuments();
  }

  formatCurrency(amount) {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }

  setLoading(isLoading) {
    this.state.isLoading = isLoading;
    if (this.elements.loadingOverlay) {
      this.elements.loadingOverlay.classList.toggle('hidden', !isLoading);
    }
  }

  showErrorMessage(message) {
    ErrorHandler.showError(message);
  }

  cleanup() {
    this.state.isInitialized = false;
    this.state.isLoading = false;

    // Clear all timeouts
    clearTimeout(this.state.debounceTimer);

    // Clean up event listeners
    Object.values(this.elements).forEach(element => {
      if (element?.removeEventListener) {
        element.removeEventListener('click', this.cardFlipHandler);
        element.removeEventListener('click', this.refreshHandler);
        element.removeEventListener('input', this.handleFilterChange);
        element.removeEventListener('change', this.handleFilterChange);
      }
    });

    // Clean up modal if exists
    if (this.createDocumentModal?.cleanup) {
      this.createDocumentModal.cleanup();
    }

    // Cancel any pending fetch requests
    if (this.currentRequest?.abort) {
      this.currentRequest.abort();
    }

    // Clear references
    this.elements = {};
    this.mainManager = null;
    this.createDocumentModal = null;
    this.currentRequest = null;
    this.recipientManager = null; //Added cleanup for recipientManager
  }
  async createDocument(formData) {
    try {
      if (!formData.unit || !formData.project || !formData.expenditure_type) {
        throw new Error('Missing required fields');
      }

      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/documents/generated', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create document');
      }
    } catch (error) {
        console.error("Error creating document:", error);        this.showErrorMessage(error.message || "Failed to create document");
    }
  }

  async loadUsers() {
    try {
      const token = await getAuthToken();
      const currentUser = JSON.parse(localStorage.getItem('user'));
      const userFilter = document.getElementById('userFilter');

      if (!userFilter) return;

      let users;
      if (currentUser.role === 'admin') {
        const response = await fetch('/api/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch users');
        users = await response.json();
      } else if (currentUser.units?.length > 0) {
        const units = Array.isArray(currentUser.units) ? currentUser.units : 
                     JSON.parse(currentUser.units || '[]');
        if (units.length > 0) {
          const response = await fetch(`/api/users/by-unit/${encodeURIComponent(units[0])}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!response.ok) throw new Error('Failed to fetch unit users');
          users = await response.json();
        }
      }

      if (users?.length) {
        userFilter.innerHTML = `
          <option value="">All Users</option>
          ${users.map(user => `
            <option value="${user.id}">${user.name} (${user.email})</option>
          `).join('')}
        `;
      } else {
        userFilter.innerHTML = '<option value="">No users available</option>';
      }

      userFilter.addEventListener('change', () => this.handleFilterDebounce({ target: userFilter }));
    } catch (error) {
      console.error('Error loading users:', error);
      const userFilter = document.getElementById('userFilter');
      if (userFilter) {
        userFilter.innerHTML = '<option value="">Error loading users</option>';
      }
    }
  }


  handleFilterDebounce(event) {
    if (!event.target.matches('input, select')) return;

    if (this.state.isLoading) {
      console.debug('Skipping filter change - loading in progress');
      return;
    }

    if (this.state.debounceTimer) {
      clearTimeout(this.state.debounceTimer);
    }

    // Cache DOM reads
    const element = event.target;
    const value = element.value?.trim() || '';
    const key = element.id.replace('Filter', '').toLowerCase();

    this.state.debounceTimer = setTimeout(async () => {
      try {
        const filters = ['searchInput', 'userFilter', 'unitFilter', 'statusFilter'].reduce((acc, id) => {
          const element = document.getElementById(id);
          if (element) {
            const key = id.replace('Filter', '').toLowerCase();
            acc[key] = element.value || '';
          }
          return acc;
        }, {});

        this.state.filters = { ...this.state.filters, ...filters };
        localStorage.setItem('documentFilters', JSON.stringify(this.state.filters));

        await this.loadDocuments();
      } catch (error) {
        console.error('Filter change error:', error);
        this.showErrorMessage('Failed to apply filters');
      }
    }, 500);
  }
}

//Helper function (needs to be implemented elsewhere)
function getUserFromToken() {
    const token = localStorage.getItem('authToken');
    if (!token) return null;

    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload = JSON.parse(jsonPayload);
        return payload.user || payload;
    } catch (error) {
        console.error("Error decoding token:", error);
        return null;
    }
}