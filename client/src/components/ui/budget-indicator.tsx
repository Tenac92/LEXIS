
import { type BudgetData } from "@/lib/types";

interface BudgetIndicatorProps {
  budgetData: BudgetData;
}

export function BudgetIndicator({ budgetData }: BudgetIndicatorProps) {
  if (!budgetData) return null;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-xl border border-blue-100/50 shadow-lg">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div>
          <h3 className="text-sm font-medium text-gray-600">Available Budget</h3>
          <p className="text-2xl font-bold text-blue-600">
            {budgetData.current_budget.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-600">Total Budget</h3>
          <p className="text-2xl font-bold text-gray-700">
            {budgetData.total_budget.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-600">Annual Budget</h3>
          <p className="text-2xl font-bold text-gray-700">
            {budgetData.annual_budget.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
      </div>
    </div>
  );
}
