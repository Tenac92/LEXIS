import { GeneratedDocumentsManager } from './managers/GeneratedDocumentsManager.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import { getAuthToken } from '../utils/auth.js';
import { createHeader } from '../components/header.js';
import { createFAB } from '../components/fab.js';

document.addEventListener('DOMContentLoaded', async () => {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.classList.remove('hidden');
  }

  try {
    // Check authentication
    const token = await getAuthToken();
    if (!token) {
      window.location.href = '/index.html?redirect=' + encodeURIComponent(window.location.pathname);
      return;
    }

    // Verify token
    const response = await fetch('/auth/verify', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Authentication required');
    }

    // Initialize document manager
    if (!window.docManager) {
      window.docManager = new GeneratedDocumentsManager();
      const initialized = await window.docManager.initialize();

      if (!initialized) {
        throw new Error('Failed to initialize document manager');
      }

      // Create and append FAB
      const fabElement = await createFAB();
      if (fabElement && fabElement instanceof Node) {
        document.body.appendChild(fabElement);

        // Add click handler for FAB
        const fabButton = fabElement.querySelector('button');
        if (fabButton) {
          fabButton.addEventListener('click', async () => {
            if (window.docManager) {
              try {
                const { CreateDocumentModal } = await import('./managers/CreateDocumentModal.js');
                const createDocumentModal = new CreateDocumentModal(window.docManager);
                await createDocumentModal.show();
              } catch (error) {
                console.error('Error showing create document modal:', error);
                ErrorHandler.showError('Failed to open create document modal');
              }
            }
          });
        }
      }

      // Initialize UI manager and filters with error handling
      if (!window.docManager) {
        console.error('Document manager not initialized');
        return;
      }

      if (!window.docManager.uiManager) {
        console.error('UI manager not initialized');
        return;
      }

      try {
        // Initialize filters
        await window.docManager.uiManager.initializeFilters();

        // Cache filter elements for better performance
        const filterContainer = document.querySelector('[data-filter-container]');
        if (filterContainer) {
          window.docManager.uiManager.setupFilterContainer(filterContainer);
        }

        // Setup filter handlers
        const filterElements = {
          unitFilter: document.getElementById('unitFilter'),
          statusFilter: document.getElementById('statusFilter'),
          userFilter: document.getElementById('userFilter'),
          dateFrom: document.getElementById('dateFrom'),
          dateTo: document.getElementById('dateTo'),
          recipientFilter: document.getElementById('recipientFilter'),
          afmFilter: document.getElementById('afmFilter'),
          amountFrom: document.getElementById('amountFrom'),
          amountTo: document.getElementById('amountTo')
        };

        // Validate filter elements
        Object.entries(filterElements).forEach(([key, element]) => {
          if (!element) {
            console.warn(`Filter element not found: ${key}`);
          }
        });

        // Setup filter handlers
        await window.docManager.uiManager.setupFilterHandlers(filterElements);
      } catch (error) {
        console.error('Error initializing UI manager or filters:', error);
        ErrorHandler.showError('Failed to initialize filters');
      }
    }

  } catch (error) {
    console.error('Initialization error:', error);
    ErrorHandler.showError(error.message || 'Failed to initialize application');
  } finally {
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
  }
});