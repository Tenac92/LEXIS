import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { RotateCw, CheckCircle, XCircle, AlertTriangle, DollarSign, Bell, Clock, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { el } from 'date-fns/locale';

interface BudgetNotification {
  id: number;
  project_id: number;
  mis?: number;
  na853?: string | null;
  type: string;
  amount: number;
  current_budget: number;
  ethsia_pistosi: number;
  reason?: string;
  status: string;
  user_id?: number;
  created_at: string;
  updated_at?: string;
  user?: {
    id: number;
    name: string;
    email?: string;
    department?: string;
  } | null;
}

interface NotificationStyle {
  bgColor: string;
  borderColor: string;
  badgeBgColor: string;
  badgeTextColor: string;
  textColor: string;
  hoverBgColor: string;
  icon: typeof AlertTriangle;
  label: string;
}

const getNotificationStyle = (type: string): NotificationStyle => {
  switch (type) {
    case 'anakatanom_request':
      return {
        bgColor: '#fef2f2',
        borderColor: '#fca5a5',
        badgeBgColor: '#dc2626',
        badgeTextColor: '#ffffff',
        textColor: '#991b1b',
        hoverBgColor: '#fee2e2',
        icon: AlertTriangle,
        label: 'ΑΝΑΚΑΤΑΝΟΜΗ'
      };
    case 'xrimatodotisi_request':
      return {
        bgColor: '#fffbeb',
        borderColor: '#fcd34d',
        badgeBgColor: '#f59e0b',
        badgeTextColor: '#ffffff',
        textColor: '#92400e',
        hoverBgColor: '#fef3c7',
        icon: DollarSign,
        label: 'ΧΡΗΜΑΤΟΔΟΤΗΣΗ'
      };
    case 'funding':
      return {
        bgColor: '#fef2f2',
        borderColor: '#fecaca',
        badgeBgColor: '#fee2e2',
        badgeTextColor: '#991b1b',
        textColor: '#991b1b',
        hoverBgColor: '#fee2e2',
        icon: DollarSign,
        label: 'ΧΡΗΜΑΤΟΔΟΤΗΣΗ'
      };
    case 'reallocation':
      return {
        bgColor: '#fefce8',
        borderColor: '#fde047',
        badgeBgColor: '#fef08a',
        badgeTextColor: '#854d0e',
        textColor: '#854d0e',
        hoverBgColor: '#fef9c3',
        icon: AlertTriangle,
        label: 'ΑΝΑΠΡΟΣΑΡΜΟΓΗ'
      };
    case 'low_budget':
      return {
        bgColor: '#eff6ff',
        borderColor: '#93c5fd',
        badgeBgColor: '#dbeafe',
        badgeTextColor: '#1e40af',
        textColor: '#1e40af',
        hoverBgColor: '#dbeafe',
        icon: Bell,
        label: 'ΧΑΜΗΛΟ ΥΠΟΛΟΙΠΟ'
      };
    default:
      return {
        bgColor: '#f9fafb',
        borderColor: '#e5e7eb',
        badgeBgColor: '#f3f4f6',
        badgeTextColor: '#1f2937',
        textColor: '#1f2937',
        hoverBgColor: '#f3f4f6',
        icon: Bell,
        label: 'ΕΙΔΟΠΟΙΗΣΗ'
      };
  }
};

const statusLabels: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Εκκρεμές', color: '#92400e', bgColor: '#fef3c7' },
  approved: { label: 'Εγκεκριμένο', color: '#166534', bgColor: '#dcfce7' },
  rejected: { label: 'Απορριφθέν', color: '#991b1b', bgColor: '#fee2e2' }
};

export default function AdminNotificationsPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  
  const { data: notifications = [], isLoading, refetch } = useQuery<BudgetNotification[]>({
    queryKey: ['/api/budget-notifications/admin'],
    queryFn: async () => {
      console.log('[AdminNotificationsPage] Fetching notifications...');
      try {
        const response = await fetch('/api/budget-notifications/admin', {
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error(`Error fetching notifications: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[AdminNotificationsPage] Received notifications:', data);
        console.log('[AdminNotificationsPage] Notification types:', data.map((n: BudgetNotification) => ({ id: n.id, type: n.type })));
        
        if (!Array.isArray(data)) {
          console.warn('[AdminNotificationsPage] Expected array but got:', typeof data);
          return [];
        }
        
        return data;
      } catch (error) {
        console.error('[AdminNotificationsPage] Error fetching notifications:', error);
        toast({
          title: 'Σφάλμα',
          description: 'Αποτυχία φόρτωσης ειδοποιήσεων',
          variant: 'destructive',
        });
        return [];
      }
    }
  });
  
  const handleRefresh = () => {
    refetch();
    toast({
      title: 'Ανανέωση',
      description: 'Λήψη τελευταίων ειδοποιήσεων...'
    });
  };
  
  const handleApprove = async (id: number) => {
    try {
      const response = await fetch(`/api/budget-notifications/${id}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Error approving notification: ${response.status}`);
      }
      
      toast({
        title: 'Επιτυχία',
        description: 'Η ειδοποίηση εγκρίθηκε'
      });
      
      refetch();
    } catch (error) {
      toast({
        title: 'Σφάλμα',
        description: 'Αποτυχία έγκρισης ειδοποίησης',
        variant: 'destructive',
      });
    }
  };
  
  const handleReject = async (id: number) => {
    try {
      const response = await fetch(`/api/budget-notifications/${id}/reject`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Error rejecting notification: ${response.status}`);
      }
      
      toast({
        title: 'Επιτυχία',
        description: 'Η ειδοποίηση απορρίφθηκε'
      });
      
      refetch();
    } catch (error) {
      toast({
        title: 'Σφάλμα',
        description: 'Αποτυχία απόρριψης ειδοποίησης',
        variant: 'destructive',
      });
    }
  };
  
  const filteredNotifications = statusFilter === 'all' 
    ? notifications 
    : notifications.filter(notification => notification.status === statusFilter);

  const pendingCount = notifications.filter(n => n.status === 'pending').length;
  const approvedCount = notifications.filter(n => n.status === 'approved').length;
  const rejectedCount = notifications.filter(n => n.status === 'rejected').length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Ειδοποιήσεις Προϋπολογισμού</h1>
            <p className="text-muted-foreground mt-2">
              Διαχείριση αιτημάτων ανακατανομής και χρηματοδότησης
            </p>
          </div>
          <Button 
            variant="outline"
            onClick={handleRefresh}
            className="flex items-center gap-2"
            data-testid="button-refresh"
          >
            <RotateCw className="h-4 w-4" />
            Ανανέωση
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card 
            className={`cursor-pointer transition-all ${statusFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter('all')}
            data-testid="filter-all"
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Σύνολο</p>
                <p className="text-2xl font-bold">{notifications.length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className={`cursor-pointer transition-all ${statusFilter === 'pending' ? 'ring-2 ring-amber-500' : ''}`}
            onClick={() => setStatusFilter('pending')}
            data-testid="filter-pending"
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full" style={{ backgroundColor: '#fef3c7' }}>
                <Clock className="h-5 w-5" style={{ color: '#92400e' }} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Εκκρεμή</p>
                <p className="text-2xl font-bold" style={{ color: '#92400e' }}>{pendingCount}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className={`cursor-pointer transition-all ${statusFilter === 'approved' ? 'ring-2 ring-green-500' : ''}`}
            onClick={() => setStatusFilter('approved')}
            data-testid="filter-approved"
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full" style={{ backgroundColor: '#dcfce7' }}>
                <CheckCircle className="h-5 w-5" style={{ color: '#166534' }} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Εγκεκριμένα</p>
                <p className="text-2xl font-bold" style={{ color: '#166534' }}>{approvedCount}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className={`cursor-pointer transition-all ${statusFilter === 'rejected' ? 'ring-2 ring-red-500' : ''}`}
            onClick={() => setStatusFilter('rejected')}
            data-testid="filter-rejected"
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full" style={{ backgroundColor: '#fee2e2' }}>
                <XCircle className="h-5 w-5" style={{ color: '#991b1b' }} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Απορριφθέντα</p>
                <p className="text-2xl font-bold" style={{ color: '#991b1b' }}>{rejectedCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              {statusFilter === 'all' && 'Όλες οι Ειδοποιήσεις'}
              {statusFilter === 'pending' && 'Εκκρεμείς Ειδοποιήσεις'}
              {statusFilter === 'approved' && 'Εγκεκριμένες Ειδοποιήσεις'}
              {statusFilter === 'rejected' && 'Απορριφθείσες Ειδοποιήσεις'}
              <Badge variant="secondary">{filteredNotifications.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Φόρτωση ειδοποιήσεων...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {statusFilter === 'all' 
                    ? 'Δεν υπάρχουν ειδοποιήσεις προϋπολογισμού.' 
                    : `Δεν υπάρχουν ${statusFilter === 'pending' ? 'εκκρεμείς' : statusFilter === 'approved' ? 'εγκεκριμένες' : 'απορριφθείσες'} ειδοποιήσεις.`}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredNotifications.map((notification) => {
                  const style = getNotificationStyle(notification.type);
                  const StatusIcon = style.icon;
                  const isHovered = hoveredId === notification.id;
                  const statusStyle = statusLabels[notification.status] || statusLabels.pending;
                  
                  return (
                    <div 
                      key={notification.id}
                      data-testid={`notification-${notification.id}`}
                      style={{
                        backgroundColor: isHovered ? style.hoverBgColor : style.bgColor,
                        borderColor: style.borderColor,
                        borderWidth: '2px',
                        borderStyle: 'solid',
                        borderRadius: '12px',
                        padding: '20px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={() => setHoveredId(notification.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-3 mb-3">
                            <div 
                              style={{
                                backgroundColor: style.badgeBgColor,
                                color: style.badgeTextColor,
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontWeight: 600,
                                fontSize: '12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}
                            >
                              <StatusIcon className="h-4 w-4" />
                              {style.label}
                            </div>
                            
                            <div 
                              style={{
                                backgroundColor: statusStyle.bgColor,
                                color: statusStyle.color,
                                padding: '4px 10px',
                                borderRadius: '4px',
                                fontWeight: 500,
                                fontSize: '11px'
                              }}
                            >
                              {statusStyle.label}
                            </div>
                            
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(parseISO(notification.created_at), { 
                                addSuffix: true,
                                locale: el 
                              })}
                            </span>
                          </div>
                          
                          <div className="mb-3">
                            <span className="font-semibold text-foreground">NA853: </span>
                            <span className="font-mono">{notification.na853 || notification.mis}</span>
                          </div>
                          
                          <p style={{ color: style.textColor }} className="mb-4 text-sm leading-relaxed">
                            {notification.reason}
                          </p>
                          
                          {notification.user && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                              <User className="h-3 w-3" />
                              <span>Αιτήθηκε από: <strong>{notification.user.name || 'Άγνωστος'}</strong></span>
                              {notification.user.email && (
                                <span className="text-muted-foreground/70">({notification.user.email})</span>
                              )}
                            </div>
                          )}
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                            <div className="bg-background/50 rounded-lg p-3">
                              <p className="text-muted-foreground text-xs mb-1">Αιτούμενο Ποσό</p>
                              <p className="font-bold text-lg">€{notification.amount.toLocaleString('el-GR', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="bg-background/50 rounded-lg p-3">
                              <p className="text-muted-foreground text-xs mb-1">Τρέχων Προϋπολογισμός</p>
                              <p className="font-bold text-lg">€{notification.current_budget.toLocaleString('el-GR', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="bg-background/50 rounded-lg p-3">
                              <p className="text-muted-foreground text-xs mb-1">Ετήσια Πίστωση</p>
                              <p className="font-bold text-lg">€{notification.ethsia_pistosi.toLocaleString('el-GR', { minimumFractionDigits: 2 })}</p>
                            </div>
                          </div>
                        </div>
                        
                        {notification.status === 'pending' && (
                          <div className="flex lg:flex-col gap-2 lg:min-w-[120px]">
                            <Button
                              size="sm"
                              className="flex-1 lg:flex-none bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleApprove(notification.id)}
                              data-testid={`button-approve-${notification.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Έγκριση
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 lg:flex-none border-red-300 text-red-600 hover:bg-red-50"
                              onClick={() => handleReject(notification.id)}
                              data-testid={`button-reject-${notification.id}`}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Απόρριψη
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
