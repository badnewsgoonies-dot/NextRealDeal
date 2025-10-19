import React from 'react';
import { Card } from '../components/common/Card';

export function Settings(): React.ReactElement {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Settings</h1>

      <Card>
        <h3 className="text-lg font-semibold text-text-primary mb-4">Game Settings</h3>
        <p className="text-text-secondary">Game settings coming soon...</p>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-text-primary mb-4">Profile</h3>
        <p className="text-text-secondary">Profile settings coming soon...</p>
      </Card>
    </div>
  );
}