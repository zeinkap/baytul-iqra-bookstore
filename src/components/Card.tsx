import React from 'react';

function Card({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={`bg-white rounded-2xl shadow-lg border border-gray-100 ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={`px-6 pt-6 pb-2 border-b border-gray-100 rounded-t-2xl ${className}`}>
      {children}
    </div>
  );
}

function CardBody({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={`px-6 py-6 ${className}`}>
      {children}
    </div>
  );
}

Card.Header = CardHeader;
Card.Body = CardBody;

export { Card }; 