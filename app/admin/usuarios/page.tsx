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
  created_at: string;
  last_sign_in: string | null;
  email_confirmed: boolean;
}

export default function UsuariosPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  useEffect(() => {
    console.log('Auth state:', { authLoading, isAdmin });

    if (authLoading) {
      console.log('Still loading auth...');
      return;
    }

    console.log('Loading usuarios...');
    loadUsuarios();
  }, [authLoading, isAdmin]);

  const loadUsuarios = async () => {
    console.log('Chamando list_all_users...');
    try {
      const { data, error } = await supabase.rpc('list_all_users');
      console.log('Resposta:', { data, error });

      if (error) {
        console.error('Erro ao carregar usuários:', error);
        if (error.message?.includes('Acesso negado') || error.code === 'P0001') {
          toast.error('Acesso negado: apenas administradores');
          router.push('/');
          return;
        }
        toast.error('Erro ao carregar usuários');
        setLoading(false);
        return;
      }

      setUsuarios(data || []);
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

    try {
      const { error } = await supabase.rpc('update_user_role', {
        user_id: selectedUser.id,
        new_role: newRole
      });

      if (error) {
        toast.error(error.message || 'Erro ao atualizar permissão');
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
      setShowRoleModal(false);
      setSelectedUser(null);
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
          <Button
            variant="outline"
            onClick={() => router.push('/admin')}
          >
            Voltar
          </Button>
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
                  <th className="px-6 py-4 text-left text-sm font-semibold">Cadastro</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Último Acesso</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuarios.map((usuario) => (
                  <tr key={usuario.id} className="hover:bg-purple-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-800">{usuario.nome}</p>
                        <p className="text-sm text-gray-500">@{usuario.username}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{usuario.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        usuario.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {usuario.role === 'admin' ? 'Administrador' : 'Usuário'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(usuario.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(usuario.last_sign_in)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
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
                        {!usuario.last_sign_in && (
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
                className={`p-4 rounded-xl border-2 transition-all ${
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
                className={`p-4 rounded-xl border-2 transition-all ${
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
