import { API } from "../../utils/api.js";
import { getAuthToken, getUserFromToken } from "../../utils/auth.js";
import { BaseModal } from "./BaseModal.js";
import { ErrorHandler } from "../../utils/errorHandler.js";
import { BudgetManager } from "./BudgetManager.js";
import { ValidationManager } from "./ValidationManager.js";

export class CreateDocumentModal extends BaseModal {
  constructor(mainManager) {
    super("createDocumentModal");
    this.manager = mainManager;
    this.currentStep = 0;
    this.initialized = false;
    this.state = this.getInitialState();
    this.debounceTimeout = null;
    this.budgetManager = new BudgetManager();
    this.validationManager = new ValidationManager(this.modal);
    this.stepTitles = ['Επιλογή Μονάδας', 'Στοιχεία Έργου', 'Στοιχεία Παραληπτών', 'Συνημμένα'];
    this.eventHandlers = new Map();
  }

  getInitialState() {
    return {
      unit: "",
      project: "",
      project_na853: "",
      expenditure_type: "",
      recipients: [],
      attachments: [],
      loading: false,
      validationErrors: [],
      selectedFiles: new Map(),
      selectedMIS: "",
      budgetAmount: 0,
      ethsiaPistosi: 0,
      allowDocx: true,
      projectStatus: "active",
      budgetDataLoaded: false,
      budgetData: null,
      hasUnsavedChanges: false
    };
  }

  async initialize() {
    try {
      if (this.initialized) return true;

      if (!(await super.initialize())) {
        throw new Error("Failed to initialize base modal");
      }

      await this.budgetManager.initialize(this.modal);
      this.setTitle("Δημιουργία Νέου Εγγράφου");
      await this.renderCurrentStep();
      this.setupEventHandlers();
      this.setupKeyboardShortcuts();

      window.addEventListener('beforeunload', (e) => {
        if (this.state.hasUnsavedChanges) {
          e.preventDefault();
          e.returnValue = '';
        }
      });

      this.initialized = true;
      return true;
    } catch (error) {
      console.error("Initialization failed:", error);
      ErrorHandler.showError(error.message);
      return false;
    }
  }

  setupEventHandlers() {
    this.modal?.addEventListener('click', this.handleModalClick.bind(this));
    this.modal?.addEventListener('input', this.handleModalInput.bind(this));
    this.modal?.addEventListener('change', this.handleModalChange.bind(this));

    // Add direct event listener for add recipient button
    const addRecipientBtn = this.modal?.querySelector('#addRecipientBtn');
    if (addRecipientBtn) {
      addRecipientBtn.addEventListener('click', () => this.addRecipient());
    }
  }

  handleModalClick(e) {
    const target = e.target;
    const deleteBtn = target.closest('.delete-recipient');

    if (target.closest('#addRecipientBtn')) {
      this.addRecipient();
    } else if (deleteBtn) {
      const index = parseInt(deleteBtn.dataset.index);
      if (!isNaN(index)) this.removeRecipient(index);
    } else if (target.matches('.prev-step')) {
      this.previousStep();
    } else if (target.matches('.next-step')) {
      this.nextStep();
    }
  }

  handleModalInput(e) {
    const target = e.target;

    if (target.matches('.recipient-input')) {
      this.handleRecipientInput(target);
    }
  }

  handleModalChange(e) {
    const target = e.target;

    if (target.matches('#projectSelect')) {
      this.handleProjectChange(target.value);
    } else if (target.matches('#expenditureType')) {
      this.handleExpenditureTypeChange(target.value);
    } else if (target.matches('.attachment-input')) {
      this.handleAttachmentChange(e);
    }
  }

  async handleProjectChange(value) {
    this.state.project = value;
    this.state.selectedMIS = value;
    this.state.hasUnsavedChanges = true;

    try {
      await this.loadExpenditureTypes(value);
      if (value) {
        await this.loadBudgetData();
      }
    } catch (error) {
      ErrorHandler.showError('Failed to load project data');
    }
  }

  handleExpenditureTypeChange(value) {
    this.state.expenditure_type = value;
    this.state.hasUnsavedChanges = true;
  }

  handleRecipientInput(input) {
    const { field, index } = input.dataset;
    if (!field || !index) return;

    clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(() => {
      const idx = parseInt(index);
      if (isNaN(idx)) return;

      let value = input.value;
      const recipient = this.getOrCreateRecipient(idx);

      // Only trim for non-empty values to properly detect empty fields
      if (value) {
        value = value.trim();
      }

      this.updateRecipientField(recipient, field, value, input);
      this.state.hasUnsavedChanges = true;

      if (field === 'amount') {
        this.updateTotalAmount();
      }
    }, 300);
  }

  getOrCreateRecipient(index) {
    if (!this.state.recipients[index]) {
      this.state.recipients[index] = {
        firstname: '',
        lastname: '',
        afm: '',
        amount: 0,
        installment: 1
      };
    }
    return this.state.recipients[index];
  }

  updateRecipientField(recipient, field, value, input) {
    switch(field) {
      case 'firstname':
        const cleanFirstname = value ? value.trim().replace(/[^\p{L}\s-]/gu, '') : '';
        recipient.firstname = cleanFirstname;
        input.value = cleanFirstname;
        this.validateField(input, cleanFirstname.length >= 2, "Το όνομα πρέπει να έχει τουλάχιστον 2 χαρακτήρες");
        break;
      case 'amount':
        const parsedAmount = this.parseAmount(value);
        recipient.amount = parsedAmount;
        input.value = parsedAmount || '';

        // Validate amount immediately
        const amountValid = parsedAmount > 0;
        input.classList.toggle('border-red-500', !amountValid);
        const feedback = input.parentElement.querySelector('.invalid-feedback');
        if (feedback) {
          feedback.classList.toggle('hidden', amountValid);
        }
        break;

      case 'afm':
        // Only allow digits and limit to 9 characters
        const cleanAfm = value.replace(/[^\d]/g, '').slice(0, 9);
        recipient.afm = cleanAfm;
        input.value = cleanAfm; // Update input value immediately

        // Validate AFM length
        const afmValid = cleanAfm.length === 9;
        input.classList.toggle('border-red-500', !afmValid);
        const afmFeedback = input.parentElement.querySelector('.invalid-feedback');
        if (afmFeedback) {
          afmFeedback.classList.toggle('hidden', afmValid);
        }
        break;

      case 'installment':
        const installmentValue = Math.max(1, parseInt(value) || 1);
        recipient.installment = installmentValue;
        input.value = installmentValue;
        break;

      case 'lastname':
        const trimmedLastname = value.trim();
        recipient.lastname = trimmedLastname;
        const lastnameValid = trimmedLastname.length >= 2;
        input.classList.toggle('border-red-500', !lastnameValid);
        const lastnameFeedback = input.parentElement.querySelector('.invalid-feedback');
        if (lastnameFeedback) {
          lastnameFeedback.classList.toggle('hidden', lastnameValid);
        }
        break;

      default:
        recipient[field] = value.trim();
    }

    // Update total amount if needed
    if (field === 'amount') {
      this.updateTotalAmount();
    }
  }

  parseAmount(value) {
    const parsed = parseFloat(value.replace(/[^\d.-]/g, ''));
    return !isNaN(parsed) ? Math.max(0, parsed) : 0;
  }

  updateTotalAmount() {
    const totalAmount = this.calculateTotalAmount();
    if (this.state.budgetData) {
      this.budgetManager.updateBudgetIndicators(totalAmount, this.state.budgetData);
    }
  }

  async loadExpenditureTypes(projectId) {
    try {
      const response = await API.request(`/api/catalog/${projectId}/expenditure-types`);
      const { expenditure_types = [] } = await response.json();

      const expTypeSelect = this.modal?.querySelector("#expTypeSelect");
      if (expTypeSelect) {
        expTypeSelect.innerHTML = `
          <option value="">Select expenditure type...</option>
          ${expenditure_types.map(type => 
            `<option value="${type}">${type}</option>`
          ).join('')}
        `;
      }
    } catch (error) {
      throw new Error('Failed to load expenditure types');
    }
  }

  async loadBudgetData() {
    const budgetData = await this.budgetManager.loadBudgetData(this.state.selectedMIS);
    if (budgetData) {
      this.state.budgetAmount = budgetData.budgetAmount;
      this.state.ethsiaPistosi = budgetData.ethsiaPistosi;
      this.state.budgetData = budgetData.budgetData;
      this.state.budgetDataLoaded = true;

      const totalAmount = this.calculateTotalAmount();
      this.budgetManager.updateBudgetIndicators(totalAmount, this.state.budgetData);
    }
  }

  calculateTotalAmount() {
    return this.state.recipients.reduce((sum, r) => 
      sum + (parseFloat(r.amount) || 0), 0
    );
  }

  async submitForm() {
    if (this.state.loading) return;

    try {
      this.state.loading = true;
      this.updateSubmitButton(true);

      const formData = this.prepareFormData();
      const response = await API.createDocument(formData, this.state.unit);
      await this.handleFormSubmissionSuccess(response);
    } catch (error) {
      ErrorHandler.showError(error.message || "Failed to create document");
    } finally {
      this.state.loading = false;
      this.updateSubmitButton(false);
    }
  }

  prepareFormData() {
    const user = getUserFromToken();
    if (!user?.department) {
      throw new Error("User department not found");
    }

    return {
      unit: this.state.unit,
      project_id: this.state.project,
      expenditure_type: this.state.expenditure_type,
      department: user.department,
      recipients: this.state.recipients.map(r => ({
        firstname: r.firstname?.trim(),
        lastname: r.lastname?.trim(),
        afm: r.afm?.trim(),
        amount: parseFloat(r.amount) || 0,
        installment: parseInt(r.installment) || 1,
        status: "pending"
      })),
      total_amount: this.calculateTotalAmount(),
      status: "pending",
      attachments: Array.from(this.state.selectedFiles.entries())
        .map(([type, file]) => ({
          type,
          file: file.name
        }))
    };
  }

  async handleFormSubmissionSuccess(data) {
    if (!data?.id) throw new Error("Invalid server response");

    await this.updateBudgetAmount();
    this.state.hasUnsavedChanges = false;
    this.hide();
    ErrorHandler.showSuccess("Document created successfully");

    if (this.manager?.loadDocuments) {
      await this.manager.loadDocuments();
    }
  }

  async updateBudgetAmount() {
    const totalAmount = this.calculateTotalAmount();
    await API.request(`/api/budget/${this.state.selectedMIS}/update-amount`, {
      method: "POST",
      body: JSON.stringify({ amount: totalAmount })
    });
  }

  addRecipient() {
    if (this.state.recipients.length >= 10) {
      ErrorHandler.showError("Maximum 10 recipients allowed");
      return;
    }
    const newRecipient = {
      firstname: '',
      lastname: '',
      afm: '',
      amount: '',
      installment: 1
    };
    this.state.recipients.push(newRecipient);
    this.state.hasUnsavedChanges = true;
    this.renderCurrentStep();
  }

  removeRecipient(index) {
    this.state.recipients.splice(index, 1);
    this.state.hasUnsavedChanges = true;
    this.renderCurrentStep();
  }

  handleAttachmentChange(e) {
    const input = e.target;
    const file = input.files[0];
    const type = input.dataset.type;

    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      ErrorHandler.showError("File size exceeds 10MB limit");
      input.value = "";
      return;
    }

    this.state.selectedFiles.set(type, file);
    this.state.hasUnsavedChanges = true;
  }


  async previousStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
      await this.renderCurrentStep();
      this.updateProgress();
    }
  }

  async nextStep() {
    if (this.state.loading) return;

    try {
      if (!(await this.validateCurrentStep())) return;

      if (this.currentStep < 3) {
        this.currentStep++;
        await this.renderCurrentStep();
        this.updateProgress();
      } else {
        await this.submitForm();
      }
    } catch (error) {
      ErrorHandler.showError(error.message);
    }
  }

  async validateCurrentStep() {
    const stepValidations = {
      0: () => this.validationManager.validateUnitStep(this.state.unit),
      1: () => this.validationManager.validateProjectStep(this.state.project, this.state.expenditure_type),
      2: () => this.validateRecipientsStep(),
      3: () => ({ valid: true })
    };

    const validator = stepValidations[this.currentStep];
    if (!validator) throw new Error("Invalid step");

    const result = await validator();
    if (!result.valid) {
      ErrorHandler.showError(result.message);
      return false;
    }
    return true;
  }

  async validateRecipientsStep() {
    if (!Array.isArray(this.state.recipients) || !this.state.recipients.length) {
      return { valid: false, message: "Απαιτείται τουλάχιστον ένας παραλήπτης" };
    }

    try {
        for (const recipient of this.state.recipients) {
            const validation = this.validationManager.validateRecipient(recipient);
            if (!validation.valid) {
                console.log('Validation failed for recipient:', recipient);
                return validation;
            }
        }
    } catch (error) {
        console.error('Error during recipients validation:', error);
        return { valid: false, message: "Σφάλμα επικύρωσης παραλήπτη" };
    }

    const totalAmount = this.calculateTotalAmount();
    const budgetValidation = await this.budgetManager.validateBudgetAmount(totalAmount, this.state.selectedMIS);

    if (!budgetValidation.canCreate) {
      return { valid: false, message: budgetValidation.message || "Budget validation failed" };
    }

    this.state.allowDocx = budgetValidation.allowDocx !== false;
    return { valid: true };
  }

  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (!this.modal?.classList.contains("active")) return;
      if (e.key === "Escape") this.hide();
      if (e.key === "Enter" && e.ctrlKey) this.nextStep();
    });
  }

  async show() {
    try {
      this.currentStep = 0;
      this.state = this.getInitialState();
      if (!(await this.initialize())) throw new Error("Failed to initialize modal");
      await super.show();
      this.updateProgress();
    } catch (error) {
      console.error("Error showing modal:", error);
      ErrorHandler.showError(error.message);
    }
  }

  updateProgress() {
    const progress = ((this.currentStep + 1) / 4) * 100;
    requestAnimationFrame(() => {
      const progressBar = this.modal?.querySelector(".bg-blue-600");
      if (progressBar) {
        progressBar.style.width = `${progress}%`;
      }
    });
  }

  updateSubmitButton(loading) {
    const submitBtn = this.modal?.querySelector(".next-step");
    if (submitBtn) {
      submitBtn.disabled = loading;
      submitBtn.innerHTML = loading
        ? '<i class="fas fa-spinner fa-spin mr-2"></i>Creating...'
        : 'Create<i class="fas fa-arrow-right ml-2"></i>';
    }
  }

  async renderCurrentStep() {
    if (!this.modal) {
      throw new Error("Modal not initialized");
    }

    const steps = [
      this.renderUnitStep.bind(this),
      this.renderProjectStep.bind(this),
      this.renderRecipientsStep.bind(this),
      this.renderAttachmentsStep.bind(this)
    ];

    try {
      // Pre-load budget data if needed
      if (this.currentStep === 2 && !this.state.budgetDataLoaded && this.state.selectedMIS) {
        await this.loadBudgetData();
        this.state.budgetDataLoaded = true;
      }

      const content = await steps[this.currentStep]();
      await this.setContent(await this.wrapStepContent(content));

      // Give DOM time to update before setting up handlers
      await new Promise(resolve => setTimeout(resolve, 100));
      await this.setupStepHandlers();
      this.updateProgress();

      // Update budget indicators if needed
      if (this.currentStep === 2 && this.state.budgetData) {
        await new Promise(resolve => setTimeout(resolve, 0));
        this.budgetManager.updateBudgetIndicators(
          this.calculateTotalAmount(),
          this.state.budgetData
        );
      }
    } catch (error) {
      console.error("Error rendering step:", error);
      ErrorHandler.showError(error.message);
    }
  }

  async wrapStepContent(content) {
    try {
      const response = await fetch('/generated-documents/templates/createDocumentModal.html');
      const template = await response.text();
      const doc = new DOMParser().parseFromString(template, 'text/html');

      // Update components
      const components = {
        '.bg-blue-600': () => `${((this.currentStep + 1) / 4) * 100}%`,
        '#steps-container': () => this.createStepIndicators(),
        '#step-title': () => this.stepTitles[this.currentStep],
        '#step-content': () => content,
        '#prev-button-container': () => this.createPrevButton(),
        '.next-step': (el) => {
          el.textContent = this.currentStep === 3 ? 'Δημιουργία' : 'Επόμενο';
          el.classList.toggle('opacity-50', this.state.loading);
          el.classList.toggle('cursor-not-allowed', this.state.loading);
        }
      };

      for (const [selector, update] of Object.entries(components)) {
        const element = doc.querySelector(selector);
        if (element) {
          const result = update(element);
          if (typeof result === 'string') {
            if (selector.startsWith('.')) {
              element.style.width = result;
            } else {
              element.innerHTML = result;
            }
          }
        }
      }

      return doc.body.innerHTML;
    } catch (error) {
      console.error('Error wrapping step content:', error);
      throw new Error('Failed to wrap step content');
    }
  }

  createPrevButton() {
    return this.currentStep > 0 
      ? `<button class="prev-step px-6 py-3 text-gray-600 hover:text-gray-800 bg-gray-100/80 hover:bg-gray-200/80 rounded-lg transition-all duration-200 flex items-center font-medium shadow-sm hover:shadow backdrop-blur-sm">
          <i class="fas fa-arrow-left mr-2"></i>Προηγούμενο
         </button>`
      : '';
  }

  createStepIndicators() {
    return `
      <div class="flex items-center gap-1 bg-gray-50/50 p-1.5 rounded-lg border border-gray-100/80">
        ${this.stepTitles.map((step, index) => `
          <div class="flex items-center ${index !== 0 ? 'ml-2' : ''} ${index !== this.stepTitles.length - 1 ? 'mr-2' : ''}">
            <div class="relative group">
              <div class="flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-200 ${
                index === this.currentStep 
                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-blue-100" 
                  : index < this.currentStep
                  ? "text-green-600 hover:bg-white/60"
                  : "text-gray-500 hover:bg-white/60"
              }">
                <div class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
                  index === this.currentStep 
                    ? "bg-blue-100/80" 
                    : index < this.currentStep
                    ? "bg-green-100/80"
                    : "bg-gray-100"
                }">
                  ${index < this.currentStep ? '<i class="fas fa-check text-[10px]"></i>' : index + 1}
                </div>
                <span class="text-xs font-medium whitespace-nowrap">${step}</span>
              </div>
            </div>
            ${index !== this.stepTitles.length - 1 
              ? `<div class="ml-1 w-2 h-px bg-gray-200"></div>` 
              : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  // Step-specific rendering functions remain largely unchanged
  async renderUnitStep() {
    try {
      const user = getUserFromToken();
      if (!user) throw new Error("User not authenticated");

      const userUnits = Array.isArray(user.units) ? user.units : [];
      if (!userUnits.length) throw new Error("No units assigned to user");

      if (userUnits.length === 1) {
        this.state.unit = userUnits[0];
      }

      return `
        <div class="space-y-4">
          <label class="block text-sm font-medium text-gray-700">Select Unit</label>
          <select id="unitSelect" class="w-full p-2 border rounded">
            ${userUnits.length > 1 ? '<option value="">Select a unit...</option>' : ""}
            ${userUnits.map(unit => `
              <option value="${unit}" ${unit === this.state.unit ? "selected" : ""}>
                ${unit}
              </option>
            `).join("")}
          </select>
        </div>
      `;
    } catch (error) {
      console.error("Error loading units:", error);
      return '<p class="text-red-600">Failed to load units</p>';
    }
  }

  async renderProjectStep() {
    const unit = this.state.unit;
    if (!unit) {
      return '<p class="text-red-600">Please select a unit first</p>';
    }

    try {
      const token = await getAuthToken();
      const response = await fetch(
        `/api/catalog?unit=${encodeURIComponent(unit)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) throw new Error("Failed to load projects");
      const result = await response.json();
      const projects = result.data || [];

      const selectedProject = projects.find(
        (p) => p.mis === this.state.project,
      );
      let expenditureTypes = [];

      if (selectedProject) {
        this.state.selectedNA853 = selectedProject.na853;
        this.state.budgetAmount = parseFloat(selectedProject.budget_na853) || 0;
        const response = await fetch(
          `/api/catalog/${selectedProject.mis}/expenditure-types`,
          {
            headers: {
              Authorization: `Bearer ${await getAuthToken()}`,
            },
          },
        );
        const { expenditure_types } = await response.json();
        expenditureTypes = expenditure_types || [];

        // Load budget data when project is selected
        if (selectedProject) {
          await this.loadBudgetData();
        }
      }

      return `
        <div class="space-y-6">
          ${this.state.budgetData ? `
          <div class="bg-gradient-to-br from-blue-50 to-white p-6 rounded-xl border border-blue-100/50 shadow-lg mb-6">
            <div class="budget-indicators grid grid-cols-1 lg:grid-cols-3 gap-4"></div>
          </div>` : ''}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Select Project</label>
            <select id="projectSelect" class="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500">
              <option value="">Select a project...</option>
              ${projects
                .map(
                  (p) => `
                  <option value="${p.mis}" data-na853="${p.na853}" data-budget="${p.budget_na853 || 0}">
                    ${p.na853} - ${p.event_description || p.name || "Unnamed Project"}
                  </option>
                `,
                )
                .join("")}
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Expenditure Type</label>
            <select id="expTypeSelect" class="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500">
              <option value="">Select expenditure type...</option>
              ${expenditureTypes.map((type) => `<option value="${type}">${type}</option>`).join("")}
            </select>
          </div>
        </div>
      `;
    } catch (error) {
      console.error("Error loading projects:", error);
      return `<p class="text-red-600">Failed to load projects: ${error.message}</p>`;
    }
  }

  async calculateMonthlyTotal() {
    try {
      const response = await fetch(
        `/api/budget/${this.state.selectedMIS}/monthly-total`,
        {
          headers: {
            Authorization: `Bearer ${await getAuthToken()}`,
          },
        },
      );
      const data = await response.json();
      return parseFloat(data.total) || 0;
    } catch (error) {
      console.error("Error calculating monthly total:", error);
      return 0;
    }
  }

  async renderRecipientsStep() {
    try {
      if (!this.state.budgetDataLoaded) {
        await this.loadBudgetData();
        this.state.budgetDataLoaded = true;
      }

      const recipients = this.state.recipients || [];
      const totalAmount = this.calculateTotalAmount();

      // Update budget indicators
      this.budgetManager.updateBudgetIndicators(totalAmount, this.state.budgetData);

      // Update recipient count and total amount
      requestAnimationFrame(() => {
        const countEl = document.getElementById('recipientCount');
        const totalEl = document.getElementById('totalAmount');
        if (countEl) countEl.textContent = recipients.length;
        if (totalEl) totalEl.textContent = new Intl.NumberFormat('el-GR', {
          style: 'currency',
          currency: 'EUR'
        }).format(totalAmount);
      });

      // Update recipients table
      const recipientsTableBody = document.getElementById('recipientsTableBody');
      if (recipientsTableBody) {
        recipientsTableBody.innerHTML = '';
        for (let i = 0; i < recipients.length; i++) {
          const row = document.createElement('tr');
          row.innerHTML = this.createRecipientRow(recipients[i], i);
          recipientsTableBody.appendChild(row);
        }
      }

      return `
      <div class="space-y-6">
        <div class="bg-gradient-to-br from-blue-50 to-white p-6 rounded-xl border border-blue-100/50 shadow-lg">
          <div class="budget-indicators grid grid-cols-1 lg:grid-cols-3 gap-4"></div>
        </div>


        <div class="bg-white rounded-xl border border-gray-200/75 shadow-sm p-6">
          <div class="flex justify-between items-center mb-6">
          <div class="flex justify-between items-center">
            <div>
              <h3 class="text-xl font-bold text-gray-800">Παραλήπτες</h3>
              <p class="text-sm text-gray-600">Προσθέστε έως 10 παραλήπτες για αυτό το έγγραφο</p>
            </div>
            <button id="addRecipientBtn" 
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all duration-200 flex items-center space-x-2">
              <i class="fas fa-plus-circle"></i>
              <span class="font-medium">Προσθήκη Παραλήπτη</span>
            </button>
          </div>
          </div>
          <div class="overflow-x-auto overflow-y-auto max-h-[calc(100vh-24rem)] rounded-xl border border-gray-200/75 shadow-sm bg-white">
        <table class="min-w-full bg-white table-fixed divide-y divide-gray-200">
          <thead class="sticky top-0 z-10">
            <tr class="bg-gradient-to-r from-blue-50 to-white">
              <th class="px-16 py-4 border-b border-r text-center text-xs font-bold text-gray-700 uppercase tracking-wider bg-white">#</th> 
              <th class="px-6 py-4 border-b border-r text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Όνομα</th> 
              <th class="px-14 py-4 border-b border-r text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Επώνυμο</th> 
              <th class="px-24 py-4 border-b border-r text-center text-xs font-bold text-gray-700 uppercase tracking-wider">ΑΦΜ</th> 
              <th class="px-14 py-4 border-b border-r text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Ποσό</th> 
              <th class="px-6 py-4 border-b border-r text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Δόση</th> 
              <th class="px-14 py-4 border-b text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Ενέργειες</th> 
            </tr>
          </thead>
          <tbody>
            ${recipients
              .map(
                (recipient, index) => `
              <tr class="hover:bg-gray-50 transition-colors">
                <td class="w-12 px-2 py-3 border-b border-r text-sm font-medium text-gray-900 text-center">
                  <span class<span class="inline-flex items-center justify-center h-7 w-7 rounded-full bg-blue-50 text-blue-600 font-semibold text-sm">
                    ${index + 1}
                  </span>
                </td>
                <td class="px-6 py-3 border-b border-r">
                  <div class="relative group">
                    <input type="text" 
                           value="${recipient.firstname || ""}" 
                           class="w-full px-3 py-2 bg-white/50 border border-gray-200 rounded-md hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm recipient-input" 
                           data-field="firstname" 
                           data-index="${index}"
                           placeholder="Όνομα"
                           autocomplete="given-name"
                           aria-label="First name for recipient ${index + 1}">
                    <div class="invalid-feedback hidden text-red-500 text-xs mt-1">At least 2 characters required.</div>
                  </div>
                </td>
                <td class="px-14 py-3 border-b border-r">
                  <div class="relative">
                    <input type="text" 
                           value="${recipient.lastname || ""}" 
                           class="w-full px-3 py-2 bg-white/50 border border-gray-200 rounded-md hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm recipient-input" 
                           data-field="lastname" 
                           data-index="${index}"
                           placeholder="Επώνυμο"
                           autocomplete="family-name"
                           aria-label="Last name for recipient ${index + 1}">
                    <div class="invalid-feedback hidden text-red-500 text-xs mt-1">At least 2 characters required.</div>
                  </div>
                </td>
                <td class="px-24 py-3 border-b border-r">
                  <div class="relative"><div class="relative">
                    <input type="text" 
                           value="${recipient.afm || ""}" 
                           class="w-full px-3 py-2 bg-white/50 border border-gray-200 rounded-md hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm font-mono recipient-input" 
                           data-field="afm" 
                           data-index="${index}"
                           maxlength="9"
                           placeholder="ΑΦΜ"
                           autocomplete="off"
                           aria-label="AFM for recipient ${index + 1}">
                    <div class="invalid-feedback hidden text-red-500 text-xs mt-1">AFM must be 9 digits long.</div>
                  </div>
                </td>
                <td class="px-14 py-3 border-b border-r">
                  <div class="relative">
                    <input type="number" 
                           value="${recipient.amount || ""}" 
                           class="w-full px-3 py-2 bg-white/50 border border-gray-200 rounded-md hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm text-right recipient-input" 
                           data-field="amount" 
                           data-index="${index}"
                           step="0.01"
                           placeholder="0.00"
                           aria-label="Amount for recipient ${index + 1}">
                    <div class="invalid-feedback hidden text-red-500 text-xs mt-1">Amount must be greater than 0.</div>
                  </div>
                </td>
                <td class="px-6 py-3 border-b border-r w-24">
                  <div class="relative">
                    <input type="number" 
                           value="${recipient.installment || ""}"
                           class="w-full px-3 py-2 bg-white/50 border border-gray-200 rounded-md hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm text-center recipient-input" 
                           data-field="installment" 
                           data-index="${index}"
                           min="1"
                           placeholder="1"
                           aria-label="Installment for recipient ${index + 1}">
                  </div>
                </td>
                <td class="px-14 py-4 border-b text-center">
                  <button class="delete-recipient text-red-600 hover:text-red-800 p-1" data-index="${index}">
                    <i class="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      </div>
    `;
    } catch (error) {
      console.error("Error rendering recipients step:", error);
      return `<p class="text-red-600">Failed to render recipients: ${error.message}</p>`;
    }
  }

  createRecipientRow(recipient, index) {
    return `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="w-12 px-2 py-3 border-b border-r text-sm font-medium text-gray-900 text-center">
          <span class="inline-flex items-center justify-center h-7 w-7 rounded-full bg-blue-50 text-blue-600 font-semibold text-sm">
            ${index + 1}
          </span>
        </td>
        <td class="px-6 py-3 border-b border-r">
          <div class="relative group">
            <input type="text" 
                   value="${recipient.firstname || ""}" 
                   class="w-full px-3 py-2 bg-white/50 border border-gray-200 rounded-md hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm recipient-input" 
                   data-field="firstname" 
                   data-index="${index}"
                   placeholder="Όνομα"
                   autocomplete="given-name"
                   aria-label="First name for recipient ${index + 1}">
            <div class="invalid-feedback hidden text-red-500 text-xs mt-1">At least 2 characters required.</div>
          </div>
        </td>
        <td class="px-14 py-3 border-b border-r">
          <div class="relative">
            <input type="text" 
                   value="${recipient.lastname || ""}" 
                   class="w-full px-3 py-2 bg-white/50 border border-gray-200 rounded-md hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm recipient-input" 
                   data-field="lastname" 
                   data-index="${index}"
                   placeholder="Επώνυμο"
                   autocomplete="family-name"
                   aria-label="Last name for recipient ${index + 1}">
            <div class="invalid-feedback hidden text-red-500 text-xs mt-1">At least 2 characters required.</div>
          </div>
        </td>
        <td class="px-24 py-3 border-b border-r">
          <div class="relative">
            <input type="text" 
                   value="${recipient.afm || ""}" 
                   class="w-full px-3 py-2 bg-white/50 border border-gray-200 rounded-md hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm font-mono recipient-input" 
                   data-field="afm" 
                   data-index="${index}"
                   maxlength="9"
                   placeholder="ΑΦΜ"
                   autocomplete="off"
                   aria-label="AFM for recipient ${index + 1}">
            <div class="invalid-feedback hidden text-red-500 text-xs mt-1">AFM must be 9 digits long.</div>
          </div>
        </td>
        <td class="px-14 py-3 border-b border-r">
          <div class="relative">
            <input type="number" 
                   value="${recipient.amount || ""}" 
                   class="w-full px-3 py-2 bg-white/50 border border-gray-200 rounded-md hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm text-right recipient-input" 
                   data-field="amount" 
                   data-index="${index}"
                   step="0.01"
                   placeholder="0.00"
                   aria-label="Amount for recipient ${index + 1}">
            <div class="invalid-feedback hidden text-red-500 text-xs mt-1">Amount must be greater than 0.</div>
          </div>
        </td>
        <td class="px-6 py-3 border-b border-r w-24">
          <div class="relative">
            <input type="number" 
                   value="${recipient.installment || ""}"
                   class="w-full px-3 py-2 bg-white/50 border border-gray-200 rounded-md hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm text-center recipient-input" 
                   data-field="installment" 
                   data-index="${index}"
                   min="1"
                   placeholder="1"
                   aria-label="Installment for recipient ${index + 1}">
          </div>
        </td>
        <td class="px-14 py-4 border-b text-center">
          <button class="delete-recipient text-red-600 hover:text-red-800 p-1" data-index="${index}">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }

  async renderAttachmentsStep() {
    try {
      const expType = this.state.expenditure_type || "default";
      const installment = this.state.recipients?.[0]?.installment || 1;

      if (!expType || !installment) {
        return `<div class="p-4 text-red-600">Missing expenditure type or installment information</div>`;
      }

      const token = await getAuthToken();
      const response = await fetch(
        `/api/documents/attachments/${encodeURIComponent(expType)}/${encodeURIComponent(installment)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            'Content-Type': 'application/json'
          },
        },
      );

      const data = await response.json();
      const attachmentsList = data?.attachments || [];

      return `
        <div class="space-y-6">
          <div class="flexjustify-between items-center mb-4">
            <h3 class="text-lg font-medium">Required Attachments</h3>
            <span class="text-sm text-gray-500">${attachmentsList.length} attachments required</span>
          </div>
          <div class="space-y-4">
            ${attachmentsList
              .map(
                (attachment, index) => `
              <div class="flex items-start space-x-3 p-4 border rounded-lg bg-gray-50">
                <input type="checkbox"                       id="attachment-${index}"
                       class="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                       data-attachment="${attachment}">
                <div class="flex-1">
                  <label for="attachment-${index}" class="block text-sm font-medium text-gray-700 cursor-pointer">
                    ${attachment}
                  </label>
                  <div class="mt-2">
                    <input type="file" 
                           class="attachment-input w-full text-sm text-gray-500 file:mr-4file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" 
                           data-type="${attachment}">
                  </div>
                </div>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `;
    } catch (error) {
      console.error("Error loading attachments:", error);
      return `<p class="text-red600">Failed to load attachments: ${error.message}</p>`;
    }
  }

  async handleSubmitResponse(result) {
    this.showSuccess("Document created successfully");
    this.hide();
    if (this.manager?.loadDocuments) {
      await this.manager.loadDocuments();
    }
  }

  async submitFormData(formData) {
    const token = await getAuthToken();
    if (!token) throw new Error("Authentication required");

    const response = await fetch("/api/documents/generated", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to create document");
    }

    return response.json();
  }
  async setupStepHandlers() {
    const unitSelect = this.modal?.querySelector('#unitSelect');
    const projectSelect = this.modal?.querySelector('#projectSelect');
    const expTypeSelect = this.modal?.querySelector('#expTypeSelect');

    if (this.currentStep === 0 && unitSelect) {
      unitSelect.addEventListener('change', (e) => {
        this.state.unit = e.target.value;
        this.state.hasUnsavedChanges = true;
      });
    }

    if (this.currentStep === 1) {
      if (projectSelect) {
        projectSelect.addEventListener('change', (e) => this.handleProjectChange(e.target.value));
      }
      if (expTypeSelect) {
        expTypeSelect.addEventListener('change', (e) => this.handleExpenditureTypeChange(e.target.value));
      }
    }

    if (this.currentStep === 2) {
      const inputs = this.modal?.querySelectorAll('.recipient-input');
      inputs?.forEach(input => {
        input.addEventListener('input', (e) => this.handleRecipientInput(e.target));
      });
    }
  }

  cleanup() {
    this.eventHandlers.forEach((handler, element) => {
      element.removeEventListener(handler.type, handler.fn);
    });
    this.eventHandlers.clear();
    this.state = this.getInitialState();
  }
  validateField(input, isValid, message) {
    input.classList.toggle('border-red-500', !isValid);
    const feedback = input.parentElement.querySelector('.invalid-feedback');
    if (feedback) {
      feedback.textContent = message;
      feedback.classList.toggle('hidden', isValid);
    }
  }
}