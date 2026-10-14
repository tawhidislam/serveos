import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { format, isSameDay, parseISO, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  CalendarDays, Users, Clock, Search, CheckCircle2, XCircle, Ban,
  Calendar as CalendarIcon, UserCheck, AlertCircle, List, LayoutGrid,
} from 'lucide-react';
import DataPagination, { usePagination } from '@/components/admin/DataPagination';


type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no-show';

const statusConfig: Record<ReservationStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2; dotColor: string }> = {
  pending: { label: 'Pending', variant: 'secondary', icon: AlertCircle, dotColor: 'bg-amber-500' },
  confirmed: { label: 'Confirmed', variant: 'default', icon: CheckCircle2, dotColor: 'bg-emerald-500' },
  cancelled: { label: 'Cancelled', variant: 'destructive', icon: XCircle, dotColor: 'bg-destructive' },
  completed: { label: 'Completed', variant: 'outline', icon: UserCheck, dotColor: 'bg-blue-500' },
  'no-show': { label: 'No Show', variant: 'destructive', icon: Ban, dotColor: 'bg-destructive' },
};

export default function ReservationsManagement() {
  const queryClient = useQueryClient();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [view, setView] = useState<string>('list');

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ['admin-reservations', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('reservation_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('reservations')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reservations'] });
      toast.success('Reservation updated');
    },
    onError: () => toast.error('Failed to update reservation'),
  });

  const filtered = reservations.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.guest_name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.phone && r.phone.includes(q))
      );
    }
    return true;
  });

  // Dates that have reservations (for calendar dots)
  const reservationsByDate = useMemo(() => {
    const map = new Map<string, typeof reservations>();
    reservations.forEach((r) => {
      const key = r.reservation_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return map;
  }, [reservations]);

  // Reservations for the selected calendar date
  const selectedDateReservations = useMemo(() => {
    const key = format(selectedDate, 'yyyy-MM-dd');
    return (reservationsByDate.get(key) || []).filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      return true;
    });
  }, [selectedDate, reservationsByDate, statusFilter]);

  // Dates that have at least one reservation
  const datesWithReservations = useMemo(() => {
    return Array.from(reservationsByDate.keys()).map((d) => parseISO(d));
  }, [reservationsByDate]);

  const stats = {
    total: reservations.length,
    pending: reservations.filter((r) => r.status === 'pending').length,
    confirmed: reservations.filter((r) => r.status === 'confirmed').length,
    today: reservations.filter(
      (r) => r.reservation_date === format(new Date(), 'yyyy-MM-dd')
    ).length,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reservations</h1>
          <p className="text-muted-foreground text-sm">Manage customer bookings</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: stats.total, icon: CalendarDays, color: 'text-primary' },
            { label: 'Pending', value: stats.pending, icon: AlertCircle, color: 'text-amber-500' },
            { label: 'Confirmed', value: stats.confirmed, icon: CheckCircle2, color: 'text-emerald-500' },
            { label: 'Today', value: stats.today, icon: CalendarIcon, color: 'text-blue-500' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`h-8 w-8 ${s.color}`} />
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* View Tabs */}
        <Tabs value={view} onValueChange={setView}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="list" className="flex-1 gap-1.5 sm:flex-none">
                <List className="h-4 w-4" />
                List
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex-1 gap-1.5 sm:flex-none">
                <LayoutGrid className="h-4 w-4" />
                Calendar
              </TabsTrigger>
            </TabsList>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-11 w-full sm:h-9 sm:w-[160px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="no-show">No Show</SelectItem>
              </SelectContent>
            </Select>
          </div>


          {/* LIST VIEW */}
          <TabsContent value="list">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">All Reservations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or phone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p>No reservations found</p>
                  </div>
                ) : (
                  <ReservationTable reservations={filtered} updateStatus={updateStatus} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CALENDAR VIEW */}
          <TabsContent value="calendar">
            <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
              {/* Calendar */}
              <Card className="self-start">
                <CardContent className="p-4">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => d && setSelectedDate(d)}
                    className={cn("p-3 pointer-events-auto")}
                    modifiers={{
                      hasReservation: datesWithReservations,
                    }}
                    modifiersClassNames={{
                      hasReservation: 'reservation-dot',
                    }}
                  />
                  <style>{`
                    .reservation-dot .rdp-day_button::after,
                    .reservation-dot > button::after,
                    .reservation-dot::after {
                      content: '';
                      position: absolute;
                      bottom: 2px;
                      left: 50%;
                      transform: translateX(-50%);
                      width: 5px;
                      height: 5px;
                      border-radius: 50%;
                      background: hsl(var(--primary));
                    }
                    .reservation-dot,
                    .reservation-dot .rdp-day_button,
                    .reservation-dot > button {
                      position: relative;
                    }
                  `}</style>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span>Has reservations</span>
                  </div>
                </CardContent>
              </Card>

              {/* Day detail */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                    <Badge variant="secondary" className="ml-auto">
                      {selectedDateReservations.length} booking{selectedDateReservations.length !== 1 ? 's' : ''}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    </div>
                  ) : selectedDateReservations.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      <p>No reservations for this date</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedDateReservations
                        .sort((a, b) => a.reservation_time.localeCompare(b.reservation_time))
                        .map((r) => {
                          const cfg = statusConfig[r.status as ReservationStatus] || statusConfig.pending;
                          const StatusIcon = cfg.icon;
                          return (
                            <div
                              key={r.id}
                              className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
                            >
                              {/* Time pill */}
                              <div className="shrink-0 text-center min-w-[60px]">
                                <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                  {r.reservation_time}
                                </div>
                              </div>

                              {/* Divider */}
                              <div className={cn("w-1 self-stretch rounded-full shrink-0", cfg.dotColor)} />

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-foreground">{r.guest_name}</p>
                                  <Badge variant={cfg.variant} className="gap-1 text-[10px]">
                                    <StatusIcon className="h-3 w-3" />
                                    {cfg.label}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {r.party_size} guest{r.party_size !== 1 ? 's' : ''}
                                  </span>
                                  <span>{r.email}</span>
                                  {r.phone && <span>{r.phone}</span>}
                                </div>
                                {r.notes && (
                                  <p className="text-xs text-muted-foreground mt-1 italic truncate">
                                    {r.notes}
                                  </p>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="shrink-0">
                                <Select
                                  value={r.status}
                                  onValueChange={(status) =>
                                    updateStatus.mutate({ id: r.id, status })
                                  }
                                >
                                  <SelectTrigger className="w-[120px] h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="confirmed">Confirm</SelectItem>
                                    <SelectItem value="cancelled">Cancel</SelectItem>
                                    <SelectItem value="completed">Complete</SelectItem>
                                    <SelectItem value="no-show">No Show</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

/* Extracted table for the list view */
function ReservationTable({
  reservations,
  updateStatus,
}: {
  reservations: any[];
  updateStatus: any;
}) {
  const pager = usePagination(reservations, 25);

  return (
    <div>
      <Table stickyHeader>
        <TableHeader>
          <TableRow>
            <TableHead>Guest</TableHead>
            <TableHead>Date & Time</TableHead>
            <TableHead>Party</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pager.pageItems.map((r) => {

            const cfg = statusConfig[r.status as ReservationStatus] || statusConfig.pending;
            const StatusIcon = cfg.icon;
            return (
              <TableRow key={r.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-foreground">{r.guest_name}</p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                    {r.phone && (
                      <p className="text-xs text-muted-foreground">{r.phone}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">
                      {format(new Date(r.reservation_date + 'T00:00:00'), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{r.reservation_time}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{r.party_size}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={cfg.variant} className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {cfg.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-muted-foreground max-w-[150px] truncate">
                    {r.notes || '—'}
                  </p>
                </TableCell>
                <TableCell className="text-right">
                  <Select
                    value={r.status}
                    onValueChange={(status) =>
                      updateStatus.mutate({ id: r.id, status })
                    }
                  >
                    <SelectTrigger className="w-[130px] h-8 text-xs ml-auto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirm</SelectItem>
                      <SelectItem value="cancelled">Cancel</SelectItem>
                      <SelectItem value="completed">Complete</SelectItem>
                      <SelectItem value="no-show">No Show</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <DataPagination
        page={pager.page}
        pageCount={pager.pageCount}
        pageSize={pager.pageSize}
        total={pager.total}
        from={pager.from}
        to={pager.to}
        onPageChange={pager.setPage}
        onPageSizeChange={pager.setPageSize}
      />
    </div>

  );
}
