import { z } from 'zod';

export class DocumentValidator {
  static validateRecipient(recipient: any) {
    const errors: string[] = [];

    if (!recipient.firstname?.trim()) errors.push('First name is required');
    if (!recipient.lastname?.trim()) errors.push('Last name is required');
    if (!recipient.afm?.trim() || !/^\d{9}$/.test(recipient.afm)) {
      errors.push('Valid 9-digit AFM is required');
    }
    if (!recipient.amount || isNaN(recipient.amount) || recipient.amount <= 0) {
      errors.push('Valid positive amount is required');
    }
    if (!recipient.installment || isNaN(recipient.installment) || recipient.installment < 1) {
      errors.push('Valid installment number is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateAttachment(attachment: any) {
    const errors: string[] = [];
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];

    if (!attachment.file) errors.push('File is required');
    if (!allowedTypes.includes(attachment.file?.type)) {
      errors.push('Invalid file type');
    }
    if (attachment.file?.size > 5 * 1024 * 1024) {
      errors.push('File size exceeds 5MB limit');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
import { z } from 'zod';

export class DocumentValidator {
  static validateRecipients(recipients: any[]) {
    if (!Array.isArray(recipients)) {
      throw new Error('Recipients must be an array');
    }
    
    if (recipients.length === 0) {
      throw new Error('At least one recipient is required');
    }
    
    if (recipients.length > 10) {
      throw new Error('Maximum 10 recipients allowed');
    }
    
    const recipientSchema = z.object({
      firstname: z.string().min(2, "First name must be at least 2 characters"),
      lastname: z.string().min(2, "Last name must be at least 2 characters"),
      afm: z.string().length(9, "AFM must be exactly 9 digits").regex(/^\d+$/, "AFM must contain only numbers"),
      amount: z.number().min(0.01, "Amount must be greater than 0"),
      installment: z.number().int().min(1).max(12, "Installment must be between 1 and 12")
    });
    
    // Validate each recipient
    recipients.forEach((recipient, index) => {
      try {
        recipientSchema.parse(recipient);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const issues = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
          throw new Error(`Invalid recipient at position ${index + 1}: ${issues}`);
        }
        throw error;
      }
    });
    
    return true;
  }
}
