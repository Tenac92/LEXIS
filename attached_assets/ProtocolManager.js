import { getAuthToken } from '../../utils/auth.js';
import { BaseModal } from './BaseModal.js';

export class ProtocolManager extends BaseModal {
  constructor(mainManager) {
    super('protocolModal');
    this.mainManager = mainManager;
    this.currentDocumentId = null;
    this.initialize();
  }

  async initialize() {
    if (!await super.initialize()) return false;

    const modalContent = `
      <div class="flex items-center justify-center min-h-screen p-4">
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div class="p-6">
            <h2 class="text-xl font-semibold mb-4">Add Protocol Number</h2>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Protocol Number</label>
                <input type="text" id="protocolInput" class="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Protocol Date</label>
                <input type="date" id="protocolDate" class="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500">
              </div>
            </div>
            <div class="mt-6 flex justify-end gap-3">
              <button onclick="docManager.protocolManager.hide()" 
                      class="px-4 py-2 text-gray-600 hover:text-gray-800">
                Cancel
              </button>
              <button onclick="docManager.protocolManager.saveProtocol()"
                      class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.modal.innerHTML = modalContent;
    this.protocolInput = document.getElementById('protocolInput');
    this.protocolDate = document.getElementById('protocolDate');
    return true;
  }

  async showModal(documentId) {
    try {
      if (!documentId) {
        console.error('No document ID provided');
        return;
      }

      await this.initialize();
      this.currentDocumentId = documentId;
      const token = await getAuthToken();

      const response = await fetch(`/api/documents/generated/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch document data');
      const doc = await response.json();

      // Wait for DOM elements to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      this.protocolInput = document.getElementById('protocolInput');
      this.protocolDate = document.getElementById('protocolDate');

      if (this.protocolInput) this.protocolInput.value = doc.protocol_number || '';
      if (this.protocolDate) this.protocolDate.value = doc.protocol_date ? doc.protocol_date.split('T')[0] : new Date().toISOString().split('T')[0];

      await super.show();
    } catch (error) {
      console.error('Error loading protocol data:', error);
      alert('Failed to load protocol data');
    }
  }

  async saveProtocol() {
    try {
      if (!this.currentDocumentId) {
        throw new Error('No document selected');
      }

      const protocolNumber = this.protocolInput?.value.trim();
      const protocolDate = this.protocolDate?.value;

      if (!protocolNumber || !protocolDate) {
        throw new Error('Protocol number and date are required');
      }

      const token = await getAuthToken();
      if (!token) throw new Error('Authentication required');

      const response = await fetch(`/api/documents/generated/${this.currentDocumentId}/protocol`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          protocol_number: protocolNumber,
          protocol_date: protocolDate
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update protocol');
      }

      this.hide();
      await this.mainManager.uiManager.loadDocuments();
    } catch (error) {
      console.error('Protocol save error:', error);
      alert(error.message || 'Failed to save protocol');
    }
  }
}