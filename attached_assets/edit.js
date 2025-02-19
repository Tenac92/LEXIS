
import { getAuthToken } from '../utils/auth.js';
import { createHeader } from '../components/header.js';

document.addEventListener('DOMContentLoaded', async () => {
  const token = getAuthToken();
  if (!token) {
    window.location.href = '../index.html';
    return;
  }

  document.body.insertBefore(createHeader(), document.body.firstChild);
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('id');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const editForm = document.getElementById('editForm');

  if (!projectId) {
    alert('No project ID provided');
    window.location.href = 'index.html';
    return;
  }

  async function loadProject() {
    try {
      loadingSpinner.classList.remove('hidden');
      const token = await getAuthToken();
      if (!token) throw new Error('Authentication required');
      
      const response = await fetch(`/api/catalog/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch project');
      const project = await response.json();

      Object.keys(project).forEach(key => {
        const element = document.getElementById(key);
        if (element) {
          if (element.type === 'number') {
            element.value = project[key] || 0;
          } else if (Array.isArray(project[key])) {
            element.value = project[key].join(', ');
          } else {
            element.value = project[key] || '';
          }
        }
      });
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to load project details');
    } finally {
      loadingSpinner.classList.add('hidden');
    }
  }

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      loadingSpinner.classList.remove('hidden');
      
      const formData = new FormData(editForm);
      const projectData = {};
      
      for (const [key, value] of formData.entries()) {
        if (key === 'implementing_agency') {
          projectData[key] = value.split(',').map(v => v.trim());
        } else if (key.startsWith('budget_') || key === 'e069' || key === 'na271' || key === 'na853') {
          projectData[key] = parseFloat(value) || 0;
        } else {
          projectData[key] = value;
        }
      }

      const response = await fetch(`/api/catalog/${projectId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(projectData)
      });

      if (!response.ok) throw new Error('Failed to update project');
      
      alert('Project updated successfully');
      window.location.href = 'index.html';
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to update project');
    } finally {
      loadingSpinner.classList.add('hidden');
    }
  });

  await loadProject();
});
