
import { API } from '../../utils/api.js';
import { ErrorHandler } from '../../utils/errorHandler.js';

export class BulkUpdateManager {
  constructor() {
    this.projects = [];
  }

  async updateMultipleProjects(updates) {
    try {
      const response = await fetch('/api/catalog/bulk-update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates })
      });
      
      if (!response.ok) {
        throw new Error('Bulk update failed');
      }
      
      return await response.json();
    } catch (error) {
      ErrorHandler.handleError(error);
      throw error;
    }
  }
}
