/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import ActiveSession from './components/ActiveSession';

export default function App() {
  const [view, setView] = useState<'dashboard' | 'session'>('dashboard');
  const [activeSurveyId, setActiveSurveyId] = useState<string | null>(null);

  const handleStartSurvey = (surveyId?: string) => {
    setActiveSurveyId(surveyId || null);
    setView('session');
  };

  const handleBackToDashboard = () => {
    setActiveSurveyId(null);
    setView('dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1">
              <img src="/nabard-logo.png" alt="NABARD Logo" className="h-10 object-contain" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-gray-900 uppercase">NABARD</h1>
              <p className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">Village Survey Assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>OFFLINE READY</span>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {view === 'dashboard' ? (
          <Dashboard 
            onStartSurvey={handleStartSurvey} 
            activeSurveyId={activeSurveyId || undefined} 
          />
        ) : (
          <ActiveSession 
            surveyId={activeSurveyId} 
            onBack={handleBackToDashboard} 
          />
        )}
      </main>

      {/* Footer bar */}
      <footer className="border-t border-gray-200 bg-white py-4 text-center mt-auto">
        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
          National Bank for Agriculture and Rural Development © 2026 • Encrypted Offline-First Survey Portal
        </p>
        <p className="text-[10px] text-gray-400 font-medium tracking-wider mt-1">
          Provided to NABARD with the courtesy of Pratik Sehwag
        </p>
      </footer>
    </div>
  );
}
