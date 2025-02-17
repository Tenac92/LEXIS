
import { createHeader } from '../components/header.js';

document.addEventListener('DOMContentLoaded', async () => {
  document.body.insertBefore(createHeader(), document.body.firstChild);
  const token = localStorage.getItem('authToken');
  if (!token) {
    window.location.href = '/index.html';
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get('id');

  if (!userId) {
    window.location.href = '/useradd';
    return;
  }

  try {
    const response = await fetch(`/api/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error('Failed to fetch user');

    const user = await response.json();
    
    // Populate form fields
    document.getElementById('name').value = user.name || '';
    document.getElementById('email').value = user.email || '';
    document.getElementById('role').value = user.role || 'user';
    document.getElementById('telephone').value = user.telephone || '';

    // Handle units selection
    const units = Array.isArray(user.units) ? user.units : 
                 (typeof user.units === 'string' ? JSON.parse(user.units) : []);
    
    const checkboxes = document.querySelectorAll('input[name="units"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = units.includes(checkbox.value);
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    alert('Failed to fetch user details');
    window.location.href = '/useradd';
  }

  document.getElementById('editUserForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const selectedUnits = Array.from(document.querySelectorAll('input[name="units"]:checked')).map(cb => cb.value);
    
    const userData = {
      name: formData.get('name'),
      email: formData.get('email'),
      role: formData.get('role'),
      telephone: formData.get('telephone'),
      units: selectedUnits
    };

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update user');
      }
      
      window.location.href = '/useradd';
    } catch (error) {
      console.error('Error updating user:', error);
      alert(error.message || 'Failed to update user');
    }
  });
});
