
import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner.js';

function DocumentViewer({ documentId }) {
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch document');
        }
        const data = await response.json();
        setDocument(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (documentId) {
      fetchDocument();
    }
  }, [documentId]);

  if (loading) return React.createElement(LoadingSpinner);
  if (error) return React.createElement('div', { className: 'text-red-600' }, error);
  if (!document) return React.createElement('div', null, 'No document found');

  return React.createElement('div', 
    { className: 'bg-white rounded-lg shadow p-6' },
    [
      React.createElement('h2', 
        { className: 'text-2xl font-bold mb-4', key: 'title' }, 
        document.title
      ),
      React.createElement('div', 
        { className: 'space-y-4', key: 'content' },
        [
          React.createElement('div', 
            { className: 'grid grid-cols-2 gap-4', key: 'details' },
            [
              React.createElement('div', { key: 'left-col' }, [
                React.createElement('h3', { className: 'font-semibold', key: 'details-title' }, 'Document Details'),
                React.createElement('p', { key: 'status' }, `Status: ${document.status}`),
                React.createElement('p', { key: 'created' }, `Created: ${new Date(document.created_at).toLocaleDateString()}`),
                React.createElement('p', { key: 'updated' }, `Last Updated: ${new Date(document.updated_at).toLocaleDateString()}`)
              ]),
              React.createElement('div', { key: 'right-col' }, [
                React.createElement('h3', { className: 'font-semibold', key: 'project-title' }, 'Project Information'),
                React.createElement('p', { key: 'mis' }, `MIS: ${document.mis}`),
                React.createElement('p', { key: 'amount' }, `Amount: €${document.amount?.toLocaleString()}`),
                React.createElement('p', { key: 'unit' }, `Unit: ${document.unit}`)
              ])
            ]
          ),
          document.content && React.createElement('div', 
            { className: 'mt-6', key: 'document-content' },
            [
              React.createElement('h3', { className: 'font-semibold mb-2', key: 'content-title' }, 'Content'),
              React.createElement('div', {
                className: 'p-4 bg-gray-50 rounded',
                dangerouslySetInnerHTML: { __html: document.content }
              })
            ]
          ),
          document.attachments?.length > 0 && React.createElement('div',
            { className: 'mt-6', key: 'attachments' },
            [
              React.createElement('h3', { className: 'font-semibold mb-2', key: 'attachments-title' }, 'Attachments'),
              React.createElement('ul', 
                { className: 'list-disc list-inside', key: 'attachments-list' },
                document.attachments.map((attachment, index) =>
                  React.createElement('li', { key: index },
                    React.createElement('a', {
                      href: attachment.url,
                      className: 'text-blue-600 hover:underline',
                      target: '_blank',
                      rel: 'noopener noreferrer'
                    }, attachment.name)
                  )
                )
              )
            ]
          )
        ]
      )
    ]
  );
}

export default DocumentViewer;
