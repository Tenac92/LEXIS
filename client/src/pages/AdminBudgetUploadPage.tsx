import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Upload, AlertTriangle, FileSpreadsheet, CheckCircle, XCircle } from 'lucide-react';
import { Header } from '@/components/header';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Schema for form validation
const formSchema = z.object({
  file: z.any()
    .refine((file) => file instanceof FileList && file.length > 0, {
      message: 'Please select an Excel file (.xlsx or .xls)',
    })
    .refine((file) => {
      const fileName = file[0]?.name?.toLowerCase();
      return fileName?.endsWith('.xlsx') || fileName?.endsWith('.xls');
    }, {
      message: 'File must be an Excel file (.xlsx or .xls)',
    }),
});

type FormValues = z.infer<typeof formSchema>;

export default function AdminBudgetUploadPage() {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    status: boolean;
    message: string;
    stats?: {
      success: number;
      failures: number;
      errors: string[];
      failedRecords?: {
        row: number | any;
        mis?: string;
        na853?: string;
        error: string;
      }[];
    }
  } | null>(null);

  // Setup form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      file: undefined,
    },
  });

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    try {
      setIsUploading(true);
      setUploadResult(null);

      // Create FormData to send file
      const formData = new FormData();
      formData.append('file', data.file[0]);

      // Upload file - use direct fetch for multipart/form-data instead of apiRequest
      const response = await fetch('/api/budget/upload', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type, let the browser set it with boundary for FormData
      }).then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      });

      if (!response) {
        throw new Error('No response from server');
      }

      // Type assertion for response
      const typedResponse = response as {
        status: boolean;
        message: string;
        stats?: {
          success: number;
          failures: number;
          errors: string[];
          failedRecords?: {
            row: number | any;
            mis?: string;
            na853?: string;
            error: string;
          }[];
        }
      };

      // Handle successful response
      setUploadResult(typedResponse);
      
      // Show toast notification
      toast({
        title: typedResponse.status ? 'Upload Successful' : 'Upload Completed with Issues',
        description: typedResponse.message,
        variant: typedResponse.status ? 'default' : 'destructive',
      });

      // Reset form if successful
      if (typedResponse.status) {
        form.reset();
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      
      // Show error toast
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
      
      // Set error result
      setUploadResult({
        status: false,
        message: 'Failed to upload file',
        stats: {
          success: 0,
          failures: 1,
          errors: [error instanceof Error ? error.message : 'Unknown error']
        }
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">Budget Data Upload</h1>
        <p className="text-muted-foreground mb-8">
          Upload Excel files to update budget data for projects. This tool processes Excel files and 
          synchronizes the data with the project_budget table in the database.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Upload Form */}
          <div className="md:col-span-5">
            <Card>
              <CardHeader>
                <CardTitle>Upload Excel File</CardTitle>
                <CardDescription>
                  Upload an Excel file (.xlsx or .xls) containing budget data. 
                  The file should include MIS and NA853 columns along with budget values.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="file"
                      render={({ field: { onChange, value, ...field } }) => (
                        <FormItem>
                          <FormLabel>Excel File</FormLabel>
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
                                  <span className="text-xs">({Math.round(value[0].size / 1024)} KB)</span>
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" disabled={isUploading} className="w-full">
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload File
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
              <CardFooter className="flex flex-col items-start px-6 pt-0">
                <div className="text-sm text-muted-foreground">
                  <strong>Note:</strong> This operation is available only to admin users.
                </div>
              </CardFooter>
            </Card>
          </div>

          {/* Upload Status and Results */}
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
                    {uploadResult.status ? (
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-6 w-6 text-amber-500" />
                    )}
                    <CardTitle>
                      {uploadResult.status ? 'Upload Successful' : 'Upload Completed with Issues'}
                    </CardTitle>
                  </div>
                  <CardDescription>
                    {uploadResult.message}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {uploadResult.stats && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg border p-3 text-center">
                          <div className="text-2xl font-bold text-green-500">{uploadResult.stats.success}</div>
                          <div className="text-sm text-muted-foreground">Records Processed</div>
                        </div>
                        <div className="rounded-lg border p-3 text-center">
                          <div className="text-2xl font-bold text-amber-500">{uploadResult.stats.failures}</div>
                          <div className="text-sm text-muted-foreground">Failed Records</div>
                        </div>
                      </div>

                      {/* General Error Information */}
                      {uploadResult.stats.errors.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium mb-2">Error Messages:</h3>
                          <div className="max-h-60 overflow-y-auto rounded-md border bg-muted/50 mb-4">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[50px]">#</TableHead>
                                  <TableHead>Error Message</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {uploadResult.stats.errors.map((error, index) => (
                                  <TableRow key={index}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell className="font-mono text-xs">{error}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                      
                      {/* Detailed Failed Records Table */}
                      {uploadResult.stats.failedRecords && uploadResult.stats.failedRecords.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium mb-2">Failed Records Details:</h3>
                          <div className="max-h-60 overflow-y-auto rounded-md border bg-muted/50">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[50px]">Record</TableHead>
                                  <TableHead className="w-[120px]">MIS</TableHead>
                                  <TableHead className="w-[120px]">NA853</TableHead>
                                  <TableHead>Error</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {uploadResult.stats.failedRecords.map((record, index) => (
                                  <TableRow key={index}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell className="font-mono text-xs">{record.mis || 'N/A'}</TableCell>
                                    <TableCell className="font-mono text-xs">{record.na853 || 'N/A'}</TableCell>
                                    <TableCell className="text-xs text-red-500">{record.error}</TableCell>
                                  </TableRow>
                                ))}
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
                  <CardTitle>Upload Instructions</CardTitle>
                  <CardDescription>
                    Follow these guidelines for successful data upload
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertTitle>File Format Requirements</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4 mt-2 space-y-1">
                        <li>File must be Excel format (.xlsx or .xls)</li>
                        <li>The file must contain columns for MIS and NA853 codes</li>
                        <li>Columns for budget data (quarterly and annual values) are required</li>
                        <li>The first worksheet in the file will be processed</li>
                      </ul>
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Expected Column Names</h3>
                    <p className="text-sm text-muted-foreground">
                      The system will attempt to identify columns based on the following names (case-insensitive):
                    </p>
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[180px]">Data Field</TableHead>
                            <TableHead>Recognized Column Names</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell>MIS</TableCell>
                            <TableCell>MIS, ID</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>NA853</TableCell>
                            <TableCell>NA853, ΚΩΔΙΚΟΣ, KODIKOS</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Annual Budget</TableCell>
                            <TableCell>ETHSIA, ΕΤΗΣΙΑ, ΠΙΣΤΩΣΗ</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Quarterly Budgets</TableCell>
                            <TableCell>Q1, Q2, Q3, Q4, ΤΡΙΜΗΝΟ 1, ΤΡΙΜΗΝΟ 2, etc.</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}