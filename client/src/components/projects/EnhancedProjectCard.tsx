/**
 * Enhanced Project Card Component
 * Displays project information with complete database schema integration
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  MapPin, 
  Building, 
  Euro, 
  FileText, 
  Users, 
  Activity,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { formatEuropeanNumber } from '@/lib/number-format';
import DataValidation from '@/components/common/DataValidation';
import useExpenditureTypes from '@/hooks/useExpenditureTypes';

interface Project {
  id: number;
  mis?: number;
  na853?: string;
  project_title?: string;
  event_description?: string;
  event_year?: number[];
  budget_na853?: string;
  budget_na271?: string;
  budget_e069?: string;
  status?: string;
  event_type_id?: number;
  expenditure_types?: string[];
  implementing_agency?: string[];
  region?: any;
  location?: any;
  created_at?: string;
  updated_at?: string;
}

interface EnhancedProjectCardProps {
  project: Project;
  onEdit?: (project: Project) => void;
  onView?: (project: Project) => void;
  onDelete?: (project: Project) => void;
  isLoading?: boolean;
  className?: string;
}

const EnhancedProjectCard: React.FC<EnhancedProjectCardProps> = ({
  project,
  onEdit,
  onView,
  isLoading,
  className = ''
}) => {
  const { data: expenditureTypes, isLoading: expenditureTypesLoading } = useExpenditureTypes();

  const getStatusColor = (status: string = 'unknown') => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'ενεργό':
        return 'bg-green-100 text-green-800';
      case 'completed':
      case 'ολοκληρωμένο':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
      case 'εκκρεμές':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
      case 'ακυρωμένο':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string = 'unknown') => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'ενεργό':
        return <CheckCircle className="h-3 w-3" />;
      case 'completed':
      case 'ολοκληρωμένο':
        return <CheckCircle className="h-3 w-3" />;
      case 'pending':
      case 'εκκρεμές':
        return <Clock className="h-3 w-3" />;
      case 'cancelled':
      case 'ακυρωμένο':
        return <AlertCircle className="h-3 w-3" />;
      default:
        return <Activity className="h-3 w-3" />;
    }
  };

  const formatBudget = (budget: string | undefined) => {
    if (!budget) return 'Δεν έχει οριστεί';
    try {
      const numericBudget = parseFloat(budget.replace(/[^\d.-]/g, ''));
      if (isNaN(numericBudget)) return budget;
      return formatEuropeanNumber(numericBudget);
    } catch {
      return budget;
    }
  };

  const getTotalBudget = () => {
    const budgets = [
      project.budget_na853,
      project.budget_na271,
      project.budget_e069
    ].filter(Boolean);
    
    if (budgets.length === 0) return null;
    
    try {
      const total = budgets.reduce((sum, budget) => {
        const numeric = parseFloat(budget!.replace(/[^\d.-]/g, ''));
        return sum + (isNaN(numeric) ? 0 : numeric);
      }, 0);
      
      return total > 0 ? formatEuropeanNumber(total) : null;
    } catch {
      return null;
    }
  };

  const getExpenditureTypeNames = () => {
    if (!project.expenditure_types || !expenditureTypes) return [];
    
    return project.expenditure_types.map(typeId => {
      const type = expenditureTypes.find(t => t.id.toString() === typeId);
      return type ? type.name : `Τύπος ${typeId}`;
    });
  };

  if (isLoading) {
    return (
      <Card className={`${className} animate-pulse`}>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className} hover:shadow-lg transition-shadow duration-200`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg line-clamp-2">
              {project.project_title || project.event_description || 'Χωρίς τίτλο'}
            </CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                MIS: {project.mis || 'N/A'}
              </Badge>
              {project.na853 && (
                <Badge variant="outline" className="text-xs">
                  NA853: {project.na853}
                </Badge>
              )}
              <Badge 
                className={`text-xs flex items-center gap-1 ${getStatusColor(project.status)}`}
              >
                {getStatusIcon(project.status)}
                {project.status || 'Άγνωστη'}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Event Description */}
        {project.event_description && project.event_description !== project.project_title && (
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-700 line-clamp-2">
              {project.event_description}
            </p>
          </div>
        )}

        {/* Event Year */}
        {project.event_year && project.event_year.length > 0 && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700">
              Έτος: {project.event_year.join(', ')}
            </span>
          </div>
        )}

        {/* Budget Information */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Euro className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Προϋπολογισμός</span>
          </div>
          
          <div className="grid grid-cols-1 gap-2 pl-6">
            {project.budget_na853 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">NA853:</span>
                <span className="font-medium">{formatBudget(project.budget_na853)} €</span>
              </div>
            )}
            {project.budget_na271 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">NA271:</span>
                <span className="font-medium">{formatBudget(project.budget_na271)} €</span>
              </div>
            )}
            {project.budget_e069 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">E069:</span>
                <span className="font-medium">{formatBudget(project.budget_e069)} €</span>
              </div>
            )}
            {getTotalBudget() && (
              <>
                <Separator />
                <div className="flex justify-between text-sm font-semibold">
                  <span>Συνολικά:</span>
                  <span>{getTotalBudget()} €</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Expenditure Types */}
        <DataValidation
          isLoading={expenditureTypesLoading}
          error={null}
          data={getExpenditureTypeNames()}
          emptyMessage="Δεν έχουν οριστεί τύποι δαπανών"
        >
          {getExpenditureTypeNames().length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Τύποι Δαπανών</span>
              </div>
              <div className="flex flex-wrap gap-1 pl-6">
                {getExpenditureTypeNames().map((typeName, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {typeName}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </DataValidation>

        {/* Implementing Agency */}
        {project.implementing_agency && project.implementing_agency.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Φορείς Υλοποίησης</span>
            </div>
            <div className="flex flex-wrap gap-1 pl-6">
              {project.implementing_agency.map((agency, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {agency}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Location */}
        {project.region && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700">
              {typeof project.region === 'string' ? project.region : 'Περιοχή οριστεί'}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <Separator />
        <div className="flex gap-2 pt-2">
          {onView && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onView(project)}
              className="flex-1"
            >
              <FileText className="h-4 w-4 mr-2" />
              Προβολή
            </Button>
          )}
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(project)}
              className="flex-1"
            >
              Επεξεργασία
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedProjectCard;
