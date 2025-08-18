import React from 'react';

interface TitleCardProps {
  title: string;
  description?: string;
  setUcIds?: React.Dispatch<React.SetStateAction<string[]>>;
  children?: React.ReactNode;
}

export function TitleCard({ title, description, setUcIds, children }: TitleCardProps) {
  return (
    <div className="w-full mb-8">
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      {description && (
        <p className="text-base text-muted-foreground mt-2">{description}</p>
      )}
      {children}
    </div>
  );
}