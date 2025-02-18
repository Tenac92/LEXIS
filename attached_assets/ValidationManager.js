
export class ValidationManager {
  constructor(modal) {
    this.modal = modal;
    this.MAX_NAME_LENGTH = 50;
    this.MIN_NAME_LENGTH = 2;
    this.AFM_LENGTH = 9;
    this.MAX_AMOUNT = 1000000000; // 1 billion
    this.MAX_INSTALLMENTS = 12;
  }

  validateUnitStep(unit) {
    if (!unit?.toString().trim()) {
      return { valid: false, message: "Παρακαλώ επιλέξτε μονάδα" };
    }
    return { valid: true };
  }

  validateProjectStep(project, expenditureType) {
    const errors = [];
    if (!project?.toString().trim()) {
      errors.push("Παρακαλώ επιλέξτε έργο");
    }
    if (!expenditureType?.toString().trim()) {
      errors.push("Παρακαλώ επιλέξτε τύπο δαπάνης");
    }
    
    return errors.length ? 
      { valid: false, message: errors.join(", ") } : 
      { valid: true };
  }

  sanitizeString(str) {
    return str?.toString().trim().replace(/[^\p{L}\p{N}\s-]/gu, '');
  }

  sanitizeNumber(num) {
    const parsed = parseFloat(num);
    return isNaN(parsed) ? 0 : parsed;
  }

  validateRecipient(recipient) {
    if (!recipient || typeof recipient !== 'object') {
      return { valid: false, message: "Μη έγκυρα δεδομένα παραλήπτη" };
    }

    const errors = [];
    
    // Enhanced normalization with strict validation
    const normalizedRecipient = {
      firstname: recipient.firstname ? String(recipient.firstname).trim().replace(/[^\p{L}\s-]/gu, '') : '',
      lastname: String(recipient.lastname || '').trim().replace(/[^\p{L}\s-]/gu, ''),
      afm: String(recipient.afm || '').replace(/\D/g, ''),
      amount: this.sanitizeNumber(recipient.amount),
      installment: Math.floor(Math.max(1, parseInt(recipient.installment) || 1))
    };

    // Validate each field and collect all errors
    if (!normalizedRecipient.firstname) {
      errors.push("Το όνομα είναι υποχρεωτικό");
    }
    if (!normalizedRecipient.lastname) {
      errors.push("Το επώνυμο είναι υποχρεωτικό"); 
    }

    // Name validations
    if (!normalizedRecipient.firstname) {
      return { valid: false, message: "Το όνομα είναι υποχρεωτικό" };
    }
    if (!normalizedRecipient.lastname) {
      return { valid: false, message: "Το επώνυμο είναι υποχρεωτικό" };
    }
    if (normalizedRecipient.firstname.length < this.MIN_NAME_LENGTH) {
      return { valid: false, message: `Το όνομα πρέπει να έχει τουλάχιστον ${this.MIN_NAME_LENGTH} χαρακτήρες` };
    }
    if (normalizedRecipient.lastname.length < this.MIN_NAME_LENGTH) {
      return { valid: false, message: `Το επώνυμο πρέπει να έχει τουλάχιστον ${this.MIN_NAME_LENGTH} χαρακτήρες` };
    }
    if (normalizedRecipient.firstname.length > this.MAX_NAME_LENGTH) {
      return { valid: false, message: `Το όνομα δεν μπορεί να υπερβαίνει τους ${this.MAX_NAME_LENGTH} χαρακτήρες` };
    }
    if (normalizedRecipient.lastname.length > this.MAX_NAME_LENGTH) {
      return { valid: false, message: `Το επώνυμο δεν μπορεί να υπερβαίνει τους ${this.MAX_NAME_LENGTH} χαρακτήρες` };
    }

    // AFM validation
    if (!this.validateAFM(normalizedRecipient.afm)) {
      return { valid: false, message: `Το ΑΦΜ πρέπει να έχει ${this.AFM_LENGTH} ψηφία` };
    }

    // Amount validation
    if (normalizedRecipient.amount <= 0) {
      return { valid: false, message: "Το ποσό πρέπει να είναι μεγαλύτερο από 0" };
    }
    if (normalizedRecipient.amount > this.MAX_AMOUNT) {
      return { valid: false, message: `Το ποσό δεν μπορεί να υπερβαίνει τα ${this.MAX_AMOUNT.toLocaleString('el-GR')}€` };
    }

    // Installment validation
    if (normalizedRecipient.installment < 1) {
      return { valid: false, message: "Ο αριθμός δόσεων πρέπει να είναι τουλάχιστον 1" };
    }
    if (normalizedRecipient.installment > this.MAX_INSTALLMENTS) {
      return { valid: false, message: `Ο μέγιστος αριθμός δόσεων είναι ${this.MAX_INSTALLMENTS}` };
    }

    return { 
      valid: true,
      normalizedData: normalizedRecipient 
    };
  }

  validateAFM(afm) {
    if (!afm) return false;
    const cleanAFM = afm.toString().replace(/\D/g, '');
    return cleanAFM.length === this.AFM_LENGTH && /^\d{9}$/.test(cleanAFM);
  }

  validateFormData(formData) {
    const errors = [];

    try {
      if (!formData.unit?.toString().trim()) {
        errors.push("Η μονάδα είναι υποχρεωτική");
      }
      if (!formData.project_id?.toString().trim()) {
        errors.push("Το έργο είναι υποχρεωτικό");
      }
      if (!formData.expenditure_type?.toString().trim()) {
        errors.push("Ο τύπος δαπάνης είναι υποχρεωτικός");
      }
      if (!Array.isArray(formData.recipients) || formData.recipients.length === 0) {
        errors.push("Απαιτείται τουλάχιστον ένας παραλήπτης");
      } else if (formData.recipients.length > 10) {
        errors.push("Ο μέγιστος αριθμός παραληπτών είναι 10");
      }

      // Validate total amount across all recipients
      const totalAmount = formData.recipients?.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0) || 0;
      if (totalAmount > this.MAX_AMOUNT) {
        errors.push(`Το συνολικό ποσό δεν μπορεί να υπερβαίνει τα ${this.MAX_AMOUNT.toLocaleString('el-GR')}€`);
      }

      if (errors.length) {
        throw new Error(errors.join(", "));
      }
      return true;
    } catch (error) {
      throw new Error(error.message || "Σφάλμα επικύρωσης φόρμας");
    }
  }
}
