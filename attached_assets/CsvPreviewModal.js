
export class CsvPreviewModal {
  constructor() {
    this.modal = null;
    this.selectedRows = new Set();
  }

  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center';
    this.modal.innerHTML = `
      <div class="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 p-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold">CSV Preview</h3>
          <button class="text-gray-600 hover:text-gray-800" id="closePreviewModal">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="overflow-x-auto max-h-[60vh]">
          <table class="min-w-full table-auto" id="previewTable">
            <thead class="bg-gray-100">
            </thead>
            <tbody>
            </tbody>
          </table>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300" id="cancelPreview">
            Cancel
          </button>
          <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" id="confirmPreview">
            Proceed with Selected
          </button>
        </div>
      </div>
    `;
  }

  async showPreview(data, headers) {
    this.createModal();
    document.body.appendChild(this.modal);

    const thead = this.modal.querySelector('thead');
    const tbody = this.modal.querySelector('tbody');

    // Create header row
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `
      <th class="px-4 py-2">
        <input type="checkbox" id="selectAll" class="form-checkbox rounded">
      </th>
      ${headers.map(header => `
        <th class="px-4 py-2 text-left">${header}</th>
      `).join('')}
    `;
    thead.appendChild(headerRow);

    // Create data rows
    data.forEach((row, index) => {
      const tr = document.createElement('tr');
      tr.className = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
      tr.innerHTML = `
        <td class="px-4 py-2">
          <input type="checkbox" data-row="${index}" class="form-checkbox rounded row-checkbox" checked>
        </td>
        ${headers.map(header => `
          <td class="px-4 py-2">${row[header] || ''}</td>
        `).join('')}
      `;
      tbody.appendChild(tr);
      this.selectedRows.add(index);
    });

    return new Promise((resolve) => {
      const cleanup = () => {
        this.modal.removeEventListener('change', handleChange);
        selectAll.removeEventListener('change', handleSelectAll);
      };
      
      const selectAll = this.modal.querySelector('#selectAll');
      selectAll.checked = true;
      
      selectAll.addEventListener('change', (e) => {
        const checkboxes = this.modal.querySelectorAll('.row-checkbox');
        checkboxes.forEach(checkbox => {
          checkbox.checked = e.target.checked;
          const rowIndex = parseInt(checkbox.dataset.row);
          if (e.target.checked) {
            this.selectedRows.add(rowIndex);
          } else {
            this.selectedRows.delete(rowIndex);
          }
        });
      });

      this.modal.addEventListener('change', (e) => {
        if (e.target.classList.contains('row-checkbox')) {
          const rowIndex = parseInt(e.target.dataset.row);
          if (e.target.checked) {
            this.selectedRows.add(rowIndex);
          } else {
            this.selectedRows.delete(rowIndex);
          }
        }
      });

      this.modal.querySelector('#closePreviewModal').addEventListener('click', () => {
        this.close();
        resolve(null);
      });

      this.modal.querySelector('#cancelPreview').addEventListener('click', () => {
        this.close();
        resolve(null);
      });

      this.modal.querySelector('#confirmPreview').addEventListener('click', () => {
        const selectedData = Array.from(this.selectedRows)
          .map(index => data[index]);
        this.close();
        resolve(selectedData);
      });
    });
  }

  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
      this.selectedRows.clear();
    }
  }
}
