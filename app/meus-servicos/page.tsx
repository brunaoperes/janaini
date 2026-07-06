'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import toast from 'react-hot-toast';
import type { Servico } from '@/lib/supabase';

const EMPTY = { nome: '', duracao_minutos: 60, valor: 0, descricao: '', ativo: true };

export default function MeusServicosPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [meus, setMeus] = useState<Servico[]>([]);
  const [doSalao, setDoSalao] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Servico | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [salvando, setSalvando] = useState(false);
  const [excluir, setExcluir] = useState<Servico | null>(null);

  // precisa estar vinculado a uma colaboradora
  useEffect(() => {
    if (!authLoading && profile && !profile.colaborador_id) {
      toast.error('Seu usuário não está vinculado a uma profissional. Fale com a administração.');
      router.push('/');
    }
  }, [authLoading, profile, router]);

  const carregar = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/servicos', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) { setMeus(json.meus || []); setDoSalao(json.doSalao || []); }
      else toast.error(json.error || 'Erro ao carregar serviços.');
    } catch { toast.error('Erro de conexão.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => { setEditando(null); setForm(EMPTY); setModalOpen(true); };
  const abrirEdicao = (s: Servico) => {
    setEditando(s);
    setForm({ nome: s.nome, duracao_minutos: s.duracao_minutos, valor: Number(s.valor), descricao: s.descricao || '', ativo: s.ativo });
    setModalOpen(true);
  };

  const salvar = async () => {
    if (form.nome.trim().length < 3) { toast.error('O nome precisa de ao menos 3 letras.'); return; }
    if (form.valor < 0) { toast.error('O valor não pode ser negativo.'); return; }
    setSalvando(true);
    try {
      const url = editando ? `/api/servicos?id=${editando.id}` : '/api/servicos';
      const res = await fetch(url, { method: editando ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const json = await res.json();
      if (res.ok) { toast.success(editando ? 'Serviço atualizado!' : 'Serviço criado!'); setModalOpen(false); carregar(); }
      else toast.error(json.error || 'Erro ao salvar.');
    } catch { toast.error('Erro de conexão.'); }
    finally { setSalvando(false); }
  };

  const confirmarExcluir = async () => {
    if (!excluir) return;
    try {
      const res = await fetch(`/api/servicos?id=${excluir.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok) { toast.success(json.desativado ? json.message : 'Serviço excluído!'); carregar(); }
      else toast.error(json.error || 'Erro ao excluir.');
    } catch { toast.error('Erro de conexão.'); }
    finally { setExcluir(null); }
  };

  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Meus Serviços</h1>
            <p className="text-gray-500 text-sm mt-1">Crie e gerencie os serviços que só você realiza</p>
          </div>
          <Button onClick={abrirNovo}>+ Novo Serviço</Button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Carregando…</div>
        ) : (
          <>
            {/* Meus serviços (editáveis) */}
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
              <h2 className="font-bold text-gray-800 mb-3">Criados por mim ({meus.length})</h2>
              {meus.length === 0 ? (
                <p className="text-gray-400 text-sm py-6 text-center">Você ainda não criou nenhum serviço. Toque em “Novo Serviço” pra começar.</p>
              ) : (
                <div className="space-y-2">
                  {meus.map((s) => (
                    <div key={s.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${s.ativo ? 'border-purple-100 bg-purple-50/40' : 'border-gray-100 bg-gray-50 opacity-70'}`}>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-800 flex items-center gap-2">
                          {s.nome}
                          {!s.ativo && <span className="text-[10px] font-bold uppercase text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">inativo</span>}
                        </div>
                        <div className="text-sm text-gray-500">{brl(Number(s.valor))} · {s.duracao_minutos} min</div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => abrirEdicao(s)}>Editar</Button>
                        <Button variant="danger" size="sm" onClick={() => setExcluir(s)}>Excluir</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Serviços do salão (só leitura) */}
            <div className="bg-white/70 rounded-2xl p-5">
              <h2 className="font-bold text-gray-700 mb-1">Serviços do salão ({doSalao.length})</h2>
              <p className="text-xs text-gray-400 mb-3">Estes são gerenciados pela administração — você pode usá-los nos atendimentos, mas não editar aqui.</p>
              <div className="flex flex-wrap gap-2">
                {doSalao.map((s) => (
                  <span key={s.id} className="text-sm bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg">{s.nome} · {brl(Number(s.valor))}</span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar serviço' : 'Novo serviço'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do serviço</label>
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={100}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-400 outline-none" placeholder="Ex.: Progressiva, Corte feminino…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
              <input type="number" min={0} step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-400 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duração (min)</label>
              <input type="number" min={1} max={480} value={form.duracao_minutos} onChange={(e) => setForm({ ...form, duracao_minutos: parseInt(e.target.value) || 60 })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-400 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (opcional)</label>
            <textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} maxLength={500} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-400 outline-none" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} className="rounded" />
            Serviço ativo (aparece pra você usar nos atendimentos)
          </label>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={() => setModalOpen(false)} fullWidth>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando} fullWidth>{salvando ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!excluir}
        onClose={() => setExcluir(null)}
        onConfirm={confirmarExcluir}
        title="Excluir serviço"
        message={`Tem certeza que deseja excluir "${excluir?.nome}"? Se ele já foi usado em atendimentos, será apenas desativado.`}
        confirmText="Excluir"
        type="danger"
      />
    </div>
  );
}
