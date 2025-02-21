import { apiRequest } from "@/lib/queryClient";
import type { DashboardStats } from "@/lib/dashboard";

export async function getDashboardStats() {
  return apiRequest<DashboardStats>("/api/dashboard/stats");
}

export async function refreshDashboardStats() {
  return apiRequest<DashboardStats>("/api/dashboard/refresh", {
    method: "POST"
  });
}

export async function getPendingDocuments(units: string[]) {
  if (!Array.isArray(units) || !units.length) {
    throw new Error("Μη έγκυρη παράμετρος μονάδων");
  }

  return apiRequest<{ documents: any[] }>(`/api/dashboard/documents/pending?units=${encodeURIComponent(units.join(','))}`);
}

export const formatCurrency = (amount: number | null | undefined): string => {
  if (!amount || isNaN(amount)) return '€0,00';
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Μη διαθέσιμο';
  return new Date(dateString).toLocaleDateString('el-GR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};