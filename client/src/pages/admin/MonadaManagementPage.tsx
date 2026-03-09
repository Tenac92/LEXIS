import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/header';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

type MonadaRow = {
  id: number;
  unit: string;
  code: string;
  name: string;
  unit_name: unknown;
  email?: string | null;
  director?: unknown;
  address?: unknown;
  parts?: unknown;
};

type MonadaFormState = {
  id: string;
  unit: string;
  unitName: string;
  shortName: string;
  email: string;
  directorName: string;
  directorOrder: string;
  directorTitle: string;
  directorDegree: string;
  directorPrepose: string;
  directorRole: string;
  directorPhone: string;
  directorEmail: string;
  addressLine: string;
  addressCity: string;
  addressPostalCode: string;
};

type PartFormRow = {
  key: string;
  department: string;
  managerName: string;
  managerOrder: string;
  managerTitle: string;
  managerDegree: string;
  managerPrepose: string;
};

const defaultFormState: MonadaFormState = {
  id: '',
  unit: '',
  unitName: '',
  shortName: '',
  email: '',
  directorName: '',
  directorOrder: '',
  directorTitle: '',
  directorDegree: '',
  directorPrepose: '',
  directorRole: '',
  directorPhone: '',
  directorEmail: '',
  addressLine: '',
  addressCity: '',
  addressPostalCode: '',
};

const defaultPartRow = (): PartFormRow => ({
  key: `part_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  department: '',
  managerName: '',
  managerOrder: '',
  managerTitle: '',
  managerDegree: '',
  managerPrepose: '',
});

function getObjectValue(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return {};
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function readStringFromUnknown(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readFirstString(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function parsePossibleJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

type PartEntry = {
  key: string;
  label: string;
  raw: unknown;
};

function extractPartEntries(parts: unknown): PartEntry[] {
  const normalized = parsePossibleJson(parts);

  if (Array.isArray(normalized)) {
    return normalized
      .map((part, index) => {
        if (typeof part === 'string') {
          return { key: String(index), label: part.trim(), raw: part };
        }

        if (part && typeof part === 'object') {
          const partObject = part as Record<string, unknown>;
          const label = readFirstString(partObject, ['tmima', 'τμημα', 'τμήμα', 'name', 'title']);
          if (label) {
            return { key: String(index), label, raw: part };
          }
        }

        return null;
      })
      .filter((entry): entry is PartEntry => Boolean(entry && entry.label));
  }

  if (normalized && typeof normalized === 'object') {
    return Object.entries(normalized as Record<string, unknown>)
      .map(([key, value]) => {
        if (typeof value === 'string') {
          const label = value.trim();
          return label ? { key, label, raw: value } : null;
        }

        if (value && typeof value === 'object') {
          const valueObject = value as Record<string, unknown>;
          const label = readFirstString(valueObject, ['tmima', 'τμημα', 'τμήμα', 'name', 'title']) || key;
          return { key, label, raw: value };
        }

        return key ? { key, label: key, raw: value } : null;
      })
      .filter((entry): entry is PartEntry => Boolean(entry && entry.label));
  }

  if (typeof normalized === 'string' && normalized.trim()) {
    return [{ key: '0', label: normalized.trim(), raw: normalized }];
  }

  return [];
}

function createObjectOrNull(entries: Array<[string, string]>): Record<string, string> | null {
  const objectValue = entries.reduce<Record<string, string>>((accumulator, [key, value]) => {
    const trimmed = value.trim();
    if (trimmed) {
      accumulator[key] = trimmed;
    }
    return accumulator;
  }, {});

  return Object.keys(objectValue).length > 0 ? objectValue : null;
}

function toPartFormRows(parts: unknown): PartFormRow[] {
  const entries = extractPartEntries(parts);

  return entries.map((entry, index) => {
    const rawObject = getObjectValue(entry.raw);
    const managerObject = getObjectValue(rawObject.manager ?? rawObject.proistamenos ?? rawObject['προϊστάμενος']);

    return {
      key: entry.key || `part_${index + 1}`,
      department: entry.label,
      managerName: readFirstString(managerObject, ['name', 'ονομα', 'όνομα']),
      managerOrder: readFirstString(managerObject, ['order', 'σειρα', 'σειρά']),
      managerTitle: readFirstString(managerObject, ['title', 'τίτλος', 'titlos']),
      managerDegree: readFirstString(managerObject, ['degree', 'βαθμός', 'bathmos']),
      managerPrepose: readFirstString(managerObject, ['prepose', 'προσφώνηση', 'prosfonesi']),
    };
  });
}

function createPartsPayloadFromRows(rows: PartFormRow[], sourceParts?: unknown): Record<string, unknown> | string[] | null {
  const validRows = rows
    .map((row) => ({ ...row, department: row.department.trim() }))
    .filter((row) => row.department);

  if (validRows.length === 0) {
    return null;
  }

  const sourceNormalized = parsePossibleJson(sourceParts);
  const sourceObject =
    sourceNormalized && typeof sourceNormalized === 'object' && !Array.isArray(sourceNormalized)
      ? (sourceNormalized as Record<string, unknown>)
      : null;

  const hasManagerData = validRows.some(
    (row) => row.managerName.trim() || row.managerOrder.trim() || row.managerTitle.trim() || row.managerDegree.trim() || row.managerPrepose.trim(),
  );

  if (!sourceObject && !hasManagerData) {
    return validRows.map((row) => row.department);
  }

  const payload: Record<string, unknown> = {};

  validRows.forEach((row, index) => {
    const sourceKey = sourceObject && row.key in sourceObject ? row.key : `part_${index + 1}`;
    const sourceValue = sourceObject?.[sourceKey];
    const baseObject = getObjectValue(sourceValue);

    const partObject: Record<string, unknown> = {
      ...baseObject,
      tmima: row.department,
    };

    if ('τμήμα' in partObject) {
      partObject['τμήμα'] = row.department;
    }
    if ('τμημα' in partObject) {
      partObject['τμημα'] = row.department;
    }

    const managerPayload = createObjectOrNull([
      ['name', row.managerName],
      ['order', row.managerOrder],
      ['title', row.managerTitle],
      ['degree', row.managerDegree],
      ['prepose', row.managerPrepose],
    ]);

    if (managerPayload) {
      partObject.manager = managerPayload;
    } else {
      delete partObject.manager;
    }

    payload[sourceKey] = partObject;
  });

  return payload;
}

function toFormState(row: MonadaRow): MonadaFormState {
  const unitNameSource = getObjectValue(row.unit_name);
  const directorSource = getObjectValue(row.director);
  const addressSource = getObjectValue(row.address);

  return {
    id: String(row.id),
    unit: row.unit || '',
    unitName: readFirstString(unitNameSource, ['name']) || row.name || '',
    shortName: readFirstString(unitNameSource, ['short', 'code', 'label']),
    email: row.email || '',
    directorName: readFirstString(directorSource, ['name', 'director_name']),
    directorOrder: readFirstString(directorSource, ['order', 'σειρα', 'σειρά']),
    directorTitle: readFirstString(directorSource, ['title', 'τίτλος', 'titlos']),
    directorDegree: readFirstString(directorSource, ['degree', 'βαθμός', 'bathmos']),
    directorPrepose: readFirstString(directorSource, ['prepose', 'προσφώνηση', 'prosfonesi']),
    directorRole: readFirstString(directorSource, ['role', 'position']),
    directorPhone: readFirstString(directorSource, ['phone', 'tel', 'mobile']),
    directorEmail: readFirstString(directorSource, ['email']),
    addressLine: readFirstString(addressSource, ['line', 'street', 'address', 'line1', 'διευθυνση', 'διεύθυνση']),
    addressCity: readFirstString(addressSource, ['city', 'municipality', 'region', 'πολη', 'πόλη', 'Πόλη']),
    addressPostalCode: readFirstString(addressSource, ['postalCode', 'postal_code', 'zip', 'tk', 'τκ', 'τ.κ.', 'ταχυδρομικος_κωδικας', 'ταχυδρομικός_κώδικας']),
  };
}

function buildPayloadFromForm(form: MonadaFormState, partsRows: PartFormRow[], sourceParts?: unknown) {
  if (!form.unit.trim()) {
    throw new Error('Unit code is required');
  }

  if (!form.unitName.trim()) {
    throw new Error('Unit name is required');
  }

  const unitNamePayload = createObjectOrNull([
    ['name', form.unitName],
    ['short', form.shortName],
  ]);

  return {
    id: form.id.trim() ? Number(form.id) : undefined,
    unit: form.unit.trim(),
    unit_name: unitNamePayload,
    email: form.email.trim() || null,
    director: createObjectOrNull([
      ['name', form.directorName],
      ['order', form.directorOrder],
      ['title', form.directorTitle],
      ['degree', form.directorDegree],
      ['prepose', form.directorPrepose],
      ['role', form.directorRole],
      ['phone', form.directorPhone],
      ['email', form.directorEmail],
    ]),
    address: createObjectOrNull([
      ['line', form.addressLine],
      ['address', form.addressLine],
      ['διεύθυνση', form.addressLine],
      ['city', form.addressCity],
      ['πολη', form.addressCity],
      ['region', form.addressCity],
      ['postalCode', form.addressPostalCode],
      ['tk', form.addressPostalCode],
    ]),
    parts: createPartsPayloadFromRows(partsRows, sourceParts),
  };
}

export default function MonadaManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<MonadaFormState>(defaultFormState);
  const [partsRows, setPartsRows] = useState<PartFormRow[]>([]);
  const [search, setSearch] = useState('');

  const { data: monadaRows = [], isLoading } = useQuery<MonadaRow[]>({
    queryKey: ['/api/admin/monada'],
    queryFn: async () => {
      const response = await fetch('/api/admin/monada', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch Monada data');
      return response.json();
    },
  });

  const selectedRow = useMemo(
    () => monadaRows.find((row) => row.id === selectedId) || null,
    [monadaRows, selectedId],
  );

  const filteredRows = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    if (!searchValue) {
      return monadaRows;
    }

    return monadaRows.filter((row) => {
      return [row.unit, row.name, row.email || '']
        .some((value) => String(value || '').toLowerCase().includes(searchValue));
    });
  }, [monadaRows, search]);

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await fetch('/api/admin/monada', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || 'Create failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/monada'] });
      setForm(defaultFormState);
      setPartsRows([]);
      setSelectedId(null);
      toast({ title: 'Success', description: 'Monada row created' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Create failed', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const response = await fetch(`/api/admin/monada/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || 'Update failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/monada'] });
      toast({ title: 'Success', description: 'Monada row updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Update failed', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/monada/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || 'Delete failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/monada'] });
      setForm(defaultFormState);
      setPartsRows([]);
      setSelectedId(null);
      toast({ title: 'Success', description: 'Monada row deleted' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Delete failed', variant: 'destructive' });
    },
  });

  const loadRowToForm = (row: MonadaRow) => {
    setSelectedId(row.id);
    setForm(toFormState(row));
    setPartsRows(toPartFormRows(row.parts));
  };

  const clearForm = () => {
    setSelectedId(null);
    setForm(defaultFormState);
    setPartsRows([]);
  };

  const onSubmit = () => {
    try {
      const payload = buildPayloadFromForm(form, partsRows, selectedRow?.parts);
      if (selectedId) {
        updateMutation.mutate({ id: selectedId, payload });
      } else {
        createMutation.mutate(payload);
      }
    } catch (error: any) {
      toast({ title: 'Validation error', description: error.message, variant: 'destructive' });
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-red-600">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Διαχείριση Μονάδων</h1>
          <Button variant="outline" onClick={clearForm}>Νέα Μονάδα</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Λίστα Μονάδων</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div>Loading...</div>
              ) : (
                <div className="space-y-3">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Αναζήτηση με κωδικό, όνομα ή email"
                  />
                  <p className="text-xs text-muted-foreground">
                    Κάντε κλικ σε μια γραμμή για επεξεργασία των στοιχείων της μονάδας.
                  </p>
                  <div className="max-h-[500px] overflow-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((row) => (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer"
                          onClick={() => loadRowToForm(row)}
                        >
                          <TableCell>{row.id}</TableCell>
                          <TableCell>{row.unit}</TableCell>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>
                            {selectedId === row.id ? <Badge>Selected</Badge> : <Badge variant="outline">Idle</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                            Δεν βρέθηκαν μονάδες με αυτά τα κριτήρια.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{selectedRow ? `Επεξεργασία Μονάδας #${selectedRow.id}` : 'Δημιουργία Νέας Μονάδας'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>ID</Label>
                  <Input
                    value={form.id}
                    onChange={(e) => setForm((prev) => ({ ...prev, id: e.target.value }))}
                    placeholder="Αυτόματο αν μείνει κενό"
                    disabled={!!selectedId}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Συνήθως το αφήνετε κενό για αυτόματη αρίθμηση.</p>
                </div>
                <div>
                  <Label>Κωδικός Μονάδας</Label>
                  <Input
                    value={form.unit}
                    onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
                    placeholder="e.g. ΔΑΕΦΚ-ΚΕ"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Υποχρεωτικό. Μοναδικός κωδικός όπως εμφανίζεται στα έγγραφα.</p>
                </div>
              </div>

              <div>
                <Label>Ονομασία Μονάδας</Label>
                <Input
                  value={form.unitName}
                  onChange={(e) => setForm((prev) => ({ ...prev, unitName: e.target.value }))}
                  placeholder="Πλήρης επίσημη ονομασία"
                />
                <p className="text-xs text-muted-foreground mt-1">Υποχρεωτικό. Είναι το βασικό όνομα που βλέπουν οι χρήστες.</p>
              </div>

              <div>
                <Label>Σύντομο Όνομα (προαιρετικό)</Label>
                <Input
                  value={form.shortName}
                  onChange={(e) => setForm((prev) => ({ ...prev, shortName: e.target.value }))}
                  placeholder="Σύντομη ετικέτα για συμπτυγμένες προβολές"
                />
              </div>

              <div>
                <Label>Email Επικοινωνίας</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="προαιρετικό"
                />
                <p className="text-xs text-muted-foreground mt-1">Γενικό email της μονάδας για επικοινωνία.</p>
              </div>

              <div className="space-y-3">
                <Label>Στοιχεία Διευθυντή</Label>
                <div className="border rounded-md p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Διευθυντής Μονάδας</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      value={form.directorName}
                      onChange={(e) => setForm((prev) => ({ ...prev, directorName: e.target.value }))}
                      placeholder="Ονοματεπώνυμο διευθυντή"
                    />
                    <Input
                      value={form.directorOrder}
                      onChange={(e) => setForm((prev) => ({ ...prev, directorOrder: e.target.value }))}
                      placeholder="Εντολή / σειρά"
                    />
                    <Input
                      value={form.directorTitle}
                      onChange={(e) => setForm((prev) => ({ ...prev, directorTitle: e.target.value }))}
                      placeholder="Τίτλος"
                    />
                    <Input
                      value={form.directorDegree}
                      onChange={(e) => setForm((prev) => ({ ...prev, directorDegree: e.target.value }))}
                      placeholder="Βαθμός"
                    />
                    <Input
                      value={form.directorPrepose}
                      onChange={(e) => setForm((prev) => ({ ...prev, directorPrepose: e.target.value }))}
                      placeholder="Προσφώνηση (π.χ. Ο / Η)"
                    />
                    <Input
                      value={form.directorRole}
                      onChange={(e) => setForm((prev) => ({ ...prev, directorRole: e.target.value }))}
                      placeholder="Ρόλος (προαιρετικό)"
                    />
                    <Input
                      value={form.directorPhone}
                      onChange={(e) => setForm((prev) => ({ ...prev, directorPhone: e.target.value }))}
                      placeholder="Τηλέφωνο"
                    />
                    <Input
                      value={form.directorEmail}
                      onChange={(e) => setForm((prev) => ({ ...prev, directorEmail: e.target.value }))}
                      placeholder="Email διευθυντή"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Συμπληρώστε όσα στοιχεία είναι διαθέσιμα.</p>
              </div>

              <div className="space-y-3">
                <Label>Διεύθυνση</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    value={form.addressLine}
                    onChange={(e) => setForm((prev) => ({ ...prev, addressLine: e.target.value }))}
                    placeholder="Οδός / γραμμή διεύθυνσης"
                  />
                  <Input
                    value={form.addressCity}
                    onChange={(e) => setForm((prev) => ({ ...prev, addressCity: e.target.value }))}
                    placeholder="Πόλη / Περιοχή"
                  />
                  <Input
                    value={form.addressPostalCode}
                    onChange={(e) => setForm((prev) => ({ ...prev, addressPostalCode: e.target.value }))}
                    placeholder="Τ.Κ."
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label>Τμήματα & Προϊστάμενοι</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPartsRows((prev) => [...prev, defaultPartRow()])}
                  >
                    Προσθήκη Τμήματος
                  </Button>
                </div>

                <div className="space-y-3 mt-2">
                  {partsRows.length === 0 && (
                    <p className="text-xs text-muted-foreground">Δεν υπάρχουν τμήματα. Πατήστε «Προσθήκη Τμήματος».</p>
                  )}

                  {partsRows.map((row, index) => (
                    <div key={row.key} className="border rounded-md p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Τμήμα {index + 1}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPartsRows((prev) => prev.filter((item) => item.key !== row.key))}
                        >
                          Αφαίρεση
                        </Button>
                      </div>

                      <Input
                        value={row.department}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPartsRows((prev) =>
                            prev.map((item) => (item.key === row.key ? { ...item, department: value } : item)),
                          );
                        }}
                        placeholder="Όνομα τμήματος"
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                          value={row.managerName}
                          onChange={(e) => {
                            const value = e.target.value;
                            setPartsRows((prev) =>
                              prev.map((item) => (item.key === row.key ? { ...item, managerName: value } : item)),
                            );
                          }}
                          placeholder="Ονοματεπώνυμο προϊσταμένου"
                        />
                        <Input
                          value={row.managerTitle}
                          onChange={(e) => {
                            const value = e.target.value;
                            setPartsRows((prev) =>
                              prev.map((item) => (item.key === row.key ? { ...item, managerTitle: value } : item)),
                            );
                          }}
                          placeholder="Τίτλος προϊσταμένου"
                        />
                        <Input
                          value={row.managerOrder}
                          onChange={(e) => {
                            const value = e.target.value;
                            setPartsRows((prev) =>
                              prev.map((item) => (item.key === row.key ? { ...item, managerOrder: value } : item)),
                            );
                          }}
                          placeholder="Εντολή / σειρά"
                        />
                        <Input
                          value={row.managerDegree}
                          onChange={(e) => {
                            const value = e.target.value;
                            setPartsRows((prev) =>
                              prev.map((item) => (item.key === row.key ? { ...item, managerDegree: value } : item)),
                            );
                          }}
                          placeholder="Βαθμός"
                        />
                      </div>

                      <Input
                        value={row.managerPrepose}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPartsRows((prev) =>
                            prev.map((item) => (item.key === row.key ? { ...item, managerPrepose: value } : item)),
                          );
                        }}
                        placeholder="Προσφώνηση (π.χ. Ο / Η)"
                      />
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground mt-1">Μπορείτε να επεξεργαστείτε πλήρως τα στοιχεία Προϊσταμένου ανά τμήμα.</p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={onSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {selectedId ? 'Αποθήκευση Αλλαγών' : 'Δημιουργία Μονάδας'}
                </Button>
                {selectedId && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (selectedId && window.confirm('Θέλετε σίγουρα να διαγράψετε την επιλεγμένη μονάδα;')) {
                        deleteMutation.mutate(selectedId);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    Διαγραφή
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
