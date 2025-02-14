
import { useState, useCallback } from 'react';

export const useFormValidation = (initialValues = {}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});

  const validate = useCallback((name, value) => {
    switch (name) {
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? '' : 'Invalid email format';
      case 'password':
        return value.length >= 6 ? '' : 'Password must be at least 6 characters';
      case 'name':
        return value.trim().length > 0 ? '' : 'Name is required';
      case 'telephone':
        return /^\+?[\d\s-]{10,}$/.test(value) ? '' : 'Invalid telephone format';
      default:
        return '';
    }
  }, []);

  const handleChange = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    const error = validate(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
  }, [validate]);

  const isValid = useCallback(() => {
    return Object.values(errors).every(error => !error);
  }, [errors]);

  return { values, errors, handleChange, isValid };
};
