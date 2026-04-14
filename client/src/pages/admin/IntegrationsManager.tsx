import React, { useState, useEffect } from 'react';
import { Network, Plus, Trash2, Edit2, Play, Save, CheckCircle, AlertTriangle, BookOpen, Server } from 'lucide-react';
import axios from 'axios';

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  httpMethod: string;
  events: string[];
  isActive: boolean;
  payloadMapping?: Record<string, string>;
  headers?: Record<string, string>;
}

export default function IntegrationsManager() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<WebhookConfig>>({
    name: '',
    url: '',
    httpMethod: 'POST',
    events: [],
    payloadMapping: {
      "montant_evp": "{{amount}}",
      "code_rubrique": "REP_01"
    },
    headers: {
      "Authorization": "Bearer xxxxx"
    }
  });

  const [availableEvents] = useState([
    { id: 'expense.approved', label: 'Note de frais approuvée' },
    { id: 'leave.requested', label: 'Demande de congé effectuée' },
    { id: 'check_in', label: 'Pointage (Arrivée)' },
    { id: 'late_arrival', label: 'Pointage tardif' },
    { id: 'employee.created', label: 'Création collaborateur' }
  ]);

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const getToken = () => localStorage.getItem('token');

  const fetchWebhooks = async () => {
    try {
      const res = await axios.get('/api/admin/webhooks', { headers: { Authorization: `Bearer ${getToken()}` } });
      setWebhooks(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveWebhook = async () => {
    try {
      if (editingId && editingId !== 'new') {
        await axios.put(`/api/admin/webhooks/${editingId}`, formData, { headers: { Authorization: `Bearer ${getToken()}` } });
      } else {
        await axios.post('/api/admin/webhooks', formData, { headers: { Authorization: `Bearer ${getToken()}` } });
      }
      setEditingId(null);
      fetchWebhooks();
    } catch (err) {
      alert("Erreur lors de la sauvegarde.");
    }
  };

  const deleteWebhook = async (id: string) => {
    if (!window.confirm('Supprimer cette intégration ?')) return;
    try {
      await axios.delete(`/api/admin/webhooks/${id}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      fetchWebhooks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTest = async (id: string) => {
    try {
      const res = await axios.post(`/api/admin/webhooks/${id}/test`, {}, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.data.success) {
        alert("Test réussi (Statut " + res.data.statusCode + ")");
      } else {
        alert("Erreur : " + res.data.error);
      }
    } catch (error) {
      alert("Erreur serveur lors du test.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-gradient-to-r from-blue-600 to-indigo-700 p-8 rounded-2xl text-white shadow-xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hub d'Intégrations</h1>
          <p className="mt-2 text-blue-100 max-w-2xl">
            Configurez vos propres logiques d'export vers vos progiciels externes (KPaie, Silae, MediPlan).
            Oubliez la saisie manuelle : maptez vos données et laissez WhatsPoint faire le reste.
          </p>
        </div>
        <Network className="h-20 w-20 text-white/20" />
      </div>

      {/* Guide Rapide */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-sm text-blue-900 shadow-sm">
        <div className="flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-base mb-1">Guide d'Intégration Rapide (Webhooks)</h3>
            <p className="mb-2 text-blue-800">Les Webhooks vous permettent d'envoyer instantanément les informations générées par WhatsPoint vers votre API ou vos outils de flux (Silae, PayFit, Zapier, Make...).</p>
            <ul className="list-disc pl-5 space-y-1 text-blue-800/90 mb-3">
              <li><strong>Déclencheur :</strong> Sélectionnez quand envoyer la donnée (ex: lors d'un Pointage ou d'une validation de Congé).</li>
              <li><strong>URL cible :</strong> L'adresse HTTP qui doit recevoir la donnée (fournie par votre ERP ou webhook Zapier).</li>
              <li><strong>Payload Mapping :</strong> Le format exact (JSON) exigé par votre logiciel. Utilisez les <code className="bg-blue-100 px-1 rounded font-mono text-xs">{'{{accolades}}'}</code> pour insérer dynamiquement la donnée captée de WhatsApp.</li>
            </ul>
            <div className="bg-blue-100/50 p-2.5 rounded-lg text-xs font-mono border border-blue-200">
               <span className="font-bold text-blue-700 block mb-1">Variables globales autorisées :</span>
               {'{{employeeName}}'}, {'{{employeePhone}}'}, {'{{amount}}'} (Notes de frais), {'{{timestamp}}'}, {'{{action}}'}
            </div>
          </div>
        </div>
      </div>

      {/* Guide API Inbound */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 text-sm text-emerald-900 shadow-sm">
        <div className="flex items-start gap-3">
          <Server className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-base mb-1">API REST Entrante (Réception)</h3>
            <p className="mb-2 text-emerald-800">Votre logiciel métier peut également créer des collaborateurs ou récupérer l'historique sur demande (Pull) sans passer par les Webhooks, via l'API principale :</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div className="bg-white p-3 rounded border border-emerald-200">
                <p className="font-semibold text-xs text-gray-500 uppercase tracking-wider mb-1">Créer un employé</p>
                <code className="text-pink-600 font-bold block mb-1">POST /api/employees</code>
                <p className="text-xs text-gray-600">Payload: <code className="bg-gray-100 px-1 rounded">{'{ "firstName", "lastName", "phone" }'}</code></p>
              </div>
              <div className="bg-white p-3 rounded border border-emerald-200">
                <p className="font-semibold text-xs text-gray-500 uppercase tracking-wider mb-1">Récupérer les Pointages</p>
                <code className="text-blue-600 font-bold block mb-1">GET /api/attendance</code>
                <p className="text-xs text-gray-600">Filtres: <code className="bg-gray-100 px-1 rounded">?startDate=YYYY-MM-DD</code></p>
              </div>
            </div>
            <p className="mt-3 text-xs opacity-80 italic">Authentification requise : Headers {'>'} Authorization: Bearer {'<VOTRE_TOKEN_JWT>'}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button 
          onClick={() => {
            setFormData({ name: '', url: '', httpMethod: 'POST', events: [], payloadMapping: { "valeur": "{{amount}}" }, headers: {} });
            setEditingId('new');
          }}
          className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus className="h-5 w-5" />
          <span>Nouvelle Intégration</span>
        </button>
      </div>

      {editingId && (
        <div className="bg-white rounded-xl shadow p-6 mb-6 border border-indigo-100">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 border-b pb-2">
            {editingId === 'new' ? 'Créer un Connecteur' : 'Éditer le Connecteur'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nom du flux</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Export EVP vers KPaie"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">URL de destination</label>
                <input
                  type="url"
                  value={formData.url || ''}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://api.kpaie.com/v1/evp"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Méthode HTTP</label>
                <select
                  value={formData.httpMethod || 'POST'}
                  onChange={(e) => setFormData({ ...formData, httpMethod: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Déclencheur (Quand exécuter ?)</label>
                <div className="space-y-2 border rounded-md p-3 max-h-40 overflow-y-auto">
                  {availableEvents.map(evt => (
                    <label key={evt.id} className="flex items-center space-x-2 text-sm">
                      <input 
                        type="checkbox"
                        className="rounded text-indigo-600"
                        checked={formData.events?.includes(evt.id) || false}
                        onChange={(e) => {
                          const current = new Set(formData.events || []);
                          if (e.target.checked) current.add(evt.id);
                          else current.delete(evt.id);
                          setFormData({ ...formData, events: Array.from(current) });
                        }}
                      />
                      <span>{evt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Mapping du Payload Envoyé (JSON)</label>
                <p className="text-xs text-gray-500 mb-2">Utilisez les accolades {'{{nom_variable}}'} pour injecter des valeurs (ex: {'{{amount}}'}, {'{{employeeName}}'}).</p>
                <textarea
                  rows={6}
                  value={JSON.stringify(formData.payloadMapping, null, 2)}
                  onChange={(e) => {
                    try {
                      setFormData({ ...formData, payloadMapping: JSON.parse(e.target.value) });
                    } catch(err) {
                      // Allow transient invalid JSON during typing, we might need a better state model for perfect DX
                    }
                  }}
                  className="block w-full font-mono text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder='{ "montant_evp": "{{amount}}" }'
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Headers HTTP (JSON)</label>
                <textarea
                  rows={3}
                  value={JSON.stringify(formData.headers, null, 2)}
                  onChange={(e) => {
                    try {
                      setFormData({ ...formData, headers: JSON.parse(e.target.value) });
                    } catch(err) {}
                  }}
                  className="block w-full font-mono text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={() => setEditingId(null)}
              className="px-4 py-2 text-gray-700 border rounded hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={saveWebhook}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center shadow"
            >
              <Save className="w-4 h-4 mr-2" />
              Sauvegarder la règle
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
              <div className="p-5 border-b border-gray-100 flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-900 border-b-2 border-indigo-100 inline-block pb-0.5">{webhook.name}</h3>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 font-mono">
                      {webhook.httpMethod}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${webhook.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      {webhook.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => handleTest(webhook.id)}
                  className="text-gray-400 hover:text-indigo-600 transition"
                  title="Simuler un test"
                >
                  <Play className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Cible URL</p>
                  <p className="text-sm font-mono text-gray-600 truncate">{webhook.url}</p>
                </div>
                
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Déclencheurs</p>
                  <div className="flex flex-wrap gap-1">
                    {webhook.events.map(e => (
                      <span key={e} className="inline-block bg-gray-100 px-2 py-1 text-xs rounded text-gray-700 font-medium">
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-5 py-3 rounded-b-xl flex justify-between items-center">
                <span className="text-xs text-gray-500 flex items-center">
                  <CheckCircle className="w-3 h-3 mr-1 text-emerald-500" />
                  Prêt
                </span>
                <div className="flex space-x-2">
                  <button onClick={() => { setFormData(webhook); setEditingId(webhook.id); }} className="p-1.5 text-gray-500 hover:text-blue-600 bg-white shadow-sm rounded-md border">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteWebhook(webhook.id)} className="p-1.5 text-gray-500 hover:text-red-600 bg-white shadow-sm rounded-md border">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {webhooks.length === 0 && !editingId && (
            <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 rounded-xl border-dashed border-2">
              <Network className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p>Aucune intégration configurée.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
