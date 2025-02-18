
export async function createFAB() {
  const fab = document.createElement('div');
  fab.className = 'fixed bottom-6 right-6 flex flex-col gap-2 z-[49]';
  fab.style.display = 'flex !important';
  fab.style.position = 'fixed !important';
  
  const mainButton = document.createElement('button');
  mainButton.className = 'w-16 h-16 bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-110';
  mainButton.innerHTML = '<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>';

  mainButton.addEventListener('click', async () => {
    try {
      const { CreateDocumentModal } = await import('../generated-documents/managers/CreateDocumentModal.js');
      const createDocumentModal = new CreateDocumentModal();
      await createDocumentModal.show();
    } catch (error) {
      console.error('Error showing create document modal:', error);
    }
  });

  fab.appendChild(mainButton);
  return fab;
}
