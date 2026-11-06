import React, { useState, useRef, useMemo } from 'react';
import { Contact } from '../types';
import {
  Users,
  Search,
  Plus,
  Download,
  Upload,
  Sparkles,
  Phone,
  Copy,
  Check,
  Pencil,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  FileSpreadsheet,
  UploadCloud,
  FileText,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface ContactsViewProps {
  contacts: Contact[];
  onOpenWhatsApp: (contact?: Contact | null) => void;
  onAddContact: (contact: Omit<Contact, 'id' | 'createdAt'> & { service?: string; source?: string; status?: string; assignedRep?: string; enquiredTime?: string }) => void;
  onImportCsv: (csvContent: string) => void;
  onGroupGrabberExtract?: (extractedContacts: Array<{ name: string; phoneNumber: string; tag: string }>) => void;
  onDeleteContact?: (id: string) => void;
  onUpdateContact?: (contact: Contact) => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  onOpenWhatsApp,
  onAddContact,
  onImportCsv,
  onGroupGrabberExtract,
  onDeleteContact,
  onUpdateContact,
}) => {
  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedService, setSelectedService] = useState('ALL');
  const [selectedRep, setSelectedRep] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showGrabberModal, setShowGrabberModal] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);

  // Copy feedback state
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  // Add Contact Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('+91');
  const [newService, setNewService] = useState('General Enquiry');
  const [newRep, setNewRep] = useState('ABHI');
  const [newStatus, setNewStatus] = useState('New');

  // Group Grabber State
  const [grabberRawText, setGrabberRawText] = useState(
    `[12/10/26, 10:15] +91 98123 45678: Hello team\n[12/10/26, 10:18] +91 97234 56789: Interested in demo\n+91 99345 67890\n9845012345`,
  );
  const [grabberGroupName, setGrabberGroupName] = useState('Extracted Group Leads');

  // CSV Import State
  const [csvImportTab, setCsvImportTab] = useState<'FILE' | 'PASTE'>('FILE');
  const [selectedCsvFile, setSelectedCsvFile] = useState<{ name: string; size: number } | null>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState(
    `name,phone,service,rep\nRahul Mehta,+919811122233,General Enquiry,ABHI\nSneha Sen,+919822233344,Training,saiteja`,
  );
  const [csvOptInAccepted, setCsvOptInAccepted] = useState(true);

  // Helper for phone copy
  const handleCopyPhone = (id: string, phone: string) => {
    navigator.clipboard.writeText(phone.replace(/[^\d+]/g, ''));
    setCopiedPhoneId(id);
    setTimeout(() => setCopiedPhoneId(null), 2000);
  };

  // Helper for Service Dot Color
  const getServiceColor = (serviceName: string) => {
    const s = serviceName.toLowerCase();
    if (s.includes('training')) return 'bg-purple-500';
    if (s.includes('job') || s.includes('career')) return 'bg-emerald-500';
    if (s.includes('general') || s.includes('enquiry')) return 'bg-cyan-500';
    if (s.includes('vip') || s.includes('store')) return 'bg-amber-500';
    return 'bg-blue-500';
  };

  // Helper for Rep Avatar styling
  const getRepAvatarStyle = (repName: string) => {
    const r = repName.toLowerCase();
    if (r.startsWith('a')) return 'bg-blue-100 text-blue-700';
    if (r.startsWith('sai')) return 'bg-teal-100 text-teal-700';
    if (r.startsWith('sah')) return 'bg-violet-100 text-violet-700';
    return 'bg-slate-100 text-slate-700';
  };

  // Filter Contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const service = c.service || c.tag || 'General Enquiry';
      const rep = c.assignedRep || 'ABHI';
      const status = c.status || 'New';

      const matchesSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phoneNumber.includes(searchTerm) ||
        service.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rep.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesService = selectedService === 'ALL' || service.toLowerCase().includes(selectedService.toLowerCase());
      const matchesRep = selectedRep === 'ALL' || rep.toLowerCase() === selectedRep.toLowerCase();
      const matchesStatus = selectedStatus === 'ALL' || status.toLowerCase() === selectedStatus.toLowerCase();

      return matchesSearch && matchesService && matchesRep && matchesStatus;
    });
  }, [contacts, searchTerm, selectedService, selectedRep, selectedStatus]);

  // Handle Create Lead
  const handleCreateContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPhone) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    onAddContact({
      name: newName,
      phoneNumber: newPhone,
      tag: newService,
      service: newService,
      source: 'WhatsApp',
      status: newStatus,
      assignedRep: newRep,
      enquiredTime: timeStr,
      optInConsent: true,
      isSuppressed: false,
    });

    setNewName('');
    setNewPhone('+91');
    setShowAddModal(false);
  };

  // Handle Edit Lead Submit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactToEdit || !onUpdateContact) return;

    onUpdateContact(contactToEdit);
    setShowEditModal(false);
    setContactToEdit(null);
  };

  // Handle Export CSV
  const handleExportCsv = () => {
    if (contacts.length === 0) return;
    const headers = 'Name,Phone,Service,Source,Status,AssignedRep,Date\n';
    const rows = contacts
      .map(
        (c) =>
          `"${c.name}","${c.phoneNumber}","${c.service || c.tag || 'General Enquiry'}","${c.source || 'WhatsApp'}","${
            c.status || 'New'
          }","${c.assignedRep || 'ABHI'}","${c.createdAt}"`,
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `leads_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sample CSV generator for 1-click download
  const handleDownloadSampleCsv = () => {
    const sampleCsv = `Name,Phone,Service,AssignedRep\nMalaya Ranjan Pattanaik,+917008651883,Training,saiteja\nhimanshuyadavshiahilr123,+918077552017,General Enquiry,sahil\nRuhii,+918431590424,Training,ABHI\nNikhil Gaur,+917982856812,Job Inquiry,sahil`;
    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'leads_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Reader
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

  // Live parsed preview with de-duplication
  const parsedPreview = useMemo(() => {
    const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return { total: 0, newCount: 0, duplicateCount: 0, previewRows: [] };

    const headerParts = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
    let nameIdx = headerParts.findIndex((h) => h.includes('name'));
    let phoneIdx = headerParts.findIndex(
      (h) => h.includes('phone') || h.includes('mobile') || h.includes('contact') || h.includes('num'),
    );
    let tagIdx = headerParts.findIndex(
      (h) => h.includes('service') || h.includes('tag') || h.includes('group') || h.includes('category'),
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

    const existingKeys = new Set(
      contacts.map((c) => {
        let cl = c.phoneNumber.replace(/[^\d]/g, '');
        if (cl.length === 10) cl = `91${cl}`;
        return cl;
      }),
    );
    const inCsvKeys = new Set<string>();

    let newCount = 0;
    let duplicateCount = 0;
    const rows: Array<{ name: string; phone: string; tag: string; isDuplicate: boolean }> = [];

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

          let key = normalized.replace(/[^\d]/g, '');
          if (key.length === 10) key = `91${key}`;

          const isDup = existingKeys.has(key) || inCsvKeys.has(key);
          if (isDup) {
            duplicateCount++;
          } else {
            newCount++;
            inCsvKeys.add(key);
          }

          rows.push({
            name: parts[nameIdx] || parts[0] || 'Customer',
            phone: normalized,
            tag: parts[tagIdx] || parts[2] || 'General Enquiry',
            isDuplicate: isDup,
          });
        }
      }
    }
    return {
      total: rows.length,
      newCount,
      duplicateCount,
      previewRows: rows.slice(0, 5),
    };
  }, [csvText, contacts]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Leads Directory</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#e0f2fe] text-[#0284c7] border border-[#bae6fd]">
              Management View
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Query, manage, schedule, and track customer lead profiles across the pipeline.
          </p>
        </div>

        {/* Action Buttons Top Right */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1.5"
            title="Download CSV of current leads"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {/* Import Excel / CSV Button */}
          <button
            onClick={() => setShowCsvModal(true)}
            className="px-4 py-2 bg-[#0f172a] hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
            title="Upload CSV or Excel spreadsheet"
          >
            <Upload className="w-3.5 h-3.5 text-slate-300" />
            <span>Import Excel</span>
          </button>

          {/* Add New Lead Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-[#00b493] hover:bg-[#009e81] text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Add New Lead</span>
          </button>

          {/* Group Grabber Button */}
          <button
            onClick={() => setShowGrabberModal(true)}
            className="px-3 py-2 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1.5"
            title="Extract leads from WhatsApp group messages"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Group Grabber</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar Card */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, phone, email, or service..."
            className="w-full pl-10 pr-4 py-2 border border-transparent rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 text-slate-800"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto shrink-0 flex-wrap">
          {/* Services Filter */}
          <div className="relative">
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="appearance-none bg-white border border-slate-200 rounded-xl px-3 py-1.5 pr-8 text-xs font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#00b493] cursor-pointer"
            >
              <option value="ALL">All Services (4)</option>
              <option value="General Enquiry">General Enquiry</option>
              <option value="Training">Training</option>
              <option value="Job Inquiry">Job Inquiry</option>
              <option value="VIP">VIP Customer</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Reps Filter */}
          <div className="relative">
            <select
              value={selectedRep}
              onChange={(e) => setSelectedRep(e.target.value)}
              className="appearance-none bg-white border border-slate-200 rounded-xl px-3 py-1.5 pr-8 text-xs font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#00b493] cursor-pointer"
            >
              <option value="ALL">All Reps</option>
              <option value="ABHI">ABHI</option>
              <option value="saiteja">saiteja</option>
              <option value="sahil">sahil</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Statuses Filter */}
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="appearance-none bg-white border border-slate-200 rounded-xl px-3 py-1.5 pr-8 text-xs font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#00b493] cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="New">New</option>
              <option value="Followup">Followup</option>
              <option value="Converted">Converted</option>
              <option value="Dropped">Dropped</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Matching Result Count */}
      <div className="text-xs text-slate-500 font-medium px-1">
        Showing 1-{Math.min(filteredContacts.length, 10)} of {filteredContacts.length} matching leads
      </div>

      {/* Leads Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            {/* Table Header */}
            <thead className="bg-[#fcfdfe] border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">CLIENT & CONTACT</th>
                <th className="px-5 py-3.5">SERVICE</th>
                <th className="px-5 py-3.5">SOURCE</th>
                <th className="px-5 py-3.5">STATUS</th>
                <th className="px-5 py-3.5">ASSIGNED REP</th>
                <th className="px-5 py-3.5">ENQUIRED ON</th>
                <th className="px-5 py-3.5 text-right">ACTIONS</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100">
              {filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No leads match the selected filters</p>
                    <p className="text-xs mt-1">Try resetting search or clicking "+ Add New Lead"</p>
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => {
                  const rawDigits = contact.phoneNumber.replace(/[^\d]/g, '');
                  const formattedPhone = rawDigits.startsWith('91') ? rawDigits : `91${rawDigits}`;
                  const serviceName = contact.service || contact.tag || 'General Enquiry';
                  const repName = contact.assignedRep || 'ABHI';
                  const statusName = contact.status || 'New';
                  const enquiredDate = contact.createdAt || 'Nov 4, 2026';
                  const enquiredTime = contact.enquiredTime || '5:10 PM';

                  return (
                    <tr key={contact.id} className="hover:bg-slate-50/70 transition-colors group">
                      {/* CLIENT & CONTACT */}
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900 text-xs">
                          {contact.name || 'Unnamed Client'}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[11px] text-slate-500">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{formattedPhone}</span>
                          <button
                            onClick={() => handleCopyPhone(contact.id, formattedPhone)}
                            className="p-0.5 hover:text-slate-800 transition-colors rounded"
                            title="Copy phone number"
                          >
                            {copiedPhoneId === contact.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* SERVICE */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${getServiceColor(serviceName)}`} />
                          <span className="font-medium text-slate-700 text-xs">{serviceName}</span>
                        </div>
                      </td>

                      {/* SOURCE */}
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                          WhatsApp
                        </span>
                      </td>

                      {/* STATUS */}
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/80">
                          ✨ {statusName}
                        </span>
                      </td>

                      {/* ASSIGNED REP */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${getRepAvatarStyle(
                              repName,
                            )}`}
                          >
                            {repName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-700 text-xs">{repName}</span>
                        </div>
                      </td>

                      {/* ENQUIRED ON */}
                      <td className="px-5 py-3.5">
                        <div className="text-slate-800 font-medium text-xs">{enquiredDate}</div>
                        <div className="text-slate-400 text-[11px] font-mono mt-0.5">{enquiredTime}</div>
                      </td>

                      {/* ACTIONS */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit Pencil Button */}
                          <button
                            onClick={() => {
                              setContactToEdit(contact);
                              setShowEditModal(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="Edit Lead"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Instant WhatsApp Send Button */}
                          <button
                            onClick={() => onOpenWhatsApp(contact)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Send WhatsApp Message"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>

                          {/* Trash Delete Button */}
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete lead "${contact.name}"?`)) {
                                onDeleteContact?.(contact.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#00b493]" />
                Add New Lead Profile
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateContact} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name / Lead</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-[#00b493] focus:outline-none"
                  placeholder="e.g. Malaya Ranjan Pattanaik"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-1 focus:ring-[#00b493] focus:outline-none"
                  placeholder="+919876543210"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Service</label>
                  <select
                    value={newService}
                    onChange={(e) => setNewService(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-[#00b493] focus:outline-none bg-white"
                  >
                    <option value="General Enquiry">General Enquiry</option>
                    <option value="Training">Training</option>
                    <option value="Job Inquiry">Job Inquiry</option>
                    <option value="VIP Customer">VIP Customer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Rep</label>
                  <select
                    value={newRep}
                    onChange={(e) => setNewRep(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-[#00b493] focus:outline-none bg-white"
                  >
                    <option value="ABHI">ABHI</option>
                    <option value="saiteja">saiteja</option>
                    <option value="sahil">sahil</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pipeline Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-[#00b493] focus:outline-none bg-white"
                >
                  <option value="New">✨ New</option>
                  <option value="Followup">Today Followup</option>
                  <option value="Converted">Converted</option>
                  <option value="Dropped">Lost / Dropped</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00b493] hover:bg-[#009e81] text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {showEditModal && contactToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#00b493]" />
                Edit Lead Details
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setContactToEdit(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name / Lead</label>
                <input
                  type="text"
                  required
                  value={contactToEdit.name}
                  onChange={(e) => setContactToEdit({ ...contactToEdit, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-[#00b493] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number (+91)
                </label>
                <input
                  type="text"
                  required
                  value={contactToEdit.phoneNumber}
                  onChange={(e) => setContactToEdit({ ...contactToEdit, phoneNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-1 focus:ring-[#00b493] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Service</label>
                  <select
                    value={contactToEdit.service || contactToEdit.tag || 'General Enquiry'}
                    onChange={(e) =>
                      setContactToEdit({
                        ...contactToEdit,
                        service: e.target.value,
                        tag: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-[#00b493] focus:outline-none bg-white"
                  >
                    <option value="General Enquiry">General Enquiry</option>
                    <option value="Training">Training</option>
                    <option value="Job Inquiry">Job Inquiry</option>
                    <option value="VIP Customer">VIP Customer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Rep</label>
                  <select
                    value={contactToEdit.assignedRep || 'ABHI'}
                    onChange={(e) => setContactToEdit({ ...contactToEdit, assignedRep: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-[#00b493] focus:outline-none bg-white"
                  >
                    <option value="ABHI">ABHI</option>
                    <option value="saiteja">saiteja</option>
                    <option value="sahil">sahil</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pipeline Status</label>
                <select
                  value={contactToEdit.status || 'New'}
                  onChange={(e) => setContactToEdit({ ...contactToEdit, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-[#00b493] focus:outline-none bg-white"
                >
                  <option value="New">✨ New</option>
                  <option value="Followup">Today Followup</option>
                  <option value="Converted">Converted</option>
                  <option value="Dropped">Lost / Dropped</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setContactToEdit(null);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00b493] hover:bg-[#009e81] text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Update Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV / Excel Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Import Leads from Excel / CSV</h3>
                  <p className="text-xs text-slate-500">
                    Upload an Excel or CSV file or paste lead rows directly.
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

            {/* Template Download & Guide */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-slate-700">Supported Columns: </span>
                <code className="text-[#00897b] bg-[#e6fffa] px-1.5 py-0.5 rounded font-mono font-bold">
                  Name, Phone, Service, AssignedRep
                </code>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  10-digit Indian numbers are automatically formatted to +91
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadSampleCsv}
                className="px-2.5 py-1.5 bg-white border border-slate-300 hover:border-[#00b493] hover:text-[#00897b] text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs shrink-0 ml-2"
              >
                <Download className="w-3.5 h-3.5 text-[#00b493]" />
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
                    ? 'border-[#00b493] text-[#00897b]'
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
                    ? 'border-[#00b493] text-[#00897b]'
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
                  className="border-2 border-dashed border-slate-300 hover:border-[#00b493] rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50/50 hover:bg-[#e6fffa]/20 group"
                >
                  <UploadCloud className="w-10 h-10 text-slate-400 group-hover:text-[#00b493] mx-auto mb-2 transition" />
                  <div className="text-sm font-bold text-slate-700 group-hover:text-[#00897b]">
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
                  rows={4}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="name,phone,service,rep"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-1 focus:ring-[#00b493] focus:outline-none"
                />
              </div>
            )}

            {/* Live Parsing & De-duplication Stats */}
            {parsedPreview.total > 0 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Preview & De-Duplication:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-700 font-bold bg-emerald-100/70 px-2 py-0.5 rounded-full">
                      ✓ {parsedPreview.newCount} New
                    </span>
                    {parsedPreview.duplicateCount > 0 && (
                      <span className="text-amber-700 font-bold bg-amber-100/70 px-2 py-0.5 rounded-full">
                        ⚠ {parsedPreview.duplicateCount} Duplicates Skipped
                      </span>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-slate-200 text-[11px] font-mono bg-white rounded-lg border border-slate-200">
                  {parsedPreview.previewRows.map((r, i) => (
                    <div key={i} className="px-2.5 py-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{r.name}</span>
                        <span className="text-slate-500">{r.phone}</span>
                        <span className="text-slate-400">({r.tag})</span>
                      </div>
                      {r.isDuplicate ? (
                        <span className="text-amber-600 text-[10px] font-semibold">Duplicate</span>
                      ) : (
                        <span className="text-emerald-600 text-[10px] font-semibold">Valid</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Consent Acknowledgement */}
            <div className="flex items-start gap-2.5 pt-1">
              <input
                type="checkbox"
                id="csvConsent"
                checked={csvOptInAccepted}
                onChange={(e) => setCsvOptInAccepted(e.target.checked)}
                className="w-4 h-4 text-[#00b493] rounded mt-0.5 focus:ring-0"
              />
              <label htmlFor="csvConsent" className="text-xs text-slate-600">
                I confirm that all imported contacts have provided explicit consent for WhatsApp messages.
              </label>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!csvOptInAccepted || parsedPreview.newCount === 0}
                onClick={() => {
                  onImportCsv(csvText);
                  setShowCsvModal(false);
                }}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition shadow-xs ${
                  csvOptInAccepted && parsedPreview.newCount > 0
                    ? 'bg-[#0f172a] hover:bg-slate-800'
                    : 'bg-slate-300 cursor-not-allowed'
                }`}
              >
                Import {parsedPreview.newCount} Leads
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Grabber Modal */}
      {showGrabberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">WhatsApp Group Grabber</h3>
                  <p className="text-xs text-slate-500">Extract phone numbers from WhatsApp chat export</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGrabberModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Service / Tag</label>
                <input
                  type="text"
                  value={grabberGroupName}
                  onChange={(e) => setGrabberGroupName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-[#00b493] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Paste WhatsApp Group Chat Log / Message Text:
                </label>
                <textarea
                  rows={6}
                  value={grabberRawText}
                  onChange={(e) => setGrabberRawText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-1 focus:ring-[#00b493] focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowGrabberModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const phoneRegex = /(?:\+?91[\s-]?)?[6-9]\d{9}/g;
                  const matches = grabberRawText.match(phoneRegex) || [];
                  const uniqueNums = Array.from(new Set(matches.map((m) => m.replace(/[\s-]/g, ''))));
                  const extracted = uniqueNums.map((num, i) => {
                    const clean = num.startsWith('+') ? num : num.startsWith('91') ? `+${num}` : `+91${num}`;
                    return {
                      name: `Lead ${clean.slice(-4)}`,
                      phoneNumber: clean,
                      tag: grabberGroupName,
                    };
                  });
                  onGroupGrabberExtract?.(extracted);
                  setShowGrabberModal(false);
                }}
                className="px-4 py-2 bg-[#00b493] hover:bg-[#009e81] text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Extract Leads
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
