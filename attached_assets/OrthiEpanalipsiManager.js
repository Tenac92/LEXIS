import { getAuthToken } from '../../utils/auth.js';
import { BaseModal } from './BaseModal.js';

export class OrthiEpanalipsiManager extends BaseModal {
  constructor(mainManager) {
    super('orthiEpanalipsiModal');
    this.mainManager = mainManager;
    this.currentDocumentId = null;
    this.initialize();
  }

  async initialize() {
    if (!await super.initialize()) return false;

    const modalContent = `
      <div class="flex items-center justify-center min-h-screen p-6">
        <div class="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
          <div class="p-8 overflow-y-auto">
            <h2 class="text-xl font-semibold mb-4">Στοιχεία Διόρθωσης</h2>
            <div class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Αρχικό Πρωτόκολλο</label>
                  <input type="text" id="originalProtocol" readonly 
                    class="w-full p-2 bg-gray-100 border rounded focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Ημερομηνία Πρωτοκόλλου</label>
                  <input type="date" id="protocolDate" required
                    class="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"/>
                </div>
              </div>



              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Λόγος Διόρθωσης</label>
                <textarea id="orthiComments" rows="4" placeholder="Δώστε το λόγο διόρθωσης"
                  class="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"></textarea>
              </div>

              <div id="documentDetails" class="bg-gray-50 p-4 rounded-lg">
                <h3 class="font-medium text-gray-900 mb-4">Λεπτομέρειες Εγγράφου</h3>
                <div class="space-y-4">
                  <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                      <label class="text-sm text-gray-600">Μονάδα</label>
                      <input type="text" id="docUnit" class="w-full p-2 border rounded bg-gray-100" readonly>
                    </div>
                    <div class="space-y-2">
                      <label class="text-sm text-gray-600">NA853</label>
                      <select id="docNA853" class="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500">
                        <option value="">Επιλέξτε NA853...</option>
                      </select>
                    </div>
                  </div>

                  <div id="recipientsContainer" class="space-y-4">
                    <div class="flex justify-between items-center">
                      <h4 class="text-sm font-medium text-gray-700">Πολυλήπτες</h4>
                      <button onclick="docManager.orthiManager.addRecipient()" 
                              class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                        Προσθήκη Πολυλήπτη
                      </button>
                    </div>
                    <div class="recipients-list space-y-3">
                      <!-- Recipients will be dynamically added here -->
                    </div>
                  </div>

                  <div class="space-y-2">
                    <label class="text-sm text-gray-600">Σχόλια</label>
                    <textarea id="docComments" class="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500" rows="3" placeholder="Εισάγετε σχόλια διόρθωσης..."></textarea>
                  </div>
                </div>
              </div>
            </div>
            <div class="mt-6 flex justify-end gap-3">
              <button onclick="docManager.orthiManager.hide()" 
                      class="px-4 py-2 text-gray-600 hover:text-gray-800">
                Ακύρωση
              </button>
              <button onclick="docManager.orthiManager.generateOrthiEpanalipsi()"
                      class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Δημιουργία Διόρθωσης
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.modal.innerHTML = modalContent;
    return true;
  }

  async showModal(documentId) {
    if (!documentId) return;

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Authentication required');

      const response = await fetch(`/api/documents/generated/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch document');

      const doc = await response.json();
      if (!doc.protocol_number_input) {
        throw new Error('Original document has no protocol number');
      }

      // Fetch available NA853 options
      const projectsResponse = await fetch(`/api/catalog?unit=${encodeURIComponent(doc.unit)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!projectsResponse.ok) throw new Error('Failed to load projects');
      const projects = await projectsResponse.json();

      const na853Select = document.getElementById('docNA853');
      na853Select.innerHTML = '<option value="">Επιλέξτε NA853...</option>';
      projects.data.forEach(project => {
        const option = document.createElement('option');
        option.value = project.na853;
        option.textContent = project.na853;
        if (project.na853 === doc.project_na853) {
          option.selected = true;
        }
        na853Select.appendChild(option);
      });

      this.currentDocumentId = documentId;
      this.originalDoc = doc;

      // Load original document details
      document.getElementById('originalProtocol').value = doc.protocol_number_input;
      document.getElementById('docUnit').value = doc.unit || '';

      // Render recipients
      this.renderRecipients(doc.recipients || []);
      document.getElementById('docComments').value = doc.comments || '';

      // Set today as default protocol date
      document.getElementById('protocolDate').value = new Date().toISOString().split('T')[0];
      super.show();
    } catch (error) {
      console.error('Show modal error:', error);
      alert(error.message || 'Failed to show correction modal');
    }
  }

  async generateOrthiEpanalipsi() {
    try {
      if (!this.currentDocumentId) throw new Error('No document selected');

      const comments = document.getElementById('orthiComments')?.value?.trim();

      if (!comments) {
        this.showError('Please provide correction reason');
        return;
      }

      const token = await getAuthToken();
      if (!token) throw new Error('Authentication required');

      // Calculate total amount from recipients
      const totalAmount = this.originalDoc.recipients?.reduce((sum, recipient) => {
        return sum + (parseFloat(recipient.amount) || 0);
      }, 0) || 0;

      // Get updated values from form
      const updatedDoc = {
        ...this.originalDoc,
        recipients: this.originalDoc.recipients.map(recipient => ({
          ...recipient,
          amount: parseFloat(recipient.amount) || 0
        })),
        unit: document.getElementById('docUnit').value,
        project_na853: document.getElementById('docNA853').value,
        comments,
        original_protocol_number: this.originalDoc.protocol_number_input,
        original_protocol_date: this.originalDoc.protocol_date,
        status: 'pending'
      };

      const response = await fetch(`/api/documents/generated/${this.currentDocumentId}/orthi-epanalipsi`, {
        mode: 'cors',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedDoc)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to generate correction' }));
        throw new Error(error.message || 'Failed to generate correction');
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
        const error = await response.json().catch(() => ({ message: 'Invalid response format' }));
        throw new Error(error.message || 'Invalid response format');
      }

      await this.handleDocumentDownload(response);
      this.hide();
      await this.mainManager.uiManager.loadDocuments();
      this.showSuccess('Correction generated successfully');
    } catch (error) {
      console.error('Correction generation error:', error);
      this.showError(error.message || 'Failed to generate correction');
    }
  }

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }

  showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-lg';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 5000);
  }

  async handleDocumentDownload(response) {
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orthi-epanalipsi-${this.currentDocumentId}.docx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  renderRecipients(recipients) {
    const container = this.modal.querySelector('.recipients-list');
    container.innerHTML = `
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-2 py-2 text-left text-xs font-medium text-gray-500">#</th>
            <th class="px-2 py-2 text-left text-xs font-medium text-gray-500">Όνομα</th>
            <th class="px-2 py-2 text-left text-xs font-medium text-gray-500">Επίθετο</th>
            <th class="px-2 py-2 text-left text-xs font-medium text-gray-500">AFM</th>
            <th class="px-2 py-2 text-left text-xs font-medium text-gray-500">Ποσό</th>
            <th class="px-2 py-2 text-left text-xs font-medium text-gray-500">Δόσεις</th>
            <th class="w-8"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          ${recipients.map((recipient, index) => `
            <tr class="hover:bg-gray-50">
              <td class="px-2 py-1 text-sm">${index + 1}</td>
              <td class="px-2 py-1">
                <input type="text" 
                       value="${recipient.firstname || ''}"
                       placeholder="Όνομα"
                       class="recipient-input w-full h-8 px-2 border rounded text-sm"
                       data-index="${index}"
                       data-field="firstname">
              </td>
              <td class="px-2 py-1">
                <input type="text"
                       value="${recipient.lastname || ''}"
                       placeholder="Επίθετο"
                       class="recipient-input w-full h-8 px-2 border rounded text-sm"
                       data-index="${index}"
                       data-field="lastname">
              </td>
              <td class="px-2 py-1">
                <input type="text"
                       value="${recipient.afm || ''}"
                       placeholder="AFM"
                       class="recipient-input w-full h-8 px-2 border rounded text-sm font-mono"
                       data-index="${index}"
                       data-field="afm"
                       maxlength="9">
              </td>
              <td class="px-2 py-1">
                <input type="number"
                       value="${recipient.amount || ''}"
                       placeholder="0.00"
                       class="recipient-input w-full h-8 px-2 border rounded text-sm"
                       data-index="${index}"
                       data-field="amount"
                       step="0.01">
              </td>
              <td class="px-2 py-1">
                <input type="number"
                       value="${recipient.installment || 1}"
                       placeholder="1"
                       class="recipient-input w-32 h-8 px-2 border rounded text-sm text-center"
                       data-index="${index}"
                       data-field="installment"
                       min="1">
              </td>
              <td class="px-2 py-1">
                <button onclick="docManager.orthiManager.removeRecipient(${index})"
                        class="text-red-400 hover:text-red-600 p-1"
                        title="Remove Recipient">
                  <i class="fas fa-times"></i>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // Add event listeners for recipient inputs
    container.querySelectorAll('.recipient-input').forEach(input => {
      input.addEventListener('change', (e) => this.handleRecipientChange(e));
    });
  }

  addRecipient() {
    const recipients = this.originalDoc.recipients || [];
    recipients.push({
      firstname: '',
      lastname: '',
      afm: '',
      amount: '',
      installment: 1
    });
    this.originalDoc.recipients = recipients;
    this.renderRecipients(recipients);
  }

  removeRecipient(index) {
    const recipients = this.originalDoc.recipients || [];
    recipients.splice(index, 1);
    this.originalDoc.recipients = recipients;
    this.renderRecipients(recipients);
  }

  handleRecipientChange(event) {
    const input = event.target;
    const index = parseInt(input.dataset.index);
    const field = input.dataset.field;
    let value = input.value;

    if (field === 'amount') {
      value = parseFloat(value) || 0;
    } else if (field === 'installment') {
      value = parseInt(value) || 1;
    }

    this.originalDoc.recipients[index][field] = value;
  }

  hide() {
    super.hide();
    this.currentDocumentId = null;
    const commentsInput = document.getElementById('orthiComments');
    if (commentsInput) commentsInput.value = '';
  }
}