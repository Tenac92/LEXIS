import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function TestSecondaryText() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [documentId, setDocumentId] = useState<string>('');
  
  // Form data
  const [firstname, setFirstname] = useState<string>('Test');
  const [lastname, setLastname] = useState<string>('User');
  const [fathername, setFathername] = useState<string>('TestFather');
  const [afm, setAfm] = useState<string>('123456789');
  const [amount, setAmount] = useState<string>('100');
  const [secondaryText, setSecondaryText] = useState<string>('Αυτό είναι το ελεύθερο κείμενο');
  
  async function handleSubmitTest() {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiRequest('/api/test/secondary-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipients: [
            {
              firstname,
              lastname,
              fathername,
              afm,
              amount: parseFloat(amount),
              secondary_text: secondaryText
            }
          ]
        })
      });
      
      setResult(response);
    } catch (err) {
      console.error('Test error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }
  
  async function handleGetTest() {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiRequest('/api/test/secondary-text');
      setResult(response);
    } catch (err) {
      console.error('Test error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }
  
  async function handleCheckDocument() {
    if (!documentId || isNaN(parseInt(documentId))) {
      setError('Please enter a valid document ID');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiRequest(`/api/test/document/${documentId}/secondary-text`);
      setResult(response);
    } catch (err) {
      console.error('Test error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div className="container py-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Secondary Text Test</h1>
      <p className="text-gray-500 mb-8">
        This page is used to test the secondary_text feature implementation. 
        It checks if the secondary_text field is correctly stored in the database.
      </p>
      
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Test Recipient with Secondary Text</CardTitle>
            <CardDescription>
              This will create a test record with secondary_text to verify if it's saved correctly in the database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">First Name</label>
                <Input 
                  value={firstname} 
                  onChange={e => setFirstname(e.target.value)}
                  placeholder="First Name" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Last Name</label>
                <Input 
                  value={lastname} 
                  onChange={e => setLastname(e.target.value)}
                  placeholder="Last Name" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Father's Name</label>
                <Input 
                  value={fathername} 
                  onChange={e => setFathername(e.target.value)}
                  placeholder="Father's Name" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">AFM</label>
                <Input 
                  value={afm} 
                  onChange={e => setAfm(e.target.value)}
                  placeholder="AFM" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount</label>
                <Input 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Amount" 
                  type="number"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Secondary Text</label>
                <Input 
                  value={secondaryText} 
                  onChange={e => setSecondaryText(e.target.value)}
                  placeholder="Secondary Text (Ελεύθερο Κείμενο)" 
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleSubmitTest} 
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Testing...' : 'Test Secondary Text'}
            </Button>
          </CardFooter>
        </Card>
        
        <div className="flex gap-4">
          <Card className="flex-1">
            <CardHeader>
              <CardTitle>Get Test Records</CardTitle>
              <CardDescription>
                View the most recent test records to check if secondary_text was saved.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button 
                onClick={handleGetTest} 
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Loading...' : 'Get Test Records'}
              </Button>
            </CardFooter>
          </Card>
          
          <Card className="flex-1">
            <CardHeader>
              <CardTitle>Check Document</CardTitle>
              <CardDescription>
                Check an existing document to see if it has secondary_text fields.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input 
                value={documentId} 
                onChange={e => setDocumentId(e.target.value)}
                placeholder="Document ID" 
                type="number"
              />
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleCheckDocument} 
                disabled={loading || !documentId}
                className="w-full"
              >
                {loading ? 'Checking...' : 'Check Document'}
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {result && (
          <div className="p-4 border rounded-md bg-gray-50">
            <h2 className="text-lg font-bold mb-2">Result:</h2>
            <Separator className="my-2" />
            <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}