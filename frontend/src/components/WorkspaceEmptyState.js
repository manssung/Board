import React from 'react';

export default function WorkspaceEmptyState({ className, icon, title, description }) {
  return (
    <div className={className}>
      <span aria-hidden="true">{icon}</span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}
