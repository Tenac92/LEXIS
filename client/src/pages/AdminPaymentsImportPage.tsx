import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { Header } from "@/components/header";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  file: z
    .any()
    .refine((file) => file instanceof FileList && file.length > 0, {
      message: "Please select an Excel file",
    })
    .refine(
      (file) => {
        if (!file || !(file instanceof FileList) || file.length === 0) {
          return true;
        }
        const fileName = file[0]?.name?.toLowerCase();
        return fileName?.endsWith(".xlsx") || fileName?.endsWith(".xls");
      },
      {
        message: "File must be an Excel file (.xlsx or .xls)",
      },
    ),
  override: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

type ImportReport = {
  total_rows: number;
  matched_rows: number;
  updated_rows: number;
  updated_payments: number;
  skipped_rows: Array<{ row: number; reason: string; details?: string }>;
  error_rows: Array<{ row: number; error: string; details?: string }>;
};

type UploadResult = {
  success: boolean;
  message: string;
  report?: ImportReport;
};

export default function AdminPaymentsImportPage() {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      file: undefined,
      override: false,
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      setIsUploading(true);
      setUploadResult(null);

      const formData = new FormData();
      formData.append("file", data.file[0]);
      formData.append("override", data.override ? "true" : "false");

      const response = await fetch("/api/imports/payments-from-excel", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // If response is not JSON, use default error message
        }
        throw new Error(errorMessage);
      }

      const typedResponse = (await response.json()) as UploadResult;

      if (!typedResponse) {
        throw new Error("No response from server");
      }

      setUploadResult(typedResponse);

      toast({
        title: typedResponse.success
          ? "Import completed"
          : "Import completed with errors",
        description: typedResponse.message,
        variant: typedResponse.success ? "default" : "destructive",
      });

      if (typedResponse.success) {
        form.reset({ file: undefined, override: false });
      }
    } catch (error) {
      console.error("Error uploading file:", error);

      toast({
        title: "Import failed",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });

      setUploadResult({
        success: false,
        message: "Failed to upload file",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">
          Beneficiary Payments Import
        </h1>
        <p className="text-muted-foreground mb-8">
          Upload an Excel file and match rows by protocol number and AFM to
          update payment_date and freetext for beneficiary payments.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-5">
            <Card>
              <CardHeader>
                <CardTitle>Upload Excel File</CardTitle>
                <CardDescription>
                  Use the exact Greek column headers listed in the instructions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6"
                  >
                    <FormField
                      control={form.control}
                      name="file"
                      render={({ field: { onChange, value, ...field } }) => (
                        <FormItem>
                          <FormLabel>Payments Excel File</FormLabel>
                          <FormControl>
                            <div className="flex flex-col gap-2">
                              <Input
                                {...field}
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={(e) => onChange(e.target.files)}
                                disabled={isUploading}
                                className="cursor-pointer"
                              />
                              {value && value[0] && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <FileSpreadsheet className="h-4 w-4" />
                                  <span>{value[0].name}</span>
                                  <span className="text-xs">
                                    ({Math.round(value[0].size / 1024)} KB)
                                  </span>
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="override"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-md border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Override existing values</FormLabel>
                            <FormDescription>
                              When enabled, payment_date and freetext are
                              overwritten even if already set.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <Button type="submit" disabled={isUploading} className="w-full">
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Import File
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
              <CardFooter className="flex flex-col items-start px-6 pt-0">
                <div className="text-sm text-muted-foreground">
                  <strong>Note:</strong> This operation is available only to
                  admin users.
                </div>
              </CardFooter>
            </Card>
          </div>

          <div className="md:col-span-7">
            {isUploading ? (
              <Card>
                <CardHeader>
                  <CardTitle>Processing File</CardTitle>
                  <CardDescription>
                    Please wait while your file is being processed...
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center py-6">
                  <Loader2 className="h-16 w-16 animate-spin text-primary" />
                </CardContent>
              </Card>
            ) : uploadResult ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    {uploadResult.success ? (
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-6 w-6 text-amber-500" />
                    )}
                    <CardTitle>
                      {uploadResult.success
                        ? "Import Completed"
                        : "Import Completed with Errors"}
                    </CardTitle>
                  </div>
                  <CardDescription>{uploadResult.message}</CardDescription>
                </CardHeader>
                <CardContent>
                  {uploadResult.report && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <div className="rounded-lg border p-3 text-center">
                          <div className="text-2xl font-bold">
                            {uploadResult.report.total_rows}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Rows Read
                          </div>
                        </div>
                        <div className="rounded-lg border p-3 text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {uploadResult.report.matched_rows}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Rows Matched
                          </div>
                        </div>
                        <div className="rounded-lg border p-3 text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {uploadResult.report.updated_rows}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Rows Updated
                          </div>
                        </div>
                        <div className="rounded-lg border p-3 text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {uploadResult.report.updated_payments}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Payments Updated
                          </div>
                        </div>
                      </div>

                      {uploadResult.report.error_rows.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium mb-2">
                            Error Rows ({uploadResult.report.error_rows.length})
                          </h3>
                          <div className="max-h-60 overflow-y-auto rounded-md border bg-muted/50">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[80px]">Row</TableHead>
                                  <TableHead>Error</TableHead>
                                  <TableHead>Details</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {uploadResult.report.error_rows.map(
                                  (row, index) => (
                                    <TableRow key={index}>
                                      <TableCell>{row.row}</TableCell>
                                      <TableCell className="text-red-500">
                                        {row.error}
                                      </TableCell>
                                      <TableCell className="text-xs">
                                        {row.details || "-"}
                                      </TableCell>
                                    </TableRow>
                                  ),
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}

                      {uploadResult.report.skipped_rows.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium mb-2">
                            Skipped Rows ({uploadResult.report.skipped_rows.length})
                          </h3>
                          <div className="max-h-60 overflow-y-auto rounded-md border bg-muted/50">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[80px]">Row</TableHead>
                                  <TableHead>Reason</TableHead>
                                  <TableHead>Details</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {uploadResult.report.skipped_rows.map(
                                  (row, index) => (
                                    <TableRow key={index}>
                                      <TableCell>{row.row}</TableCell>
                                      <TableCell>{row.reason}</TableCell>
                                      <TableCell className="text-xs">
                                        {row.details || "-"}
                                      </TableCell>
                                    </TableRow>
                                  ),
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Import Instructions</CardTitle>
                  <CardDescription>
                    Ensure your Excel file includes the exact columns below.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertTitle>Required Columns</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4 mt-2 space-y-1">
                        <li>Αριθμός Παραστατικού</li>
                        <li>ΑΦΜ Δικαιούχου Πληρωμής</li>
                        <li>Ημ/νία Πρωτοκόλλου/Εντάλματος</li>
                        <li>EPS</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                  <Alert>
                    <AlertTitle>Matching Rules</AlertTitle>
                    <AlertDescription>
                      Rows are matched only when both protocol number and AFM
                      match. AFM values are normalized to 9 digits by padding
                      leading zeros.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
