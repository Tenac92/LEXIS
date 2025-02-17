import { getAuthToken, getUserFromToken, logout } from '../utils/auth.js';
import { createFAB } from './fab.js';

let headerInstance = null;

export function createHeader() {
  cleanupHeader();

  const header = document.createElement('header');
  header.className = 'app-header';

  const nav = document.createElement('nav');
  nav.className = 'nav-container';

  const headerContent = document.createElement('div');
  headerContent.className = 'flex items-center justify-between h-full';

  const leftSection = document.createElement('div');
  leftSection.className = 'flex items-center space-x-4';

  const dropdownContainer = document.createElement('div');
  dropdownContainer.className = 'relative inline-block';
  dropdownContainer.id = 'headerDropdown';

  const dropdownButton = document.createElement('button');
  dropdownButton.className = 'inline-flex items-center';
  dropdownButton.innerHTML = `
    <span class="mr-2">Μενού</span>
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
    </svg>
  `;

  const dropdownContent = document.createElement('div');
  dropdownContent.className = 'hidden absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5';
  dropdownContent.setAttribute('role', 'menu');

  const links = [
    { text: 'Πίνακας Ελέγχου', href: '/dashboard/index.html' },
    { text: 'Διαβιβαστικά', href: '/generated-documents/index.html' },
    { text: 'Έργα', href: '/catalog/index.html' }
  ];

  links.forEach(link => {
    const a = document.createElement('a');
    a.href = link.href;
    a.className = 'block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50';
    a.textContent = link.text;
    dropdownContent.appendChild(a);
  });

  const rightSection = document.createElement('div');
  rightSection.className = 'flex items-center';

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50/80 rounded-md transition-colors';
  logoutBtn.innerHTML = `
    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
    </svg>
    <span>Αποσύνδεση</span>
  `;

  const handleDropdown = (e) => {
    e.stopPropagation();
    dropdownContent.classList.toggle('hidden');
  };

  const handleClickOutside = (e) => {
    if (!dropdownContainer.contains(e.target)) {
      dropdownContent.classList.add('hidden');
    }
  };

  const handleLogout = async (e) => {
    e.preventDefault();
    await logout();
    window.location.href = "/index.html";
  };

  dropdownButton.addEventListener('click', handleDropdown);
  document.addEventListener('click', handleClickOutside);
  logoutBtn.addEventListener('click', handleLogout);

  dropdownContainer.appendChild(dropdownButton);
  dropdownContainer.appendChild(dropdownContent);
  leftSection.appendChild(dropdownContainer);
  rightSection.appendChild(logoutBtn);
  headerContent.appendChild(leftSection);
  headerContent.appendChild(rightSection);
  nav.appendChild(headerContent);
  header.appendChild(nav);

  return header;
}

export function cleanupHeader() {
  if (headerInstance) {
    const oldHeader = document.querySelector('header');
    if (oldHeader) {
      oldHeader.remove();
    }
    headerInstance = null;
  }
}

export async function initializeHeader() {
  if (window.location.pathname === '/index.html' || window.location.pathname === '/') {
    cleanupHeader();
    return;
  }

  try {
    const token = await getAuthToken();
    if (!token) {
      window.location.href = "/index.html";
      return;
    }

    const header = createHeader();
    document.body.insertBefore(header, document.body.firstChild);

    const main = document.querySelector('main');
    if (main) {
      main.style.paddingTop = '4rem';
    }

    headerInstance = header;
  } catch (error) {
    console.error('Header initialization error:', error);
    window.location.href = "/index.html";
  }
}

document.addEventListener('DOMContentLoaded', initializeHeader);
window.addEventListener('popstate', initializeHeader);