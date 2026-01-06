'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Usuario {
  id: string;
  email: string;
  username: string;
  nome: string;
  role: 'admin' | 'user';
  colaborador_id: number | null;
  colaborador_nome: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  ativo: boolean;
}

interface Colaborador {
  id: number;
  nome: string;
}

export default function UsuariosPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showColaboradorModal, setShowColaboradorModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [selectedColaboradorId, setSelectedColaboradorId] = useState<number | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [savingColaborador, setSavingColaborador] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ nome: '', username: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ nome: '', username: '', email: '', password: '', role: 'user' as 'admin' | 'user' });
  const [savingCreate, setSavingCreate] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);

  useEffect(() => {
    console.log('Auth state:', { authLoading, isAdmin });

    if (authLoading) {
      console.log('Still loading auth...');
      return;
    }

    console.log('Loading usuarios...');
    loadUsuarios();
    loadColaboradores();
  }, [authLoading, isAdmin]);

  const loadColaboradores = async () => {
    try {
      const { data, error } = await supabase
        .from('colaboradores')
        .select('id, nome')
        .order('nome');

      if (error) {
        console.error('Erro ao carregar colaboradores:', error);
        return;
      }

      setColaboradores(data || []);
    } catch (err) {
      console.error('Erro:', err);
    }
  };

  const loadUsuarios = async () => {
    console.log('Carregando usuários via API...');
    try {
      const response = await fetch('/api/admin/usuarios');
      const result = await response.json();

      if (!response.ok) {
        console.error('Erro ao carregar usuários:', result);
        if (response.status === 403) {
          toast.error('Acesso negado: apenas administradores');
          router.push('/');
          return;
        }
        toast.error(result.error || 'Erro ao carregar usuários');
        setLoading(false);
        return;
      }

      console.log('Usuários carregados:', result.usuarios?.length);
      setUsuarios(result.usuarios || []);
    } catch (err) {
      console.error('Erro catch:', err);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase.rpc('delete_user', {
        user_id: selectedUser.id
      });

      if (error) {
        toast.error(error.message || 'Erro ao excluir usuário');
        return;
      }

      toast.success('Usuário excluído com sucesso');
      setUsuarios(usuarios.filter(u => u.id !== selectedUser.id));
    } catch (err) {
      console.error('Erro:', err);
      toast.error('Erro ao excluir usuário');
    } finally {
      setShowDeleteConfirm(false);
      setSelectedUser(null);
    }
  };

  const handleResendEmail = async (usuario: Usuario) => {
    setSendingEmail(usuario.id);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: usuario.email,
      });

      if (error) {
        toast.error(error.message || 'Erro ao reenviar email');
        return;
      }

      toast.success(`Email de confirmação reenviado para ${usuario.email}`);
    } catch (err) {
      console.error('Erro:', err);
      toast.error('Erro ao reenviar email');
    } finally {
      setSendingEmail(null);
    }
  };

  const handleUpdateRole = async (newRole: 'admin' | 'user') => {
    if (!selectedUser) return;

    setSavingRole(true);
    try {
      const response = await fetch('/api/admin/usuarios', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          role: newRole,
          action: 'updateRole'
        })
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Erro ao atualizar permissão');
        return;
      }

      toast.success('Permissão atualizada com sucesso');
      setUsuarios(usuarios.map(u =>
        u.id === selectedUser.id ? { ...u, role: newRole } : u
      ));
    } catch (err) {
      console.error('Erro:', err);
      toast.error('Erro ao atualizar permissão');
    } finally {
      setSavingRole(false);
      setShowRoleModal(false);
      setSelectedUser(null);
    }
  };

  const handleToggleStatus = async (usuario: Usuario) => {
    setTogglingStatus(usuario.id);
    try {
      const response = await fetch('/api/admin/usuarios', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: usuario.id,
          ativo: !usuario.ativo,
          action: 'toggleStatus'
        })
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Erro ao alterar status');
        return;
      }

      toast.success(usuario.ativo ? 'Usuário desativado' : 'Usuário ativado');
      setUsuarios(usuarios.map(u =>
        u.id === usuario.id ? { ...u, ativo: !usuario.ativo } : u
      ));
    } catch (err) {
      console.error('Erro:', err);
      toast.error('Erro ao alterar status');
    } finally {
      setTogglingStatus(null);
    }
  };

  const handleCreateUser = async () => {
    setSavingCreate(true);
    try {
      const response = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: createForm.email,
          password: createForm.password,
          nome: createForm.nome,
          username: createForm.username,
          role: createForm.role,
        })
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Erro ao criar usuário');
        return;
      }

      toast.success('Usuário criado com sucesso!');

      // Adicionar novo usuário à lista
      setUsuarios(prev => [...prev, {
        id: result.usuario.id,
        email: result.usuario.email,
        nome: result.usuario.nome,
        username: result.usuario.username,
        role: result.usuario.role,
        colaborador_id: null,
        colaborador_nome: null,
        created_at: new Date().toISOString(),
        last_sign_in_at: null,
        ativo: true,
      }]);

      setShowCreateModal(false);
      setCreateForm({ nome: '', username: '', email: '', password: '', role: 'user' });
    } catch (err) {
      console.error('Erro:', err);
      toast.error('Erro ao criar usuário');
    } finally {
      setSavingCreate(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!selectedUser) return;

    setSavingEdit(true);
    try {
      const response = await fetch('/api/admin/usuarios', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          nome: editForm.nome,
          username: editForm.username,
          action: 'updateProfile'
        })
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Erro ao atualizar usuário');
        return;
      }

      toast.success('Usuário atualizado com sucesso');
      setUsuarios(usuarios.map(u =>
        u.id === selectedUser.id
          ? { ...u, nome: editForm.nome, username: editForm.username }
          : u
      ));
    } catch (err) {
      console.error('Erro:', err);
      toast.error('Erro ao atualizar usuário');
    } finally {
      setSavingEdit(false);
      setShowEditModal(false);
      setSelectedUser(null);
      setEditForm({ nome: '', username: '' });
    }
  };

  const handleUpdateColaborador = async () => {
    if (!selectedUser) return;

    setSavingColaborador(true);
    try {
      const response = await fetch('/api/admin/usuarios', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          colaboradorId: selectedColaboradorId,
          action: 'updateColaborador'
        })
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Erro ao vincular colaborador');
        return;
      }

      const colaboradorNome = colaboradores.find(c => c.id === selectedColaboradorId)?.nome || null;

      toast.success('Colaborador vinculado com sucesso');
      setUsuarios(usuarios.map(u =>
        u.id === selectedUser.id
          ? { ...u, colaborador_id: selectedColaboradorId, colaborador_nome: colaboradorNome }
          : u
      ));
    } catch (err) {
      console.error('Erro:', err);
      toast.error('Erro ao vincular colaborador');
    } finally {
      setSavingColaborador(false);
      setShowColaboradorModal(false);
      setSelectedUser(null);
      setSelectedColaboradorId(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
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
            <h1 className="text-3xl font-bold text-gray-800">Gerenciar Usuários</h1>
            <p className="text-gray-600 mt-1">
              {usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''} cadastrado{usuarios.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Novo Usuário
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/admin')}
            >
              Voltar
            </Button>
          </div>
        </div>

        {/* Lista de Usuários */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Usuário</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Permissão</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Colaborador</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Último Acesso</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuarios.map((usuario) => (
                  <tr key={usuario.id} className="hover:bg-purple-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className={`font-medium ${usuario.ativo ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                            {usuario.nome}
                          </p>
                          <p className="text-sm text-gray-500">@{usuario.username}</p>
                        </div>
                        {!usuario.ativo && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                            Desativado
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-6 py-4 ${usuario.ativo ? 'text-gray-600' : 'text-gray-400'}`}>{usuario.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        usuario.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {usuario.role === 'admin' ? 'Administrador' : 'Usuário'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {usuario.colaborador_nome ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-700">
                          {usuario.colaborador_nome}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Não vinculado</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(usuario.last_sign_in_at)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedUser(usuario);
                            setEditForm({ nome: usuario.nome, username: usuario.username });
                            setShowEditModal(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Editar usuário"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(usuario);
                            setSelectedColaboradorId(usuario.colaborador_id);
                            setShowColaboradorModal(true);
                          }}
                          className="p-2 text-pink-600 hover:bg-pink-100 rounded-lg transition-colors"
                          title="Vincular colaborador"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(usuario);
                            setShowRoleModal(true);
                          }}
                          className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                          title="Alterar permissão"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleToggleStatus(usuario)}
                          disabled={togglingStatus === usuario.id}
                          className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                            usuario.ativo
                              ? 'text-yellow-600 hover:bg-yellow-100'
                              : 'text-green-600 hover:bg-green-100'
                          }`}
                          title={usuario.ativo ? 'Desativar usuário' : 'Ativar usuário'}
                        >
                          {togglingStatus === usuario.id ? (
                            <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          ) : usuario.ativo ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                        {!usuario.last_sign_in_at && (
                          <button
                            onClick={() => handleResendEmail(usuario)}
                            disabled={sendingEmail === usuario.id}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                            title="Reenviar email de confirmação"
                          >
                            {sendingEmail === usuario.id ? (
                              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedUser(usuario);
                            setShowDeleteConfirm(true);
                          }}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="Excluir usuário"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {usuarios.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">Nenhum usuário encontrado</p>
            </div>
          )}
        </div>

        {/* Modal de Editar Usuário */}
        <Modal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
            setEditForm({ nome: '', username: '' });
          }}
          title="Editar Usuário"
          size="sm"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome completo
              </label>
              <input
                type="text"
                value={editForm.nome}
                onChange={(e) => setEditForm(prev => ({ ...prev, nome: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Nome do usuário"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="username"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Apenas letras minúsculas, números e _</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-sm text-gray-600">
                <strong>Email:</strong> {selectedUser?.email}
              </p>
              <p className="text-xs text-gray-500 mt-1">O email não pode ser alterado</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedUser(null);
                  setEditForm({ nome: '', username: '' });
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpdateProfile}
                disabled={savingEdit || !editForm.nome.trim() || !editForm.username.trim()}
                className="flex-1"
              >
                {savingEdit ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal de Alterar Role */}
        <Modal
          isOpen={showRoleModal}
          onClose={() => {
            setShowRoleModal(false);
            setSelectedUser(null);
          }}
          title="Alterar Permissão"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Alterar permissão de <strong>{selectedUser?.nome}</strong>:
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleUpdateRole('admin')}
                disabled={savingRole}
                className={`p-4 rounded-xl border-2 transition-all disabled:opacity-50 ${
                  selectedUser?.role === 'admin'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-800">Administrador</p>
                    <p className="text-sm text-gray-500">Acesso total ao sistema</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => handleUpdateRole('user')}
                disabled={savingRole}
                className={`p-4 rounded-xl border-2 transition-all disabled:opacity-50 ${
                  selectedUser?.role === 'user'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-800">Usuário</p>
                    <p className="text-sm text-gray-500">Acesso limitado</p>
                  </div>
                </div>
              </button>
            </div>
            {savingRole && (
              <p className="text-center text-sm text-purple-600">Atualizando permissão...</p>
            )}
          </div>
        </Modal>

        {/* Modal de Vincular Colaborador */}
        <Modal
          isOpen={showColaboradorModal}
          onClose={() => {
            setShowColaboradorModal(false);
            setSelectedUser(null);
            setSelectedColaboradorId(null);
          }}
          title="Vincular Colaborador"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Vincular <strong>{selectedUser?.nome}</strong> a uma colaboradora:
            </p>
            <p className="text-sm text-gray-500">
              Isso permite que o usuário veja apenas suas próprias comissões.
            </p>

            <select
              value={selectedColaboradorId ?? ''}
              onChange={(e) => setSelectedColaboradorId(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            >
              <option value="">Sem vínculo</option>
              {colaboradores.map((colab) => (
                <option key={colab.id} value={colab.id}>
                  {colab.nome}
                </option>
              ))}
            </select>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowColaboradorModal(false);
                  setSelectedUser(null);
                  setSelectedColaboradorId(null);
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpdateColaborador}
                disabled={savingColaborador}
                className="flex-1"
              >
                {savingColaborador ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal de Criar Usuário */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setCreateForm({ nome: '', username: '', email: '', password: '', role: 'user' });
            setShowPassword(false);
          }}
          title="Novo Usuário"
          size="md"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome completo *
                </label>
                <input
                  type="text"
                  value={createForm.nome}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Nome do usuário"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                  <input
                    type="text"
                    value={createForm.username}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="username"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="email@exemplo.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={createForm.password}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Mínimo de 6 caracteres</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de usuário *
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCreateForm(prev => ({ ...prev, role: 'user' }))}
                  className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                    createForm.role === 'user'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-800">Usuário</p>
                      <p className="text-xs text-gray-500">Acesso limitado</p>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCreateForm(prev => ({ ...prev, role: 'admin' }))}
                  className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                    createForm.role === 'admin'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-800">Administrador</p>
                      <p className="text-xs text-gray-500">Acesso total</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateForm({ nome: '', username: '', email: '', password: '', role: 'user' });
                  setShowPassword(false);
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateUser}
                disabled={savingCreate || !createForm.nome.trim() || !createForm.username.trim() || !createForm.email.trim() || createForm.password.length < 6}
                className="flex-1"
              >
                {savingCreate ? 'Criando...' : 'Criar Usuário'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Confirm Delete Dialog */}
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => {
            setShowDeleteConfirm(false);
            setSelectedUser(null);
          }}
          onConfirm={handleDeleteUser}
          title="Excluir Usuário"
          message={`Tem certeza que deseja excluir o usuário "${selectedUser?.nome}"? Esta ação não pode ser desfeita.`}
          type="danger"
          confirmText="Excluir"
        />
      </div>
    </div>
  );
}
