
import { getAuthToken } from '../../utils/auth.js';

export class BaseModal {
  constructor(modalId) {
    this.modalId = modalId;
    this.modal = null;
    this.eventListeners = new Map();
    this.isInitialized = false;
    this.contentLoaded = false;
  }

  async initialize() {
    try {
      if (this.isInitialized && this.modal?.querySelector('.modal-content')) {
        return true;
      }

      await this.cleanup();
      await this.createModal();
      await this.setupEventListeners();

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Modal initialization failed:', error);
      return false;
    }
  }

  async createModal() {
    const existingModal = document.getElementById(this.modalId);
    if (existingModal) {
      existingModal.remove();
    }

    this.modal = document.createElement('div');
    this.modal.id = this.modalId;
    this.modal.className = 'fixed inset-0 z-50 hidden overflow-y-auto overscroll-contain bg-black/40 backdrop-blur-sm transition-opacity duration-300';
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-modal', 'true');
    this.modal.setAttribute('tabindex', '-1');
    this.modal.setAttribute('aria-labelledby', `${this.modalId}-title`);

    this.modal.innerHTML = `
      <div class="min-h-screen px-4 py-6 flex items-start justify-center">
        <div class="relative w-full max-w-6xl my-4 opacity-0 transform -translate-y-4 transition-all duration-300">
          <div class="bg-white shadow-2xl rounded-2xl relative flex flex-col max-h-[90vh] border border-gray-200/50">
            <div class="sticky top-0 flex items-center justify-between px-8 py-6 border-b border-gray-100 bg-white/80 backdrop-blur-sm rounded-t-2xl z-10">
              <h3 class="modal-title text-xl font-semibold text-gray-800"></h3>
              <button class="modal-close-btn p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100/80 rounded-full transition-all duration-150">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="modal-content flex-1 overflow-y-auto px-8 py-6 bg-gradient-to-br from-gray-50/50 to-white">
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  setupEventListeners() {
    if (!this.modal) return;

    const closeModal = (e) => {
      e.preventDefault();
      this.hide();
    };

    this.addEventHandler('click', (e) => {
      if (e.target === this.modal) {
        closeModal(e);
      }
    });

    const closeBtn = this.modal.querySelector('.modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible()) {
        closeModal(e);
      }
    });
  }

  setTitle(title) {
    const titleEl = this.modal?.querySelector('.modal-title');
    if (titleEl) titleEl.textContent = title;
  }

  setContent(content) {
    const contentEl = this.modal?.querySelector('.modal-content');
    if (contentEl) {
      contentEl.innerHTML = content;
      this.contentLoaded = true;
    }
  }

  async show() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    requestAnimationFrame(() => {
      this.modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      
      // Trigger animations
      setTimeout(() => {
        this.modal.classList.add('opacity-100');
        const content = this.modal.querySelector('.max-w-6xl > div');
        if (content) {
          content.classList.remove('opacity-0', '-translate-y-4');
        }
      }, 50);
    });

    const firstInput = this.modal.querySelector('input, select, textarea');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 300);
    }
  }

  async hide() {
    if (!this.modal) return;

    // Trigger exit animations
    this.modal.classList.remove('opacity-100');
    const content = this.modal.querySelector('.max-w-6xl > div');
    if (content) {
      content.classList.add('opacity-0', '-translate-y-4');
    }

    // Wait for animations to complete
    setTimeout(() => {
      this.modal.classList.add('hidden');
      document.body.style.overflow = '';
    }, 300);

    this.contentLoaded = false;
  }

  isVisible() {
    return this.modal && !this.modal.classList.contains('hidden');
  }

  addEventHandler(event, handler) {
    if (!this.modal) return;
    this.modal.addEventListener(event, handler);
    this.eventListeners.set(handler, { event, element: this.modal });
  }

  async cleanup() {
    this.eventListeners.forEach((listener, handler) => {
      listener.element.removeEventListener(listener.event, handler);
    });
    this.eventListeners.clear();

    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    this.isInitialized = false;
    this.contentLoaded = false;
  }
}
