import { supabase } from '../config/db';
import type { DocumentVersion, GeneratedDocument } from '@shared/schema';
import { z } from 'zod';

const versionMetadataSchema = z.object({
  reason: z.string().optional(),
  notes: z.string().optional(),
  changes_summary: z.array(z.string()).optional()
});

type VersionMetadata = z.infer<typeof versionMetadataSchema>;

interface RecipientChanges {
  added: any[];
  removed: any[];
  modified: Array<{
    old: any;
    new: any;
    changes: Record<string, { old: any; new: any }>;
  }>;
}

export class VersionController {
  static async createVersion(
    documentId: number,
    recipients: any[],
    userId: number,
    metadata?: VersionMetadata
  ): Promise<DocumentVersion> {
    try {
      // Validate metadata if provided
      if (metadata) {
        versionMetadataSchema.parse(metadata);
      }

      // Get the current version number for this document
      const { data: versions, error: versionError } = await supabase
        .from('document_versions')
        .select('version_number')
        .eq('document_id', documentId)
        .order('version_number', { ascending: false })
        .limit(1);

      if (versionError) throw versionError;

      const nextVersionNumber = versions?.length ? versions[0].version_number + 1 : 1;

      // Get the previous version for comparison
      const { data: prevVersion, error: prevVersionError } = await supabase
        .from('document_versions')
        .select('recipients')
        .eq('document_id', documentId)
        .eq('is_current', true)
        .single();

      if (prevVersionError && prevVersionError.code !== 'PGRST116') {
        throw prevVersionError;
      }

      // Calculate changes from previous version
      const changes = this.calculateChanges(
        prevVersion?.recipients || [],
        recipients
      );

      // Create new version
      const { data: newVersion, error: insertError } = await supabase
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

      if (insertError) throw insertError;
      if (!newVersion) throw new Error('Failed to create version');

      // Update previous version to not be current
      if (prevVersion) {
        const { error: updateError } = await supabase
          .from('document_versions')
          .update({ is_current: false })
          .eq('document_id', documentId)
          .neq('id', newVersion.id);

        if (updateError) throw updateError;
      }

      // Update document's current version
      const { error: docUpdateError } = await supabase
        .from('generated_documents')
        .update({ current_version: newVersion.id })
        .eq('id', documentId);

      if (docUpdateError) throw docUpdateError;

      return newVersion;
    } catch (error) {
      console.error('Error creating version:', error);
      throw error instanceof Error 
        ? error 
        : new Error('Failed to create version');
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

  private static calculateChanges(oldRecipients: any[], newRecipients: any[]): RecipientChanges {
    const changes: RecipientChanges = {
      added: [],
      removed: [],
      modified: []
    };

    // Create maps for efficient lookup
    const oldMap = new Map();
    const newMap = new Map();

    oldRecipients.forEach(r => oldMap.set(r.afm, r));
    newRecipients.forEach(r => newMap.set(r.afm, r));

    // Find added and modified recipients
    newRecipients.forEach(newRecipient => {
      const oldRecipient = oldMap.get(newRecipient.afm);
      if (!oldRecipient) {
        changes.added.push(newRecipient);
      } else if (this.recipientChanged(oldRecipient, newRecipient)) {
        changes.modified.push({
          old: oldRecipient,
          new: newRecipient,
          changes: this.getRecipientChanges(oldRecipient, newRecipient)
        });
      }
    });

    // Find removed recipients
    oldRecipients.forEach(oldRecipient => {
      if (!newMap.has(oldRecipient.afm)) {
        changes.removed.push(oldRecipient);
      }
    });

    return changes;
  }

  private static recipientChanged(oldRecipient: any, newRecipient: any): boolean {
    const keys = ['firstname', 'lastname', 'amount', 'installment'];
    return keys.some(key => oldRecipient[key] !== newRecipient[key]);
  }

  private static getRecipientChanges(oldRecipient: any, newRecipient: any): Record<string, { old: any; new: any }> {
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
    userId: number
  ): Promise<DocumentVersion> {
    const version = await this.getVersion(versionId);

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