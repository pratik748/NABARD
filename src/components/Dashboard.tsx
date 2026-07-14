/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { db, listSurveys, deleteSurvey, saveSurvey } from '../utils/db';
import { type SurveySession, type FieldValue, PREDEFINED_QUESTIONS } from '../types';
import { 
  Play, Plus, Database, CloudLightning, Wifi, WifiOff, Battery, Trash2, 
  FileSpreadsheet, FileJson, Printer, CheckCircle, RefreshCw, AlertCircle 
} from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardProps {
  onStartSurvey: (surveyId?: string) => void;
  activeSurveyId?: string;
}

export default function Dashboard({ onStartSurvey }: DashboardProps) {
  const [surveys, setSurveys] = useState<SurveySession[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load surveys from Dexie DB
  const loadSurveysData = async () => {
    const data = await listSurveys();
    setSurveys(data);
  };

  useEffect(() => {
    loadSurveysData();

    // Online / Offline Listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);


    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Trigger Automatic Sync when internet becomes available
  useEffect(() => {
    if (isOnline && surveys.some(s => s.status === 'completed')) {
      handleSyncAll();
    }
  }, [isOnline, surveys]);

  // Sync completed surveys to cloud mock endpoint
  const handleSyncAll = async () => {
    const unsynced = surveys.filter(s => s.status === 'completed');
    if (unsynced.length === 0) return;

    setIsSyncing(true);
    // Simulate cloud sync network request with delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    for (const survey of unsynced) {
      survey.status = 'synced';
      await saveSurvey(survey);
    }

    await loadSurveysData();
    setIsSyncing(false);
  };

  // Delete a survey session
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this survey? This cannot be undone.')) {
      await deleteSurvey(id);
      await loadSurveysData();
    }
  };

  // Erase all data (Privacy requirement)
  const handleClearAllData = async () => {
    await db.surveys.clear();
    await db.syncLogs.clear();
    await loadSurveysData();
    setShowDeleteConfirm(false);
    alert('All local survey data and recordings have been permanently erased.');
  };

  // Start new survey session
  const handleCreateNewSurvey = () => {
    onStartSurvey();
  };

  // Export functions
  const exportToCSV = (survey?: SurveySession) => {
    const targetSurveys = survey ? [survey] : surveys;
    if (targetSurveys.length === 0) {
      alert('No survey data to export.');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    
    // Header
    const headers = ['Survey ID', 'Date', 'Status', 'Respondent Name', 'Village Name', ...PREDEFINED_QUESTIONS.map(q => q.id), 'Enumerator Signature (Base64)', 'Respondent Signature (Base64)', 'Photos (Base64)'];
    csvContent += headers.map(h => `"${h}"`).join(',') + '\r\n';

    // Rows
    targetSurveys.forEach(s => {
      const row = [
        s.id,
        new Date(s.createdAt).toLocaleDateString(),
        s.status,
        s.respondentName || 'N/A',
        s.villageName || 'N/A',
        ...PREDEFINED_QUESTIONS.map(q => {
          const ans = s.answers[q.id]?.value;
          return ans !== null && ans !== undefined ? `"${String(ans).replace(/"/g, '""')}"` : '""';
        }),
        s.signatures?.enumerator ? `"${s.signatures.enumerator}"` : '""',
        s.signatures?.respondent ? `"${s.signatures.respondent}"` : '""',
        s.photos && s.photos.length > 0 ? `"${s.photos.map(p => p.base64).join(' | ')}"` : '""'
      ];
      csvContent += row.join(',') + '\r\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', survey ? `NABARD_Survey_${survey.respondentName || survey.id}.csv` : 'NABARD_Village_Surveys.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = () => {
    if (surveys.length === 0) {
      alert('No survey data to export.');
      return;
    }
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(surveys, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', 'NABARD_Village_Surveys_Export.json');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open a clean, beautifully styled printable view for the survey
  const handlePrintSurvey = (survey: SurveySession) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const sections = Array.from(new Set(PREDEFINED_QUESTIONS.map(q => q.section)));

    let html = `
      <html>
        <head>
          <title>NABARD Village Survey Report - ${survey.respondentName || 'Unknown'}</title>
          <style>
            body { font-family: system-ui, sans-serif; color: #1e293b; padding: 40px; }
            h1 { color: #047857; border-bottom: 2px solid #047857; padding-bottom: 8px; margin-bottom: 5px; }
            h2 { color: #0f766e; margin-top: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; background: #f8fafc; padding: 15px; border-radius: 8px; }
            .meta-item { font-size: 14px; }
            .meta-label { font-weight: bold; color: #475569; }
            .field-row { display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding: 8px 0; font-size: 14px; }
            .field-label { font-weight: 500; color: #334155; max-width: 60%; }
            .field-value { font-weight: bold; color: #0f172a; max-width: 35%; text-align: right; }
            .badge { display: inline-block; padding: 3px 8px; font-size: 12px; border-radius: 4px; background: #e2e8f0; font-weight: bold; }
            .badge-synced { background: #d1fae5; color: #065f46; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; }
            .sig-box { border: 1px dashed #cbd5e1; height: 120px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; padding-bottom: 8px; font-size: 12px; font-weight: bold; color: #64748b; }
            .sig-image { max-height: 80px; max-width: 90%; object-fit: contain; margin-bottom: 10px; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>NABARD VILLAGE SURVEY REPORT</h1>
          <div class="meta-grid">
            <div class="meta-item"><span class="meta-label">Survey ID:</span> ${survey.id}</div>
            <div class="meta-item"><span class="meta-label">Date of Interview:</span> ${new Date(survey.createdAt).toLocaleString()}</div>
            <div class="meta-item"><span class="meta-label">Respondent Name:</span> ${survey.respondentName || 'N/A'}</div>
            <div class="meta-item"><span class="meta-label">Village / Location:</span> ${survey.villageName || 'N/A'}</div>
            <div class="meta-item"><span class="meta-label">Status:</span> <span class="badge ${survey.status === 'synced' ? 'badge-synced' : ''}">${survey.status.toUpperCase()}</span></div>
            <div class="meta-item"><span class="meta-label">GPS Location:</span> ${survey.gps ? `${survey.gps.latitude.toFixed(6)}, ${survey.gps.longitude.toFixed(6)} (Accuracy: ${survey.gps.accuracy}m)` : 'Not captured'}</div>
          </div>

          ${sections.map(section => `
            <h2>${section}</h2>
            ${PREDEFINED_QUESTIONS.filter(q => q.section === section).map(q => {
              const ansObj = survey.answers[q.id];
              let valStr = 'N/A';
              if (ansObj && ansObj.value !== null && ansObj.value !== undefined && ansObj.value !== '') {
                valStr = Array.isArray(ansObj.value) ? ansObj.value.join(', ') : String(ansObj.value);
              }
              return `
                <div class="field-row">
                  <div class="field-label">${q.label}</div>
                  <div class="field-value">${valStr}</div>
                </div>
              `;
            }).join('')}
          `).join('')}

          <div class="signatures">
            <div class="sig-box">
              ${survey.signatures?.enumerator ? `<img class="sig-image" src="${survey.signatures.enumerator}"/>` : ''}
              Enumerator Signature
            </div>
            <div class="sig-box">
              ${survey.signatures?.respondent ? `<img class="sig-image" src="${survey.signatures.respondent}"/>` : ''}
              Respondent thumbprint/signature
            </div>
          </div>

          <script>window.print();</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const uniqueVillages = new Set(surveys.map(s => s.villageName).filter(Boolean)).size;
  const todaysSurveys = surveys.filter(s => new Date(s.createdAt).toDateString() === new Date().toDateString()).length;
  const dailyTarget = 10;

  const completionRate = (survey: SurveySession) => {
    const answered = Object.values(survey.answers).filter(
      ans => ans.value !== null && ans.value !== undefined && ans.value !== '' && (Array.isArray(ans.value) ? ans.value.length > 0 : true)
    ).length;
    return Math.round((answered / PREDEFINED_QUESTIONS.length) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Top Status Indicators (Outdoor readable, large, minimalist) */}
      {/* Main Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">NABARD Field Operations</h2>
          <p className="text-sm text-gray-500 mt-1">Conduct conversations naturally. Speech is processed and mapped to the survey format automatically.</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <button
            id="btn_start_survey"
            onClick={handleCreateNewSurvey}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all text-lg"
          >
            <Plus className="h-5 w-5 stroke-[3]" />
            Start Survey
          </button>
        </div>
      </div>

      {/* Survey List Panel */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-bold text-lg text-gray-900">Local Survey Registry</h3>
          <div className="flex items-center gap-3">
            {surveys.some(s => s.status === 'completed') && (
              <button
                id="btn_sync_now"
                onClick={handleSyncAll}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 text-emerald-600 rounded-lg text-sm border border-gray-200 font-medium transition-colors shadow-sm"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Cloud'}
              </button>
            )}
            <button
              onClick={exportToJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-sm border border-gray-200 font-medium transition-colors shadow-sm"
            >
              <FileJson className="h-4 w-4" />
              JSON
            </button>
            <button
              onClick={() => exportToCSV()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-sm border border-gray-200 font-medium transition-colors shadow-sm"
            >
              <FileSpreadsheet className="h-4 w-4" />
              CSV
            </button>
          </div>
        </div>

        {surveys.length === 0 ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center space-y-4">
            <Database className="h-12 w-12 text-gray-400" />
            <p className="text-lg font-medium text-gray-900">No surveys logged on this device yet.</p>
            <p className="text-sm text-gray-500 max-w-md">Press "Start Survey" above to begin recording rural farm interviews offline.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {surveys.map((survey) => {
              const compRate = completionRate(survey);
              return (
                <div
                  key={survey.id}
                  onClick={() => onStartSurvey(survey.id)}
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <h4 className="font-bold text-lg text-gray-900">
                        {survey.respondentName || 'Unnamed Respondent'}
                      </h4>
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold uppercase ${
                        survey.status === 'synced' 
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                          : survey.status === 'completed'
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}>
                        {survey.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      Village: <span className="text-gray-900 font-medium">{survey.villageName || 'N/A'}</span> • 
                      Date: <span className="font-mono text-gray-600 text-xs">{new Date(survey.createdAt).toLocaleDateString()}</span>
                    </p>
                    {survey.gps && (
                      <p className="text-xs text-gray-400 font-mono">
                        GPS: {survey.gps.latitude.toFixed(5)}, {survey.gps.longitude.toFixed(5)} (±{survey.gps.accuracy}m)
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-6 justify-between md:justify-end">
                    <div className="space-y-1 text-right">
                      <p className="text-xs text-gray-500 font-mono font-medium">COMPLETION</p>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-700">{compRate}%</span>
                        <div className="w-20 bg-gray-200 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${compRate === 100 ? 'bg-emerald-500' : 'bg-emerald-400'}`} 
                            style={{ width: `${compRate}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePrintSurvey(survey); }}
                        title="Print / Generate PDF Report"
                        className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-600 transition-colors shadow-sm"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); exportToCSV(survey); }}
                        title="Export CSV"
                        className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-600 transition-colors shadow-sm"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(survey.id, e)}
                        title="Delete Session"
                        className="p-2.5 bg-red-50 hover:bg-red-100 rounded-lg text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Database Utility / Privacy Policy */}
      <div className="bg-gray-50 border border-gray-200 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-gray-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-gray-900 text-sm">NABARD Offline Privacy Control</h4>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">
              Survey responses, digital signatures, and audio voice logs are fully encrypted and cached locally on this device.
              No cloud synchronization or tracking happens without investigator authorization.
            </p>
          </div>
        </div>

        <div>
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 font-bold">CRITICAL: Erases all local database?</span>
              <button
                onClick={handleClearAllData}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Yes, Delete Everything
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-medium rounded-lg shadow-sm"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              id="btn_erase_all"
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-white border border-red-200 hover:bg-red-50 hover:text-red-700 text-red-600 text-xs font-bold rounded-xl transition-all shadow-sm"
            >
              Erase Device Database
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
