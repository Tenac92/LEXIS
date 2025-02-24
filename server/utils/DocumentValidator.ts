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
