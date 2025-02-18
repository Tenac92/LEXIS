import { getAuthToken } from '../../utils/auth.js';
import { BaseModal } from './BaseModal.js';

export class RecipientManager extends BaseModal {
  constructor(mainManager) {
    super('recipientModal');
    this.mainManager = mainManager;
    this.recipients = [];
    this.currentDocumentId = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized && this.modal) {
      return true;
    }

    await super.initialize();
    await this.renderModalContent();
    await this.setupEventHandlers();

    this.isInitialized = true;
    return true;
  }

  async renderModalContent() {
    const content = `
      <div class="space-y-6">
        <div class="bg-white p-6 rounded-lg shadow">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Protocol Number</label>
              <input type="text" id="protocolNumberInput" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Protocol Date</label>
              <input type="date" id="protocolDateInput" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Project</label>
              <select id="projectSelect" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                <option value="">Select project...</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Expenditure Type</label>
              <select id="expenditureType" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                <option value="">Select type...</option>
              </select>
            </div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h3 class="text-xl font-semibold text-gray-800">Recipients</h3>
              <div class="mt-1 flex items-center space-x-4">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  <i class="fas fa-users mr-2"></i>Total: <span id="recipientCount" class="ml-1 font-bold">0</span>
                </span>
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  <i class="fas fa-euro-sign mr-2"></i>Amount: <span id="totalAmount" class="ml-1 font-bold">€0,00</span>
                </span>
              </div>
            </div>
            <button id="addRecipientBtn" class="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all duration-300 transform hover:scale-105 flex items-center space-x-2 shadow-lg">
              <i class="fas fa-plus-circle text-lg"></i>
              <span>Add Recipient</span>
            </button>
          </div>

          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 rounded-xl border border-gray-200/75 shadow-sm">
              <thead>
                <tr>
                  <th scope="col" class="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">#</th>
                  <th scope="col" class="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">First Name</th>
                  <th scope="col" class="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Last Name</th>
                  <th scope="col" class="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">AFM</th>
                  <th scope="col" class="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th scope="col" class="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Installment</th>
                  <th scope="col" class="px-6 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody id="recipientsTable" class="bg-white divide-y divide-gray-200"></tbody>
            </table>
          </div>
        </div>

        <div class="flex justify-end space-x-3">
          <button id="cancelBtn" class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            Cancel
          </button>
          <button id="saveBtn" class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            Save Changes
          </button>
        </div>
      </div>
    `;

    this.setContent(content);
    this.recipientsTable = document.getElementById('recipientsTable');
  }

  async loadProjects() {
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/catalog', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load projects');
      const projects = await response.json();

      const projectSelect = document.getElementById('projectSelect');
      if (projectSelect) {
        projectSelect.innerHTML = `
          <option value="">Select project...</option>
          ${projects.data.map(p => `<option value="${p.mis}">${p.name || p.na853} - Budget: €${parseFloat(p.budget_na853 || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</option>`).join('')}
        `;
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      this.showError('Failed to load projects');
    }
  }

  async loadExpenditureTypes(projectId) {
    try {
      const token = await getAuthToken();
      const response = await fetch(`/api/catalog/${projectId}/expenditure-types`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load expenditure types');
      const { expenditure_types } = await response.json();

      const typeSelect = document.getElementById('expenditureType');
      if (typeSelect) {
        typeSelect.innerHTML = `
          <option value="">Select type...</option>
          ${(expenditure_types || []).map(t => `<option value="${t}">${t}</option>`).join('')}
        `;
      }
    } catch (error) {
      console.error('Failed to load expenditure types:', error);
      this.showError('Failed to load expenditure types');
    }
  }

  setupEventHandlers() {
    const addBtn = document.getElementById('addRecipientBtn');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const projectSelect = document.getElementById('projectSelect');

    if (projectSelect) {
      projectSelect.addEventListener('change', (e) => {
        this.loadExpenditureTypes(e.target.value);
      });
    }

    addBtn?.addEventListener('click', () => this.addRecipient());
    saveBtn?.addEventListener('click', () => this.saveRecipients());
    cancelBtn?.addEventListener('click', () => this.hide());

    this.recipientsTable?.addEventListener('input', this.handleRecipientInput.bind(this));
    this.recipientsTable?.addEventListener('click', this.handleRecipientDelete.bind(this));
  }

  handleRecipientInput(e) {
    const input = e.target;
    if (input.tagName !== 'INPUT') return;

    const index = parseInt(input.dataset.index);
    const field = input.dataset.field;
    let value = input.value;

    if (field === 'amount') {
      value = parseFloat(value) || 0;
    } else if (field === 'afm') {
      value = value.replace(/\D/g, '').slice(0, 9);
      input.value = value;
    }

    this.updateRecipient(index, field, value);
  }

  handleRecipientDelete(e) {
    const deleteBtn = e.target.closest('.delete-recipient');
    if (!deleteBtn) return;

    const index = parseInt(deleteBtn.dataset.index);
    this.removeRecipient(index);
  }

  async showModal(documentId) {
    try {
      this.currentDocumentId = documentId;
      if (!documentId) throw new Error('Document ID required');

      const token = await getAuthToken();
      if (!token) throw new Error('Authentication required');

      const response = await fetch(`/api/documents/generated/${documentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch document');
      const doc = await response.json();

      await this.initialize();
      await new Promise(resolve => setTimeout(resolve, 100)); // Ensure modal is ready

      this.recipients = Array.isArray(doc.recipients) ? doc.recipients.map(r => ({
        firstname: r.firstname || '',
        lastname: r.lastname || '',
        afm: r.afm || '',
        amount: parseFloat(r.amount) || 0,
        installment: r.installment || '1'
      })) : [];

      // Set title
      this.setTitle(`Edit Document ${doc.document_number || ''}`);

      // Load projects and expenditure types
      await this.loadProjects();
      if (doc.project_id) {
        await this.loadExpenditureTypes(doc.project_id);
      }

      // Populate form fields after ensuring modal is ready
      const fields = {
        'protocolNumberInput': doc.protocol_number_input || '',
        'protocolDateInput': doc.protocol_date ? doc.protocol_date.split('T')[0] : '',
        'projectSelect': doc.project_id || '',
        'expenditureType': doc.expenditure_type || ''
      };

      // Set fields directly for immediate effect
      Object.entries(fields).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
          element.value = value;
          console.log(`Setting ${id} to ${value}`); // Debug logging
        }
      });

      // Ensure protocol fields are set
      const protocolNum = document.getElementById('protocolNumberInput');
      const protocolDate = document.getElementById('protocolDateInput');
      if (protocolNum) protocolNum.value = doc.protocol_number || '';
      if (protocolDate) protocolDate.value = doc.protocol_date ? doc.protocol_date.split('T')[0] : '';

      this.refreshTable();
      await this.show();
    } catch (error) {
      console.error('Failed to show modal:', error);
      this.showError(error.message);
    }
  }

  addRecipient() {
    if (this.recipients.length >= 10) {
      this.showError('Maximum 10 recipients allowed');
      return;
    }

    this.recipients.push({
      firstname: '',
      lastname: '',
      afm: '',
      amount: '',
      installment: '1'
    });

    this.refreshTable();
  }

  updateRecipient(index, field, value) {
    if (!this.recipients[index]) return;
    this.recipients[index][field] = value;
    this.updateSummary();
  }

  removeRecipient(index) {
    this.recipients.splice(index, 1);
    this.refreshTable();
  }

  refreshTable() {
    if (!this.recipientsTable) return;

    this.recipientsTable.innerHTML = this.recipients.map((recipient, index) => `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-600 text-sm font-medium">${index + 1}</span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <input type="text" 
                 value="${recipient.firstname || ''}"
                 class="w-full px-6 py-4 bg-white border border-gray-300 rounded-lg shadow-sm hover:border-blue-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-base min-w-[180px]"
                 placeholder="First name"
                 data-field="firstname"
                 data-index="${index}">
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <input type="text"
                 value="${recipient.lastname || ''}"
                 class="w-full px-6 py-4 bg-white border border-gray-300 rounded-lg shadow-sm hover:border-blue-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-base min-w-[180px]"
                 placeholder="Last name"
                 data-field="lastname"
                 data-index="${index}">
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <input type="text"
                 value="${recipient.afm || ''}"
                 class="w-full px-6 py-4 bg-white border border-gray-300 rounded-lg shadow-sm hover:border-blue-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-mono text-base min-w-[180px]"
                 placeholder="AFM"
                 data-field="afm"
                 data-index="${index}"
                 maxlength="9">
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="relative rounded-lg shadow-sm">
            <span class="absolute inset-y-0 left-3 flex items-center text-gray-500 pointer-events-none">€</span>
            <input type="number"
                   value="${recipient.amount || ''}"
                   class="w-full pl-8 pr-4 py-4 bg-white border border-gray-300 rounded-lg hover:border-blue-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-base min-w-[180px]"
                   placeholder="0.00"
                   data-field="amount"
                   data-index="${index}"
                   step="0.01">
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <input type="number"
                 value="${recipient.installment || 1}"
                 class="w-24 px-4 py-4 bg-white border border-gray-300 rounded-lg text-center shadow-sm hover:border-blue-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-base"
                 data-field="installment"
                 data-index="${index}"
                 min="1">
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <button class="delete-recipient p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full transition-colors"
                  data-index="${index}">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      </tr>
    `).join('');

    this.updateSummary();
  }

  updateSummary() {
    const countEl = document.getElementById('recipientCount');
    const totalEl = document.getElementById('totalAmount');

    if (countEl) {
      countEl.textContent = this.recipients.length;
    }

    if (totalEl) {
      const total = this.recipients.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
      totalEl.textContent = new Intl.NumberFormat('el-GR', {
        style: 'currency',
        currency: 'EUR'
      }).format(total);
    }
  }

  async saveRecipients() {
    try {
      if (!this.validateRecipients()) return;

      const token = await getAuthToken();
      if (!token) throw new Error('Authentication required');

      const documentData = {
        protocol_number_input: document.getElementById('protocolNumberInput')?.value || '',
        protocol_date: document.getElementById('protocolDateInput')?.value || '',
        project_id: document.getElementById('projectSelect')?.value || '',
        expenditure_type: document.getElementById('expenditureType')?.value || '',
        recipients: this.recipients,
        total_amount: this.recipients.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)
      };

      const response = await fetch(`/api/documents/generated/${this.currentDocumentId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(documentData)
      });

      if (!response.ok) throw new Error('Failed to save recipients');

      await this.mainManager?.loadDocuments();
      this.hide();
      this.showSuccess('Recipients saved successfully');
    } catch (error) {
      this.showError(error.message);
    }
  }

  validateRecipients() {
    if (!this.recipients.length) {
      this.showError('At least one recipient is required');
      return false;
    }

    return this.recipients.every((r, index) => {
      if (!r.firstname?.trim() || !r.lastname?.trim()) {
        this.showError(`Recipient ${index + 1}: Name fields are required`);
        return false;
      }

      // Clean AFM and validate
      const cleanAFM = (r.afm || '').replace(/\D/g, '');
      if (!cleanAFM || cleanAFM.length !== 9) {
        this.showError(`Recipient ${index + 1}: AFM must be exactly 9 digits (currently ${cleanAFM.length} digits)`);
        return false;
      }

      if (!r.amount || isNaN(parseFloat(r.amount)) || parseFloat(r.amount) <= 0) {
        this.showError(`Recipient ${index + 1}: Invalid amount`);
        return false;
      }
      if (!r.installment || isNaN(parseInt(r.installment)) || parseInt(r.installment) < 1) {
        this.showError(`Recipient ${index + 1}: Invalid installment number`);
        return false;
      }
      return true;
    });
  }

  showError(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg z-50';
    toast.innerHTML = `
      <div class="flex">
        <div class="flex-shrink-0">
          <i class="fas fa-exclamation-circle"></i>
        </div>
        <div class="ml-3">
          <p class="text-sm">${message}</p>
        </div>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-lg z-50';
    toast.innerHTML = `
      <div class="flex">
        <div class="flex-shrink-0">
          <i class="fas fa-check-circle"></i>
        </div>
        <div class="ml-3">
          <p class="text-sm">${message}</p>
        </div>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  async editDocument(docId) {
    try {
      this.currentDocumentId = docId;
      if (!docId) throw new Error('Document ID required');

      const token = await getAuthToken();
      if (!token) throw new Error('Authentication required');

      const response = await fetch(`/api/documents/generated/${docId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch document');
      const doc = await response.json();

      await this.initialize();
      await new Promise(resolve => setTimeout(resolve, 100)); // Ensure modal is ready

      this.recipients = Array.isArray(doc.recipients) ? doc.recipients.map(r => ({
        firstname: r.firstname || '',
        lastname: r.lastname || '',
        afm: r.afm || '',
        amount: parseFloat(r.amount) || 0,
        installment: r.installment || '1'
      })) : [];

      this.setTitle(`Edit Document ${doc.document_number || ''}`);
      await this.loadProjects();
      if (doc.project_id) {
        await this.loadExpenditureTypes(doc.project_id);
      }

      const projectSelect = document.getElementById('projectSelect');
      const expenditureType = document.getElementById('expenditureType');
      if (projectSelect) projectSelect.value = doc.project_id || '';
      if (expenditureType) expenditureType.value = doc.expenditure_type || '';

      this.refreshTable();
      await this.show();
    } catch (error) {
      console.error('Failed to show modal:', error);
      this.showError(error.message);
    }
  }
}