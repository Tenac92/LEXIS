import { supabase } from '../config/db';
import type { DocumentVersion, GeneratedDocument } from '@shared/schema';

interface VersionMetadata {
  reason?: string;
  notes?: string;
  changes_summary?: string[];
}

export class VersionController {
  static async createVersion(
    documentId: number,
    recipients: any[],
    userId: string,
    metadata?: VersionMetadata
  ): Promise<DocumentVersion> {
    try {
      // Get the current version number for this document
      const { data: versions } = await supabase
        .from('document_versions')
        .select('version_number')
        .eq('document_id', documentId)
        .order('version_number', { ascending: false })
        .limit(1);

      const nextVersionNumber = versions?.length ? versions[0].version_number + 1 : 1;

      // Get the previous version for comparison
      const { data: prevVersion } = await supabase
        .from('document_versions')
        .select('recipients')
        .eq('document_id', documentId)
        .eq('is_current', true)
        .single();

      // Calculate changes from previous version
      const changes = this.calculateChanges(
        prevVersion?.recipients || [],
        recipients
      );

      // Create new version
      const { data: newVersion, error } = await supabase
        .from('document_versions')
        .insert({
          document_id: documentId,
          version_number: nextVersionNumber,
          created_by: userId,
          changes,
          recipients,
          metadata,
          is_current: true
        })
        .select()
        .single();

      if (error) throw error;

      // Update previous version to not be current
      if (prevVersion) {
        await supabase
          .from('document_versions')
          .update({ is_current: false })
          .eq('document_id', documentId)
          .neq('id', newVersion.id);
      }

      // Update document's current version
      await supabase
        .from('generated_documents')
        .update({ current_version: newVersion.id })
        .eq('id', documentId);

      return newVersion;
    } catch (error) {
      console.error('Error creating version:', error);
      throw new Error('Failed to create version');
    }
  }

  static async getVersionHistory(documentId: number): Promise<DocumentVersion[]> {
    const { data, error } = await supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getVersion(versionId: number): Promise<DocumentVersion> {
    const { data, error } = await supabase
      .from('document_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Version not found');

    return data;
  }

  private static calculateChanges(oldRecipients: any[], newRecipients: any[]): any {
    const changes = {
      added: [] as any[],
      removed: [] as any[],
      modified: [] as any[]
    };

    // Create maps for efficient lookup
    const oldMap = new Map(oldRecipients.map(r => [r.afm, r]));
    const newMap = new Map(newRecipients.map(r => [r.afm, r]));

    // Find added and modified recipients
    for (const [afm, newRecipient] of newMap) {
      const oldRecipient = oldMap.get(afm);
      if (!oldRecipient) {
        changes.added.push(newRecipient);
      } else if (this.recipientChanged(oldRecipient, newRecipient)) {
        changes.modified.push({
          old: oldRecipient,
          new: newRecipient,
          changes: this.getRecipientChanges(oldRecipient, newRecipient)
        });
      }
    }

    // Find removed recipients
    for (const [afm, oldRecipient] of oldMap) {
      if (!newMap.has(afm)) {
        changes.removed.push(oldRecipient);
      }
    }

    return changes;
  }

  private static recipientChanged(oldRecipient: any, newRecipient: any): boolean {
    const keys = ['firstname', 'lastname', 'amount', 'installment'];
    return keys.some(key => oldRecipient[key] !== newRecipient[key]);
  }

  private static getRecipientChanges(oldRecipient: any, newRecipient: any): any {
    const changes: Record<string, { old: any; new: any }> = {};
    const keys = ['firstname', 'lastname', 'amount', 'installment'];

    for (const key of keys) {
      if (oldRecipient[key] !== newRecipient[key]) {
        changes[key] = {
          old: oldRecipient[key],
          new: newRecipient[key]
        };
      }
    }

    return changes;
  }

  static async revertToVersion(
    documentId: number,
    versionId: number,
    userId: string
  ): Promise<DocumentVersion> {
    const version = await this.getVersion(versionId);
    
    // Create a new version based on the reverted data
    return this.createVersion(
      documentId,
      version.recipients,
      userId,
      {
        reason: 'Revert to previous version',
        notes: `Reverted to version ${version.version_number}`,
        changes_summary: [`Reverted document to version ${version.version_number}`]
      }
    );
  }
}
