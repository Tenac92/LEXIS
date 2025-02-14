
import { API } from './api.js';

export class AuditLogger {
  static async log(actionType, entityType, entityId, details = {}) {
    try {
      await API.request('/api/audit/log', {
        method: 'POST',
        body: JSON.stringify({
          action_type: actionType,
          entity_type: entityType,
          entity_id: entityId,
          details
        })
      });
    } catch (err) {
      console.error('Audit logging failed:', err);
    }
  }
}
