'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import toast from 'react-hot-toast';

interface Permission {
  id: number;
  code: string;
  name: string;
  description: string;
  category: string;
}

interface PermissionGroup {
  id: number;
  name: string;
  display_name: string;
  description: string;
  is_system: boolean;
  permissions: number[];
}

const CATEGORY_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  agenda: 'Agenda',
  lancamentos: 'Lançamentos',
  comissoes: 'Comissões',
  clientes: 'Clientes',
  colaboradores: 'Colaboradores',
  servicos: 'Serviços',
  relatorios: 'Relatórios',
  pagamentos: 'Pagamentos',
  admin: 'Administração',
  geral: 'Geral',
};

const CATEGORY_COLORS: Record<string, string> = {
  dashboard: 'bg-blue-100 text-blue-700 border-blue-200',
  agenda: 'bg-pink-100 text-pink-700 border-pink-200',
  lancamentos: 'bg-orange-100 text-orange-700 border-orange-200',
  comissoes: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  clientes: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  colaboradores: 'bg-purple-100 text-purple-700 border-purple-200',
  servicos: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  relatorios: 'bg-green-100 text-green-700 border-green-200',
  pagamentos: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  admin: 'bg-red-100 text-red-700 border-red-200',
  geral: 'bg-gray-100 text-gray-700 border-gray-200',
};

export default function PermissoesPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permissionsByCategory, setPermissionsByCategory] = useState<Record<string, Permission[]>>({});
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<PermissionGroup | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);
  const [createForm, setCreateForm] = useState({ name: '', display_name: '', description: '' });
  const [editForm, setEditForm] = useState({ display_name: '', description: '' });
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<number[]>([]); // Grupos expandidos

  const toggleGroupExpand = (groupId: number) => {
    setExpandedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const isGroupExpanded = (groupId: number) => expandedGroups.includes(groupId) || selectedGroup?.id === groupId;

  useEffect(() => {
    if (authLoading) return;
    loadData();
  }, [authLoading]);

  const loadData = async () => {
    try {
      const response = await fetch('/api/admin/permissoes');
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('Acesso negado: apenas administradores');
          router.push('/admin');
          return;
        }
        toast.error(result.error || 'Erro ao carregar permissões');
        setLoading(false);
        return;
      }

      setPermissions(result.permissions || []);
      setPermissionsByCategory(result.permissionsByCategory || {});
      setGroups(result.groups || []);
    } catch (err) {
      console.error('Erro:', err);
      toast.error('Erro ao carregar permissões');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!createForm.name.trim() || !createForm.display_name.trim()) {
      toast.error('Nome e nome de exibição são obrigatórios');
      return;
    }

    setSavingCreate(true);
    try {
      const response = await fetch('/api/admin/permissoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name,
          display_name: createForm.display_name,
          description: createForm.description,
          permissions: selectedPermissions,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Erro ao criar grupo');
        return;
      }

      toast.success('Grupo criado com sucesso!');
      setGroups([...groups, result.group]);
      setShowCreateModal(false);
      setCreateForm({ name: '', display_name: '', description: '' });
      setSelectedPermissions([]);
    } catch (err) {
      console.error('Erro:', err);
      toast.error('Erro ao criar grupo');
    } finally {
      setSavingCreate(false);
    }
  };

  const handleUpdateGroup = async () => {
    if (!selectedGroup) return;

    setSavingEdit(true);
    try {
      const response = await fetch('/api/admin/permissoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroup.id,
          display_name: editForm.display_name,
          description: editForm.description,
          action: 'updateGroup',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Erro ao atualizar grupo');
        return;
      }

      toast.success('Grupo atualizado com sucesso!');
      setGroups(groups.map(g =>
        g.id === selectedGroup.id
          ? { ...g, display_name: editForm.display_name, description: editForm.description }
          : g
      ));
      setShowEditModal(false);
      setSelectedGroup(null);
      setEditForm({ display_name: '', description: '' });
    } catch (err) {
      console.error('Erro:', err);
      toast.error('Erro ao atualizar grupo');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleUpdatePermissions = async (group: PermissionGroup) => {
    setSavingPermissions(true);
    try {
      const response = await fetch('/api/admin/permissoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: group.id,
          permissions: selectedPermissions,
          action: 'updatePermissions',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Erro ao atualizar permissões');
        return;
      }

      toast.success('Permissões atualizadas com sucesso!');
      setGroups(groups.map(g =>
        g.id === group.id
          ? { ...g, permissions: selectedPermissions }
          : g
      ));
    } catch (err) {
      console.error('Erro:', err);
      toast.error('Erro ao atualizar permissões');
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;

    try {
      const response = await fetch(`/api/admin/permissoes?groupId=${selectedGroup.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Erro ao excluir grupo');
        return;
      }

      toast.success('Grupo excluído com sucesso!');
      setGroups(groups.filter(g => g.id !== selectedGroup.id));
    } catch (err) {
      console.error('Erro:', err);
      toast.error('Erro ao excluir grupo');
    } finally {
      setShowDeleteConfirm(false);
      setSelectedGroup(null);
    }
  };

  const togglePermission = (permId: number) => {
    if (selectedPermissions.includes(permId)) {
      setSelectedPermissions(selectedPermissions.filter(p => p !== permId));
    } else {
      setSelectedPermissions([...selectedPermissions, permId]);
    }
  };

  const selectAllInCategory = (category: string) => {
    const categoryPermIds = permissionsByCategory[category]?.map(p => p.id) || [];
    const allSelected = categoryPermIds.every(id => selectedPermissions.includes(id));

    if (allSelected) {
      setSelectedPermissions(selectedPermissions.filter(p => !categoryPermIds.includes(p)));
    } else {
      setSelectedPermissions([...new Set([...selectedPermissions, ...categoryPermIds])]);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Gerenciar Permissões</h1>
            <p className="text-gray-600 mt-1">
              Crie e edite grupos de permissões customizados
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => {
                setSelectedPermissions([]);
                setShowCreateModal(true);
              }}
              className="flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Novo Grupo
            </Button>
            <Button variant="outline" onClick={() => router.push('/admin')}>
              Voltar
            </Button>
          </div>
        </div>

        {/* Lista de Grupos */}
        <div className="space-y-6">
          {groups.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-gray-500 text-lg">Nenhum grupo de permissões encontrado</p>
              <p className="text-gray-400 text-sm mt-2">Execute o SQL de configuração no Supabase</p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.id} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                {/* Header do Grupo - Clicável para expandir */}
                <button
                  onClick={() => toggleGroupExpand(group.id)}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 text-left hover:from-purple-700 hover:to-pink-700 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Ícone de expandir/minimizar */}
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                        <svg
                          className={`w-5 h-5 text-white transition-transform duration-200 ${isGroupExpanded(group.id) ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white">{group.display_name}</h2>
                        <p className="text-purple-100 text-sm">
                          {group.permissions.length} permissões
                          {group.is_system && (
                            <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs">Sistema</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {!group.is_system && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGroup(group);
                              setEditForm({
                                display_name: group.display_name,
                                description: group.description || '',
                              });
                              setShowEditModal(true);
                            }}
                            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Editar grupo"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGroup(group);
                              setShowDeleteConfirm(true);
                            }}
                            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Excluir grupo"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                      <span className="text-white/80 text-sm hidden sm:inline">
                        {isGroupExpanded(group.id) ? 'Clique para minimizar' : 'Clique para expandir'}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Permissões do Grupo - Só aparece quando expandido */}
                {isGroupExpanded(group.id) && (
                <div className="p-6 border-t border-purple-100 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-800">Permissões deste grupo:</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedGroup(group);
                        setSelectedPermissions([...group.permissions]);
                      }}
                      className="text-sm"
                    >
                      Editar Permissões
                    </Button>
                  </div>

                  {selectedGroup?.id === group.id ? (
                    // Modo de edição de permissões
                    <div className="space-y-4">
                      {Object.entries(permissionsByCategory).map(([category, perms]) => (
                        <div key={category} className="border border-gray-200 rounded-xl overflow-hidden">
                          <div
                            className={`flex items-center justify-between px-4 py-3 ${CATEGORY_COLORS[category] || CATEGORY_COLORS.geral} border-b`}
                          >
                            <span className="font-medium">
                              {CATEGORY_LABELS[category] || category}
                            </span>
                            <button
                              onClick={() => selectAllInCategory(category)}
                              className="text-xs px-2 py-1 rounded bg-white/50 hover:bg-white transition-colors"
                            >
                              {perms.every(p => selectedPermissions.includes(p.id)) ? 'Desmarcar todos' : 'Marcar todos'}
                            </button>
                          </div>
                          <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-2 gap-3">
                            {perms.map((perm) => (
                              <label
                                key={perm.id}
                                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                  selectedPermissions.includes(perm.id)
                                    ? 'border-purple-400 bg-purple-50'
                                    : 'border-gray-200 hover:border-purple-200'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.includes(perm.id)}
                                  onChange={() => togglePermission(perm.id)}
                                  className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                                />
                                <div>
                                  <p className="font-medium text-gray-800 text-sm">{perm.name}</p>
                                  <p className="text-xs text-gray-500">{perm.description}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}

                      <div className="flex justify-end gap-3 pt-4">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedGroup(null);
                            setSelectedPermissions([]);
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={() => handleUpdatePermissions(group)}
                          disabled={savingPermissions}
                        >
                          {savingPermissions ? 'Salvando...' : 'Salvar Permissões'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Visualização das permissões
                    <div className="space-y-3">
                      {Object.entries(permissionsByCategory).map(([category, perms]) => {
                        const categoryPermissions = perms.filter(p => group.permissions.includes(p.id));
                        if (categoryPermissions.length === 0) return null;

                        return (
                          <div key={category}>
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium mb-2 ${CATEGORY_COLORS[category] || CATEGORY_COLORS.geral}`}>
                              {CATEGORY_LABELS[category] || category}
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {categoryPermissions.map((perm) => (
                                <span
                                  key={perm.id}
                                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                                  title={perm.description}
                                >
                                  {perm.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {group.permissions.length === 0 && (
                        <p className="text-gray-500 italic">Nenhuma permissão atribuída</p>
                      )}
                    </div>
                  )}
                </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Modal de Criar Grupo */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setCreateForm({ name: '', display_name: '', description: '' });
            setSelectedPermissions([]);
          }}
          title="Novo Grupo de Permissões"
          size="lg"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código (slug) *
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({
                    ...prev,
                    name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                  }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="ex: gerente_vendas"
                />
                <p className="text-xs text-gray-500 mt-1">Apenas letras minúsculas, números e _</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome de exibição *
                </label>
                <input
                  type="text"
                  value={createForm.display_name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, display_name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Ex: Gerente de Vendas"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </label>
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Descrição do grupo..."
                rows={2}
              />
            </div>

            <div>
              <h4 className="font-medium text-gray-800 mb-3">Selecione as permissões:</h4>
              <div className="max-h-[400px] overflow-y-auto space-y-4 pr-2">
                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <div key={category} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div
                      className={`flex items-center justify-between px-4 py-3 ${CATEGORY_COLORS[category] || CATEGORY_COLORS.geral} border-b`}
                    >
                      <span className="font-medium">
                        {CATEGORY_LABELS[category] || category}
                      </span>
                      <button
                        onClick={() => selectAllInCategory(category)}
                        className="text-xs px-2 py-1 rounded bg-white/50 hover:bg-white transition-colors"
                      >
                        {perms.every(p => selectedPermissions.includes(p.id)) ? 'Desmarcar' : 'Marcar todos'}
                      </button>
                    </div>
                    <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-2 gap-3">
                      {perms.map((perm) => (
                        <label
                          key={perm.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            selectedPermissions.includes(perm.id)
                              ? 'border-purple-400 bg-purple-50'
                              : 'border-gray-200 hover:border-purple-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedPermissions.includes(perm.id)}
                            onChange={() => togglePermission(perm.id)}
                            className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                          />
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{perm.name}</p>
                            <p className="text-xs text-gray-500">{perm.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateForm({ name: '', display_name: '', description: '' });
                  setSelectedPermissions([]);
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateGroup}
                disabled={savingCreate || !createForm.name.trim() || !createForm.display_name.trim()}
                className="flex-1"
              >
                {savingCreate ? 'Criando...' : 'Criar Grupo'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal de Editar Grupo */}
        <Modal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedGroup(null);
            setEditForm({ display_name: '', description: '' });
          }}
          title="Editar Grupo"
          size="sm"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome de exibição *
              </label>
              <input
                type="text"
                value={editForm.display_name}
                onChange={(e) => setEditForm(prev => ({ ...prev, display_name: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows={3}
              />
            </div>

            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-sm text-gray-600">
                <strong>Código:</strong> {selectedGroup?.name}
              </p>
              <p className="text-xs text-gray-500 mt-1">O código não pode ser alterado</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedGroup(null);
                  setEditForm({ display_name: '', description: '' });
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpdateGroup}
                disabled={savingEdit || !editForm.display_name.trim()}
                className="flex-1"
              >
                {savingEdit ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Confirm Delete Dialog */}
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => {
            setShowDeleteConfirm(false);
            setSelectedGroup(null);
          }}
          onConfirm={handleDeleteGroup}
          title="Excluir Grupo"
          message={`Tem certeza que deseja excluir o grupo "${selectedGroup?.display_name}"? Esta ação não pode ser desfeita.`}
          type="danger"
          confirmText="Excluir"
        />
      </div>
    </div>
  );
}
