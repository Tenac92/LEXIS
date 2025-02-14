
const { supabase } = require('../config/db.js');

const VALID_UNITS = [
  'ΓΔΑΕΦΚ',
  'ΔΑΕΦΚ-ΑΚ', 'ΔΑΕΦΚ-ΚΕ', 'ΔΑΕΦΚ-ΒΕ', 'ΔΑΕΦΚ-ΔΕ',
  'ΤΑΕΦΚ ΧΑΛΚΙΔΙΚΗΣ', 'ΤΑΕΦΚ ΘΕΣΣΑΛΙΑΣ',
  'ΤΑΕΦΚ-ΑΑ', 'ΤΑΕΦΚ-ΔΑ', 'ΤΑΕΦΚ ΧΑΝΙΩΝ', 'ΤΑΕΦΚ ΗΡΑΚΛΕΙΟΥ'
];

class User {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.email = data.email;
    this.role = data.role;
    this.password = data.password;
    this.units = this.parseUnits(data.units);
    this.department = data.department;
  }

  parseUnits(units) {
    if (!units) return [];
    
    if (Array.isArray(units)) {
      return units
        .filter(unit => unit && typeof unit === 'string')
        .map(u => u.trim())
        .filter(Boolean);
    }
    
    if (typeof units === 'string') {
      try {
        // Handle Postgres array format
        if (units.startsWith('{') && units.endsWith('}')) {
          return units
            .slice(1, -1)
            .split(',')
            .map(u => u.trim().replace(/"/g, ''))
            .filter(Boolean);
        }
        
        // Handle JSON string
        const parsed = JSON.parse(units);
        return Array.isArray(parsed) ? parsed.map(u => u.trim()).filter(Boolean) : [];
      } catch (error) {
        console.error('Error parsing units:', error, 'Units value:', units);
        return [];
      }
    }
    
    console.warn('Invalid units format:', typeof units);
    return [];
  }

  static async findByEmail(email) {
    const { data, error } = await supabase
      .from('users')
      .select()
      .eq('email', email)
      .single();

    if (error) throw error;
    return data ? new User(data) : null;
  }

  static async findAll() {
    const { data, error } = await supabase
      .from('users')
      .select('id,name,email,role,units');
    
    if (error) throw error;
    return data ? data.map(user => new User(user)) : [];
  }

  static async create(userData) {
    // Validate required fields
    if (!userData.email || !userData.password || !userData.name) {
      throw new Error('Missing required fields: email, password, name');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      throw new Error('Invalid email format');
    }

    // Validate units if provided
    if (userData.units) {
      const invalidUnits = userData.units.filter(unit => !VALID_UNITS.includes(unit));
      if (invalidUnits.length > 0) {
        throw new Error(`Invalid units: ${invalidUnits.join(', ')}`);
      }
    }

    // Validate role
    if (userData.role && !['admin', 'user'].includes(userData.role)) {
      throw new Error('Invalid role: must be either "admin" or "user"');
    }

    const { data, error } = await supabase
      .from('users')
      .insert([userData])
      .select()
      .single();

    if (error) throw error;
    return new User(data);
  }

  static async findById(id) {
    const { data, error } = await supabase
      .from('users')
      .select()
      .eq('id', id)
      .single();

    if (error) throw error;
    return data ? new User(data) : null;
  }

  static async updatePassword(userId, hashedPassword) {
    const { error } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', userId);

    if (error) throw error;
    return true;
  }

  static async updateUnits(userId, units) {
    if (units) {
      const invalidUnits = units.filter(unit => !VALID_UNITS.includes(unit));
      if (invalidUnits.length > 0) {
        throw new Error(`Invalid units: ${invalidUnits.join(', ')}`);
      }
    }

    const { error } = await supabase
      .from('users')
      .update({ units })
      .eq('id', userId);

    if (error) throw error;
    return true;
  }

  static getValidUnits() {
    return VALID_UNITS;
  }

  static async findByUnit(unit) {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, units')
      .filter('units', 'cs', `{${unit}}`);

    if (error) throw error;
    return data ? data.map(user => new User(user)) : [];
  }

  static async delete(userId) {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) throw error;
    return true;
  }

  static async update(userId, userData) {
    if (userData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.email)) {
        throw new Error('Invalid email format');
      }
    }

    if (userData.role && !['admin', 'user'].includes(userData.role)) {
      throw new Error('Invalid role: must be either "admin" or "user"');
    }

    const { error } = await supabase
      .from('users')
      .update(userData)
      .eq('id', userId);

    if (error) throw error;
    return true;
  }
}

module.exports = User;
