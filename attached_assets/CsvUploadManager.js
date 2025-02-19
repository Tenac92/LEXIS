
import { ErrorHandler } from '../../utils/errorHandler.js';
import { getAuthToken } from '../../utils/auth.js';

export class CsvUploadManager {
  constructor() {
    this.uploadUrl = '/api/budget/csv-upload';
    this.maxFileSize = 50 * 1024 * 1024; // 50MB
    this.allowedTypes = ['text/csv', 'application/csv', 'application/vnd.ms-excel'];
    this.encodings = ['UTF-8', 'UTF-16LE', 'windows-1253', 'ISO-8859-7'];
  }

  validateFile(file) {
    if (!file) {
      throw new Error('No file selected');
    }

    if (!file.name?.toLowerCase().endsWith('.csv')) {
      throw new Error('Invalid file type. Please select a CSV file');
    }

    if (!file.size || file.size === 0) {
      throw new Error('File is empty');
    }

    if (file.size > this.maxFileSize) {
      throw new Error(`File size exceeds ${this.maxFileSize / (1024 * 1024)}MB limit`);
    }

    return true;
  }

  async handleFileUpload(file) {
    try {
      this.validateFile(file);
      const token = await getAuthToken();
      if (!token) throw new Error('Authentication required');

      const formData = new FormData();
      
      // Read file as text first to validate content
      const fileText = await file.text();
      if (!fileText.trim()) {
        throw new Error('File is empty');
      }

      // Create new file blob with validated content
      const blob = new Blob([fileText], { type: 'text/csv' });
      formData.append('file', blob, file.name);

      const response = await fetch(this.uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
        credentials: 'include'
      });

      const responseText = await response.text();
      let data;
      
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response:', e);
        throw new Error('Invalid server response format');
      }

      if (!response.ok) {
        throw new Error(data.message || `Upload failed: ${response.status} - ${data.error || 'Unknown error'}`);
      }

      if (data.progress) {
        ErrorHandler.showSuccess(`Processing: ${data.progress[data.progress.length-1].progress}`);
      }

      ErrorHandler.showSuccess(`Upload complete: ${data.stats?.updated || 0} records processed`);
      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('CSV Upload Error:', error);
      ErrorHandler.showError(error.message || 'Failed to upload file');
      return {
        success: false,
        error: error.message
      };
    }
  }
}
