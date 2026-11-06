import React, { useState, useRef, useMemo } from 'react';
import { Contact } from '../types';
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  MessageSquare,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Send,
  Sparkles,
  Phone,
  Tag,
  UploadCloud,
  Download,
  Upload,
  X,
  FileText,
  Check,
} from 'lucide-react';

interface ContactsViewProps {
  contacts: Contact[];
  onOpenWhatsApp: (contact?: Contact | null) => void;
  onAddContact: (contact: Omit<Contact, 'id' | 'createdAt'>) => void;
  onImportCsv: (csvContent: string) => void;
  onGroupGrabberExtract?: (extractedContacts: Array<{ name: string; phoneNumber: string; tag: string }>) => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  onOpenWhatsApp,
  onAddContact,
  onImportCsv,
  onGroupGrabberExtract,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showGrabberModal, setShowGrabberModal] = useState(false);

  // Group Grabber state
  const [grabberRawText, setGrabberRawText] = useState(
    `[12/10/26, 10:15] +91 98123 45678: Hello team\n[12/10/26, 10:18] +91 97234 56789: Interested in demo\n+91 99345 67890\n9845012345`,
  );
  const [grabberGroupName, setGrabberGroupName] = useState('Extracted Group Leads');

  // New Contact form states
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('+91');
  const [newTag, setNewTag] = useState('New Inquiries');
  const [newConsent, setNewConsent] = useState(true);

  // CSV import state
  const [csvImportTab, setCsvImportTab] = useState<'FILE' | 'PASTE'>('FILE');
  const [selectedCsvFile, setSelectedCsvFile] = useState<{ name: string; size: number } | null>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState(
    `name,phone,tag\nRahul Mehta,+919811122233,Diwali Leads\nSneha Sen,+919822233344,Online Store`,
  );
  const [csvOptInAccepted, setCsvOptInAccepted] = useState(true);

  // File selection reader
  const handleCsvFileSelect = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string) || '';
      setCsvText(content);
      setSelectedCsvFile({ name: file.name, size: file.size });
    };
    reader.readAsText(file);
  };

  // Sample CSV generator for 1-click download
  const handleDownloadSampleCsv = () => {
    const sampleCsv = `Name,Phone,Tag\nVijay Kumar,+919876543210,VIP Customer\nAnanya Sen,+918899001122,Festive Lead\nRahul Sharma,9123456789,Inquiries\nPriya Patel,+91 99887 76655,Wholesale\nKiran Reddy,9876501234,Support`;
    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'whatsapp_contacts_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Live parsed preview
  const parsedPreview = useMemo(() => {
    const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return { total: 0, previewRows: [] };

    const headerParts = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
    let nameIdx = headerParts.findIndex((h) => h.includes('name'));
    let phoneIdx = headerParts.findIndex(
      (h) => h.includes('phone') || h.includes('mobile') || h.includes('contact') || h.includes('num'),
    );
    let tagIdx = headerParts.findIndex(
      (h) => h.includes('tag') || h.includes('group') || h.includes('category') || h.includes('label'),
    );

    let startIndex = 1;
    if (nameIdx === -1 && phoneIdx === -1) {
      nameIdx = 0;
      phoneIdx = 1;
      tagIdx = 2;
      startIndex = 0;
    } else {
      if (nameIdx === -1) nameIdx = 0;
      if (phoneIdx === -1) phoneIdx = 1;
      if (tagIdx === -1) tagIdx = 2;
    }

    const rows: Array<{ name: string; phone: string; tag: string }> = [];
    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= 2) {
        const rawPhone = parts[phoneIdx] || parts[1] || '';
        const digits = rawPhone.replace(/[^\d+]/g, '');
        if (digits.replace(/[^\d]/g, '').length >= 7) {
          let normalized = digits;
          if (!digits.startsWith('+')) {
            const clean = digits.replace(/[^\d]/g, '');
            if (clean.length === 10) normalized = `+91${clean}`;
            else if (clean.length === 12 && clean.startsWith('91')) normalized = `+${clean}`;
            else normalized = `+${clean}`;
          }
          rows.push({
            name: parts[nameIdx] || parts[0] || 'Customer',
            phone: normalized,
            tag: parts[tagIdx] || parts[2] || 'CSV Import',
          });
        }
      }
    }
    return {
      total: rows.length,
      previewRows: rows.slice(0, 4),
    };
  }, [csvText]);

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phoneNumber.includes(searchTerm) ||
      c.tag.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleCreateContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPhone) return;

    onAddContact({
      name: newName,
      phoneNumber: newPhone,
      tag: newTag,
      optInConsent: newConsent,
      isSuppressed: false,
    });

    setNewName('');
    setNewPhone('+91');
    setShowAddModal(false);
  };

  const handleImportCsv = () => {
    if (!csvOptInAccepted) return;
    onImportCsv(csvText);
    setShowCsvModal(false);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-[#128C7E]" />
            Customer CRM & Contacts
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage your audience, record explicit opt-ins, and trigger verified WhatsApp campaigns.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5">
          {/* Saasyto-inspired WhatsApp Group Grabber */}
          <button
            onClick={() => setShowGrabberModal(true)}
            className="px-3 py-2 border border-emerald-300 bg-emerald-50/60 rounded-xl text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition flex items-center gap-1.5 shadow-2xs"
            title="Extract phone numbers from WhatsApp groups"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Group Grabber
          </button>

          <button
            onClick={() => setShowCsvModal(true)}
            className="px-3.5 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Import CSV
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 shadow-2xs"
          >
            <UserPlus className="w-4 h-4 text-slate-600" />
            Add Contact
          </button>

          {/* Primary Call to Action: Click on WhatsApp */}
          <button
            onClick={() => onOpenWhatsApp(null)}
            className="px-4 py-2 bg-[#25D366] hover:bg-[#1da851] text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-2 active:scale-95"
          >
            <MessageSquare className="w-4 h-4" />
            Launch WhatsApp Campaign
          </button>
        </div>
      </div>

      {/* Filter Bar & Search */}
      <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search contacts by name, phone or tag..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#128C7E] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{filteredContacts.length}</span> of{' '}
          <span className="font-semibold text-slate-700">{contacts.length}</span> contacts
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Customer Name</th>
                <th className="px-6 py-4">Phone Number (+91)</th>
                <th className="px-6 py-4">Group / Tag</th>
                <th className="px-6 py-4">Consent Status</th>
                <th className="px-6 py-4">Suppression</th>
                <th className="px-6 py-4 text-right">Instant Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{contact.name}</div>
                    <div className="text-xs text-slate-400">Added {contact.createdAt}</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-700">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {contact.phoneNumber}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-medium">
                      <Tag className="w-3 h-3 text-slate-400" />
                      {contact.tag}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {contact.optInConsent ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-semibold border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Opted In
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full font-semibold border border-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Pending Opt-In
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {contact.isSuppressed ? (
                      <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-semibold border border-red-200">
                        Suppressed (STOP)
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Clear</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {/* The prominent WhatsApp Action Button on each contact! */}
                    <button
                      onClick={() => onOpenWhatsApp(contact)}
                      disabled={contact.isSuppressed}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition ${
                        contact.isSuppressed
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-[#25D366]/10 text-[#075E54] hover:bg-[#25D366] hover:text-white border border-[#25D366]/30'
                      }`}
                      title={contact.isSuppressed ? 'Contact has opted out via STOP' : 'Send WhatsApp Message'}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Send WhatsApp
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Add New CRM Contact</h3>
            <form onSubmit={handleCreateContact} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#128C7E] focus:outline-none"
                  placeholder="e.g. Amit Sharma"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number (+91)
                </label>
                <input
                  type="text"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#128C7E] focus:outline-none"
                  placeholder="+919876543210"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Audience Group / Tag
                </label>
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#128C7E] focus:outline-none"
                  placeholder="e.g. Mumbai Retail"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="consentCheckbox"
                  checked={newConsent}
                  onChange={(e) => setNewConsent(e.target.checked)}
                  className="w-4 h-4 text-[#128C7E] rounded focus:ring-0"
                />
                <label htmlFor="consentCheckbox" className="text-xs text-slate-600">
                  Recipient has provided explicit opt-in consent for WhatsApp messaging.
                </label>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#128C7E] hover:bg-[#075E54] text-white rounded-lg text-sm font-semibold"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Import Contacts via CSV
                  </h3>
                  <p className="text-xs text-slate-500">
                    Upload an Excel/CSV spreadsheet or paste contacts directly.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Template Download & Column Guide */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-slate-700">Supported Columns: </span>
                <code className="text-[#128C7E] bg-emerald-50 px-1.5 py-0.5 rounded font-mono font-bold">
                  Name, Phone, Tag
                </code>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  10-digit Indian numbers are automatically prefixed with +91
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadSampleCsv}
                className="px-2.5 py-1.5 bg-white border border-slate-300 hover:border-emerald-500 hover:text-emerald-700 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs shrink-0 ml-2"
                title="Download sample template file"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                Sample Template
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex border-b border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCsvImportTab('FILE')}
                className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
                  csvImportTab === 'FILE'
                    ? 'border-[#128C7E] text-[#128C7E]'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                Upload CSV File
              </button>
              <button
                type="button"
                onClick={() => setCsvImportTab('PASTE')}
                className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
                  csvImportTab === 'PASTE'
                    ? 'border-[#128C7E] text-[#128C7E]'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <FileText className="w-4 h-4" />
                Paste Text / Spreadsheet Rows
              </button>
            </div>

            {/* Tab 1: Upload File */}
            {csvImportTab === 'FILE' && (
              <div className="space-y-3">
                <input
                  type="file"
                  ref={csvFileInputRef}
                  accept=".csv,text/csv,text/plain"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCsvFileSelect(f);
                  }}
                  className="hidden"
                />

                <div
                  onClick={() => csvFileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleCsvFileSelect(f);
                  }}
                  className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50/50 hover:bg-emerald-50/20 group"
                >
                  <UploadCloud className="w-10 h-10 text-slate-400 group-hover:text-emerald-600 mx-auto mb-2 transition" />
                  <div className="text-sm font-bold text-slate-700 group-hover:text-emerald-800">
                    {selectedCsvFile ? selectedCsvFile.name : 'Click to choose .CSV file or drag & drop here'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {selectedCsvFile
                      ? `${(selectedCsvFile.size / 1024).toFixed(1)} KB • Click to change file`
                      : 'Accepts standard .csv exports from Excel, Google Sheets, or CRMs'}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Paste Raw CSV */}
            {csvImportTab === 'PASTE' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600">
                  Paste CSV Lines:
                </label>
                <textarea
                  rows={5}
                  value={csvText}
                  onChange={(e) => {
                    setCsvText(e.target.value);
                    setSelectedCsvFile(null);
                  }}
                  placeholder="Name,Phone,Tag&#10;Vijay Kumar,+919876543210,VIP Customer&#10;Ananya Sen,9812345678,Lead"
                  className="w-full font-mono text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#128C7E] focus:outline-none"
                />
              </div>
            )}

            {/* Live Data Preview */}
            {parsedPreview.total > 0 && (
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-emerald-950">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {parsedPreview.total} Contacts Ready to Import
                  </span>
                  <span className="text-[11px] text-emerald-700 font-normal">
                    Previewing top {parsedPreview.previewRows.length} rows
                  </span>
                </div>

                <div className="bg-white rounded-lg border border-emerald-200/80 overflow-hidden text-[11px]">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-1.5">Name</th>
                        <th className="px-3 py-1.5">Phone Number</th>
                        <th className="px-3 py-1.5">Tag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {parsedPreview.previewRows.map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1 text-slate-800 font-sans font-medium">{r.name}</td>
                          <td className="px-3 py-1 text-[#075E54]">{r.phone}</td>
                          <td className="px-3 py-1 text-slate-500 font-sans">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                              {r.tag}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Compliance opt-in */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5">
              <input
                type="checkbox"
                id="csvConsent"
                checked={csvOptInAccepted}
                onChange={(e) => setCsvOptInAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-emerald-600 rounded"
              />
              <label htmlFor="csvConsent" className="text-xs text-slate-700 leading-tight cursor-pointer">
                I certify that all recipients in this CSV file have provided affirmative opt-in consent in compliance with WhatsApp Business Messaging Policies.
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportCsv}
                disabled={!csvOptInAccepted || parsedPreview.total === 0}
                className="px-5 py-2 bg-[#25D366] hover:bg-[#1da851] text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50 transition active:scale-95"
              >
                Import {parsedPreview.total > 0 ? `${parsedPreview.total} Contacts` : 'Contacts'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Group Grabber Modal */}
      {showGrabberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              WhatsApp Group Grabber & Extractor
            </h3>
            <p className="text-xs text-slate-500">
              Paste exported WhatsApp group chat text or raw phone number lists. The extractor will automatically isolate valid +91 numbers and import them into CRM.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Audience Group Tag
              </label>
              <input
                type="text"
                value={grabberGroupName}
                onChange={(e) => setGrabberGroupName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#128C7E] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Raw Group Chat / Text Content
              </label>
              <textarea
                rows={6}
                value={grabberRawText}
                onChange={(e) => setGrabberRawText(e.target.value)}
                placeholder="Paste WhatsApp chat export or contact numbers here..."
                className="w-full font-mono text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#128C7E] focus:outline-none"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGrabberModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  // Regex to match Indian phone numbers
                  const matches = grabberRawText.match(/(?:\+91[\s-]?)?[6-9]\d{9}/g) || [];
                  const uniquePhones = Array.from(
                    new Set(matches.map((p) => {
                      const clean = p.replace(/[^\d]/g, '');
                      return clean.length === 10 ? `+91${clean}` : `+${clean}`;
                    })),
                  );

                  if (uniquePhones.length > 0 && onGroupGrabberExtract) {
                    onGroupGrabberExtract(
                      uniquePhones.map((ph, idx) => ({
                        name: `Member ${idx + 1}`,
                        phoneNumber: ph,
                        tag: grabberGroupName,
                      })),
                    );
                  }
                  setShowGrabberModal(false);
                }}
                className="px-4 py-2 bg-[#128C7E] hover:bg-[#075E54] text-white rounded-lg text-sm font-semibold flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                Extract & Add to CRM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

