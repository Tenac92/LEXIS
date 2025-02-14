
const { supabase } = require('../config/db.js');
const { ApiError } = require('../utils/apiErrorHandler.js');

class ProjectCatalog {
  constructor(data) {
    Object.assign(this, data);
  }

  static async handleDatabaseError(error, operation) {
    console.error(`Database error during ${operation}:`, error);
    throw new ApiError(500, `Database error during ${operation}`);
  }

  static buildQuery(baseQuery, filters = {}) {
    Object.entries(filters).forEach(([key, value]) => {
      if (!value) return;

      if (key === 'unit') {
        baseQuery = baseQuery.contains('implementing_agency', [value]);
      } else if (key === 'search') {
        const searchValue = value.toLowerCase().trim();
        if (!searchValue) return;

        const searchTerms = searchValue.split(',').map(term => term.trim());
        const searchConditions = searchTerms.map(term => {
          const searchDigits = term.length > 3 ? term.slice(-3) : term;
          return `na853.ilike.%${searchDigits}`;
        });
        baseQuery = baseQuery.or(searchConditions.join(','));
      }
    });

    return baseQuery;
  }

  static async findAll(page = 1, limit = 50, filters = {}) {
    try {
      let query = supabase
        .from('project_catalog')
        .select('*', { count: 'exact' });

      query = this.buildQuery(query, filters);
      query = query
        .order('mis', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      const { data, error, count } = await query;
      
      if (error) {
        throw new ApiError(500, 'Search query failed');
      }

      return {
        data: data || [],
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      return this.handleDatabaseError(error, 'findAll');
    }
  }

  static async findById(mis) {
    try {
      if (!mis) throw new ApiError(400, 'MIS parameter is required');

      const { data, error } = await supabase
        .from('project_catalog')
        .select('*')
        .eq('mis', mis)
        .single();

      if (error) throw error;
      if (!data) throw new ApiError(404, `Project with MIS ${mis} not found`);

      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      return this.handleDatabaseError(error, 'findById');
    }
  }

  static async update(mis, catalogData) {
    try {
      if (!mis) throw new ApiError(400, 'MIS is required');
      if (!catalogData) throw new ApiError(400, 'No data provided for update');
      
      // Validate required fields
      const requiredFields = ['event_description', 'implementing_agency'];
      const missingFields = requiredFields.filter(field => !catalogData[field]);
      if (missingFields.length > 0) {
        throw new ApiError(400, `Missing required fields: ${missingFields.join(', ')}`);
      }

      // Add status to allowed fields if not present
      if (!this.allowedFields.includes('status')) {
        this.allowedFields.push('status');
      }

      const sanitizedData = this.sanitizeUpdateData(catalogData);
      
      const { error } = await supabase
        .from('project_catalog')
        .update(sanitizedData)
        .eq('mis', mis);

      if (error) throw error;
      return true;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      return this.handleDatabaseError(error, 'update');
    }
  }

  static sanitizeUpdateData(data) {
    const numericFields = ['e069', 'na271', 'na853', 'budget_e069', 'budget_na271', 'budget_na853'];
    const sanitized = { ...data };

    numericFields.forEach(field => {
      if (field in sanitized) {
        const value = parseFloat(sanitized[field]);
        if (isNaN(value) || value < 0) {
          throw new ApiError(400, `Invalid numeric value for ${field}`);
        }
        sanitized[field] = value;
      }
    });

    if (sanitized.implementing_agency) {
      sanitized.implementing_agency = Array.isArray(sanitized.implementing_agency)
        ? sanitized.implementing_agency.filter(Boolean).map(agency => agency.trim())
        : sanitized.implementing_agency.split(',').filter(Boolean).map(agency => agency.trim());
    }

    return sanitized;
  }

  static async delete(mis) {
    try {
      if (!mis) throw new ApiError(400, 'MIS is required');

      const { error } = await supabase
        .from('project_catalog')
        .delete()
        .eq('mis', mis);

      if (error) throw error;
      return true;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      return this.handleDatabaseError(error, 'delete');
    }
  }
}

module.exports = ProjectCatalog;
