import React, { useState } from 'react';
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
} from 'lucide-react';

interface ContactsViewProps {
  contacts: Contact[];
  onOpenWhatsApp: (contact?: Contact | null) => void;
  onAddContact: (contact: Omit<Contact, 'id' | 'createdAt'>) => void;
  onImportCsv: (csvContent: string) => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  onOpenWhatsApp,
  onAddContact,
  onImportCsv,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);

  // New Contact form states
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('+91');
  const [newTag, setNewTag] = useState('New Inquiries');
  const [newConsent, setNewConsent] = useState(true);

  // CSV import text
  const [csvText, setCsvText] = useState(
    `name,phone,tag\nRahul Mehta,+919811122233,Diwali Leads\nSneha Sen,+919822233344,Online Store`,
  );
  const [csvOptInAccepted, setCsvOptInAccepted] = useState(true);

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
        <div className="flex items-center space-x-3">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              Bulk CSV Import
            </h3>
            <p className="text-xs text-slate-500">
              Paste comma-separated data or upload your customer list with columns: `name,phone,tag`.
            </p>

            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full font-mono text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#128C7E] focus:outline-none"
            />

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
              <input
                type="checkbox"
                id="csvConsent"
                checked={csvOptInAccepted}
                onChange={(e) => setCsvOptInAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-emerald-600 rounded"
              />
              <label htmlFor="csvConsent" className="text-xs text-emerald-900 leading-tight">
                I certify that all recipients in this CSV file have provided affirmative opt-in consent in compliance with WhatsApp Business Messaging Policies.
              </label>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportCsv}
                disabled={!csvOptInAccepted}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                Start Streaming Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
